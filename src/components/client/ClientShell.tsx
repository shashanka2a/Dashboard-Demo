"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { ClientPortalProvider, useClientPortal } from "@/context/ClientPortalContext";
import { ClientBottomNav } from "@/components/client/ClientBottomNav";
import { AppLogo } from "@/components/AppLogo";
import { supabase } from "@/lib/supabase";
import { isClientAppRole } from "@/lib/client-auth-shared";
import { resolveAuthRedirect } from "@/lib/auth-routes";

function ClientShellInner({ children }: { children: ReactNode }) {
  const { client, projectId, projects, setProjectId, loading, error } = useClientPortal();
  const projectQuery = projectId ? `project_id=${encodeURIComponent(projectId)}` : "";

  if (!projectId && projects.length === 0 && !loading) {
    return (
      <div className="min-h-dvh bg-[#0D0D0D] text-white px-5 py-16 text-center">
        <AppLogo size={32} className="mx-auto mb-6" />
        <p className="text-gray-300 font-medium">No portal projects assigned yet</p>
        <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
          Your Wick&apos;d contact can enable the client portal on a project and assign you access.
        </p>
      </div>
    );
  }

  if (!projectId && projects.length > 1) {
    return (
      <div className="min-h-dvh bg-[#0D0D0D] text-white px-5 py-10">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between mb-8">
            <AppLogo size={32} />
            <SignOutButton />
          </div>
          {client ? (
            <p className="text-sm text-gray-400 mb-1">Signed in as {client.name}</p>
          ) : null}
          <h1 className="text-2xl font-bold mb-2">Select a project</h1>
          <p className="text-sm text-gray-400 mb-8">Choose a site to view your client portal.</p>
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setProjectId(p.id)}
                  className="w-full text-left rounded-2xl border border-white/10 bg-[#1C1C1E] px-5 py-4 hover:border-[#FF6633]/40 transition-colors"
                >
                  <p className="font-semibold text-white">{p.name}</p>
                  {p.client_name ? <p className="text-sm text-gray-400 mt-0.5">{p.client_name}</p> : null}
                  {p.location ? <p className="text-xs text-gray-500 mt-1">{p.location}</p> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0D0D0D] text-white pb-24">
      {loading && !error ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF6633]" />
        </div>
      ) : error ? (
        <div className="mx-auto max-w-lg px-5 py-16 text-center">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      ) : (
        children
      )}
      {projectId ? <ClientBottomNav projectQuery={projectQuery} /> : null}
    </div>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    router.replace("/client/login");
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}

function ClientAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enforce = () => {
      supabase.auth.getSession().then(({ data }) => {
        const user = data.session?.user;
        const target = resolveAuthRedirect(pathname, user);
        if (target) {
          router.replace(target);
          return;
        }
        if (!user || !isClientAppRole(user)) {
          router.replace("/client/login");
          return;
        }
        setReady(true);
      });
    };

    setReady(false);
    enforce();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      enforce();
    });

    return () => sub.subscription.unsubscribe();
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-dvh bg-[#0D0D0D] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6633]" />
      </div>
    );
  }

  return <>{children}</>;
}

export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[#0D0D0D] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF6633]" />
        </div>
      }
    >
      <ClientAuthGate>
        <ClientPortalProvider>
          <ClientShellInner>{children}</ClientShellInner>
        </ClientPortalProvider>
      </ClientAuthGate>
    </Suspense>
  );
}
