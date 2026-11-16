/**
 * Canonical public origin for auth redirects (Supabase redirect_to) and invite emails.
 */
export const DASHBOARD_PUBLIC_BASE_URL = 'https://app.utilityvision.app';

function normalizeDashboardBaseUrl(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  if (trimmed.includes('vercel.app')) return DASHBOARD_PUBLIC_BASE_URL;
  return trimmed;
}

/** Ensure Supabase verify links honor redirect_to when Site URL differs. */
export function forceSupabaseRedirectTo(actionLink: string, redirectTo: string): string {
  try {
    const u = new URL(actionLink);
    u.searchParams.set('redirect_to', redirectTo);
    return u.toString();
  } catch {
    return actionLink;
  }
}

/**
 * Canonical public origin for auth redirects (Supabase redirect_to) and invite emails.
 *
 * Priority:
 * 1. APP_BASE_URL — set on Vercel to your canonical site (recommended for auth).
 * 2. NEXT_PUBLIC_APP_URL — must match at build time for client; fine for API if set.
 * 3. Vercel runtime — VERCEL_URL is always set on Vercel (https://…hostname).
 * 4. Request URL — local `npm run dev` when none of the above apply.
 *
 * If invites are sent from your laptop without APP_BASE_URL / NEXT_PUBLIC_APP_URL,
 * step 4 becomes http://localhost:3000 and email links will redirect there.
 */
export function getPublicAppBaseUrl(request: Request): string {
  const explicit =
    process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return normalizeDashboardBaseUrl(explicit);

  if (process.env.VERCEL === '1' && process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/\/$/, '');
    const normalized = host.startsWith('http') ? host : `https://${host}`;
    if (normalized.includes('vercel.app')) return DASHBOARD_PUBLIC_BASE_URL;
    return normalized;
  }

  const origin = new URL(request.url).origin;
  if (origin.includes('vercel.app')) return DASHBOARD_PUBLIC_BASE_URL;
  return origin;
}

/**
 * Hardcoded hosted client portal origin.
 * Prefer custom domain; keep vercel hostname as env override if needed.
 */
export const DEFAULT_CLIENT_PORTAL_BASE_URL = 'https://client.utilityvision.app';

/**
 * Canonical public origin for the hosted client portal.
 *
 * Set `CLIENT_PORTAL_BASE_URL` (server) or `NEXT_PUBLIC_CLIENT_PORTAL_BASE_URL` (client build)
 * to override the default hosted client portal origin.
 */
export function getClientPortalBaseUrl(request?: Request): string {
  const explicit =
    process.env.CLIENT_PORTAL_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_CLIENT_PORTAL_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  // If not configured, fall back to the hosted client portal domain.
  return DEFAULT_CLIENT_PORTAL_BASE_URL;
}
