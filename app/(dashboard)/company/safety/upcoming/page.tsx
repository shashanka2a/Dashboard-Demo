"use client";

import { CalendarCheck, Plus, FileText, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isSafetyTalkCompletedStatus } from "@/lib/safety-talk-status";

export default function UpcomingTalksPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/safety-talks/events?status=upcoming", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRows(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(
    () =>
      rows
        .filter((r) => !isSafetyTalkCompletedStatus(r.status))
        .sort((a, b) =>
          String(a.scheduled_date || a.display_date || "").localeCompare(
            String(b.scheduled_date || b.display_date || "")
          )
        ),
    [rows]
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Upcoming talks</h1>
        {!loading && upcoming.length > 0 ? (
          <p className="text-sm text-gray-500">{upcoming.length} across all projects</p>
        ) : (
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Schedule talk
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50/50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Talk name</th>
              <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Project</th>
              <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Scheduled date</th>
              <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">PDF</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-sm text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : upcoming.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                      <CalendarCheck className="w-7 h-7 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-gray-700 font-semibold text-base">No upcoming talks scheduled</p>
                      <p className="text-gray-400 text-sm mt-1 max-w-xs">
                        Scheduled talks from every project will appear here until they are conducted.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Schedule a talk
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              upcoming.map((t) => {
                const dateLabel = t.scheduled_date || t.display_date || "—";
                const isOverdue =
                  dateLabel !== "—" &&
                  /^\d{4}-\d{2}-\d{2}$/.test(String(dateLabel)) &&
                  String(dateLabel) < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.template_name || "Safety Talk"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{t.project_name || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{dateLabel}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                          isOverdue
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {isOverdue ? "Overdue" : t.status || "scheduled"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        {t.pdf_url ? (
                          <a
                            href={t.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="w-4 h-4" />
                            View PDF
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">No PDF</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
