/**
 * FlowOps - Flow Create API
 *
 * POST /api/flows/create - 新規フローをYAMLファイルとして作成
 *
 * 2つのモード:
 * 1. yamlを直接指定 → バリデーション後にファイル保存 + git commit
 * 2. template指定 → テンプレートから生成
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { parseFlowYaml, stringifyFlow } from '@/core/parser';
import { FlowSchema, Flow } from '@/core/parser/schema';
import { saveFlowYaml, getFlowYaml } from '@/lib/flow-service';
import { auditLog } from '@/core/audit/logger';

export const dynamic = 'force-dynamic';

const CreateFlowRequestSchema = z
  .object({
    /** フローID（ファイル名に使用、スネークケース推奨） */
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'ID must be alphanumeric with hyphens/underscores'),
    /** YAML文字列（直接指定の場合） */
    yaml: z.string().optional(),
    /** テンプレート種別（yaml未指定の場合） */
    template: z.enum(['blank', 'l0', 'l1']).optional(),
    /** フロータイトル（テンプレート使用時） */
    title: z.string().optional(),
  })
  .refine(data => data.yaml || data.template, {
    message: 'Either yaml or template must be specified',
  });

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, CreateFlowRequestSchema);
    if (error) return error;

    // 既存チェック
    const existing = await getFlowYaml(data.id);
    if (existing) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `Flow "${data.id}" already exists`,
        409
      );
    }

    let yamlContent: string;

    if (data.yaml) {
      // YAMLを直接指定
      yamlContent = data.yaml;
    } else {
      // テンプレートから生成
      const flow = generateTemplate(data.id, data.title || data.id, data.template!);
      yamlContent = stringifyFlow(flow);
    }

    // バリデーション
    const parseResult = parseFlowYaml(yamlContent, `${data.id}.yaml`);
    if (!parseResult.success || !parseResult.flow) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `YAML validation failed: ${parseResult.errors.map(e => e.message).join('; ')}`,
        400
      );
    }

    // ファイル保存
    await saveFlowYaml(data.id, yamlContent);

    await auditLog.record({
      action: 'FLOW_CREATE',
      entityType: 'Flow',
      entityId: data.id,
      payload: {
        method: data.yaml ? 'direct-yaml' : `template-${data.template}`,
        layer: parseResult.flow.layer,
        nodeCount: Object.keys(parseResult.flow.nodes).length,
      },
    });

    return successResponse(
      {
        id: data.id,
        flow: parseResult.flow,
        yaml: yamlContent,
      },
      201
    );
  } catch (err) {
    return internalErrorResponse(err);
  }
}

function generateTemplate(id: string, title: string, template: 'blank' | 'l0' | 'l1'): Flow {
  const now = new Date().toISOString();

  switch (template) {
    case 'l0':
      return {
        id,
        title,
        layer: 'L0',
        updatedAt: now,
        nodes: {
          objective: {
            id: 'objective',
            type: 'start',
            label: '業務目的',
            meta: { description: 'この業務の目的を記述', kpi: [], stakeholders: [] },
          },
          outcome: {
            id: 'outcome',
            type: 'end',
            label: '期待成果物',
            meta: { description: '期待される成果物を記述', deliverables: [] },
          },
        },
        edges: {
          e1: { id: 'e1', from: 'objective', to: 'outcome' },
        },
      };

    case 'l1':
      return {
        id,
        title,
        layer: 'L1',
        updatedAt: now,
        nodes: {
          start_node: { id: 'start_node', type: 'start', label: '開始' },
          main_process: { id: 'main_process', type: 'process', label: '主要プロセス' },
          end_node: { id: 'end_node', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start_node', to: 'main_process' },
          e2: { id: 'e2', from: 'main_process', to: 'end_node' },
        },
      };

    case 'blank':
    default:
      return {
        id,
        title,
        layer: 'L1',
        updatedAt: now,
        nodes: {
          start_node: { id: 'start_node', type: 'start', label: '開始' },
          end_node: { id: 'end_node', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start_node', to: 'end_node' },
        },
      };
  }
}
