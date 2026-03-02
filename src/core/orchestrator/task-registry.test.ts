/**
 * FlowOps - Task Registry Tests
 *
 * マイクロタスクレジストリのキャッシュ・検索・初期化テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./task-loader', () => ({
  loadTask: vi.fn(),
  loadAllTasks: vi.fn(),
  listTasks: vi.fn(),
}));

import { TaskRegistry } from './task-registry';
import { loadTask, loadAllTasks, listTasks } from './task-loader';

function makeTask(id: string) {
  return {
    id,
    version: '1.0.0',
    type: 'llm-inference' as const,
    inputSchema: { type: 'object' as const },
    outputSchema: { type: 'object' as const },
    requiresHumanApproval: false,
    maxRetries: 2,
    timeoutMs: 30000,
    metadata: { author: 'test', description: 'test' },
  };
}

describe('TaskRegistry', () => {
  let registry: TaskRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new TaskRegistry();
  });

  describe('getTask', () => {
    it('should return cached task if available', async () => {
      const taskA = makeTask('task-a');
      const taskMap = new Map([['task-a', taskA]]);
      vi.mocked(loadAllTasks).mockResolvedValue(taskMap);

      await registry.initialize();

      const result = await registry.getTask('task-a');

      expect(result).toEqual(taskA);
      expect(loadTask).not.toHaveBeenCalled();
    });

    it('should load from disk when not cached', async () => {
      const taskB = makeTask('task-b');
      vi.mocked(loadTask).mockResolvedValue(taskB);

      const result = await registry.getTask('task-b');

      expect(loadTask).toHaveBeenCalledWith('task-b');
      expect(result).toEqual(taskB);
    });

    it('should cache loaded task for subsequent calls', async () => {
      const taskC = makeTask('task-c');
      vi.mocked(loadTask).mockResolvedValue(taskC);

      await registry.getTask('task-c');
      await registry.getTask('task-c');

      expect(loadTask).toHaveBeenCalledTimes(1);
    });

    it('should return null when loadTask throws', async () => {
      vi.mocked(loadTask).mockRejectedValue(new Error('FILE_NOT_FOUND'));

      const result = await registry.getTask('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('reloadTask', () => {
    it('should remove from cache and reload', async () => {
      const taskD = makeTask('task-d');
      const taskDv2 = makeTask('task-d');
      taskDv2.version = '2.0.0';

      vi.mocked(loadTask).mockResolvedValueOnce(taskD).mockResolvedValueOnce(taskDv2);

      // Load initially
      await registry.getTask('task-d');
      expect(loadTask).toHaveBeenCalledTimes(1);

      // Reload forces a fresh load
      const result = await registry.reloadTask('task-d');

      expect(loadTask).toHaveBeenCalledTimes(2);
      expect(result).toEqual(taskDv2);
    });

    it('should return null when reload fails', async () => {
      const taskE = makeTask('task-e');
      vi.mocked(loadTask)
        .mockResolvedValueOnce(taskE)
        .mockRejectedValueOnce(new Error('FILE_NOT_FOUND'));

      await registry.getTask('task-e');

      const result = await registry.reloadTask('task-e');

      expect(result).toBeNull();
    });
  });

  describe('listTaskIds', () => {
    it('should call listTasks when not initialized', async () => {
      vi.mocked(listTasks).mockResolvedValue(['task-x', 'task-y']);

      const result = await registry.listTaskIds();

      expect(listTasks).toHaveBeenCalledTimes(1);
      expect(result).toEqual(['task-x', 'task-y']);
    });

    it('should return cache keys when initialized', async () => {
      const taskMap = new Map([
        ['task-a', makeTask('task-a')],
        ['task-b', makeTask('task-b')],
      ]);
      vi.mocked(loadAllTasks).mockResolvedValue(taskMap);

      await registry.initialize();

      const result = await registry.listTaskIds();

      expect(listTasks).not.toHaveBeenCalled();
      expect(result).toEqual(['task-a', 'task-b']);
    });
  });

  describe('getAllTasks', () => {
    it('should initialize on first call', async () => {
      const taskMap = new Map([['task-a', makeTask('task-a')]]);
      vi.mocked(loadAllTasks).mockResolvedValue(taskMap);

      const result = await registry.getAllTasks();

      expect(loadAllTasks).toHaveBeenCalledTimes(1);
      expect(result).toEqual([makeTask('task-a')]);
    });

    it('should return all tasks from cache', async () => {
      const taskA = makeTask('task-a');
      const taskB = makeTask('task-b');
      const taskMap = new Map([
        ['task-a', taskA],
        ['task-b', taskB],
      ]);
      vi.mocked(loadAllTasks).mockResolvedValue(taskMap);

      await registry.initialize();

      const result = await registry.getAllTasks();

      // loadAllTasks called once during initialize, not again
      expect(loadAllTasks).toHaveBeenCalledTimes(1);
      expect(result).toEqual([taskA, taskB]);
    });
  });

  describe('initialize', () => {
    it('should load all tasks and set initialized flag', async () => {
      const taskMap = new Map([
        ['task-a', makeTask('task-a')],
        ['task-b', makeTask('task-b')],
      ]);
      vi.mocked(loadAllTasks).mockResolvedValue(taskMap);

      await registry.initialize();

      expect(loadAllTasks).toHaveBeenCalledTimes(1);

      // After initialization, listTaskIds should use cache, not listTasks
      const ids = await registry.listTaskIds();
      expect(listTasks).not.toHaveBeenCalled();
      expect(ids).toEqual(['task-a', 'task-b']);
    });
  });

  describe('clear', () => {
    it('should clear cache so subsequent getTask calls loadTask again', async () => {
      const taskA = makeTask('task-a');
      const taskMap = new Map([['task-a', taskA]]);
      vi.mocked(loadAllTasks).mockResolvedValue(taskMap);
      vi.mocked(loadTask).mockResolvedValue(taskA);

      await registry.initialize();

      // Task is cached, loadTask not called
      await registry.getTask('task-a');
      expect(loadTask).not.toHaveBeenCalled();

      // Clear the cache
      registry.clear();

      // Now getTask should call loadTask
      await registry.getTask('task-a');
      expect(loadTask).toHaveBeenCalledWith('task-a');
    });
  });
});
