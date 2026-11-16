import { handleJsaReportPdfGet } from '@/lib/jsa-report-pdf-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleJsaReportPdfGet(request);
}
