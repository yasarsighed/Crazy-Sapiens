/**
 * Derives the public app origin for use in server-side redirect URLs.
 *
 * Priority:
 *  1. NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL (local dev override — strip the
 *     /auth/callback suffix so callers can append their own path)
 *  2. VERCEL_URL (auto-set on Vercel deployments)
 *  3. http://localhost:3000 (fallback for local dev without env override)
 */
export function getAppOrigin(): string {
  const devRedirect = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
  if (devRedirect) return devRedirect.replace('/auth/callback', '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}
