import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getDailyReportListItems } from '@/lib/daily-report-index';
import { filterReportsForMainDashboard } from '@/lib/activity-excluded-projects';
import { reportListRangeBounds } from '@/lib/report-list-date-range';
import { PROJECTS_RAW_CACHE_KEY } from '@/lib/dashboard-data-cache';

export const dynamic = 'force-dynamic';

/** One request: 30d report cards + project/client filter metadata for `/reports`. */
export async function GET(request: Request) {
  const range = new URL(request.url).searchParams.get('range') || '30d';
  const { from, to } = reportListRangeBounds(range);

  const [projectsRes, clientsRes, reports] = await Promise.all([
    supabaseServer.from('projects').select('id, name').order('name'),
    supabaseServer
      .from('clients')
      .select('id, name, company_name')
      .order('name'),
    getDailyReportListItems({ from, to }),
  ]);

  const res = NextResponse.json({
    reports: filterReportsForMainDashboard(reports),
    projects: projectsRes.data ?? [],
    clients: clientsRes.data ?? [],
    range,
    projectsCacheKey: PROJECTS_RAW_CACHE_KEY,
  });
  res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
  return res;
}
