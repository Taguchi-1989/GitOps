/**
 * FlowOps - Ingress Policy Loader (ガバナンス・ハーネス §4.1 / POL-1, POL-2)
 *
 * spec/gates/ から入口ゲート・ポリシーYAMLを読込・検証する（gate-loader と同方針）。
 *
 * 重要(fail-safe): ポリシーファイルが見つからない・壊れている場合でも素通しにはしない。
 * 組込みの DEFAULT_INGRESS_POLICY（厳格な既定パターン集合）へフォールバックし、
 * 保護を維持したまま動作する（ING-2 / POL-3 の思想）。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { IngressPolicy, IngressPolicySchema } from './types';

const GATES_DIR = process.env.GATES_DIR || path.join(process.cwd(), 'spec', 'gates');
const DEFAULT_POLICY_ID = 'ingress-secret-gate';

/**
 * 組込み既定ポリシー。YAML 不在時のフォールバック兼テストの基準。
 * spec/gates/ingress-secret-gate.yaml と内容を一致させること。
 */
export const DEFAULT_INGRESS_POLICY: IngressPolicy = IngressPolicySchema.parse({
  id: DEFAULT_POLICY_ID,
  version: '1.0.0',
  title: '入口ゲート・機密混入検査（組込み既定）',
  confidenceThreshold: 0.5,
  failSafe: 'block',
  patterns: [
    // 結合型（マスク可）
    {
      id: 'email',
      kind: 'combination',
      description: 'メールアドレス',
      // 量指定子を上限付きに（ReDoS の O(n^2) バックトラッキング回避）
      regex: '[A-Za-z0-9._%+-]{1,254}@[A-Za-z0-9.-]{1,253}\\.[A-Za-z]{2,63}',
      confidence: 0.9,
    },
    {
      id: 'phone-jp',
      kind: 'combination',
      description: '日本の電話番号',
      regex: '0\\d{1,4}-\\d{1,4}-\\d{4}',
      confidence: 0.7,
    },
    // 値型（block）
    {
      id: 'private-key-block',
      kind: 'value',
      description: 'PEM 秘密鍵ヘッダ',
      regex: '-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----',
      confidence: 0.99,
    },
    {
      id: 'aws-access-key',
      kind: 'value',
      description: 'AWS アクセスキーID',
      regex: 'AKIA[0-9A-Z]{16}',
      confidence: 0.95,
    },
    {
      id: 'github-pat',
      kind: 'value',
      description: 'GitHub トークン（PAT/App/OAuth/user-to-server）',
      // ghp_/gho_/ghu_/ghs_/ghr_ を網羅
      regex: 'gh[pousr]_[A-Za-z0-9]{36,}',
      confidence: 0.95,
    },
    {
      id: 'slack-token',
      kind: 'value',
      description: 'Slack トークン',
      regex: 'xox[baprs]-[A-Za-z0-9-]{10,}',
      confidence: 0.9,
    },
    {
      id: 'jwt',
      kind: 'value',
      description: 'JSON Web Token',
      regex: 'eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+',
      confidence: 0.9,
    },
    {
      id: 'bearer-token',
      kind: 'value',
      description: 'Authorization Bearer トークン',
      regex: 'bearer\\s+[A-Za-z0-9._-]{12,}',
      flags: 'i',
      confidence: 0.8,
    },
    {
      id: 'api-key-assignment',
      kind: 'value',
      description: 'api_key/secret/token への代入',
      regex: '(?:api[_-]?key|secret|token)\\s*[:=]\\s*[\'"]?[A-Za-z0-9._-]{16,}',
      flags: 'i',
      confidence: 0.7,
    },
    {
      id: 'password-assignment',
      kind: 'value',
      description: 'password への代入',
      regex: 'password\\s*[:=]\\s*\\S+',
      flags: 'i',
      confidence: 0.6,
    },
  ],
});

export class IngressPolicyLoadError extends Error {
  code: 'PARSE_ERROR' | 'VALIDATION_ERROR';
  constructor(code: 'PARSE_ERROR' | 'VALIDATION_ERROR', message: string) {
    super(message);
    this.name = 'IngressPolicyLoadError';
    this.code = code;
  }
}

/**
 * 入口ゲート・ポリシーを読込む。
 * - ファイルが存在しない → DEFAULT_INGRESS_POLICY（フォールバック、保護維持）
 * - 存在するが壊れている → エラー送出（黙って既定に落とすと「壊れたポリシーで通った」を隠すため）
 */
export async function loadIngressPolicy(
  policyId: string = DEFAULT_POLICY_ID
): Promise<IngressPolicy> {
  const filePath = path.join(GATES_DIR, `${policyId}.yaml`);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    // FILE_NOT_FOUND → 組込み既定へフォールバック（素通しにはしない）
    return DEFAULT_INGRESS_POLICY;
  }

  let parsed: unknown;
  try {
    parsed = yaml.parse(content);
  } catch (e) {
    throw new IngressPolicyLoadError(
      'PARSE_ERROR',
      `Failed to parse ingress policy YAML: ${e instanceof Error ? e.message : e}`
    );
  }

  const result = IngressPolicySchema.safeParse(parsed);
  if (!result.success) {
    throw new IngressPolicyLoadError(
      'VALIDATION_ERROR',
      `Ingress policy validation failed for '${policyId}': ${result.error.message}`
    );
  }

  return result.data;
}
