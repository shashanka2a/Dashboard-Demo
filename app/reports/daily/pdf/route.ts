import type { NextRequest } from 'next/server';
import { handleDailyReportPdfGet } from '@/lib/daily-report-pdf-handler';

/**
 * `/reports/daily/pdf` — same PDF as `/api/reports/daily/pdf` for mobile WebView + downloads.
 *
 * - `preview=1` → inline PDF (preview)
 * - default → attachment (download / “Save as…”)
 *
 * Params: `date`, `project_id` or `project` (same as `/reports/daily` HTML).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handleDailyReportPdfGet(req);
}
