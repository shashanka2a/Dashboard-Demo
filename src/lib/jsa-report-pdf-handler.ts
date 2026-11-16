import { NextResponse } from 'next/server';
import { getRequestOrigin } from '@/lib/daily-report-pdf-handler';
import { buildJsaReportPdfFileName } from '@/lib/jsa-report-pdf';
import { jsaReportPdfDispositionInline } from '@/lib/jsa-report-urls';
import { isUuidLike } from '@/lib/is-uuid';
import { renderUrlToPdfBuffer } from '@/lib/render-html-pdf';
import { resolveProjectRow } from '@/lib/resolve-project';
import { supabaseServer } from '@/lib/supabase-server';

/** Shared GET handler for `/api/reports/jsa/pdf` and `/reports/jsa/pdf`. */
export async function handleJsaReportPdfGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const jsaId = url.searchParams.get('id')?.trim() || url.searchParams.get('jsa_id')?.trim() || null;
  const dateParam = url.searchParams.get('date')?.trim() || null;
  let projectParam = url.searchParams.get('project');
  let projectIdParam = url.searchParams.get('project_id');

  if (!projectIdParam && projectParam && isUuidLike(projectParam)) {
    projectIdParam = projectParam.trim();
    projectParam = null;
  }

  if (!jsaId && (!dateParam || ((!projectParam || projectParam === 'All Projects') && !projectIdParam))) {
    return NextResponse.json(
      { error: 'Provide JSA id, or date and project (or project_id).' },
      { status: 400 }
    );
  }

  let fileLabel = projectParam?.trim() || 'project';
  let reportDate = dateParam || 'report';

  if (jsaId) {
    const { data: formRow, error } = await supabaseServer
      .from('jsa_forms')
      .select('id, project_id, report_date, site_name')
      .eq('id', jsaId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!formRow) {
      return NextResponse.json({ error: 'JSA form not found.' }, { status: 404 });
    }
    reportDate = String(formRow.report_date ?? dateParam ?? '').slice(0, 10) || reportDate;
    const site = formRow.site_name != null ? String(formRow.site_name).trim() : '';
    const pid = String(formRow.project_id ?? '');
    if (site) {
      fileLabel = site;
    } else if (pid) {
      const { data: project } = await supabaseServer.from('projects').select('name').eq('id', pid).maybeSingle();
      if (project?.name) fileLabel = String(project.name);
    }
  } else {
    const { row: projectRow } = await resolveProjectRow(supabaseServer, {
      projectId: projectIdParam,
      projectName: projectParam?.trim() || null,
    });
    if (projectRow?.name) fileLabel = projectRow.name;
  }

  const htmlParams = new URLSearchParams(url.searchParams);
  htmlParams.delete('preview');
  htmlParams.delete('disposition');
  htmlParams.delete('download');

  const origin = getRequestOrigin(request);
  const htmlUrl = new URL(`/api/reports/jsa?${htmlParams.toString()}`, origin);
  const inline = jsaReportPdfDispositionInline(url.searchParams);

  try {
    const pdf = await renderUrlToPdfBuffer(htmlUrl.toString(), { waitSelector: '.report-sheet' });
    const fileName = buildJsaReportPdfFileName(reportDate, fileLabel);
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
    console.error('[jsa-report-pdf]', err);
    const message =
      err instanceof Error ? err.message : 'Could not generate PDF from JSA report HTML.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
