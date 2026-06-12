/**
 * FlowOps - Manual Proposal Prompt API
 *
 * GET /api/issues/[id]/proposals/prompt
 * コピペモード用に、外部AI（Copilot / ChatGPT 等）へそのまま貼り付けられる
 * プロンプト一式（出力形式の指定込み）を返す。LLM APIキーは不要。
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { getFlowYaml, getDictionary } from '@/lib/flow-service';
import { buildFullPrompt } from '@/core/llm/prompts';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) {
      return notFoundResponse('Issue');
    }

    if (issue.status !== 'in-progress') {
      return errorResponse(
        API_ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot build prompt for issue with status: ${issue.status}. Must be in-progress.`,
        400
      );
    }

    if (!issue.targetFlowId) {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        'Issue must have a targetFlowId to build prompt',
        400
      );
    }

    const flowYaml = await getFlowYaml(issue.targetFlowId);
    if (!flowYaml) {
      return errorResponse(
        API_ERROR_CODES.NOT_FOUND,
        `Target flow not found: ${issue.targetFlowId}`,
        404
      );
    }

    const dictionary = await getDictionary();
    const { system, user } = buildFullPrompt({
      issueTitle: issue.title,
      issueDescription: issue.description,
      flowYaml,
      roles: dictionary.roles,
      systems: dictionary.systems,
      expectedState: issue.expectedState ?? undefined,
      hypothesisCause: issue.hypothesisCause ?? undefined,
      successMetric: issue.successMetric ?? undefined,
    });

    // チャットUIに1回で貼り付けられるよう system + user を結合
    const prompt = `${system}\n\n---\n\n${user}`;

    return successResponse({ prompt });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
