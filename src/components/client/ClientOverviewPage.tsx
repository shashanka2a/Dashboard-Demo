"use client";

import Image from "next/image";
import {
  Droplets,
  Globe,
  Mail,
  MapPin,
  Phone,
  Sprout,
  Sun,
  Tractor,
  Trees,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useClientPortal } from "@/context/ClientPortalContext";
import {
  ClientLabelValue,
  ClientSectionCard,
  ClientStatTile,
  ClientStatusPill,
} from "@/components/client/ClientUi";
import {
  formatClientAddress,
  formatClientDate,
  type ClientMaintenanceEvent,
} from "@/lib/client-portal";
import { isBrowserResolvableUrl } from "@/lib/photo-url";

function maintenanceIcon(kind: ClientMaintenanceEvent["kind"], upcoming: boolean) {
  if (upcoming) return <Sun className="h-4 w-4 text-[#FF6633]" />;
  if (kind === "wicking") return <Droplets className="h-4 w-4 text-violet-400" />;
  if (kind === "spraying") return <Sprout className="h-4 w-4 text-[#FF6633]" />;
  if (kind === "mowing") return <Trees className="h-4 w-4 text-green-400" />;
  return <Tractor className="h-4 w-4 text-gray-400" />;
}

export function ClientOverviewPage() {
  const { overview } = useClientPortal();
  const [requestText, setRequestText] = useState("");

  if (!overview) return null;

  const { project, cover_photo_url, mapping, progress, maintenance, wickd_contact, superintendent, contract_po, contract_expiration, client_company_name } = overview;
  const heroUrl = cover_photo_url && isBrowserResolvableUrl(cover_photo_url) ? cover_photo_url : null;
  const earthLink = mapping.google_earth_url || (mapping.kmz_url ? mapping.kmz_url : null);

  const submitRequest = () => {
    const t = requestText.trim();
    if (!t) {
      toast.error("Please enter a question or request.");
      return;
    }
    toast.success("Request received — your project team will follow up.");
    setRequestText("");
  };

  return (
    <div className="mx-auto max-w-lg">
      {/* Hero */}
      <div className="relative h-48 w-full overflow-hidden bg-[#1C1C1E]">
        {heroUrl ? (
          <Image src={heroUrl} alt="" fill className="object-cover" sizes="(max-width: 512px) 100vw, 512px" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2C2C2E] to-[#0D0D0D]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">
                {client_company_name || project.client_name || "Your project"}
              </h1>
            </div>
            <ClientStatusPill status={project.status} />
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 -mt-2 relative z-10 pb-6">
        {/* General info */}
        <ClientSectionCard title="General Information">
          <ClientLabelValue label="Client" value={client_company_name || project.client_name || "—"} />
          <ClientLabelValue
            label="Project Address"
            value={formatClientAddress(project)}
          />
          <ClientLabelValue label="Contract / PO #" value={contract_po || "—"} />
          <ClientLabelValue label="Contract Expiration" value={formatClientDate(contract_expiration)} />
          <ClientLabelValue
            label="Wick'd Contact"
            value={
              wickd_contact ? (
                <>
                  <span className="block font-medium text-white">{wickd_contact.name}</span>
                  {wickd_contact.phone ? (
                    <a
                      href={`tel:${wickd_contact.phone.replace(/\D/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-[#FF6633] hover:underline mt-1"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {wickd_contact.phone}
                    </a>
                  ) : null}
                  {wickd_contact.email ? (
                    <a
                      href={`mailto:${wickd_contact.email}`}
                      className="inline-flex items-center gap-1.5 text-[#FF6633] hover:underline mt-1"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {wickd_contact.email}
                    </a>
                  ) : null}
                </>
              ) : (
                "—"
              )
            }
          />
          <ClientLabelValue
            label="Project Superintendent"
            value={
              superintendent.name || superintendent.phone ? (
                <>
                  {superintendent.name ? (
                    <span className="block font-medium text-white">{superintendent.name}</span>
                  ) : null}
                  {superintendent.phone ? (
                    <a
                      href={`tel:${superintendent.phone.replace(/\D/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-[#FF6633] hover:underline mt-1"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {superintendent.phone}
                    </a>
                  ) : null}
                </>
              ) : (
                "—"
              )
            }
          />
        </ClientSectionCard>

        {/* Mapping */}
        <ClientSectionCard title="Mapping">
          <div className="flex gap-3">
            <div className="relative h-24 w-28 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#2C2C2E]">
              {mapping.preview_image_url && isBrowserResolvableUrl(mapping.preview_image_url) ? (
                <Image
                  src={mapping.preview_image_url}
                  alt="Site map preview"
                  fill
                  className="object-cover opacity-80"
                  sizes="112px"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <MapPin className="h-8 w-8 text-gray-600" />
                </div>
              )}
            </div>
            {earthLink ? (
              <a
                href={earthLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 flex-col justify-center rounded-xl border border-white/10 bg-[#2C2C2E] px-4 py-3 hover:border-[#FF6633]/40 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  View on Google Earth
                  <Globe className="h-4 w-4 text-[#FF6633]" />
                </span>
                <span className="text-xs text-gray-500 mt-1">Open site boundary</span>
              </a>
            ) : (
              <div className="flex flex-1 flex-col justify-center rounded-xl border border-dashed border-white/15 bg-[#2C2C2E]/50 px-4 py-3">
                <p className="text-sm font-medium text-gray-400">Map not yet available</p>
                <p className="text-xs text-gray-600 mt-1">KMZ will appear here once uploaded from the dashboard.</p>
              </div>
            )}
          </div>
        </ClientSectionCard>

        {/* Progress */}
        <ClientSectionCard title="Progress at a Glance">
          <div className="grid grid-cols-3 gap-2">
            <ClientStatTile
              label="Acres"
              value={progress.acres_completed != null ? String(progress.acres_completed) : "—"}
            />
            <ClientStatTile label="Last Spray" value={formatClientDate(progress.last_spraying_date)} />
            <ClientStatTile label="Last Wick" value={formatClientDate(progress.last_wicking_date)} />
          </div>
        </ClientSectionCard>

        {/* Maintenance timeline */}
        <ClientSectionCard title="Maintenance & Schedule">
          <ul className="space-y-0">
            {maintenance.map((ev, i) => (
              <li key={ev.id} className="flex gap-3 py-3 border-b border-white/5 last:border-0">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#2C2C2E]">
                    {maintenanceIcon(ev.kind, ev.upcoming)}
                  </div>
                  {i < maintenance.length - 1 ? (
                    <div className="mt-1 w-px flex-1 min-h-[12px] bg-white/10" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#FF6633]">{ev.label}</p>
                    {ev.upcoming ? (
                      <span className="rounded-full bg-[#FF6633]/20 px-2 py-0.5 text-[9px] font-bold uppercase text-[#FF6633]">
                        upcoming
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-300 mt-0.5">
                    {ev.date ? formatClientDate(ev.date) : "TBD"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </ClientSectionCard>

        {/* Request CTA */}
        <ClientSectionCard>
          <button
            type="button"
            onClick={submitRequest}
            className="w-full rounded-xl bg-[#FF6633] py-3.5 text-sm font-bold text-white hover:bg-[#E55A2B] transition-colors"
          >
            Request Updated Information
          </button>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Type your question or request below
          </label>
          <textarea
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            rows={3}
            placeholder="e.g. When is the next spraying scheduled for Block D?"
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#2C2C2E] px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FF6633]/40"
          />
        </ClientSectionCard>
      </div>
    </div>
  );
}
