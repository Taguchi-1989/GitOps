/**
 * FlowOps - Flow Import API
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  parseBody,
  getAuditActor,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { parseFlowYaml } from '@/core/parser';
import { saveFlowYaml, getFlowYaml } from '@/lib/flow-service';
import { auditLog } from '@/core/audit/logger';

export const dynamic = 'force-dynamic';

const ImportFlowRequestSchema = z.object({
  yaml: z.string().min(1, 'YAML content is required').max(100000, 'YAML too large (max 100KB)'),
  flowId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  overwrite: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, ImportFlowRequestSchema);
    if (error) return error;

    const validateOnly = request.nextUrl.searchParams.get('validate') === 'true';
    const initialParse = parseFlowYaml(data.yaml);

    if (!initialParse.success || !initialParse.flow) {
      const errors = initialParse.errors.map(e => ({
        code: e.code,
        message: e.message,
        path: e.path,
      }));

      if (validateOnly) {
        return successResponse({ valid: false, errors });
      }

      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `YAML validation failed: ${initialParse.errors.map(e => e.message).join('; ')}`,
        400
      );
    }

    const flowId = data.flowId || initialParse.flow.id;
    const parseResult = parseFlowYaml(data.yaml, `${flowId}.yaml`);

    if (!parseResult.success || !parseResult.flow) {
      const errors = parseResult.errors.map(e => ({
        code: e.code,
        message: e.message,
        path: e.path,
      }));

      if (validateOnly) {
        return successResponse({ valid: false, errors });
      }

      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `YAML validation failed: ${parseResult.errors.map(e => e.message).join('; ')}`,
        400
      );
    }

    if (validateOnly) {
      return successResponse({ valid: true, errors: [], flow: parseResult.flow });
    }

    const existing = await getFlowYaml(flowId);
    if (existing && !data.overwrite) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        `Flow "${flowId}" already exists. Set overwrite=true to replace.`,
        409
      );
    }

    await saveFlowYaml(flowId, data.yaml);

    await auditLog.record({
      action: existing ? 'FLOW_UPDATE' : 'FLOW_IMPORT',
      entityType: 'Flow',
      entityId: flowId,
      actor: getAuditActor(request),
      payload: {
        method: 'import',
        layer: parseResult.flow.layer,
        nodeCount: Object.keys(parseResult.flow.nodes).length,
        edgeCount: Object.keys(parseResult.flow.edges).length,
        isOverwrite: !!existing,
      },
    });

    return successResponse(
      {
        id: flowId,
        flow: parseResult.flow,
        isNew: !existing,
      },
      existing ? 200 : 201
    );
  } catch (err) {
    return internalErrorResponse(err);
  }
}
