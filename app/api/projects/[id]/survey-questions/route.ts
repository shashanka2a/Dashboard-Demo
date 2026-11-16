import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { inferPositiveAnswer } from '@/lib/survey-default-questions';

type PositiveAnswer = 'Yes' | 'No';

type TemplateRow = {
  id: string;
  question: string;
  sort_order: number;
  requires_text_description: boolean;
  positive_answer: PositiveAnswer;
};

// GET /api/projects/[id]/survey-questions
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  const { data, error } = await supabaseServer
    .from('survey_question_templates')
    .select('id, question, sort_order, requires_text_description, positive_answer')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const questions = (data || []) as TemplateRow[];
  return NextResponse.json({
    answerChoices: ['Yes', 'No', 'N/A'] as const,
    questions,
  });
}

type PutBody = {
  questions?: Array<{
    id?: string | null;
    question: string;
    sort_order?: number;
    requires_text_description?: boolean;
    positive_answer?: PositiveAnswer;
  }>;
};

function normalizePositiveAnswer(value: unknown, question: string): PositiveAnswer {
  if (value === 'No' || value === 'Yes') return value;
  return inferPositiveAnswer(question);
}

// PUT /api/projects/[id]/survey-questions — replace all templates for this project
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;
  let body: PutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = Array.isArray(body.questions) ? body.questions : [];
  const normalized: Array<{
    question: string;
    sort_order: number;
    requires_text_description: boolean;
    positive_answer: PositiveAnswer;
  }> = raw
    .map((q, index) => {
      const question = typeof q.question === 'string' ? q.question.trim() : '';
      return {
        question,
        sort_order: typeof q.sort_order === 'number' && Number.isFinite(q.sort_order) ? q.sort_order : index,
        requires_text_description: !!q.requires_text_description,
        positive_answer: normalizePositiveAnswer(q?.positive_answer, question),
      };
    })
    .filter((q) => q.question.length > 0);

  const { error: delErr } = await supabaseServer
    .from('survey_question_templates')
    .delete()
    .eq('project_id', projectId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (normalized.length === 0) {
    return NextResponse.json({
      answerChoices: ['Yes', 'No', 'N/A'] as const,
      questions: [] as TemplateRow[],
    });
  }

  const insertRows = normalized.map((q) => ({
    project_id: projectId,
    question: q.question,
    sort_order: q.sort_order,
    requires_text_description: q.requires_text_description,
    positive_answer: q.positive_answer,
  }));

  const { data: inserted, error: insErr } = await supabaseServer
    .from('survey_question_templates')
    .insert(insertRows)
    .select('id, question, sort_order, requires_text_description, positive_answer');

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({
    answerChoices: ['Yes', 'No', 'N/A'] as const,
    questions: (inserted || []) as TemplateRow[],
  });
}
