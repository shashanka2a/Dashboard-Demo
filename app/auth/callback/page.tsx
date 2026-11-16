"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isClientAppRole } from "@/lib/client-auth-shared";
import { DEFAULT_CLIENT_PORTAL_BASE_URL } from "@/lib/app-url";

function parseParams(raw: string): Record<string, string> {
  const cleaned = raw.startsWith("#") || raw.startsWith("?") ? raw.slice(1) : raw;
  const params = new URLSearchParams(cleaned);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function collectAuthParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return {
    ...parseParams(window.location.search || ""),
    ...parseParams(window.location.hash || ""),
  };
}

async function resolveIsClientUser(user: User): Promise<boolean> {
  if (isClientAppRole(user)) return true;
  if (typeof user.user_metadata?.client_id === "string" && user.user_metadata.client_id) {
    return true;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return false;

  try {
    const res = await fetch("/api/auth/resolve-client", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = (await res.json()) as { isClient?: boolean };
    return Boolean(res.ok && json.isClient);
  } catch {
    return false;
  }
}

/**
 * Email invite/recovery callback (dashboard):
 * Clients → /client/signup → then hosted portal after password save
 * Employees → /signup or /activity
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const routeAfterSession = async (user: User | null, type: string) => {
      if (!user) {
        throw new Error("Could not establish a session from the invite link.");
      }

      const isSetupFlow =
        type === "invite" ||
        type === "recovery" ||
        type === "signup" ||
        type === "magiclink" ||
        type === "";

      const isClient = await resolveIsClientUser(user);
      if (cancelled) return;

      if (isClient) {
        // Client invites/resets always complete password setup on the dashboard.
        if (isSetupFlow) {
          router.replace("/client/signup");
          return;
        }
        const base = DEFAULT_CLIENT_PORTAL_BASE_URL.replace(/\/$/, "");
        await supabase.auth.signOut();
        window.location.replace(`${base}/`);
        return;
      }

      if (isSetupFlow) {
        router.replace("/signup");
        return;
      }

      router.replace("/activity");
    };

    const run = async () => {
      try {
        const params = collectAuthParams();
        const access_token = params.access_token;
        const refresh_token = params.refresh_token;
        const type = (params.type || "").toLowerCase();
        const code = params.code;
        const authError = params.error;
        const authErrorDescription = params.error_description;

        if (authError) {
          throw new Error(
            authErrorDescription ||
              authError ||
              "This invite link is invalid or expired. Ask your Wick'd contact to send a new portal invite."
          );
        }

        if (code && !access_token) {
          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
          if (cancelled) return;
          await routeAfterSession(data.session?.user ?? null, type);
          return;
        }

        if (access_token && refresh_token) {
          const { data, error: sessionErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionErr) throw sessionErr;
          if (cancelled) return;

          try {
            window.history.replaceState({}, "", "/auth/callback");
          } catch {
            /* ignore */
          }

          await routeAfterSession(data.session?.user ?? null, type);
          return;
        }

        // Tokens may already be consumed into a session by supabase-js.
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session?.user) {
          if (cancelled) return;
          await routeAfterSession(existing.session.user, type);
          return;
        }

        throw new Error(
          "Missing auth tokens. If you were sent to the login page, open the invite link again or ask for a new portal invite."
        );
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Auth callback failed.");
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg border border-gray-200">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Utility Vision</p>
          <h1 className="text-lg font-semibold text-gray-900">Finishing sign-in…</h1>
        </div>

        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-[#F44336] bg-[#FFEBEE] border border-[#F44336]/20 rounded-md px-3 py-2">
              {error}
            </p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#FF6633] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#E55A2B]"
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Please wait. You’ll be redirected automatically.</p>
        )}
      </div>
    </div>
  );
}
