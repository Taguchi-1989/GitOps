/**
 * FlowOps - Egress Gate Scanner (ガバナンス・ハーネス §4.2)
 *
 * ハーネス出力（構造化された提案など）を走査し、pass / flag / block を判定する純関数。
 * 入口ゲートとは独立した検出系（OUTG-2）。LLM を呼ばない。
 *
 * 判定:
 *  - high finding が1件でもあれば block（適用/永続化を止める）
 *  - medium のみなら flag（通すが要レビュー = エスカレーション層）
 *  - 無ければ pass
 */

import { EgressEvaluation, EgressFinding, EgressDecision, EgressTier } from './types';
import { EGRESS_RULES, countHighEntropyTokens } from './rules';

/** 1文字列リーフあたりの最大走査長（ReDoS/過大入力対策） */
export const EGRESS_MAX_VALUE_LENGTH = 100_000;

/** 任意のJSON値から文字列リーフを field 経路つきで列挙する */
function* walkStrings(value: unknown, path: string): Generator<{ field: string; value: string }> {
  if (typeof value === 'string') {
    yield { field: path || '(root)', value };
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      yield* walkStrings(value[i], `${path}[${i}]`);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      yield* walkStrings(v, path ? `${path}.${k}` : k);
    }
  }
}

/** 1パターンの一致数（毎回新規RegExpで lastIndex 汚染を避ける） */
function countMatches(text: string, regexSource: string, flags: string): number {
  let re: RegExp;
  try {
    re = new RegExp(regexSource, flags.includes('g') ? flags : `${flags}g`);
  } catch {
    return 0;
  }
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

/**
 * 出口ゲートを評価する（純関数・決定論）。
 * @param output ハーネス出力（提案オブジェクト等、任意のJSON値）
 */
export function scanEgress(output: unknown): EgressEvaluation {
  const findings: EgressFinding[] = [];

  for (const { field, value } of walkStrings(output, '')) {
    // 過大リーフは走査せず high finding として扱う（fail-safe）
    if (value.length > EGRESS_MAX_VALUE_LENGTH) {
      findings.push({
        ruleId: '__length_exceeded__',
        category: 'high-entropy',
        severity: 'high',
        field,
        count: 1,
      });
      continue;
    }

    // ルールベース検出
    for (const rule of EGRESS_RULES) {
      const count = countMatches(value, rule.regex, rule.flags ?? '');
      if (count > 0) {
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          field,
          count,
        });
      }
    }

    // エントロピーベース検出（正規表現に依存しない第二系）
    const entropyHits = countHighEntropyTokens(value);
    if (entropyHits > 0) {
      findings.push({
        ruleId: 'egress-high-entropy',
        category: 'high-entropy',
        severity: 'medium',
        field,
        count: entropyHits,
      });
    }
  }

  const hasHigh = findings.some(f => f.severity === 'high');
  const hasMedium = findings.some(f => f.severity === 'medium');

  let decision: EgressDecision;
  let tier: EgressTier;
  if (hasHigh) {
    decision = 'block';
    tier = 'full';
  } else if (hasMedium) {
    decision = 'flag';
    tier = 'thick';
  } else {
    decision = 'pass';
    tier = 'thin';
  }

  return { decision, tier, findings };
}
