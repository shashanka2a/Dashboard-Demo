/**
 * Field tables synced from mobile — each row has `logged_at` (upload/submit) and
 * `report_date` (work/report calendar day). Confirmed via `scripts/schema.js`.
 */
export const FIELD_LOG_TABLES_WITH_REPORT_DATE = [
  'notes',
  'metrics',
  'chemicals_logs',
  'equipment_logs',
  'incidents',
  'observations',
] as const;

export type FieldLogTableWithReportDate = (typeof FIELD_LOG_TABLES_WITH_REPORT_DATE)[number];
