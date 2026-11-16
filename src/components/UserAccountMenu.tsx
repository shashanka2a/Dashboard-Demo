"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  FolderOpen,
  HelpCircle,
  Loader2,
  LogOut,
  Mail,
  Phone,
  User,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import type { User as AuthUser } from "@supabase/supabase-js";

type EmployeeMatch = {
  id: string;
  name: string;
  role: string;
  status: string;
  email?: string;
  phone?: string;
  assigned_projects?: string[];
};

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    account_admin: "Account admin",
    project_admin: "Project admin",
    project_member: "Project member",
    view_only: "View only",
    worker: "Worker",
  };
  return map[role] ?? role.replace(/_/g, " ");
}

function displayInitial(user: AuthUser | null, employee: EmployeeMatch | null): string {
  const name = employee?.name?.trim() || String(user?.user_metadata?.full_name || user?.user_metadata?.name || "");
  if (name) return name.charAt(0).toUpperCase();
  const email = user?.email?.trim();
  if (email) return email.charAt(0).toUpperCase();
  return "U";
}

function AccountDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="account-dialog-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-5 max-h-[min(70vh,520px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function UserAccountMenu() {
  const router = useRouter();
  const { setSelectedProject } = useProject();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [employee, setEmployee] = useState<EmployeeMatch | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const loadAccount = useCallback(async () => {
    setLoadingAccount(true);
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      setAuthUser(user);
      setEmployee(null);
      const email = user?.email?.trim().toLowerCase();
      if (!email) return;
      const res = await fetch("/api/employees", { cache: "no-store" });
      if (!res.ok) return;
      const list = (await res.json()) as EmployeeMatch[];
      if (!Array.isArray(list)) return;
      const match = list.find((e) => String(e.email || "").trim().toLowerCase() === email);
      if (match) setEmployee(match);
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (menuOpen) void loadAccount();
  }, [menuOpen, loadAccount]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, closeMenu]);

  const openProfile = () => {
    closeMenu();
    setProfileOpen(true);
    void loadAccount();
  };

  const openProjects = () => {
    closeMenu();
    setProjectsOpen(true);
    void loadAccount();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      closeMenu();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName =
    employee?.name?.trim() ||
    String(authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || "").trim() ||
    authUser?.email?.split("@")[0] ||
    "Your account";

  const assigned = (employee?.assigned_projects ?? []).filter(Boolean);

  return (
    <>
      <div ref={rootRef} className="relative w-full flex flex-col items-center pb-4">
        {menuOpen && (
          <div
            className="absolute bottom-16 left-full ml-3 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 origin-bottom-left"
            role="menu"
          >
            <div className="px-4 py-3 border-b border-gray-100 mb-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{authUser?.email ?? ""}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={openProfile}
              className="w-full px-4 py-2.5 text-left text-[15px] text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <User className="w-4 h-4 text-gray-400" />
              My profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={openProjects}
              className="w-full px-4 py-2.5 text-left text-[15px] text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <FolderOpen className="w-4 h-4 text-gray-400" />
              My projects
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                setNotificationsOpen(true);
              }}
              className="w-full px-4 py-2.5 text-left text-[15px] text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <Bell className="w-4 h-4 text-gray-400" />
              Notifications
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                setHelpOpen(true);
              }}
              className="w-full px-4 py-2.5 text-left text-[15px] text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-gray-400" />
              Help
            </button>
            <div className="h-px bg-gray-100 my-1" />
            <button
              type="button"
              role="menuitem"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              className="w-full px-4 py-2.5 text-left text-[15px] font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors disabled:opacity-60"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              Log out
            </button>
          </div>
        )}

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((o) => !o)}
          className={`w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center transition-all border-2 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
            menuOpen ? "border-orange-500 bg-gray-500 scale-105" : "border-gray-700 hover:border-gray-500"
          }`}
        >
          <span className="text-white text-sm font-semibold">{displayInitial(authUser, employee)}</span>
        </button>
      </div>

      {profileOpen && (
        <AccountDialog title="My profile" onClose={() => setProfileOpen(false)}>
          {loadingAccount ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#FF6633] animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                  {displayInitial(authUser, employee)}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-gray-900 truncate">{displayName}</p>
                  {employee?.role ? (
                    <p className="text-sm text-gray-500">{roleLabel(employee.role)}</p>
                  ) : null}
                  {employee?.status ? (
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        employee.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {employee.status}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {authUser?.email ? (
                  <div className="flex items-center gap-3 text-gray-700">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{authUser.email}</span>
                  </div>
                ) : null}
                {employee?.phone ? (
                  <div className="flex items-center gap-3 text-gray-700">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>{employee.phone}</span>
                  </div>
                ) : null}
              </div>
              {!employee && authUser?.email ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Your login is active. Link this email in Directory to show full employee details.
                </p>
              ) : null}
              <Link
                href="/directory"
                onClick={() => setProfileOpen(false)}
                className="inline-flex w-full justify-center rounded-lg bg-gray-900 text-white text-sm font-semibold py-2.5 hover:bg-gray-800 transition-colors"
              >
                Open Directory
              </Link>
            </div>
          )}
        </AccountDialog>
      )}

      {projectsOpen && (
        <AccountDialog title="My projects" onClose={() => setProjectsOpen(false)}>
          {loadingAccount ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#FF6633] animate-spin" />
            </div>
          ) : assigned.length === 0 ? (
            <div className="text-center py-6">
              <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">No projects assigned yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                Ask an admin to add you in Directory, or browse all projects.
              </p>
              <Link
                href="/projects"
                onClick={() => setProjectsOpen(false)}
                className="inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                View all projects
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {assigned.map((name) => (
                <li key={name}>
                  <Link
                    href={`/projects/dashboard?project=${encodeURIComponent(name)}&view=activity`}
                    onClick={() => {
                      setSelectedProject(name);
                      setProjectsOpen(false);
                    }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:border-[#FF6633]/30 hover:bg-orange-50/50 transition-colors group"
                  >
                    <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
                    <span className="text-xs font-semibold text-[#FF6633] opacity-0 group-hover:opacity-100 transition-opacity">
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AccountDialog>
      )}

      {notificationsOpen && (
        <AccountDialog title="Notifications" onClose={() => setNotificationsOpen(false)}>
          <div className="text-center py-8">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">You&apos;re all caught up</p>
            <p className="text-xs text-gray-400 mt-1">New alerts will show up here.</p>
          </div>
        </AccountDialog>
      )}

      {helpOpen && (
        <AccountDialog title="Help" onClose={() => setHelpOpen(false)}>
          <div className="space-y-4 text-sm text-gray-600">
            <p>
              Use the <strong className="text-gray-800">Dashboard</strong> for activity and reports,{" "}
              <strong className="text-gray-800">Projects</strong> for site data, and{" "}
              <strong className="text-gray-800">Directory</strong> to manage your team.
            </p>
            <p>
              Need access or a role change? Contact your company account admin or update your profile in
              Directory.
            </p>
          </div>
        </AccountDialog>
      )}
    </>
  );
}
