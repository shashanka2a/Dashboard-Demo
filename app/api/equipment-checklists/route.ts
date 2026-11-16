import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { equipmentChecklistMatchesReportDate } from '@/lib/equipment-checklist';

export const dynamic = 'force-dynamic';

// GET /api/equipment-checklists?project=<name>&date=<YYYY-MM-DD>
// Date filter uses report_date (work day), not submission logged_at.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get('project');
  const date = searchParams.get('date');

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
    .from('equipment_checklists')
    .select('*')
    .order('logged_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []) as Record<string, unknown>[];
  if (date) {
    rows = rows.filter((row) => equipmentChecklistMatchesReportDate(row, date));
  }

  return NextResponse.json(rows);
}
