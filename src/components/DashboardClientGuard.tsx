"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolveAuthRedirect } from "@/lib/auth-routes";
import { isClientAppRole } from "@/lib/client-auth-shared";
import { DEFAULT_CLIENT_PORTAL_BASE_URL } from "@/lib/app-url";

/** Keeps client portal users off internal employee dashboard routes. */
export function DashboardClientGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const enforce = () => {
      supabase.auth.getSession().then(({ data }) => {
        const user = data.session?.user ?? null;
        if (user && isClientAppRole(user)) {
          const base = DEFAULT_CLIENT_PORTAL_BASE_URL.replace(/\/$/, "");
          // Hosted portal uses `/` + `/?setup=1` (invite-only), not `/client`.
          window.location.assign(`${base}/`);
          return;
        }
        const target = resolveAuthRedirect(pathname, user);
        if (target) router.replace(target);
      });
    };

    enforce();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      enforce();
    });

    return () => sub.subscription.unsubscribe();
  }, [pathname, router]);

  return <>{children}</>;
}
