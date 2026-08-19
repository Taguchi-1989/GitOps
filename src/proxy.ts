import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { authConfig } from '@/lib/auth-config';
import { API_ERROR_CODES } from '@/core/types/api';
import { isAuthDisabled } from '@/lib/auth-mode';

const { auth } = NextAuth(authConfig);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());
const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE']);
const WRITE_ROLES = new Set(['admin', 'editor']);

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

export default auth(async function proxy(request) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const authDisabled = isAuthDisabled();
  const actorId = authDisabled
    ? 'local-admin'
    : request.auth?.user?.email ||
      request.auth?.user?.id ||
      request.auth?.user?.name ||
      'anonymous';
  const actorRole = authDisabled
    ? 'admin'
    : (request.auth?.user as { role?: string } | undefined)?.role || 'viewer';
  const traceId = request.headers.get('x-trace-id') || crypto.randomUUID();

  if (request.method === 'OPTIONS' && pathname.startsWith('/api')) {
    const preflightResponse = new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
    preflightResponse.headers.set('X-Trace-Id', traceId);
    return preflightResponse;
  }

  if (pathname.startsWith('/api')) {
    if (
      WRITE_METHODS.has(request.method) &&
      !pathname.startsWith('/api/auth') &&
      pathname !== '/api/health' &&
      // AIヘルプは読み取り相当（何も書き換えない）。viewer も質問できるようにする
      pathname !== '/api/help/ask' &&
      !WRITE_ROLES.has(actorRole)
    ) {
      const response = NextResponse.json(
        {
          ok: false,
          errorCode: API_ERROR_CODES.ACCESS_DENIED,
          details: 'Editor or admin role is required for write operations',
        },
        { status: 403 }
      );
      response.headers.set('X-Trace-Id', traceId);
      for (const [k, v] of Object.entries(getCorsHeaders(origin))) {
        response.headers.set(k, v);
      }
      return response;
    }

    const clientIp = getClientIp(request);
    // AIヘルプは llm バケットと分ける。共有すると同一拠点（NAT配下）からのヘルプ質問が
    // 改善案生成を429にしてしまうため。識別できるなら利用者単位で数える。
    const isHelpAskRoute = pathname === '/api/help/ask';
    const isLlmRoute =
      pathname.includes('/proposals/generate') ||
      /^\/api\/aims\/evidence\/[^/]+\/reviews$/.test(pathname);
    const isAuthRoute = pathname.startsWith('/api/auth');

    let config: { windowMs: number; maxRequests: number } = RATE_LIMITS.api;
    let rateLimitSubject = clientIp;
    let rateLimitBucket = 'api';
    if (isAuthRoute) {
      config = RATE_LIMITS.auth;
      rateLimitBucket = 'auth';
    } else if (isHelpAskRoute) {
      config = RATE_LIMITS.helpAsk;
      rateLimitBucket = 'help';
      rateLimitSubject = actorId !== 'anonymous' ? actorId : clientIp;
    } else if (isLlmRoute) {
      config = RATE_LIMITS.llm;
      rateLimitBucket = 'llm';
    }

    const result = checkRateLimit(`${rateLimitSubject}:${rateLimitBucket}`, config);

    if (!result.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          errorCode: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          details: `Too many requests. Try again in ${Math.ceil(result.resetMs / 1000)}s`,
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(Math.ceil(result.resetMs / 1000)));
      for (const [k, v] of Object.entries(getCorsHeaders(origin))) {
        response.headers.set(k, v);
      }
      return response;
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-trace-id', traceId);
    requestHeaders.set('x-actor-id', actorId);
    requestHeaders.set('x-actor-role', actorRole);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
      headers: { 'X-Trace-Id': traceId },
    });
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-Trace-Id', traceId);

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
