/**
 * FlowOps - Micro Task Schema Tests
 */

import { describe, it, expect } from 'vitest';
import { MicroTaskDefinitionSchema, TaskInvocationSchema, TaskResultSchema } from './micro-task';
import { ApprovalDecisionSchema } from './execution';

describe('MicroTaskDefinitionSchema', () => {
  const validTask = {
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
    metadata: {
      author: 'test-team',
      description: 'Classify inquiries',
    },
  };

  it('should accept a valid task definition', () => {
    const result = MicroTaskDefinitionSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it('should reject invalid version format', () => {
    const result = MicroTaskDefinitionSchema.safeParse({
      ...validTask,
      version: 'v1',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid task type', () => {
    const result = MicroTaskDefinitionSchema.safeParse({
      ...validTask,
      type: 'invalid-type',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty id', () => {
    const result = MicroTaskDefinitionSchema.safeParse({
      ...validTask,
      id: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject maxRetries > 5', () => {
    const result = MicroTaskDefinitionSchema.safeParse({
      ...validTask,
      maxRetries: 10,
    });
    expect(result.success).toBe(false);
  });

  it('should apply default values', () => {
    const minimal = {
      id: 'test',
      version: '1.0.0',
      type: 'llm-inference',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      metadata: { author: 'test', description: 'test' },
    };
    const result = MicroTaskDefinitionSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requiresHumanApproval).toBe(false);
      expect(result.data.maxRetries).toBe(2);
      expect(result.data.timeoutMs).toBe(30000);
    }
  });

  it('should accept all valid task types', () => {
    const types = ['llm-inference', 'data-transform', 'human-review', 'api-call', 'conditional'];
    for (const type of types) {
      const result = MicroTaskDefinitionSchema.safeParse({ ...validTask, type });
      expect(result.success).toBe(true);
    }
  });
});

describe('TaskInvocationSchema', () => {
  const validInvocation = {
    traceId: '550e8400-e29b-41d4-a716-446655440000',
    executionId: 'wfe-123',
    nodeId: 'node-1',
    taskId: 'classify-inquiry',
    taskVersion: '1.0.0',
    gitCommitHash: 'abc123',
    input: { text: 'Hello' },
    context: {
      flowId: 'test-flow',
      currentNodeLabel: 'Classify',
      previousNodes: [],
      roles: ['operator'],
      systems: ['crm'],
    },
  };

  it('should accept a valid invocation', () => {
    const result = TaskInvocationSchema.safeParse(validInvocation);
    expect(result.success).toBe(true);
  });

  it('should reject non-UUID traceId', () => {
    const result = TaskInvocationSchema.safeParse({
      ...validInvocation,
      traceId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing context fields', () => {
    const result = TaskInvocationSchema.safeParse({
      ...validInvocation,
      context: { flowId: 'test' },
    });
    expect(result.success).toBe(false);
  });
});

describe('TaskResultSchema', () => {
  const validResult = {
    traceId: '550e8400-e29b-41d4-a716-446655440000',
    executionId: 'wfe-123',
    taskId: 'classify-inquiry',
    status: 'success',
    output: { category: 'general' },
    metadata: {
      durationMs: 500,
      llmModelUsed: 'gpt-4o',
      llmTokensUsed: { input: 100, output: 50 },
    },
  };

  it('should accept a valid result', () => {
    const result = TaskResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
  });

  it('should accept result with error', () => {
    const result = TaskResultSchema.safeParse({
      ...validResult,
      status: 'failure',
      error: { code: 'LLM_ERROR', message: 'Timeout' },
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = TaskResultSchema.safeParse({
      ...validResult,
      status: 'unknown',
    });
    expect(result.success).toBe(false);
  });
});

describe('ApprovalDecisionSchema', () => {
  it('should accept valid approval', () => {
    const result = ApprovalDecisionSchema.safeParse({
      approved: true,
      reason: 'Content looks correct',
      decidedBy: 'admin',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty reason (ISO 42001 requirement)', () => {
    const result = ApprovalDecisionSchema.safeParse({
      approved: true,
      reason: '',
      decidedBy: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing decidedBy', () => {
    const result = ApprovalDecisionSchema.safeParse({
      approved: false,
      reason: 'Needs changes',
    });
    expect(result.success).toBe(false);
  });
});
