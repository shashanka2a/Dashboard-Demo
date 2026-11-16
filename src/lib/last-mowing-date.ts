import type { SupabaseClient } from '@supabase/supabase-js';
import { reportDateColumnToYmd } from '@/lib/report-date-filter';

const MOWING_KEYS = ['mowing_array_completed', 'mowing_green_space_completed'] as const;

function positive(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0;
}

/**
 * Report day of the most recent metrics log that has mowing acres entered
 * (mowing array and/or mowing green space > 0). Null when none exists.
 */
export async function fetchLastMowingDateFromMetrics(
  supabase: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('metrics')
    .select('report_date, logged_at, metric_values')
    .eq('project_id', projectId)
    .order('report_date', { ascending: false, nullsFirst: false })
    .order('logged_at', { ascending: false })
    .limit(200);
  if (error || !data) return null;

  let best: string | null = null;
  for (const row of data as { report_date?: unknown; logged_at?: unknown; metric_values?: unknown }[]) {
    const values = row.metric_values;
    if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
    const v = values as Record<string, unknown>;
    if (!MOWING_KEYS.some((k) => positive(v[k]))) continue;
    const ymd =
      reportDateColumnToYmd(row.report_date) ??
      (row.logged_at ? String(row.logged_at).slice(0, 10) : null);
    if (ymd && (!best || ymd > best)) best = ymd;
  }
  return best;
}
