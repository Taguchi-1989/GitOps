/**
 * FlowOps - Egress Detection Rules (ガバナンス・ハーネス §4.2 / OUTG-2)
 *
 * 入口ゲートとは独立した検出ロジック（手法を変える）。
 * - ルールベースのカテゴリ別検出（command-injection / path-traversal / script / url / secret）
 * - 加えてエントロピーベースの未知形式秘密検出（正規表現に依存しない第二系）
 *
 * 秘密の再検出は「入口の誤りを検知する二重化トリップ」(§4.2)として意図的に持つ。
 */

import { EgressCategory, EgressSeverity } from './types';

export interface EgressRule {
  id: string;
  category: EgressCategory;
  severity: EgressSeverity;
  regex: string;
  flags?: string;
}

/** 1文字あたりのシャノン・エントロピー（bit）。未知形式秘密の指標。 */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** 高エントロピー・トークン検出の閾値 */
export const ENTROPY_MIN_LENGTH = 20;
export const ENTROPY_MIN_BITS = 4.0;

// 秘密(base64/hex/トークン)が取りうる ASCII 文字集合。
// これに限定することで、自然言語（特にCJKの無空白文）の誤検出を避ける。
const SECRET_CHARSET = /^[A-Za-z0-9+/=_-]+$/;

/**
 * テキスト中の高エントロピー・トークン数を数える（正規表現に依存しない検出系）。
 * 区切り（空白・引用符・記号の一部）でトークン化し、
 * 「秘密が取りうる ASCII 文字集合・十分長い・高エントロピー」の連続を秘密候補とみなす。
 */
export function countHighEntropyTokens(text: string): number {
  const tokens = text.split(/[\s"'`,;:()[\]{}<>]+/);
  let count = 0;
  for (const t of tokens) {
    if (
      t.length >= ENTROPY_MIN_LENGTH &&
      SECRET_CHARSET.test(t) &&
      shannonEntropy(t) >= ENTROPY_MIN_BITS
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * カテゴリ別ルール集合（手書き・決定論）。
 * secret 系は入口と独立に定義した二重化トリップ。
 */
export const EGRESS_RULES: EgressRule[] = [
  // --- 出力に混入した秘密（二重化トリップ）---
  {
    id: 'egress-private-key',
    category: 'secret',
    severity: 'high',
    regex: '-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----',
  },
  { id: 'egress-aws-key', category: 'secret', severity: 'high', regex: 'AKIA[0-9A-Z]{16}' },
  {
    id: 'egress-github-token',
    category: 'secret',
    severity: 'high',
    regex: 'gh[pousr]_[A-Za-z0-9]{36,}',
  },
  {
    id: 'egress-slack-token',
    category: 'secret',
    severity: 'high',
    regex: 'xox[baprs]-[A-Za-z0-9-]{10,}',
  },

  // --- 破壊的コマンド片（既知危険）---
  {
    id: 'egress-rm-rf',
    category: 'command-injection',
    severity: 'high',
    regex: 'rm\\s+-rf?\\s+[/~]',
    flags: 'i',
  },
  {
    id: 'egress-sql-drop',
    category: 'command-injection',
    severity: 'high',
    regex: ';\\s*drop\\s+table\\s',
    flags: 'i',
  },
  {
    id: 'egress-cmd-subst',
    category: 'command-injection',
    severity: 'high',
    regex: '\\$\\([^)]+\\)|`[^`]+`',
  },
  {
    id: 'egress-pipe-fetch-exec',
    category: 'command-injection',
    severity: 'high',
    regex: '(?:curl|wget)\\s+\\S+\\s*\\|\\s*(?:sh|bash)',
    flags: 'i',
  },

  // --- パストラバーサル ---
  {
    id: 'egress-path-traversal',
    category: 'path-traversal',
    severity: 'medium',
    regex: '\\.\\./\\.\\./',
  },

  // --- スクリプト注入 ---
  {
    id: 'egress-script-tag',
    category: 'script-injection',
    severity: 'high',
    regex: '<script[\\s>]',
    flags: 'i',
  },
  {
    id: 'egress-js-eval',
    category: 'script-injection',
    severity: 'high',
    regex: '\\beval\\s*\\(|javascript:',
    flags: 'i',
  },

  // --- 疑わしいURL ---
  {
    id: 'egress-raw-ip-url',
    category: 'suspicious-url',
    severity: 'medium',
    regex: 'https?://\\d{1,3}(?:\\.\\d{1,3}){3}',
  },
  {
    id: 'egress-plain-http',
    category: 'suspicious-url',
    severity: 'medium',
    regex: 'http://[A-Za-z0-9.-]+',
  },
];
