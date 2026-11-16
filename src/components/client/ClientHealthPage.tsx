"use client";

import { AlertTriangle, Leaf, ShieldAlert, Shovel } from "lucide-react";
import { useClientPortal } from "@/context/ClientPortalContext";
import { ClientPriorityBadge, ClientSectionCard } from "@/components/client/ClientUi";
import type { ClientWatchlistItem } from "@/lib/client-portal";

const SECTIONS: {
  key: ClientWatchlistItem["section"];
  title: string;
  icon: typeof Leaf;
}[] = [
  { key: "weeds", title: "Invasive Weeds Spotted", icon: Leaf },
  { key: "problems", title: "Problem Areas", icon: Shovel },
  { key: "hazards", title: "Hazards Noted on Site", icon: ShieldAlert },
];

export function ClientHealthPage() {
  const { overview } = useClientPortal();
  if (!overview) return null;

  const bySection = (section: ClientWatchlistItem["section"]) =>
    overview.watchlist.filter((w) => w.section === section);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-white">Site Health Watchlist</h1>
        <p className="text-sm text-gray-500 mt-1">Open items your crew is tracking on site.</p>
      </div>

      {SECTIONS.map(({ key, title, icon: Icon }) => {
        const items = bySection(key);
        return (
          <ClientSectionCard key={key}>
            <div className="flex items-center gap-2 mb-4">
              <Icon className="h-5 w-5 text-[#FF6633]" />
              <h2 className="text-sm font-bold text-[#FF6633]">{title}</h2>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-gray-600" />
                No open items — site looking good.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-white/5 bg-[#2C2C2E]/60 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <ClientPriorityBadge priority={item.priority} />
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{item.description}</p>
                    {item.location ? (
                      <p className="text-xs text-gray-500 mt-2">📍 {item.location}</p>
                    ) : null}
                    {item.status ? (
                      <p className="text-[10px] font-bold uppercase text-gray-600 mt-1">{item.status}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ClientSectionCard>
        );
      })}
    </div>
  );
}
