import type { SupabaseClient } from '@supabase/supabase-js';
import { formatYmdInTimeZone, getActivityDisplayTimeZone } from '@/lib/activity-display-timezone';

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * `audit_log` rows written by field sync triggers: `entity_id` is the source row id,
 * `entity_type` is the table name (`incidents`, `safety_talks`, …).
 * Returns distinct entity ids for the given project(s) whose audit row falls on `dateYmd`
 * in the display timezone, or whose `report_date` on the audit row matches `dateYmd`.
 */
export async function entityIdsFromAuditLogForProjectDay(
  supabase: SupabaseClient,
  opts: {
    entityType: 'incidents' | 'safety_talks';
    projectIds: string[];
    dateYmd: string;
  }
): Promise<string[]> {
  const { entityType, projectIds, dateYmd } = opts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd) || projectIds.length === 0) return [];

  const lo = `${addDaysYmd(dateYmd, -2)}T00:00:00.000Z`;
  const hi = `${addDaysYmd(dateYmd, 2)}T23:59:59.999Z`;
  const tz = getActivityDisplayTimeZone();

  let q = supabase
    .from('audit_log')
    .select('entity_id, created_at, report_date, project_id')
    .eq('entity_type', entityType)
    .in('project_id', projectIds)
    .or(`report_date.eq.${dateYmd},and(created_at.gte.${lo},created_at.lte.${hi}))`);

  const { data, error } = await q;
  if (error) {
    console.warn(`[audit_log] ${entityType} id lookup:`, error.message);
    return [];
  }

  const ids = new Set<string>();
  for (const row of data || []) {
    const id = String((row as { entity_id?: string | null }).entity_id ?? '').trim();
    if (!id) continue;
    const rep = (row as { report_date?: string | null }).report_date;
    if (rep != null && String(rep).trim().slice(0, 10) === dateYmd) {
      ids.add(id);
      continue;
    }
    const ca = (row as { created_at?: string | null }).created_at;
    if (ca && formatYmdInTimeZone(new Date(String(ca)), tz) === dateYmd) ids.add(id);
  }
  return [...ids];
}

export async function fetchTableRowsByIds<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: 'incidents' | 'safety_talks',
  ids: string[],
  projectIds: string[] | null
): Promise<T[]> {
  const unique = [...new Set(ids.map((x) => String(x).trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const chunkSize = 200;
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    let q = supabase.from(table).select('*').in('id', chunk);
    if (projectIds?.length === 1) q = q.eq('project_id', projectIds[0]);
    else if (projectIds && projectIds.length > 1) q = q.in('project_id', projectIds);
    const { data, error } = await q;
    if (error) {
      console.warn(`[${table}] fetch by audit ids:`, error.message);
      continue;
    }
    out.push(...((data || []) as T[]));
  }
  return out;
}
