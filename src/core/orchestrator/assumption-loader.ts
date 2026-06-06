/**
 * FlowOps - Assumption Loader
 *
 * spec/assumptions/ から前提集合YAMLを読込・検証（task-loader.ts と同方針）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { AssumptionSetSchema, AssumptionSet } from './schemas/assumption';

const ASSUMPTIONS_DIR =
  process.env.ASSUMPTIONS_DIR || path.join(process.cwd(), 'spec', 'assumptions');

export class AssumptionLoadError extends Error {
  code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR';

  constructor(code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR', message: string) {
    super(message);
    this.name = 'AssumptionLoadError';
    this.code = code;
  }
}

/**
 * 単一前提集合を読込・検証
 */
export async function loadAssumptionSet(setId: string): Promise<AssumptionSet> {
  const filePath = path.join(ASSUMPTIONS_DIR, `${setId}.yaml`);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new AssumptionLoadError('FILE_NOT_FOUND', `Assumption file not found: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.parse(content);
  } catch (e) {
    throw new AssumptionLoadError(
      'PARSE_ERROR',
      `Failed to parse assumption YAML: ${e instanceof Error ? e.message : e}`
    );
  }

  const result = AssumptionSetSchema.safeParse(parsed);
  if (!result.success) {
    throw new AssumptionLoadError(
      'VALIDATION_ERROR',
      `Assumption validation failed for '${setId}': ${result.error.message}`
    );
  }

  if (result.data.id !== setId) {
    throw new AssumptionLoadError(
      'VALIDATION_ERROR',
      `Assumption ID mismatch: file='${setId}', content.id='${result.data.id}'`
    );
  }

  return result.data;
}

/**
 * 全前提集合IDを一覧取得
 */
export async function listAssumptionSets(): Promise<string[]> {
  try {
    const files = await fs.readdir(ASSUMPTIONS_DIR);
    return files
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => path.basename(f, path.extname(f)));
  } catch {
    return [];
  }
}

/**
 * 指定IDの前提集合から個別 assumption をフラットに集める（順序維持）。
 * gate.assumptionRefs の解決に使う。見つからない/壊れた集合はスキップ。
 */
export async function resolveAssumptions(
  setIds: string[]
): Promise<
  Array<{ setId: string; setVersion: string; id: string; statement: string; source?: string }>
> {
  const resolved: Array<{
    setId: string;
    setVersion: string;
    id: string;
    statement: string;
    source?: string;
  }> = [];

  for (const setId of setIds) {
    let set: AssumptionSet;
    try {
      set = await loadAssumptionSet(setId);
    } catch {
      continue;
    }
    for (const a of set.assumptions) {
      resolved.push({
        setId: set.id,
        setVersion: set.version,
        id: a.id,
        statement: a.statement,
        source: a.source,
      });
    }
  }

  return resolved;
}
