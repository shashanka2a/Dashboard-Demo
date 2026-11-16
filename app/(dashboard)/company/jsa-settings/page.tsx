"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Plus, Shield, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

type Row = { id: string; name: string; sort_order: number };

function ConfigList({
  title,
  description,
  icon: Icon,
  rows,
  loading,
  saving,
  newName,
  onNewNameChange,
  onAdd,
  onPatch,
  onDelete,
  placeholder,
}: {
  title: string;
  description: string;
  icon: typeof Shield;
  rows: Row[];
  loading: boolean;
  saving: boolean;
  newName: string;
  onNewNameChange: (v: string) => void;
  onAdd: () => void;
  onPatch: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  placeholder: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2">
        <Icon className="w-5 h-5 text-[#FF6633]" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-gray-100 flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Add item</label>
          <input
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void onAdd()}
            placeholder={placeholder}
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/30"
          />
        </div>
        <button
          type="button"
          disabled={saving || !newName.trim()}
          onClick={() => void onAdd()}
          className="p-2.5 rounded-lg bg-[#FF6633] text-white hover:bg-[#E55A2B] disabled:opacity-40 transition-colors"
          aria-label="Add item"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">No items yet. Add one above.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          <div className="grid grid-cols-[auto_1fr_auto] gap-2 px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            <span className="w-8 text-center">#</span>
            <span>Name</span>
            <span className="w-10" />
          </div>
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="grid grid-cols-[auto_1fr_auto] gap-2 px-4 py-2.5 items-center hover:bg-gray-50/80"
            >
              <span className="w-8 text-center text-xs text-gray-400 font-medium">{idx + 1}</span>
              <input
                defaultValue={row.name}
                key={`${row.id}-${row.name}`}
                disabled={saving}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== row.name) onPatch(row.id, v);
                }}
                className="rounded border border-transparent hover:border-gray-200 focus:border-[#FF6633] focus:ring-1 focus:ring-[#FF6633] px-2 py-1.5 text-sm font-medium"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => onDelete(row.id, row.name)}
                className="text-gray-300 hover:text-red-600 p-2 justify-self-end"
                aria-label="Delete item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompanyJsaSettingsPage() {
  const [objectives, setObjectives] = useState<Row[]>([]);
  const [checks, setChecks] = useState<Row[]>([]);
  const [loadingObj, setLoadingObj] = useState(true);
  const [loadingChecks, setLoadingChecks] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newObjective, setNewObjective] = useState("");
  const [newCheck, setNewCheck] = useState("");

  const loadObjectives = useCallback(async () => {
    setLoadingObj(true);
    try {
      const res = await fetch("/api/company/jsa-objectives", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load objectives");
      setObjectives(Array.isArray(data) ? data : []);
    } catch (e) {
      setObjectives([]);
      toast.error(e instanceof Error ? e.message : "Failed to load objectives");
    } finally {
      setLoadingObj(false);
    }
  }, []);

  const loadChecks = useCallback(async () => {
    setLoadingChecks(true);
    try {
      const res = await fetch("/api/company/jsa-project-checks", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load checks");
      setChecks(Array.isArray(data) ? data : []);
    } catch (e) {
      setChecks([]);
      toast.error(e instanceof Error ? e.message : "Failed to load checks");
    } finally {
      setLoadingChecks(false);
    }
  }, []);

  useEffect(() => {
    void loadObjectives();
    void loadChecks();
  }, [loadObjectives, loadChecks]);

  const addObjective = async () => {
    const name = newObjective.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/company/jsa-objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Add failed");
      setNewObjective("");
      await loadObjectives();
      toast.success(`Added "${name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setSaving(false);
    }
  };

  const addCheck = async () => {
    const name = newCheck.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/company/jsa-project-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Add failed");
      setNewCheck("");
      await loadChecks();
      toast.success(`Added "${name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setSaving(false);
    }
  };

  const patchObjective = async (id: string, name: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/company/jsa-objectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Update failed");
      setObjectives((prev) => prev.map((r) => (r.id === id ? data : r)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      await loadObjectives();
    } finally {
      setSaving(false);
    }
  };

  const patchCheck = async (id: string, name: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/company/jsa-project-checks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Update failed");
      setChecks((prev) => prev.map((r) => (r.id === id ? data : r)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      await loadChecks();
    } finally {
      setSaving(false);
    }
  };

  const deleteObjective = async (id: string, name: string) => {
    if (!confirm(`Remove objective "${name}"? Existing JSA forms keep their saved selections.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/company/jsa-objectives/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Delete failed");
      }
      setObjectives((prev) => prev.filter((r) => r.id !== id));
      toast.success("Objective removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteCheck = async (id: string, name: string) => {
    if (!confirm(`Remove check "${name}"? Existing JSA forms keep their saved selections.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/company/jsa-project-checks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Delete failed");
      }
      setChecks((prev) => prev.filter((r) => r.id !== id));
      toast.success("Check removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">JSA form settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the selectable options shown in Section 1 (Today&apos;s Objective) and Section 3 (Project Checks) on
          the JSA &amp; Pre-Brief form.
        </p>
      </div>

      <ConfigList
        title="Today's Objective"
        description="Shown in Section 1 of the JSA form. Crew selects which apply for the day."
        icon={Shield}
        rows={objectives}
        loading={loadingObj}
        saving={saving}
        newName={newObjective}
        onNewNameChange={setNewObjective}
        onAdd={addObjective}
        onPatch={patchObjective}
        onDelete={deleteObjective}
        placeholder="e.g. Wicking, Spraying, Mowing…"
      />

      <ConfigList
        title="Project Checks"
        description="Shown in Section 3 (Equipment & Chemical Checks). Crew checks all completed today."
        icon={ClipboardCheck}
        rows={checks}
        loading={loadingChecks}
        saving={saving}
        newName={newCheck}
        onNewNameChange={setNewCheck}
        onAdd={addCheck}
        onPatch={patchCheck}
        onDelete={deleteCheck}
        placeholder="e.g. Pre-Start Inspections, No Spills…"
      />
    </div>
  );
}
