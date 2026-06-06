/**
 * FlowOps - ROI Decision Model Loader
 *
 * spec/decision-models/ から ROI モデル定義YAMLを読込・検証（task-loader.ts と同方針）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { RoiModelSchema, RoiModel } from './roi-schema';

const DECISION_MODELS_DIR =
  process.env.DECISION_MODELS_DIR || path.join(process.cwd(), 'spec', 'decision-models');

export class RoiModelLoadError extends Error {
  code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR';

  constructor(code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR', message: string) {
    super(message);
    this.name = 'RoiModelLoadError';
    this.code = code;
  }
}

/**
 * 単一 ROI モデルを読込・検証
 */
export async function loadRoiModel(modelId: string): Promise<RoiModel> {
  const filePath = path.join(DECISION_MODELS_DIR, `${modelId}.yaml`);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new RoiModelLoadError('FILE_NOT_FOUND', `ROI model file not found: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.parse(content);
  } catch (e) {
    throw new RoiModelLoadError(
      'PARSE_ERROR',
      `Failed to parse ROI model YAML: ${e instanceof Error ? e.message : e}`
    );
  }

  const result = RoiModelSchema.safeParse(parsed);
  if (!result.success) {
    throw new RoiModelLoadError(
      'VALIDATION_ERROR',
      `ROI model validation failed for '${modelId}': ${result.error.message}`
    );
  }

  if (result.data.id !== modelId) {
    throw new RoiModelLoadError(
      'VALIDATION_ERROR',
      `ROI model ID mismatch: file='${modelId}', content.id='${result.data.id}'`
    );
  }

  return result.data;
}
