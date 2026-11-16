import type { Activity } from '@/components/ActivityScreen';
import { isPlaceholderEmployeeName } from '@/lib/activity-employee-names';

/** Map `activities_view` / `activities` DB rows to the client Activity shape. */
export function mapActivitiesViewRow(row: Record<string, unknown>): Activity {
  const metrics = Array.isArray(row.metrics) ? row.metrics : [];
  const photos = Array.isArray(row.photos)
    ? row.photos.map((p) => String(p))
    : [];

  return {
    id: String(row.id ?? ''),
    employeeName: (() => {
      const raw = String(row.employee_name ?? row.employeeName ?? '').trim();
      if (!raw || isPlaceholderEmployeeName(raw)) return '';
      return raw;
    })(),
    action: String(row.action ?? ''),
    project: String(row.project_name ?? row.project ?? 'Unknown Project'),
    activityType: String(row.activity_type ?? row.activityType ?? 'Activity'),
    timestamp: String(row.timestamp_label ?? row.timestamp ?? ''),
    isoTimestamp: String(
      row.iso_timestamp ??
        row.isoTimestamp ??
        row.created_at ??
        row.updated_at ??
        new Date().toISOString()
    ),
    reportDateYmd:
      (row.report_date_ymd as string | null | undefined) ??
      (row.reportDateYmd as string | null | undefined) ??
      null,
    metrics: metrics as Activity['metrics'],
    photos,
  };
}

export function mapActivitiesViewRows(rows: Record<string, unknown>[]): Activity[] {
  return rows.map(mapActivitiesViewRow);
}
