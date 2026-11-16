import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  filterRowsByReportDay,
  supabaseReportDayOrFilterWide,
} from '@/lib/report-date-filter';
import { latestMetricsPerProjectDay } from '@/lib/metric-values';

// GET /api/metrics?project=<name>&date=<YYYY-MM-DD>
// Date filter uses report_date (work day), matching mobile sync + daily reports —
// not UTC logged_at alone (submission time can fall on a different calendar day).
// Multiple submits for the same project+day collapse to the latest row only.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get('project');
  const date = searchParams.get('date'); // YYYY-MM-DD

  let projectId: string | null = null;
  if (projectName && projectName !== 'All Projects') {
    const { data: proj } = await supabaseServer
      .from('projects')
      .select('id')
      .eq('name', projectName)
      .single();
    projectId = proj?.id ?? null;
  }

  let query = supabaseServer
    .from('metrics')
    .select('*')
    .order('logged_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    query = query.or(supabaseReportDayOrFilterWide(date));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []) as Record<string, unknown>[];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    rows = filterRowsByReportDay(rows, date);
  }

  return NextResponse.json(latestMetricsPerProjectDay(rows));
}
