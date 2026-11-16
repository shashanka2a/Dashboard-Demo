"use client";

import NextImage from "next/image";
import {
  ClipboardCheck,
  Droplets,
  Paperclip,
  StickyNote,
  Truck,
} from "lucide-react";
import {
  equipmentChecklistFormDisplayFields,
  normalizeEquipmentChecklistRow,
  type ChecklistDisplayField,
} from "@/lib/equipment-checklist";
import { parseCloudinaryUrlsField } from "@/lib/photo-url";
import { formatMonthDayTimeInTimeZone } from "@/lib/activity-display-timezone";

type EquipmentChecklistCardProps = {
  row: Record<string, unknown>;
  index: number;
  onPhotoClick: (photos: string[], index: number) => void;
};

const GROUP_META: Record<
  string,
  { icon: typeof Truck; panelClass: string; headerClass: string }
> = {
  "Site & machine": {
    icon: Truck,
    panelClass: "bg-gradient-to-br from-orange-50/90 to-white",
    headerClass: "bg-orange-100/60 text-orange-900",
  },
  Fluids: {
    icon: Droplets,
    panelClass: "bg-gradient-to-br from-blue-50/90 to-white",
    headerClass: "bg-blue-100/60 text-blue-900",
  },
  Inspection: {
    icon: ClipboardCheck,
    panelClass: "bg-gradient-to-br from-emerald-50/90 to-white",
    headerClass: "bg-emerald-100/60 text-emerald-900",
  },
  Attachment: {
    icon: Paperclip,
    panelClass: "bg-gradient-to-br from-violet-50/90 to-white",
    headerClass: "bg-violet-100/60 text-violet-900",
  },
  Notes: {
    icon: StickyNote,
    panelClass: "bg-gradient-to-br from-amber-50/90 to-white",
    headerClass: "bg-amber-100/60 text-amber-900",
  },
  Other: {
    icon: ClipboardCheck,
    panelClass: "bg-gradient-to-br from-gray-50 to-white",
    headerClass: "bg-gray-100 text-gray-800",
  },
};

function groupFields(fields: ChecklistDisplayField[]): { group: string; items: ChecklistDisplayField[] }[] {
  const order: string[] = [];
  const map = new Map<string, ChecklistDisplayField[]>();
  for (const f of fields) {
    if (!map.has(f.group)) {
      map.set(f.group, []);
      order.push(f.group);
    }
    map.get(f.group)!.push(f);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
}

function valueTone(value: string): { cell: string; text: string } {
  const v = value.trim().toLowerCase();
  if (["good", "full", "tight", "yes", "ok"].includes(v)) {
    return { cell: "border-green-100 bg-green-50/80", text: "text-green-800" };
  }
  if (["low", "fair", "warn", "warning"].includes(v)) {
    return { cell: "border-amber-100 bg-amber-50/80", text: "text-amber-800" };
  }
  if (["bad", "fail", "failed", "no"].includes(v)) {
    return { cell: "border-red-100 bg-red-50/80", text: "text-red-800" };
  }
  if (v === "n/a" || v === "—" || v === "-") {
    return { cell: "border-gray-100 bg-gray-50/60", text: "text-gray-500" };
  }
  return { cell: "border-gray-100/80 bg-white/90", text: "text-gray-900" };
}

function StatCell({ label, value, highlight }: ChecklistDisplayField) {
  const tone = highlight
    ? { cell: "border-[#2196F3]/30 bg-blue-50 ring-1 ring-[#2196F3]/15", text: "text-[#1565C0]" }
    : valueTone(value);
  const isLong = value.length > 48;

  return (
    <div
      className={`rounded-lg border px-2.5 py-2 min-w-0 ${tone.cell} ${isLong ? "col-span-2" : ""}`}
    >
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate" title={label}>
        {label}
      </p>
      <p className={`text-sm font-bold leading-snug mt-0.5 break-words ${tone.text}`}>{value}</p>
    </div>
  );
}

function GroupPanel({ group, items }: { group: string; items: ChecklistDisplayField[] }) {
  const meta = GROUP_META[group] ?? GROUP_META.Other;
  const Icon = meta.icon;
  const spanFull = group === "Notes";

  return (
    <div
      className={`rounded-xl border border-gray-200/80 overflow-hidden shadow-sm min-h-[140px] ${meta.panelClass} ${
        spanFull ? "sm:col-span-2" : ""
      }`}
    >
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-white/60 ${meta.headerClass}`}>
        <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" strokeWidth={2.25} />
        <span className="text-[11px] font-bold uppercase tracking-wide">{group}</span>
        <span className="ml-auto text-[10px] font-semibold opacity-60 tabular-nums">{items.length}</span>
      </div>
      <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {items.map((item) => (
          <StatCell key={`${group}-${item.label}`} {...item} />
        ))}
      </div>
    </div>
  );
}

export function EquipmentChecklistCard({ row, index, onPhotoClick }: EquipmentChecklistCardProps) {
  const normalized = normalizeEquipmentChecklistRow(row);
  const fields = equipmentChecklistFormDisplayFields(row);
  const grouped = groupFields(fields);
  const photos = parseCloudinaryUrlsField(row.photos);
  const loggedAt = normalized.loggedAt ? new Date(normalized.loggedAt) : null;
  const submittedLabel =
    loggedAt && !Number.isNaN(loggedAt.getTime())
      ? formatMonthDayTimeInTimeZone(normalized.loggedAt!)
      : null;

  const machineLabel = [normalized.machineType, normalized.machineNumber].filter(Boolean).join(" · ");

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Compact summary strip */}
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF6633] text-white text-sm font-bold">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {machineLabel || `Checklist #${index + 1}`}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {normalized.siteName || "Equipment checklist"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {normalized.operatorName ? (
            <span className="inline-flex items-center rounded-md bg-white border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-800 shadow-sm">
              {normalized.operatorName}
            </span>
          ) : null}
          {normalized.reportDateYmd ? (
            <span className="inline-flex items-center rounded-md bg-[#FFF3EF] border border-[#FF6633]/20 px-2.5 py-1 text-xs font-semibold text-[#E55A2B]">
              Report {normalized.reportDateYmd}
            </span>
          ) : null}
          {submittedLabel ? (
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              Submitted {submittedLabel}
            </span>
          ) : null}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="px-5 py-10 text-sm text-gray-400 italic text-center">No checklist fields recorded.</div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {grouped.map(({ group, items }) => (
            <GroupPanel key={group} group={group} items={items} />
          ))}
        </div>
      )}

      {(normalized.signatureUrl || photos.length > 0) && (
        <div className="px-4 pb-4 pt-0 flex flex-wrap gap-4 border-t border-gray-50 mt-1">
          {normalized.signatureUrl ? (
            <div className="flex items-end gap-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0 pb-1">
                Signature
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalized.signatureUrl}
                alt="Operator signature"
                className="h-14 rounded-lg border border-gray-200 bg-white object-contain"
              />
            </div>
          ) : null}
          {photos.length > 0 ? (
            <div className="flex-1 min-w-[200px]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Photos ({photos.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {photos.map((url, pi) => (
                  <button
                    key={`${url}-${pi}`}
                    type="button"
                    className="relative h-14 w-14 rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-[#FF6633]/40 transition-shadow shrink-0"
                    onClick={() => onPhotoClick(photos, pi)}
                  >
                    <NextImage src={url} alt={`Photo ${pi + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
