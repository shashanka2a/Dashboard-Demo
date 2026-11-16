"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  Save,
  Search,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import NextImage from "next/image";
import { toast } from "sonner";
import { isIncidentClosedStatus, isIncidentOpenStatus } from "@/lib/incident-status";
import {
  formatEmployeeDate,
  incidentEmployeeInfoIncomplete,
  injuredEmployeeDisplayName,
  normalizeInjuredEmployeeForSave,
  parseInjuredEmployeeInfo,
  type InjuredEmployeeInfo,
} from "@/lib/incident-employee-info";
import { formatHmAmInTimeZone } from "@/lib/activity-display-timezone";
import {
  filterProjectNamesForMainDashboard,
  filterRowsByProjectNameForMainDashboard,
  isExcludedFromMainDashboard,
} from "@/lib/activity-excluded-projects";
import { ImageViewer } from "./ImageViewer";

type IncidentRow = {
  id: string;
  title?: string;
  status?: string;
  recordable?: boolean;
  incident_date?: string;
  display_date?: string;
  location?: string;
  description?: string;
  injury_illness_type?: string;
  injured_names?: string[];
  injured_employee_info?: unknown;
  employee_info_incomplete?: boolean;
  project_name?: string;
  logged_at?: string;
  photos?: string[];
};

type StatusTab = "open" | "closed" | "all";

function formatIncidentDate(value?: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

function InjuredEmployeeEditor({
  incidentId,
  initial,
  onSaved,
}: {
  incidentId: string;
  initial: InjuredEmployeeInfo[];
  onSaved: (next: InjuredEmployeeInfo[], incomplete: boolean) => void;
}) {
  const [drafts, setDrafts] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDrafts(initial);
  }, [incidentId]);

  const updateRow = (index: number, patch: Partial<InjuredEmployeeInfo>) => {
    setDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    setSaving(true);
    const payload = drafts.map(normalizeInjuredEmployeeForSave);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ injured_employee_info: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      const saved = parseInjuredEmployeeInfo(data.injured_employee_info);
      setDrafts(saved);
      onSaved(saved, !!data.employee_info_incomplete);
      toast.success("Employee details updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (drafts.length === 0) {
    return <p className="text-sm text-gray-500">None listed</p>;
  }

  return (
    <div className="space-y-4">
      {drafts.map((emp, index) => (
        <div key={`${incidentId}-${index}`} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">{injuredEmployeeDisplayName(emp)}</p>
          {(emp.jobTitle || emp.gender) && (
            <p className="text-xs text-gray-500">
              {[emp.jobTitle, emp.gender].filter(Boolean).join(" · ")}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Date of birth
              </label>
              <input
                type="date"
                disabled={!!emp.dateOfBirthUnknown || saving}
                value={emp.dateOfBirthUnknown ? "" : emp.dateOfBirth || ""}
                onChange={(e) => updateRow(index, { dateOfBirth: e.target.value, dateOfBirthUnknown: false })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400"
              />
              <label className="mt-2 inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!emp.dateOfBirthUnknown}
                  disabled={saving}
                  onChange={(e) =>
                    updateRow(index, {
                      dateOfBirthUnknown: e.target.checked,
                      dateOfBirth: e.target.checked ? "" : emp.dateOfBirth,
                    })
                  }
                  className="rounded border-gray-300 text-[#FF6633] focus:ring-[#FF6633]"
                />
                <span className="text-sm text-gray-700">Unknown</span>
              </label>
              {emp.dateOfBirthUnknown && (
                <p className="text-xs text-amber-700 mt-1">Flagged — complete when known</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Hire date
              </label>
              <input
                type="date"
                disabled={!!emp.dateOfHireUnknown || saving}
                value={emp.dateOfHireUnknown ? "" : emp.dateOfHire || ""}
                onChange={(e) => updateRow(index, { dateOfHire: e.target.value, dateOfHireUnknown: false })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-400"
              />
              <label className="mt-2 inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!emp.dateOfHireUnknown}
                  disabled={saving}
                  onChange={(e) =>
                    updateRow(index, {
                      dateOfHireUnknown: e.target.checked,
                      dateOfHire: e.target.checked ? "" : emp.dateOfHire,
                    })
                  }
                  className="rounded border-gray-300 text-[#FF6633] focus:ring-[#FF6633]"
                />
                <span className="text-sm text-gray-700">Unknown</span>
              </label>
              {emp.dateOfHireUnknown && (
                <p className="text-xs text-amber-700 mt-1">Flagged — complete when known</p>
              )}
            </div>
          </div>

          {!emp.dateOfBirthUnknown && !emp.dateOfHireUnknown && (emp.dateOfBirth || emp.dateOfHire) && (
            <p className="text-xs text-gray-500">
              DOB {formatEmployeeDate(emp.dateOfBirth)} · Hire {formatEmployeeDate(emp.dateOfHire)}
            </p>
          )}
        </div>
      ))}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save employee details
      </button>
    </div>
  );
}

export function IncidentsScreen({
  excludeTestProjects = false,
}: {
  /** Hide test projects on the global dashboard (/incidents), not per-project views. */
  excludeTestProjects?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>("open");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All Projects");
  const [needsInfoOnly, setNeedsInfoOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ isOpen: boolean; index: number; photos: string[] }>({
    isOpen: false,
    index: 0,
    photos: [],
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ status: "all" });
    if (projectFilter !== "All Projects") params.set("project", projectFilter);
    fetch(`/api/incidents?${params.toString()}`, { cache: "no-store" })
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
      if (statusTab === "open" && !isIncidentOpenStatus(r.status)) return false;
      if (statusTab === "closed" && !isIncidentClosedStatus(r.status)) return false;
      if (needsInfoOnly && !r.employee_info_incomplete) return false;
      if (!q) return true;
      const hay = [
        r.title,
        r.description,
        r.location,
        r.injury_illness_type,
        r.project_name,
        r.display_date,
        r.incident_date,
        ...(r.injured_names || []),
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [rows, statusTab, search, needsInfoOnly]);

  const counts = useMemo(
    () => ({
      open: rows.filter((r) => isIncidentOpenStatus(r.status)).length,
      closed: rows.filter((r) => isIncidentClosedStatus(r.status)).length,
      all: rows.length,
      needsInfo: rows.filter((r) => r.employee_info_incomplete).length,
    }),
    [rows]
  );

  const handleEmployeeSaved = (incidentId: string, saved: InjuredEmployeeInfo[], incomplete: boolean) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === incidentId
          ? {
              ...r,
              injured_employee_info: saved,
              employee_info_incomplete: incomplete,
              injured_names: saved.map(injuredEmployeeDisplayName).filter(Boolean),
            }
          : r
      )
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-8 py-6 bg-white border-b border-gray-200 flex-shrink-0">
        <div data-tour="incidents-header" className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
            <p className="text-sm text-gray-500 mt-1">
              All projects · sorted by incident date · {counts.open} open · {counts.closed} closed
              {counts.needsInfo > 0 ? (
                <span className="text-amber-700"> · {counts.needsInfo} need employee dates</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "open" as const, label: "Open", count: counts.open },
                { id: "closed" as const, label: "Closed", count: counts.closed },
                { id: "all" as const, label: "All", count: counts.all },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  statusTab === tab.id
                    ? tab.id === "open"
                      ? "bg-orange-50 text-orange-800 border-orange-200"
                      : tab.id === "closed"
                        ? "bg-gray-100 text-gray-800 border-gray-300"
                        : "bg-[#2196F3]/10 text-[#1565C0] border-[#2196F3]/30"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {tab.label}
                <span className="ml-2 text-xs font-bold opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, project, location, person…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/30"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white min-w-[180px]"
          >
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={needsInfoOnly}
              onChange={(e) => setNeedsInfoOnly(e.target.checked)}
              className="rounded border-gray-300 text-[#FF6633] focus:ring-[#FF6633]"
            />
            <span className="text-gray-700">Needs employee dates</span>
            {counts.needsInfo > 0 ? (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{counts.needsInfo}</span>
            ) : null}
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
            <AlertTriangle className="w-12 h-12 text-gray-200 mb-3" />
            <p className="font-medium text-gray-600">No {statusTab === "all" ? "" : `${statusTab} `}incidents found</p>
            <p className="text-sm mt-1 max-w-sm">
              {search || needsInfoOnly
                ? "Try a different search term or clear filters."
                : "Incidents from every project appear here by incident date — no project date picker needed."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Incident
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Incident date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inc, idx) => {
                  const isOpen = isIncidentOpenStatus(inc.status);
                  const expanded = expandedId === inc.id;
                  const dateLabel = inc.display_date || inc.incident_date;
                  const employees = parseInjuredEmployeeInfo(inc.injured_employee_info);
                  const needsInfo =
                    inc.employee_info_incomplete ?? incidentEmployeeInfoIncomplete(inc.injured_employee_info);
                  return (
                    <Fragment key={inc.id}>
                      <tr
                        data-tour={idx === 0 ? "incident-card-0" : undefined}
                        className="border-b border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                        onClick={() => setExpandedId(expanded ? null : inc.id)}
                      >
                        <td className="px-4 py-4 text-gray-400">
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            data-tour={idx === 0 ? "incident-status-control" : undefined}
                            className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              isOpen
                                ? "bg-orange-50 text-orange-800 border-orange-200"
                                : "bg-gray-100 text-gray-700 border-gray-200"
                            }`}
                          >
                            {inc.status || "Open"}
                          </span>
                          {inc.recordable ? (
                            <span className="ml-2 inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-100">
                              Recordable
                            </span>
                          ) : null}
                          {needsInfo ? (
                            <span className="ml-2 inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                              Needs dates
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-gray-900">{inc.title || "Incident report"}</p>
                          {inc.logged_at ? (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Logged {formatHmAmInTimeZone(String(inc.logged_at))}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">{inc.project_name || "—"}</td>
                        <td className="px-4 py-4 text-sm text-gray-900 font-medium whitespace-nowrap">
                          {formatIncidentDate(dateLabel)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 max-w-[180px] truncate">
                          {inc.location || "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{inc.injury_illness_type || "—"}</td>
                      </tr>
                      {expanded ? (
                        <tr key={`${inc.id}-detail`} className="bg-red-50/30 border-b border-gray-100">
                          <td colSpan={7} className="px-6 py-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                                  Description
                                </p>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{inc.description || "—"}</p>
                                {inc.location ? (
                                  <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {inc.location}
                                  </p>
                                ) : null}
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                                  Affected individuals
                                </p>
                                {needsInfo ? (
                                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    DOB or hire date was marked unknown in the field. Enter dates below when available.
                                  </p>
                                ) : employees.length > 0 ? (
                                  <p className="text-xs text-green-700 flex items-center gap-1 mb-3">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Employee dates complete
                                  </p>
                                ) : null}
                                <InjuredEmployeeEditor
                                  incidentId={inc.id}
                                  initial={employees}
                                  onSaved={(saved, incomplete) => handleEmployeeSaved(inc.id, saved, incomplete)}
                                />
                              </div>
                            </div>
                            {inc.photos && inc.photos.length > 0 ? (
                              <div className="mt-5 pt-4 border-t border-red-100">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                                  Photos
                                </p>
                                <div className="flex flex-wrap gap-3">
                                  {inc.photos.map((url, pi) => (
                                    <button
                                      key={pi}
                                      type="button"
                                      className="w-20 h-20 relative rounded-lg overflow-hidden border border-gray-200"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewer({ isOpen: true, index: pi, photos: inc.photos || [] });
                                      }}
                                    >
                                      <NextImage src={url} alt={`Incident photo ${pi + 1}`} fill className="object-cover" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ImageViewer
        isOpen={viewer.isOpen}
        photos={viewer.photos}
        initialIndex={viewer.index}
        onClose={() => setViewer({ isOpen: false, index: 0, photos: [] })}
      />
    </div>
  );
}
