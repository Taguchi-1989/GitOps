/**
 * FlowOps - Validation Rule Registry
 *
 * バリデーションルール定義のインメモリレジストリ（task-registry.ts と同方針）
 * appliesTo.taskId による検索を提供し、Acceptance Gate が利用する。
 */

import { RuleDefinition } from './schemas/validation-rule';
import { loadRule, loadAllRules, listRules } from './rule-loader';

class RuleRegistry {
  private cache = new Map<string, RuleDefinition>();
  private initialized = false;

  /**
   * レジストリを初期化（全ルールをロード）
   */
  async initialize(): Promise<void> {
    this.cache = await loadAllRules();
    this.initialized = true;
  }

  /**
   * ルールを取得（キャッシュ優先、なければディスクから読込）
   */
  async getRule(ruleId: string): Promise<RuleDefinition | null> {
    if (this.cache.has(ruleId)) {
      return this.cache.get(ruleId)!;
    }

    try {
      const rule = await loadRule(ruleId);
      this.cache.set(ruleId, rule);
      return rule;
    } catch {
      return null;
    }
  }

  /**
   * 指定IDのルール群を取得（順序維持、見つからないIDはスキップ）
   */
  async getRulesByIds(ruleIds: string[]): Promise<RuleDefinition[]> {
    const rules: RuleDefinition[] = [];
    for (const id of ruleIds) {
      const rule = await this.getRule(id);
      if (rule) rules.push(rule);
    }
    return rules;
  }

  /**
   * あるタスクに適用されるルール群を取得（appliesTo.taskId で絞り込み）
   */
  async getRulesForTask(taskId: string): Promise<RuleDefinition[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return Array.from(this.cache.values()).filter(r => r.appliesTo.taskId === taskId);
  }

  /**
   * 全ルールIDを取得
   */
  async listRuleIds(): Promise<string[]> {
    if (!this.initialized) {
      return listRules();
    }
    return Array.from(this.cache.keys());
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
export const ruleRegistry = new RuleRegistry();

export { RuleRegistry };
