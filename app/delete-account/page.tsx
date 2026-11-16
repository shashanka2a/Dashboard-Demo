"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AppLogo } from "@/components/AppLogo";
import { isClientAppRole } from "@/lib/client-auth-shared";
import { isDemoSuperuserSession, clearDemoSuperuserSession } from "@/lib/demo-auth";
import { DEFAULT_CLIENT_PORTAL_BASE_URL } from "@/lib/app-url";

type PageState = "loading" | "login" | "confirm" | "deleted";

export default function DeleteAccountPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isDemoSuperuserSession()) {
      setPageState("confirm");
      setUser(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      setPageState(sessionUser ? "confirm" : "login");
    });
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmed = loginEmail.trim();
    if (!trimmed.includes("@")) {
      setError("Enter the email address on your Utility Vision account.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password: loginPassword,
      });
      if (signErr) throw signErr;
      if (!data.user) throw new Error("Sign in failed.");
      setUser(data.user);
      setPageState("confirm");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isDemoSuperuserSession()) {
      clearDemoSuperuserSession();
      setPageState("deleted");
      return;
    }

    if (!user) {
      setPageState("login");
      return;
    }

    if (confirmText.trim() !== "DELETE") {
      setError('Type DELETE in the confirmation field.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          confirm: confirmText.trim(),
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not delete account.");

      await supabase.auth.signOut();
      setUser(null);
      setPageState("deleted");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not delete account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const accountLabel = user
    ? isClientAppRole(user)
      ? "Client portal account"
      : "Employee dashboard account"
    : isDemoSuperuserSession()
      ? "Demo session"
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg border border-gray-200">
        <div className="mb-6 flex items-center gap-3">
          <AppLogo size={40} roundedClassName="rounded-lg" />
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Utility Vision</p>
            <h1 className="text-lg font-semibold text-gray-900">Delete account</h1>
          </div>
        </div>

        {pageState === "loading" ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF6633]" />
          </div>
        ) : null}

        {pageState === "login" ? (
          <>
            <p className="text-sm text-gray-600 mb-6">
              Sign in with the account you want to permanently delete.
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#FF6633] focus:outline-none focus:ring-2 focus:ring-[#FF6633]"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#FF6633] focus:outline-none focus:ring-2 focus:ring-[#FF6633]"
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
                className="inline-flex w-full items-center justify-center rounded-lg bg-[#FF6633] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#E55A2B] disabled:opacity-70"
              >
                {isSubmitting ? "Signing in..." : "Continue"}
              </button>
            </form>
          </>
        ) : null}

        {pageState === "confirm" ? (
          <>
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold">This action is permanent.</p>
                  <p className="mt-1 text-amber-800">
                    Your login will be removed immediately. Linked profile details (name, email,
                    phone) will be cleared from our directory. Project field data already logged
                    under your organization may be kept for business records.
                  </p>
                </div>
              </div>
            </div>

            {user ? (
              <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                <p className="text-gray-500">Signed in as</p>
                <p className="font-medium text-gray-900">{user.email}</p>
                {accountLabel ? <p className="text-xs text-gray-500 mt-1">{accountLabel}</p> : null}
              </div>
            ) : isDemoSuperuserSession() ? (
              <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                <p className="text-gray-500">Signed in as</p>
                <p className="font-medium text-gray-900">Demo superuser (local session only)</p>
              </div>
            ) : null}

            <form onSubmit={handleDelete} className="space-y-4">
              {!isDemoSuperuserSession() ? (
                <>
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
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#FF6633] focus:outline-none focus:ring-2 focus:ring-[#FF6633]"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Type <span className="font-mono">DELETE</span> to confirm
                    </label>
                    <input
                      id="confirm"
                      type="text"
                      autoComplete="off"
                      required
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#FF6633] focus:outline-none focus:ring-2 focus:ring-[#FF6633]"
                    />
                  </div>
                </>
              ) : null}

              {error ? (
                <p className="text-sm text-[#F44336] bg-[#FFEBEE] border border-[#F44336]/20 rounded-md px-3 py-2">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-lg bg-[#F44336] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#E53935] disabled:opacity-70"
              >
                {isSubmitting ? "Deleting account..." : "Delete account"}
              </button>
            </form>
          </>
        ) : null}

        {pageState === "deleted" ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Account deleted</h2>
            <p className="text-sm text-gray-600 mt-2">
              Your Utility Vision account has been permanently deleted. You can close this page or
              return to the login screen.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-[#FF6633] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#E55A2B]"
              >
                Employee login
              </Link>
              <Link
                href={`${DEFAULT_CLIENT_PORTAL_BASE_URL.replace(/\/$/, "")}/`}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Client portal login
              </Link>
            </div>
          </div>
        ) : null}

        {pageState !== "deleted" && pageState !== "loading" ? (
          <p className="mt-6 text-center text-xs text-gray-500">
            Changed your mind?{" "}
            <Link
              href={
                user && isClientAppRole(user)
                  ? `${DEFAULT_CLIENT_PORTAL_BASE_URL.replace(/\/$/, "")}/`
                  : "/activity"
              }
              className="text-[#FF6633] hover:underline"
            >
              Go back
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
