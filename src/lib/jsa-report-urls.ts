import { isUuidLike } from '@/lib/is-uuid';
import { dailyReportPdfDispositionInline } from '@/lib/daily-report-urls';

/**
 * JSA report URLs — mirror daily report conventions.
 *
 * HTML: `/reports/jsa?…` or `/api/reports/jsa?…`
 * PDF: `/reports/jsa/pdf?…` (`preview=1` inline, default attachment)
 */

export type JsaReportQueryInput = {
  id?: string | null;
  date?: string | null;
  projectName?: string | null;
  projectId?: string | null;
};

export function buildJsaReportQuery(input: JsaReportQueryInput): URLSearchParams {
  const params = new URLSearchParams();
  const id = (input.id || '').trim();
  if (id) {
    params.set('id', id);
  }

  const date = (input.date || '').trim().slice(0, 10);
  if (date) params.set('date', date);

  const name = (input.projectName || '').trim();
  if (name && !isUuidLike(name) && !/^Project [0-9a-f]{8}/i.test(name)) {
    params.set('project', name);
    return params;
  }

  const pid = (input.projectId || (isUuidLike(name) ? name : null))?.trim();
  if (pid) params.set('project_id', pid);
  else if (name) params.set('project', name);

  return params;
}

export function jsaReportHtmlPath(query: URLSearchParams | string, opts?: { api?: boolean }): string {
  const q = typeof query === 'string' ? query : query.toString();
  return opts?.api ? `/api/reports/jsa?${q}` : `/reports/jsa?${q}`;
}

export type JsaReportPdfPathOptions = {
  api?: boolean;
  preview?: boolean;
};

export function jsaReportPdfPath(
  query: URLSearchParams | string,
  opts?: JsaReportPdfPathOptions
): string {
  const p = new URLSearchParams(typeof query === 'string' ? query : query.toString());
  p.delete('preview');
  p.delete('disposition');
  p.delete('download');
  if (opts?.preview) p.set('preview', '1');
  const q = p.toString();
  return opts?.api ? `/api/reports/jsa/pdf?${q}` : `/reports/jsa/pdf?${q}`;
}

export const jsaReportPdfDispositionInline = dailyReportPdfDispositionInline;
