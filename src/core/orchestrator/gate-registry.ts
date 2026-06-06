/**
 * FlowOps - Acceptance Gate Registry
 *
 * ゲート定義のインメモリレジストリ（task-registry.ts と同方針）
 * appliesTo.taskId による検索を提供し、engine が利用する。
 *
 * 制約: 1タスクにつき高々1ゲート（MVP）。複数該当時は最初の1件を返す。
 */

import { GateDefinition } from './schemas/gate';
import { loadGate, loadAllGates, listGates } from './gate-loader';

class GateRegistry {
  private cache = new Map<string, GateDefinition>();
  private initialized = false;

  async initialize(): Promise<void> {
    this.cache = await loadAllGates();
    this.initialized = true;
  }

  async getGate(gateId: string): Promise<GateDefinition | null> {
    if (this.cache.has(gateId)) {
      return this.cache.get(gateId)!;
    }

    try {
      const gate = await loadGate(gateId);
      this.cache.set(gateId, gate);
      return gate;
    } catch {
      return null;
    }
  }

  /**
   * あるタスク出力後に発火するゲートを取得（appliesTo.taskId 一致の先頭1件）
   */
  async getGateForTask(taskId: string): Promise<GateDefinition | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    return Array.from(this.cache.values()).find(g => g.appliesTo.taskId === taskId) ?? null;
  }

  async listGateIds(): Promise<string[]> {
    if (!this.initialized) {
      return listGates();
    }
    return Array.from(this.cache.keys());
  }

  clear(): void {
    this.cache.clear();
    this.initialized = false;
  }
}

// シングルトン
export const gateRegistry = new GateRegistry();

export { GateRegistry };
