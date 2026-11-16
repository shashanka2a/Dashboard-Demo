/** Helpers for company-configured metric fields + metrics.metric_values jsonb. */

export type MetricFieldDef = {
  key: string;
  label: string;
  unit: string;
  sort_order?: number;
  is_active?: boolean;
};

export type MetricRowLike = {
  metric_values?: Record<string, unknown> | null;
  water_usage?: number | null;
  acres_completed?: number | null;
  green_space_completed?: number | null;
  number_of_operators?: number | null;
  [key: string]: unknown;
};

const LEGACY_COLUMN_BY_KEY: Record<string, keyof MetricRowLike> = {
  water_usage: 'water_usage',
  acres_completed: 'acres_completed',
  green_space_completed: 'green_space_completed',
  number_of_operators: 'number_of_operators',
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Prefer metrics.metric_values[key]; fall back to legacy columns for known keys.
 */
export function resolveMetricNumeric(row: MetricRowLike, key: string): number | null {
  const values = row.metric_values;
  if (values && typeof values === 'object' && !Array.isArray(values) && key in values) {
    const fromJson = toFiniteNumber(values[key]);
    if (fromJson !== null) return fromJson;
  }

  const legacyCol = LEGACY_COLUMN_BY_KEY[key];
  if (legacyCol) {
    return toFiniteNumber(row[legacyCol]);
  }

  // Soft fallback: sum related acreage keys into legacy "acres" / "green space" display keys
  if (key === 'acres_completed') {
    const a = toFiniteNumber(values?.wicking_array_completed);
    const b = toFiniteNumber(values?.mowing_array_completed);
    if (a !== null || b !== null) return (a || 0) + (b || 0);
  }
  if (key === 'green_space_completed') {
    const a = toFiniteNumber(values?.wicking_green_space_completed);
    const b = toFiniteNumber(values?.mowing_green_space_completed);
    if (a !== null || b !== null) return (a || 0) + (b || 0);
  }

  return null;
}

export function aggregateMetricField(
  rows: MetricRowLike[],
  key: string,
  mode: 'sum' | 'max' = key === 'number_of_operators' ? 'max' : 'sum'
): number {
  let sum = 0;
  let max = 0;
  let saw = false;
  for (const row of rows) {
    const n = resolveMetricNumeric(row, key);
    if (n === null) continue;
    saw = true;
    sum += n;
    max = Math.max(max, n);
  }
  if (!saw) return 0;
  return mode === 'max' ? max : sum;
}

function metricsRowLoggedAtMs(row: Record<string, unknown>): number {
  const la = row.logged_at != null ? Date.parse(String(row.logged_at)) : NaN;
  return Number.isFinite(la) ? la : 0;
}

function metricsRowDayKey(row: Record<string, unknown>): string {
  const pid = String(row.project_id ?? '').trim() || '_';
  const rd = row.report_date != null ? String(row.report_date).trim().slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rd)) return `${pid}|${rd}`;
  const la = row.logged_at != null ? String(row.logged_at).slice(0, 10) : '';
  return `${pid}|${la || 'unknown'}`;
}

/**
 * One metrics row per project + report day — keeps the latest `logged_at` submission.
 * Use for dashboard lists, activity cards, and daily-report day totals so re-submits
 * do not create duplicate cards or double-count.
 */
export function latestMetricsPerProjectDay<T extends Record<string, unknown>>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = metricsRowDayKey(row);
    const prev = best.get(key);
    if (!prev || metricsRowLoggedAtMs(row) >= metricsRowLoggedAtMs(prev)) {
      best.set(key, row);
    }
  }
  return [...best.values()].sort(
    (a, b) => metricsRowLoggedAtMs(b) - metricsRowLoggedAtMs(a)
  );
}

/** Dual-write helpers: keep legacy columns populated when syncing metric_values. */
export function legacyColumnsFromMetricValues(values: Record<string, number | null | undefined>): {
  water_usage: number | null;
  acres_completed: number | null;
  green_space_completed: number | null;
  number_of_operators: number | null;
} {
  const num = (k: string) => toFiniteNumber(values[k]);

  const water = num('water_usage');
  const ops = num('number_of_operators');

  const acresDirect = num('acres_completed');
  const acresSum =
    (num('wicking_array_completed') || 0) + (num('mowing_array_completed') || 0);
  const acres =
    acresDirect !== null
      ? acresDirect
      : num('wicking_array_completed') !== null || num('mowing_array_completed') !== null
        ? acresSum
        : null;

  const greenDirect = num('green_space_completed');
  const greenSum =
    (num('wicking_green_space_completed') || 0) + (num('mowing_green_space_completed') || 0);
  const green =
    greenDirect !== null
      ? greenDirect
      : num('wicking_green_space_completed') !== null || num('mowing_green_space_completed') !== null
        ? greenSum
        : null;

  return {
    water_usage: water,
    acres_completed: acres,
    green_space_completed: green,
    number_of_operators: ops,
  };
}
