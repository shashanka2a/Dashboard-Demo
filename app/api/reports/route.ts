import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getDailyReportListItems } from '@/lib/daily-report-index';
import { filterJsaReports, getJsaReportListItems } from '@/lib/jsa-report-index';
import { reportListRangeBounds } from '@/lib/report-list-date-range';

export const dynamic = 'force-dynamic';

function normName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

function ymdOrNull(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function projectIdsForClient(clientId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const { data: access } = await supabaseServer
    .from('client_project_access')
    .select('project_id')
    .eq('client_id', clientId);
  for (const row of access ?? []) {
    if (row.project_id) ids.add(String(row.project_id));
  }

  // Also match projects whose client_name equals the client's company/contact name
  const { data: client } = await supabaseServer
    .from('clients')
    .select('name, company_name')
    .eq('id', clientId)
    .maybeSingle();
  const names = [client?.company_name, client?.name]
    .map((n) => (n != null ? String(n).trim() : ''))
    .filter(Boolean);
  if (names.length) {
    const { data: projects } = await supabaseServer
      .from('projects')
      .select('id, client_name');
    for (const p of projects ?? []) {
      const cn = p.client_name != null ? String(p.client_name).trim() : '';
      if (!cn) continue;
      if (names.some((n) => normName(n) === normName(cn))) {
        ids.add(String(p.id));
      }
    }
  }
  return ids;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project');
    const clientId = searchParams.get('client')?.trim() || null;
    const range = searchParams.get('range');
    let from = ymdOrNull(searchParams.get('from'));
    let to = ymdOrNull(searchParams.get('to'));

    if (!from && !to) {
      const bounds = reportListRangeBounds(range);
      from = bounds.from;
      to = bounds.to;
    }

    const reportType = searchParams.get('type')?.trim().toLowerCase() || 'daily';

    let clientProjectIds: Set<string> | null = null;
    if (clientId) {
      clientProjectIds = await projectIdsForClient(clientId);
    }

    if (reportType === 'jsa') {
      const items = await getJsaReportListItems();
      const filtered = filterJsaReports(items, {
        project,
        from,
        to,
        clientProjectIds,
      });
      return NextResponse.json(filtered);
    }

    const formattedData = await getDailyReportListItems({ from, to });

    const filtered = formattedData.filter((r) => {
      if (project && project !== 'All Projects' && normName(r.projectName) !== normName(project)) {
        return false;
      }
      if (clientProjectIds) {
        if (!r.projectId || !clientProjectIds.has(r.projectId)) return false;
      }
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });

    const res = NextResponse.json(filtered);
    if (from && to && !project && !clientId) {
      res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
    }
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
