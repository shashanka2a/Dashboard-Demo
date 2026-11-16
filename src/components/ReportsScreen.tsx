"use client";

import { useState, useLayoutEffect, useMemo, useEffect, useRef, useCallback } from "react";
import { Building2, Calendar, FolderOpen, Loader2, X } from "lucide-react";
import { ReportCard } from "./ReportCard";
import { useProject } from "@/context/ProjectContext";
import {
  readDashboardCache,
  writeDashboardCache,
  PROJECTS_RAW_CACHE_KEY,
  isDashboardCacheFresh,
} from "@/lib/dashboard-data-cache";
import { REPORTS_LIST_STALE_MS, isMainReportsDefaultFilters } from "@/lib/reports-list-cache";
import {
  filterProjectNamesForMainDashboard,
  filterReportsForMainDashboard,
  isExcludedFromMainDashboard,
} from "@/lib/activity-excluded-projects";

interface Report {
  id: string;
  projectName: string;
  projectId?: string | null;
  date: string;
  timestamp: string;
  reportSigned?: boolean;
  weather: {
    high: number;
    low: number;
    condition: "sunny" | "rainy" | "cloudy";
  };
  photos: string[];
  delays: number;
}

type DateRangePreset = "all" | "today" | "7d" | "30d" | "custom";

type ProjectOption = { id: string; name: string };
type ClientOption = { id: string; label: string };

function reportsCacheKey(parts: {
  project: string;
  client: string;
  range: string;
  from: string;
  to: string;
}) {
  return `reports:list:v2:${encodeURIComponent(
    [parts.project, parts.client, parts.range, parts.from, parts.to].join("|")
  )}`;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ReportsScreen({
  initialReports,
  excludeTestProjects = false,
}: {
  initialReports?: Report[];
  /** Hide test projects on the global dashboard (/reports), not per-project views. */
  excludeTestProjects?: boolean;
}) {
  const { selectedProject } = useProject();
  const [reports, setReports] = useState<Report[]>(() =>
    excludeTestProjects ? filterReportsForMainDashboard(initialReports ?? []) : (initialReports ?? [])
  );
  const [fetching, setFetching] = useState(() => !initialReports?.length);
  const [revalidating, setRevalidating] = useState(false);

  const [dateRange, setDateRange] = useState<DateRangePreset>("30d");
  const [customFrom, setCustomFrom] = useState(() => daysAgoYmd(30));
  const [customTo, setCustomTo] = useState(() => todayYmd());
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const initialReportsRef = useRef(initialReports);
  initialReportsRef.current = initialReports;

  const applyProjectOptions = useCallback(
    (projData: { id: string; name: string }[]) => {
      const names = excludeTestProjects
        ? filterProjectNamesForMainDashboard(projData.map((p) => p.name))
        : projData.map((p) => p.name);
      const nameSet = new Set(names);
      setProjects(
        projData
          .filter((p) => nameSet.has(p.name))
          .map((p) => ({ id: p.id, name: p.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    [excludeTestProjects]
  );

  const applyClientOptions = useCallback(
    (clientData: { id: string; name: string; company_name?: string | null }[]) => {
      setClients(
        clientData
          .map((c) => ({
            id: c.id,
            label: (c.company_name || c.name || "Client").trim(),
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
    },
    []
  );

  const [projectFilter, setProjectFilter] = useState(
    selectedProject && selectedProject !== "All Projects" ? selectedProject : "All Projects"
  );
  const [clientFilter, setClientFilter] = useState("all");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    if (selectedProject && selectedProject !== "All Projects") {
      if (excludeTestProjects && isExcludedFromMainDashboard(selectedProject)) {
        setProjectFilter("All Projects");
      } else {
        setProjectFilter(selectedProject);
      }
    }
  }, [selectedProject, excludeTestProjects]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const cachedProjects = readDashboardCache<{ id: string; name: string }[]>(PROJECTS_RAW_CACHE_KEY);
    if (Array.isArray(cachedProjects) && cachedProjects.length) {
      applyProjectOptions(cachedProjects);
    }

    if (excludeTestProjects) return;

    let cancelled = false;
    (async () => {
      try {
        const [projRes, clientRes] = await Promise.all([
          fetch("/api/projects", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
        ]);
        const projData = await projRes.json();
        const clientData = await clientRes.json();
        if (cancelled) return;
        if (Array.isArray(projData)) {
          writeDashboardCache(PROJECTS_RAW_CACHE_KEY, projData);
          applyProjectOptions(projData);
        }
        if (Array.isArray(clientData)) applyClientOptions(clientData);
      } catch {
        /* ignore meta load errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [excludeTestProjects, applyProjectOptions, applyClientOptions]);

  const visibleReports = useMemo(
    () => (excludeTestProjects ? filterReportsForMainDashboard(reports) : reports),
    [reports, excludeTestProjects]
  );

  const filterParts = useMemo(() => {
    const from = dateRange === "custom" ? customFrom : "";
    const to = dateRange === "custom" ? customTo : "";
    return {
      project: projectFilter || "All Projects",
      client: clientFilter || "all",
      range: dateRange,
      from,
      to,
    };
  }, [projectFilter, clientFilter, dateRange, customFrom, customTo]);

  const reportsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filterParts.project && filterParts.project !== "All Projects") {
      params.set("project", filterParts.project);
    }
    if (filterParts.client && filterParts.client !== "all") {
      params.set("client", filterParts.client);
    }
    if (filterParts.range === "custom") {
      if (filterParts.from) params.set("from", filterParts.from);
      if (filterParts.to) params.set("to", filterParts.to);
    } else if (filterParts.range !== "all") {
      params.set("range", filterParts.range);
    }
    return `/api/reports?${params.toString()}`;
  }, [filterParts]);

  const cacheKey = useMemo(() => reportsCacheKey(filterParts), [filterParts]);

  useLayoutEffect(() => {
    const cached = readDashboardCache<Report[]>(cacheKey);
    const hasCache = cached != null && Array.isArray(cached);
    const cacheFresh = hasCache && isDashboardCacheFresh(cacheKey, REPORTS_LIST_STALE_MS);
    const hasSeed = (initialReportsRef.current?.length ?? 0) > 0;
    const useBootstrap =
      excludeTestProjects && isMainReportsDefaultFilters(filterParts);

    if (hasCache) {
      setReports(
        excludeTestProjects ? filterReportsForMainDashboard(cached) : cached
      );
      setFetching(false);
    }

    if (cacheFresh) {
      return;
    }

    const ac = new AbortController();
    const silent = hasCache || hasSeed;
    if (!silent) setFetching(true);
    else setRevalidating(true);

    const fetchUrl = useBootstrap ? "/api/reports/bootstrap?range=30d" : reportsUrl;

    (async () => {
      try {
        const res = await fetch(fetchUrl, { cache: "no-store", signal: ac.signal });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (!res.ok) {
          console.error("Reports API error:", data?.error || res.status);
          if (!silent) setReports([]);
          return;
        }

        if (useBootstrap && data && !Array.isArray(data)) {
          const list = Array.isArray(data.reports) ? data.reports : [];
          setReports(
            excludeTestProjects ? filterReportsForMainDashboard(list) : list
          );
          writeDashboardCache(cacheKey, list);
          if (Array.isArray(data.projects) && data.projects.length) {
            writeDashboardCache(PROJECTS_RAW_CACHE_KEY, data.projects);
            applyProjectOptions(data.projects);
          }
          if (Array.isArray(data.clients)) applyClientOptions(data.clients);
          return;
        }

        const list = Array.isArray(data) ? data : [];
        setReports(excludeTestProjects ? filterReportsForMainDashboard(list) : list);
        writeDashboardCache(cacheKey, list);
      } catch (error) {
        if (ac.signal.aborted) return;
        if (!silent) {
          console.error("Error fetching reports:", error);
          setReports([]);
        }
      } finally {
        if (!ac.signal.aborted) {
          setFetching(false);
          setRevalidating(false);
        }
      }
    })();

    return () => ac.abort();
  }, [
    cacheKey,
    reportsUrl,
    excludeTestProjects,
    filterParts,
    applyProjectOptions,
    applyClientOptions,
  ]);

  const showBusy = fetching || revalidating;
  const hasActiveFilters =
    dateRange !== "all" ||
    (projectFilter && projectFilter !== "All Projects") ||
    (clientFilter && clientFilter !== "all");

  const dateLabel =
    dateRange === "all"
      ? "All Time"
      : dateRange === "today"
        ? "Today"
        : dateRange === "7d"
          ? "Last 7 Days"
          : dateRange === "30d"
            ? "Last 30 Days"
            : customFrom && customTo
              ? `${customFrom} → ${customTo}`
              : "Custom range";

  const clearFilters = () => {
    setDateRange("all");
    setCustomFrom(daysAgoYmd(30));
    setCustomTo(todayYmd());
    setProjectFilter("All Projects");
    setClientFilter("all");
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="relative bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 transition-shadow duration-200">
        {showBusy && (
          <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden bg-gray-100" aria-hidden>
            <div className="h-full w-1/3 rounded-full bg-[#FF6633] animate-reports-bar opacity-90" />
          </div>
        )}
        <div data-tour="reports-header" className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Daily signed project logs
              {visibleReports.length > 0
                ? ` · ${visibleReports.length} report${visibleReports.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          {showBusy && (
            <div
              className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0 mt-0.5"
              aria-live="polite"
            >
              <Loader2 className="w-4 h-4 text-[#FF6633] animate-spin" aria-hidden />
              <span>{fetching && reports.length === 0 ? "Loading…" : "Updating…"}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          {/* Date range */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              type="button"
              onClick={() => setDateDropdownOpen((o) => !o)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all shadow-sm ${
                dateRange !== "all"
                  ? "border-[#FF6633] bg-[#FFF3EF] text-[#FF6633]"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{dateLabel}</span>
            </button>
            {dateDropdownOpen ? (
              <div className="absolute z-30 left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden py-1">
                {(
                  [
                    ["all", "All Time"],
                    ["today", "Today"],
                    ["7d", "Last 7 Days"],
                    ["30d", "Last 30 Days"],
                    ["custom", "Custom range"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setDateRange(value);
                      if (value !== "custom") setDateDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      dateRange === value
                        ? "text-[#FF6633] font-semibold bg-[#FFF3EF]"
                        : "text-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {dateRange === "custom" ? (
                  <div className="px-3 py-2 border-t border-gray-100 space-y-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">From</label>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="mt-0.5 w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">To</label>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="mt-0.5 w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setDateDropdownOpen(false)}
                      className="w-full py-1.5 text-sm font-semibold text-[#FF6633] hover:bg-orange-50 rounded-md"
                    >
                      Apply
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Project */}
          <div className="relative">
            <FolderOpen className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={`pl-9 pr-8 py-2 border rounded-lg text-sm font-medium bg-white shadow-sm appearance-none min-w-[10rem] ${
                projectFilter !== "All Projects"
                  ? "border-[#FF6633] text-[#FF6633] bg-[#FFF3EF]"
                  : "border-gray-200 text-gray-700"
              }`}
            >
              <option value="All Projects">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Client */}
          <div className="relative">
            <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className={`pl-9 pr-8 py-2 border rounded-lg text-sm font-medium bg-white shadow-sm appearance-none min-w-[10rem] ${
                clientFilter !== "all"
                  ? "border-[#FF6633] text-[#FF6633] bg-[#FFF3EF]"
                  : "border-gray-200 text-gray-700"
              }`}
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`flex-1 overflow-y-auto p-6 space-y-4 transition-opacity duration-300 ease-out ${
          revalidating && visibleReports.length > 0 ? "opacity-[0.88]" : "opacity-100"
        }`}
      >
        {fetching && visibleReports.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-48 gap-3 text-gray-500">
            <Loader2 className="w-9 h-9 text-[#FF6633] animate-spin" aria-hidden />
            <p className="text-sm font-medium">Loading reports…</p>
          </div>
        ) : visibleReports.length === 0 ? (
          <div className="flex justify-center items-center h-48 text-gray-500">
            No reports match these filters
            {projectFilter && projectFilter !== "All Projects" ? ` for ${projectFilter}` : ""}.
          </div>
        ) : (
          visibleReports.map((report, idx) => (
            <div key={report.id} data-tour={idx === 0 ? "report-card-0" : undefined}>
              <ReportCard report={report} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
