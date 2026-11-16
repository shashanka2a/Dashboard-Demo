"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import {
  clearDemoSuperuserSession,
  isDemoSuperuserCredential,
  setDemoSuperuserSession,
} from "@/lib/demo-auth";
import { isClientAppRole } from "@/lib/client-auth-shared";
import { resolveAuthRedirect } from "@/lib/auth-routes";
import { AppLogo } from "@/components/AppLogo";
import { DEFAULT_CLIENT_PORTAL_BASE_URL } from "@/lib/app-url";

function hasAuthCallbackParams(search: string, hash: string): boolean {
  if (hash.includes("access_token=")) return true;
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return q.has("code") || q.has("error") || q.has("error_description");
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasAuthParams = useMemo(() => {
    if (typeof window === "undefined") return false;
    return hasAuthCallbackParams(window.location.search || "", window.location.hash || "");
  }, []);

  // Invite/recovery links sometimes land on /login (Site URL fallback) — forward tokens to callback.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    if (hasAuthCallbackParams(search, hash)) {
      router.replace(`/auth/callback${search}${hash}`);
    }
  }, [router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;

      if (isClientAppRole(user)) {
        // Client invite session should complete setup, not stay on employee login.
        router.replace("/client/signup");
        return;
      }

      const target = resolveAuthRedirect("/login", user);
      if (target) router.replace(target);
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmed = email.trim();

    if (isDemoSuperuserCredential(trimmed, password)) {
      try {
        await supabase.auth.signOut();
        setDemoSuperuserSession();
        router.push("/activity");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Sign in failed.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!trimmed.includes("@")) {
      setError("Enter a valid email address, or use the demo username admin.");
      setIsSubmitting(false);
      return;
    }

    supabase.auth
      .signInWithPassword({ email: trimmed, password })
      .then(async ({ data, error }) => {
        if (error) throw error;
        const user = data.user;
        if (user && isClientAppRole(user)) {
          await supabase.auth.signOut();
          window.location.assign(`${DEFAULT_CLIENT_PORTAL_BASE_URL.replace(/\/$/, "")}/`);
          return;
        }
        clearDemoSuperuserSession();
        router.push("/activity");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Sign in failed.");
      })
      .finally(() => setIsSubmitting(false));
  }

  const handleQuickDemoLaunch = (withTour = false) => {
    setDemoSuperuserSession();
    if (withTour) {
      router.push("/activity?tour=start");
    } else {
      router.push("/activity");
    }
  };

  const handleFillDemoCreds = () => {
    setEmail("admin");
    setPassword("Demo@2026");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-gray-200">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={40} roundedClassName="rounded-lg" />
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 font-bold">Utility Vision</p>
              <h1 className="text-lg font-semibold text-gray-900">Sign in to dashboard</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-xs font-semibold text-[#FF6633] hover:underline"
          >
            ← Home
          </button>
        </div>

        {/* Demo Callout Banner */}
        <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-200/80 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-orange-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF6633] animate-pulse" />
              Demo Environment Ready
            </span>
            <button
              type="button"
              onClick={handleFillDemoCreds}
              className="text-[#FF6633] font-semibold hover:underline"
            >
              Fill Credentials
            </button>
          </div>
          <p className="text-orange-800/90 leading-relaxed mb-3">
            Explore the dashboard without credentials or launch the animated guided walkthrough immediately.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoLaunch(true)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#FF6633] text-white font-semibold rounded-lg shadow-sm hover:bg-[#E55A2B] transition-colors"
            >
              Take a Tour
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLaunch(false)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Quick Sign In
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasAuthParams ? (
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              Finishing your invite…
            </p>
          ) : null}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Email or demo username
            </label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com or admin"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FF6633] focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:ring-offset-0"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FF6633] focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:ring-offset-0"
            />
          </div>

          {error ? (
            <p className="text-sm text-[#F44336] bg-[#FFEBEE] border border-[#F44336]/20 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[#FF6633] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#E55A2B] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
