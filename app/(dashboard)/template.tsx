"use client";

import { usePathname } from "next/navigation";

/** Subtle enter animation when switching dashboard routes (Directory → Activity, etc.). */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="min-h-full animate-in fade-in duration-200">
      {children}
    </div>
  );
}
