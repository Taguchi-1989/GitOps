/**
 * FlowOps - API Utilities
 *
 * API Route用のユーティリティ関数
 */

import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { ApiResponse, API_ERROR_CODES, ApiErrorCode } from '@/core/types/api';
import { logger } from '@/lib/logger';

/**
 * 成功レスポンスを生成
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * エラーレスポンスを生成
 */
export function errorResponse(
  errorCode: ApiErrorCode,
  details?: string,
  status = 400
): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ ok: false, errorCode, details }, { status });
}

/**
 * 404 Not Foundレスポンス
 */
export function notFoundResponse(resource = 'Resource'): NextResponse<ApiResponse<never>> {
  return errorResponse(API_ERROR_CODES.NOT_FOUND, `${resource} not found`, 404);
}

/**
 * 500 Internal Errorレスポンス
 */
export function internalErrorResponse(error: unknown): NextResponse<ApiResponse<never>> {
  logger.error({ err: error }, 'API internal error');
  return errorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'An internal error occurred', 500);
}

/**
 * Zodバリデーションエラーレスポンス
 */
export function validationErrorResponse(error: ZodError): NextResponse<ApiResponse<never>> {
  const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, details, 400);
}

/**
 * リクエストボディをパース＆バリデーション
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T, any, any>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse<ApiResponse<never>> }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return { data: null, error: validationErrorResponse(result.error) };
    }

    return { data: result.data, error: null };
  } catch (e) {
    return {
      data: null,
      error: errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Invalid JSON body', 400),
    };
  }
}

/**
 * URLパラメータからIDを取得
 */
export function getIdParam(params: { id?: string }): string | null {
  return params.id || null;
}

/**
 * flowIdのサニタイズ（パストラバーサル対策）
 * 英数字・ハイフン・アンダースコアのみ許可
 */
export function sanitizeFlowId(flowId: string): string | null {
  if (!flowId || !/^[a-zA-Z0-9_-]+$/.test(flowId)) {
    return null;
  }
  return flowId;
}

/**
 * ページネーションパラメータを安全にパース
 * NaN・負数・上限超過を防止
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { limit?: number; offset?: number } = {}
): { limit: number; offset: number } {
  const { limit: defaultLimit = 50, offset: defaultOffset = 0 } = defaults;

  const rawLimit = searchParams.get('limit');
  const rawOffset = searchParams.get('offset');

  let limit = rawLimit ? parseInt(rawLimit, 10) : defaultLimit;
  let offset = rawOffset ? parseInt(rawOffset, 10) : defaultOffset;

  if (Number.isNaN(limit) || limit < 1) limit = defaultLimit;
  if (Number.isNaN(offset) || offset < 0) offset = defaultOffset;

  limit = Math.min(limit, 100);

  return { limit, offset };
}
