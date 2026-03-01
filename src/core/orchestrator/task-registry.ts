/**
 * FlowOps - Task Registry
 *
 * マイクロタスク定義のインメモリレジストリ
 * タスクの検索・キャッシュ管理を提供
 */

import { MicroTaskDefinition } from './schemas/micro-task';
import { loadTask, loadAllTasks, listTasks } from './task-loader';

class TaskRegistry {
  private cache = new Map<string, MicroTaskDefinition>();
  private initialized = false;

  /**
   * レジストリを初期化（全タスクをロード）
   */
  async initialize(): Promise<void> {
    this.cache = await loadAllTasks();
    this.initialized = true;
  }

  /**
   * タスクを取得（キャッシュ優先、なければディスクから読込）
   */
  async getTask(taskId: string): Promise<MicroTaskDefinition | null> {
    if (this.cache.has(taskId)) {
      return this.cache.get(taskId)!;
    }

    try {
      const task = await loadTask(taskId);
      this.cache.set(taskId, task);
      return task;
    } catch {
      return null;
    }
  }

  /**
   * タスクを強制再読込
   */
  async reloadTask(taskId: string): Promise<MicroTaskDefinition | null> {
    this.cache.delete(taskId);
    return this.getTask(taskId);
  }

  /**
   * 全タスクIDを取得
   */
  async listTaskIds(): Promise<string[]> {
    if (!this.initialized) {
      return listTasks();
    }
    return Array.from(this.cache.keys());
  }

  /**
   * 全タスクを取得
   */
  async getAllTasks(): Promise<MicroTaskDefinition[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return Array.from(this.cache.values());
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
    this.initialized = false;
  }
}

// シングルトン
export const taskRegistry = new TaskRegistry();

export { TaskRegistry };
