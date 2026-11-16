"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Briefcase,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

type ClientRow = {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  status: string;
  project_ids: string[];
  project_names: string[];
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

type ProjectOption = {
  id: string;
  name: string;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  job_number?: string | null;
  end_date?: string | null;
};

type FormData = {
  name: string;
  company_name: string;
  email: string;
  phone: string;
  title: string;
  notes: string;
  status: "active" | "inactive";
  project_ids: string[];
};

const emptyForm: FormData = {
  name: "",
  company_name: "",
  email: "",
  phone: "",
  title: "",
  notes: "",
  status: "active",
  project_ids: [],
};

function clientInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ClientsScreen() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [inviteLoadingId, setInviteLoadingId] = useState<string | null>(null);
  const [sendInviteOnCreate, setSendInviteOnCreate] = useState(true);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clientsRes, projectsRes] = await Promise.all([
        fetch("/api/clients", { cache: "no-store" }),
        fetch("/api/projects", { cache: "no-store" }),
      ]);
      const clientsData = await clientsRes.json();
      const projectsData = await projectsRes.json();
      if (!clientsRes.ok) throw new Error(clientsData?.error || "Failed to load clients");
      setRows(Array.isArray(clientsData) ? clientsData : []);
      setProjects(
        Array.isArray(projectsData)
          ? projectsData.map((p: ProjectOption) => ({
              id: p.id,
              name: p.name,
              street_address: p.street_address ?? null,
              city: p.city ?? null,
              state: p.state ?? null,
              zip_code: p.zip_code ?? null,
              job_number: p.job_number ?? null,
              end_date: p.end_date ?? null,
            }))
          : []
      );
    } catch (e) {
      setRows([]);
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSendInviteOnCreate(true);
    setModalOpen(true);
  };

  const openEdit = (row: ClientRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      company_name: row.company_name || "",
      email: row.email || "",
      phone: row.phone || "",
      title: row.title || "",
      notes: row.notes || "",
      status: row.status === "inactive" ? "inactive" : "active",
      project_ids: [...row.project_ids],
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Contact name is required.");
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/clients/${editingId}` : "/api/clients";
      const wantsInvite =
        !editingId &&
        sendInviteOnCreate &&
        Boolean(form.email?.trim()) &&
        form.status === "active";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          send_portal_invite: wantsInvite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");

      if (!editingId && data.invite) {
        const invite = data.invite as
          | { sent: true; flow: "invite" | "recovery" }
          | { sent: false; error: string };
        if (invite.sent) {
          toast.success(
            invite.flow === "recovery"
              ? "Client added. Password email sent (existing account)."
              : "Client added. Portal invite sent — they can set a password and sign in."
          );
        } else {
          toast.warning(`Client saved, but invite was not sent: ${invite.error}`);
        }
      } else {
        toast.success(editingId ? "Client updated" : "Client added");
      }

      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: ClientRow) => {
    setMenuOpenId(null);
    if (!confirm(`Remove client "${row.name}"? Portal access for assigned projects will be revoked.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      toast.success("Client removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: ClientRow) => {
    setMenuOpenId(null);
    const next = row.status === "active" ? "inactive" : "active";
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...row,
          status: next,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Update failed");
      toast.success(next === "active" ? "Client activated" : "Client deactivated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const sendPortalInvite = async (row: ClientRow) => {
    setMenuOpenId(null);
    if (!row.email?.trim()) {
      toast.error("Add an email address for this client first.");
      return;
    }
    if (row.status !== "active") {
      toast.error("Client must be active to receive a portal invite.");
      return;
    }
    setInviteLoadingId(row.id);
    try {
      const res = await fetch(`/api/clients/${row.id}/invite`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Invite failed");
      }
      const flow = data.flow as string | undefined;
      toast.success(
        flow === "recovery"
          ? "Password setup email sent (existing account)."
          : "Client portal invite email sent."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviteLoadingId(null);
    }
  };

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.name, r.company_name, r.email, r.phone, r.title, ...r.project_names]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const activeCount = filtered.filter((r) => r.status === "active").length;

  const setF = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleProject = (id: string) => {
    setForm((prev) => {
      const adding = !prev.project_ids.includes(id);
      const nextIds = adding
        ? [...prev.project_ids, id]
        : prev.project_ids.filter((x) => x !== id);
      return { ...prev, project_ids: nextIds };
    });
  };
  function ClientActionMenu({ row, align = "right" }: { row: ClientRow; align?: "right" | "card" }) {
    const open = menuOpenId === row.id;
    return (
      <div className="relative" ref={open ? menuRef : null}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpenId(open ? null : row.id);
          }}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6633]"
          aria-label="More options"
        >
          <MoreHorizontal className="w-4 h-4 text-gray-500" />
        </button>
        {open ? (
          <div
            className={`absolute ${align === "card" ? "right-0 top-7" : "right-0 top-8"} z-30 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[180px] py-1 overflow-hidden`}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpenId(null);
                openEdit(row);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={inviteLoadingId === row.id || !row.email?.trim()}
              title={!row.email?.trim() ? "Add an email address first" : undefined}
              onClick={() => void sendPortalInvite(row)}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              {inviteLoadingId === row.id ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Mail className="w-4 h-4 shrink-0 text-gray-500" />
              )}
              Send portal invite
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              type="button"
              onClick={() => void toggleStatus(row)}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {row.status === "active" ? "Make inactive" : "Make active"}
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              type="button"
              onClick={() => void remove(row)}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header — matches Directory */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex-shrink-0">
        <div data-tour="clients-header" className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-black">Clients</h1>
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-medium text-gray-700">{filtered.length}</span> client
              {filtered.length === 1 ? "" : "s"} &middot;{" "}
              <span className="font-medium text-[#4CAF50]">{activeCount} active</span>
              <span className="text-gray-400"> · portal access per assigned project</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-[250px] focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors focus:outline-none ${
                  viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-50"
                }`}
                aria-label="Grid view"
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors focus:outline-none ${
                  viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-50"
                }`}
                aria-label="List view"
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF6633] text-white rounded-lg font-medium hover:bg-[#E55A2B] transition-all shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Client</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-[#FF6633] animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <Building2 className="w-12 h-12 text-gray-200" />
            <p className="text-lg font-medium text-gray-500">No clients yet</p>
            <p className="text-sm">Click &ldquo;Add Client&rdquo; to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <p className="text-lg font-medium text-gray-500">No matching clients</p>
            <p className="text-sm">Try a different search term.</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto">
            <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm min-w-[800px]">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Email / Phone
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="flex items-center gap-3 text-left hover:underline focus:outline-none"
                        >
                          <div className="w-9 h-9 bg-gradient-to-br from-[#FF6633] to-[#E55A2B] rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm flex-shrink-0">
                            {clientInitials(row.name)}
                          </div>
                          <span className="font-medium text-black text-sm">{row.name}</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{row.company_name || "—"}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">{row.email || ""}</div>
                        {row.phone ? <div className="text-sm text-gray-500">{row.phone}</div> : null}
                        {!row.email && !row.phone ? <span className="text-sm text-gray-400">—</span> : null}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{row.title || "—"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            row.status === "active"
                              ? "bg-[#E8F5E9] text-[#4CAF50]"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              row.status === "active" ? "bg-[#4CAF50]" : "bg-gray-500"
                            }`}
                          />
                          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end">
                          <ClientActionMenu row={row} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start">
            {filtered.map((row, idx) => (
              <div
                key={row.id}
                data-tour={idx === 0 ? "client-card-0" : undefined}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-gray-300 transition-all duration-300 group flex flex-col"
              >
                <div className="p-6 pb-4 flex flex-col items-center text-center border-b border-gray-50 bg-gradient-to-b from-gray-50/50 to-white relative">
                  <div data-tour={idx === 0 ? "client-invite-button-0" : undefined} className="absolute top-4 right-4">
                    <ClientActionMenu row={row} align="card" />
                  </div>

                  <div className="relative mb-4">
                    <div className="w-20 h-20 bg-white p-1 rounded-full border border-gray-100 shadow-sm">
                      <div className="w-full h-full bg-gradient-to-br from-[#FF6633] to-[#E55A2B] rounded-full flex items-center justify-center text-xl font-bold text-white shadow-inner">
                        {clientInitials(row.name)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-1 max-w-full">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="text-lg font-bold text-gray-900 group-hover:text-[#FF6633] transition-colors line-clamp-1"
                    >
                      {row.name}
                    </button>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest border shrink-0 ${
                        row.status === "active"
                          ? "bg-green-50 text-green-600 border-green-100"
                          : "bg-gray-50 text-gray-400 border-gray-100"
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>

                  {row.company_name ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 max-w-full">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{row.company_name}</span>
                    </div>
                  ) : null}
                  {row.title ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 rounded-full text-[11px] font-bold text-orange-700 uppercase tracking-wider">
                      <Briefcase className="w-3 h-3 shrink-0" />
                      <span className="truncate">{row.title}</span>
                    </div>
                  ) : null}
                </div>

                <div className="p-6 flex-1 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Projects</p>
                    <div className="flex flex-wrap gap-1">
                      {row.project_names.length ? (
                        <>
                          {row.project_names.slice(0, 2).map((name) => (
                            <span
                              key={name}
                              className="px-2 py-0.5 bg-blue-50 text-[11px] font-medium text-blue-600 rounded"
                            >
                              {name}
                            </span>
                          ))}
                          {row.project_names.length > 2 ? (
                            <span className="px-2 py-0.5 bg-gray-50 text-[11px] font-medium text-gray-500 rounded">
                              +{row.project_names.length - 2} more
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">No project assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-3 pb-4 pt-2 mt-auto">
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={row.email ? `mailto:${row.email}` : "#"}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        row.email
                          ? "border-gray-100 bg-gray-50 text-gray-700 hover:bg-white hover:shadow-md hover:border-gray-200"
                          : "bg-gray-50 opacity-40 cursor-not-allowed text-gray-400 border-transparent"
                      }`}
                      onClick={(e) => {
                        if (!row.email) e.preventDefault();
                      }}
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </a>
                    <a
                      href={row.phone ? `tel:${row.phone}` : "#"}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        row.phone
                          ? "border-gray-100 bg-gray-50 text-gray-700 hover:bg-white hover:shadow-md hover:border-gray-200"
                          : "bg-gray-50 opacity-40 cursor-not-allowed text-gray-400 border-transparent"
                      }`}
                      onClick={(e) => {
                        if (!row.phone) e.preventDefault();
                      }}
                    >
                      <Phone className="w-4 h-4" />
                      Call
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit client" : "Create client"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-[#FF6633] uppercase tracking-wide mb-3">
                  Portal login contact
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Contact name *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setF("name", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Email (login)</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setF("email", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Phone</label>
                      <input
                        value={form.phone}
                        onChange={(e) => setF("phone", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Title / role</label>
                    <input
                      value={form.title}
                      onChange={(e) => setF("title", e.target.value)}
                      placeholder="e.g. Project manager"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-xs font-bold text-[#FF6633] uppercase tracking-wide mb-3">
                  General information
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Company name shown on the client portal. Contract / PO, Wick&apos;d contact, and
                  superintendent are set per project.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Client (company)</label>
                    <input
                      value={form.company_name}
                      onChange={(e) => setF("company_name", e.target.value)}
                      placeholder="e.g. Meridian Energy Partners, LLC"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setF("notes", e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
                    Project access ({form.project_ids.length} selected)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Client login will only show these projects in the portal.
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {projects.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.project_ids.includes(p.id)}
                          onChange={() => toggleProject(p.id)}
                          className="rounded border-gray-300 text-[#FF6633] focus:ring-[#FF6633]"
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setF("status", e.target.value as FormData["status"])}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                {!editingId ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50/90 p-4 space-y-2">
                    <label
                      className={`flex items-start gap-3 ${form.email?.trim() && form.status === "active" ? "cursor-pointer" : "cursor-not-allowed"}`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(form.email?.trim()) && form.status === "active" && sendInviteOnCreate}
                        disabled={!form.email?.trim() || form.status !== "active"}
                        onChange={(e) => setSendInviteOnCreate(e.target.checked)}
                        className="mt-1 w-4 h-4 text-[#FF6633] border-gray-300 rounded focus:ring-[#FF6633] disabled:opacity-40"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-800">
                          Send portal invite email
                        </span>
                        <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">
                          They get a link to set their password, then sign in at the client portal.
                        </span>
                      </span>
                    </label>
                    {!form.email?.trim() ? (
                      <p className="text-xs text-amber-800 pl-7">Enter an email above to enable.</p>
                    ) : null}
                    {form.status !== "active" ? (
                      <p className="text-xs text-gray-500 pl-7">Client must be active to receive an invite.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="px-5 py-2 text-sm font-semibold bg-[#FF6633] text-white rounded-lg hover:bg-[#E55A2B] disabled:opacity-60"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create client"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
