/**
 * FlowOps - Precedent Auto-Approval (ガバナンス・ハーネス §5.1.1 / §5.3 Phase 2)
 *
 * 「過去に同型ケースが承認済み かつ ポリシー版が不変」なら前例に従い自動承認する。
 * 人が判断するのは前例のない新規パターンのみ（§5.1.1）。
 *
 * 安全性（最重要・多重 fail-safe）:
 *  - 既定で無効（Phase 0）。有効化はフェーズ昇格 = 人間ゲート（config 変更=PR / POL-4）。
 *  - 許可リスク等級のみ（Phase 1 は low）。それ以外は人へ。
 *  - ポリシー版が不明、または前例の版と不一致 → 人へ（「今のポリシーで過去を裁かない」）。
 *  - 前例が不足、または却下前例が混在 → 人へ（合意の取れていない前例で通さない）。
 *  - いかなる不確実も人へ倒す。自動承認はポリシーを書き換えない（POL-4）。
 *  - §5.2: 自動承認の一部を事後サンプル監査へ回す（ゴム印化防止）。
 */

import { auditLog, hashPolicy } from '../audit';
import { Precedent, RiskGrade } from './types';
import { findPrecedents } from './precedent';
import { shouldSampleAudit } from './sample-audit';

export interface AutoApprovalConfig {
  /** 自動承認を有効化するか（既定 false = Phase 0）。有効化は人間ゲート */
  enabled: boolean;
  /** 自動承認を許可するリスク等級（Phase 1 は ['low']） */
  allowedGrades: RiskGrade[];
  /** 自動承認に必要な最小前例数 */
  minPrecedents: number;
  /** §5.2 事後サンプル監査の割合 0..1 */
  sampleAuditRate: number;
}

/** 既定は Phase 0 相当（無効）。有効化は明示の config / env で。 */
export const DEFAULT_AUTO_APPROVAL_CONFIG: AutoApprovalConfig = {
  enabled: false,
  allowedGrades: ['low'],
  minPrecedents: 1,
  sampleAuditRate: 0.1,
};

/**
 * 環境変数から config を読む（既定は無効）。
 *   APPROVAL_AUTO_APPROVE = 'true' で有効化
 *   APPROVAL_AUTO_GRADES  = 'low' | 'low,medium' （許可等級）
 *   APPROVAL_AUTO_MIN_PRECEDENTS = 整数
 *   APPROVAL_AUTO_SAMPLE_RATE    = 0..1
 */
export function loadAutoApprovalConfig(): AutoApprovalConfig {
  const enabled = process.env.APPROVAL_AUTO_APPROVE === 'true';
  const gradesRaw = (process.env.APPROVAL_AUTO_GRADES ?? 'low')
    .split(',')
    .map(s => s.trim())
    .filter((g): g is RiskGrade => g === 'low' || g === 'medium' || g === 'high');
  const allowedGrades: RiskGrade[] = gradesRaw.length > 0 ? gradesRaw : ['low'];
  const min = Number(process.env.APPROVAL_AUTO_MIN_PRECEDENTS);
  const rate = Number(process.env.APPROVAL_AUTO_SAMPLE_RATE);
  return {
    enabled,
    allowedGrades,
    minPrecedents: Number.isFinite(min) && min >= 1 ? Math.floor(min) : 1,
    sampleAuditRate: Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.1,
  };
}

export interface AutoApprovalInput {
  signature: string;
  policyVersion?: string;
  riskGrade: RiskGrade;
}

export interface AutoApprovalResult {
  autoApprove: boolean;
  /** 機械可読の不承認/承認理由コード */
  code:
    | 'approved'
    | 'disabled'
    | 'grade-not-allowed'
    | 'policy-version-unknown'
    | 'insufficient-precedents'
    | 'conflicting-rejection';
  /** 人可読の理由（承認時は `auto-approved by precedent #N`） */
  reason: string;
  matchedPrecedents: number;
  /** §5.2 事後サンプル監査に選ばれたか（承認時のみ意味を持つ） */
  sampleAudit: boolean;
}

function deny(code: AutoApprovalResult['code'], reason: string, matched = 0): AutoApprovalResult {
  return { autoApprove: false, code, reason, matchedPrecedents: matched, sampleAudit: false };
}

/**
 * 純関数: 前例集合と config から自動承認可否を決める（I/O なし）。
 * precedents は input.policyVersion で絞った同型ケースの前例を想定するが、
 * 防御的に版一致を内部でも再確認する。
 */
export function decideAutoApproval(
  input: AutoApprovalInput,
  precedents: Precedent[],
  config: AutoApprovalConfig,
  sampleDecider: (key: string) => boolean
): AutoApprovalResult {
  if (!config.enabled) {
    return deny('disabled', '自動承認は無効（Phase 0）。人手承認へ');
  }
  if (!config.allowedGrades.includes(input.riskGrade)) {
    return deny('grade-not-allowed', `リスク等級 ${input.riskGrade} は自動承認対象外。人手承認へ`);
  }
  if (!input.policyVersion) {
    // 版が不明なら「当時の版で妥当だった」を確認できない → 人へ
    return deny('policy-version-unknown', 'ポリシー版が不明。fail-safe で人手承認へ');
  }

  // 版が一致する前例のみを採用（今のポリシーで過去を裁かない / §5.1.1）
  const matching = precedents.filter(p => p.policyVersion === input.policyVersion);

  if (matching.length < config.minPrecedents) {
    return deny('insufficient-precedents', '同型・同版の前例が不足。人手承認へ', matching.length);
  }
  // 却下前例が一つでもあれば自動承認しない（合意が割れている）
  if (matching.some(p => !p.approved)) {
    return deny('conflicting-rejection', '却下前例が混在。人手承認へ', matching.length);
  }

  const sampleAudit = sampleDecider(input.signature);
  return {
    autoApprove: true,
    code: 'approved',
    reason: `auto-approved by precedent #${matching.length}`,
    matchedPrecedents: matching.length,
    sampleAudit,
  };
}

export interface TryAutoApproveOptions {
  config?: AutoApprovalConfig;
  /** サンプリングのイベント単位キー（既定は signature）。proposalId 等を推奨 */
  eventKey?: string;
  actor?: string;
  sourceEntityId?: string;
  /** テスト用に前例取得を差し替え可能 */
  precedentFinder?: (signature: string, policyVersion?: string) => Promise<Precedent[]>;
}

/**
 * 前例自動承認を試みる（I/O あり）。自動承認した場合のみ AUTO_APPROVE を監査へ残す。
 * 不承認（人手へ回す）場合は監査せず結果だけ返す（人手フローが従来どおり記録する）。
 */
export async function tryAutoApprove(
  input: AutoApprovalInput,
  options: TryAutoApproveOptions = {}
): Promise<AutoApprovalResult> {
  const config = options.config ?? loadAutoApprovalConfig();

  // 無効時は I/O すらせず即返す（既定 Phase 0）。
  if (!config.enabled) {
    return deny('disabled', '自動承認は無効（Phase 0）。人手承認へ');
  }

  const finder = options.precedentFinder ?? findPrecedents;
  const precedents = await finder(input.signature, input.policyVersion);

  const eventKey = options.eventKey ?? input.signature;
  const result = decideAutoApproval(input, precedents, config, key =>
    shouldSampleAudit(`${eventKey}:${key}`, config.sampleAuditRate)
  );

  if (result.autoApprove) {
    // §5.2: サンプル監査対象は厚層(thick)で残し PDCA の人手レビューに乗せる。
    // 非対象は薄層(thin)。いずれも「auto-approved by precedent #N」を刻む。
    await auditLog.record({
      action: 'AUTO_APPROVE',
      entityType: 'System',
      entityId: `precedent:${input.signature}`,
      actor: options.actor,
      severity: result.sampleAudit ? 'thick' : 'thin',
      policyVersion: input.policyVersion,
      payload: {
        signature: input.signature,
        riskGrade: input.riskGrade,
        matchedPrecedents: result.matchedPrecedents,
        reason: result.reason,
        sampleAudit: result.sampleAudit,
        sourceEntityId: options.sourceEntityId ?? null,
      },
    });
  }

  return result;
}

/** ルールセット/ポリシー指紋（監査の相互参照用ヘルパ） */
export function autoApprovalConfigHash(config: AutoApprovalConfig): string | null {
  return hashPolicy(config);
}
