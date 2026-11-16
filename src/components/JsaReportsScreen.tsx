"use client";

import { useState, useLayoutEffect, useMemo, useEffect, useRef } from "react";
import { Calendar, Loader2, X } from "lucide-react";
import { JsaReportCard } from "./JsaReportCard";
import { useProject } from "@/context/ProjectContext";
import { readDashboardCache, writeDashboardCache } from "@/lib/dashboard-data-cache";
import type { JsaReportListItem } from "@/lib/jsa-types";

type DateRangePreset = "all" | "today" | "7d" | "30d" | "custom";

function jsaCacheKey(parts: { project: string; range: string; from: string; to: string }) {
  return `jsa:list:v1:${encodeURIComponent([parts.project, parts.range, parts.from, parts.to].join("|"))}`;
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

export function JsaReportsScreen({ initialReports }: { initialReports?: JsaReportListItem[] }) {
  const { selectedProject } = useProject();
  const [reports, setReports] = useState<JsaReportListItem[]>(initialReports ?? []);
  const [fetching, setFetching] = useState(() => !initialReports?.length);
  const [revalidating, setRevalidating] = useState(false);

  const [dateRange, setDateRange] = useState<DateRangePreset>("30d");
  const [customFrom, setCustomFrom] = useState(() => daysAgoYmd(30));
  const [customTo, setCustomTo] = useState(() => todayYmd());
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  const projectName =
    selectedProject && selectedProject !== "All Projects" ? selectedProject : "All Projects";

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filterParts = useMemo(() => {
    const from = dateRange === "custom" ? customFrom : "";
    const to = dateRange === "custom" ? customTo : "";
    return {
      project: projectName,
      range: dateRange,
      from,
      to,
    };
  }, [projectName, dateRange, customFrom, customTo]);

  const reportsUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("type", "jsa");
    if (filterParts.project && filterParts.project !== "All Projects") {
      params.set("project", filterParts.project);
    }
    if (filterParts.range === "custom") {
      if (filterParts.from) params.set("from", filterParts.from);
      if (filterParts.to) params.set("to", filterParts.to);
    } else if (filterParts.range !== "all") {
      params.set("range", filterParts.range);
    }
    return `/api/reports?${params.toString()}`;
  }, [filterParts]);

  const cacheKey = useMemo(() => jsaCacheKey(filterParts), [filterParts]);

  useLayoutEffect(() => {
    const cached = readDashboardCache<JsaReportListItem[]>(cacheKey);
    const hasCache = cached != null && Array.isArray(cached);
    if (hasCache) {
      setReports(cached);
      setFetching(false);
    }

    const ac = new AbortController();
    const silent = hasCache;
    if (!silent) setFetching(true);
    setRevalidating(true);

    (async () => {
      try {
        const res = await fetch(reportsUrl, { cache: "no-store", signal: ac.signal });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (!res.ok) {
          console.error("JSA reports API error:", data?.error || res.status);
          if (!silent) setReports([]);
          return;
        }
        const list = Array.isArray(data) ? data : [];
        setReports(list);
        writeDashboardCache(cacheKey, list);
      } catch (error) {
        if (ac.signal.aborted) return;
        if (!silent) {
          console.error("Error fetching JSA reports:", error);
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
  }, [cacheKey, reportsUrl]);

  const showBusy = fetching || revalidating;
  const hasActiveFilters = dateRange !== "all";

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
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="relative bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 transition-shadow duration-200">
        {showBusy && (
          <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden bg-gray-100" aria-hidden>
            <div className="h-full w-1/3 rounded-full bg-[#FF6633] animate-reports-bar opacity-90" />
          </div>
        )}
        <div data-tour="jsa-header" className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">JSA &amp; Pre-Brief</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Job Safety Analysis forms
              {projectName !== "All Projects" ? ` for ${projectName}` : ""}
              {reports.length > 0 ? ` · ${reports.length} form${reports.length === 1 ? "" : "s"}` : ""}
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
          revalidating && reports.length > 0 ? "opacity-[0.88]" : "opacity-100"
        }`}
      >
        {fetching && reports.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-48 gap-3 text-gray-500">
            <Loader2 className="w-9 h-9 text-[#FF6633] animate-spin" aria-hidden />
            <p className="text-sm font-medium">Loading JSA forms…</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex justify-center items-center h-48 text-gray-500">
            No JSA forms match these filters
            {projectName !== "All Projects" ? ` for ${projectName}` : ""}.
          </div>
        ) : (
          reports.map((report, idx) => (
            <div key={report.id} data-tour={idx === 0 ? "jsa-card-0" : undefined}>
              <JsaReportCard report={report} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
