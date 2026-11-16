import {
  formatYmdInTimeZone,
  getActivityDisplayTimeZone,
  normalizeInstantToYmd,
} from '@/lib/activity-display-timezone';
import { resolveEquipmentChecklistReportYmd } from '@/lib/equipment-checklist';

export function utcDayBoundsIso(dateYmd: string): { start: string; end: string } {
  return {
    start: `${dateYmd}T00:00:00.000Z`,
    end: `${dateYmd}T23:59:59.999Z`,
  };
}

export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function parseFormDataForWorkDate(raw: unknown): string | null {
  if (raw == null) return null;
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) obj = p as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return null;
  for (const k of [
    'selectedDate',
    'selected_date',
    'reportDate',
    'report_date',
    'reportDay',
    'report_day',
    'logDate',
    'log_date',
    'workDate',
    'work_day',
    'calendarDate',
    'calendar_date',
    'fieldDate',
    'field_date',
    'date',
    'day',
  ]) {
    const v = obj[k];
    if (v == null || !String(v).trim()) continue;
    const y = normalizeInstantToYmd(String(v));
    if (y) return y;
  }
  return null;
}

/**
 * Postgres `date` / `report_date` column → YYYY-MM-DD.
 * Do not apply display timezone (calendar day is not an instant).
 */
export function reportDateColumnToYmd(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const head = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return head ? head[1] : null;
}

/** Work / report calendar day: `report_date` column first, then optional form_data / legacy columns. */
export function resolveRowReportDateYmd(row: Record<string, unknown>): string | null {
  const fromCol = reportDateColumnToYmd(row.report_date);
  if (fromCol) return fromCol;

  const fromForm = parseFormDataForWorkDate(row.form_data);
  if (fromForm) return fromForm;

  for (const key of [
    'selected_date',
    'selected_at',
    'calendar_date',
    'work_date',
    'field_date',
    'attachment_date',
    'activity_date',
    'date',
  ]) {
    const c = row[key];
    if (c == null || !String(c).trim()) continue;
    const y = normalizeInstantToYmd(String(c));
    if (y) return y;
  }

  const checklistYmd = resolveEquipmentChecklistReportYmd(row);
  if (checklistYmd) return checklistYmd;

  return null;
}

export function loggedAtYmd(row: Record<string, unknown>): string | null {
  const ts = row.logged_at ?? row.created_at;
  if (ts == null || !String(ts).trim()) return null;
  const tz = getActivityDisplayTimeZone();
  return formatYmdInTimeZone(new Date(String(ts)), tz);
}

/** Whether this row belongs on the daily report for `dateYmd` (report day, not submission day). */
export function rowMatchesReportDay(row: Record<string, unknown>, dateYmd: string): boolean {
  const reportYmd = resolveRowReportDateYmd(row);
  if (reportYmd) return reportYmd === dateYmd;
  const logged = loggedAtYmd(row);
  return logged === dateYmd;
}

export function rowReportDateInRange(
  row: Record<string, unknown>,
  startYmd: string,
  endYmd: string
): boolean {
  const reportYmd = resolveRowReportDateYmd(row);
  if (reportYmd) return reportYmd >= startYmd && reportYmd <= endYmd;
  const logged = loggedAtYmd(row);
  if (!logged) return false;
  return logged >= startYmd && logged <= endYmd;
}

/** PostgREST `.or()` filter: `report_date` = day, else `logged_at` on that UTC day. */
export function supabaseReportDayOrFilter(dateYmd: string): string {
  const { start, end } = utcDayBoundsIso(dateYmd);
  return `report_date.eq.${dateYmd},and(report_date.is.null,logged_at.gte.${start},logged_at.lte.${end})`;
}

/**
 * Wider `logged_at` window for rows whose `report_date` differs from submission day
 * (e.g. submitted May 20 for April 1 work).
 */
/** PostgREST `.or()` for rows whose work day may fall in [from, to] (report_date or padded logged_at). */
export function supabaseFieldRowsInReportRangeFilter(from: string, to: string, padDays = 21): string {
  const loggedFrom = `${addDaysYmd(from, -padDays)}T00:00:00.000Z`;
  const loggedTo = `${addDaysYmd(to, padDays)}T23:59:59.999Z`;
  return `and(report_date.gte.${from},report_date.lte.${to}),and(report_date.is.null,logged_at.gte.${loggedFrom},logged_at.lte.${loggedTo})`;
}

export function supabaseReportDayOrFilterWide(dateYmd: string, padDays = 21): string {
  const lo = `${addDaysYmd(dateYmd, -padDays)}T00:00:00.000Z`;
  const hi = `${addDaysYmd(dateYmd, padDays)}T23:59:59.999Z`;
  return `report_date.eq.${dateYmd},and(report_date.is.null,logged_at.gte.${lo},logged_at.lte.${hi})`;
}

export function filterRowsByReportDay<T extends Record<string, unknown>>(
  rows: T[],
  dateYmd: string
): T[] {
  return rows.filter((r) => rowMatchesReportDay(r, dateYmd));
}

/** Calendar day to index in Reports list / header dots. */
export function calendarDayForFieldRow(row: Record<string, unknown>): string | null {
  return resolveRowReportDateYmd(row) ?? loggedAtYmd(row);
}
