/**
 * FlowOps - Validation Rule Loader
 *
 * spec/validation-rules/ からバリデーションルール定義YAMLを読込・検証
 * （task-loader.ts と同方針）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { RuleDefinitionSchema, RuleDefinition } from './schemas/validation-rule';

const RULES_DIR = process.env.RULES_DIR || path.join(process.cwd(), 'spec', 'validation-rules');

export class RuleLoadError extends Error {
  code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR';

  constructor(code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR', message: string) {
    super(message);
    this.name = 'RuleLoadError';
    this.code = code;
  }
}

/**
 * 単一ルール定義を読込・検証
 */
export async function loadRule(ruleId: string): Promise<RuleDefinition> {
  const filePath = path.join(RULES_DIR, `${ruleId}.yaml`);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new RuleLoadError('FILE_NOT_FOUND', `Rule file not found: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.parse(content);
  } catch (e) {
    throw new RuleLoadError(
      'PARSE_ERROR',
      `Failed to parse rule YAML: ${e instanceof Error ? e.message : e}`
    );
  }

  const result = RuleDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    throw new RuleLoadError(
      'VALIDATION_ERROR',
      `Rule validation failed for '${ruleId}': ${result.error.message}`
    );
  }

  if (result.data.id !== ruleId) {
    throw new RuleLoadError(
      'VALIDATION_ERROR',
      `Rule ID mismatch: file='${ruleId}', content.id='${result.data.id}'`
    );
  }

  return result.data;
}

/**
 * 全ルール定義IDを一覧取得
 */
export async function listRules(): Promise<string[]> {
  try {
    const files = await fs.readdir(RULES_DIR);
    return files
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => path.basename(f, path.extname(f)));
  } catch {
    return [];
  }
}

/**
 * 全ルールを読込・検証して返す（個別エラーはスキップ）
 */
export async function loadAllRules(): Promise<Map<string, RuleDefinition>> {
  const ruleIds = await listRules();
  const rules = new Map<string, RuleDefinition>();

  for (const ruleId of ruleIds) {
    try {
      const rule = await loadRule(ruleId);
      rules.set(ruleId, rule);
    } catch {
      // 個別のロードエラーはスキップ
    }
  }

  return rules;
}
