import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { DEFAULT_SITE_SURVEY_QUESTIONS, inferPositiveAnswer } from '@/lib/survey-default-questions';

export const dynamic = 'force-dynamic';

type PositiveAnswer = 'Yes' | 'No';

type TemplateRow = {
  id: string;
  question: string;
  sort_order: number;
  requires_text_description: boolean;
  positive_answer: PositiveAnswer;
};

type PutBody = {
  questions?: Array<{
    question: string;
    sort_order?: number;
    requires_text_description?: boolean;
    positive_answer?: PositiveAnswer;
  }>;
  applyToAllProjects?: boolean;
};

function normalizePositiveAnswer(value: unknown, question: string): PositiveAnswer {
  if (value === 'No' || value === 'Yes') return value;
  return inferPositiveAnswer(question);
}

function normalizeQuestions(raw: PutBody['questions']): Array<{
  question: string;
  sort_order: number;
  requires_text_description: boolean;
  positive_answer: PositiveAnswer;
}> {
  const list = Array.isArray(raw) ? raw : [];
  return list
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
}

async function applyDefaultsToAllProjects(
  defaults: Array<{
    question: string;
    sort_order: number;
    requires_text_description: boolean;
    positive_answer: 'Yes' | 'No';
  }>
) {
  const { data: projects, error: projErr } = await supabaseServer.from('projects').select('id');
  if (projErr) throw new Error(projErr.message);

  for (const project of projects ?? []) {
    const { error: delErr } = await supabaseServer
      .from('survey_question_templates')
      .delete()
      .eq('project_id', project.id);
    if (delErr) throw new Error(delErr.message);

    if (defaults.length === 0) continue;

    const { error: insErr } = await supabaseServer.from('survey_question_templates').insert(
      defaults.map((d) => ({
        project_id: project.id,
        question: d.question,
        sort_order: d.sort_order,
        requires_text_description: d.requires_text_description,
        positive_answer: d.positive_answer,
      }))
    );
    if (insErr) throw new Error(insErr.message);
  }

  return (projects ?? []).length;
}

// GET /api/company/survey-questions — company default site survey question list
export async function GET() {
  const { data, error } = await supabaseServer
    .from('company_survey_question_defaults')
    .select('id, question, sort_order, requires_text_description, positive_answer')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (/company_survey_question_defaults/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
      const questions = DEFAULT_SITE_SURVEY_QUESTIONS.map((question, sort_order) => ({
        id: `builtin-${sort_order}`,
        question,
        sort_order,
        requires_text_description: false,
        positive_answer: inferPositiveAnswer(question),
      }));
      return NextResponse.json({ answerChoices: ['Yes', 'No', 'N/A'] as const, questions });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const questions = (data ?? []) as TemplateRow[];
  if (questions.length === 0) {
    const fallback = DEFAULT_SITE_SURVEY_QUESTIONS.map((question, sort_order) => ({
      id: `builtin-${sort_order}`,
      question,
      sort_order,
      requires_text_description: false,
      positive_answer: inferPositiveAnswer(question),
    }));
    return NextResponse.json({ answerChoices: ['Yes', 'No', 'N/A'] as const, questions: fallback });
  }

  return NextResponse.json({
    answerChoices: ['Yes', 'No', 'N/A'] as const,
    questions,
  });
}

// PUT /api/company/survey-questions — replace company defaults; optional applyToAllProjects
export async function PUT(request: Request) {
  let body: PutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const normalized = normalizeQuestions(body.questions);

  const { error: delErr } = await supabaseServer
    .from('company_survey_question_defaults')
    .delete()
    .gte('sort_order', 0);
  if (delErr) {
    if (/company_survey_question_defaults/i.test(delErr.message) && /does not exist|schema cache/i.test(delErr.message)) {
      return NextResponse.json(
        { error: 'Run migration create_company_survey_question_defaults.sql first.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  let questions: TemplateRow[] = [];
  if (normalized.length > 0) {
    const { data: inserted, error: insErr } = await supabaseServer
      .from('company_survey_question_defaults')
      .insert(
        normalized.map((q) => ({
          question: q.question,
          sort_order: q.sort_order,
          requires_text_description: q.requires_text_description,
          positive_answer: q.positive_answer,
          updated_at: new Date().toISOString(),
        }))
      )
      .select('id, question, sort_order, requires_text_description, positive_answer');

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    questions = (inserted ?? []) as TemplateRow[];
  }

  let projectsUpdated: number | undefined;
  if (body.applyToAllProjects) {
    try {
      projectsUpdated = await applyDefaultsToAllProjects(normalized);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to apply defaults to projects';
      return NextResponse.json({ error: msg, questions }, { status: 500 });
    }
  }

  return NextResponse.json({
    answerChoices: ['Yes', 'No', 'N/A'] as const,
    questions,
    ...(projectsUpdated !== undefined ? { projectsUpdated } : {}),
  });
}
