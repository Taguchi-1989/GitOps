/**
 * FlowOps - Precedent Store (ガバナンス・ハーネス §5.1 / §5.3 Phase 0)
 *
 * 人手承認の決定を「前例」として append-only 監査ログに蓄積し、照会する。
 * 専用テーブルを設けず、監査ログ（追記専用・改竄不能）の上に前例コーパスを構築する:
 *   action   = 'PRECEDENT_RECORD'
 *   entityId = `precedent:<signature>`   ← 案件の同型性キー（indexed）
 *   policyVersion = 当時のポリシー版       ← 版が変われば流用不可（§5.1.1）
 *
 * 重要(§5.3): Phase 0 は全件人手。本モジュールは「記録」と「照会」だけを提供し、
 * 自動承認の判断はしない（findPrecedents の結果で自動 Yes を出さない）。
 */

import { auditLog } from '../audit';
import { RiskGrade, ApprovalLine, Precedent, RecordPrecedentInput } from './types';

const PRECEDENT_ACTION = 'PRECEDENT_RECORD' as const;
const PRECEDENT_PREFIX = 'precedent:';

/**
 * 前例照会の取得上限。監査ログ repository は limit 未指定だと既定 50 件で打ち切るため、
 * 明示的に大きめの上限を渡し、却下前例の取りこぼし（pagination による conflict-safety 破れ）を防ぐ。
 * この上限に達した場合、呼び出し側（tryAutoApprove）は「全件を見たと保証できない」として
 * fail-safe で人手へ倒す。
 */
export const PRECEDENT_FETCH_LIMIT = 1000;

/** リスク等級 → 決裁ライン（§5.1.2: 全件を最高権限者に上げない） */
export function requiredApprovalLine(grade: RiskGrade): ApprovalLine {
  switch (grade) {
    case 'low':
      return 'team-lead';
    case 'medium':
      return 'manager';
    case 'high':
      return 'executive';
  }
}

/** context からリスク等級を導出（明示が無ければ medium に倒す = 安全側寄せ） */
export function deriveRiskGrade(context: Record<string, unknown>): RiskGrade {
  const g = context.riskGrade;
  if (g === 'low' || g === 'medium' || g === 'high') return g;
  return 'medium';
}

/**
 * 人手決定を前例として記録する（§5.1.3 機械が完全証跡へ展開）。
 * high 等級はエスカレーション層(thick)、それ以外は thin で監査。
 */
export async function recordPrecedent(input: RecordPrecedentInput): Promise<void> {
  await auditLog.record({
    action: PRECEDENT_ACTION,
    entityType: 'System',
    entityId: `${PRECEDENT_PREFIX}${input.signature}`,
    actor: input.decidedBy,
    severity: input.riskGrade === 'high' ? 'thick' : 'thin',
    policyVersion: input.policyVersion,
    payload: {
      signature: input.signature,
      riskGrade: input.riskGrade,
      approved: input.approved,
      reason: input.reason ?? null,
      decidedBy: input.decidedBy ?? null,
      sourceEntityId: input.sourceEntityId ?? null,
    },
  });
}

function parsePayload(payload: unknown): Record<string, unknown> {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (payload && typeof payload === 'object') {
    return payload as Record<string, unknown>;
  }
  return {};
}

/**
 * 同型ケースの前例を照会する。
 * policyVersion を指定すると「当時と同じポリシー版」の前例のみを返す（§5.1.1）。
 *
 * 注意(§5.3): 返り値で自動承認を行ってはならない。Phase 0 は人が判断する。
 */
export async function findPrecedents(
  signature: string,
  policyVersion?: string
): Promise<Precedent[]> {
  const records = await auditLog.query({
    action: PRECEDENT_ACTION,
    entityId: `${PRECEDENT_PREFIX}${signature}`,
    ...(policyVersion ? { policyVersion } : {}),
    // 既定50件打ち切りを避け、却下前例を取りこぼさない（conflict-safety）
    limit: PRECEDENT_FETCH_LIMIT,
  });

  return records.map(r => {
    const p = parsePayload(r.payload);
    const grade = p.riskGrade;
    return {
      signature,
      policyVersion: r.policyVersion ?? null,
      riskGrade: grade === 'low' || grade === 'medium' || grade === 'high' ? grade : 'medium',
      approved: p.approved === true,
      reason: typeof p.reason === 'string' ? p.reason : null,
      decidedBy: typeof p.decidedBy === 'string' ? p.decidedBy : (r.actor ?? null),
      decidedAt: r.createdAt,
    };
  });
}
