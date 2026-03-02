import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// Mock next-auth to capture the config passed to NextAuth()
vi.mock('next-auth', () => {
  let capturedConfig: any = null;
  const NextAuth = (config: any) => {
    capturedConfig = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  };
  (NextAuth as any).getConfig = () => capturedConfig;
  return { default: NextAuth };
});

// Mock credentials provider to pass through config
vi.mock('next-auth/providers/credentials', () => ({
  default: (config: any) => config,
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}));

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

// Helper to create a mock request object
const makeRequest = (pathname: string) => ({
  nextUrl: new URL(`http://localhost${pathname}`),
});

describe('auth', () => {
  let config: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Import the module to trigger NextAuth() call
    await import('@/lib/auth');
    // Retrieve the captured config
    const NextAuth = (await import('next-auth')).default;
    config = (NextAuth as any).getConfig();
  });

  describe('NextAuth configuration', () => {
    it('should configure custom sign-in page to /login', () => {
      expect(config.pages.signIn).toBe('/login');
    });

    it('should use jwt session strategy with 24h max age', () => {
      expect(config.session.strategy).toBe('jwt');
      expect(config.session.maxAge).toBe(24 * 60 * 60);
    });
  });

  describe('callbacks.jwt', () => {
    it('should add role and id to token when user is present', async () => {
      const token = { sub: 'abc' };
      const user = { id: 'user-1', role: 'admin' };
      const result = await config.callbacks.jwt({ token, user });
      expect(result.role).toBe('admin');
      expect(result.id).toBe('user-1');
    });

    it('should default role to viewer when user has no role', async () => {
      const token = { sub: 'abc' };
      const user = { id: 'user-2' };
      const result = await config.callbacks.jwt({ token, user });
      expect(result.role).toBe('viewer');
      expect(result.id).toBe('user-2');
    });

    it('should return token unchanged when no user is present', async () => {
      const token = { sub: 'abc', role: 'admin', id: 'user-1' };
      const result = await config.callbacks.jwt({ token, user: undefined });
      expect(result).toBe(token);
    });
  });

  describe('callbacks.session', () => {
    it('should add id and role from token to session.user', async () => {
      const session = { user: { name: 'Test' } } as any;
      const token = { id: 'user-1', role: 'admin' };
      const result = await config.callbacks.session({ session, token });
      expect(result.user.id).toBe('user-1');
      expect(result.user.role).toBe('admin');
    });

    it('should return session unchanged when session.user is falsy', async () => {
      const session = { user: null } as any;
      const token = { id: 'user-1', role: 'admin' };
      const result = await config.callbacks.session({ session, token });
      expect(result.user).toBeNull();
    });
  });

  describe('callbacks.authorized', () => {
    it('should allow auth routes regardless of login status', async () => {
      const result = await config.callbacks.authorized({
        auth: null,
        request: makeRequest('/api/auth/signin'),
      });
      expect(result).toBe(true);
    });

    it('should allow health route regardless of login status', async () => {
      const result = await config.callbacks.authorized({
        auth: null,
        request: makeRequest('/api/health'),
      });
      expect(result).toBe(true);
    });

    it('should redirect logged-in user away from login page', async () => {
      const result = await config.callbacks.authorized({
        auth: { user: { id: 'user-1' } },
        request: makeRequest('/login'),
      });
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(302);
    });

    it('should allow login page for unauthenticated users', async () => {
      const result = await config.callbacks.authorized({
        auth: null,
        request: makeRequest('/login'),
      });
      expect(result).toBe(true);
    });

    it('should return 401 JSON for unauthenticated API requests', async () => {
      const result = await config.callbacks.authorized({
        auth: null,
        request: makeRequest('/api/tasks'),
      });
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe('UNAUTHORIZED');
    });

    it('should return false for unauthenticated non-API routes', async () => {
      const result = await config.callbacks.authorized({
        auth: null,
        request: makeRequest('/dashboard'),
      });
      expect(result).toBe(false);
    });

    it('should allow authenticated users to access any route', async () => {
      const result = await config.callbacks.authorized({
        auth: { user: { id: 'user-1' } },
        request: makeRequest('/dashboard'),
      });
      expect(result).toBe(true);
    });
  });

  describe('providers[0].authorize (Credentials)', () => {
    const authorize = () => config.providers[0].authorize;

    it('should return null for invalid credentials (missing email)', async () => {
      const result = await authorize()({ password: 'pass123' });
      expect(result).toBeNull();
    });

    it('should return null for invalid credentials (bad email format)', async () => {
      const result = await authorize()({ email: 'not-an-email', password: 'pass123' });
      expect(result).toBeNull();
    });

    it('should return null for invalid credentials (empty password)', async () => {
      const result = await authorize()({ email: 'test@example.com', password: '' });
      expect(result).toBeNull();
    });

    it('should return null when user is not found in database', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      const result = await authorize()({
        email: 'unknown@example.com',
        password: 'pass123',
      });
      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'unknown@example.com' },
      });
    });

    it('should return null when password does not match', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        hashedPassword: 'hashed-pw',
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await authorize()({
        email: 'test@example.com',
        password: 'wrong-password',
      });
      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hashed-pw');
    });

    it('should return user object on successful login', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        hashedPassword: 'hashed-pw',
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authorize()({
        email: 'test@example.com',
        password: 'correct-password',
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
      });
    });
  });
});
