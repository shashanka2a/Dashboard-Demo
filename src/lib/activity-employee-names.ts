import type { SupabaseClient } from '@supabase/supabase-js';
import type { Activity } from '@/components/ActivityScreen';

export const PLACEHOLDER_EMPLOYEE_NAMES = new Set(
  ['test employee', 'unknown', 'unknown employee'].map((s) => s.toLowerCase())
);

const NAME_STRING_KEYS = [
  'logged_by',
  'submitted_by_name',
  'submitted_by',
  'employee_name',
  'operator_name',
  'operator',
  'prepared_by',
  'created_by',
  'author_name',
  'user_name',
  'display_name',
  'submitted_employee_name',
] as const;

const EMPLOYEE_ID_KEYS = [
  'employee_id',
  'submitted_by_employee_id',
  'logged_by_employee_id',
  'operator_employee_id',
] as const;

/** Auth user ids on field rows (mobile / audit); resolved via employees email or auth profile. */
const AUTH_USER_ID_KEYS = [
  'user_id',
  'created_by_user_id',
  'submitted_by_user_id',
  'auth_user_id',
] as const;

const FORM_DATA_NAME_KEYS = [
  'loggedBy',
  'logged_by',
  'employeeName',
  'employee_name',
  'submittedBy',
  'submitted_by',
  'submittedByName',
  'submitted_by_name',
  'operatorName',
  'operator_name',
  'preparedBy',
  'prepared_by',
  'displayName',
  'display_name',
  'userName',
  'user_name',
  'fullName',
  'full_name',
  'name',
] as const;

const SOURCE_TABLE_BY_ACTIVITY_TYPE: Record<string, string[]> = {
  notes: ['notes'],
  metrics: ['metrics'],
  chemicals: ['chemicals_logs'],
  checklists: ['equipment_checklists', 'equipment_logs'],
  incidents: ['incidents'],
  observations: ['observations'],
  'safety talks': ['safety_talks'],
  attachments: ['attachments'],
  survey: ['surveys'],
  reports: ['daily_signed_reports'],
};

type AuditLogNameRow = {
  entity_id: string | null;
  entity_type: string | null;
  submitted_employee_name: string | null;
  submitted_by_user_id: string | null;
  created_at: string;
  action: string | null;
  report_date: string | null;
  details?: unknown;
};

function looksLikeEmail(s: string): boolean {
  const t = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(t);
}

export function isPlaceholderEmployeeName(name: string): boolean {
  return PLACEHOLDER_EMPLOYEE_NAMES.has(name.trim().toLowerCase());
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t.startsWith('{')) return null;
    try {
      const p = JSON.parse(t) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function pickNameFromFormData(
  formData: Record<string, unknown>,
  emailToEmployeeName: Map<string, string>,
  employeeIdToName: Map<string, string>,
  userIdToDisplayName: Map<string, string>
): string | null {
  for (const k of FORM_DATA_NAME_KEYS) {
    const v = formData[k];
    if (typeof v === 'string' && v.trim() && !isPlaceholderEmployeeName(v)) {
      if (looksLikeEmail(v)) {
        const fromEmail = emailToEmployeeName.get(v.toLowerCase());
        if (fromEmail) return fromEmail;
        continue;
      }
      return v.trim();
    }
  }
  const user = formData.user;
  if (user && typeof user === 'object' && !Array.isArray(user)) {
    const nested = pickNameFromRecord(
      user as Record<string, unknown>,
      emailToEmployeeName,
      employeeIdToName,
      userIdToDisplayName
    );
    if (nested) return nested;
  }
  return pickNameFromRecord(formData, emailToEmployeeName, employeeIdToName, userIdToDisplayName);
}

function pickNameFromRecord(
  row: Record<string, unknown>,
  emailToEmployeeName: Map<string, string>,
  employeeIdToName: Map<string, string>,
  userIdToDisplayName: Map<string, string> = new Map()
): string | null {
  for (const k of NAME_STRING_KEYS) {
    const v = String(row[k] ?? '').trim();
    if (!v) continue;
    if (looksLikeEmail(v)) {
      const fromEmail = emailToEmployeeName.get(v.toLowerCase());
      if (fromEmail) return fromEmail;
      continue;
    }
    if (!isPlaceholderEmployeeName(v)) return v;
  }

  for (const k of EMPLOYEE_ID_KEYS) {
    const id = String(row[k] ?? '').trim();
    if (id && employeeIdToName.has(id)) return employeeIdToName.get(id)!;
  }

  for (const k of AUTH_USER_ID_KEYS) {
    const uid = String(row[k] ?? '').trim();
    if (uid && userIdToDisplayName.has(uid)) return userIdToDisplayName.get(uid)!;
  }

  const formData = parseJsonObject(row.form_data);
  if (formData) {
    const fromForm = pickNameFromFormData(
      formData,
      emailToEmployeeName,
      employeeIdToName,
      userIdToDisplayName
    );
    if (fromForm) return fromForm;
  }

  return null;
}

function collectAuthUserIdsFromRecord(row: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (const k of AUTH_USER_ID_KEYS) {
    const uid = String(row[k] ?? '').trim();
    if (uid) ids.push(uid);
  }
  const formData = parseJsonObject(row.form_data);
  if (formData) {
    for (const k of AUTH_USER_ID_KEYS) {
      const uid = String(formData[k] ?? '').trim();
      if (uid) ids.push(uid);
    }
  }
  return ids;
}

function nameFromAuditDetails(
  r: AuditLogNameRow,
  emailToEmployeeName: Map<string, string>,
  employeeIdToName: Map<string, string>,
  userIdToDisplayName: Map<string, string>
): string | null {
  const details = parseJsonObject(r.details);
  if (!details) return null;
  for (const side of ['after', 'before'] as const) {
    const payload = parseJsonObject(details[side]);
    if (!payload) continue;
    const name = pickNameFromRecord(
      payload,
      emailToEmployeeName,
      employeeIdToName,
      userIdToDisplayName
    );
    if (name) return name;
  }
  return null;
}

function displayNameFromAuditRow(
  r: AuditLogNameRow,
  userIdToDisplayName: Map<string, string>,
  emailToEmployeeName: Map<string, string>,
  employeeIdToName: Map<string, string>
): string | null {
  const fromDetails = nameFromAuditDetails(
    r,
    emailToEmployeeName,
    employeeIdToName,
    userIdToDisplayName
  );
  if (fromDetails) return fromDetails;

  const raw = String(r.submitted_employee_name ?? '').trim();
  if (raw && !looksLikeEmail(raw) && !isPlaceholderEmployeeName(raw)) return raw;

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

export function auditEntityTypesForActivityType(activityType: string): string[] {
  const key = activityType.trim().toLowerCase();
  const map: Record<string, string[]> = {
    metrics: ['metrics'],
    notes: ['notes'],
    checklists: ['equipment_logs', 'equipment_checklists'],
    chemicals: ['chemicals_logs'],
    incidents: ['incidents'],
    observations: ['observations'],
    'safety talks': ['safety_talks'],
    attachments: ['attachments'],
    survey: ['surveys'],
    reports: ['daily_signed_reports'],
  };
  return map[key] ?? [];
}

function submittedNameFromAuditRows(
  id: string,
  allowedTypes: string[],
  rowsByEntityId: Map<string, AuditLogNameRow[]>,
  userIdToDisplayName: Map<string, string>,
  emailToEmployeeName: Map<string, string>,
  employeeIdToName: Map<string, string>
): string | null {
  if (!id) return null;
  const rows = (rowsByEntityId.get(id) ?? []).filter((r) =>
    allowedTypes.length === 0
      ? true
      : allowedTypes.includes(String(r.entity_type || ''))
  );
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  for (const r of rows) {
    const n = displayNameFromAuditRow(
      r,
      userIdToDisplayName,
      emailToEmployeeName,
      employeeIdToName
    );
    if (n) return n;
  }
  return null;
}

async function fetchAuditLogRowsByEntityId(
  supabase: SupabaseClient,
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
        'entity_id, entity_type, submitted_employee_name, submitted_by_user_id, created_at, action, report_date, details'
      )
      .in('entity_id', chunk);
    if (error) {
      console.warn('[activity-employee-names] audit_log:', error.message);
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

async function fetchEmployeeMaps(supabase: SupabaseClient) {
  const emailToEmployeeName = new Map<string, string>();
  const employeeIdToName = new Map<string, string>();
  const { data, error } = await supabase.from('employees').select('id, name, email');
  if (error) {
    console.warn('[activity-employee-names] employees:', error.message);
    return { emailToEmployeeName, employeeIdToName };
  }
  for (const row of data || []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    const name = String((row as { name?: string | null }).name || '').trim();
    const email = String((row as { email?: string | null }).email || '').trim().toLowerCase();
    if (id && name) employeeIdToName.set(id, name);
    if (email && name) emailToEmployeeName.set(email, name);
  }
  return { emailToEmployeeName, employeeIdToName };
}

async function buildAuthUserIdToDisplayName(
  supabase: SupabaseClient,
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
          for (const k of ['full_name', 'name', 'display_name', 'employee_name']) {
            const v = meta[k];
            if (typeof v === 'string' && v.trim()) {
              const label = v.trim();
              if (!looksLikeEmail(label) && !isPlaceholderEmployeeName(label)) {
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
          /* ignore */
        }
      })
    );
  }
  return out;
}

async function fetchSourceTableRowsByActivityId(
  supabase: SupabaseClient,
  items: Activity[]
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  const idsByTable = new Map<string, Set<string>>();

  for (const item of items) {
    const tables = SOURCE_TABLE_BY_ACTIVITY_TYPE[item.activityType.trim().toLowerCase()] ?? [];
    for (const table of tables) {
      if (!idsByTable.has(table)) idsByTable.set(table, new Set());
      idsByTable.get(table)!.add(item.id);
    }
  }

  for (const [table, idSet] of idsByTable) {
    const ids = [...idSet];
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data, error } = await supabase.from(table).select('*').in('id', chunk);
      if (error) {
        console.warn(`[activity-employee-names] ${table}:`, error.message);
        continue;
      }
      for (const row of (data || []) as Record<string, unknown>[]) {
        const id = String(row.id ?? '').trim();
        if (!id) continue;
        out.set(id, row);
      }
    }
  }

  return out;
}

function resolveEmployeeName(
  item: Activity,
  auditRowsByEntityId: Map<string, AuditLogNameRow[]>,
  userIdToDisplayName: Map<string, string>,
  emailToEmployeeName: Map<string, string>,
  employeeIdToName: Map<string, string>,
  sourceTableNames: Map<string, string>
): string | null {
  const fromSource = sourceTableNames.get(item.id);
  if (fromSource) return fromSource;

  const types = auditEntityTypesForActivityType(item.activityType);
  const fromAudit =
    submittedNameFromAuditRows(
      item.id,
      types,
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName,
      employeeIdToName
    ) ??
    submittedNameFromAuditRows(
      item.id,
      [],
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName,
      employeeIdToName
    );
  if (fromAudit) return fromAudit;

  const current = String(item.employeeName || '').trim();
  if (current && !isPlaceholderEmployeeName(current)) return current;

  return null;
}

export type EnrichEmployeeNamesOptions = {
  /**
   * When true, only resolve auth users still missing a name after source rows + audit JSON
   * (default). When false, prefetch auth for every audit `submitted_by_user_id` on the batch.
   */
  fast?: boolean;
};

function authUserIdsStillNeeded(
  items: Activity[],
  auditRowsByEntityId: Map<string, AuditLogNameRow[]>,
  emailToEmployeeName: Map<string, string>,
  employeeIdToName: Map<string, string>,
  sourceTableNames: Map<string, string>,
  sourceRowsById: Map<string, Record<string, unknown>>
): string[] {
  const needed = new Set<string>();
  const emptyAuth = new Map<string, string>();

  for (const item of items) {
    const resolved = resolveEmployeeName(
      item,
      auditRowsByEntityId,
      emptyAuth,
      emailToEmployeeName,
      employeeIdToName,
      sourceTableNames
    );
    if (resolved) continue;

    for (const r of auditRowsByEntityId.get(item.id) ?? []) {
      const uid = String(r.submitted_by_user_id ?? '').trim();
      if (uid) needed.add(uid);
    }
    const row = sourceRowsById.get(item.id);
    if (row) {
      for (const uid of collectAuthUserIdsFromRecord(row)) needed.add(uid);
    }
  }
  return [...needed];
}

/** Replace view placeholders (`Test Employee`) with real submitter names from source tables + audit_log. */
export async function enrichActivitiesWithEmployeeNames(
  supabase: SupabaseClient,
  items: Activity[],
  options?: EnrichEmployeeNamesOptions
): Promise<Activity[]> {
  if (items.length === 0) return items;

  const ids = items.map((a) => a.id).filter(Boolean);
  const [auditRowsByEntityId, { emailToEmployeeName, employeeIdToName }, sourceFetch] =
    await Promise.all([
      fetchAuditLogRowsByEntityId(supabase, ids),
      fetchEmployeeMaps(supabase),
      fetchSourceTableRowsByActivityId(supabase, items),
    ]);

  const sourceTableNames = new Map<string, string>();
  const emptyAuth = new Map<string, string>();
  for (const [id, row] of sourceFetch) {
    const name = pickNameFromRecord(row, emailToEmployeeName, employeeIdToName, emptyAuth);
    if (name) sourceTableNames.set(id, name);
  }

  let authUserIds: string[];
  if (options?.fast === false) {
    authUserIds = [
      ...new Set(
        [...auditRowsByEntityId.values()]
          .flat()
          .map((r) => String(r.submitted_by_user_id ?? '').trim())
          .filter(Boolean)
      ),
    ];
  } else {
    authUserIds = authUserIdsStillNeeded(
      items,
      auditRowsByEntityId,
      emailToEmployeeName,
      employeeIdToName,
      sourceTableNames,
      sourceFetch
    );
  }

  const userIdToDisplayName =
    authUserIds.length > 0
      ? await buildAuthUserIdToDisplayName(supabase, authUserIds, emailToEmployeeName)
      : new Map<string, string>();

  // Second pass on source rows now that auth map may be populated
  for (const [id, row] of sourceFetch) {
    if (sourceTableNames.has(id)) continue;
    const name = pickNameFromRecord(row, emailToEmployeeName, employeeIdToName, userIdToDisplayName);
    if (name) sourceTableNames.set(id, name);
  }

  return items.map((item) => {
    const resolved = resolveEmployeeName(
      item,
      auditRowsByEntityId,
      userIdToDisplayName,
      emailToEmployeeName,
      employeeIdToName,
      sourceTableNames
    );
    return { ...item, employeeName: resolved ?? 'Unknown' };
  });
}
