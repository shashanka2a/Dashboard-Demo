"use client";

import { Clock, FileText, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isSafetyTalkCompletedStatus } from "@/lib/safety-talk-status";

export default function PastTalksPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/safety-talks/events?status=past", { cache: "no-store" })
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

  const past = useMemo(
    () =>
      rows
        .filter((r) => isSafetyTalkCompletedStatus(r.status))
        .sort((a, b) =>
          String(b.display_date || b.scheduled_date || "").localeCompare(
            String(a.display_date || a.scheduled_date || "")
          )
        ),
    [rows]
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Past talks</h1>
        {!loading && past.length > 0 ? (
          <p className="text-sm text-gray-500">{past.length} across all projects</p>
        ) : null}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50/50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Talk name</th>
              <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Project</th>
              <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
              <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Attendees</th>
              <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-sm text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : past.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                      <Clock className="w-7 h-7 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-gray-700 font-semibold text-base">No past safety talks</p>
                      <p className="text-gray-400 text-sm mt-1 max-w-xs">
                        Conducted safety talks from every project will appear here.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              past.map((t) => {
                const attendeeNames = Array.isArray(t.attendees)
                  ? t.attendees.map((a: { name: string }) => a.name).filter(Boolean)
                  : [];
                const dateLabel = t.display_date || t.scheduled_date || (t.created_at ? String(t.created_at).slice(0, 10) : "—");
                return (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{t.template_name || "Safety Talk"}</p>
                          <p className="text-xs text-gray-400 truncate capitalize">{t.status || "conducted"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{t.project_name || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{dateLabel}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                      {attendeeNames.length > 0 ? (
                        <span className="line-clamp-2" title={attendeeNames.join(", ")}>
                          {t.attendee_count ?? attendeeNames.length} · {attendeeNames.join(", ")}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {t.pdf_url ? (
                          <a
                            href={t.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="w-4 h-4" />
                            Topic PDF
                          </a>
                        ) : null}
                        {t.attendance_pdf_url ? (
                          <a
                            href={t.attendance_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                          >
                            <Eye className="w-4 h-4" />
                            Session PDF
                          </a>
                        ) : null}
                        {!t.pdf_url && !t.attendance_pdf_url ? (
                          <span className="text-xs text-gray-400">No PDF</span>
                        ) : null}
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
