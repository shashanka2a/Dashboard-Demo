"use client";

import type { ReactNode } from "react";

export function ClientSectionCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#1C1C1E] p-5 ${className}`}>
      {title ? (
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

export function ClientLabelValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="py-2.5 border-b border-white/5 last:border-0">
      <p className="text-xs font-bold uppercase tracking-wide text-[#FF6633]">{label}</p>
      <p className="mt-1 text-sm text-gray-200 leading-relaxed">{value}</p>
    </div>
  );
}

export function ClientStatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#2C2C2E] px-4 py-3 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

export function ClientPriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const p = priority.toLowerCase();
  const cls =
    p === "worsening" || p === "critical" || p === "dangerous"
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : p === "new occurrence" || p === "recurrent" || p === "high"
        ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
        : p === "improved"
          ? "bg-green-500/20 text-green-300 border-green-500/30"
          : "bg-gray-500/20 text-gray-300 border-gray-500/30";
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
      {priority}
    </span>
  );
}

export function ClientStatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "active"
      ? "bg-green-500/15 text-green-300 border-green-500/25"
      : s === "completed"
        ? "bg-blue-500/15 text-blue-300 border-blue-500/25"
        : "bg-amber-500/15 text-amber-300 border-amber-500/25";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}
