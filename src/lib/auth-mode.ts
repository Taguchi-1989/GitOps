/** Authentication may only be bypassed in a non-production local environment. */
export function isAuthDisabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_DISABLED === 'true';
}
