"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAccountDeletionPath, isAuthCallbackPath, isClientSetupPath, resolveAuthRedirect } from "@/lib/auth-routes";
import { isClientAppRole } from "@/lib/client-auth-shared";
import { DEFAULT_CLIENT_PORTAL_BASE_URL } from "@/lib/app-url";

/**
 * Enforces separation:
 * - clients may complete password setup on /client/signup, then go to hosted portal
 * - otherwise client accounts → hosted client portal app
 * - employees → internal dashboard only
 */
export function AuthRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const enforce = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const user = data.session?.user ?? null;

      // Allow client password setup + auth callback + account deletion on this domain.
      if (isClientSetupPath(pathname) || isAuthCallbackPath(pathname) || isAccountDeletionPath(pathname)) {
        return;
      }

      if (user && isClientAppRole(user)) {
        if (pathname === "/login") {
          router.replace("/client/signup");
          return;
        }
        if (typeof window !== "undefined") {
          const base = DEFAULT_CLIENT_PORTAL_BASE_URL.replace(/\/$/, "");
          if (!window.location.href.startsWith(base)) {
            window.location.assign(`${base}/`);
            return;
          }
        }
      } else {
        const target = resolveAuthRedirect(pathname, user);
        if (target && target !== pathname) {
          router.replace(target);
        }
      }
    };

    void enforce();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void enforce();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return <>{children}</>;
}
