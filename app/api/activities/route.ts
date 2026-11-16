import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  cloudinaryUploadedUrls,
  hasCloudinaryUploadedUrls,
  parseCloudinaryUrlsField,
} from '@/lib/photo-url';
import {
  getActivityDisplayTimeZone,
  formatYmdInTimeZone,
  formatLoggedAtReportLine,
  normalizeInstantToYmd,
} from '@/lib/activity-display-timezone';
import { enrichActivitiesWithReportTimestamps } from '@/lib/activity-report-timestamps';
import { reportDateColumnToYmd, resolveRowReportDateYmd } from '@/lib/report-date-filter';
import { isSafetyTalkCompletedRow } from '@/lib/safety-talk-status';
import { fetchEmployeeNameMap, parseAttendeeEmployeeIds, resolveAttendeeDisplayNames } from '@/lib/safety-talk-attendees';
import {
  equipmentChecklistToMetrics,
  normalizeEquipmentChecklistRow,
  resolveEquipmentChecklistReportYmd,
} from '@/lib/equipment-checklist';
import { dailySignedReportRowLooksSigned } from '@/lib/daily-signed-report-date';
import { resolveMetricNumeric, latestMetricsPerProjectDay, type MetricFieldDef, type MetricRowLike } from '@/lib/metric-values';
import {
  enrichActivitiesWithEmployeeNames,
  isPlaceholderEmployeeName,
} from '@/lib/activity-employee-names';
import type { Activity } from '@/components/ActivityScreen';

export const dynamic = 'force-dynamic';

/** Shown when `audit_log.submitted_employee_name` is missing for this record. */
const FALLBACK_EMPLOYEE_NAME = 'Unknown';

type AuditLogNameRow = {
  entity_id: string | null;
  entity_type: string | null;
  submitted_employee_name: string | null;
  submitted_by_user_id: string | null;
  created_at: string;
  action: string | null;
  report_date: string | null;
};

function looksLikeEmail(s: string): boolean {
  const t = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(t);
}

/** Prefer real name; never return a bare email as the display label. */
function displayNameFromAuditRow(
  r: AuditLogNameRow,
  userIdToDisplayName: Map<string, string>,
  emailToEmployeeName: Map<string, string>
): string | null {
  const raw = String(r.submitted_employee_name ?? '').trim();
  if (raw && !looksLikeEmail(raw)) return raw;

  const uid = String(r.submitted_by_user_id ?? '').trim();
  if (uid) {
    const fromAuth = userIdToDisplayName.get(uid);
    if (fromAuth) return fromAuth;
  }

  if (raw && looksLikeEmail(raw)) {
    const fromEmp = emailToEmployeeName.get(raw.toLowerCase());
    if (fromEmp) return fromEmp;
  }

  return null;
}

async function fetchEmployeeEmailToNameMap(supabase: typeof supabaseServer): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await supabase.from('employees').select('name, email');
  if (error) {
    console.warn('[activities] employees lookup for names:', error.message);
    return map;
  }
  for (const row of data || []) {
    const email = String((row as { email?: string | null }).email || '').trim().toLowerCase();
    const name = String((row as { name?: string | null }).name || '').trim();
    if (email && name) map.set(email, name);
  }
  return map;
}

/** Auth profile name fields only; if missing, match auth email to directory `employees.name`. */
async function buildAuthUserIdToDisplayName(
  supabase: typeof supabaseServer,
  userIds: string[],
  emailToEmployeeName: Map<string, string>
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(userIds)].filter(Boolean);
  const batchSize = 12;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (uid) => {
        try {
          const { data, error } = await supabase.auth.admin.getUserById(uid);
          if (error || !data?.user) return;
          const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
          for (const k of ['full_name', 'name', 'display_name']) {
            const v = meta[k];
            if (typeof v === 'string' && v.trim()) {
              const label = v.trim();
              if (!looksLikeEmail(label)) {
                out.set(uid, label);
                return;
              }
            }
          }
          const em = data.user.email?.trim().toLowerCase();
          if (em) {
            const nm = emailToEmployeeName.get(em);
            if (nm) out.set(uid, nm);
          }
        } catch {
          /* ignore per-user failures */
        }
      })
    );
  }
  return out;
}

function displayNameFromPreparedBy(prepared: string, emailToEmployeeName: Map<string, string>): string | null {
  const t = prepared.trim();
  if (!t) return null;
  if (looksLikeEmail(t)) return emailToEmployeeName.get(t.toLowerCase()) ?? null;
  return t;
}

/** `public.audit_log.entity_type` is the audited table name (see `audit_log_enqueue`). */
function auditEntityTypesForActivityType(activityType: string): string[] {
  const key = activityType.trim().toLowerCase();
  const map: Record<string, string[]> = {
    metrics: ['metrics'],
    notes: ['notes'],
    checklists: ['equipment_logs', 'equipment_checklists'],
    chemicals: ['chemicals_logs'],
    incidents: ['incidents'],
    observations: ['observations'],
    'safety talks': ['safety_talks'],
  };
  return map[key] ?? [];
}

function mergeAllowedEntityTypes(into: Record<string, string[]>, id: string, types: string[]) {
  if (!id || types.length === 0) return;
  into[id] = [...new Set([...(into[id] ?? []), ...types])];
}

/** Latest resolvable display name for this id and allowed `entity_type` values (never a raw email). */
function submittedNameFromAuditRows(
  id: string,
  allowedTypes: string[],
  rowsByEntityId: Map<string, AuditLogNameRow[]>,
  userIdToDisplayName: Map<string, string>,
  emailToEmployeeName: Map<string, string>
): string | null {
  if (!id || allowedTypes.length === 0) return null;
  const rows = (rowsByEntityId.get(id) ?? []).filter((r) =>
    allowedTypes.includes(String(r.entity_type || ''))
  );
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  for (const r of rows) {
    const n = displayNameFromAuditRow(r, userIdToDisplayName, emailToEmployeeName);
    if (n) return n;
  }
  return null;
}

/** `audit_log.entity_type` for rows we merge from both live tables and audit discovery. */
const AUDIT_ENTITY_TYPES_FOR_TABLE_MERGE = [
  'incidents',
  'safety_talks',
  'equipment_checklists',
  'metrics',
] as const;

const FALLBACK_METRIC_FIELDS: MetricFieldDef[] = [
  { key: 'water_usage', label: 'Water Usage', unit: 'gal' },
  { key: 'acres_completed', label: 'Acres Completed', unit: 'ac' },
  { key: 'green_space_completed', label: 'Green Space Completed', unit: 'sqft' },
  { key: 'number_of_operators', label: 'Operators', unit: 'count' },
];

function metricsRowToActivityMetrics(
  row: MetricRowLike,
  fields: MetricFieldDef[]
): { label: string; value: string; unit: string; highlight: boolean }[] {
  const out = fields.map((f) => {
    const n = resolveMetricNumeric(row, f.key);
    return {
      label: f.label.toUpperCase(),
      value: n != null ? String(n) : '—',
      unit: f.unit === 'count' || !f.unit ? '' : f.unit,
      highlight: true,
    };
  });
  const notes = row.notes != null ? String(row.notes) : '';
  out.push({ label: 'NOTES', value: notes, unit: '', highlight: false });
  return out;
}

function mapMetricsRowToActivity(
  row: Record<string, unknown>,
  projectsMap: Record<string, string>,
  metricFields: MetricFieldDef[],
  auditRowsByEntityId: Map<string, AuditLogNameRow[]>,
  userIdToDisplayName: Map<string, string>,
  emailToEmployeeName: Map<string, string>
) {
  const mid = String(row.id ?? '');
  const auditInsertIso = newestInsertAuditCreatedAt(mid, 'metrics', auditRowsByEntityId);
  const loggedIso = String(row.logged_at || row.created_at || auditInsertIso || new Date().toISOString());
  const reportRaw =
    row.report_date != null && String(row.report_date).trim()
      ? row.report_date
      : newestInsertAuditReportDate(mid, 'metrics', auditRowsByEntityId);
  const fromAudit = submittedNameFromAuditRows(
    mid,
    ['metrics'],
    auditRowsByEntityId,
    userIdToDisplayName,
    emailToEmployeeName
  );
  const reportDateYmd =
    reportDateColumnToYmd(reportRaw) ?? resolveRowReportDateYmd(row);
  return {
    id: mid,
    employeeName: fromAudit ?? FALLBACK_EMPLOYEE_NAME,
    action: 'submitted metrics in',
    project: projectsMap[String(row.project_id)] || 'Unknown Project',
    activityType: 'Metrics',
    timestamp: formatLoggedAtReportLine(loggedIso, reportRaw, reportDateColumnToYmd),
    isoTimestamp: loggedIso,
    reportDateYmd,
    metrics: metricsRowToActivityMetrics(row as MetricRowLike, metricFields),
    photos: parseCloudinaryUrlsField(row.photos),
  };
}

/** Recent audit rows (newest first) to discover entity ids that might be missing from bulk `select('*')`. */
async function fetchRecentAuditEntityIdBuckets(
  supabase: typeof supabaseServer,
  types: readonly string[],
  maxRowsToScan: number
): Promise<Map<string, Set<string>>> {
  const buckets = new Map<string, Set<string>>();
  for (const t of types) buckets.set(t, new Set());

  const pageSize = 1000;
  for (let offset = 0; offset < maxRowsToScan; offset += pageSize) {
    const take = Math.min(pageSize, maxRowsToScan - offset);
    const { data, error } = await supabase
      .from('audit_log')
      .select('entity_id, entity_type')
      .in('entity_type', [...types])
      .order('created_at', { ascending: false })
      .range(offset, offset + take - 1);
    if (error) {
      console.warn('[activities] audit_log entity id scan:', error.message);
      break;
    }
    const rows = data || [];
    for (const row of rows) {
      const et = String((row as { entity_type?: string }).entity_type || '');
      const eid = String((row as { entity_id?: string }).entity_id ?? '').trim();
      if (!eid || !buckets.has(et)) continue;
      buckets.get(et)!.add(eid);
    }
    if (rows.length < take) break;
  }
  return buckets;
}

/** Load table rows for ids seen in `audit_log` but not present in the baseline bulk fetch. */
async function mergeTableRowsWithAuditDiscoveredIds(
  supabase: typeof supabaseServer,
  table: string,
  baseline: Record<string, unknown>[],
  auditIds: Set<string> | undefined
): Promise<Record<string, unknown>[]> {
  const seen = new Set(baseline.map((r) => String((r as { id?: unknown }).id ?? '')).filter(Boolean));
  const out: Record<string, unknown>[] = [...baseline];
  const want = auditIds ? [...auditIds].filter((id) => id && !seen.has(id)) : [];
  if (want.length === 0) return out;

  const chunkSize = 200;
  for (let i = 0; i < want.length; i += chunkSize) {
    const chunk = want.slice(i, i + chunkSize);
    const { data, error } = await supabase.from(table).select('*').in('id', chunk);
    if (error) {
      console.warn(`[activities] ${table} fetch by audit ids:`, error.message);
      continue;
    }
    for (const row of (data || []) as Record<string, unknown>[]) {
      const id = String(row.id ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}

/** Paginated `select *` so activity merge is not capped at the PostgREST default row limit. */
async function fetchAllTableRows(
  supabase: typeof supabaseServer,
  table: string,
  orderColumn = 'logged_at'
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderColumn, { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.warn(`[activities] ${table} paginated fetch:`, error.message);
      break;
    }
    const rows = (data || []) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

function mapEquipmentChecklistRowToActivity(
  row: Record<string, unknown>,
  projectsMap: Record<string, string>,
  auditRowsByEntityId: Map<string, AuditLogNameRow[]>,
  userIdToDisplayName: Map<string, string>,
  emailToEmployeeName: Map<string, string>
) {
  const cid = String(row.id ?? '');
  const auditInsertIso = newestInsertAuditCreatedAt(cid, 'equipment_checklists', auditRowsByEntityId);
  const loggedIso = String(row.logged_at || row.created_at || auditInsertIso || new Date().toISOString());
  const auditReportDate = newestInsertAuditReportDate(cid, 'equipment_checklists', auditRowsByEntityId);
  const reportRaw =
    row.report_date != null && String(row.report_date).trim() ? row.report_date : auditReportDate;
  const normalized = normalizeEquipmentChecklistRow(row, auditReportDate);
  const fromAudit = submittedNameFromAuditRows(
    cid,
    ['equipment_checklists'],
    auditRowsByEntityId,
    userIdToDisplayName,
    emailToEmployeeName
  );
  const operator = normalized.operatorName;
  return {
    id: cid,
    employeeName: fromAudit ?? (operator || FALLBACK_EMPLOYEE_NAME),
    action: 'submitted an equipment checklist in',
    project: projectsMap[String(row.project_id)] || 'Unknown Project',
    activityType: 'Checklists',
    timestamp: formatLoggedAtReportLine(loggedIso, reportRaw, reportDateColumnToYmd),
    isoTimestamp: loggedIso,
    reportDateYmd:
      normalized.reportDateYmd ??
      reportDateColumnToYmd(reportRaw) ??
      resolveEquipmentChecklistReportYmd(row, auditReportDate),
    metrics: equipmentChecklistToMetrics(row),
    photos: parseCloudinaryUrlsField(row.photos),
  };
}

function auditInsertRowsForEntity(
  entityId: string,
  entityType: string,
  auditRowsByEntityId: Map<string, AuditLogNameRow[]>
): AuditLogNameRow[] {
  // Trigger writes action='field_sync'; treat every row of this entity type as a candidate.
  return (auditRowsByEntityId.get(entityId) ?? []).filter(
    (r) => String(r.entity_type || '') === entityType
  );
}

/** Newest INSERT audit row `created_at` for sorting / fallback when `logged_at` is empty. */
function newestInsertAuditCreatedAt(
  entityId: string,
  entityType: string,
  auditRowsByEntityId: Map<string, AuditLogNameRow[]>
): string | null {
  const rows = auditInsertRowsForEntity(entityId, entityType, auditRowsByEntityId);
  if (!rows.length) return null;
  // Earliest audit row = original submission time.
  rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return rows[0]?.created_at ?? null;
}

/** `report_date` from the same newest INSERT audit row (when the live row has none). */
function newestInsertAuditReportDate(
  entityId: string,
  entityType: string,
  auditRowsByEntityId: Map<string, AuditLogNameRow[]>
): string | null {
  const rows = auditInsertRowsForEntity(entityId, entityType, auditRowsByEntityId);
  if (!rows.length) return null;
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const withRep = rows.find((r) => r.report_date != null && String(r.report_date).trim());
  return withRep ? String(withRep.report_date).trim() : null;
}

async function fetchAuditLogRowsByEntityId(
  supabase: typeof supabaseServer,
  entityIds: string[]
): Promise<Map<string, AuditLogNameRow[]>> {
  const map = new Map<string, AuditLogNameRow[]>();
  const unique = [...new Set(entityIds)].filter(Boolean);
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('audit_log')
      .select(
        'entity_id, entity_type, submitted_employee_name, submitted_by_user_id, created_at, action, report_date'
      )
      .in('entity_id', chunk);
    if (error) {
      console.warn('[activities] audit_log name lookup:', error.message);
      continue;
    }
    for (const row of data || []) {
      const r = row as AuditLogNameRow;
      const id = String(r.entity_id ?? '');
      if (!id) continue;
      const arr = map.get(id) ?? [];
      arr.push(r);
      map.set(id, arr);
    }
  }
  return map;
}

function parseFormDataForSelectedDate(raw: unknown): string | null {
  if (raw == null) return null;
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || (!t.startsWith('{') && !t.startsWith('['))) return null;
    try {
      const p = JSON.parse(t) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) obj = p as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return null;
  const keys = [
    'selectedDate',
    'selected_date',
    'date',
    'attachmentDate',
    'workDate',
    'calendarDate',
    'fieldDate',
  ];
  for (const k of keys) {
    const v = obj[k];
    if (v == null || !String(v).trim()) continue;
    const y = normalizeInstantToYmd(String(v));
    if (y) return y;
  }
  return null;
}

/**
 * Work/calendar date for the attachment (can differ from submitted `logged_at`).
 * Checks columns + JSON form_data (common for mobile apps).
 */
function extractSelectedDateYmd(row: Record<string, unknown>): string | null {
  const candidates = [
    row.selected_date,
    row.selected_at,
    row.calendar_date,
    row.work_date,
    row.field_date,
    row.attachment_date,
    row.report_date,
    row.activity_date,
  ];

  for (const c of candidates) {
    if (c == null) continue;
    const y = normalizeInstantToYmd(String(c));
    if (y) return y;
  }

  const fromForm = parseFormDataForSelectedDate(row.form_data);
  if (fromForm) return fromForm;

  // Some schemas use a generic `date` only for the workday (last resort)
  if (row.date != null && String(row.date).trim()) {
    const y = normalizeInstantToYmd(String(row.date));
    if (y) return y;
  }

  return null;
}

type LoggedReportRow = { logged_at: string; report_date: unknown };

async function mergeLoggedReportRows(
  supabase: typeof supabaseServer,
  table: string,
  ids: string[],
  into: Record<string, LoggedReportRow>
) {
  const unique = [...new Set(ids)].filter(Boolean);
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from(table)
      .select('id, logged_at, report_date, form_data')
      .in('id', chunk);
    if (error) {
      console.warn(`[activities] ${table} logged_at lookup:`, error.message);
      continue;
    }
    for (const row of data || []) {
      const id = String((row as { id: string }).id);
      const la = (row as { logged_at?: string | null }).logged_at;
      if (!id || !la) continue;
      const r = row as Record<string, unknown>;
      const report_date =
        r.report_date != null && String(r.report_date).trim()
          ? r.report_date
          : resolveRowReportDateYmd(r);
      into[id] = { logged_at: String(la), report_date };
    }
  }
}

/** Same id as `public.notes.id` when the activity row is the note feed entry. */
function categoryFromNoteMetrics(metrics: unknown): string | null {
  if (!Array.isArray(metrics)) return null;
  for (const m of metrics) {
    const label = String((m as { label?: string }).label || '');
    const match = label.match(/^NOTE:\s*(.+)$/i);
    const cat = match?.[1]?.trim();
    if (cat) return cat;
  }
  return null;
}

export async function GET(request: Request) {
  // Optional `?project=<name>` scopes every table query to one project (much faster per-project loads).
  const projectParam = new URL(request.url).searchParams.get('project')?.trim() || '';
  let scopedProjectId: string | null = null;
  if (projectParam) {
    const { data: pRow } = await supabaseServer
      .from('projects')
      .select('id')
      .eq('name', projectParam)
      .maybeSingle();
    if (pRow?.id) scopedProjectId = String(pRow.id);
    else return NextResponse.json([]);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byProject = <Q,>(q: Q): Q => (scopedProjectId ? (q as any).eq('project_id', scopedProjectId) : q);

  const [
    activitiesRes,
    attachmentsRes,
    surveysRes,
    incidentsRes,
    equipmentChecklistsRes,
    safetyTalksRes,
    metricsRes,
    dailySignedRes,
    projectsRes,
    metricFieldsRes,
  ] = await Promise.all([
      (projectParam
        ? supabaseServer.from('activities').select('*').eq('project_name', projectParam)
        : supabaseServer.from('activities').select('*')),
      byProject(supabaseServer.from('attachments').select('*')),
      byProject(supabaseServer.from('surveys').select('*, questions:survey_questions(question, answer)')),
      // Ensure incidents show even if `public.activities` view is stale or omits them.
      byProject(supabaseServer.from('incidents').select('*')),
      // Ensure equipment checklists show even if the view omits them.
      byProject(supabaseServer.from('equipment_checklists').select('*')),
      // Ensure safety talks show (completed + submitted) even if the view is stale.
      byProject(supabaseServer.from('safety_talks').select('*')),
      // Ensure metrics show even if the activities view is stale / capped.
      byProject(supabaseServer.from('metrics').select('*')),
      byProject(supabaseServer.from('daily_signed_reports').select('id, project_id, prepared_by, signature_url, signed_at, created_at, report_date, report_url')),
      supabaseServer.from('projects').select('id, name'),
      supabaseServer
        .from('company_metric_fields')
        .select('key, label, unit, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

  if (activitiesRes.error) {
    return NextResponse.json({ error: activitiesRes.error.message }, { status: 500 });
  }

  if (attachmentsRes.error) {
    console.warn('[activities] attachments query:', attachmentsRes.error.message);
  }
  if (incidentsRes.error) {
    console.warn('[activities] incidents query:', incidentsRes.error.message);
  }
  if (equipmentChecklistsRes.error) {
    console.warn('[activities] equipment_checklists query:', equipmentChecklistsRes.error.message);
  }
  if (safetyTalksRes.error) {
    console.warn('[activities] safety_talks query:', safetyTalksRes.error.message);
  }
  if (metricsRes.error) {
    console.warn('[activities] metrics query:', metricsRes.error.message);
  }
  if (dailySignedRes.error) {
    console.warn('[activities] daily_signed_reports query:', dailySignedRes.error.message);
  }

  const metricFields: MetricFieldDef[] =
    Array.isArray(metricFieldsRes.data) && metricFieldsRes.data.length > 0
      ? (metricFieldsRes.data as MetricFieldDef[])
      : FALLBACK_METRIC_FIELDS;

  const projectsMap = Object.fromEntries((projectsRes.data || []).map((p) => [String(p.id), p.name]));

  const activitiesRows = activitiesRes.data || [];

  const allowedEntityTypesById: Record<string, string[]> = {};
  for (const a of activitiesRows) {
    mergeAllowedEntityTypes(
      allowedEntityTypesById,
      String((a as { id: string }).id),
      auditEntityTypesForActivityType(String((a as { activity_type?: string }).activity_type || ''))
    );
  }
  for (const row of attachmentsRes.data || []) {
    const attRow = row as { id?: string; cloudinary_urls?: unknown };
    if (!hasCloudinaryUploadedUrls(attRow.cloudinary_urls)) continue;
    mergeAllowedEntityTypes(allowedEntityTypesById, String(attRow.id ?? ''), ['attachments']);
  }
  for (const s of surveysRes.data || []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, String(s.id), ['surveys']);
  }
  for (const row of incidentsRes.data || []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, String((row as { id?: string }).id ?? ''), ['incidents']);
  }
  for (const row of equipmentChecklistsRes.data || []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, String((row as { id?: string }).id ?? ''), ['equipment_checklists']);
  }
  for (const r of safetyTalksRes.data || []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, String((r as { id?: string }).id ?? ''), ['safety_talks']);
  }
  for (const r of metricsRes.data || []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, String((r as { id?: string }).id ?? ''), ['metrics']);
  }
  for (const r of dailySignedRes.data || []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, String((r as { id?: string }).id ?? ''), ['daily_signed_reports']);
  }

  const auditEntityIdBuckets = await fetchRecentAuditEntityIdBuckets(
    supabaseServer,
    AUDIT_ENTITY_TYPES_FOR_TABLE_MERGE,
    8000
  );
  for (const id of auditEntityIdBuckets.get('incidents') ?? []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, id, ['incidents']);
  }
  for (const id of auditEntityIdBuckets.get('equipment_checklists') ?? []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, id, ['equipment_checklists']);
  }
  for (const id of auditEntityIdBuckets.get('safety_talks') ?? []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, id, ['safety_talks']);
  }
  for (const id of auditEntityIdBuckets.get('metrics') ?? []) {
    mergeAllowedEntityTypes(allowedEntityTypesById, id, ['metrics']);
  }

  const auditRowsByEntityId = await fetchAuditLogRowsByEntityId(supabaseServer, Object.keys(allowedEntityTypesById));

  const allAuditRows = [...auditRowsByEntityId.values()].flat();
  const auditUserIds = [
    ...new Set(allAuditRows.map((r) => String(r.submitted_by_user_id ?? '').trim()).filter(Boolean)),
  ];
  const emailToEmployeeName = await fetchEmployeeEmailToNameMap(supabaseServer);
  const userIdToDisplayName = await buildAuthUserIdToDisplayName(
    supabaseServer,
    auditUserIds,
    emailToEmployeeName
  );

  const incidentsFull = await mergeTableRowsWithAuditDiscoveredIds(
    supabaseServer,
    'incidents',
    (incidentsRes.data || []) as Record<string, unknown>[],
    auditEntityIdBuckets.get('incidents')
  );
  const checklistById = new Map<string, Record<string, unknown>>();
  for (const r of [
    ...((equipmentChecklistsRes.data || []) as Record<string, unknown>[]),
    ...(await fetchAllTableRows(supabaseServer, 'equipment_checklists')),
  ]) {
    const id = String((r as { id?: unknown }).id ?? '').trim();
    if (id) checklistById.set(id, r);
  }
  const equipmentChecklistsFull = await mergeTableRowsWithAuditDiscoveredIds(
    supabaseServer,
    'equipment_checklists',
    [...checklistById.values()],
    auditEntityIdBuckets.get('equipment_checklists')
  );
  const safetyTalksFull = await mergeTableRowsWithAuditDiscoveredIds(
    supabaseServer,
    'safety_talks',
    (safetyTalksRes.data || []) as Record<string, unknown>[],
    auditEntityIdBuckets.get('safety_talks')
  );
  const metricsById = new Map<string, Record<string, unknown>>();
  for (const r of [
    ...((metricsRes.data || []) as Record<string, unknown>[]),
    ...(await fetchAllTableRows(supabaseServer, 'metrics')),
  ]) {
    const id = String((r as { id?: unknown }).id ?? '').trim();
    if (id) metricsById.set(id, r);
  }
  const metricsFull = await mergeTableRowsWithAuditDiscoveredIds(
    supabaseServer,
    'metrics',
    [...metricsById.values()],
    auditEntityIdBuckets.get('metrics')
  );

  const idsForType = (t: string) =>
    [
      ...new Set(
        activitiesRows
          .filter((a: { activity_type?: string }) => String(a.activity_type || '').toLowerCase() === t)
          .map((a: { id: string }) => String(a.id))
      ),
    ];

  const noteIds = idsForType('notes');
  const metricIds = idsForType('metrics');
  const chemicalIds = idsForType('chemicals');
  const observationIds = idsForType('observations');
  const incidentIds = idsForType('incidents');
  const checklistIds = idsForType('checklists');

  const categoryByNoteId: Record<string, string> = {};
  const logRowById: Record<string, LoggedReportRow> = {};

  const chunkSize = 200;
  for (let i = 0; i < noteIds.length; i += chunkSize) {
    const chunk = noteIds.slice(i, i + chunkSize);
    const { data: noteRows, error: noteErr } = await supabaseServer
      .from('notes')
      .select('id, category, logged_at, report_date')
      .in('id', chunk);
    if (noteErr) {
      console.warn('[activities] notes lookup:', noteErr.message);
      break;
    }
    for (const n of noteRows || []) {
      const id = String((n as { id: string }).id);
      const c = String((n as { category?: string | null }).category || '').trim();
      if (id && c) categoryByNoteId[id] = c;
      const la = (n as { logged_at?: string | null }).logged_at;
      if (id && la) {
        logRowById[id] = {
          logged_at: String(la),
          report_date: (n as { report_date?: unknown }).report_date,
        };
      }
    }
  }

  await mergeLoggedReportRows(supabaseServer, 'metrics', [
    ...new Set([
      ...metricIds,
      ...metricsFull.map((r) => String((r as { id?: unknown }).id ?? '')).filter(Boolean),
    ]),
  ], logRowById);
  await mergeLoggedReportRows(supabaseServer, 'chemicals_logs', chemicalIds, logRowById);
  await mergeLoggedReportRows(supabaseServer, 'observations', observationIds, logRowById);
  const incidentIdsForLog = [
    ...new Set([
      ...incidentIds,
      ...incidentsFull.map((r) => String((r as { id?: unknown }).id ?? '')).filter(Boolean),
    ]),
  ];
  const checklistIdsForLog = [
    ...new Set([
      ...checklistIds,
      ...equipmentChecklistsFull.map((r) => String((r as { id?: unknown }).id ?? '')).filter(Boolean),
    ]),
  ];
  await mergeLoggedReportRows(supabaseServer, 'incidents', incidentIdsForLog, logRowById);
  await mergeLoggedReportRows(supabaseServer, 'equipment_checklists', checklistIdsForLog, logRowById);

  /** Metrics merged from `metrics` table; drop view duplicates. */
  const metricIdsFromTable = new Set(
    metricsFull.map((r: { id?: string }) => String(r.id ?? '')).filter(Boolean)
  );

  /** Incidents merged from `incidents` (bulk + audit-discovered ids); drop view duplicates. */
  const incidentIdsFromTable = new Set(
    incidentsFull.map((r: { id?: string }) => String(r.id ?? '')).filter(Boolean)
  );

  const equipmentChecklistsData = equipmentChecklistsFull.map((row) =>
    mapEquipmentChecklistRowToActivity(
      row,
      projectsMap,
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName
    )
  );
  /** Safety talks merged from table + audit-discovered ids; drop view duplicates. */
  const allSafetyTalkIdsFromTable = new Set(
    safetyTalksFull.map((r: { id?: string }) => String(r.id ?? '')).filter(Boolean)
  );

  const activitiesData = activitiesRows
    .filter((activity) => {
      const type = String(activity.activity_type || '').toLowerCase();
      const id = String(activity.id ?? '');
      if (type === 'safety talks' && allSafetyTalkIdsFromTable.has(id)) return false;
      if (type === 'incidents' && incidentIdsFromTable.has(id)) return false;
      if (type === 'metrics' && metricIdsFromTable.has(id)) return false;
      if (type === 'checklists') return false;
      if (type === 'attachments' && !hasCloudinaryUploadedUrls(activity.photos)) return false;
      return true;
    })
    .map((activity) => {
    const activityType = String(activity.activity_type || '');
    const rawAction = String(activity.action || '');
    const metrics = activity.metrics || [];
    const isNotes = activityType.toLowerCase() === 'notes';
    const isChecklists = activityType.toLowerCase() === 'checklists';
    const noteCategory = !isNotes
      ? ''
      : (categoryByNoteId[String(activity.id)]?.trim() || categoryFromNoteMetrics(metrics) || '').trim();
    const action =
      isNotes && noteCategory
        ? `submitted a ${noteCategory} note in`
        : isChecklists
          ? 'submitted an equipment checklist in'
          : rawAction;

    const src = logRowById[String(activity.id)];
    const timestamp =
      src?.logged_at != null
        ? formatLoggedAtReportLine(src.logged_at, src.report_date, reportDateColumnToYmd)
        : activity.timestamp_label;
    const isoTimestamp = src?.logged_at != null ? src.logged_at : activity.created_at;
    const reportDateYmd = src?.report_date != null ? reportDateColumnToYmd(src.report_date) : null;

    const auditTypes = allowedEntityTypesById[String(activity.id)] ?? [];
    const fromAudit = submittedNameFromAuditRows(
      String(activity.id),
      auditTypes,
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName
    );

    return {
      id: activity.id,
      employeeName: fromAudit ?? FALLBACK_EMPLOYEE_NAME,
      action,
      project: activity.project_name,
      activityType,
      timestamp,
      isoTimestamp,
      reportDateYmd,
      metrics,
      /** JSONB / mobile payloads may use bare hosts or { secure_url } objects — unify to https URL strings. */
      photos: parseCloudinaryUrlsField(activity.photos),
    };
  });

  const attachmentsData = (attachmentsRes.data || [])
    .filter((a) => hasCloudinaryUploadedUrls((a as { cloudinary_urls?: unknown }).cloudinary_urls))
    .map((a) => {
    const row = a as Record<string, unknown>;
    const loggedAtIso = String(row.logged_at || new Date().toISOString());
    const loggedAt = new Date(loggedAtIso);
    const tz = getActivityDisplayTimeZone();
    const submittedYmd = formatYmdInTimeZone(loggedAt, tz);
    const picked = extractSelectedDateYmd(row);
    const selectedYmd = picked ?? submittedYmd;
    const forRaw =
      picked != null
        ? picked
        : row.report_date != null && String(row.report_date).trim()
          ? row.report_date
          : null;

    const attId = String(row.id ?? '');
    const fromAudit = submittedNameFromAuditRows(
      attId,
      ['attachments'],
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName
    );

    return {
      id: attId,
      employeeName: fromAudit ?? FALLBACK_EMPLOYEE_NAME,
      action: 'submitted attachments in',
      project: projectsMap[String(row.project_id)] || 'Unknown Project',
      activityType: 'Attachments',
      timestamp: formatLoggedAtReportLine(loggedAtIso, forRaw, reportDateColumnToYmd),
      isoTimestamp: loggedAtIso,
      reportDateYmd: reportDateColumnToYmd(forRaw) ?? selectedYmd,
      submittedDateYmd: submittedYmd,
      selectedDateYmd: selectedYmd,
      metrics: [
        {
          label: 'Files',
          value: String(Array.isArray(row.file_names) ? row.file_names.length : 0),
          unit: 'count',
        },
        { label: 'Note', value: String(row.notes || 'No description') },
      ],
      photos: cloudinaryUploadedUrls(row.cloudinary_urls),
      tags: Array.isArray(row.tags) ? row.tags : [],
    };
  });

  const surveysData = (surveysRes.data || []).map((s) => {
    const loggedIso = String(s.logged_at || new Date().toISOString());
    const reportRaw = (s as { report_date?: string | null }).report_date;
    const timestampLabel = formatLoggedAtReportLine(loggedIso, reportRaw, reportDateColumnToYmd);
    const reportDateYmd = reportDateColumnToYmd(reportRaw) ?? resolveRowReportDateYmd(s as Record<string, unknown>);
    const metricsFromQuestions = (s.questions || []).map((q: { question?: string; answer?: string }) => ({
      label: q.question,
      value: q.answer || 'N/A',
    }));

    const yesCount = (s.questions || []).filter((q: { answer?: string }) => q.answer === 'Yes').length;
    const noCount = (s.questions || []).filter((q: { answer?: string }) => q.answer === 'No').length;

    const surveyId = String(s.id);
    const fromAudit = submittedNameFromAuditRows(
      surveyId,
      ['surveys'],
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName
    );

    return {
      id: surveyId,
      employeeName: fromAudit ?? FALLBACK_EMPLOYEE_NAME,
      action: 'submitted a survey in',
      project: projectsMap[String(s.project_id)] || 'Unknown Project',
      activityType: 'Survey',
      timestamp: timestampLabel,
      isoTimestamp: loggedIso,
      reportDateYmd,
      metrics: [
        {
          label: 'NOTE: Summary',
          value: `${s.questions?.length || 0} questions answered (${yesCount} Yes, ${noCount} No).`,
        },
        ...metricsFromQuestions,
      ],
      photos: [],
    };
  });

  const metricsData = latestMetricsPerProjectDay(metricsFull).map((row) =>
    mapMetricsRowToActivity(
      row,
      projectsMap,
      metricFields,
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName
    )
  );

  const incidentsData = incidentsFull.map((inc: Record<string, unknown>) => {
    const iid = String(inc.id ?? '');
    const auditInsertIso = newestInsertAuditCreatedAt(iid, 'incidents', auditRowsByEntityId);
    const loggedIso = String(inc.logged_at || inc.created_at || auditInsertIso || new Date().toISOString());
    const reportRaw =
      inc.report_date != null && String(inc.report_date).trim()
        ? inc.report_date
        : newestInsertAuditReportDate(iid, 'incidents', auditRowsByEntityId);
    const fromAudit = submittedNameFromAuditRows(
      iid,
      ['incidents'],
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName
    );
    return {
      id: iid,
      employeeName: fromAudit ?? FALLBACK_EMPLOYEE_NAME,
      action: 'submitted an incident in',
      project: projectsMap[String(inc.project_id)] || 'Unknown Project',
      activityType: 'Incidents',
      timestamp: formatLoggedAtReportLine(loggedIso, reportRaw, reportDateColumnToYmd),
      isoTimestamp: loggedIso,
      reportDateYmd: reportDateColumnToYmd(reportRaw) ?? resolveRowReportDateYmd(inc),
      metrics: [
        { label: 'INCIDENT', value: String(inc.status ?? 'open'), unit: '', highlight: true },
        { label: 'DESCRIPTION', value: String(inc.description ?? ''), unit: '', highlight: false },
      ],
      photos: parseCloudinaryUrlsField(inc.photos),
    };
  });

  const allSafetyTalkRows = safetyTalksFull as Record<string, unknown>[];

  const talkAttendeeIds = new Set<string>();
  for (const r of allSafetyTalkRows) {
    for (const id of parseAttendeeEmployeeIds((r as { attendees?: unknown }).attendees)) {
      talkAttendeeIds.add(id);
    }
  }
  const talkEmployeeNameById = await fetchEmployeeNameMap(supabaseServer, [...talkAttendeeIds]);

  const safetyTalksData = allSafetyTalkRows.map((r: Record<string, unknown>) => {
    const completed = isSafetyTalkCompletedRow(r);
    const sid = String(r.id ?? '');
    const auditInsertIso = newestInsertAuditCreatedAt(sid, 'safety_talks', auditRowsByEntityId);
    const tsIso = String(
      completed
        ? (r.completed_at ||
            r.updated_at ||
            r.logged_at ||
            r.created_at ||
            auditInsertIso ||
            new Date().toISOString())
        : (r.logged_at || r.created_at || r.updated_at || auditInsertIso || new Date().toISOString())
    );
    const fromAudit = submittedNameFromAuditRows(
      sid,
      ['safety_talks'],
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName
    );
    const attendeeNames = resolveAttendeeDisplayNames(r.attendees, talkEmployeeNameById);
    const sessionPdf =
      r.attendance_pdf_url != null && String(r.attendance_pdf_url).trim()
        ? String(r.attendance_pdf_url).trim()
        : '';
    const statusLabel = String(r.status ?? '').trim();
    return {
      id: sid,
      employeeName: fromAudit ?? FALLBACK_EMPLOYEE_NAME,
      action: completed ? 'completed a safety talk in' : 'submitted a safety talk in',
      project: projectsMap[String(r.project_id)] || 'Unknown Project',
      activityType: 'Safety Talks',
      timestamp: formatLoggedAtReportLine(tsIso, r.scheduled_date ?? null, reportDateColumnToYmd),
      isoTimestamp: tsIso,
      metrics: [
        { label: 'TOPIC', value: String(r.template_name || 'Safety Talk'), unit: '', highlight: true },
        ...(!completed && statusLabel
          ? [{ label: 'STATUS', value: statusLabel, unit: '', highlight: false }]
          : []),
        ...(attendeeNames.length
          ? [{ label: 'ATTENDEES', value: attendeeNames.join(', '), unit: 'staff', highlight: false }]
          : []),
        ...(completed && sessionPdf
          ? [{ label: 'SESSION PDF', value: sessionPdf, unit: 'link', highlight: false }]
          : []),
      ],
      photos: [],
    };
  });

  const signedReportsData = (dailySignedRes.data || [])
    .filter((r: any) => dailySignedReportRowLooksSigned(r))
    .map((r: any) => {
    const createdIso = String(r.created_at || r.signed_at || new Date().toISOString());
    const rid = String(r.id ?? '');
    const fromAudit = submittedNameFromAuditRows(
      rid,
      ['daily_signed_reports'],
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName
    );
    const prepared = String(r.prepared_by || '').trim();
    const fromPrepared = displayNameFromPreparedBy(prepared, emailToEmployeeName);
    const displayPrepared = fromPrepared || prepared || '—';
    const reportDateRaw =
      r.report_date != null && String(r.report_date).trim() ? String(r.report_date).trim() : null;
    return {
      id: rid,
      employeeName: fromAudit ?? fromPrepared ?? FALLBACK_EMPLOYEE_NAME,
      action: 'signed daily report in',
      project: projectsMap[String(r.project_id)] || 'Unknown Project',
      activityType: 'Reports',
      timestamp: formatLoggedAtReportLine(createdIso, reportDateRaw, reportDateColumnToYmd),
      isoTimestamp: createdIso,
      metrics: [
        { label: 'PREPARED BY', value: displayPrepared },
        ...(r.report_url != null && String(r.report_url).trim()
          ? [{ label: 'REPORT URL', value: String(r.report_url).trim(), unit: 'link' }]
          : []),
        ...(r.signature_url ? [{ label: 'SIGNATURE', value: String(r.signature_url) }] : []),
      ],
      photos: [],
    };
  });

  const combined = [
    ...activitiesData,
    ...attachmentsData,
    ...surveysData,
    ...metricsData,
    ...incidentsData,
    ...equipmentChecklistsData,
    ...safetyTalksData,
    ...signedReportsData,
  ].sort(
    (a, b) => new Date(b.isoTimestamp).getTime() - new Date(a.isoTimestamp).getTime()
  );

  let payload = await enrichActivitiesWithReportTimestamps(supabaseServer, combined as Activity[]);

  const needsNames = payload.some((a) => {
    const n = String(a.employeeName ?? '').trim();
    return !n || isPlaceholderEmployeeName(n);
  });
  if (needsNames) {
    payload = await enrichActivitiesWithEmployeeNames(supabaseServer, payload);
  }

  return NextResponse.json(payload);
}
