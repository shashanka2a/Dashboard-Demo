"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  Loader2,
  MapPin,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { ClientPortalAdminSettings } from "@/lib/client-portal";
import { formatClientDate } from "@/lib/client-portal";
import { DEFAULT_CLIENT_PORTAL_EXCLUDED_PHOTO_TAGS } from "@/lib/client-portal-photo-tags";
import { isBrowserResolvableUrl } from "@/lib/photo-url";

export function ProjectClientPortalSettings({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ClientPortalAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "kmz" | null>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [allowedTags, setAllowedTags] = useState<string[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const kmzInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/client-portal`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      const settings = json as ClientPortalAdminSettings;
      setData(settings);
      setAllowedTags(settings.resolved_allowed_photo_tags ?? []);
    } catch (e) {
      setData(null);
      toast.error(e instanceof Error ? e.message : "Failed to load portal settings");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async (patch: {
    client_portal_enabled?: boolean;
    client_portal_allowed_photo_tags?: string[] | null;
  }) => {
    const savingTags = 'client_portal_allowed_photo_tags' in patch;
    if (savingTags) setTagSaving(true);
    else setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/client-portal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Save failed");
      const settings = json as ClientPortalAdminSettings;
      setData(settings);
      setAllowedTags(settings.resolved_allowed_photo_tags ?? []);
      toast.success(savingTags ? "Photo tag settings saved" : "Portal settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      if (savingTags) setTagSaving(false);
      else setSaving(false);
    }
  };

  const uploadFile = async (file: File, kind: "cover" | "kmz") => {
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch(`/api/projects/${projectId}/client-portal/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Upload failed");
      await load();
      toast.success(kind === "cover" ? "Cover photo uploaded" : "KMZ uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const removeFile = async (kind: "cover" | "kmz") => {
    setUploading(kind);
    try {
      const res = await fetch(`/api/projects/${projectId}/client-portal/upload?kind=${kind}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Remove failed");
      await load();
      toast.success(kind === "cover" ? "Cover photo removed" : "KMZ removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setUploading(null);
    }
  };

  const togglePhotoTag = (tag: string) => {
    const key = tag.trim().toLowerCase();
    const has = allowedTags.some((t) => t.trim().toLowerCase() === key);
    const next = has
      ? allowedTags.filter((t) => t.trim().toLowerCase() !== key)
      : [...allowedTags, tag];
    setAllowedTags(next);
    void saveSettings({ client_portal_allowed_photo_tags: next });
  };

  const resetPhotoTagsToDefault = () => {
    void saveSettings({ client_portal_allowed_photo_tags: null });
  };

  const copyLink = () => {
    if (!data?.portal_url) return;
    void navigator.clipboard.writeText(data.portal_url);
    toast.success("Client login link copied");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-gray-500 py-8">Could not load client portal settings.</p>;
  }

  const coverUrl = data.cover_photo_url && isBrowserResolvableUrl(data.cover_photo_url) ? data.cover_photo_url : null;

  return (
    <div className="space-y-6">
      {/* Visible toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Visible to client</h3>
            <p className="text-xs text-gray-500 mt-1">Enable client portal access for this project.</p>
            {data.client_portal_enabled ? (
              <p className="text-xs text-[#FF6633] font-medium mt-2 inline-flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Portal is live — client can view project
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">Portal is hidden from clients.</p>
            )}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSettings({ client_portal_enabled: !data.client_portal_enabled })}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              data.client_portal_enabled ? "bg-[#FF6633]" : "bg-gray-300"
            }`}
            aria-pressed={data.client_portal_enabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                data.client_portal_enabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Copy className="w-4 h-4" />
            Copy client login link
          </button>
          <Link
            href={data.portal_url}
            target="_blank"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#FF6633]/30 text-sm font-medium text-[#FF6633] hover:bg-orange-50"
          >
            Open client login
          </Link>
        </div>

        {data.assigned_clients.length > 0 ? (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Assigned clients</p>
            <ul className="text-sm text-gray-700 space-y-1">
              {data.assigned_clients.map((c) => (
                <li key={c.id}>
                  {c.name}
                  {c.email ? <span className="text-gray-400"> · {c.email}</span> : null}
                </li>
              ))}
            </ul>
            <Link href="/clients" className="text-xs text-[#FF6633] hover:underline mt-2 inline-block">
              Manage in Clients directory →
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-500">
            No clients assigned yet.{" "}
            <Link href="/clients" className="text-[#FF6633] hover:underline">
              Add a client
            </Link>{" "}
            and link them to this project.
          </p>
        )}
      </div>

      {/* Client portal photo tags */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Photo tags visible to clients</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              Photos stay in your internal gallery. Only attachments with allowed tags appear in the client portal.
              By default, <span className="font-semibold">{DEFAULT_CLIENT_PORTAL_EXCLUDED_PHOTO_TAGS.join(", ")}</span> are
              internal only.
            </p>
          </div>
          <button
            type="button"
            disabled={tagSaving || saving}
            onClick={resetPhotoTagsToDefault}
            className="text-xs font-bold text-[#FF6633] hover:underline disabled:opacity-40 whitespace-nowrap"
          >
            Reset to defaults
          </button>
        </div>

        {data.available_photo_tags.length === 0 ? (
          <p className="text-xs text-gray-400">
            No photo tags configured yet. Add tags under Company → Photo tags.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.available_photo_tags.map((tag) => {
              const active = allowedTags.some((t) => t.trim().toLowerCase() === tag.trim().toLowerCase());
              const isDefaultExcluded = DEFAULT_CLIENT_PORTAL_EXCLUDED_PHOTO_TAGS.some(
                (t) => t.toLowerCase() === tag.trim().toLowerCase()
              );
              return (
                <button
                  key={tag}
                  type="button"
                  disabled={tagSaving || saving}
                  onClick={() => togglePhotoTag(tag)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50 ${
                    active
                      ? "bg-[#FF6633] text-white border-[#FF6633]"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                  title={
                    active
                      ? "Visible in client portal — click to hide"
                      : isDefaultExcluded
                        ? "Internal only (default) — click to allow for clients"
                        : "Hidden from client portal — click to allow"
                  }
                >
                  {tag}
                  {!active && isDefaultExcluded ? (
                    <span className="ml-1 text-[10px] opacity-70">(internal)</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {(tagSaving || saving) && (
          <p className="text-xs text-gray-400 mt-3 inline-flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving tag settings…
          </p>
        )}
      </div>

      {/* Cover photo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900">Cover photo</h3>
        <p className="text-xs text-gray-500 mt-1">Hero image shown at top of client portal.</p>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f, "cover");
            e.target.value = "";
          }}
        />
        {coverUrl ? (
          <div className="relative mt-4 rounded-xl overflow-hidden border border-gray-200 aspect-[21/9] max-h-48">
            <Image src={coverUrl} alt="Cover" fill className="object-cover" sizes="(max-width:768px) 100vw, 600px" />
            <button
              type="button"
              disabled={uploading === "cover"}
              onClick={() => void removeFile("cover")}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading === "cover"}
            onClick={() => coverInputRef.current?.click()}
            className="mt-4 w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-[#FF6633]/40 hover:text-[#FF6633] transition-colors"
          >
            {uploading === "cover" ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">Upload cover photo</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* KMZ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900">Site boundary (KMZ)</h3>
        <p className="text-xs text-gray-500 mt-1">Upload a .kmz file for client mapping preview.</p>
        <input
          ref={kmzInputRef}
          type="file"
          accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f, "kmz");
            e.target.value = "";
          }}
        />
        {data.kmz_url ? (
          <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
            <MapPin className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-900 truncate">{data.kmz_filename || "boundary.kmz"}</p>
              <p className="text-xs text-green-700">
                Uploaded {data.kmz_uploaded_at ? formatClientDate(data.kmz_uploaded_at.slice(0, 10)) : "—"}
              </p>
            </div>
            <button
              type="button"
              disabled={uploading === "kmz"}
              onClick={() => void removeFile("kmz")}
              className="text-green-700 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading === "kmz"}
            onClick={() => kmzInputRef.current?.click()}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-[#FF6633]/40 hover:text-[#FF6633]"
          >
            {uploading === "kmz" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload KMZ file
          </button>
        )}
      </div>
    </div>
  );
}
