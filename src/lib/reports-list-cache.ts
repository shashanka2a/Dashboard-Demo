/** Client session cache for main dashboard reports list (default 30d). */
export const REPORTS_LIST_STALE_MS = 2 * 60 * 1000;

export function isMainReportsDefaultFilters(parts: {
  project: string;
  client: string;
  range: string;
  from: string;
  to: string;
}): boolean {
  return (
    (parts.project || 'All Projects') === 'All Projects' &&
    (parts.client || 'all') === 'all' &&
    parts.range === '30d' &&
    !parts.from &&
    !parts.to
  );
}
