import type { NextRequest } from 'next/server';
import { handleJsaReportPdfGet } from '@/lib/jsa-report-pdf-handler';

/**
 * `/reports/jsa/pdf` — same PDF as `/api/reports/jsa/pdf` for mobile WebView + downloads.
 *
 * Params: `id` (JSA form uuid), or `date` + `project_id` / `project`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handleJsaReportPdfGet(req);
}
