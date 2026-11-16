import { supabaseServer } from '@/lib/supabase-server';
import type { JsaReportListItem } from '@/lib/jsa-types';

function normName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function getJsaReportListItems(): Promise<JsaReportListItem[]> {
  const [{ data: projects, error: projErr }, { data: forms, error: formErr }] = await Promise.all([
    supabaseServer.from('projects').select('id, name'),
    supabaseServer
      .from('jsa_forms')
      .select('id, project_id, report_date, logged_at, signed_at, status, field_supervisor, site_name')
      .order('report_date', { ascending: false })
      .order('logged_at', { ascending: false }),
  ]);

  if (projErr) console.error('[jsa-report-index] projects:', projErr.message);
  if (formErr) {
    if (/jsa_forms/i.test(formErr.message) && /does not exist|schema cache/i.test(formErr.message)) {
      return [];
    }
    console.error('[jsa-report-index] jsa_forms:', formErr.message);
    return [];
  }

  const idToName = Object.fromEntries((projects ?? []).map((p) => [String(p.id), String(p.name)]));
  const out: JsaReportListItem[] = [];

  for (const row of forms ?? []) {
    const pid = String(row.project_id ?? '');
    const projectName = idToName[pid] || `Project ${pid.slice(0, 8)}…`;
    const date = String(row.report_date ?? '').slice(0, 10);
    if (!date) continue;
    out.push({
      id: String(row.id),
      projectName,
      projectId: pid,
      date,
      // Report (work) day, same format as daily report cards — not the signed/logged time.
      timestamp: new Date(`${date}T12:00:00.000Z`).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      reportSigned: String(row.status) === 'signed' || Boolean(row.signed_at),
      fieldSupervisor: row.field_supervisor != null ? String(row.field_supervisor) : null,
      siteName: row.site_name != null ? String(row.site_name) : null,
    });
  }

  return out;
}

export function filterJsaReports(
  items: JsaReportListItem[],
  opts: {
    project?: string | null;
    projectId?: string | null;
    from?: string | null;
    to?: string | null;
    clientProjectIds?: Set<string> | null;
  }
): JsaReportListItem[] {
  const projectNorm = opts.project && opts.project !== 'All Projects' ? normName(opts.project) : null;
  return items.filter((r) => {
    if (projectNorm && normName(r.projectName) !== projectNorm) return false;
    if (opts.projectId && r.projectId !== opts.projectId) return false;
    if (opts.clientProjectIds && !opts.clientProjectIds.has(r.projectId)) return false;
    if (opts.from && r.date < opts.from) return false;
    if (opts.to && r.date > opts.to) return false;
    return true;
  });
}
