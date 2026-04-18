/**
 * POST /api/data-objects/:id/access-check - アクセスチェック
 *
 * Body: { actorId, roles, department?, clearanceLevel, qualifications?, action }
 * Response: { allowed, reason, requiresAbstraction, auditLevel }
 */

import { z } from 'zod';
import { SensitivityLevelSchema } from '@/core/parser/schema';
import { accessControlService } from '@/core/data/access-control';
import { loadSensitivityLevels, loadAccessPolicies } from '@/core/data/policy-loader';
import { dataObjectRepository } from '@/lib/data-object-repository';
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
  parseBody,
} from '@/lib/api-utils';

const AccessCheckRequestSchema = z.object({
  actorId: z.string().min(1),
  roles: z.array(z.string()),
  department: z.string().optional(),
  clearanceLevel: SensitivityLevelSchema,
  qualifications: z.array(z.string()).optional(),
  action: z.enum(['read', 'write', 'export', 'ai-usage', 'abstraction-bypass']),
});

let configLoaded = false;

async function ensureConfig() {
  if (!configLoaded) {
    try {
      const levels = loadSensitivityLevels();
      const policies = loadAccessPolicies();
      accessControlService.setConfig(levels, policies);
      configLoaded = true;
    } catch {
      // YAML辞書が存在しない場合はスキップ（テスト環境等）
    }
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(request, AccessCheckRequestSchema);
    if (error) return error;

    const record = await dataObjectRepository.findByObjectId(id);
    if (!record) return notFoundResponse('DataObject');

    await ensureConfig();

    // DataObjectRecord → DataObject 変換（checkAccess用）
    const dataObject = {
      objectId: record.objectId,
      objectType: record.objectType as 'document',
      sensitivityLevel: (record.sensitivityLevel || 'L1') as 'L1',
      exportPolicy: (record.exportPolicy || 'unrestricted') as 'unrestricted',
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      accessPolicyRef: record.accessPolicyRef || undefined,
      owner: record.owner || undefined,
    };

    const result = await accessControlService.checkAccess(
      {
        id: data.actorId,
        roles: data.roles,
        department: data.department,
        clearanceLevel: data.clearanceLevel,
        qualifications: data.qualifications,
      },
      dataObject,
      data.action
    );

    return successResponse(result);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
