import type { SupabaseClient } from '@supabase/supabase-js';
import type { Activity } from '@/components/ActivityScreen';
import { formatLoggedAtReportLine } from '@/lib/activity-display-timezone';
import { reportDateColumnToYmd, resolveRowReportDateYmd } from '@/lib/report-date-filter';

type TimeRow = { logged_at: string; report_date: unknown };

type AuditTimeRow = {
  entity_id: string | null;
  entity_type: string | null;
  created_at: string;
  report_date: string | null;
  op: string | null;
};

/** Activity type (lowercase) → audit `entity_type` values. */
const AUDIT_TYPES_BY_ACTIVITY_TYPE: Record<string, string[]> = {
  notes: ['notes'],
  metrics: ['metrics'],
  chemicals: ['chemicals_logs'],
  checklists: ['equipment_checklists', 'equipment_logs'],
  incidents: ['incidents'],
  observations: ['observations'],
  survey: ['surveys'],
  attachments: ['attachments'],
  'safety talks': ['safety_talks'],
  reports: ['daily_signed_reports'],
};

/** Fallback tables when no audit row exists. */
const TABLES_BY_ACTIVITY_TYPE: Record<string, string[]> = {
  notes: ['notes'],
  metrics: ['metrics'],
  chemicals: ['chemicals_logs'],
  checklists: ['equipment_checklists', 'equipment_logs'],
  incidents: ['incidents'],
  observations: ['observations'],
  survey: ['surveys'],
  attachments: ['attachments'],
};

/**
 * `audit_log` is the source of truth:
 *  - submitted time  = `created_at` of the first (insert) audit row
 *  - report day      = `report_date` of the newest audit row that has one
 */
async function fetchAuditTimes(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, AuditTimeRow[]>> {
  const map = new Map<string, AuditTimeRow[]>();
  const unique = [...new Set(ids)].filter(Boolean);
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('audit_log')
      .select('entity_id, entity_type, created_at, report_date, op:details->>op')
      .in('entity_id', chunk);
    if (error) {
      console.warn('[activity-report-timestamps] audit_log:', error.message);
      continue;
    }
    for (const row of (data || []) as unknown as AuditTimeRow[]) {
      const id = String(row.entity_id ?? '').trim();
      if (!id) continue;
      const arr = map.get(id) ?? [];
      arr.push(row);
      map.set(id, arr);
    }
  }
  return map;
}

function resolveFromAudit(
  item: Activity,
  auditById: Map<string, AuditTimeRow[]>
): TimeRow | null {
  const types = AUDIT_TYPES_BY_ACTIVITY_TYPE[item.activityType.trim().toLowerCase()] ?? [];
  const rows = (auditById.get(item.id) ?? []).filter(
    (r) => types.length === 0 || types.includes(String(r.entity_type ?? ''))
  );
  if (!rows.length) return null;

  const asc = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const insert = asc.find((r) => String(r.op ?? '').toLowerCase() === 'insert') ?? asc[0];
  const submitted = insert?.created_at;
  if (!submitted) return null;

  const withReport = [...asc].reverse().find((r) => reportDateColumnToYmd(r.report_date));
  return { logged_at: submitted, report_date: withReport?.report_date ?? null };
}

async function fetchTableRows(
  supabase: SupabaseClient,
  items: Activity[]
): Promise<Map<string, TimeRow>> {
  const out = new Map<string, TimeRow>();
  const idsByTable = new Map<string, Set<string>>();
  for (const item of items) {
    const tables = TABLES_BY_ACTIVITY_TYPE[item.activityType.trim().toLowerCase()] ?? [];
    for (const table of tables) {
      if (!idsByTable.has(table)) idsByTable.set(table, new Set());
      idsByTable.get(table)!.add(item.id);
    }
  }

  for (const [table, idSet] of idsByTable) {
    const ids = [...idSet];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase.from(table).select('*').in('id', chunk);
      if (error) {
        console.warn(`[activity-report-timestamps] ${table}:`, error.message);
        continue;
      }
      for (const row of (data || []) as Record<string, unknown>[]) {
        const id = String(row.id ?? '').trim();
        if (!id || out.has(id)) continue;
        const logged = String(row.logged_at ?? row.created_at ?? '').trim();
        if (!logged) continue;
        const report_date =
          reportDateColumnToYmd(row.report_date) ??
          (table === 'attachments' ? reportDateColumnToYmd(row.selected_date) : null) ??
          resolveRowReportDateYmd(row);
        out.set(id, { logged_at: logged, report_date });
      }
    }
  }
  return out;
}

/** Audit log first (created_at + report_date), then source table as fallback. */
export async function enrichActivitiesWithReportTimestamps(
  supabase: SupabaseClient,
  items: Activity[]
): Promise<Activity[]> {
  if (items.length === 0) return items;

  const auditById = await fetchAuditTimes(
    supabase,
    items.map((i) => i.id)
  );

  const needTable = items.filter((i) => {
    const a = resolveFromAudit(i, auditById);
    return !a || !reportDateColumnToYmd(a.report_date);
  });
  const tableById = needTable.length ? await fetchTableRows(supabase, needTable) : new Map();

  return items.map((item) => {
    const audit = resolveFromAudit(item, auditById);
    const table = tableById.get(item.id) as TimeRow | undefined;

    const logged = audit?.logged_at ?? table?.logged_at ?? item.isoTimestamp;
    if (!logged) return item;

    const reportYmd =
      reportDateColumnToYmd(audit?.report_date) ??
      reportDateColumnToYmd(table?.report_date) ??
      reportDateColumnToYmd(item.reportDateYmd) ??
      reportDateColumnToYmd(item.selectedDateYmd);

    return {
      ...item,
      timestamp: formatLoggedAtReportLine(logged, reportYmd, reportDateColumnToYmd),
      isoTimestamp: logged,
      reportDateYmd: reportYmd,
    };
  });
}
