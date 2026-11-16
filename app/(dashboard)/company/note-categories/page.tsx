"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Plus, StickyNote } from "lucide-react";
import { toast } from "sonner";

type Row = { id: string; name: string; sort_order: number };

export default function CompanyNoteCategoriesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company/note-categories", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      toast.error(e instanceof Error ? e.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addRow = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/company/note-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Add failed");
      setNewName("");
      await load();
      toast.success(`Added "${name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setSaving(false);
    }
  };

  const patchRow = async (id: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/company/note-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
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

  const deleteRow = async (id: string, name: string) => {
    if (!confirm(`Remove category "${name}"? Existing notes keep their saved category text.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/company/note-categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Delete failed");
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Category removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Note categories</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-[#FF6633]" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Custom categories</h2>
            <p className="text-xs text-gray-500">Add or rename as scope of work changes. Order is top-to-bottom.</p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">New category</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addRow()}
              placeholder="e.g. Staging Area, Wildlife, Access road…"
              disabled={saving}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/30"
            />
          </div>
          <button
            type="button"
            disabled={saving || !newName.trim()}
            onClick={() => void addRow()}
            className="p-2.5 rounded-lg bg-[#FF6633] text-white hover:bg-[#E55A2B] disabled:opacity-40 transition-colors"
            aria-label="Add category"
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
            No categories yet. Run migration <code className="text-xs">create_company_note_categories.sql</code> or add above.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-[auto_1fr_auto] gap-2 px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
              <span className="w-8 text-center">#</span>
              <span>Category name</span>
              <span className="w-10" />
            </div>
            {rows.map((row, idx) => (
              <div key={row.id} className="grid grid-cols-[auto_1fr_auto] gap-2 px-4 py-2.5 items-center hover:bg-gray-50/80">
                <span className="w-8 text-center text-xs text-gray-400 font-medium">{idx + 1}</span>
                <input
                  defaultValue={row.name}
                  key={`${row.id}-${row.name}`}
                  disabled={saving}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== row.name) void patchRow(row.id, v);
                  }}
                  className="rounded border border-transparent hover:border-gray-200 focus:border-[#FF6633] focus:ring-1 focus:ring-[#FF6633] px-2 py-1.5 text-sm font-medium"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void deleteRow(row.id, row.name)}
                  className="text-gray-300 hover:text-red-600 p-2 justify-self-end"
                  aria-label="Delete category"
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
