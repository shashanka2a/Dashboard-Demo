import { NextResponse } from 'next/server';
import { buildDailyReportPdfFileName } from '@/lib/daily-report-pdf';
import { dailyReportPdfDispositionInline } from '@/lib/daily-report-urls';
import { renderUrlToPdfBuffer } from '@/lib/render-html-pdf';
import { resolveProjectRow } from '@/lib/resolve-project';
import { isUuidLike } from '@/lib/is-uuid';
import { supabaseServer } from '@/lib/supabase-server';

/** Stable origin for server-side `fetch` of report HTML (dev, reverse proxy, Vercel). */
export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
    return `${proto}://${host}`;
  }
  return url.origin;
}

/** Shared GET handler for `/api/reports/daily/pdf` and `/reports/daily/pdf`. */
export async function handleDailyReportPdfGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date');
  let projectParam = url.searchParams.get('project');
  let projectIdParam = url.searchParams.get('project_id');

  if (!projectIdParam && projectParam && isUuidLike(projectParam)) {
    projectIdParam = projectParam.trim();
    projectParam = null;
  }

  if (!dateParam || ((!projectParam || projectParam === 'All Projects') && !projectIdParam)) {
    return NextResponse.json(
      { error: 'Provide date and project (or project_id).' },
      { status: 400 }
    );
  }

  const { row: projectRow } = await resolveProjectRow(supabaseServer, {
    projectId: projectIdParam,
    projectName: projectParam?.trim() || null,
  });
  const projectName = projectRow?.name || projectParam || 'project';

  const htmlParams = new URLSearchParams(url.searchParams);
  htmlParams.delete('preview');
  htmlParams.delete('disposition');
  htmlParams.delete('download');
  htmlParams.set('pdf', '1');

  const origin = getRequestOrigin(request);
  const htmlUrl = new URL(`/api/reports/daily?${htmlParams.toString()}`, origin);
  const inline = dailyReportPdfDispositionInline(url.searchParams);

  try {
    const pdf = await renderUrlToPdfBuffer(htmlUrl.toString(), { waitSelector: '.report-sheet' });
    const fileName = buildDailyReportPdfFileName(dateParam, projectName);
    const disposition = inline ? 'inline' : 'attachment';

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[daily-report-pdf]', err);
    const message =
      err instanceof Error ? err.message : 'Could not generate PDF from report HTML.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
