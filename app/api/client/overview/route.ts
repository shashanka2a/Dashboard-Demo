import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { clientCanAccessProject } from '@/lib/client-session';
import { parseCloudinaryUrlsField } from '@/lib/photo-url';
import { fetchLastMowingDateFromMetrics } from '@/lib/last-mowing-date';
import { getDailyReportListItemsForProject } from '@/lib/daily-report-index';
import { calendarDayForSignedRow, dailySignedReportRowLooksSigned } from '@/lib/daily-signed-report-date';
import type {
  ClientDailyReport,
  ClientMaintenanceEvent,
  ClientOverview,
  ClientPhoto,
  ClientProjectSummary,
  ClientWatchlistItem,
} from '@/lib/client-portal';
import {
  mergePhotoTagCatalog,
  normalizePhotoTagList,
  photoTagsAllowedInClientPortal,
  resolveClientPortalAllowedPhotoTags,
} from '@/lib/client-portal-photo-tags';

export const dynamic = 'force-dynamic';

function ymdFromRow(row: { report_date?: string | null; logged_at?: string | null }): string | null {
  const rd = row.report_date != null ? String(row.report_date).trim().slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rd)) return rd;
  if (row.logged_at) return String(row.logged_at).slice(0, 10);
  return null;
}

function classifyWatchlistSection(type: string, category: string, description: string): ClientWatchlistItem['section'] {
  const hay = `${type} ${category} ${description}`.toLowerCase();
  if (/weed|kudzu|thistle|invasive|vegetation|wildlife/.test(hay)) return 'weeds';
  if (/hazard|ppe|chemical|material|gator|hog|safety|hazards on site/.test(hay)) return 'hazards';
  return 'problems';
}

function mapProject(row: Record<string, unknown>): ClientProjectSummary {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    client_name: row.client_name != null ? String(row.client_name) : null,
    job_number: row.job_number != null ? String(row.job_number) : null,
    status: String(row.status || 'active'),
    street_address: row.street_address != null ? String(row.street_address) : null,
    city: row.city != null ? String(row.city) : null,
    state: row.state != null ? String(row.state) : null,
    zip_code: row.zip_code != null ? String(row.zip_code) : null,
    country: row.country != null ? String(row.country) : null,
    start_date: row.start_date != null ? String(row.start_date).slice(0, 10) : null,
    end_date: row.end_date != null ? String(row.end_date).slice(0, 10) : null,
    acres_completed:
      typeof row.acres_completed === 'number'
        ? row.acres_completed
        : row.acres_completed != null
          ? Number(row.acres_completed)
          : null,
  };
}

// GET /api/client/overview?project_id=… — requires client portal auth
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id')?.trim();
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  const access = await clientCanAccessProject(request, projectId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const clientSession = access.session;
  const clientId = clientSession.client.id;

  const pid = projectId;

  const { data: fullProject, error: projLoadErr } = await supabaseServer
    .from('projects')
    .select('*')
    .eq('id', pid)
    .single();

  if (projLoadErr || !fullProject) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const projectRecord = fullProject as Record<string, unknown>;

  const { data: companyTagRows } = await supabaseServer
    .from('company_photo_tags')
    .select('name')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  const companyPhotoTags = (companyTagRows ?? [])
    .map((r) => String((r as { name?: string }).name || '').trim())
    .filter(Boolean);
  const photoTagCatalog = mergePhotoTagCatalog(companyPhotoTags);
  const storedAllowlist = normalizePhotoTagList(projectRecord.client_portal_allowed_photo_tags);
  const allowedPhotoTags = resolveClientPortalAllowedPhotoTags(
    projectRecord.client_portal_allowed_photo_tags == null ? null : storedAllowlist,
    photoTagCatalog
  );

  const { data: clientRow } = await supabaseServer
    .from('clients')
    .select('company_name, street_address, city, state, zip_code')
    .eq('id', clientId)
    .maybeSingle();

  const projectContractPo =
    projectRecord.contract_po != null ? String(projectRecord.contract_po).trim() || null : null;
  const projectContractExpiration =
    projectRecord.contract_expiration != null
      ? String(projectRecord.contract_expiration).slice(0, 10)
      : null;
  const projectWickdContactId =
    projectRecord.wickd_contact_employee_id != null
      ? String(projectRecord.wickd_contact_employee_id)
      : null;
  const projectSuperintendentName =
    projectRecord.superintendent_name != null
      ? String(projectRecord.superintendent_name).trim() || null
      : null;
  const projectSuperintendentPhone =
    projectRecord.superintendent_phone != null
      ? String(projectRecord.superintendent_phone).trim() || null
      : null;

  let wickdContact: { name: string; phone: string | null; email: string | null } | null = null;
  if (projectWickdContactId) {
    const { data: emp } = await supabaseServer
      .from('employees')
      .select('name, phone, email')
      .eq('id', projectWickdContactId)
      .maybeSingle();
    if (emp) {
      wickdContact = {
        name: String(emp.name),
        phone: emp.phone != null ? String(emp.phone) : null,
        email: emp.email != null ? String(emp.email) : null,
      };
    }
  }

  const [
    companyRes,
    chemRes,
    metricsRes,
    obsRes,
    attachRes,
    notesRes,
  ] = await Promise.all([
    supabaseServer.from('company_settings').select('company_name, company_phone, company_email').eq('id', 'default').maybeSingle(),
    supabaseServer
      .from('chemicals_logs')
      .select('id, application_type, logged_at, report_date')
      .eq('project_id', pid)
      .order('logged_at', { ascending: false })
      .limit(50),
    supabaseServer
      .from('metrics')
      .select('acres_completed, water_usage, green_space_completed, logged_at, report_date')
      .eq('project_id', pid)
      .order('logged_at', { ascending: false })
      .limit(1),
    supabaseServer
      .from('observations')
      .select('id, category, type, title, status, progress, description, location, logged_at, report_date')
      .eq('project_id', pid)
      .in('status', ['Open', 'open'])
      .order('logged_at', { ascending: false })
      .limit(40),
    supabaseServer
      .from('attachments')
      .select('id, notes, cloudinary_urls, tags, logged_at, report_date')
      .eq('project_id', pid)
      .order('logged_at', { ascending: false })
      .limit(80),
    supabaseServer
      .from('notes')
      .select('id, category, notes_text, photos, logged_at, report_date')
      .eq('project_id', pid)
      .order('logged_at', { ascending: false })
      .limit(40),
  ]);

  const project = mapProject(projectRecord);

  const chemRows = chemRes.data ?? [];
  const lastSpraying = chemRows.find((r) => String(r.application_type).toLowerCase() === 'spraying');
  const lastWicking = chemRows.find((r) => String(r.application_type).toLowerCase() === 'wicking');

  const latestMetric = metricsRes.data?.[0];
  const acresFromMetric = latestMetric?.acres_completed != null ? Number(latestMetric.acres_completed) : null;

  const lastWickingDate = lastWicking ? ymdFromRow(lastWicking) : null;
  const lastSprayingDate = lastSpraying ? ymdFromRow(lastSpraying) : null;
  const lastMowingFromMetrics = await fetchLastMowingDateFromMetrics(supabaseServer, pid);
  const lastMowingDate =
    lastMowingFromMetrics ??
    (projectRecord.last_mowing_date != null
      ? String(projectRecord.last_mowing_date).slice(0, 10)
      : null);
  const nextWickingDate =
    projectRecord.next_wicking_date != null
      ? String(projectRecord.next_wicking_date).slice(0, 10)
      : null;
  const nextSprayingDate =
    projectRecord.next_spraying_date != null
      ? String(projectRecord.next_spraying_date).slice(0, 10)
      : null;
  const nextMowingDate =
    projectRecord.next_mowing_date != null
      ? String(projectRecord.next_mowing_date).slice(0, 10)
      : null;

  const maintenance: ClientMaintenanceEvent[] = [
    {
      id: 'last-wicking',
      label: 'Last Wicking',
      date: lastWickingDate,
      kind: 'wicking',
      upcoming: false,
    },
    {
      id: 'last-spraying',
      label: 'Last Spraying',
      date: lastSprayingDate,
      kind: 'spraying',
      upcoming: false,
    },
    {
      id: 'last-mowing',
      label: 'Last Mowing',
      date: lastMowingDate && /^\d{4}-\d{2}-\d{2}$/.test(lastMowingDate) ? lastMowingDate : null,
      kind: 'mowing',
      upcoming: false,
    },
    {
      id: 'next-wicking',
      label: 'Next Wicking',
      date: nextWickingDate && /^\d{4}-\d{2}-\d{2}$/.test(nextWickingDate) ? nextWickingDate : null,
      kind: 'wicking',
      upcoming: true,
    },
    {
      id: 'next-spraying',
      label: 'Next Spraying',
      date: nextSprayingDate && /^\d{4}-\d{2}-\d{2}$/.test(nextSprayingDate) ? nextSprayingDate : null,
      kind: 'spraying',
      upcoming: true,
    },
    {
      id: 'next-mowing',
      label: 'Next Mowing',
      date: nextMowingDate && /^\d{4}-\d{2}-\d{2}$/.test(nextMowingDate) ? nextMowingDate : null,
      kind: 'mowing',
      upcoming: true,
    },
  ];

  const watchlist: ClientWatchlistItem[] = (obsRes.data ?? []).map((o) => {
    const type = String(o.type || '');
    const category = String(o.category || 'Negative');
    const description = String(o.description || '');
    const title = String(o.title || type || category || 'Observation');
    return {
      id: String(o.id),
      section: classifyWatchlistSection(type, category, description),
      title,
      description: description || '—',
      location: o.location != null ? String(o.location) : null,
      priority: o.progress != null ? String(o.progress) : null,
      status: o.status != null ? String(o.status) : null,
    };
  });

  const photos: ClientPhoto[] = [];
  for (const att of attachRes.data ?? []) {
    const urls = parseCloudinaryUrlsField(att.cloudinary_urls);
    const caption = String(att.notes || '').trim();
    const date = ymdFromRow(att);
    const rowTags = normalizePhotoTagList((att as { tags?: unknown }).tags);
    if (!photoTagsAllowedInClientPortal(rowTags, allowedPhotoTags)) continue;

    urls.forEach((url, i) => {
      photos.push({
        id: `${att.id}-${i}`,
        url,
        caption,
        tags: rowTags.length > 0 ? rowTags : ['Site photo'],
        date,
      });
    });
  }
  for (const note of notesRes.data ?? []) {
    const category = String(note.category || 'General');
    const text = String(note.notes_text || '').trim();
    const date = ymdFromRow(note);
    const noteTag = category.trim();
    if (noteTag && !photoTagsAllowedInClientPortal([noteTag], allowedPhotoTags)) continue;

    const notePhotos = Array.isArray(note.photos) ? note.photos.filter((u): u is string => typeof u === 'string') : [];
    notePhotos.forEach((url, i) => {
      photos.push({
        id: `note-${note.id}-${i}`,
        url,
        caption: text || category,
        tags: [category],
        date,
      });
    });
  }

  const reportItems = await getDailyReportListItemsForProject(pid);
  const { data: signedRows } = await supabaseServer
    .from('daily_signed_reports')
    .select('report_date, signed_at, prepared_by, signature_url, created_at')
    .eq('project_id', pid);

  const signedByDate = new Map<
    string,
    { prepared_by?: string | null; signed_at?: string | null }
  >();
  for (const row of signedRows ?? []) {
    if (!dailySignedReportRowLooksSigned(row)) continue;
    const day = calendarDayForSignedRow(row);
    if (!day) continue;
    if (!signedByDate.has(day)) {
      signedByDate.set(day, row);
    }
  }

  const reports: ClientDailyReport[] = reportItems.map((item) => {
    const signed = item.date ? signedByDate.get(item.date) : undefined;
    return {
      id: item.id,
      report_date: item.date,
      prepared_by: signed?.prepared_by != null ? String(signed.prepared_by) : null,
      report_signed: item.reportSigned,
      signed_at: signed?.signed_at != null ? String(signed.signed_at) : null,
    };
  });

  const coverFromProject =
    projectRecord.cover_photo_url != null ? String(projectRecord.cover_photo_url) : null;
  const cover_photo_url = coverFromProject || photos[0]?.url || null;
  const kmzUrl = projectRecord.kmz_url != null ? String(projectRecord.kmz_url) : null;
  const googleEarthUrl =
    projectRecord.google_earth_url != null ? String(projectRecord.google_earth_url) : null;

  if (projectRecord.client_portal_enabled === false) {
    return NextResponse.json(
      { error: 'Client portal is not enabled for this project.' },
      { status: 403 }
    );
  }

  const payload: ClientOverview = {
    project,
    company: {
      company_name: String(companyRes.data?.company_name || "Wick'd Environmental Technologies"),
      company_phone: companyRes.data?.company_phone != null ? String(companyRes.data.company_phone) : null,
      company_email: companyRes.data?.company_email != null ? String(companyRes.data.company_email) : null,
    },
    wickd_contact: wickdContact,
    superintendent: {
      name: projectSuperintendentName,
      phone: projectSuperintendentPhone,
    },
    contract_po: projectContractPo,
    contract_expiration: projectContractExpiration || project.end_date,
    client_company_name:
      (clientRow?.company_name != null ? String(clientRow.company_name) : null) ||
      clientSession.client.company_name ||
      project.client_name,
    cover_photo_url,
    mapping: {
      kmz_url: kmzUrl,
      google_earth_url: googleEarthUrl,
      preview_image_url: cover_photo_url,
    },
    progress: {
      acres_completed: acresFromMetric ?? project.acres_completed,
      last_spraying_date: lastSpraying ? ymdFromRow(lastSpraying) : null,
      last_wicking_date: lastWicking ? ymdFromRow(lastWicking) : null,
      water_usage_latest:
        latestMetric?.water_usage != null ? Number(latestMetric.water_usage) : null,
      green_space_latest:
        latestMetric?.green_space_completed != null ? Number(latestMetric.green_space_completed) : null,
    },
    maintenance,
    watchlist,
    photos,
    reports,
  };

  return NextResponse.json(payload);
}
