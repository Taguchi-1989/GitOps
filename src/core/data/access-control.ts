/**
 * FlowOps - Access Control Service
 *
 * GPTsiteki Section 8.5 属性ベースアクセス制御 (ABAC)
 * sensitivity-levels.yaml + access-policies.yaml を参照してアクセス判定を行う
 */

import type { SensitivityLevel } from '@/core/parser/schema';
import type { DataObject } from './schemas';
import type { SensitivityLevelConfig, AccessPolicyConfig } from './policy-loader';
import { auditLog } from '@/core/audit/logger';

// --------------------------------------------------------
// Types
// --------------------------------------------------------
export type AccessAction = 'read' | 'write' | 'export' | 'ai-usage' | 'abstraction-bypass';

export interface AccessActor {
  id: string;
  roles: string[];
  department?: string;
  clearanceLevel: SensitivityLevel;
  qualifications?: string[];
}

export interface AccessCheckResult {
  allowed: boolean;
  reason: string;
  requiresAbstraction: boolean;
  auditLevel: string;
}

// --------------------------------------------------------
// Sensitivity level numeric comparison
// --------------------------------------------------------
const LEVEL_ORDER: Record<string, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5,
};

function levelToNumber(level: string): number {
  return LEVEL_ORDER[level] ?? 0;
}

// --------------------------------------------------------
// AccessControlService
// --------------------------------------------------------
class AccessControlService {
  private sensitivityLevels: Map<string, SensitivityLevelConfig> = new Map();
  private accessPolicies: Map<string, AccessPolicyConfig> = new Map();

  /**
   * YAML辞書からロードした設定を注入
   */
  setConfig(
    levels: Record<string, SensitivityLevelConfig>,
    policies: Record<string, AccessPolicyConfig>
  ): void {
    this.sensitivityLevels = new Map(Object.entries(levels));
    this.accessPolicies = new Map(Object.entries(policies));
  }

  /**
   * アクセスチェック (コアロジック)
   *
   * 判定フロー:
   * 1. クリアランスレベル vs データ機密レベル
   * 2. アクション別チェック (ai-usage, export 等)
   * 3. アクセスポリシー参照があればポリシー解決
   * 4. 抽象化要否の判定
   */
  async checkAccess(
    actor: AccessActor,
    dataObject: DataObject,
    action: AccessAction
  ): Promise<AccessCheckResult> {
    const dataLevel = dataObject.sensitivityLevel || 'L1';
    const levelConfig = this.sensitivityLevels.get(dataLevel);
    const auditLevel = levelConfig?.auditLevel || 'standard';

    // 1. クリアランスレベルチェック
    if (levelToNumber(actor.clearanceLevel) < levelToNumber(dataLevel)) {
      await this.logAccess(actor, dataObject, action, false, 'clearance_insufficient');
      return {
        allowed: false,
        reason: `Actor clearance ${actor.clearanceLevel} is below data sensitivity ${dataLevel}`,
        requiresAbstraction: false,
        auditLevel,
      };
    }

    // 2. アクション別チェック
    if (action === 'ai-usage' && levelConfig && !levelConfig.aiUsageAllowed) {
      await this.logAccess(actor, dataObject, action, false, 'ai_usage_prohibited');
      return {
        allowed: false,
        reason: `AI usage is not allowed for sensitivity level ${dataLevel}`,
        requiresAbstraction: false,
        auditLevel,
      };
    }

    if (action === 'export' && levelConfig && !levelConfig.exportAllowed) {
      await this.logAccess(actor, dataObject, action, false, 'export_prohibited');
      return {
        allowed: false,
        reason: `Export is not allowed for sensitivity level ${dataLevel}`,
        requiresAbstraction: false,
        auditLevel,
      };
    }

    // 3. アクセスポリシー参照によるチェック
    if (dataObject.accessPolicyRef) {
      const policy = this.accessPolicies.get(dataObject.accessPolicyRef);
      if (policy) {
        if (action === 'ai-usage' && !policy.aiUsageAllowed) {
          await this.logAccess(actor, dataObject, action, false, 'policy_ai_denied');
          return {
            allowed: false,
            reason: `Policy ${policy.id} prohibits AI usage`,
            requiresAbstraction: false,
            auditLevel: policy.auditLevel,
          };
        }

        if (action === 'export') {
          if (policy.exportPolicy === 'prohibited') {
            await this.logAccess(actor, dataObject, action, false, 'policy_export_denied');
            return {
              allowed: false,
              reason: `Policy ${policy.id} prohibits export`,
              requiresAbstraction: false,
              auditLevel: policy.auditLevel,
            };
          }
        }
      }
    }

    // 4. 抽象化要否の判定
    const requiresAbstraction = levelConfig?.abstractionRequired || false;

    await this.logAccess(actor, dataObject, action, true, 'allowed');
    return {
      allowed: true,
      reason: 'Access granted',
      requiresAbstraction,
      auditLevel,
    };
  }

  /**
   * ポリシーIDからポリシー定義を取得
   */
  getPolicy(policyId: string): AccessPolicyConfig | undefined {
    return this.accessPolicies.get(policyId);
  }

  /**
   * 機密レベル定義を取得
   */
  getSensitivityLevel(level: string): SensitivityLevelConfig | undefined {
    return this.sensitivityLevels.get(level);
  }

  private async logAccess(
    actor: AccessActor,
    dataObject: DataObject,
    action: AccessAction,
    allowed: boolean,
    reason: string
  ): Promise<void> {
    try {
      await auditLog.logDataAction('DATA_ACCESS', dataObject.objectId, {
        actorId: actor.id,
        action,
        allowed,
        reason,
        sensitivityLevel: dataObject.sensitivityLevel,
        clearanceLevel: actor.clearanceLevel,
      });
    } catch {
      // 監査ログの失敗でアクセスチェック自体は止めない
    }
  }
}

// シングルトンインスタンス
export const accessControlService = new AccessControlService();

// クラスもエクスポート（テスト用）
export { AccessControlService };
