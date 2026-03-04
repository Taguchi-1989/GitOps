/**
 * FlowOps - Workflow Engine
 *
 * コンパイル済みワークフローを実行するステートマシンエンジン
 * ノード単位で処理し、PostgreSQLにチェックポイントを保存
 */

import { CompiledWorkflow, CompiledNode } from './compiler';
import { TaskExecutor } from './task-executor';
import { TaskInvocation } from './schemas/micro-task';
import { WorkflowStatus } from './schemas/execution';
import { auditLog } from '../audit/logger';

// --------------------------------------------------------
// Engine Types
// --------------------------------------------------------
export interface WorkflowState {
  executionId: string;
  flowId: string;
  traceId: string;
  status: WorkflowStatus;
  currentNodeId: string;
  stateData: Record<string, unknown>;
  initiatorId: string;
}

export interface NodeResult {
  nextNodeId: string | null; // null = ワークフロー完了
  output: Record<string, unknown>;
  status: 'continue' | 'completed' | 'paused-human-review' | 'failed';
  approvalRequestId?: string;
}

/**
 * 永続化インターフェース（Prisma実装はlib層で注入）
 */
export interface IWorkflowRepository {
  createExecution(state: WorkflowState): Promise<void>;
  updateExecution(executionId: string, updates: Partial<WorkflowState>): Promise<void>;
  getExecution(executionId: string): Promise<WorkflowState | null>;
  createTaskExecution(data: {
    workflowId: string;
    nodeId: string;
    taskId: string;
    taskVersion: string;
    gitCommitHash: string;
    status: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    llmModelUsed?: string;
    llmTokensInput?: number;
    llmTokensOutput?: number;
    durationMs?: number;
    traceId: string;
  }): Promise<string>;
  createApprovalRequest(data: {
    workflowId: string;
    nodeId: string;
    description: string;
    context: Record<string, unknown>;
  }): Promise<string>;
}

// --------------------------------------------------------
// Workflow Engine
// --------------------------------------------------------
export class WorkflowEngine {
  private repository: IWorkflowRepository | null = null;
  private taskExecutor: TaskExecutor | null = null;

  setRepository(repo: IWorkflowRepository): void {
    this.repository = repo;
  }

  setTaskExecutor(executor: TaskExecutor): void {
    this.taskExecutor = executor;
  }

  /**
   * ワークフロー実行を開始
   */
  async startExecution(
    workflow: CompiledWorkflow,
    traceId: string,
    initiatorId: string,
    inputData: Record<string, unknown> = {}
  ): Promise<WorkflowState> {
    const executionId = `wfe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const state: WorkflowState = {
      executionId,
      flowId: workflow.flowId,
      traceId,
      status: 'running',
      currentNodeId: workflow.startNodeId,
      stateData: { ...inputData },
      initiatorId,
    };

    if (this.repository) {
      await this.repository.createExecution(state);
    }

    await auditLog.logWorkflowAction('WORKFLOW_START', executionId, traceId, {
      flowId: workflow.flowId,
      initiatorId,
    });

    // 自動的にstartノードから実行を開始
    return this.runUntilPause(workflow, state);
  }

  /**
   * 一時停止中のワークフローを再開
   */
  async resumeExecution(
    workflow: CompiledWorkflow,
    state: WorkflowState,
    nextNodeId: string
  ): Promise<WorkflowState> {
    state.status = 'running';
    state.currentNodeId = nextNodeId;

    if (this.repository) {
      await this.repository.updateExecution(state.executionId, {
        status: 'running',
        currentNodeId: nextNodeId,
      });
    }

    return this.runUntilPause(workflow, state);
  }

  /**
   * 一時停止またはワークフロー完了まで実行を続ける
   */
  private async runUntilPause(
    workflow: CompiledWorkflow,
    state: WorkflowState
  ): Promise<WorkflowState> {
    let currentNodeId = state.currentNodeId;
    const maxSteps = 100; // 無限ループ防止

    for (let step = 0; step < maxSteps; step++) {
      const node = workflow.nodes.get(currentNodeId);
      if (!node) {
        state.status = 'failed';
        state.stateData = { ...state.stateData, error: `Node '${currentNodeId}' not found` };
        if (this.repository) {
          await this.repository.updateExecution(state.executionId, {
            status: 'failed',
            stateData: state.stateData,
          });
        }
        return state;
      }

      const result = await this.processNode(workflow, node, state);

      // ノード出力をstateDataにマージ
      state.stateData = { ...state.stateData, ...result.output };
      state.currentNodeId = result.nextNodeId || currentNodeId;

      if (this.repository) {
        await this.repository.updateExecution(state.executionId, {
          currentNodeId: state.currentNodeId,
          stateData: state.stateData,
        });
      }

      switch (result.status) {
        case 'completed':
          state.status = 'completed';
          if (this.repository) {
            await this.repository.updateExecution(state.executionId, {
              status: 'completed',
            });
          }
          await auditLog.logWorkflowAction('WORKFLOW_COMPLETE', state.executionId, state.traceId, {
            flowId: state.flowId,
          });
          return state;

        case 'paused-human-review':
          state.status = 'paused-human-review';
          if (this.repository) {
            await this.repository.updateExecution(state.executionId, {
              status: 'paused-human-review',
            });
          }
          return state;

        case 'failed':
          state.status = 'failed';
          if (this.repository) {
            await this.repository.updateExecution(state.executionId, {
              status: 'failed',
              stateData: state.stateData,
            });
          }
          await auditLog.logWorkflowAction('WORKFLOW_FAIL', state.executionId, state.traceId, {
            flowId: state.flowId,
            error: result.output,
          });
          return state;

        case 'continue':
          if (!result.nextNodeId) {
            state.status = 'failed';
            return state;
          }
          currentNodeId = result.nextNodeId;
          break;
      }
    }

    // 最大ステップ数超過
    state.status = 'failed';
    state.stateData = {
      ...state.stateData,
      error: `Max steps (${maxSteps}) exceeded - possible infinite loop`,
    };
    if (this.repository) {
      await this.repository.updateExecution(state.executionId, {
        status: 'failed',
        stateData: state.stateData,
      });
    }
    return state;
  }

  /**
   * 個別ノードを処理
   */
  private async processNode(
    workflow: CompiledWorkflow,
    node: CompiledNode,
    state: WorkflowState
  ): Promise<NodeResult> {
    switch (node.type) {
      case 'start':
        return this.processStartNode(node);

      case 'end':
        return { nextNodeId: null, output: {}, status: 'completed' };

      case 'process':
        return this.processActionNode(node);

      case 'llm-task':
        return this.processLlmTaskNode(workflow, node, state);

      case 'human-review':
        return this.processHumanReviewNode(node, state);

      case 'decision':
        return this.processDecisionNode(node, state);

      case 'database':
        return this.processActionNode(node);

      default:
        return {
          nextNodeId: null,
          output: { error: `Unknown node type: ${node.type}` },
          status: 'failed',
        };
    }
  }

  private processStartNode(node: CompiledNode): NodeResult {
    const nextEdge = node.outgoingEdges[0];
    return {
      nextNodeId: nextEdge?.to || null,
      output: {},
      status: nextEdge ? 'continue' : 'completed',
    };
  }

  private processActionNode(node: CompiledNode): NodeResult {
    const nextEdge = node.outgoingEdges[0];
    return {
      nextNodeId: nextEdge?.to || null,
      output: { [`${node.id}_completed`]: true },
      status: nextEdge ? 'continue' : 'completed',
    };
  }

  private async processLlmTaskNode(
    workflow: CompiledWorkflow,
    node: CompiledNode,
    state: WorkflowState
  ): Promise<NodeResult> {
    if (!this.taskExecutor || !node.task) {
      return {
        nextNodeId: null,
        output: { error: `No task executor or task definition for node '${node.id}'` },
        status: 'failed',
      };
    }

    const invocation: TaskInvocation = {
      traceId: state.traceId,
      executionId: state.executionId,
      nodeId: node.id,
      taskId: node.task.id,
      taskVersion: node.task.version,
      gitCommitHash: node.gitCommitHash || 'unknown',
      input: state.stateData,
      context: {
        flowId: workflow.flowId,
        currentNodeLabel: node.label,
        previousNodes: [],
        roles: node.role ? [node.role] : [],
        systems: node.system ? [node.system] : [],
      },
    };

    const result = await this.taskExecutor.execute(node.task, invocation);

    // タスク実行を記録
    if (this.repository) {
      await this.repository.createTaskExecution({
        workflowId: state.executionId,
        nodeId: node.id,
        taskId: node.task.id,
        taskVersion: node.task.version,
        gitCommitHash: node.gitCommitHash || 'unknown',
        status: result.status,
        input: state.stateData,
        output: result.output,
        llmModelUsed: result.metadata.llmModelUsed,
        llmTokensInput: result.metadata.llmTokensUsed?.input,
        llmTokensOutput: result.metadata.llmTokensUsed?.output,
        durationMs: result.metadata.durationMs,
        traceId: state.traceId,
      });
    }

    await auditLog.logWorkflowAction('TASK_EXECUTE', state.executionId, state.traceId, {
      nodeId: node.id,
      taskId: node.task.id,
      status: result.status,
      llmModel: result.metadata.llmModelUsed,
    });

    if (result.status === 'needs-human-review') {
      // 承認待ちに遷移
      let approvalRequestId: string | undefined;
      if (this.repository) {
        approvalRequestId = await this.repository.createApprovalRequest({
          workflowId: state.executionId,
          nodeId: node.id,
          description: `タスク '${node.label}' の結果を確認してください`,
          context: {
            taskId: node.task.id,
            input: state.stateData,
            output: result.output,
          },
        });
      }
      return {
        nextNodeId: node.id, // 承認後にここから再開
        output: { [`${node.id}_output`]: result.output },
        status: 'paused-human-review',
        approvalRequestId,
      };
    }

    if (result.status === 'failure') {
      return {
        nextNodeId: null,
        output: { error: result.error },
        status: 'failed',
      };
    }

    const nextEdge = node.outgoingEdges[0];
    return {
      nextNodeId: nextEdge?.to || null,
      output: { [`${node.id}_output`]: result.output },
      status: nextEdge ? 'continue' : 'completed',
    };
  }

  private async processHumanReviewNode(
    node: CompiledNode,
    state: WorkflowState
  ): Promise<NodeResult> {
    let approvalRequestId: string | undefined;
    if (this.repository) {
      approvalRequestId = await this.repository.createApprovalRequest({
        workflowId: state.executionId,
        nodeId: node.id,
        description: node.label,
        context: { stateData: state.stateData },
      });
    }

    return {
      nextNodeId: node.id,
      output: {},
      status: 'paused-human-review',
      approvalRequestId,
    };
  }

  private processDecisionNode(node: CompiledNode, state: WorkflowState): NodeResult {
    // 条件付きエッジを評価
    for (const edge of node.outgoingEdges) {
      if (edge.condition) {
        if (this.evaluateCondition(edge.condition, state.stateData)) {
          return {
            nextNodeId: edge.to,
            output: { [`${node.id}_decision`]: edge.label || edge.condition },
            status: 'continue',
          };
        }
      }
    }

    // 条件なしのデフォルトエッジ
    const defaultEdge = node.outgoingEdges.find(e => !e.condition);
    if (defaultEdge) {
      return {
        nextNodeId: defaultEdge.to,
        output: { [`${node.id}_decision`]: 'default' },
        status: 'continue',
      };
    }

    // いずれの条件にもマッチしない場合は最初のエッジ
    const fallbackEdge = node.outgoingEdges[0];
    return {
      nextNodeId: fallbackEdge?.to || null,
      output: { [`${node.id}_decision`]: 'fallback' },
      status: fallbackEdge ? 'continue' : 'failed',
    };
  }

  /**
   * 条件式を評価（簡易実装: stateDataのキーベースで判定）
   */
  private evaluateCondition(condition: string, stateData: Record<string, unknown>): boolean {
    // "key == value" 形式（ハイフン・ドット含むキーにも対応）
    const eqMatch = condition.match(/^([\w.-]+)\s*==\s*['"]?(.+?)['"]?$/);
    if (eqMatch) {
      const [, key, value] = eqMatch;
      return String(stateData[key]) === value;
    }

    // "key != value" 形式
    const neqMatch = condition.match(/^([\w.-]+)\s*!=\s*['"]?(.+?)['"]?$/);
    if (neqMatch) {
      const [, key, value] = neqMatch;
      return String(stateData[key]) !== value;
    }

    // "key" のみ（truthy判定）
    if (/^[\w.-]+$/.test(condition)) {
      return !!stateData[condition];
    }

    // 評価不能な条件はfalse（安全側に倒す）
    return false;
  }
}

// シングルトン
export const workflowEngine = new WorkflowEngine();

export { WorkflowEngine as WorkflowEngineClass };
