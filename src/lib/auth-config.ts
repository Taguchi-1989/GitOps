import type { NextAuthConfig } from 'next-auth';
import { API_ERROR_CODES } from '@/core/types/api';

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role || 'viewer';
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    async authorized({ auth, request }) {
      // ローカル開発時は認証をスキップ
      if (process.env.AUTH_DISABLED === 'true') return true;

      const isLoggedIn = !!auth?.user;
      const isApiRoute = request.nextUrl.pathname.startsWith('/api');
      const isAuthRoute = request.nextUrl.pathname.startsWith('/api/auth');
      const isHealthRoute = request.nextUrl.pathname === '/api/health';
      const isLoginPage = request.nextUrl.pathname === '/login';

      if (isAuthRoute || isHealthRoute) return true;

      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL('/', request.nextUrl));
        return true;
      }

      if (!isLoggedIn) {
        if (isApiRoute) {
          return Response.json(
            {
              ok: false,
              errorCode: API_ERROR_CODES.UNAUTHORIZED,
              details: 'Authentication required',
            },
            { status: 401 }
          );
        }
        return false;
      }

      return true;
    },
  },
};
