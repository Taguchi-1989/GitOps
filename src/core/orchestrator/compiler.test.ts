/**
 * FlowOps - Workflow Compiler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compileWorkflow, CompilationError, setGitHashResolver } from './compiler';
import { taskRegistry } from './task-registry';
import type { Flow } from '../parser/schema';
import type { MicroTaskDefinition } from './schemas/micro-task';

// Mock task registry
vi.mock('./task-registry', () => ({
  taskRegistry: {
    getTask: vi.fn(),
  },
}));

const mockGetTask = vi.mocked(taskRegistry.getTask);

function createMinimalFlow(overrides?: Partial<Flow>): Flow {
  return {
    id: 'test-flow',
    title: 'Test Flow',
    layer: 'L1',
    updatedAt: '2024-01-01',
    nodes: {
      start: { id: 'start', type: 'start', label: 'Start' },
      end: { id: 'end', type: 'end', label: 'End' },
    },
    edges: {
      e1: { id: 'e1', from: 'start', to: 'end' },
    },
    ...overrides,
  };
}

const mockTask: MicroTaskDefinition = {
  id: 'classify-inquiry',
  version: '1.0.0',
  type: 'llm-inference',
  llmConfig: {
    systemPrompt: 'You are a classifier',
    userPromptTemplate: '{{text}}',
  },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  requiresHumanApproval: false,
  maxRetries: 2,
  timeoutMs: 15000,
  metadata: { author: 'test', description: 'test task' },
};

describe('compileWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compile a minimal flow with start and end nodes', async () => {
    const flow = createMinimalFlow();
    const result = await compileWorkflow(flow);

    expect(result.flowId).toBe('test-flow');
    expect(result.title).toBe('Test Flow');
    expect(result.startNodeId).toBe('start');
    expect(result.nodes.size).toBe(2);
    expect(result.taskSnapshots.size).toBe(0);
  });

  it('should throw MISSING_START when no start node exists', async () => {
    const flow = createMinimalFlow({
      nodes: {
        process1: { id: 'process1', type: 'process', label: 'Process' },
        end: { id: 'end', type: 'end', label: 'End' },
      },
    });

    await expect(compileWorkflow(flow)).rejects.toThrow(CompilationError);
    await expect(compileWorkflow(flow)).rejects.toThrow('has no start node');
  });

  it('should resolve outgoing edges for each node', async () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start', label: 'Start' },
        process: { id: 'process', type: 'process', label: 'Process' },
        end: { id: 'end', type: 'end', label: 'End' },
      },
      edges: {
        e1: { id: 'e1', from: 'start', to: 'process' },
        e2: { id: 'e2', from: 'process', to: 'end' },
      },
    });

    const result = await compileWorkflow(flow);
    const startNode = result.nodes.get('start')!;
    const processNode = result.nodes.get('process')!;

    expect(startNode.outgoingEdges).toHaveLength(1);
    expect(startNode.outgoingEdges[0].to).toBe('process');
    expect(processNode.outgoingEdges).toHaveLength(1);
    expect(processNode.outgoingEdges[0].to).toBe('end');
  });

  it('should resolve task references for llm-task nodes', async () => {
    mockGetTask.mockResolvedValue(mockTask);

    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start', label: 'Start' },
        classify: {
          id: 'classify',
          type: 'llm-task',
          label: 'Classify',
          taskId: 'classify-inquiry',
        },
        end: { id: 'end', type: 'end', label: 'End' },
      },
      edges: {
        e1: { id: 'e1', from: 'start', to: 'classify' },
        e2: { id: 'e2', from: 'classify', to: 'end' },
      },
    });

    const result = await compileWorkflow(flow);
    const classifyNode = result.nodes.get('classify')!;

    expect(classifyNode.task).toBeDefined();
    expect(classifyNode.task!.id).toBe('classify-inquiry');
    expect(classifyNode.gitCommitHash).toBeDefined();
    expect(result.taskSnapshots.has('classify-inquiry')).toBe(true);
  });

  it('should throw MISSING_TASK when task reference cannot be resolved', async () => {
    mockGetTask.mockResolvedValue(null);

    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start', label: 'Start' },
        classify: {
          id: 'classify',
          type: 'llm-task',
          label: 'Classify',
          taskId: 'nonexistent-task',
        },
        end: { id: 'end', type: 'end', label: 'End' },
      },
      edges: {
        e1: { id: 'e1', from: 'start', to: 'classify' },
        e2: { id: 'e2', from: 'classify', to: 'end' },
      },
    });

    await expect(compileWorkflow(flow)).rejects.toThrow(CompilationError);
    await expect(compileWorkflow(flow)).rejects.toThrow('nonexistent-task');
  });

  it('should use custom git hash resolver', async () => {
    const customResolver = vi.fn().mockResolvedValue('abc123def');
    mockGetTask.mockResolvedValue(mockTask);

    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start', label: 'Start' },
        classify: {
          id: 'classify',
          type: 'llm-task',
          label: 'Classify',
          taskId: 'classify-inquiry',
        },
        end: { id: 'end', type: 'end', label: 'End' },
      },
      edges: {
        e1: { id: 'e1', from: 'start', to: 'classify' },
        e2: { id: 'e2', from: 'classify', to: 'end' },
      },
    });

    const result = await compileWorkflow(flow, customResolver);
    const classifyNode = result.nodes.get('classify')!;

    expect(customResolver).toHaveBeenCalledTimes(1);
    expect(classifyNode.gitCommitHash).toBe('abc123def');
  });

  it('should handle decision nodes with conditional edges', async () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start', label: 'Start' },
        decide: { id: 'decide', type: 'decision', label: 'Route' },
        pathA: { id: 'pathA', type: 'process', label: 'Path A' },
        pathB: { id: 'pathB', type: 'process', label: 'Path B' },
        end: { id: 'end', type: 'end', label: 'End' },
      },
      edges: {
        e1: { id: 'e1', from: 'start', to: 'decide' },
        e2: { id: 'e2', from: 'decide', to: 'pathA', condition: "category == 'general'" },
        e3: { id: 'e3', from: 'decide', to: 'pathB', condition: "category == 'technical'" },
        e4: { id: 'e4', from: 'pathA', to: 'end' },
        e5: { id: 'e5', from: 'pathB', to: 'end' },
      },
    });

    const result = await compileWorkflow(flow);
    const decideNode = result.nodes.get('decide')!;

    expect(decideNode.outgoingEdges).toHaveLength(2);
    expect(decideNode.outgoingEdges[0].condition).toBe("category == 'general'");
    expect(decideNode.outgoingEdges[1].condition).toBe("category == 'technical'");
  });

  it('should preserve node role and system attributes', async () => {
    const flow = createMinimalFlow({
      nodes: {
        start: { id: 'start', type: 'start', label: 'Start' },
        process: {
          id: 'process',
          type: 'process',
          label: 'Process',
          role: 'operator',
          system: 'crm',
        },
        end: { id: 'end', type: 'end', label: 'End' },
      },
      edges: {
        e1: { id: 'e1', from: 'start', to: 'process' },
        e2: { id: 'e2', from: 'process', to: 'end' },
      },
    });

    const result = await compileWorkflow(flow);
    const processNode = result.nodes.get('process')!;

    expect(processNode.role).toBe('operator');
    expect(processNode.system).toBe('crm');
  });
});
