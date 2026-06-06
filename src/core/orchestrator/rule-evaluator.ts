/**
 * FlowOps - Validation Rule Evaluator
 *
 * バリデーションルールを決定論的に評価する純関数群。
 * 重要: LLM を使わない / I/O をしない / 例外を投げない（安全側に倒す）。
 */

import { RuleDefinition, RuleSeverity } from './schemas/validation-rule';

/** プロトタイプ汚染を避けるためフィールドパスで辿らせないキー */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface ValidationResult {
  ruleId: string;
  ruleType: string;
  passed: boolean;
  severity: RuleSeverity;
  coverage?: number;
  details: {
    matched: string[];
    missing: string[];
    message: string;
  };
}

/**
 * フィールドパスを解決して、葉のプリミティブ値を文字列配列で返す。
 *
 * 例: "hazards[].category"
 *   - "hazards[]" で root.hazards 配列を各要素へ展開
 *   - "category" で各要素の category 値を収集
 *
 * 配列展開は `[]` サフィックスで明示する（"tags[]" で直接の文字列配列も可）。
 * 欠損・型不一致・null は黙ってスキップ（決定論・安全側）。
 */
export function resolvePath(root: unknown, fieldPath: string): string[] {
  const tokens = fieldPath.split('.').filter(Boolean);
  let contexts: unknown[] = [root];

  for (const token of tokens) {
    const isArray = token.endsWith('[]');
    const key = isArray ? token.slice(0, -2) : token;
    const next: unknown[] = [];

    // プロトタイプ汚染ガード（field は信頼されたspec由来だが多層防御）
    if (DANGEROUS_KEYS.has(key)) {
      contexts = [];
      break;
    }

    for (const ctx of contexts) {
      if (ctx == null || typeof ctx !== 'object') continue;
      const value = (ctx as Record<string, unknown>)[key];
      if (value === undefined || value === null) continue;

      if (isArray) {
        if (Array.isArray(value)) {
          for (const item of value) next.push(item);
        }
        // 非配列は無視（安全側）
      } else {
        next.push(value);
      }
    }

    contexts = next;
  }

  const out: string[] = [];
  for (const c of contexts) {
    if (typeof c === 'string') out.push(c);
    else if (typeof c === 'number' || typeof c === 'boolean') out.push(String(c));
    // オブジェクト/配列/null は採用しない
  }
  return out;
}

/**
 * 単一ルールを評価
 */
export function evaluateRule(
  rule: RuleDefinition,
  taskOutput: Record<string, unknown>
): ValidationResult {
  switch (rule.ruleType) {
    case 'completeness':
      return evaluateCompleteness(rule, taskOutput);
    default:
      // 未実装の evaluator は素通り（passed=true）。将来 ruleType を追加する拡張余地。
      return {
        ruleId: rule.id,
        ruleType: rule.ruleType,
        passed: true,
        severity: rule.severity,
        details: {
          matched: [],
          missing: [],
          message: `evaluator for ruleType '${rule.ruleType}' is not implemented; skipped`,
        },
      };
  }
}

/**
 * 複数ルールを評価
 */
export function evaluateRules(
  rules: RuleDefinition[],
  taskOutput: Record<string, unknown>
): ValidationResult[] {
  return rules.map(rule => evaluateRule(rule, taskOutput));
}

// --------------------------------------------------------
// completeness: requiredCategories の網羅率を判定
// --------------------------------------------------------
function evaluateCompleteness(
  rule: RuleDefinition,
  taskOutput: Record<string, unknown>
): ValidationResult {
  const requiredOriginal = rule.ruleLogic.requiredCategories ?? [];
  const minCoverage = rule.ruleLogic.minimumCoverage ?? 1;
  const foundLower = new Set(
    resolvePath(taskOutput, rule.ruleLogic.field).map(v => v.toLowerCase())
  );

  // 必須カテゴリ未定義 → 評価不能、安全側で pass（メッセージで明示）
  if (requiredOriginal.length === 0) {
    return {
      ruleId: rule.id,
      ruleType: rule.ruleType,
      passed: true,
      severity: rule.severity,
      coverage: 1,
      details: {
        matched: Array.from(foundLower),
        missing: [],
        message: 'no requiredCategories defined; completeness check skipped',
      },
    };
  }

  const matched = requiredOriginal.filter(c => foundLower.has(c.toLowerCase()));
  const missing = requiredOriginal.filter(c => !foundLower.has(c.toLowerCase()));
  const coverage = matched.length / requiredOriginal.length;
  const passed = coverage >= minCoverage;

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return {
    ruleId: rule.id,
    ruleType: rule.ruleType,
    passed,
    severity: rule.severity,
    coverage,
    details: {
      matched,
      missing,
      message: passed
        ? `coverage ${pct(coverage)} >= required ${pct(minCoverage)}`
        : `coverage ${pct(coverage)} < required ${pct(minCoverage)} (missing: ${missing.join(', ')})`,
    },
  };
}
