/**
 * Daily report PDF — client download helpers.
 * Server PDF: `/reports/daily/pdf` (mobile + web) or `/api/reports/daily/pdf`.
 */
import { dailyReportPdfPath } from '@/lib/daily-report-urls';
export const REPORT_SHEET_WIDTH_PX = 850;

export function sanitizePdfFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
}

/** `daily-report-2026-09-15-ARTIFACT-SOLAR-SITE-TESTING.pdf` */
export function buildDailyReportPdfFileName(dateYmd: string, projectName: string): string {
  const date = sanitizePdfFileName(dateYmd || 'report');
  const project = sanitizePdfFileName(projectName || 'project');
  return `daily-report-${date}-${project}.pdf`;
}

export function appendPdfExportQuery(reportApiQuery: string): string {
  const p = new URLSearchParams(reportApiQuery);
  p.set('pdf', '1');
  return p.toString();
}

export function readProjectNameFromReportDocument(doc: Document): string | null {
  const h1 = doc.querySelector('.report-header h1');
  const text = h1?.textContent?.trim();
  return text || null;
}

/** Download vector PDF from the server (same HTML as preview). */
export async function downloadDailyReportPdf(reportApiQuery: string, fileName: string): Promise<void> {
  const res = await fetch(dailyReportPdfPath(reportApiQuery, { api: true }), {
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

/**
 * Legacy raster export (JSA and other non-daily reports). Prefer server PDF for daily reports.
 */
export async function waitForReportImages(root: HTMLElement, timeoutMs = 20000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  const deadline = Date.now() + timeoutMs;

  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          const finish = () => resolve();
          if (img.complete && img.naturalWidth > 0) {
            finish();
            return;
          }
          img.addEventListener('load', finish, { once: true });
          img.addEventListener('error', finish, { once: true });
          const poll = () => {
            if (img.complete) finish();
            else if (Date.now() > deadline) finish();
            else window.setTimeout(poll, 40);
          };
          poll();
        })
    )
  );

  const doc = root.ownerDocument;
  if (doc?.fonts?.ready) {
    try {
      await doc.fonts.ready;
    } catch {
      /* ignore */
    }
  }
}

export async function getReportRootFromIframe(iframe: HTMLIFrameElement): Promise<HTMLElement> {
  const doc = iframe.contentDocument;
  if (!doc?.body) throw new Error('Report content is unavailable.');
  const reportRoot = (doc.querySelector('.report-sheet') as HTMLElement | null) ?? doc.body;
  await waitForReportImages(reportRoot);
  return reportRoot;
}

export async function downloadElementAsMultiPagePdf(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    scale: Math.max(2, Math.min(2.5, window.devicePixelRatio || 2)),
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: REPORT_SHEET_WIDTH_PX,
    imageTimeout: 20000,
    onclone: (clonedDoc) => {
      clonedDoc.body.style.background = '#fff';
      const sheet = clonedDoc.querySelector('.report-sheet') as HTMLElement | null;
      if (sheet) {
        sheet.style.boxShadow = 'none';
        sheet.style.margin = '0';
        sheet.style.maxWidth = `${REPORT_SHEET_WIDTH_PX}px`;
      }
      clonedDoc.querySelectorAll('.report-photo-download, .note-photo-download').forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    },
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidthMm = pageWidth;
  const sliceHeightPx = (pageHeight * canvas.width) / imgWidthMm;
  const minUsefulSlicePx = Math.max(10, Math.floor(sliceHeightPx * 0.08));

  let y = 0;
  let first = true;

  while (y < canvas.height) {
    const sliceH = Math.min(sliceHeightPx, canvas.height - y);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceH;
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');

    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (!first && sliceH <= minUsefulSlicePx) {
      const { data, width, height } = ctx.getImageData(0, 0, pageCanvas.width, pageCanvas.height);
      let inked = 0;
      const step = Math.max(1, Math.floor((width * height) / 12000));
      for (let i = 0; i < width * height; i += step) {
        const o = i * 4;
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];
        if (r < 245 || g < 245 || b < 245) inked++;
      }
      if (inked <= 3) break;
    }

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
    const sliceMmH = (sliceH * imgWidthMm) / canvas.width;

    if (!first) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidthMm, sliceMmH);
    first = false;
    y += sliceH;
  }

  pdf.save(fileName);
}
