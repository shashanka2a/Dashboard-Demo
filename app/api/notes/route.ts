import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { filterRowsByReportDay, supabaseReportDayOrFilterWide } from '@/lib/report-date-filter';

// GET /api/notes?project=<name>&date=<YYYY-MM-DD>
// `date` is the report/work day (mobile `report_date`), not upload `logged_at` alone.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get('project');
  const date = searchParams.get('date');

  let projectId: string | null = null;
  if (projectName && projectName !== 'All Projects') {
    const { data: proj } = await supabaseServer.from('projects').select('id').eq('name', projectName).single();
    projectId = proj?.id ?? null;
  }

  let query = supabaseServer.from('notes').select('*').order('logged_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    query = query.or(supabaseReportDayOrFilterWide(date));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []) as Record<string, unknown>[];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    rows = filterRowsByReportDay(rows, date);
  }

  return NextResponse.json(rows);
}
