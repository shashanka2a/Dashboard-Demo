import { supabaseServer, isDemoEnvironment } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-data';
import { isUuidLike } from '@/lib/is-uuid';
import { calendarDayForSignedRow, dailySignedReportRowLooksSigned } from '@/lib/daily-signed-report-date';
import {
  FIELD_AUDIT_ENTITY_TYPES,
  fieldRowReportDayKey,
  reportDayKey,
  REPORT_FIELD_TABLES,
  type ReportFieldTable,
} from '@/lib/report-day-field-content';
import {
  rowReportDateInRange,
  supabaseFieldRowsInReportRangeFilter,
} from '@/lib/report-date-filter';

export type DailyReportListRange = {
  from?: string | null;
  to?: string | null;
};

export type DailyReportListItem = {
  id: string;
  /** Canonical name from `projects.name` when resolvable */
  projectName: string;
  /** Prefer passing this to `/api/reports/daily` — avoids name mismatches */
  projectId: string | null;
  date: string;
  timestamp: string;
  /** True when a signed `daily_signed_reports` row (with signature) exists for this project and calendar day. */
  reportSigned: boolean;
  weather: { high: number; low: number; condition: 'sunny' | 'rainy' | 'cloudy' };
  photos: string[];
  delays: number;
};

function normName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

type EntryValue = { date: string; projectId: string | null; projectName: string };

/**
 * If the title matches a real project name, use that project's id — activities (and other)
 * sources can attach a wrong `projectId` while the display name is still correct.
 */
function canonicalizeEntry(
  e: EntryValue,
  nameToCanonical: Map<string, { id: string; name: string }>,
  idToName: Record<string, string>
): EntryValue {
  const byName = nameToCanonical.get(normName(e.projectName));
  if (byName) {
    return { date: e.date, projectId: byName.id, projectName: byName.name };
  }
  if (e.projectId && idToName[e.projectId]) {
    return { date: e.date, projectId: e.projectId, projectName: idToName[e.projectId] };
  }
  return e;
}

/**
 * Reports list: one card per (project, report day) when field data exists for that `report_date`.
 * Days with only a signature and no logged field data are omitted.
 */
export async function getDailyReportListItems(
  range?: DailyReportListRange
): Promise<DailyReportListItem[]> {
  if (isDemoEnvironment) {
    return demoStore.reports as DailyReportListItem[];
  }
  const from = range?.from?.trim().slice(0, 10) || null;
  const to = range?.to?.trim().slice(0, 10) || null;
  const ranged = Boolean(from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to));
  const { data: projects, error: projectsError } = await supabaseServer.from('projects').select('id, name');
  if (projectsError) {
    console.error('[daily-report-index] projects:', projectsError.message);
  }
  const projectList = projects || [];
  const idToName = Object.fromEntries(projectList.map((p) => [p.id as string, p.name as string]));
  const nameToCanonical = new Map<string, { id: string; name: string }>();
  for (const p of projectList) {
    nameToCanonical.set(normName(p.name as string), { id: p.id as string, name: p.name as string });
  }

  const entryMap = new Map<string, EntryValue>();
  /** (report day, project) with qualifying field rows — same rules as daily report `hasData`. */
  const fieldContentKeys = new Set<string>();

  function addEntry(dateStr: string, projectId: string | null, rawName?: string | null) {
    let pid = projectId;
    let display = (rawName || '').trim();

    if (!pid && display && isUuidLike(display)) {
      pid = display;
      display = '';
    }

    if (pid && idToName[pid]) {
      display = idToName[pid];
    } else if (!pid && display) {
      const hit = nameToCanonical.get(normName(display));
      if (hit) {
        pid = hit.id;
        display = hit.name;
      }
    } else if (pid && !display) {
      display = idToName[pid] || '';
    }

    if (pid && !display) {
      display = `Project ${pid.slice(0, 8)}…`;
    }

    if (!dateStr || !display) return;

    const key = pid ? `${dateStr}|id:${pid}` : `${dateStr}|n:${normName(display)}`;
    if (!entryMap.has(key)) {
      entryMap.set(key, { date: dateStr, projectId: pid, projectName: display });
    }
  }

  const indexRows = (table: ReportFieldTable, rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      if (ranged && from && to && !rowReportDateInRange(row, from, to)) continue;
      const key = fieldRowReportDayKey(table, row);
      if (!key) continue;
      fieldContentKeys.add(key);
      const projectId = String(row.project_id ?? '').trim();
      const name = idToName[projectId];
      if (!name) continue;
      const dateStr = key.split('|id:')[0];
      addEntry(dateStr, projectId, name);
    }
  };

  const settled = await Promise.all(
    REPORT_FIELD_TABLES.map((table) => {
      const base =
        'logged_at, report_date, project_id, form_data' +
        (table === 'attachments' ? ', cloudinary_urls' : '');
      let q = supabaseServer.from(table).select(base);
      if (ranged && from && to) {
        q = q.or(supabaseFieldRowsInReportRangeFilter(from, to));
      }
      return q;
    })
  );

  for (let i = 0; i < settled.length; i++) {
    const res = settled[i];
    const table = REPORT_FIELD_TABLES[i];
    if (res.error) {
      console.warn(`[daily-report-index] ${table}:`, res.error.message);
      continue;
    }
    indexRows(table, ((res.data ?? []) as unknown) as Record<string, unknown>[]);
  }

  /** `audit_log.report_date` from field sync (when live row date column is missing/wrong). */
  const auditPageSize = 1000;
  const auditMaxRows = ranged ? 5000 : 15000;
  for (let offset = 0; offset < auditMaxRows; offset += auditPageSize) {
    let auditQ = supabaseServer
      .from('audit_log')
      .select('project_id, report_date, entity_type')
      .in('entity_type', [...FIELD_AUDIT_ENTITY_TYPES])
      .not('project_id', 'is', null)
      .not('report_date', 'is', null);
    if (ranged && from && to) {
      auditQ = auditQ.gte('report_date', from).lte('report_date', to);
    }
    const { data, error } = await auditQ.range(offset, offset + auditPageSize - 1);

    if (error) {
      console.warn('[daily-report-index] audit_log:', error.message);
      break;
    }
    const batch = data || [];
    for (const row of batch) {
      const pid = String((row as { project_id?: string }).project_id ?? '').trim();
      const rep = String((row as { report_date?: string }).report_date ?? '').trim().slice(0, 10);
      if (!pid || !/^\d{4}-\d{2}-\d{2}$/.test(rep) || !idToName[pid]) continue;
      fieldContentKeys.add(reportDayKey(rep, pid));
      addEntry(rep, pid, idToName[pid]);
    }
    if (batch.length < auditPageSize) break;
  }

  const signedKeySet = new Set<string>();
  let signedQ = supabaseServer
    .from('daily_signed_reports')
    .select('project_id, signed_at, created_at, report_date, signature_url')
    .not('project_id', 'is', null);
  if (ranged && from && to) {
    signedQ = signedQ.gte('report_date', from).lte('report_date', to);
  }
  const signedRes = await signedQ;
  if (signedRes.error) {
    console.warn('[daily-report-index] daily_signed_reports:', signedRes.error.message);
  } else {
    for (const row of signedRes.data || []) {
      const r = row as {
        project_id?: string | null;
        signed_at?: string | null;
        created_at?: string | null;
        report_date?: unknown;
        signature_url?: string | null;
      };
      const pid = r.project_id != null ? String(r.project_id).trim() : '';
      if (!pid || !idToName[pid]) continue;
      const dateStr = calendarDayForSignedRow(r);
      if (!dateStr) continue;
      if (ranged && from && to && (dateStr < from || dateStr > to)) continue;
      // Draft / placeholder rows without a signature must not mark the day as signed.
      if (!dailySignedReportRowLooksSigned(r)) continue;
      signedKeySet.add(`${dateStr}|id:${pid}`);
      addEntry(dateStr, pid, idToName[pid]);
    }
  }

  const deduped = new Map<string, EntryValue>();
  for (const e of entryMap.values()) {
    const c = canonicalizeEntry(e, nameToCanonical, idToName);
    const key = c.projectId ? `${c.date}|id:${c.projectId}` : `${c.date}|n:${normName(c.projectName)}`;
    if (!deduped.has(key)) deduped.set(key, c);
  }

  const items: DailyReportListItem[] = [];
  for (const e of deduped.values()) {
    if (ranged && from && to && (e.date < from || e.date > to)) continue;
    const reportSigned = Boolean(e.projectId && signedKeySet.has(`${e.date}|id:${e.projectId}`));
    const hasFieldData = Boolean(
      e.projectId && fieldContentKeys.has(reportDayKey(e.date, e.projectId))
    );
    if (!hasFieldData) continue;

    const slug = (e.projectId || e.projectName).toString().replace(/\s+/g, '_');
    items.push({
      id: `${e.date}_${slug}`,
      projectName: e.projectName,
      projectId: e.projectId,
      date: e.date,
      timestamp: new Date(`${e.date}T12:00:00.000Z`).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      reportSigned,
      weather: { high: 75, low: 60, condition: 'sunny' },
      photos: [],
      delays: 0,
    });
  }

  items.sort((a, b) =>
    a.date === b.date ? a.projectName.localeCompare(b.projectName) : b.date.localeCompare(a.date)
  );
  return items;
}

/** Same list rules as project Reports, scoped to one project. */
export async function getDailyReportListItemsForProject(
  projectId: string
): Promise<DailyReportListItem[]> {
  const pid = projectId.trim();
  if (!pid) return [];
  const all = await getDailyReportListItems();
  return all.filter((item) => item.projectId === pid);
}
