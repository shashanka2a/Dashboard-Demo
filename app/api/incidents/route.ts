import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { formatYmdInTimeZone, getActivityDisplayTimeZone } from '@/lib/activity-display-timezone';
import { entityIdsFromAuditLogForProjectDay, fetchTableRowsByIds } from '@/lib/audit-log-entity-ids';
import { isIncidentClosedStatus, isIncidentOpenStatus } from '@/lib/incident-status';
import { incidentEmployeeInfoIncomplete } from '@/lib/incident-employee-info';

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function incidentDisplayDate(row: {
  incident_date?: string | null;
  report_date?: string | null;
  logged_at?: string | null;
}): string {
  const id = row.incident_date != null ? String(row.incident_date).trim().slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) return id;
  const rd = row.report_date != null ? String(row.report_date).trim().slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rd)) return rd;
  if (row.logged_at) {
    return formatYmdInTimeZone(new Date(String(row.logged_at)), getActivityDisplayTimeZone());
  }
  return '';
}

function injuredNames(row: { injured_employee_info?: unknown }): string[] {
  const raw = row.injured_employee_info;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === 'string') return x.trim();
      if (x && typeof x === 'object' && 'name' in x) return String((x as { name?: string }).name || '').trim();
      return '';
    })
    .filter(Boolean);
}

function matchesSearch(
  row: Record<string, unknown>,
  projectName: string,
  q: string
): boolean {
  const needle = q.toLowerCase();
  const hay = [
    row.title,
    row.description,
    row.location,
    row.injury_illness_type,
    row.status,
    projectName,
    incidentDisplayDate(row as { incident_date?: string; report_date?: string; logged_at?: string }),
    ...injuredNames(row as { injured_employee_info?: unknown }),
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
  return hay.includes(needle);
}

// GET /api/incidents?project=<name>&date=<YYYY-MM-DD>&status=open|closed|all&q=<search>
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get('project');
  const date = searchParams.get('date');
  const statusFilter = (searchParams.get('status') || 'all').trim().toLowerCase();
  const q = (searchParams.get('q') || '').trim();

  let projectId: string | null = null;
  if (projectName && projectName !== 'All Projects') {
    const { data: proj } = await supabaseServer.from('projects').select('id').eq('name', projectName).single();
    projectId = proj?.id ?? null;
  }

  let query = supabaseServer.from('incidents').select('*').order('logged_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const lo = `${addDaysYmd(date, -2)}T00:00:00.000Z`;
    const hi = `${addDaysYmd(date, 2)}T23:59:59.999Z`;
    query = query.or(`report_date.eq.${date},and(logged_at.gte.${lo},logged_at.lte.${hi}))`);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let list: any[] = rows ?? [];

  let auditDayIds = new Set<string>();
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && projectId) {
    const auditIds = await entityIdsFromAuditLogForProjectDay(supabaseServer, {
      entityType: 'incidents',
      projectIds: [projectId],
      dateYmd: date,
    });
    auditDayIds = new Set(auditIds);
    if (auditIds.length) {
      const extra = await fetchTableRowsByIds(supabaseServer, 'incidents', auditIds, [projectId]);
      const byId = new Map<string, any>(list.map((r) => [String(r.id), r]));
      for (const r of extra) byId.set(String(r.id), r);
      list = [...byId.values()];
    }
  }

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const tz = getActivityDisplayTimeZone();
    list = list.filter((row: { id?: string; report_date?: unknown; logged_at?: string | null }) => {
      if (auditDayIds.has(String(row.id ?? ''))) return true;
      const rd = row.report_date != null ? String(row.report_date).trim().slice(0, 10) : '';
      if (rd === date) return true;
      if (!row.logged_at) return false;
      return formatYmdInTimeZone(new Date(String(row.logged_at)), tz) === date;
    });
  }

  const projectIds = [...new Set(list.map((r) => String(r.project_id || '')).filter(Boolean))];
  let projectNameById: Record<string, string> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabaseServer.from('projects').select('id, name').in('id', projectIds);
    projectNameById = Object.fromEntries(
      (projects || []).map((p) => [String((p as { id: string }).id), String((p as { name?: string }).name || '')])
    );
  }

  let enriched = list.map((row) => {
    const pid = String(row.project_id || '');
    return {
      ...row,
      project_name: projectNameById[pid] || 'Unknown project',
      display_date: incidentDisplayDate(row),
      injured_names: injuredNames(row),
      employee_info_incomplete: incidentEmployeeInfoIncomplete(row.injured_employee_info),
    };
  });

  if (statusFilter === 'open') {
    enriched = enriched.filter((r) => isIncidentOpenStatus(r.status));
  } else if (statusFilter === 'closed') {
    enriched = enriched.filter((r) => isIncidentClosedStatus(r.status));
  }

  if (q) {
    enriched = enriched.filter((r) => matchesSearch(r, r.project_name, q));
  }

  enriched.sort((a, b) => {
    const da = a.display_date || '';
    const db = b.display_date || '';
    if (da !== db) return db.localeCompare(da);
    const ta = a.logged_at ? new Date(String(a.logged_at)).getTime() : 0;
    const tb = b.logged_at ? new Date(String(b.logged_at)).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json(enriched);
}
