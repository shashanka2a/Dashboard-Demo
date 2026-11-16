"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, MapPin, Search } from "lucide-react";
import NextImage from "next/image";
import { toast } from "sonner";
import { formatHmAmInTimeZone } from "@/lib/activity-display-timezone";
import { resolveObservationDescription } from "@/lib/observation-fields";
import {
  filterProjectNamesForMainDashboard,
  filterRowsByProjectNameForMainDashboard,
  isExcludedFromMainDashboard,
} from "@/lib/activity-excluded-projects";
import { ImageViewer } from "./ImageViewer";

type ObservationRow = {
  id: string;
  title?: string;
  type?: string;
  status?: string;
  progress?: string;
  description?: string;
  description_tags?: string[];
  location?: string;
  gps_lat?: number | null;
  gps_lng?: number | null;
  project_name?: string;
  logged_at?: string;
  attachments?: string[];
  resolution_photos?: string[];
};

type StatusTab = "open" | "resolved" | "all";

export function ObservationsScreen({
  excludeTestProjects = false,
}: {
  /** Hide test projects on the global dashboard (/observations), not per-project views. */
  excludeTestProjects?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ObservationRow[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>("open");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All Projects");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ isOpen: boolean; index: number; photos: string[] }>({
    isOpen: false,
    index: 0,
    photos: [],
  });

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ status: "all" });
    if (projectFilter !== "All Projects") params.set("project", projectFilter);
    fetch(`/api/observations?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ status: "all" });
    if (projectFilter !== "All Projects") params.set("project", projectFilter);
    fetch(`/api/observations?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          const list = Array.isArray(d) ? d : [];
          setRows(excludeTestProjects ? filterRowsByProjectNameForMainDashboard(list) : list);
        }
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectFilter, excludeTestProjects]);

  useEffect(() => {
    if (excludeTestProjects && isExcludedFromMainDashboard(projectFilter)) {
      setProjectFilter("All Projects");
    }
  }, [excludeTestProjects, projectFilter]);

  const projects = useMemo(() => {
    const names = [...new Set(rows.map((r) => r.project_name).filter(Boolean))] as string[];
    const visible = excludeTestProjects ? filterProjectNamesForMainDashboard(names) : names;
    visible.sort((a, b) => a.localeCompare(b));
    return ["All Projects", ...visible];
  }, [rows, excludeTestProjects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const status = String(r.status || "");
      if (statusTab === "open" && status !== "Open") return false;
      if (statusTab === "resolved" && status !== "Resolved") return false;
      if (!q) return true;
      const hay = [
        r.title,
        r.type,
        r.description,
        r.location,
        r.progress,
        r.project_name,
        ...(Array.isArray(r.description_tags) ? r.description_tags : []),
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [rows, statusTab, search]);

  const counts = useMemo(
    () => ({
      open: rows.filter((r) => r.status === "Open").length,
      resolved: rows.filter((r) => r.status === "Resolved").length,
      all: rows.length,
    }),
    [rows]
  );

  const markResolved = async (id: string) => {
    setResolvingId(id);
    const prev = rows;
    setRows((cur) =>
      statusTab === "open"
        ? cur.filter((r) => r.id !== id)
        : cur.map((r) => (r.id === id ? { ...r, status: "Resolved" } : r))
    );
    try {
      const res = await fetch("/api/observations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "Resolved" }),
      });
      if (!res.ok) {
        setRows(prev);
        toast.error("Could not mark as resolved");
        return;
      }
      toast.success("Marked resolved");
      if (statusTab !== "open") load();
    } catch {
      setRows(prev);
      toast.error("Could not mark as resolved");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-8 py-6 bg-white border-b border-gray-200 flex-shrink-0">
        <div data-tour="observations-header" className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Observations</h1>
            <p className="text-sm text-gray-500 mt-1">
              All projects · {counts.open} open · {counts.resolved} resolved
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search observations…"
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-56 bg-white"
              />
            </div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {(
            [
              ["open", "Open", counts.open],
              ["resolved", "Resolved", counts.resolved],
              ["all", "All", counts.all],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusTab(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusTab === key
                  ? "bg-[#FF6633] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <Eye className="w-10 h-10 text-gray-200" />
            <p className="text-sm font-medium">No observations found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((obs, idx) => {
              const description = resolveObservationDescription({
                description: obs.description,
                description_tags: obs.description_tags,
              });
              const photos = [
                ...(Array.isArray(obs.attachments) ? obs.attachments : []),
                ...(Array.isArray(obs.resolution_photos) ? obs.resolution_photos : []),
              ].filter(Boolean);
              const isOpen = obs.status === "Open";

              return (
                <div
                  key={obs.id}
                  data-tour={idx === 0 ? "observation-card-0" : undefined}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                >
                  <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {obs.title || obs.type || "Observation"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {obs.project_name || "Unknown project"}
                        {obs.type ? ` · ${obs.type}` : ""}
                        {obs.logged_at ? ` · ${formatHmAmInTimeZone(String(obs.logged_at))}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {obs.progress ? (
                        <span className="px-2.5 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                          {obs.progress}
                        </span>
                      ) : null}
                      <span
                        className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${
                          isOpen
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-green-200 bg-green-50 text-green-700"
                        }`}
                      >
                        {obs.status || "Open"}
                      </span>
                      {isOpen ? (
                        <button
                          type="button"
                          disabled={resolvingId === obs.id}
                          onClick={() => void markResolved(obs.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#FF6633] text-white text-[11px] font-semibold hover:bg-[#E55A2B] disabled:opacity-60"
                        >
                          {resolvingId === obs.id ? "Saving…" : "Mark resolved"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                        Description
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {description || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                        Location
                      </p>
                      <p className="text-sm text-gray-800 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span>{obs.location || "—"}</span>
                      </p>
                      {obs.gps_lat != null && obs.gps_lng != null ? (
                        <p className="text-xs text-gray-500 mt-1 ml-5">
                          GPS {Number(obs.gps_lat).toFixed(5)}, {Number(obs.gps_lng).toFixed(5)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {photos.length > 0 ? (
                    <div className="px-5 pb-4">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                        Photos
                      </p>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {photos.map((url, i) => (
                          <button
                            key={`${obs.id}-${i}`}
                            type="button"
                            className="aspect-square relative rounded-lg overflow-hidden border border-gray-100"
                            onClick={() => setViewer({ isOpen: true, index: i, photos })}
                          >
                            <NextImage src={url} alt={`Photo ${i + 1}`} fill className="object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ImageViewer
        isOpen={viewer.isOpen}
        photos={viewer.photos}
        initialIndex={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, isOpen: false }))}
      />
    </div>
  );
}
