/**
 * FlowOps - Flow Service
 *
 * YAMLフロー定義の読み込みと管理
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import { parseFlowYaml, Flow, flowToMermaid, getFlowSummary } from '@/core/parser';
import { sanitizeFlowId } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

const FLOWS_DIR = process.env.FLOWS_DIR || path.join(process.cwd(), 'spec', 'flows');
const DICT_DIR = process.env.DICT_DIR || path.join(process.cwd(), 'spec', 'dictionary');

export interface FlowSummary {
  id: string;
  title: string;
  layer: 'L0' | 'L1' | 'L2';
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
}

export interface FlowWithMermaid {
  flow: Flow;
  mermaid: string;
  filePath: string;
}

/**
 * 全フローの一覧を取得
 */
export async function listFlows(): Promise<FlowSummary[]> {
  try {
    const files = await fs.readdir(FLOWS_DIR);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    const results = await Promise.all(
      yamlFiles.map(async file => {
        try {
          const content = await fs.readFile(path.join(FLOWS_DIR, file), 'utf-8');
          const result = parseFlowYaml(content, file);

          if (result.success && result.flow) {
            const summary = getFlowSummary(result.flow);
            return {
              id: result.flow.id,
              title: result.flow.title,
              layer: result.flow.layer,
              nodeCount: summary.nodeCount,
              edgeCount: summary.edgeCount,
              updatedAt: result.flow.updatedAt,
            };
          }
        } catch (e) {
          logger.warn({ err: e, file }, 'Failed to parse flow');
        }
        return null;
      })
    );

    return results.filter((f): f is FlowSummary => f !== null);
  } catch (e) {
    // ディレクトリが存在しない場合はENOENTのみ空配列を返す
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn({ err: e }, 'Flows directory does not exist');
      return [];
    }
    logger.error({ err: e }, 'Failed to read flows directory');
    throw e;
  }
}

/**
 * 特定のフローを取得
 */
export async function getFlow(flowId: string): Promise<FlowWithMermaid | null> {
  const safeId = sanitizeFlowId(flowId);
  if (!safeId) return null;
  const filePath = path.join(FLOWS_DIR, `${safeId}.yaml`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const result = parseFlowYaml(content, `${flowId}.yaml`);

    if (!result.success || !result.flow) {
      logger.warn({ flowId, errors: result.errors }, 'Flow validation failed');
      return null;
    }

    const mermaid = flowToMermaid(result.flow, {
      direction: 'TD',
      includeStyles: true,
      includeClickHandlers: true,
    });

    return {
      flow: result.flow,
      mermaid,
      filePath,
    };
  } catch (e) {
    logger.error({ err: e, flowId }, 'Failed to read flow');
    return null;
  }
}

/**
 * フローのYAMLコンテンツを取得
 */
export async function getFlowYaml(flowId: string): Promise<string | null> {
  const safeId = sanitizeFlowId(flowId);
  if (!safeId) return null;
  const filePath = path.join(FLOWS_DIR, `${safeId}.yaml`);

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

/**
 * フローのYAMLを保存
 */
export async function saveFlowYaml(flowId: string, content: string): Promise<void> {
  const safeId = sanitizeFlowId(flowId);
  if (!safeId) {
    throw new Error(`Invalid flow ID: ${flowId}`);
  }
  const filePath = path.join(FLOWS_DIR, `${safeId}.yaml`);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * 辞書（roles/systems）を取得
 */
export async function getDictionary(): Promise<{ roles: string[]; systems: string[] }> {
  const result = { roles: [] as string[], systems: [] as string[] };

  try {
    const rolesPath = path.join(DICT_DIR, 'roles.yaml');
    const rolesContent = await fs.readFile(rolesPath, 'utf-8');
    const parsed = yaml.parse(rolesContent);
    if (parsed && typeof parsed === 'object') {
      result.roles = Object.keys(parsed);
    }
  } catch (e) {
    logger.warn('Failed to read roles.yaml');
  }

  try {
    const systemsPath = path.join(DICT_DIR, 'systems.yaml');
    const systemsContent = await fs.readFile(systemsPath, 'utf-8');
    const parsed = yaml.parse(systemsContent);
    if (parsed && typeof parsed === 'object') {
      result.systems = Object.keys(parsed);
    }
  } catch (e) {
    logger.warn('Failed to read systems.yaml');
  }

  return result;
}
