/**
 * Next.js Instrumentation Hook
 *
 * Runs once on server startup — for both page routes and API routes.
 * Used to wire the Prisma audit repository into the audit logger singleton.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/bootstrap');
  }
}
