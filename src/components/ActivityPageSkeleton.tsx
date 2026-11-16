import { Loader2 } from "lucide-react";

/** Visible shell while Activity route or feed is loading (navigation + data fetch). */
export function ActivityPageSkeleton() {
  return (
    <div className="min-h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2 animate-pulse">
            <div className="h-6 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-52 bg-gray-100 rounded" />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-[#FF6633]" aria-hidden />
            <span>Loading activity…</span>
          </div>
        </div>
        <div className="flex items-center gap-3 animate-pulse">
          <div className="h-9 w-24 bg-gray-100 rounded-lg" />
          <div className="h-9 w-20 bg-gray-100 rounded-lg" />
          <div className="h-9 flex-1 max-w-md bg-gray-100 rounded-lg" />
          <div className="h-9 w-9 bg-gray-100 rounded-lg" />
        </div>
      </div>
      <div className="flex-1 p-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 bg-white border border-gray-200 rounded-lg animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
