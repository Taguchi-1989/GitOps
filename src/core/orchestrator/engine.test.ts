/**
 * FlowOps - Workflow Engine Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from './engine';
import type { IWorkflowRepository } from './engine';
import type { CompiledWorkflow, CompiledNode } from './compiler';
import type { TaskExecutor } from './task-executor';
import { auditLog } from '../audit/logger';

// Mock audit logger
vi.mock('../audit/logger', () => ({
  auditLog: {
    logWorkflowAction: vi.fn(),
  },
}));

function createMockRepository(): IWorkflowRepository {
  return {
    createExecution: vi.fn(),
    updateExecution: vi.fn(),
    getExecution: vi.fn(),
    createTaskExecution: vi.fn().mockResolvedValue('te-1'),
    createApprovalRequest: vi.fn().mockResolvedValue('ar-1'),
  };
}

function createCompiledWorkflow(nodes: Map<string, CompiledNode>): CompiledWorkflow {
  return {
    flowId: 'test-flow',
    title: 'Test',
    startNodeId: 'start',
    nodes,
    taskSnapshots: new Map(),
  };
}

function makeNode(
  id: string,
  type: CompiledNode['type'],
  outgoingEdges: CompiledNode['outgoingEdges'] = [],
  extra?: Partial<CompiledNode>
): CompiledNode {
  return { id, type, label: id, outgoingEdges, ...extra };
}

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let repo: IWorkflowRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new WorkflowEngine();
    repo = createMockRepository();
    engine.setRepository(repo);
  });

  describe('startExecution', () => {
    it('should start and complete a simple start->end workflow', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-1', 'user-1');

      expect(state.status).toBe('completed');
      expect(state.traceId).toBe('trace-1');
      expect(state.flowId).toBe('test-flow');
      expect(repo.createExecution).toHaveBeenCalledTimes(1);
      expect(auditLog.logWorkflowAction).toHaveBeenCalledWith(
        'WORKFLOW_START',
        expect.any(String),
        'trace-1',
        expect.objectContaining({ flowId: 'test-flow' })
      );
      expect(auditLog.logWorkflowAction).toHaveBeenCalledWith(
        'WORKFLOW_COMPLETE',
        expect.any(String),
        'trace-1',
        expect.objectContaining({ flowId: 'test-flow' })
      );
    });

    it('should traverse start->process->end', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'process' }])],
        ['process', makeNode('process', 'process', [{ id: 'e2', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-2', 'user-1');

      expect(state.status).toBe('completed');
      expect(state.stateData).toHaveProperty('process_completed', true);
    });

    it('should fail when a node is not found', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'missing' }])],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-3', 'user-1');

      expect(state.status).toBe('failed');
      expect(state.stateData).toHaveProperty('error');
      expect(String(state.stateData.error)).toContain('missing');
    });

    it('should fail when continue returns no nextNodeId', async () => {
      // A start node with no outgoing edges
      const nodes = new Map<string, CompiledNode>([['start', makeNode('start', 'start', [])]]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-4', 'user-1');

      // start with no edges returns completed status
      expect(state.status).toBe('completed');
    });

    it('should handle unknown node types', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'unknown' }])],
        [
          'unknown',
          makeNode('unknown', 'unknown-type' as CompiledNode['type'], [{ id: 'e2', to: 'end' }]),
        ],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-5', 'user-1');

      expect(state.status).toBe('failed');
    });
  });

  describe('decision nodes', () => {
    it('should follow matching condition edge', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'decide' }])],
        [
          'decide',
          makeNode('decide', 'decision', [
            { id: 'e2', to: 'pathA', condition: "status == 'active'" },
            { id: 'e3', to: 'pathB', condition: "status == 'inactive'" },
          ]),
        ],
        ['pathA', makeNode('pathA', 'process', [{ id: 'e4', to: 'end' }])],
        ['pathB', makeNode('pathB', 'process', [{ id: 'e5', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-6', 'user-1', {
        status: 'active',
      });

      expect(state.status).toBe('completed');
      expect(state.stateData).toHaveProperty('pathA_completed', true);
      expect(state.stateData).not.toHaveProperty('pathB_completed');
    });

    it('should follow default edge when no condition matches', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'decide' }])],
        [
          'decide',
          makeNode('decide', 'decision', [
            { id: 'e2', to: 'pathA', condition: "status == 'x'" },
            { id: 'e3', to: 'pathB' }, // default (no condition)
          ]),
        ],
        ['pathA', makeNode('pathA', 'process', [{ id: 'e4', to: 'end' }])],
        ['pathB', makeNode('pathB', 'process', [{ id: 'e5', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-7', 'user-1', {
        status: 'unknown',
      });

      expect(state.status).toBe('completed');
      expect(state.stateData).toHaveProperty('pathB_completed', true);
    });

    it('should evaluate != conditions correctly', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'decide' }])],
        [
          'decide',
          makeNode('decide', 'decision', [
            { id: 'e2', to: 'pathA', condition: "ok != 'true'" },
            { id: 'e3', to: 'pathB' },
          ]),
        ],
        ['pathA', makeNode('pathA', 'process', [{ id: 'e4', to: 'end' }])],
        ['pathB', makeNode('pathB', 'process', [{ id: 'e5', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-8', 'user-1', { ok: 'false' });

      expect(state.status).toBe('completed');
      expect(state.stateData).toHaveProperty('pathA_completed', true);
    });

    it('should evaluate truthy conditions', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'decide' }])],
        [
          'decide',
          makeNode('decide', 'decision', [
            { id: 'e2', to: 'pathA', condition: 'approved' },
            { id: 'e3', to: 'pathB' },
          ]),
        ],
        ['pathA', makeNode('pathA', 'process', [{ id: 'e4', to: 'end' }])],
        ['pathB', makeNode('pathB', 'process', [{ id: 'e5', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      // With truthy value
      const state1 = await engine.startExecution(workflow, 'trace-9a', 'user-1', {
        approved: true,
      });
      expect(state1.stateData).toHaveProperty('pathA_completed', true);

      // With falsy value
      const state2 = await engine.startExecution(workflow, 'trace-9b', 'user-1', {
        approved: false,
      });
      expect(state2.stateData).toHaveProperty('pathB_completed', true);
    });
  });

  describe('human-review nodes', () => {
    it('should pause at human-review node', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'review' }])],
        ['review', makeNode('review', 'human-review', [{ id: 'e2', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-10', 'user-1');

      expect(state.status).toBe('paused-human-review');
      expect(state.currentNodeId).toBe('review');
      expect(repo.createApprovalRequest).toHaveBeenCalledTimes(1);
    });

    it('should resume from human-review and complete', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'review' }])],
        ['review', makeNode('review', 'human-review', [{ id: 'e2', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      // Start and pause
      const paused = await engine.startExecution(workflow, 'trace-11', 'user-1');
      expect(paused.status).toBe('paused-human-review');

      // Resume from the next node
      const completed = await engine.resumeExecution(workflow, paused, 'end');
      expect(completed.status).toBe('completed');
    });
  });

  describe('llm-task nodes', () => {
    it('should execute llm-task with task executor', async () => {
      const mockTaskDef = {
        id: 'classify-inquiry',
        version: '1.0.0',
        type: 'llm-inference' as const,
        llmConfig: { systemPrompt: 'test', userPromptTemplate: '{{text}}' },
        inputSchema: { type: 'object' as const },
        outputSchema: { type: 'object' as const },
        requiresHumanApproval: false,
        maxRetries: 2,
        timeoutMs: 15000,
        metadata: { author: 'test', description: 'test' },
      };

      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          traceId: 'trace-12',
          executionId: 'wfe-1',
          taskId: 'classify-inquiry',
          status: 'success',
          output: { category: 'general' },
          metadata: {
            durationMs: 500,
            llmModelUsed: 'gpt-4o',
            llmTokensUsed: { input: 100, output: 50 },
          },
        }),
      } as unknown as TaskExecutor;

      engine.setTaskExecutor(mockExecutor);

      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'classify' }])],
        [
          'classify',
          makeNode('classify', 'llm-task', [{ id: 'e2', to: 'end' }], {
            task: mockTaskDef,
            gitCommitHash: 'abc123',
          }),
        ],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-12', 'user-1');

      expect(state.status).toBe('completed');
      expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
      expect(repo.createTaskExecution).toHaveBeenCalledTimes(1);
      expect(auditLog.logWorkflowAction).toHaveBeenCalledWith(
        'TASK_EXECUTE',
        expect.any(String),
        'trace-12',
        expect.objectContaining({ taskId: 'classify-inquiry' })
      );
    });

    it('should fail when no task executor is set', async () => {
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'llmNode' }])],
        ['llmNode', makeNode('llmNode', 'llm-task', [{ id: 'e2', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      // No task executor set
      const state = await engine.startExecution(workflow, 'trace-13', 'user-1');

      expect(state.status).toBe('failed');
    });

    it('should pause when task returns needs-human-review', async () => {
      const mockTaskDef = {
        id: 'review-task',
        version: '1.0.0',
        type: 'llm-inference' as const,
        llmConfig: { systemPrompt: 'test', userPromptTemplate: '{{text}}' },
        inputSchema: { type: 'object' as const },
        outputSchema: { type: 'object' as const },
        requiresHumanApproval: true,
        maxRetries: 0,
        timeoutMs: 15000,
        metadata: { author: 'test', description: 'test' },
      };

      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          traceId: 'trace-14',
          executionId: 'wfe-1',
          taskId: 'review-task',
          status: 'needs-human-review',
          output: { draft: 'Hello' },
          metadata: { durationMs: 300 },
        }),
      } as unknown as TaskExecutor;

      engine.setTaskExecutor(mockExecutor);

      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'task' }])],
        [
          'task',
          makeNode('task', 'llm-task', [{ id: 'e2', to: 'end' }], {
            task: mockTaskDef,
          }),
        ],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-14', 'user-1');

      expect(state.status).toBe('paused-human-review');
      expect(repo.createApprovalRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('infinite loop prevention', () => {
    it('should fail after max steps exceeded', async () => {
      // Create a cycle: start -> A -> B -> A (loop)
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'nodeA' }])],
        ['nodeA', makeNode('nodeA', 'process', [{ id: 'e2', to: 'nodeB' }])],
        ['nodeB', makeNode('nodeB', 'process', [{ id: 'e3', to: 'nodeA' }])],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engine.startExecution(workflow, 'trace-15', 'user-1');

      expect(state.status).toBe('failed');
      expect(String(state.stateData.error)).toContain('Max steps');
    });
  });

  describe('without repository', () => {
    it('should work without repository', async () => {
      const engineNoRepo = new WorkflowEngine();
      const nodes = new Map<string, CompiledNode>([
        ['start', makeNode('start', 'start', [{ id: 'e1', to: 'end' }])],
        ['end', makeNode('end', 'end')],
      ]);
      const workflow = createCompiledWorkflow(nodes);

      const state = await engineNoRepo.startExecution(workflow, 'trace-16', 'user-1');

      expect(state.status).toBe('completed');
    });
  });
});
