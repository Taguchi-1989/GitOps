/**
 * FlowOps - Ingress Gate Scanner (ガバナンス・ハーネス §4.1)
 *
 * 入力テキストを決定論的に走査し、pass / mask / block を判定する純関数。
 * LLM を呼ばない（ING-3）。判定不能・値型は安全側へ倒す（POL-3 / ING-2）。
 */

import {
  IngressPolicy,
  IngressEvaluation,
  IngressDetection,
  IngressDecision,
  IngressTier,
  DetectionClass,
} from './types';

/** 結合型を伏字化する際の置換トークン（実体は残さない） */
function maskToken(patternId: string): string {
  return `«REDACTED:${patternId}»`;
}

/**
 * 1 パターンを走査し、一致箇所の数を数えつつ、結合型はテキストを伏字化する。
 * global フラグは毎回新規 RegExp を生成して付与する（lastIndex の状態汚染を避ける = 決定論）。
 */
function applyPattern(
  text: string,
  patternId: string,
  regexSource: string,
  flags: string,
  shouldMask: boolean
): { count: number; text: string } {
  const normalizedFlags = flags.includes('g') ? flags : `${flags}g`;
  let re: RegExp;
  try {
    re = new RegExp(regexSource, normalizedFlags);
  } catch {
    // 不正な正規表現は「走査不能」= 0件として扱い、上位の素通しは作らない。
    // （ポリシー検証は loader 側で行うため、ここに来るのは異常系のみ）
    return { count: 0, text };
  }

  let count = 0;
  const replaced = text.replace(re, match => {
    count += 1;
    return shouldMask ? maskToken(patternId) : match;
  });

  return { count, text: shouldMask ? replaced : text };
}

/**
 * 検出の分類を決める（spec §3.3 + ING-2）。
 * - 確信度がしきい値未満 → uncertain（判定不能 → 安全側）
 * - value → value（block）
 * - combination → combination（マスク可）
 */
function classify(
  kind: 'combination' | 'value',
  confidence: number,
  threshold: number
): DetectionClass {
  if (confidence < threshold) return 'uncertain';
  return kind;
}

/**
 * 入口ゲートを評価する（純関数・決定論）。
 *
 * 判定規則:
 *  - value もしくは uncertain が 1 件でもあれば block（fail-safe / 人間承認へ）
 *  - そうでなく combination があれば mask（伏字化して素通し）
 *  - いずれも無ければ pass
 */
export function scanIngress(text: string, policy: IngressPolicy): IngressEvaluation {
  const detections: IngressDetection[] = [];
  let working = text;

  // まずは検出のみ（分類確定）。マスクは「最終 decision が mask のとき」に効かせたいが、
  // 結合型の伏字化はテキスト変換を伴うため、検出と同時に working へ適用しておき、
  // decision が block/pass の場合は maskedText を使わない（元テキストを返す）。
  for (const pattern of policy.patterns) {
    const classification = classify(pattern.kind, pattern.confidence, policy.confidenceThreshold);
    // 伏字化はマスク可能な結合型のみ。value/uncertain は実体を残さず block する前提なので変換しない。
    const shouldMask = classification === 'combination';
    const { count, text: nextText } = applyPattern(
      working,
      pattern.id,
      pattern.regex,
      pattern.flags,
      shouldMask
    );
    if (count > 0) {
      detections.push({
        patternId: pattern.id,
        classification,
        kind: pattern.kind,
        confidence: pattern.confidence,
        count,
      });
      if (shouldMask) {
        working = nextText;
      }
    }
  }

  const hasValue = detections.some(d => d.classification === 'value');
  const hasUncertain = detections.some(d => d.classification === 'uncertain');
  const hasCombination = detections.some(d => d.classification === 'combination');
  const maskedCount = detections
    .filter(d => d.classification === 'combination')
    .reduce((sum, d) => sum + d.count, 0);

  let decision: IngressDecision;
  let tier: IngressTier;

  if (hasValue) {
    // 値型機密の外部送出は重大違反 → 完全証跡層
    decision = 'block';
    tier = 'full';
  } else if (hasUncertain) {
    // 判定不能 → 安全側へ倒し、人へエスカレーション
    decision = 'block';
    tier = 'thick';
  } else if (hasCombination) {
    // 結合型のみ → 伏字化して通過（安全側で素通り）
    decision = 'mask';
    tier = 'thin';
  } else {
    decision = 'pass';
    tier = 'thin';
  }

  return {
    policyId: policy.id,
    policyVersion: policy.version,
    decision,
    tier,
    detections,
    // block / pass では伏字化テキストを採用しない（元テキストを返す）
    maskedText: decision === 'mask' ? working : text,
    maskedCount: decision === 'mask' ? maskedCount : 0,
  };
}
