"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { isClientAppRole } from "@/lib/client-auth-shared";
import { AppLogo } from "@/components/AppLogo";
import { DEFAULT_CLIENT_PORTAL_BASE_URL } from "@/lib/app-url";

/**
 * Client password setup on the dashboard (app.utilityvision.app/client/signup).
 * After save → hosted client portal login.
 */
export default function ClientSignupPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  const portalBase = DEFAULT_CLIENT_PORTAL_BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      // Callback may have just set the session; give storage a tick if needed.
      for (let i = 0; i < 8; i++) {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (cancelled) return;
        if (user) {
          if (!isClientAppRole(user)) {
            window.location.replace("/signup");
            return;
          }
          setReady(true);
          setChecking(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!cancelled) {
        setReady(false);
        setChecking(false);
      }
    };

    void resolve();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const user = session?.user;
      if (!user) {
        setReady(false);
        setChecking(false);
        return;
      }
      if (!isClientAppRole(user)) {
        window.location.replace("/signup");
        return;
      }
      setReady(true);
      setChecking(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      await supabase.auth.signOut();
      window.location.assign(`${portalBase}/`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not set password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0D0D0D] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1C1C1E] p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <AppLogo size={40} roundedClassName="rounded-lg" />
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Client portal</p>
            <h1 className="text-lg font-semibold text-white">Set up your password</h1>
          </div>
        </div>

        {checking ? (
          <p className="text-sm text-gray-400 text-center py-6">Preparing your invite…</p>
        ) : !ready ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 bg-[#2C2C2E] border border-white/10 rounded-lg px-3 py-2">
              Open your portal invite email and click the setup link to start.
            </p>
            <a
              href={`${portalBase}/`}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#FF6633] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#E55A2B]"
            >
              Go to client portal sign in
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-300">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#2C2C2E] px-3 py-2.5 text-sm text-white focus:border-[#FF6633] focus:outline-none focus:ring-2 focus:ring-[#FF6633]/30"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-gray-300">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#2C2C2E] px-3 py-2.5 text-sm text-white focus:border-[#FF6633] focus:outline-none focus:ring-2 focus:ring-[#FF6633]/30"
              />
            </div>
            {error && (
              <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#FF6633] py-2.5 text-sm font-semibold text-white hover:bg-[#E55A2B] disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Save password"}
            </button>
            <p className="text-xs text-gray-500 text-center pt-1">
              After saving, you’ll sign in at{" "}
              <Link href={portalBase} className="text-[#FF6633] hover:underline">
                {portalBase.replace(/^https?:\/\//, "")}
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
