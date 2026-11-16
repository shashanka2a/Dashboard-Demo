import { sanitizePdfFileName } from '@/lib/daily-report-pdf';
import { jsaReportPdfPath } from '@/lib/jsa-report-urls';

/** `jsa-report-2026-09-15-ARTIFACT-SOLAR-SITE-TESTING.pdf` */
export function buildJsaReportPdfFileName(dateYmd: string, label: string): string {
  const date = sanitizePdfFileName(dateYmd || 'report');
  const project = sanitizePdfFileName(label || 'project');
  return `jsa-report-${date}-${project}.pdf`;
}

/** Download vector PDF from the server (same HTML as preview). */
export async function downloadJsaReportPdf(reportApiQuery: string, fileName: string): Promise<void> {
  const res = await fetch(jsaReportPdfPath(reportApiQuery, { api: true }), {
    credentials: 'include',
    cache: 'no-store',
  });

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      const text = await res.text().catch(() => '');
      if (text) detail = text.slice(0, 240);
    }
    throw new Error(detail || 'Could not generate PDF.');
  }

  if (!contentType.includes('application/pdf')) {
    const text = await res.text().catch(() => '');
    throw new Error(
      text.includes('error')
        ? text.slice(0, 240)
        : 'Server did not return a PDF. Check that Chromium/Puppeteer is available on the server.'
    );
  }

  const blob = await res.blob();
  const header = await blob.slice(0, 5).text();
  if (!header.startsWith('%PDF')) {
    throw new Error('Download failed: response was not a valid PDF file.');
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
