/**
 * All activity timestamps shown in the dashboard use this IANA zone
 * (Florida → Eastern). Override with NEXT_PUBLIC_ACTIVITIES_DISPLAY_TZ or ACTIVITIES_DISPLAY_TZ.
 */
const DEFAULT_ACTIVITY_DISPLAY_TZ = 'America/New_York';

export function getActivityDisplayTimeZone(): string {
  if (typeof process === 'undefined') return DEFAULT_ACTIVITY_DISPLAY_TZ;
  return (
    process.env.NEXT_PUBLIC_ACTIVITIES_DISPLAY_TZ?.trim() ||
    process.env.ACTIVITIES_DISPLAY_TZ?.trim() ||
    DEFAULT_ACTIVITY_DISPLAY_TZ
  );
}

/** Calendar YYYY-MM-DD for an instant in the display zone. */
export function formatYmdInTimeZone(d: Date, timeZone = getActivityDisplayTimeZone()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatTimeHmAmInTimeZone(d: Date, timeZone = getActivityDisplayTimeZone()): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
}

/**
 * Parse a value to YYYY-MM-DD. Bare `YYYY-MM-DD` is returned as-is (calendar/work day).
 * Anything else is parsed as a time instant and converted to the display zone date.
 */
export function normalizeInstantToYmd(s: string, timeZone = getActivityDisplayTimeZone()): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return formatYmdInTimeZone(d, timeZone);
}

export function calendarYmdKeyInTimeZone(d: Date, timeZone = getActivityDisplayTimeZone()): string {
  return formatYmdInTimeZone(d, timeZone);
}

/** e.g. "May 9" */
export function formatMonthDayInTimeZone(iso: string, timeZone = getActivityDisplayTimeZone()): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(d);
}

/** e.g. "May 9, 3:45 PM" */
export function formatMonthDayTimeInTimeZone(iso: string, timeZone = getActivityDisplayTimeZone()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** e.g. "3:45 PM" */
export function formatHmAmInTimeZone(iso: string, timeZone = getActivityDisplayTimeZone()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** Activity line: time + submit day from `logged_at`; work day from `report_date` column. */
export function formatLoggedAtReportLine(
  loggedAtIso: string,
  reportDateRaw: unknown,
  reportDateToYmd?: (raw: unknown) => string | null
): string {
  const tz = getActivityDisplayTimeZone();
  const loggedAt = loggedAtIso ? new Date(loggedAtIso) : new Date();
  const submittedYmd = formatYmdInTimeZone(loggedAt, tz);
  const parseReport =
    reportDateToYmd ??
    ((raw: unknown) => {
      const s = raw != null ? String(raw).trim() : '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : null;
    });
  const reportYmd = reportDateRaw != null && String(reportDateRaw).trim() ? parseReport(reportDateRaw) : null;
  const forDay = reportYmd || submittedYmd;
  const timeStr = formatTimeHmAmInTimeZone(loggedAt, tz);
  return `${timeStr} | ${submittedYmd} for ${forDay}`;
}
