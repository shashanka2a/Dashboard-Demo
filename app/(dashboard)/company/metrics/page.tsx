"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  key: string;
  label: string;
  unit: string;
  sort_order: number;
  is_active: boolean;
};

export default function CompanyMetricFieldsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newUnit, setNewUnit] = useState("acres");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company/metric-fields", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      toast.error(e instanceof Error ? e.message : "Failed to load metric fields");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addRow = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setSaving(true);
    try {
      const res = await fetch("/api/company/metric-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, unit: newUnit.trim() || "acres" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Add failed");
      setNewLabel("");
      setNewUnit("acres");
      await load();
      toast.success(`Added "${label}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setSaving(false);
    }
  };

  const patchRow = async (id: string, patch: Partial<Pick<Row, "label" | "unit" | "is_active" | "sort_order">>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/company/metric-fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Update failed");
      setRows((prev) => prev.map((r) => (r.id === id ? data : r)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const moveRow = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= rows.length) return;
    const a = rows[index];
    const b = rows[next];
    setSaving(true);
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/company/metric-fields/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: b.sort_order }),
        }),
        fetch(`/api/company/metric-fields/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: a.sort_order }),
        }),
      ]);
      if (!resA.ok || !resB.ok) throw new Error("Reorder failed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reorder failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (id: string, label: string) => {
    if (
      !confirm(
        `Remove metric "${label}"? Past logs keep any values already saved under this field key.`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/company/metric-fields/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Delete failed");
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Metric removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Custom metrics</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Define the acreage and other fields shown in the field app metrics form. Defaults cover Wicking /
          Mowing array and green space. Add more anytime — order is top-to-bottom in the form.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2">
          <Ruler className="w-5 h-5 text-[#FF6633]" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Metric fields</h2>
            <p className="text-xs text-gray-500">
              Labels and units are editable. Deactivating hides a field from the field app without deleting past logs.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">New metric</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addRow()}
              placeholder="e.g. Spraying Array Completed"
              disabled={saving}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/30"
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Unit</label>
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addRow()}
              placeholder="acres"
              disabled={saving}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/30"
            />
          </div>
          <button
            type="button"
            disabled={saving || !newLabel.trim()}
            onClick={() => void addRow()}
            className="p-2.5 rounded-lg bg-[#FF6633] text-white hover:bg-[#E55A2B] disabled:opacity-40 transition-colors self-end"
            aria-label="Add metric"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No metric fields yet. Run migration{" "}
            <code className="text-xs">create_company_metric_fields.sql</code> or add above.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-[auto_1fr_6rem_auto_auto] gap-2 px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wide items-center">
              <span className="w-14 text-center">Order</span>
              <span>Label</span>
              <span>Unit</span>
              <span className="w-16 text-center">Active</span>
              <span className="w-10" />
            </div>
            {rows.map((row, idx) => (
              <div
                key={row.id}
                className={`grid grid-cols-[auto_1fr_6rem_auto_auto] gap-2 px-4 py-2.5 items-center hover:bg-gray-50/80 ${
                  row.is_active ? "" : "opacity-55"
                }`}
              >
                <div className="w-14 flex items-center justify-center gap-0.5">
                  <button
                    type="button"
                    disabled={saving || idx === 0}
                    onClick={() => void moveRow(idx, -1)}
                    className="p-1 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={saving || idx === rows.length - 1}
                    onClick={() => void moveRow(idx, 1)}
                    className="p-1 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="min-w-0">
                  <input
                    defaultValue={row.label}
                    key={`${row.id}-label-${row.label}`}
                    disabled={saving}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== row.label) void patchRow(row.id, { label: v });
                    }}
                    className="w-full rounded border border-transparent hover:border-gray-200 focus:border-[#FF6633] focus:ring-1 focus:ring-[#FF6633] px-2 py-1.5 text-sm font-medium"
                  />
                </div>
                <input
                  defaultValue={row.unit}
                  key={`${row.id}-unit-${row.unit}`}
                  disabled={saving}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== row.unit) void patchRow(row.id, { unit: v });
                  }}
                  className="w-full rounded border border-transparent hover:border-gray-200 focus:border-[#FF6633] focus:ring-1 focus:ring-[#FF6633] px-2 py-1.5 text-sm"
                />
                <label className="w-16 flex justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.is_active}
                    disabled={saving}
                    onChange={(e) => void patchRow(row.id, { is_active: e.target.checked })}
                    className="rounded border-gray-300 text-[#FF6633] focus:ring-[#FF6633]"
                  />
                </label>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void deleteRow(row.id, row.label)}
                  className="text-gray-300 hover:text-red-600 p-2 justify-self-end"
                  aria-label="Delete metric"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
