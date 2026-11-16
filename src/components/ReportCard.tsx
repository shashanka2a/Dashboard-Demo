"use client";

import { FileDown, CloudRain, Cloud, Sun, ChevronDown, FileText, AlertCircle, Check, Minus } from "lucide-react";
import { useState, useEffect } from "react";
import { buildDailyReportPdfFileName, downloadDailyReportPdf } from "@/lib/daily-report-pdf";
import { buildDailyReportQuery, dailyReportHtmlPath } from "@/lib/daily-report-urls";

interface Report {
  id: string;
  projectName: string;
  /** When set, daily report API resolves by UUID (avoids name mismatch) */
  projectId?: string | null;
  date: string;
  timestamp: string;
  /** Row in `daily_signed_reports` for this project + UTC day */
  reportSigned?: boolean;
  weather: {
    high: number;
    low: number;
    condition: 'sunny' | 'rainy' | 'cloudy';
  };
  photos: string[];
  delays: number;
}

interface ReportCardProps {
  report: Report;
}

function buildDailyReportParams(report: Report): URLSearchParams {
  return buildDailyReportQuery({
    date: report.date || new Date().toISOString().split('T')[0],
    projectName: report.projectName,
    projectId: report.projectId,
  });
}

export function ReportCard({ report }: ReportCardProps) {
  const isSigned = Boolean(report.reportSigned);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [liveWeather, setLiveWeather] = useState<{
    high: number;
    low: number;
    condition: 'sunny' | 'rainy' | 'cloudy';
  } | null>(null);
  /** True after fetch when API had no numeric hi/lo (or request failed). */
  const [weatherUnavailable, setWeatherUnavailable] = useState(false);

  useEffect(() => {
    const params = buildDailyReportParams(report);
    setLiveWeather(null);
    setWeatherUnavailable(false);

    let cancelled = false;
    fetch(`/api/weather/day?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { high?: number | null; low?: number | null; condition?: string }) => {
        if (cancelled) return;
        if (typeof data.high === 'number' && typeof data.low === 'number' && data.condition) {
          const c = data.condition;
          if (c === 'sunny' || c === 'rainy' || c === 'cloudy') {
            setLiveWeather({ high: data.high, low: data.low, condition: c });
            setWeatherUnavailable(false);
            return;
          }
        }
        setWeatherUnavailable(true);
      })
      .catch(() => {
        if (!cancelled) setWeatherUnavailable(true);
      });

    return () => {
      cancelled = true;
    };
  }, [report.date, report.projectId, report.projectName]);

  const displayWeather = liveWeather ?? report.weather;
  const WeatherIcon =
    weatherUnavailable && !liveWeather
      ? Cloud
      : displayWeather.condition === 'rainy'
        ? CloudRain
        : displayWeather.condition === 'sunny'
          ? Sun
          : Cloud;

  const dailyReportQuery = () => buildDailyReportParams(report).toString();

  const openFullReport = (opts?: { downloadPdf?: boolean }) => {
    const q = dailyReportQuery();
    const suffix = opts?.downloadPdf ? "&download=1" : "";
    window.open(`/reports/full?${q}${suffix}`, "_blank", "noopener,noreferrer");
  };

  const onDownloadPdfClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadError(null);
    const fileName = buildDailyReportPdfFileName(report.date, report.projectName);

    try {
      await downloadDailyReportPdf(dailyReportQuery(), fileName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not download PDF.";
      setDownloadError(msg);
      console.error("Daily report download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200"
      role="article"
      aria-label={`Daily report for ${report.projectName}${isSigned ? ', signed' : ', not signed'}`}
    >
      {/* Card header — flex row with expand area + download button side by side */}
      <div className="flex items-stretch">
        {/* Expand area (takes up most of the row) */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 p-5 text-left hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-200"
          aria-expanded={isExpanded}
          aria-controls={`report-details-${report.id}`}
        >
          <div className="flex items-start gap-3">
            <div
              data-tour="report-card-status-0"
              className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5"
              role="img"
              aria-label={isSigned ? 'PDF — signed' : 'PDF — not signed yet'}
            >
              <div className="relative w-[2.125rem] h-[2.75rem] rounded-sm border-2 border-gray-400 bg-white flex flex-col items-center justify-end pb-0.5 shadow-sm">
                <div
                  className="absolute top-0 right-0 w-2.5 h-2.5 border-l border-b border-gray-400 bg-gray-100"
                  style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}
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
                Daily Report for {report.projectName}
              </h3>
              <p className="text-xs text-gray-500">{report.timestamp}</p>

              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-sm text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded">
                  <WeatherIcon className="w-4 h-4 text-[#2196F3]" />
                  <span>
                    {weatherUnavailable ? '—/—°F' : `${displayWeather.high}°/${displayWeather.low}°F`}
                  </span>
                </div>

                {report.delays > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[#FFF8E1] text-[#FFC107] border border-[#FFC107]/20">
                    <AlertCircle className="w-3 h-3" />
                    {report.delays} Delay
                  </span>
                )}

                {report.photos.length > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {report.photos.length} {report.photos.length === 1 ? 'photo' : 'photos'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>

        {/* Right-side actions — sibling, NOT nested inside the expand button */}
        <div className="flex items-center gap-0.5 pr-3 flex-shrink-0 self-stretch">
          <button
            data-tour="report-card-pdf-0"
            type="button"
            onClick={(e) => void onDownloadPdfClick(e)}
            disabled={isDownloading}
            className="p-2 hover:bg-[#FFEBEE] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F44336]/40 disabled:opacity-50"
            aria-label="Download PDF report"
            title="Download PDF"
          >
            <FileDown className="w-4 h-4 text-[#F44336]" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200"
            aria-expanded={isExpanded}
            aria-controls={`report-details-${report.id}`}
            aria-label={isExpanded ? 'Collapse report' : 'Expand report'}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown
              className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {downloadError ? (
        <div className="px-5 py-2 text-sm text-red-700 bg-red-50 border-t border-red-100" role="alert">
          PDF download failed: {downloadError}
        </div>
      ) : null}

      {/* Expanded API HTML iframe preview */}
      {isExpanded && (
        <div 
          id={`report-details-${report.id}`}
          className="border-t border-gray-100 bg-gray-50 animate-slideDown p-4"
        >
          <iframe 
             src={dailyReportHtmlPath(dailyReportQuery())}
             className="w-full h-[600px] bg-white rounded-lg shadow-inner"
             style={{ border: 'none' }}
             title="Daily Report Preview"
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
