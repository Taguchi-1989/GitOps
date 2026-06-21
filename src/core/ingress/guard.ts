/**
 * FlowOps - Ingress Guard (ガバナンス・ハーネス §4.1 を呼び出し境界へ適用)
 *
 * 外部送出前の複数フィールドを入口ゲートで検査し、
 *  - block  → IngressBlockedError を送出（呼び出し側は人間承認フローへ）
 *  - mask   → 結合型を伏字化したフィールドを返す
 *  - pass   → 元フィールドをそのまま返す
 * いずれの判定も監査ログ（INGRESS_GATE）へ policyVersion / policyHash / severity 付きで残す。
 *
 * 実体（生の機密文字列）はログに載せない（LOG-1 の思想）。パターンid・件数・分類のみ。
 */

import { auditLog, hashPolicy, AuditEntityType } from '../audit';
import { scanIngress } from './scanner';
import { loadIngressPolicy } from './policy-loader';
import {
  IngressPolicy,
  IngressEvaluation,
  IngressDetection,
  IngressDecision,
  IngressTier,
} from './types';

export class IngressBlockedError extends Error {
  readonly policyVersion: string;
  readonly tier: IngressTier;
  readonly detections: IngressDetection[];

  constructor(policyVersion: string, tier: IngressTier, detections: IngressDetection[]) {
    const ids = detections.map(d => `${d.patternId}(${d.classification})`).join(', ');
    super(`Ingress gate blocked external send: ${ids}`);
    this.name = 'IngressBlockedError';
    this.policyVersion = policyVersion;
    this.tier = tier;
    this.detections = detections;
  }
}

export interface GuardIngressOptions {
  /** 監査の紐づけ先（例: issue id）。省略時は 'ingress' */
  entityId?: string;
  entityType?: AuditEntityType;
  actor?: string;
  /** 明示ポリシー注入（テスト用）。未指定なら loadIngressPolicy() */
  policy?: IngressPolicy;
}

const DECISION_RANK: Record<IngressDecision, number> = { pass: 0, mask: 1, block: 2 };
const TIER_RANK: Record<IngressTier, number> = { thin: 0, thick: 1, full: 2 };

/**
 * フィールド集合を入口ゲートで検査する。
 * 各フィールドを個別に走査し、最も重い判定を全体判定とする。
 * block の場合は監査後に IngressBlockedError を送出する。
 */
export async function guardIngress<T extends Record<string, string>>(
  fields: T,
  options: GuardIngressOptions = {}
): Promise<{
  fields: T;
  evaluation: IngressEvaluation;
  perField: Record<string, IngressEvaluation>;
}> {
  const policy = options.policy ?? (await loadIngressPolicy());

  const perField: Record<string, IngressEvaluation> = {};
  const maskedFields = { ...fields } as Record<string, string>;
  const allDetections: IngressDetection[] = [];

  let worstDecision: IngressDecision = 'pass';
  let worstTier: IngressTier = 'thin';
  let maskedCount = 0;

  for (const [key, value] of Object.entries(fields)) {
    const evald = scanIngress(value, policy);
    perField[key] = evald;
    maskedFields[key] = evald.maskedText;
    maskedCount += evald.maskedCount;
    allDetections.push(...evald.detections);

    if (DECISION_RANK[evald.decision] > DECISION_RANK[worstDecision]) {
      worstDecision = evald.decision;
    }
    if (TIER_RANK[evald.tier] > TIER_RANK[worstTier]) {
      worstTier = evald.tier;
    }
  }

  const evaluation: IngressEvaluation = {
    policyId: policy.id,
    policyVersion: policy.version,
    decision: worstDecision,
    tier: worstTier,
    detections: allDetections,
    maskedText: '', // 集約評価ではテキストは保持しない（フィールド別は perField / maskedFields）
    maskedCount,
  };

  // 監査（実体は載せない: パターンid・分類・件数のみ）
  await auditLog.record({
    action: 'INGRESS_GATE',
    entityType: options.entityType ?? 'Issue',
    entityId: options.entityId ?? 'ingress',
    actor: options.actor,
    severity: worstTier,
    policyVersion: policy.version,
    policyHash: hashPolicy(policy) ?? undefined,
    payload: {
      decision: worstDecision,
      maskedCount,
      fields: Object.keys(fields),
      detections: summarize(allDetections),
    },
  });

  if (worstDecision === 'block') {
    throw new IngressBlockedError(policy.version, worstTier, allDetections);
  }

  return { fields: maskedFields as T, evaluation, perField };
}

/** 監査payload向けに、パターンidごとに件数を畳む（実体なし） */
function summarize(
  detections: IngressDetection[]
): Array<{ patternId: string; classification: string; count: number }> {
  const map = new Map<string, { patternId: string; classification: string; count: number }>();
  for (const d of detections) {
    const key = `${d.patternId}:${d.classification}`;
    const cur = map.get(key);
    if (cur) {
      cur.count += d.count;
    } else {
      map.set(key, { patternId: d.patternId, classification: d.classification, count: d.count });
    }
  }
  return Array.from(map.values());
}
