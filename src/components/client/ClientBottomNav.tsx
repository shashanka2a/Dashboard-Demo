"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, HeartPulse, ImageIcon, LayoutGrid } from "lucide-react";

const NAV = [
  { href: "/client", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/client/health", label: "Health", icon: HeartPulse, exact: false },
  { href: "/client/photos", label: "Photos", icon: ImageIcon, exact: false },
  { href: "/client/reports", label: "Reports", icon: FileText, exact: false },
] as const;

export function ClientBottomNav({ projectQuery }: { projectQuery: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-[#0D0D0D]/95 backdrop-blur-md safe-area-pb">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2 pb-3">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          const href = projectQuery ? `${item.href}?${projectQuery}` : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                active ? "text-[#FF6633]" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-[#FF6633]" : ""}`} strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
