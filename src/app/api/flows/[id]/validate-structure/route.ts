/**
 * FlowOps - Flow Structural Validation API
 *
 * POST /api/flows/:id/validate-structure - フローの構造計算（健全性チェック）
 *
 * デッドロック検出、分岐網羅性、End到達可能性、
 * ロール遷移、システム境界をチェック
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { getFlow, getDictionary } from '@/lib/flow-service';
import { analyzeFlowStructure } from '@/core/flow-builder/structural-validator';
import { Dictionary, RoleSchema, SystemSchema } from '@/core/parser/schema';
import yaml from 'yaml';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: flowId } = await params;

    const flowData = await getFlow(flowId);
    if (!flowData) {
      return errorResponse(API_ERROR_CODES.NOT_FOUND, `Flow "${flowId}" not found`, 404);
    }

    // 辞書をフル読み込み（Dictionary型に変換）
    const dictionary = await loadFullDictionary();

    const result = analyzeFlowStructure(flowData.flow, dictionary ?? undefined);

    return successResponse({
      flowId,
      score: result.score,
      findings: result.findings,
      summary: result.summary,
    });
  } catch (err) {
    return internalErrorResponse(err);
  }
}

/**
 * 辞書をDictionary型でフル読み込み
 */
async function loadFullDictionary(): Promise<Dictionary | null> {
  const dictDir = process.env.DICT_DIR || path.join(process.cwd(), 'spec', 'dictionary');

  try {
    const rolesContent = await fs.readFile(path.join(dictDir, 'roles.yaml'), 'utf-8');
    const systemsContent = await fs.readFile(path.join(dictDir, 'systems.yaml'), 'utf-8');

    const rolesRaw = yaml.parse(rolesContent) || {};
    const systemsRaw = yaml.parse(systemsContent) || {};

    // Dictionary型に変換
    const roles: Record<string, { id: string; name: string; description?: string }> = {};
    const systems: Record<string, { id: string; name: string; description?: string }> = {};

    for (const [key, val] of Object.entries(rolesRaw)) {
      const parsed = RoleSchema.safeParse(val);
      if (parsed.success) {
        roles[key] = parsed.data;
      }
    }

    for (const [key, val] of Object.entries(systemsRaw)) {
      const parsed = SystemSchema.safeParse(val);
      if (parsed.success) {
        systems[key] = parsed.data;
      }
    }

    return { roles, systems };
  } catch {
    return null;
  }
}
