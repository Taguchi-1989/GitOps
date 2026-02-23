/**
 * FlowOps - Audit Logger Tests
 *
 * 監査ログの記録と照会のテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogger } from './logger';
import type { IAuditLogRepository, AuditLogRecord } from './logger';
import type { AuditLogEntry, AuditQueryOptions } from './types';

// Mock repository implementing IAuditLogRepository
const createMockRepository = (): IAuditLogRepository => ({
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
});

describe('AuditLogger', () => {
  describe('record()', () => {
    it('should return null when repository is not set', async () => {
      // Arrange
      const logger = new AuditLogger();
      const entry: AuditLogEntry = {
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'test-issue-id',
        payload: { title: 'Test Issue' },
      };

      // Act
      const result = await logger.record(entry);

      // Assert
      expect(result).toBeNull();
    });

    it('should call create with correct data when repository is set', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-1',
        actor: 'you',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'test-issue-id',
        payload: { title: 'Test Issue' },
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      const entry: AuditLogEntry = {
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'test-issue-id',
        payload: { title: 'Test Issue' },
      };

      // Act
      const result = await logger.record(entry);

      // Assert
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'test-issue-id',
        payload: { title: 'Test Issue' },
        actor: 'you', // default actor applied
      });
      expect(result).toEqual(expectedRecord);
    });

    it('should use defaultActor when entry.actor is not set', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-2',
        actor: 'you',
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-123',
        payload: {},
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      const entry: AuditLogEntry = {
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-123',
        // actor is not provided
      };

      // Act
      await logger.record(entry);

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-123',
        actor: 'you', // default actor
      });
    });

    it('should use entry.actor when provided', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-3',
        actor: 'custom-user',
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-123',
        payload: {},
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      const entry: AuditLogEntry = {
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-123',
        actor: 'custom-user', // explicit actor
      };

      // Act
      await logger.record(entry);

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-123',
        actor: 'custom-user', // entry.actor is used
      });
    });
  });

  describe('setDefaultActor()', () => {
    it('should change the default actor', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-4',
        actor: 'new-default-actor',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-456',
        payload: {},
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      logger.setDefaultActor('new-default-actor');

      const entry: AuditLogEntry = {
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-456',
      };
      await logger.record(entry);

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-456',
        actor: 'new-default-actor',
      });
    });
  });

  describe('query()', () => {
    it('should return empty array when repository is not set', async () => {
      // Arrange
      const logger = new AuditLogger();

      // Act
      const result = await logger.query({ entityType: 'Issue' });

      // Assert
      expect(result).toEqual([]);
    });

    it('should call findMany with repository', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const mockRecords: AuditLogRecord[] = [
        {
          id: 'audit-log-5',
          actor: 'you',
          action: 'ISSUE_CREATE',
          entityType: 'Issue',
          entityId: 'issue-1',
          payload: {},
          createdAt: new Date(),
        },
        {
          id: 'audit-log-6',
          actor: 'you',
          action: 'ISSUE_UPDATE',
          entityType: 'Issue',
          entityId: 'issue-1',
          payload: {},
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockRepo.findMany).mockResolvedValue(mockRecords);
      logger.setRepository(mockRepo);

      const queryOptions: AuditQueryOptions = {
        entityType: 'Issue',
        entityId: 'issue-1',
        limit: 10,
      };

      // Act
      const result = await logger.query(queryOptions);

      // Assert
      expect(mockRepo.findMany).toHaveBeenCalledTimes(1);
      expect(mockRepo.findMany).toHaveBeenCalledWith(queryOptions);
      expect(result).toEqual(mockRecords);
    });

    it('should call findMany with empty options when no options provided', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const mockRecords: AuditLogRecord[] = [];

      vi.mocked(mockRepo.findMany).mockResolvedValue(mockRecords);
      logger.setRepository(mockRepo);

      // Act
      const result = await logger.query();

      // Assert
      expect(mockRepo.findMany).toHaveBeenCalledTimes(1);
      expect(mockRepo.findMany).toHaveBeenCalledWith({});
      expect(result).toEqual([]);
    });
  });

  describe('count()', () => {
    it('should return 0 when repository is not set', async () => {
      // Arrange
      const logger = new AuditLogger();

      // Act
      const result = await logger.count({ entityType: 'Issue' });

      // Assert
      expect(result).toBe(0);
    });

    it('should call repository.count with repository', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();

      vi.mocked(mockRepo.count).mockResolvedValue(42);
      logger.setRepository(mockRepo);

      const queryOptions: AuditQueryOptions = {
        entityType: 'Proposal',
        action: 'PATCH_APPLY',
      };

      // Act
      const result = await logger.count(queryOptions);

      // Assert
      expect(mockRepo.count).toHaveBeenCalledTimes(1);
      expect(mockRepo.count).toHaveBeenCalledWith(queryOptions);
      expect(result).toBe(42);
    });

    it('should call count with empty options when no options provided', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();

      vi.mocked(mockRepo.count).mockResolvedValue(100);
      logger.setRepository(mockRepo);

      // Act
      const result = await logger.count();

      // Assert
      expect(mockRepo.count).toHaveBeenCalledTimes(1);
      expect(mockRepo.count).toHaveBeenCalledWith({});
      expect(result).toBe(100);
    });
  });

  describe('logIssueAction()', () => {
    it('should send correct entityType for Issue actions', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-7',
        actor: 'you',
        action: 'ISSUE_CREATE',
        entityType: 'Issue',
        entityId: 'issue-789',
        payload: { title: 'New Issue' },
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      await logger.logIssueAction('ISSUE_CREATE', 'issue-789', { title: 'New Issue' });

      // Assert
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'ISSUE_CREATE',
        entityType: 'Issue', // correct entityType
        entityId: 'issue-789',
        payload: { title: 'New Issue' },
        actor: 'you',
      });
    });

    it('should handle ISSUE_UPDATE action', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-8',
        actor: 'you',
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-101',
        payload: { status: 'in-progress' },
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      await logger.logIssueAction('ISSUE_UPDATE', 'issue-101', { status: 'in-progress' });

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'ISSUE_UPDATE',
        entityType: 'Issue',
        entityId: 'issue-101',
        payload: { status: 'in-progress' },
        actor: 'you',
      });
    });
  });

  describe('logProposalAction()', () => {
    it('should send correct entityType for Proposal actions', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-9',
        actor: 'you',
        action: 'PROPOSAL_GENERATE',
        entityType: 'Proposal',
        entityId: 'proposal-456',
        payload: { llmModel: 'gpt-4o' },
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      await logger.logProposalAction('PROPOSAL_GENERATE', 'proposal-456', { llmModel: 'gpt-4o' });

      // Assert
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'PROPOSAL_GENERATE',
        entityType: 'Proposal', // correct entityType
        entityId: 'proposal-456',
        payload: { llmModel: 'gpt-4o' },
        actor: 'you',
      });
    });

    it('should handle PATCH_APPLY action', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-10',
        actor: 'you',
        action: 'PATCH_APPLY',
        entityType: 'Proposal',
        entityId: 'proposal-789',
        payload: { patchCount: 3 },
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      await logger.logProposalAction('PATCH_APPLY', 'proposal-789', { patchCount: 3 });

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'PATCH_APPLY',
        entityType: 'Proposal',
        entityId: 'proposal-789',
        payload: { patchCount: 3 },
        actor: 'you',
      });
    });
  });

  describe('logGitAction()', () => {
    it('should send entityType "System" for GIT_COMMIT action', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-11',
        actor: 'you',
        action: 'GIT_COMMIT',
        entityType: 'System',
        entityId: 'commit-abc123',
        payload: { message: 'feat: add new feature' },
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      await logger.logGitAction('GIT_COMMIT', 'commit-abc123', {
        message: 'feat: add new feature',
      });

      // Assert
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'GIT_COMMIT',
        entityType: 'System', // GIT_ prefix -> System
        entityId: 'commit-abc123',
        payload: { message: 'feat: add new feature' },
        actor: 'you',
      });
    });

    it('should send entityType "System" for GIT_BRANCH_CREATE action', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-12',
        actor: 'you',
        action: 'GIT_BRANCH_CREATE',
        entityType: 'System',
        entityId: 'branch-feature-x',
        payload: {},
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      await logger.logGitAction('GIT_BRANCH_CREATE', 'branch-feature-x');

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'GIT_BRANCH_CREATE',
        entityType: 'System', // GIT_ prefix -> System
        entityId: 'branch-feature-x',
        actor: 'you',
      });
    });

    it('should send entityType "System" for GIT_BRANCH_DELETE action', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-13',
        actor: 'you',
        action: 'GIT_BRANCH_DELETE',
        entityType: 'System',
        entityId: 'branch-old-feature',
        payload: {},
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      await logger.logGitAction('GIT_BRANCH_DELETE', 'branch-old-feature');

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'GIT_BRANCH_DELETE',
        entityType: 'System', // GIT_ prefix -> System
        entityId: 'branch-old-feature',
        actor: 'you',
      });
    });

    it('should send entityType "Issue" for MERGE_CLOSE action', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-14',
        actor: 'you',
        action: 'MERGE_CLOSE',
        entityType: 'Issue',
        entityId: 'issue-123',
        payload: {},
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      await logger.logGitAction('MERGE_CLOSE', 'issue-123');

      // Assert
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'MERGE_CLOSE',
        entityType: 'Issue', // no GIT_ prefix -> Issue
        entityId: 'issue-123',
        actor: 'you',
      });
    });

    it('should send entityType "Issue" for DUPLICATE_MERGE action', async () => {
      // Arrange
      const logger = new AuditLogger();
      const mockRepo = createMockRepository();
      const expectedRecord: AuditLogRecord = {
        id: 'audit-log-15',
        actor: 'you',
        action: 'DUPLICATE_MERGE',
        entityType: 'Issue',
        entityId: 'issue-456',
        payload: { canonicalId: 'issue-123' },
        createdAt: new Date(),
      };

      vi.mocked(mockRepo.create).mockResolvedValue(expectedRecord);
      logger.setRepository(mockRepo);

      // Act
      await logger.logGitAction('DUPLICATE_MERGE', 'issue-456', { canonicalId: 'issue-123' });

      // Assert
      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'DUPLICATE_MERGE',
        entityType: 'Issue', // no GIT_ prefix -> Issue
        entityId: 'issue-456',
        payload: { canonicalId: 'issue-123' },
        actor: 'you',
      });
    });
  });
});
