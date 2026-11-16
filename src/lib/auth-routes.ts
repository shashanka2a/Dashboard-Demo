/** Route classification for client vs internal (employee) dashboard access. */

/** Apple / Google Play account deletion entry point — any signed-in user may access. */
export const ACCOUNT_DELETION_PATH = "/delete-account";

/** Client password setup lives on the dashboard domain before redirecting to the hosted portal. */
export const CLIENT_SETUP_PATH = "/client/signup";

export function isAccountDeletionPath(pathname: string): boolean {
  return pathname === ACCOUNT_DELETION_PATH;
}

export function isClientSetupPath(pathname: string): boolean {
  return pathname === CLIENT_SETUP_PATH || pathname.startsWith(`${CLIENT_SETUP_PATH}/`);
}

export function isAuthCallbackPath(pathname: string): boolean {
  return pathname === "/auth/callback" || pathname.startsWith("/auth/callback/");
}

/** Internal Wick'd dashboard pages (not client portal). */
export function isInternalDashboardPath(pathname: string): boolean {
  if (isAuthCallbackPath(pathname) || isClientSetupPath(pathname)) return false;

  if (pathname === "/" || pathname === "/login" || pathname === "/signup") return true;

  const internalPrefixes = [
    "/activity",
    "/projects",
    "/directory",
    "/clients",
    "/company",
    "/reports",
    "/jsa-reports",
    "/insights",
    "/incidents",
    "/observations",
    "/daily-logs",
  ];

  return internalPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Where to send the user based on role + path. `null` = stay on current page.
 * Client portal bounce for signed-in clients is handled by AuthRouteGuard (except /client/signup).
 */
export function resolveAuthRedirect(
  pathname: string,
  user: { user_metadata?: Record<string, unknown> } | null | undefined
): string | null {
  if (isAuthCallbackPath(pathname)) return null;
  if (isAccountDeletionPath(pathname)) return null;
  if (isClientSetupPath(pathname)) return null;

  const isClient = Boolean(user && String(user.user_metadata?.app_role || "").toLowerCase() === "client");

  // Client portal is hosted separately; AuthRouteGuard handles bounce.
  if (isClient) return null;

  return null;
}
