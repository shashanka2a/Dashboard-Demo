import type { SupabaseClient } from '@supabase/supabase-js';

/** Site survey prompts created for each project unless customized in project settings (Yes / No / N/A + optional notes). */

export type PositiveAnswer = 'Yes' | 'No';

export const DEFAULT_SITE_SURVEY_QUESTIONS = [
  'Were there any equipment malfunctions on-site today?',
  'Were there any accidents or near-misses?',
  'Were there any weather delays today?',
  'Were there any safety concerns or hazards observed?',
  'Were all PPE requirements properly followed?',
  'Was any emergency equipment inspected or used?',
  'Were there any trespassing or security incidents?',
  'Were there any environmental concerns (spill, contamination)?',
  'Is any additional follow-up required for tomorrow?',
] as const;

export type SurveyDefaultRow = {
  question: string;
  sort_order: number;
  requires_text_description: boolean;
  positive_answer: PositiveAnswer;
};

/**
 * Infer which Yes/No answer is the "good" (green) outcome from question wording.
 * Problem / incident style → No is green. Confirmation / compliance → Yes is green.
 */
export function inferPositiveAnswer(question: string): PositiveAnswer {
  const q = question.trim().toLowerCase();
  if (!q) return 'Yes';

  // Explicit confirmations / compliance checks → Yes is good
  if (
    /\bdo you confirm\b/.test(q) ||
    /\bwere all\b/.test(q) ||
    /\bproperly followed\b/.test(q) ||
    /\bcompleted correctly\b/.test(q) ||
    /\buploaded correctly\b/.test(q) ||
    /\bclocked in and out correctly\b/.test(q) ||
    /\badequate treatment\b/.test(q)
  ) {
    return 'Yes';
  }

  // Problem / incident / "any X happened?" style → No is good
  if (
    /^any\b/.test(q) ||
    /\bwere there any\b/.test(q) ||
    /\bwas there any\b/.test(q) ||
    /\bis any additional follow-up\b/.test(q) ||
    /\baccident/.test(q) ||
    /\bnear[- ]?miss/.test(q) ||
    /\bmalfunction/.test(q) ||
    /\bhazard/.test(q) ||
    /\bsafety concern/.test(q) ||
    /\benvironmental concern/.test(q) ||
    /\bspill\b/.test(q) ||
    /\bcontamination\b/.test(q) ||
    /\btrespass/.test(q) ||
    /\bsecurity incident/.test(q) ||
    /\bweather delay/.test(q) ||
    /\bvisitor/.test(q)
  ) {
    return 'No';
  }

  return 'Yes';
}

export function surveyDefaultTemplatesForProject(projectId: string) {
  return DEFAULT_SITE_SURVEY_QUESTIONS.map((question, sort_order) => ({
    project_id: projectId,
    question,
    sort_order,
    requires_text_description: false,
    positive_answer: inferPositiveAnswer(question),
  }));
}

function hardcodedDefaults(): SurveyDefaultRow[] {
  return DEFAULT_SITE_SURVEY_QUESTIONS.map((question, sort_order) => ({
    question,
    sort_order,
    requires_text_description: false,
    positive_answer: inferPositiveAnswer(question),
  }));
}

/** Load company defaults from DB, falling back to built-in list if table is empty or missing. */
export async function fetchCompanySurveyDefaults(
  supabase: SupabaseClient
): Promise<SurveyDefaultRow[]> {
  const { data, error } = await supabase
    .from('company_survey_question_defaults')
    .select('question, sort_order, requires_text_description, positive_answer')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (/company_survey_question_defaults/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
      return hardcodedDefaults();
    }
    throw error;
  }

  if (!data?.length) return hardcodedDefaults();

  return data.map((row) => ({
    question: row.question,
    sort_order: row.sort_order,
    requires_text_description: !!row.requires_text_description,
    positive_answer:
      row.positive_answer === 'Yes' || row.positive_answer === 'No'
        ? row.positive_answer
        : inferPositiveAnswer(String(row.question || '')),
  }));
}

/** Rows ready to insert into survey_question_templates for a new project. */
export async function companySurveyDefaultTemplatesForProject(
  supabase: SupabaseClient,
  projectId: string
) {
  const defaults = await fetchCompanySurveyDefaults(supabase);
  return defaults.map((d) => ({
    project_id: projectId,
    question: d.question,
    sort_order: d.sort_order,
    requires_text_description: d.requires_text_description,
    positive_answer: d.positive_answer,
  }));
}
