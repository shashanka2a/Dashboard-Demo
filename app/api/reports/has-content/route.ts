import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { projectReportDayHasFieldContent } from '@/lib/report-day-field-content';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateYmd = searchParams.get('date')?.trim() || '';
    const projectId = searchParams.get('project_id')?.trim() || searchParams.get('projectId')?.trim() || null;
    const projectName = searchParams.get('project')?.trim() || null;

    if (!dateYmd || (!projectId && !projectName)) {
      return NextResponse.json({ error: 'date and project (or project_id) required' }, { status: 400 });
    }

    const hasContent = await projectReportDayHasFieldContent(supabaseServer, {
      projectId,
      projectName,
      dateYmd,
    });

    return NextResponse.json({ hasContent });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
