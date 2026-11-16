import { writeDashboardCache, PROJECTS_RAW_CACHE_KEY } from '@/lib/dashboard-data-cache';

let inflight: Promise<void> | null = null;

function defaultReportsCacheKey(): string {
  return `reports:list:v2:${encodeURIComponent(
    ['All Projects', 'all', '30d', '', ''].join('|')
  )}`;
}

/** Warm default reports list before user opens `/reports`. */
export function prefetchReportsBootstrap(): Promise<void> {
  if (inflight) return inflight;

  inflight = fetch('/api/reports/bootstrap?range=30d', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !Array.isArray(data.reports)) return;
      writeDashboardCache(defaultReportsCacheKey(), data.reports);
      if (Array.isArray(data.projects) && data.projects.length) {
        writeDashboardCache(PROJECTS_RAW_CACHE_KEY, data.projects);
      }
    })
    .catch(() => {
      /* ignore */
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
