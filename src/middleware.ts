/**
 * FlowOps - Middleware
 *
 * CORS制御、レート制限、認証の統合ミドルウェア。
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { auth } from '@/lib/auth';

// 許可するオリジン（環境変数で設定可能）
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export default auth(async function middleware(request) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // --- Trace ID: リクエストに一意のIDを付与 ---
  const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();

  // --- CORS: プリフライトリクエスト ---
  if (request.method === 'OPTIONS' && pathname.startsWith('/api')) {
    const preflightResponse = new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
    preflightResponse.headers.set('X-Trace-Id', traceId);
    return preflightResponse;
  }

  // --- レート制限（API のみ） ---
  if (pathname.startsWith('/api')) {
    const clientIp = getClientIp(request);
    const isLlmRoute = pathname.includes('/proposals/generate');
    const isAuthRoute = pathname.startsWith('/api/auth');

    const config = isAuthRoute ? RATE_LIMITS.auth : isLlmRoute ? RATE_LIMITS.llm : RATE_LIMITS.api;

    const result = checkRateLimit(`${clientIp}:${isLlmRoute ? 'llm' : 'api'}`, config);

    if (!result.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          errorCode: 'RATE_LIMIT_EXCEEDED',
          details: `Too many requests. Try again in ${Math.ceil(result.resetMs / 1000)}s`,
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(Math.ceil(result.resetMs / 1000)));
      // CORSヘッダーも付与
      for (const [k, v] of Object.entries(getCorsHeaders(origin))) {
        response.headers.set(k, v);
      }
      return response;
    }

    // レート制限ヘッダーを付与するためレスポンスを通過後に加工
    const response = NextResponse.next({
      headers: { 'X-Trace-Id': traceId },
    });
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-Trace-Id', traceId);

    // CORSヘッダー
    for (const [k, v] of Object.entries(getCorsHeaders(origin))) {
      response.headers.set(k, v);
    }

    return response;
  }

  const response = NextResponse.next();
  response.headers.set('X-Trace-Id', traceId);
  return response;
});

export const config = {
  matcher: [
    // 静的ファイル・_next を除外
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
