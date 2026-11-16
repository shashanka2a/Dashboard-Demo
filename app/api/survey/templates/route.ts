import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/survey/templates?project_id=<uuid>
 * GET /api/survey/templates?project=<exact project name>
 *
 * Same payload as GET /api/projects/[id]/survey-questions — for mobile clients that resolve project by name.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id')?.trim();
  const projectName = searchParams.get('project')?.trim();

  let resolvedId: string | null = projectId || null;

  if (!resolvedId && projectName && projectName !== 'All Projects') {
    const { data: proj, error } = await supabaseServer.from('projects').select('id').eq('name', projectName).single();
    if (error || !proj?.id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    resolvedId = proj.id;
  }

  if (!resolvedId) {
    return NextResponse.json({ error: 'Missing project_id or project' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('survey_question_templates')
    .select('id, question, sort_order, requires_text_description, positive_answer')
    .eq('project_id', resolvedId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    project_id: resolvedId,
    answerChoices: ['Yes', 'No', 'N/A'] as const,
    questions: data ?? [],
  });
}
