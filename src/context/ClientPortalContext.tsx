"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clientApiFetch } from "@/lib/client-api";
import type { ClientOverview } from "@/lib/client-portal";

type ProjectOption = {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  location: string | null;
};

type ClientProfile = {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
};

type ClientPortalContextValue = {
  client: ClientProfile | null;
  projectId: string | null;
  setProjectId: (id: string) => void;
  projects: ProjectOption[];
  overview: ClientOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const ClientPortalContext = createContext<ClientPortalContextValue | null>(null);

export function ClientPortalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("project_id");

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectIdState] = useState<string | null>(projectIdParam);
  const [overview, setOverview] = useState<ClientOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  const setProjectId = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("project_id", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    clientApiFetch("/api/client/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.error) throw new Error(data.error);

        const list: ProjectOption[] = Array.isArray(data.projects) ? data.projects : [];
        setClient(data.client ?? null);
        setProjects(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setClient(null);
          setProjects([]);
          setError(e instanceof Error ? e.message : "Failed to load your portal");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMeLoaded(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!meLoaded) return;

    const validParam =
      projectIdParam && projects.some((p) => p.id === projectIdParam) ? projectIdParam : null;

    if (validParam) {
      setProjectIdState(validParam);
      return;
    }

    if (projects.length === 1) {
      if (projectIdParam !== projects[0].id) {
        setProjectId(projects[0].id);
      } else {
        setProjectIdState(projects[0].id);
      }
      return;
    }

    setProjectIdState(null);
  }, [meLoaded, projects, projectIdParam, setProjectId]);

  const refresh = useCallback(() => {
    if (!projectId) {
      setOverview(null);
      if (meLoaded) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    clientApiFetch(`/api/client/overview?project_id=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        setOverview(data as ClientOverview);
      })
      .catch((e) => {
        setOverview(null);
        setError(e instanceof Error ? e.message : "Failed to load project");
      })
      .finally(() => setLoading(false));
  }, [projectId, meLoaded]);

  useEffect(() => {
    if (!meLoaded) return;
    refresh();
  }, [meLoaded, refresh]);

  const value = useMemo(
    () => ({
      client,
      projectId,
      setProjectId,
      projects,
      overview,
      loading,
      error,
      refresh,
    }),
    [client, projectId, setProjectId, projects, overview, loading, error, refresh]
  );

  return <ClientPortalContext.Provider value={value}>{children}</ClientPortalContext.Provider>;
}

export function useClientPortal() {
  const ctx = useContext(ClientPortalContext);
  if (!ctx) throw new Error("useClientPortal must be used within ClientPortalProvider");
  return ctx;
}
