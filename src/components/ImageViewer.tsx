"use client";

import { 
  X, ChevronLeft, ChevronRight, Download, Share2,
  Trash2, Pencil, MessageSquare, Loader2, Plus
} from "lucide-react";
import { useState, useEffect } from "react";
import { normalizeRemotePhotoUrl } from "@/lib/photo-url";
import { toast } from "sonner";

export type ImageViewerMetadata = {
  fileName?: string;
  uploadedBy?: string;
  date?: string;
  description?: string;
  project?: string;
  company?: string;
  sourceId?: string;
  sourceType?: string;
  /** Tags on the attachment row this photo belongs to. */
  tags?: string[];
};

interface ImageViewerProps {
  photos: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  metadata?: ImageViewerMetadata;
  /** Called after a photo is removed from project records. */
  onPhotoDeleted?: (deletedUrl: string) => void;
  /** Called after tags were saved for an attachment (lets the parent refresh its list). */
  onTagsChanged?: (sourceId: string, tags: string[]) => void;
}

export function ImageViewer({ photos, initialIndex, isOpen, onClose, metadata, onPhotoDeleted, onTagsChanged }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [deleting, setDeleting] = useState(false);
  const [companyTags, setCompanyTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  // Only when the parent supplies the current tags (otherwise a save could overwrite unseen tags).
  const canEditTags =
    metadata?.sourceType === 'Attachments' &&
    Boolean(metadata?.sourceId) &&
    Array.isArray(metadata?.tags);
  const currentTags = metadata?.tags ?? [];

  useEffect(() => {
    if (!isOpen || !canEditTags || companyTags.length > 0) return;
    let cancelled = false;
    fetch('/api/company/photo-tags', { cache: 'no-store' })
      .then((r) => r.json())
      .then((rows: { name?: string }[]) => {
        if (cancelled || !Array.isArray(rows)) return;
        setCompanyTags(rows.map((r) => String(r.name ?? '').trim()).filter(Boolean));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen, canEditTags, companyTags.length]);

  const saveTags = async (nextTags: string[]) => {
    if (!metadata?.sourceId) return;
    setSavingTags(true);
    try {
      const res = await fetch(`/api/attachments/${metadata.sourceId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Could not save tags (${res.status})`);
      onTagsChanged?.(metadata.sourceId, json.tags as string[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save tags');
    } finally {
      setSavingTags(false);
    }
  };

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (photos.length === 0) return;
    setCurrentIndex((i) => Math.min(Math.max(i, 0), photos.length - 1));
  }, [photos.length]);

  if (!isOpen) return null;

  if (photos.length === 0) return null;

  const currentSrc = normalizeRemotePhotoUrl(photos[currentIndex] || '');

  const next = () => setCurrentIndex((prev) => (prev + 1) % photos.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);

  const handleShare = async () => {
    const url = normalizeRemotePhotoUrl(photos[currentIndex]);
    if (navigator.share) {
      try {
        await navigator.share({
          title: metadata?.fileName || 'Project Photo',
          text: metadata?.description || 'Check out this photo from Utility Vision',
          url: url
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        alert('Image link copied to clipboard!');
      } catch (err) {
        console.error('Could not copy text: ', err);
      }
    }
  };

  const handleDownload = async () => {
    const url = normalizeRemotePhotoUrl(photos[currentIndex]);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = metadata?.fileName || `photo_${currentIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const handleDelete = async () => {
    const url = normalizeRemotePhotoUrl(photos[currentIndex] || '');
    if (!url) return;
    if (!confirm('Are you sure you want to delete this photo? This will remove it from the project records.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch('/api/photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          sourceId: metadata?.sourceId,
          sourceType: metadata?.sourceType,
          project: metadata?.project,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Delete failed (${res.status})`);
      }

      toast.success('Photo deleted');
      onPhotoDeleted?.(url);

      if (photos.length <= 1) {
        onClose();
        return;
      }
      setCurrentIndex((i) => Math.min(i, photos.length - 2));
    } catch (err) {
      console.error('Photo delete failed:', err);
      toast.error(err instanceof Error ? err.message : 'Could not delete photo');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex animate-in fade-in duration-200">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative bg-gray-50 border-r border-gray-100">
        {/* Top Control Bar */}
        <div className="h-14 px-4 flex items-center justify-between bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-3">
              <button 
                onClick={prev} 
                disabled={photos.length <= 1}
                className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <span className="text-sm font-medium text-gray-600">
                {currentIndex + 1} / {photos.length}
              </span>
              <button 
                onClick={next} 
                disabled={photos.length <= 1}
                className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500" title="Share photo">
              <Share2 className="w-5 h-5" />
            </button>
            <button onClick={handleDownload} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500" title="Download photo">
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500 disabled:opacity-40"
              title="Delete photo"
            >
              {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Image Display — native <img> so any CDN URL works without Next/Image domain config */}
        <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden group">
          <div className="relative w-full h-full max-w-4xl max-h-full flex items-center justify-center">
            {currentSrc ? (
              <img
                src={currentSrc}
                alt="Viewing photo"
                className="max-w-full max-h-[calc(100vh-8rem)] w-auto h-auto object-contain"
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Info Sidebar */}
      <div className="w-[350px] flex flex-col bg-white shrink-0">
        <div className="p-8 space-y-8 flex-1 overflow-y-auto">
          {/* File Name */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">File name</h3>
              <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                <Pencil className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            <p className="text-[13px] text-gray-900 font-medium break-all leading-relaxed">
              {metadata?.fileName || 'image_upload_' + currentIndex + '.jpg'}
            </p>
          </section>

          {/* Uploaded By */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Uploaded by</h3>
            <p className="text-[13px] text-gray-900 font-medium">
              {metadata?.uploadedBy || 'Artifact Employee'}
            </p>
          </section>

          {/* Date */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Date</h3>
            <p className="text-[13px] text-gray-900 font-medium">
              {metadata?.date || 'Unknown'}
            </p>
          </section>

          {/* Tags */}
          {canEditTags ? (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tags</h3>
                {savingTags ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {currentTags.length === 0 ? (
                  <span className="text-[13px] text-gray-400 italic">No tags yet.</span>
                ) : (
                  currentTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-600"
                    >
                      {tag}
                      <button
                        type="button"
                        disabled={savingTags}
                        onClick={() => void saveTags(currentTags.filter((t) => t !== tag))}
                        className="hover:text-red-500 disabled:opacity-40"
                        title={`Remove ${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="relative mt-3">
                <button
                  type="button"
                  onClick={() => setTagPickerOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                >
                  <Plus className="w-3 h-3" /> Add tag
                </button>
                {tagPickerOpen ? (
                  <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                    {(() => {
                      const available = companyTags.filter(
                        (t) => !currentTags.some((c) => c.toLowerCase() === t.toLowerCase())
                      );
                      if (available.length === 0) {
                        return <p className="px-2 py-1 text-xs text-gray-400">No more tags available.</p>;
                      }
                      return available.map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={savingTags}
                          onClick={() => {
                            setTagPickerOpen(false);
                            void saveTags([...currentTags, t]);
                          }}
                          className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-gray-700 hover:bg-orange-50 disabled:opacity-40"
                        >
                          {t}
                        </button>
                      ));
                    })()}
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-[10px] text-gray-400">Applies to all photos in this upload.</p>
            </section>
          ) : null}

          {/* Description */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Description</h3>
            <p className="text-[13px] text-gray-400 leading-relaxed italic">
              {metadata?.description || 'No description provided.'}
            </p>
          </section>
        </div>

        {/* Bottom Actions/Chat icon */}
        <div className="p-6 flex justify-end">
          <div className="relative">
            <button className="w-12 h-12 bg-[#FF6633] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all">
              <MessageSquare className="w-6 h-6 fill-current" />
            </button>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold">1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
