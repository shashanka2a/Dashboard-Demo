"use client";

import { FileDown, ChevronDown, FileText, Check, Minus, Shield, AlertCircle } from "lucide-react";
import { useState } from "react";
import { buildJsaReportPdfFileName, downloadJsaReportPdf } from "@/lib/jsa-report-pdf";
import { buildJsaReportQuery, jsaReportHtmlPath } from "@/lib/jsa-report-urls";
import type { JsaReportListItem } from "@/lib/jsa-types";

interface JsaReportCardProps {
  report: JsaReportListItem;
}

function buildJsaReportParams(report: JsaReportListItem): URLSearchParams {
  return buildJsaReportQuery({
    id: report.id,
    date: report.date || new Date().toISOString().split("T")[0],
    projectName: report.projectName,
    projectId: report.projectId,
  });
}

export function JsaReportCard({ report }: JsaReportCardProps) {
  const isSigned = Boolean(report.reportSigned);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const reportQuery = () => buildJsaReportParams(report).toString();

  const openFullReport = (opts?: { downloadPdf?: boolean }) => {
    const q = reportQuery();
    const suffix = opts?.downloadPdf ? "&download=1" : "";
    window.open(`/reports/jsa-full?${q}${suffix}`, "_blank", "noopener,noreferrer");
  };

  const onDownloadPdfClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadError(null);
    const label = report.siteName?.trim() || report.projectName;
    const fileName = buildJsaReportPdfFileName(report.date, label);

    try {
      await downloadJsaReportPdf(reportQuery(), fileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not download PDF.";
      setDownloadError(msg);
      console.error("JSA report download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const displayTitle = report.siteName?.trim() || report.projectName;

  return (
    <div
      className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200"
      role="article"
      aria-label={`JSA report for ${displayTitle}${isSigned ? ", signed" : ", not signed"}`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 p-5 text-left hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-200"
          aria-expanded={isExpanded}
          aria-controls={`jsa-report-details-${report.id}`}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5"
              role="img"
              aria-label={isSigned ? "PDF — signed" : "PDF — not signed yet"}
            >
              <div className="relative w-[2.125rem] h-[2.75rem] rounded-sm border-2 border-gray-400 bg-white flex flex-col items-center justify-end pb-0.5 shadow-sm">
                <div
                  className="absolute top-0 right-0 w-2.5 h-2.5 border-l border-b border-gray-400 bg-gray-100"
                  style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }}
                  aria-hidden
                />
                <FileText className="w-3.5 h-3.5 text-gray-500 mb-px" strokeWidth={1.75} aria-hidden />
                <span className="text-[7px] font-extrabold text-gray-600 leading-none tracking-wide">PDF</span>
              </div>
              {isSigned ? (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"
                  title="Signed"
                >
                  <Check className="w-3 h-3" strokeWidth={3} aria-hidden />
                </span>
              ) : (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm ring-1 ring-amber-500/40"
                  title="Not signed"
                >
                  <Minus className="w-3 h-3" strokeWidth={3} aria-hidden />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-black text-base mb-1">
                JSA &amp; Pre-Brief — {displayTitle}
              </h3>
              <p className="text-xs text-gray-500">{report.timestamp}</p>

              <div className="flex items-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded">
                  <Shield className="w-4 h-4 text-[#FF6633]" />
                  <span>{report.fieldSupervisor || "No supervisor"}</span>
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {report.projectName}
                </span>
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-0.5 pr-3 flex-shrink-0 self-stretch">
          <button
            type="button"
            onClick={(e) => void onDownloadPdfClick(e)}
            disabled={isDownloading}
            className="p-2 hover:bg-[#FFEBEE] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F44336]/40 disabled:opacity-50"
            aria-label="Download JSA PDF"
            title="Download PDF"
          >
            <FileDown className="w-4 h-4 text-[#F44336]" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200"
            aria-expanded={isExpanded}
            aria-controls={`jsa-report-details-${report.id}`}
            aria-label={isExpanded ? "Collapse report" : "Expand report"}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {downloadError ? (
        <div className="px-5 py-2 bg-red-50 text-red-700 text-sm flex items-center gap-2 border-t border-red-100">
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden />
          {downloadError}
        </div>
      ) : null}

      {isExpanded && (
        <div
          id={`jsa-report-details-${report.id}`}
          className="border-t border-gray-100 bg-gray-50 animate-slideDown p-4"
        >
          <iframe
            src={jsaReportHtmlPath(reportQuery(), { api: true })}
            className="w-full h-[600px] bg-white rounded-lg shadow-inner"
            style={{ border: "none" }}
            title="JSA Report Preview"
          />
          <div className="pt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openFullReport();
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-800 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium focus:outline-none"
            >
              Open full screen
            </button>
            <button
              type="button"
              onClick={(e) => void onDownloadPdfClick(e)}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-[#F44336] text-white rounded-lg hover:bg-[#E53935] transition-colors text-sm font-medium focus:outline-none flex-shrink-0 disabled:opacity-60"
            >
              <FileDown className="w-4 h-4" />
              {isDownloading ? "Downloading..." : "Download PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
