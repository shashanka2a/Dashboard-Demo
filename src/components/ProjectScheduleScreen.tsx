"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/context/ProjectContext";
import type { ClientPortalAdminSettings } from "@/lib/client-portal";
import {
  readDashboardCache,
  writeDashboardCache,
  PROJECTS_RAW_CACHE_KEY,
} from "@/lib/dashboard-data-cache";

type ScheduleForm = {
  last_wicking_date: string;
  last_spraying_date: string;
  last_mowing_date: string;
  next_wicking_date: string;
  next_spraying_date: string;
  next_mowing_date: string;
};

const emptyForm: ScheduleForm = {
  last_wicking_date: "",
  last_spraying_date: "",
  last_mowing_date: "",
  next_wicking_date: "",
  next_spraying_date: "",
  next_mowing_date: "",
};

export function ProjectScheduleScreen() {
  const { selectedProject } = useProject();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const resolveProjectId = useCallback(async (): Promise<string | null> => {
    if (!selectedProject || selectedProject === "All Projects") return null;
    const raw = readDashboardCache<{ id: string; name: string }[]>(PROJECTS_RAW_CACHE_KEY);
    const cached = raw?.find((p) => p.name === selectedProject);
    if (cached?.id) return cached.id;

    const res = await fetch("/api/projects", { cache: "no-store" });
    const list = await res.json();
    if (!Array.isArray(list)) return null;
    writeDashboardCache(PROJECTS_RAW_CACHE_KEY, list);
    const found = list.find((p: { name: string }) => p.name === selectedProject);
    return found?.id ? String(found.id) : null;
  }, [selectedProject]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const id = await resolveProjectId();
      setProjectId(id);
      if (!id) {
        setForm(emptyForm);
        return;
      }
      const res = await fetch(`/api/projects/${id}/client-portal`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load schedule");
      const data = json as ClientPortalAdminSettings;
      setForm({
        last_wicking_date: data.last_wicking_date || "",
        last_spraying_date: data.last_spraying_date || "",
        last_mowing_date: data.last_mowing_date || "",
        next_wicking_date: data.next_wicking_date || "",
        next_spraying_date: data.next_spraying_date || "",
        next_mowing_date: data.next_mowing_date || "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load schedule");
      setForm(emptyForm);
    } finally {
      setLoading(false);
    }
  }, [resolveProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setF = <K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/client-portal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          next_wicking_date: form.next_wicking_date || null,
          next_spraying_date: form.next_spraying_date || null,
          next_mowing_date: form.next_mowing_date || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Save failed");
      const data = json as ClientPortalAdminSettings;
      setForm({
        last_wicking_date: data.last_wicking_date || "",
        last_spraying_date: data.last_spraying_date || "",
        last_mowing_date: data.last_mowing_date || "",
        next_wicking_date: data.next_wicking_date || "",
        next_spraying_date: data.next_spraying_date || "",
        next_mowing_date: data.next_mowing_date || "",
      });
      toast.success("Schedule saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!selectedProject || selectedProject === "All Projects") {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Select a project to edit its schedule.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
      <div className="px-8 py-6 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6633]/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-[#FF6633]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Maintenance dates shown on the client portal
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving || loading || !projectId}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF6633] text-white text-sm font-semibold hover:bg-[#E55A2B] disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Save schedule
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Maintenance &amp; schedule</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Last wicking, spraying and mowing are filled from the latest field entries for
                  this project.
                </p>
              </div>
              <div className="px-6 py-5 space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-3">
                    Last completed
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Last Wicking
                      </label>
                      <input
                        type="date"
                        readOnly
                        value={form.last_wicking_date}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-default"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">From latest wicking log</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Last Spraying
                      </label>
                      <input
                        type="date"
                        readOnly
                        value={form.last_spraying_date}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-default"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">From latest spraying log</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Last Mowing
                      </label>
                      <input
                        type="date"
                        readOnly
                        value={form.last_mowing_date}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-default"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">From latest mowing acres log</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-3">
                    Upcoming
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Next Wicking
                      </label>
                      <input
                        type="date"
                        value={form.next_wicking_date}
                        onChange={(e) => setF("next_wicking_date", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Next Spraying
                      </label>
                      <input
                        type="date"
                        value={form.next_spraying_date}
                        onChange={(e) => setF("next_spraying_date", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Next Mowing
                      </label>
                      <input
                        type="date"
                        value={form.next_mowing_date}
                        onChange={(e) => setF("next_mowing_date", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
