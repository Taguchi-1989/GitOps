/**
 * FlowOps - Authentication
 *
 * NextAuth.js v5 (Auth.js) ベースの認証設定。
 * Credentials Provider（email/password）を使用。
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24時間
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
      const isLoggedIn = !!auth?.user;
      const isApiRoute = request.nextUrl.pathname.startsWith('/api');
      const isAuthRoute = request.nextUrl.pathname.startsWith('/api/auth');
      const isHealthRoute = request.nextUrl.pathname === '/api/health';
      const isLoginPage = request.nextUrl.pathname === '/login';

      // 認証系・ヘルスチェックは常に許可
      if (isAuthRoute || isHealthRoute) return true;

      // ログインページ: 認証済みならダッシュボードへ
      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL('/', request.nextUrl));
        return true;
      }

      // API・ページ: 認証必須
      if (!isLoggedIn) {
        if (isApiRoute) {
          return Response.json(
            { ok: false, errorCode: 'UNAUTHORIZED', details: 'Authentication required' },
            { status: 401 }
          );
        }
        return false; // ログインページへリダイレクト
      }

      return true;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(parsed.data.password, user.hashedPassword);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
