"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown, Loader2, Printer } from "lucide-react";
import { buildJsaReportPdfFileName, downloadJsaReportPdf } from "@/lib/jsa-report-pdf";
import { jsaReportHtmlPath } from "@/lib/jsa-report-urls";

function buildReportApiQuery(sp: URLSearchParams): string {
  const p = new URLSearchParams(sp.toString());
  p.delete("download");
  return p.toString();
}

function JsaFullReportInner() {
  const sp = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  const reportQuery = buildReportApiQuery(sp);
  const reportUrl = jsaReportHtmlPath(reportQuery, { api: true });

  const fileName = buildJsaReportPdfFileName(
    sp.get("date") || "report",
    sp.get("project")?.trim() || sp.get("project_id") || sp.get("id") || "project"
  );

  const downloadPdf = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await downloadJsaReportPdf(reportQuery, fileName);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not generate PDF.");
    } finally {
      setBusy(false);
    }
  }, [reportQuery, fileName]);

  const handlePrint = () => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  const onIframeLoad = useCallback(() => {
    if (sp.get("download") !== "1" || autoTriggered.current) return;
    autoTriggered.current = true;
    void downloadPdf();
  }, [sp, downloadPdf]);

  useEffect(() => {
    if (sp.get("download") === "1") {
      const t = window.setTimeout(() => void downloadPdf(), 1500);
      return () => window.clearTimeout(t);
    }
  }, [sp, downloadPdf]);

  return (
    <div className="min-h-screen bg-gray-700 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="text-sm text-gray-500 hover:text-gray-800">
            &larr; Reports
          </Link>
          <h1 className="text-sm font-semibold text-gray-900">JSA &amp; Pre-Brief</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#F44336] text-white rounded-lg hover:bg-[#E53935] disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {busy ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>
      {err ? <div className="bg-red-50 text-red-700 text-sm px-4 py-2 text-center">{err}</div> : null}
      <iframe
        ref={iframeRef}
        src={reportUrl}
        onLoad={onIframeLoad}
        className="flex-1 w-full border-0 bg-gray-600"
        title="JSA Report"
      />
    </div>
  );
}

export default function JsaFullReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading JSA report…</div>}>
      <JsaFullReportInner />
    </Suspense>
  );
}
