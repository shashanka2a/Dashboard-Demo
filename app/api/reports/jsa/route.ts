import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { resolveProjectRow } from '@/lib/resolve-project';
import { isUuidLike } from '@/lib/is-uuid';
import { buildJsaReportHtml } from '@/lib/jsa-report-html';
import { fetchJsaHazardsFromAudit } from '@/lib/jsa-hazards-from-audit';
import { normalizeJsaRiskLevel } from '@/lib/jsa-risk';
import type { JsaCrewSignature, JsaFormRow, JsaHazardRow } from '@/lib/jsa-types';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseCrewSignatures(raw: unknown): JsaCrewSignature[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s != null && typeof s === 'object')
    .map((s) => ({
      name: String(s.name ?? '').trim(),
      signature_url: s.signature_url != null ? String(s.signature_url) : null,
      signed_at: s.signed_at != null ? String(s.signed_at) : null,
    }))
    .filter((s) => s.name.length > 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jsaId = searchParams.get('id')?.trim() || searchParams.get('jsa_id')?.trim() || null;
  const dateParam = searchParams.get('date')?.trim() || null;
  let projectParam = searchParams.get('project');
  let projectIdParam = searchParams.get('project_id');

  if (!projectIdParam && projectParam && isUuidLike(projectParam)) {
    projectIdParam = projectParam.trim();
    projectParam = null;
  }

  if (!jsaId && (!dateParam || ((!projectParam || projectParam === 'All Projects') && !projectIdParam))) {
    return new NextResponse('Please select a specific project and date, or provide a JSA form id.', {
      status: 400,
    });
  }

  let formRow: Record<string, unknown> | null = null;

  if (jsaId) {
    const { data, error } = await supabaseServer.from('jsa_forms').select('*').eq('id', jsaId).maybeSingle();
    if (error) {
      if (/jsa_forms/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
        return new NextResponse('JSA tables are not migrated yet. Run create_jsa_tables.sql.', { status: 503 });
      }
      return new NextResponse(error.message, { status: 500 });
    }
    formRow = data as Record<string, unknown> | null;
  } else {
    const { row: projectRow, error: resolveErr } = await resolveProjectRow(supabaseServer, {
      projectId: projectIdParam,
      projectName: projectParam?.trim() || null,
    });
    if (resolveErr || !projectRow?.id) {
      return new NextResponse(
        `<div style="padding:40px;font-family:sans-serif"><h2>Project not found</h2><p>${escapeHtml(resolveErr || 'Unknown project')}</p></div>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    const { data, error } = await supabaseServer
      .from('jsa_forms')
      .select('*')
      .eq('project_id', projectRow.id)
      .eq('report_date', dateParam)
      .maybeSingle();
    if (error) {
      return new NextResponse(error.message, { status: 500 });
    }
    formRow = data as Record<string, unknown> | null;
  }

  if (!formRow) {
    return new NextResponse(
      `<div style="padding:40px;font-family:sans-serif"><h2>No JSA form found</h2><p>No signed JSA exists for this project and date yet.</p></div>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const formId = String(formRow.id);
  const projectId = String(formRow.project_id ?? '');

  const [{ data: hazards }, { data: objectives }, { data: checks }, { data: project }] = await Promise.all([
    supabaseServer
      .from('jsa_hazards')
      .select('id, hazard, risk_level, control_measure, sort_order')
      .eq('jsa_form_id', formId)
      .order('sort_order', { ascending: true }),
    supabaseServer.from('company_jsa_objectives').select('name').order('sort_order', { ascending: true }),
    supabaseServer.from('company_jsa_project_checks').select('name').order('sort_order', { ascending: true }),
    supabaseServer.from('projects').select('id, name').eq('id', projectId).maybeSingle(),
  ]);

  const form: JsaFormRow = {
    id: formId,
    project_id: projectId,
    report_date: String(formRow.report_date ?? '').slice(0, 10),
    logged_at: String(formRow.logged_at ?? ''),
    site_name: formRow.site_name != null ? String(formRow.site_name) : null,
    client_name: formRow.client_name != null ? String(formRow.client_name) : null,
    field_supervisor: formRow.field_supervisor != null ? String(formRow.field_supervisor) : null,
    gate_gps_coordinates: formRow.gate_gps_coordinates != null ? String(formRow.gate_gps_coordinates) : null,
    specific_areas: formRow.specific_areas != null ? String(formRow.specific_areas) : null,
    success_lookback: formRow.success_lookback != null ? String(formRow.success_lookback) : null,
    selected_objectives: Array.isArray(formRow.selected_objectives)
      ? formRow.selected_objectives.map(String)
      : [],
    completed_checks: Array.isArray(formRow.completed_checks) ? formRow.completed_checks.map(String) : [],
    first_aid_location: formRow.first_aid_location != null ? String(formRow.first_aid_location) : null,
    nearest_hospital: formRow.nearest_hospital != null ? String(formRow.nearest_hospital) : null,
    emergency_signal: formRow.emergency_signal != null ? String(formRow.emergency_signal) : null,
    stop_work_authority_confirmed: Boolean(formRow.stop_work_authority_confirmed),
    one_thing_dangerous: formRow.one_thing_dangerous != null ? String(formRow.one_thing_dangerous) : null,
    crew_signatures: parseCrewSignatures(formRow.crew_signatures),
    signed_at: formRow.signed_at != null ? String(formRow.signed_at) : null,
    pdf_url: formRow.pdf_url != null ? String(formRow.pdf_url) : null,
    status: String(formRow.status) === 'signed' ? 'signed' : 'draft',
    submitted_by_name: formRow.submitted_by_name != null ? String(formRow.submitted_by_name) : null,
    submitted_by_user_id: formRow.submitted_by_user_id != null ? String(formRow.submitted_by_user_id) : null,
  };

  const hazardRows: JsaHazardRow[] = (hazards ?? []).map((h) => ({
    id: String(h.id),
    hazard: String(h.hazard ?? ''),
    risk_level: normalizeJsaRiskLevel(h.risk_level),
    control_measure: h.control_measure != null ? String(h.control_measure) : null,
    sort_order: typeof h.sort_order === 'number' ? h.sort_order : 0,
  }));

  // Table rows first; otherwise use hazards stored in the field app's audit snapshots.
  const finalHazards =
    hazardRows.length > 0 ? hazardRows : await fetchJsaHazardsFromAudit(supabaseServer, formId);

  const html = await buildJsaReportHtml({
    form,
    hazards: finalHazards,
    projectName: String(project?.name ?? 'Project'),
    allObjectives: (objectives ?? []).map((o) => String(o.name)),
    allChecks: (checks ?? []).map((c) => String(c.name)),
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
