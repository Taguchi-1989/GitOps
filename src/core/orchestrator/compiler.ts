/**
 * FlowOps - Workflow Compiler
 *
 * YAML Flow定義を実行可能なステートマシンにコンパイル
 * taskId参照を解決し、Gitコミットハッシュを記録
 */

import { Flow, Node, Edge } from '../parser/schema';
import { MicroTaskDefinition } from './schemas/micro-task';
import { taskRegistry } from './task-registry';

// --------------------------------------------------------
// Compiled Workflow Types
// --------------------------------------------------------
export interface CompiledNode {
  id: string;
  type: Node['type'];
  label: string;
  role?: string;
  system?: string;
  taskId?: string;
  task?: MicroTaskDefinition;
  gitCommitHash?: string;
  meta?: Record<string, unknown>;
  outgoingEdges: CompiledEdge[];
}

export interface CompiledEdge {
  id: string;
  to: string;
  label?: string;
  condition?: string;
}

export interface CompiledWorkflow {
  flowId: string;
  title: string;
  startNodeId: string;
  nodes: Map<string, CompiledNode>;
  taskSnapshots: Map<string, { task: MicroTaskDefinition; gitCommitHash: string }>;
}

export class CompilationError extends Error {
  code: 'MISSING_START' | 'MISSING_TASK' | 'SCHEMA_MISMATCH' | 'INVALID_GRAPH';

  constructor(
    code: 'MISSING_START' | 'MISSING_TASK' | 'SCHEMA_MISMATCH' | 'INVALID_GRAPH',
    message: string
  ) {
    super(message);
    this.name = 'CompilationError';
    this.code = code;
  }
}

// --------------------------------------------------------
// Git commit hash resolver
// --------------------------------------------------------
export type GitHashResolver = () => Promise<string>;

let defaultGitHashResolver: GitHashResolver = async () => 'unknown';

export function setGitHashResolver(resolver: GitHashResolver): void {
  defaultGitHashResolver = resolver;
}

// --------------------------------------------------------
// Compiler
// --------------------------------------------------------
export async function compileWorkflow(
  flow: Flow,
  gitHashResolver?: GitHashResolver
): Promise<CompiledWorkflow> {
  const resolver = gitHashResolver || defaultGitHashResolver;
  const gitCommitHash = await resolver();

  // startノードを探す
  const startNode = Object.values(flow.nodes).find(n => n.type === 'start');
  if (!startNode) {
    throw new CompilationError('MISSING_START', `Flow '${flow.id}' has no start node`);
  }

  // ノードをコンパイル
  const compiledNodes = new Map<string, CompiledNode>();
  const taskSnapshots = new Map<string, { task: MicroTaskDefinition; gitCommitHash: string }>();

  for (const [nodeId, node] of Object.entries(flow.nodes)) {
    const outgoingEdges = Object.values(flow.edges)
      .filter((e: Edge) => e.from === nodeId)
      .map((e: Edge) => ({
        id: e.id,
        to: e.to,
        label: e.label,
        condition: e.condition,
      }));

    const compiled: CompiledNode = {
      id: nodeId,
      type: node.type,
      label: node.label,
      role: node.role,
      system: node.system,
      taskId: node.taskId,
      meta: node.meta as Record<string, unknown> | undefined,
      outgoingEdges,
    };

    // タスク参照を解決
    if (node.taskId) {
      const task = await taskRegistry.getTask(node.taskId);
      if (!task) {
        throw new CompilationError(
          'MISSING_TASK',
          `Node '${nodeId}' references task '${node.taskId}' which was not found in spec/tasks/`
        );
      }
      compiled.task = task;
      compiled.gitCommitHash = gitCommitHash;
      taskSnapshots.set(node.taskId, { task, gitCommitHash });
    }

    compiledNodes.set(nodeId, compiled);
  }

  return {
    flowId: flow.id,
    title: flow.title,
    startNodeId: startNode.id,
    nodes: compiledNodes,
    taskSnapshots,
  };
}
