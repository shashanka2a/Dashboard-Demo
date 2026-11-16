import { isUuidLike } from '@/lib/is-uuid';

/**
 * Canonical daily report URLs — use these from dashboard, mobile WebView, and share links.
 *
 * Query (all routes):
 *   - `date=YYYY-MM-DD` (required)
 *   - `project_id=<uuid>` (preferred on mobile) or `project=<name>`
 *
 * HTML (fast, interactive — legacy preview):
 *   - `/reports/daily?…`  or  `/api/reports/daily?…`
 *
 * PDF (same output as dashboard download — Chrome print, vector text + links):
 *   - Preview in WebView: `/reports/daily/pdf?…&preview=1`  (`Content-Disposition: inline`)
 *   - Download / share file: `/reports/daily/pdf?…`  (`Content-Disposition: attachment`)
 *   - API equivalents: `/api/reports/daily/pdf?…`
 */

export type DailyReportQueryInput = {
  date: string;
  projectName?: string | null;
  projectId?: string | null;
};

/** Build query string for daily report HTML + PDF routes. */
export function buildDailyReportQuery(input: DailyReportQueryInput): URLSearchParams {
  const params = new URLSearchParams();
  const date = (input.date || '').trim().slice(0, 10);
  if (date) params.set('date', date);

  const name = (input.projectName || '').trim();
  if (name && !isUuidLike(name) && !/^Project [0-9a-f]{8}/i.test(name)) {
    params.set('project', name);
    return params;
  }

  const id = (input.projectId || (isUuidLike(name) ? name : null))?.trim();
  if (id) params.set('project_id', id);
  else if (name) params.set('project', name);

  return params;
}

export function dailyReportHtmlPath(
  query: URLSearchParams | string,
  opts?: { api?: boolean }
): string {
  const q = typeof query === 'string' ? query : query.toString();
  return opts?.api ? `/api/reports/daily?${q}` : `/reports/daily?${q}`;
}

export type DailyReportPdfPathOptions = {
  /** Use `/api/reports/daily/pdf` instead of `/reports/daily/pdf`. */
  api?: boolean;
  /** Inline PDF for WebView preview (same bytes as download). */
  preview?: boolean;
};

export function dailyReportPdfPath(
  query: URLSearchParams | string,
  opts?: DailyReportPdfPathOptions
): string {
  const p = new URLSearchParams(typeof query === 'string' ? query : query.toString());
  p.delete('preview');
  p.delete('disposition');
  p.delete('download');
  if (opts?.preview) p.set('preview', '1');
  const q = p.toString();
  return opts?.api ? `/api/reports/daily/pdf?${q}` : `/reports/daily/pdf?${q}`;
}

/** Whether the request should return PDF inline (preview) vs attachment (download). */
export function dailyReportPdfDispositionInline(searchParams: URLSearchParams): boolean {
  if (searchParams.get('preview') === '1') return true;
  if (searchParams.get('disposition') === 'inline') return true;
  if (searchParams.get('download') === '1') return false;
  if (searchParams.get('disposition') === 'attachment') return false;
  return false;
}
