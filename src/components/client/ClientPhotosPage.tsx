"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useClientPortal } from "@/context/ClientPortalContext";
import { isBrowserResolvableUrl } from "@/lib/photo-url";

const FILTER_CHIPS = ["All", "Progress", "Safety", "Chemical", "Wildlife", "Equipment", "Weather", "General"] as const;

export function ClientPhotosPage() {
  const { overview } = useClientPortal();
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<string>("All");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const photos = useMemo(() => {
    if (!overview) return [];
    return overview.photos.filter((p) => isBrowserResolvableUrl(p.url));
  }, [overview]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return photos.filter((p) => {
      if (chip !== "All" && !p.tags.some((t) => t.toLowerCase().includes(chip.toLowerCase()))) return false;
      if (!q) return true;
      const hay = [p.caption, ...p.tags, p.date].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [photos, search, chip]);

  if (!overview) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-8">
      <h1 className="text-sm font-bold uppercase tracking-widest text-[#FF6633] mb-4">Site Photo Gallery</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search photos by tag (e.g. Kudzu, Mowing)"
          className="w-full rounded-xl border border-[#FF6633]/40 bg-[#1C1C1E] py-3 pl-10 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FF6633]/30"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {FILTER_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChip(c)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
              chip === c
                ? "border-[#FF6633] bg-[#FF6633]/15 text-[#FF6633]"
                : "border-white/10 text-gray-500 hover:text-gray-300"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-16">No photos match your search.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightbox(p.url)}
              className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-[#1C1C1E]"
            >
              <Image src={p.url} alt={p.caption || "Site photo"} fill className="object-cover" sizes="(max-width:512px) 50vw, 25vw" />
            </button>
          ))}
        </div>
      )}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal
        >
          <div className="relative max-h-[85vh] max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="w-full h-auto max-h-[70vh] object-contain rounded-lg" />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="mt-4 w-full rounded-xl bg-[#FF6633] py-2 text-sm font-bold text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
