/**
 * FlowOps - Acceptance Gate Loader
 *
 * spec/gates/ からゲート定義YAMLを読込・検証（task-loader.ts と同方針）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { GateDefinitionSchema, GateDefinition } from './schemas/gate';

const GATES_DIR = process.env.GATES_DIR || path.join(process.cwd(), 'spec', 'gates');

export class GateLoadError extends Error {
  code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR';

  constructor(code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR', message: string) {
    super(message);
    this.name = 'GateLoadError';
    this.code = code;
  }
}

/**
 * 単一ゲート定義を読込・検証
 */
export async function loadGate(gateId: string): Promise<GateDefinition> {
  const filePath = path.join(GATES_DIR, `${gateId}.yaml`);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new GateLoadError('FILE_NOT_FOUND', `Gate file not found: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.parse(content);
  } catch (e) {
    throw new GateLoadError(
      'PARSE_ERROR',
      `Failed to parse gate YAML: ${e instanceof Error ? e.message : e}`
    );
  }

  const result = GateDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    throw new GateLoadError(
      'VALIDATION_ERROR',
      `Gate validation failed for '${gateId}': ${result.error.message}`
    );
  }

  if (result.data.id !== gateId) {
    throw new GateLoadError(
      'VALIDATION_ERROR',
      `Gate ID mismatch: file='${gateId}', content.id='${result.data.id}'`
    );
  }

  return result.data;
}

/**
 * 全ゲート定義IDを一覧取得
 */
export async function listGates(): Promise<string[]> {
  try {
    const files = await fs.readdir(GATES_DIR);
    return files
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => path.basename(f, path.extname(f)));
  } catch {
    return [];
  }
}

/**
 * 全ゲートを読込・検証して返す（個別エラーはスキップ）
 */
export async function loadAllGates(): Promise<Map<string, GateDefinition>> {
  const gateIds = await listGates();
  const gates = new Map<string, GateDefinition>();

  for (const gateId of gateIds) {
    try {
      const gate = await loadGate(gateId);
      gates.set(gateId, gate);
    } catch {
      // 個別のロードエラーはスキップ
    }
  }

  return gates;
}
