"use client";

import { useState } from "react";
import { Check, ChevronDown, FileDown, FileText, Loader2, Minus } from "lucide-react";
import { useClientPortal } from "@/context/ClientPortalContext";
import { ClientSectionCard } from "@/components/client/ClientUi";
import { formatClientDate } from "@/lib/client-portal";
import { buildDailyReportPdfFileName, downloadDailyReportPdf } from "@/lib/daily-report-pdf";
import { buildDailyReportQuery, dailyReportHtmlPath } from "@/lib/daily-report-urls";
import type { ClientDailyReport } from "@/lib/client-portal";

function clientDailyReportQuery(projectId: string, dateYmd: string): string {
  return buildDailyReportQuery({ date: dateYmd, projectId }).toString();
}

function ClientReportCard({
  report,
  projectId,
  projectName,
}: {
  report: ClientDailyReport;
  projectId: string;
  projectName: string;
}) {
  const isSigned = Boolean(report.report_signed);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const dateYmd = report.report_date || "";
  const dailyReportQuery = () => clientDailyReportQuery(projectId, dateYmd);

  const openFullReport = (opts?: { downloadPdf?: boolean }) => {
    const q = dailyReportQuery();
    const suffix = opts?.downloadPdf ? "&download=1" : "";
    window.open(`/client/reports/view?${q}${suffix}`, "_blank", "noopener,noreferrer");
  };

  const onDownloadPdfClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading || !dateYmd) return;

    setIsDownloading(true);
    const fileName = buildDailyReportPdfFileName(dateYmd, projectName);

    try {
      await downloadDailyReportPdf(dailyReportQuery(), fileName);
    } catch (err) {
      console.error("Daily report download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <ClientSectionCard className="!p-0 overflow-hidden">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 p-4 text-left hover:bg-[#2C2C2E]/50 transition-colors"
          aria-expanded={isExpanded}
        >
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <FileText className="h-5 w-5 text-[#FF6633]" />
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                  isSigned
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-gray-600 bg-[#2C2C2E] text-gray-500"
                }`}
                title={isSigned ? "Signed" : "Not signed yet"}
              >
                {isSigned ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{formatClientDate(report.report_date)}</p>
              {report.prepared_by ? (
                <p className="text-xs text-gray-500 mt-0.5">Prepared by {report.prepared_by}</p>
              ) : null}
            </div>
            <ChevronDown
              className={`h-5 w-5 text-gray-500 flex-shrink-0 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        <button
          type="button"
          onClick={onDownloadPdfClick}
          disabled={isDownloading}
          className="flex flex-col items-center justify-center gap-1 border-l border-[#3A3A3C] px-4 text-[#FF6633] hover:bg-[#FF6633]/10 transition-colors disabled:opacity-50"
          title="Download PDF"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wide">PDF</span>
        </button>
      </div>

      {isExpanded && dateYmd ? (
        <div className="border-t border-[#3A3A3C] bg-[#1C1C1E]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#3A3A3C]">
            <span className="text-xs text-gray-500">Report preview</span>
            <button
              type="button"
              onClick={() => openFullReport()}
              className="text-xs font-semibold text-[#FF6633] hover:underline"
            >
              Open full screen
            </button>
          </div>
          <iframe
            src={dailyReportHtmlPath(dailyReportQuery())}
            className="w-full h-[min(70vh,520px)] border-0 bg-white"
            title={`Daily report ${dateYmd}`}
          />
        </div>
      ) : null}
    </ClientSectionCard>
  );
}

export function ClientReportsPage() {
  const { overview } = useClientPortal();
  if (!overview) return null;

  const { reports, project } = overview;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Daily Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Field reports for days with logged activity.</p>
      </div>

      {reports.length === 0 ? (
        <ClientSectionCard>
          <p className="text-sm text-gray-500 text-center py-8">
            No daily reports yet — reports appear when field data is logged for a day.
          </p>
        </ClientSectionCard>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <ClientReportCard report={r} projectId={project.id} projectName={project.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
