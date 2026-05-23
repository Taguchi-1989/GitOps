import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { authConfig } from '@/lib/auth-config';
import { API_ERROR_CODES } from '@/core/types/api';

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
  const actorId =
    request.auth?.user?.email || request.auth?.user?.id || request.auth?.user?.name || 'anonymous';
  const actorRole =
    process.env.AUTH_DISABLED === 'true'
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
    const isLlmRoute = pathname.includes('/proposals/generate');
    const isAuthRoute = pathname.startsWith('/api/auth');
    const config = isAuthRoute ? RATE_LIMITS.auth : isLlmRoute ? RATE_LIMITS.llm : RATE_LIMITS.api;
    const rateLimitKey = isAuthRoute ? 'auth' : isLlmRoute ? 'llm' : 'api';
    const result = checkRateLimit(`${clientIp}:${rateLimitKey}`, config);

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
