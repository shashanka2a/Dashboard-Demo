import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { isUuidLike } from '@/lib/is-uuid';
import { isSafetyTalkCompletedStatus } from '@/lib/safety-talk-status';
import { formatYmdInTimeZone, getActivityDisplayTimeZone } from '@/lib/activity-display-timezone';
import { entityIdsFromAuditLogForProjectDay, fetchTableRowsByIds } from '@/lib/audit-log-entity-ids';
import {
  fetchEmployeeNameMap,
  mapSafetyTalkAttendees,
  parseAttendeeEmployeeIds,
  type SafetyTalkAttendee,
} from '@/lib/safety-talk-attendees';

type SafetyTalkEvent = {
  id: string;
  project_id: string;
  project_name: string;
  template_id: string | null;
  template_name: string;
  scheduled_date: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  pdf_url: string | null;
  /** PDF for the conducted session (sign-in / completed doc); from `safety_talks.attendance_pdf_url`. */
  attendance_pdf_url: string | null;
  /** Calendar day for grouping (scheduled_date, else created_at in display TZ). */
  display_date: string;
  /** Resolved from `attendees` + `employees` */
  attendees: SafetyTalkAttendee[];
  attendee_count: number;
};

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeStatus(s: string | null | undefined): string {
  return String(s || '').trim().toLowerCase();
}

function rowDisplayDateYmd(r: Record<string, unknown>): string {
  const tz = getActivityDisplayTimeZone();
  const sd = r.scheduled_date != null ? String(r.scheduled_date).trim().slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(sd)) return sd;
  if (r.created_at != null && String(r.created_at).trim()) {
    return formatYmdInTimeZone(new Date(String(r.created_at)), tz);
  }
  return ymdUtc(new Date());
}

/** Row belongs to calendar day `targetYmd` (scheduled work day or created_at in display TZ). */
function safetyTalkOnCalendarDay(r: Record<string, unknown>, targetYmd: string): boolean {
  return rowDisplayDateYmd(r) === targetYmd;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date'); // optional YYYY-MM-DD
  let projectParam = searchParams.get('project');
  let projectIdParam = searchParams.get('project_id');
  const statusParam = searchParams.get('status'); // completed | scheduled | upcoming | past | all

  if (!projectIdParam && projectParam && isUuidLike(projectParam)) {
    projectIdParam = projectParam.trim();
    projectParam = null;
  }

  const targetYmd = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  const status = normalizeStatus(statusParam);

  // Resolve project(s)
  let projects: { id: string; name: string }[] = [];
  if (projectIdParam) {
    const { data, error } = await supabaseServer.from('projects').select('id, name').eq('id', projectIdParam.trim()).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.id) return NextResponse.json([], { status: 200 });
    projects = [{ id: String(data.id), name: String(data.name || '') }];
  } else if (projectParam && projectParam.trim() && projectParam !== 'All Projects') {
    const { data, error } = await supabaseServer.from('projects').select('id, name').eq('name', projectParam.trim()).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.id) return NextResponse.json([], { status: 200 });
    projects = [{ id: String(data.id), name: String(data.name || '') }];
  } else {
    const { data, error } = await supabaseServer.from('projects').select('id, name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    projects = (data || []).map((p) => ({ id: String(p.id), name: String((p as any).name || '') }));
  }

  const projectIds = projects.map((p) => p.id);
  const projectIdToName = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  // Fetch events (when filtering by date, include scheduled-on-day OR rows near that day in time for TZ/report matching)
  let q = supabaseServer.from('safety_talks').select('*').in('project_id', projectIds);
  if (targetYmd) {
    const far = new Date(`${targetYmd}T12:00:00.000Z`);
    far.setUTCDate(far.getUTCDate() - 500);
    q = q.or(`scheduled_date.eq.${targetYmd},created_at.gte.${far.toISOString()}`);
  }
  const { data: rows, error } = await q.order('scheduled_date', { ascending: false }).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rowList = rows || [];
  let auditDayTalkIds = new Set<string>();

  if (targetYmd && projectIds.length > 0) {
    const auditIds = await entityIdsFromAuditLogForProjectDay(supabaseServer, {
      entityType: 'safety_talks',
      projectIds,
      dateYmd: targetYmd,
    });
    auditDayTalkIds = new Set(auditIds);
    if (auditIds.length > 0) {
      const extra = await fetchTableRowsByIds(supabaseServer, 'safety_talks', auditIds, projectIds);
      const byId = new Map(rowList.map((r: { id?: string }) => [String((r as { id?: string }).id ?? ''), r]));
      for (const r of extra) byId.set(String((r as { id?: string }).id ?? ''), r);
      rowList = [...byId.values()];
    }
  }

  if (targetYmd) {
    rowList = rowList.filter(
      (r: Record<string, unknown>) =>
        safetyTalkOnCalendarDay(r, targetYmd) || auditDayTalkIds.has(String((r as { id?: string }).id ?? ''))
    );
  }

  const attendeeIds = new Set<string>();
  for (const r of rowList) {
    for (const id of parseAttendeeEmployeeIds((r as { attendees?: unknown }).attendees)) {
      attendeeIds.add(id);
    }
  }
  const employeeNameById = await fetchEmployeeNameMap(supabaseServer, [...attendeeIds]);

  // Template → pdf_url (optional)
  const templateIds = Array.from(
    new Set(rowList.map((r: any) => (r.template_id ? String(r.template_id) : '')).filter(Boolean))
  );
  let templateUrlMap: Record<string, string> = {};
  if (templateIds.length > 0) {
    const { data: temps, error: tErr } = await supabaseServer
      .from('safety_talk_templates')
      .select('id, pdf_url')
      .in('id', templateIds);
    if (!tErr) {
      templateUrlMap = Object.fromEntries((temps || []).map((t: any) => [String(t.id), String(t.pdf_url || '')]));
    }
  }

  const mapped: SafetyTalkEvent[] = rowList.map((r: any) => {
    const tid = r.template_id ? String(r.template_id) : null;
    const pdf = tid ? templateUrlMap[tid] : '';
    const attendees = mapSafetyTalkAttendees(r.attendees, employeeNameById);
    const display_date = rowDisplayDateYmd(r as Record<string, unknown>);
    return {
      id: String(r.id),
      project_id: String(r.project_id || ''),
      project_name: projectIdToName[String(r.project_id || '')] || 'Unknown Project',
      template_id: tid,
      template_name: String(r.template_name || 'Safety Talk'),
      scheduled_date: r.scheduled_date ? String(r.scheduled_date) : null,
      display_date,
      status: r.status ? String(r.status) : null,
      created_at: r.created_at ? String(r.created_at) : null,
      completed_at:
        r.completed_at != null && String(r.completed_at).trim()
          ? String(r.completed_at)
          : null,
      pdf_url: pdf || null,
      attendance_pdf_url:
        r.attendance_pdf_url != null && String(r.attendance_pdf_url).trim()
          ? String(r.attendance_pdf_url).trim()
          : null,
      attendees,
      attendee_count: attendees.length,
    };
  });

  const isCompleted = (e: SafetyTalkEvent) => isSafetyTalkCompletedStatus(e.status);

  const out = mapped.filter((e) => {
    if (!status || status === 'all') return true;
    if (status === 'completed' || status === 'past') return isCompleted(e);
    if (status === 'scheduled' || status === 'upcoming') return !isCompleted(e);
    return normalizeStatus(e.status) === status;
  });

  out.sort((a, b) => {
    const dateCmp = (b.display_date || '').localeCompare(a.display_date || '');
    if (dateCmp !== 0) return dateCmp;
    const ta = String(b.created_at || b.completed_at || '');
    const tb = String(a.created_at || a.completed_at || '');
    return ta.localeCompare(tb);
  });

  return NextResponse.json(out);
}

