import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCloudinaryUploadedUrls } from '@/lib/photo-url';
import { resolveProjectRow } from '@/lib/resolve-project';
import {
  filterRowsByReportDay,
  loggedAtYmd,
  resolveRowReportDateYmd,
  rowMatchesReportDay,
  rowReportDateInRange,
  supabaseReportDayOrFilterWide,
} from '@/lib/report-date-filter';

export const REPORT_FIELD_TABLES = [
  'notes',
  'metrics',
  'chemicals_logs',
  'incidents',
  'observations',
  'surveys',
  'equipment_checklists',
  'attachments',
] as const;

export type ReportFieldTable = (typeof REPORT_FIELD_TABLES)[number];

export const FIELD_AUDIT_ENTITY_TYPES = [
  'notes',
  'attachments',
  'metrics',
  'chemicals_logs',
  'incidents',
  'observations',
  'surveys',
  'equipment_checklists',
] as const;

function rows<T>(res: { data: T[] | null; error: unknown }): T[] {
  return res.data ?? [];
}

export function reportDayKey(dateYmd: string, projectId: string): string {
  return `${dateYmd}|id:${projectId}`;
}

/** Work day for a field row (report_date / form_data, else submission day). */
export function fieldRowReportDateYmd(row: Record<string, unknown>): string | null {
  return resolveRowReportDateYmd(row) ?? loggedAtYmd(row);
}

/** Whether this row counts as logged data for a Reports card on `dateYmd`. */
export function fieldRowHasReportDayContent(
  table: ReportFieldTable,
  row: Record<string, unknown>,
  dateYmd: string
): boolean {
  const projectId = String(row.project_id ?? '').trim();
  if (!projectId) return false;

  if (table === 'attachments' && !hasCloudinaryUploadedUrls(row.cloudinary_urls)) {
    return false;
  }

  if (table === 'metrics' || table === 'chemicals_logs') {
    return rowReportDateInRange(row, dateYmd, dateYmd);
  }

  return rowMatchesReportDay(row, dateYmd);
}

/** `(report day, project)` key when this row should index a report card. */
export function fieldRowReportDayKey(
  table: ReportFieldTable,
  row: Record<string, unknown>
): string | null {
  const projectId = String(row.project_id ?? '').trim();
  if (!projectId) return null;

  const dateYmd = fieldRowReportDateYmd(row);
  if (!dateYmd || !fieldRowHasReportDayContent(table, row, dateYmd)) return null;

  return reportDayKey(dateYmd, projectId);
}

/** Same field-row counts as `/api/reports/daily` `hasData`. */
export async function projectReportDayHasFieldContent(
  supabase: SupabaseClient,
  opts: {
    projectId?: string | null;
    projectName?: string | null;
    dateYmd: string;
  }
): Promise<boolean> {
  const dateYmd = String(opts.dateYmd || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return false;

  const { row: projectRow, error } = await resolveProjectRow(supabase, {
    projectId: opts.projectId ?? null,
    projectName: opts.projectName?.trim() || null,
  });
  if (error || !projectRow?.id) return false;

  const projectId = projectRow.id;
  const dayFilter = supabaseReportDayOrFilterWide(dateYmd);

  const [notesRes, metricsRes, chemRes, incidentsRes, obsRes, surveysRes, checklistsRes, attachRes] =
    await Promise.all([
      supabase.from('notes').select('logged_at, report_date, project_id, form_data').eq('project_id', projectId).or(dayFilter),
      supabase.from('metrics').select('logged_at, report_date, project_id, form_data').eq('project_id', projectId).or(dayFilter),
      supabase
        .from('chemicals_logs')
        .select('logged_at, report_date, project_id, form_data')
        .eq('project_id', projectId)
        .or(dayFilter),
      supabase.from('incidents').select('logged_at, report_date, project_id, form_data').eq('project_id', projectId).or(dayFilter),
      supabase
        .from('observations')
        .select('logged_at, report_date, project_id, form_data')
        .eq('project_id', projectId)
        .or(dayFilter),
      supabase.from('surveys').select('logged_at, report_date, project_id, form_data').eq('project_id', projectId).or(dayFilter),
      supabase
        .from('equipment_checklists')
        .select('logged_at, report_date, project_id, form_data')
        .eq('project_id', projectId)
        .or(dayFilter),
      supabase
        .from('attachments')
        .select('logged_at, report_date, project_id, form_data, cloudinary_urls')
        .eq('project_id', projectId)
        .or(dayFilter),
    ]);

  for (const [table, res] of [
    ['notes', notesRes],
    ['metrics', metricsRes],
    ['chemicals_logs', chemRes],
    ['incidents', incidentsRes],
    ['observations', obsRes],
    ['surveys', surveysRes],
    ['equipment_checklists', checklistsRes],
    ['attachments', attachRes],
  ] as const) {
    for (const row of rows(res) as Record<string, unknown>[]) {
      if (fieldRowHasReportDayContent(table, row, dateYmd)) return true;
    }
  }

  return false;
}
