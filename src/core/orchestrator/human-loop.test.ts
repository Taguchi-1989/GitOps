/**
 * FlowOps - Human-in-the-Loop Manager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanLoopManager, HumanLoopError } from './human-loop';
import type { IApprovalRepository, ApprovalRequestRecord } from './human-loop';
import { auditLog } from '../audit/logger';

vi.mock('../audit/logger', () => ({
  auditLog: {
    logWorkflowAction: vi.fn(),
  },
}));

function createMockRepository(): IApprovalRepository {
  return {
    getApprovalRequest: vi.fn(),
    getPendingRequests: vi.fn(),
    updateApprovalRequest: vi.fn(),
  };
}

function createMockRequest(overrides?: Partial<ApprovalRequestRecord>): ApprovalRequestRecord {
  return {
    id: 'ar-1',
    workflowId: 'wfe-1',
    nodeId: 'review-node',
    description: 'Review this',
    context: {},
    status: 'pending',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('HumanLoopManager', () => {
  let manager: HumanLoopManager;
  let repo: IApprovalRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new HumanLoopManager();
    repo = createMockRepository();
    manager.setRepository(repo);
  });

  describe('getPendingRequests', () => {
    it('should return empty array when no repository', async () => {
      const managerNoRepo = new HumanLoopManager();
      const result = await managerNoRepo.getPendingRequests();
      expect(result).toEqual([]);
    });

    it('should delegate to repository', async () => {
      const pending = [createMockRequest()];
      vi.mocked(repo.getPendingRequests).mockResolvedValue(pending);

      const result = await manager.getPendingRequests('wfe-1');

      expect(repo.getPendingRequests).toHaveBeenCalledWith('wfe-1');
      expect(result).toEqual(pending);
    });
  });

  describe('submitDecision', () => {
    it('should approve a pending request', async () => {
      const request = createMockRequest();
      const updatedRequest = {
        ...request,
        status: 'approved',
        decision: 'approved',
        reason: 'Looks good',
      };

      vi.mocked(repo.getApprovalRequest).mockResolvedValue(request);
      vi.mocked(repo.updateApprovalRequest).mockResolvedValue(updatedRequest);

      const result = await manager.submitDecision(
        'ar-1',
        { approved: true, reason: 'Looks good', decidedBy: 'admin' },
        'trace-1'
      );

      expect(result.status).toBe('approved');
      expect(auditLog.logWorkflowAction).toHaveBeenCalledWith(
        'HUMAN_APPROVE',
        'wfe-1',
        'trace-1',
        expect.objectContaining({
          decision: 'approved',
          reason: 'Looks good',
          decidedBy: 'admin',
        })
      );
    });

    it('should reject a pending request', async () => {
      const request = createMockRequest();
      const updatedRequest = {
        ...request,
        status: 'rejected',
        decision: 'rejected',
        reason: 'Not ready',
      };

      vi.mocked(repo.getApprovalRequest).mockResolvedValue(request);
      vi.mocked(repo.updateApprovalRequest).mockResolvedValue(updatedRequest);

      const result = await manager.submitDecision(
        'ar-1',
        { approved: false, reason: 'Not ready', decidedBy: 'admin' },
        'trace-2'
      );

      expect(result.status).toBe('rejected');
      expect(auditLog.logWorkflowAction).toHaveBeenCalledWith(
        'HUMAN_REJECT',
        'wfe-1',
        'trace-2',
        expect.objectContaining({
          decision: 'rejected',
          reason: 'Not ready',
        })
      );
    });

    it('should throw NOT_FOUND when repository is not set', async () => {
      const managerNoRepo = new HumanLoopManager();

      await expect(
        managerNoRepo.submitDecision(
          'ar-1',
          { approved: true, reason: 'test', decidedBy: 'admin' },
          'trace-3'
        )
      ).rejects.toThrow(HumanLoopError);
    });

    it('should throw NOT_FOUND when request does not exist', async () => {
      vi.mocked(repo.getApprovalRequest).mockResolvedValue(null);

      await expect(
        manager.submitDecision(
          'ar-999',
          { approved: true, reason: 'test', decidedBy: 'admin' },
          'trace-4'
        )
      ).rejects.toThrow(HumanLoopError);

      try {
        await manager.submitDecision(
          'ar-999',
          { approved: true, reason: 'test', decidedBy: 'admin' },
          'trace-4'
        );
      } catch (e) {
        expect((e as HumanLoopError).code).toBe('NOT_FOUND');
      }
    });

    it('should throw ALREADY_DECIDED when request is not pending', async () => {
      const request = createMockRequest({ status: 'approved' });
      vi.mocked(repo.getApprovalRequest).mockResolvedValue(request);

      await expect(
        manager.submitDecision(
          'ar-1',
          { approved: true, reason: 'test', decidedBy: 'admin' },
          'trace-5'
        )
      ).rejects.toThrow(HumanLoopError);

      try {
        await manager.submitDecision(
          'ar-1',
          { approved: true, reason: 'test', decidedBy: 'admin' },
          'trace-5'
        );
      } catch (e) {
        expect((e as HumanLoopError).code).toBe('ALREADY_DECIDED');
      }
    });
  });
});
