/** Calendar day (YYYY-MM-DD) the signed report applies to: `report_date` when set, else UTC date of `signed_at` only (not `created_at`). */
export function calendarDayForSignedRow(row: {
  report_date?: unknown;
  signed_at?: string | null;
  created_at?: string | null;
}): string | null {
  const rd = row.report_date != null ? String(row.report_date).trim().slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rd)) return rd;
  const ts = row.signed_at;
  if (!ts) return null;
  return new Date(ts).toISOString().split('T')[0];
}

/**
 * True when a `daily_signed_reports` row has an actual signature.
 * Unsigned drafts may exist with report_date / prepared_by but empty signature_url —
 * those must NOT show as signed on calendar, reports list, or client portal.
 */
export function dailySignedReportRowLooksSigned(r: {
  is_signed?: boolean | null;
  signature_url?: string | null;
}): boolean {
  if (r.is_signed === true) return true;
  const sig = typeof r.signature_url === 'string' ? r.signature_url.trim() : '';
  if (!sig) return false;
  if (sig.startsWith('http://') || sig.startsWith('https://')) return true;
  if (sig.startsWith('data:image')) return true;
  return sig.length > 80;
}
