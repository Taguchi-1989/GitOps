/**
 * FlowOps - Workflow Repository Tests
 *
 * PrismaベースのWorkflowExecution / ApprovalRequest 永続化のテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./prisma', () => ({
  prisma: {
    workflowExecution: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    taskExecution: {
      create: vi.fn(),
    },
    approvalRequest: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { workflowRepository, approvalRepository } from './workflow-repository';
import { prisma } from './prisma';
import type { WorkflowState } from '@/core/orchestrator';

const baseState: WorkflowState = {
  executionId: 'wfe-1',
  flowId: 'risk-assessment-detail',
  traceId: 'trace-1',
  status: 'running',
  currentNodeId: 'start_node',
  stateData: { foo: 'bar' },
  initiatorId: 'user-1',
};

describe('workflowRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createExecution', () => {
    it('should create execution with id=executionId and stringified stateData', async () => {
      vi.mocked(prisma.workflowExecution.create).mockResolvedValue({} as never);

      await workflowRepository.createExecution(baseState);

      expect(prisma.workflowExecution.create).toHaveBeenCalledWith({
        data: {
          id: 'wfe-1',
          flowId: 'risk-assessment-detail',
          traceId: 'trace-1',
          status: 'running',
          currentNodeId: 'start_node',
          stateData: '{"foo":"bar"}',
          initiatorId: 'user-1',
        },
      });
    });
  });

  describe('updateExecution', () => {
    it('should set completedAt when status is completed', async () => {
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      await workflowRepository.updateExecution('wfe-1', { status: 'completed' });

      const call = vi.mocked(prisma.workflowExecution.update).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'wfe-1' });
      expect(call.data.status).toBe('completed');
      expect(call.data.completedAt).toBeInstanceOf(Date);
    });

    it('should stringify stateData on update', async () => {
      vi.mocked(prisma.workflowExecution.update).mockResolvedValue({} as never);

      await workflowRepository.updateExecution('wfe-1', { stateData: { a: 1 } });

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
        where: { id: 'wfe-1' },
        data: { stateData: '{"a":1}' },
      });
    });

    it('should be a no-op when there are no updates', async () => {
      await workflowRepository.updateExecution('wfe-1', {});
      expect(prisma.workflowExecution.update).not.toHaveBeenCalled();
    });
  });

  describe('getExecution', () => {
    it('should return null when not found', async () => {
      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue(null);
      const result = await workflowRepository.getExecution('missing');
      expect(result).toBeNull();
    });

    it('should map record and parse stateData', async () => {
      vi.mocked(prisma.workflowExecution.findUnique).mockResolvedValue({
        id: 'wfe-1',
        flowId: 'f',
        traceId: 't',
        status: 'paused-human-review',
        currentNodeId: 'n1',
        stateData: '{"k":"v"}',
        initiatorId: 'u',
      } as never);

      const result = await workflowRepository.getExecution('wfe-1');

      expect(result).toEqual({
        executionId: 'wfe-1',
        flowId: 'f',
        traceId: 't',
        status: 'paused-human-review',
        currentNodeId: 'n1',
        stateData: { k: 'v' },
        initiatorId: 'u',
      });
    });
  });

  describe('createTaskExecution', () => {
    it('should stringify input/output, set completedAt for terminal status and return id', async () => {
      vi.mocked(prisma.taskExecution.create).mockResolvedValue({ id: 'te-1' } as never);

      const id = await workflowRepository.createTaskExecution({
        workflowId: 'wfe-1',
        nodeId: 'n1',
        taskId: 'hazard-identification',
        taskVersion: '1.0.0',
        gitCommitHash: 'abc',
        status: 'success',
        input: { in: 1 },
        output: { out: 2 },
        traceId: 'trace-1',
      });

      expect(id).toBe('te-1');
      const call = vi.mocked(prisma.taskExecution.create).mock.calls[0][0];
      expect(call.data.input).toBe('{"in":1}');
      expect(call.data.output).toBe('{"out":2}');
      expect(call.data.completedAt).toBeInstanceOf(Date);
    });

    it('should store null output and null completedAt for non-terminal status', async () => {
      vi.mocked(prisma.taskExecution.create).mockResolvedValue({ id: 'te-2' } as never);

      await workflowRepository.createTaskExecution({
        workflowId: 'wfe-1',
        nodeId: 'n1',
        taskId: 't',
        taskVersion: '1.0.0',
        gitCommitHash: 'abc',
        status: 'needs-human-review',
        input: {},
        traceId: 'trace-1',
      });

      const call = vi.mocked(prisma.taskExecution.create).mock.calls[0][0];
      expect(call.data.output).toBeNull();
      expect(call.data.completedAt).toBeNull();
    });
  });

  describe('createApprovalRequest', () => {
    it('should stringify context and return id', async () => {
      vi.mocked(prisma.approvalRequest.create).mockResolvedValue({ id: 'ar-1' } as never);

      const id = await workflowRepository.createApprovalRequest({
        workflowId: 'wfe-1',
        nodeId: 'review_hazards',
        description: '確認してください',
        context: { gate: 'go' },
      });

      expect(id).toBe('ar-1');
      expect(prisma.approvalRequest.create).toHaveBeenCalledWith({
        data: {
          workflowId: 'wfe-1',
          nodeId: 'review_hazards',
          description: '確認してください',
          context: '{"gate":"go"}',
        },
      });
    });
  });
});

describe('approvalRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseRow = {
    id: 'ar-1',
    workflowId: 'wfe-1',
    nodeId: 'review_hazards',
    description: 'desc',
    context: '{"k":"v"}',
    status: 'pending',
    decision: null,
    reason: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date('2026-01-01'),
  };

  describe('getApprovalRequest', () => {
    it('should return null when not found', async () => {
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(null);
      const result = await approvalRepository.getApprovalRequest('missing');
      expect(result).toBeNull();
    });

    it('should map nullable fields to undefined and parse context', async () => {
      vi.mocked(prisma.approvalRequest.findUnique).mockResolvedValue(baseRow as never);

      const result = await approvalRepository.getApprovalRequest('ar-1');

      expect(result).toEqual({
        id: 'ar-1',
        workflowId: 'wfe-1',
        nodeId: 'review_hazards',
        description: 'desc',
        context: { k: 'v' },
        status: 'pending',
        decision: undefined,
        reason: undefined,
        decidedBy: undefined,
        decidedAt: undefined,
        createdAt: new Date('2026-01-01'),
      });
    });
  });

  describe('getPendingRequests', () => {
    it('should filter by status pending only', async () => {
      vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue([baseRow] as never);

      await approvalRepository.getPendingRequests();

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should include workflowId filter when provided', async () => {
      vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue([]);

      await approvalRepository.getPendingRequests('wfe-9');

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith({
        where: { status: 'pending', workflowId: 'wfe-9' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('updateApprovalRequest', () => {
    it('should record approval decision with reason and decidedBy', async () => {
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({
        ...baseRow,
        status: 'approved',
        decision: 'approved',
        reason: 'ok',
        decidedBy: 'user-1',
        decidedAt: new Date('2026-01-02'),
      } as never);

      const result = await approvalRepository.updateApprovalRequest('ar-1', {
        approved: true,
        reason: 'ok',
        decidedBy: 'user-1',
      });

      const call = vi.mocked(prisma.approvalRequest.update).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'ar-1' });
      expect(call.data.status).toBe('approved');
      expect(call.data.decision).toBe('approved');
      expect(call.data.reason).toBe('ok');
      expect(call.data.decidedBy).toBe('user-1');
      expect(call.data.decidedAt).toBeInstanceOf(Date);
      expect(result.status).toBe('approved');
      expect(result.reason).toBe('ok');
    });

    it('should record rejection as rejected status', async () => {
      vi.mocked(prisma.approvalRequest.update).mockResolvedValue({
        ...baseRow,
        status: 'rejected',
        decision: 'rejected',
        reason: 'no',
        decidedBy: 'user-1',
        decidedAt: new Date('2026-01-02'),
      } as never);

      await approvalRepository.updateApprovalRequest('ar-1', {
        approved: false,
        reason: 'no',
        decidedBy: 'user-1',
      });

      const call = vi.mocked(prisma.approvalRequest.update).mock.calls[0][0];
      expect(call.data.status).toBe('rejected');
      expect(call.data.decision).toBe('rejected');
    });
  });
});
