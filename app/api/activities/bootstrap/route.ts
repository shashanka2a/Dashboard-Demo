import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { fetchActivitiesFeedRows } from '@/lib/activities-feed-server';
import { filterProjectNamesForMainDashboard } from '@/lib/activity-excluded-projects';
import { PROJECTS_RAW_CACHE_KEY } from '@/lib/dashboard-data-cache';

export const dynamic = 'force-dynamic';

/** One round-trip payload for the main Activity dashboard (feed + filter metadata). */
export async function GET() {
  const [projectsRes, employeesRes, activities] = await Promise.all([
    supabaseServer.from('projects').select('id, name').order('name'),
    supabaseServer.from('employees').select('name').order('name'),
    fetchActivitiesFeedRows(supabaseServer, 50, { fast: true }),
  ]);

  const projects = projectsRes.data ?? [];
  const rawProjectNames = projects.map((p) => String(p.name));
  const memberNames = (employeesRes.data ?? []).map((e) => String(e.name));

  const res = NextResponse.json({
    activities,
    projectNames: filterProjectNamesForMainDashboard(rawProjectNames),
    memberNames,
    projects,
    projectsCacheKey: PROJECTS_RAW_CACHE_KEY,
  });
  res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
  return res;
}
