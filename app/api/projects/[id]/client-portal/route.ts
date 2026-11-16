import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { DEFAULT_CLIENT_PORTAL_BASE_URL } from '@/lib/app-url';
import { fetchLastMowingDateFromMetrics } from '@/lib/last-mowing-date';
import type { ClientPortalAdminSettings } from '@/lib/client-portal';
import {
  mergePhotoTagCatalog,
  normalizePhotoTagList,
  resolveClientPortalAllowedPhotoTags,
} from '@/lib/client-portal-photo-tags';

export const dynamic = 'force-dynamic';

function dateOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function ymdFromChemRow(row: { report_date?: string | null; logged_at?: string | null }): string | null {
  const rd = row.report_date != null ? String(row.report_date).trim().slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rd)) return rd;
  if (row.logged_at) return String(row.logged_at).slice(0, 10);
  return null;
}

async function latestChemDates(projectId: string): Promise<{
  last_wicking_date: string | null;
  last_spraying_date: string | null;
}> {
  const { data } = await supabaseServer
    .from('chemicals_logs')
    .select('application_type, logged_at, report_date')
    .eq('project_id', projectId)
    .order('logged_at', { ascending: false })
    .limit(80);

  const rows = data ?? [];
  const lastWicking = rows.find((r) => String(r.application_type).toLowerCase() === 'wicking');
  const lastSpraying = rows.find((r) => String(r.application_type).toLowerCase() === 'spraying');
  return {
    last_wicking_date: lastWicking ? ymdFromChemRow(lastWicking) : null,
    last_spraying_date: lastSpraying ? ymdFromChemRow(lastSpraying) : null,
  };
}

function mapSettings(
  project: Record<string, unknown>,
  assigned_clients: ClientPortalAdminSettings['assigned_clients'],
  lastChem: { last_wicking_date: string | null; last_spraying_date: string | null },
  companyPhotoTags: string[]
): ClientPortalAdminSettings {
  const base = DEFAULT_CLIENT_PORTAL_BASE_URL.replace(/\/$/, '');
  const catalog = mergePhotoTagCatalog(companyPhotoTags);
  const storedRaw = project.client_portal_allowed_photo_tags;
  const stored =
    storedRaw == null
      ? null
      : normalizePhotoTagList(Array.isArray(storedRaw) ? storedRaw : []);
  const resolved = resolveClientPortalAllowedPhotoTags(stored, catalog);

  return {
    project_id: String(project.id),
    project_name: String(project.name),
    job_number: project.job_number != null ? String(project.job_number) : null,
    client_portal_enabled: !!project.client_portal_enabled,
    cover_photo_url: project.cover_photo_url != null ? String(project.cover_photo_url) : null,
    cover_photo_public_id:
      project.cover_photo_public_id != null ? String(project.cover_photo_public_id) : null,
    kmz_url: project.kmz_url != null ? String(project.kmz_url) : null,
    kmz_public_id: project.kmz_public_id != null ? String(project.kmz_public_id) : null,
    kmz_filename: project.kmz_filename != null ? String(project.kmz_filename) : null,
    kmz_uploaded_at: project.kmz_uploaded_at != null ? String(project.kmz_uploaded_at) : null,
    google_earth_url: project.google_earth_url != null ? String(project.google_earth_url) : null,
    last_wicking_date: lastChem.last_wicking_date,
    last_spraying_date: lastChem.last_spraying_date,
    last_mowing_date: dateOrNull(project.last_mowing_date),
    next_wicking_date: dateOrNull(project.next_wicking_date),
    next_spraying_date: dateOrNull(project.next_spraying_date),
    next_mowing_date: dateOrNull(project.next_mowing_date),
    portal_url: `${base}/`,
    assigned_clients,
    client_portal_allowed_photo_tags: stored,
    available_photo_tags: catalog,
    resolved_allowed_photo_tags: resolved,
  };
}

const PROJECT_SELECT =
  'id, name, job_number, client_portal_enabled, client_portal_allowed_photo_tags, cover_photo_url, cover_photo_public_id, kmz_url, kmz_public_id, kmz_filename, kmz_uploaded_at, google_earth_url, next_wicking_date, next_spraying_date, next_mowing_date, last_mowing_date';

async function loadCompanyPhotoTagNames(): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from('company_photo_tags')
    .select('name')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.warn('[client-portal] company_photo_tags:', error.message);
    return [];
  }
  return (data ?? []).map((r) => String((r as { name?: string }).name || '').trim()).filter(Boolean);
}

// GET /api/projects/[id]/client-portal
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const { data: project, error } = await supabaseServer
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const [{ data: access, error: accessErr }, lastChem, companyPhotoTags, lastMowingFromMetrics] =
    await Promise.all([
      supabaseServer.from('client_project_access').select('client_id').eq('project_id', id),
      latestChemDates(id),
      loadCompanyPhotoTagNames(),
      fetchLastMowingDateFromMetrics(supabaseServer, id),
    ]);
  // Last mowing comes from the latest mowing-acres metric log (stored value is only a fallback).
  if (lastMowingFromMetrics) {
    (project as Record<string, unknown>).last_mowing_date = lastMowingFromMetrics;
  }

  let assigned_clients: ClientPortalAdminSettings['assigned_clients'] = [];
  if (!accessErr && access?.length) {
    const clientIds = access.map((a) => String(a.client_id));
    const { data: clients } = await supabaseServer
      .from('clients')
      .select('id, name, email')
      .in('id', clientIds);
    assigned_clients = (clients ?? []).map((c) => ({
      id: String(c.id),
      name: String(c.name),
      email: c.email != null ? String(c.email) : null,
    }));
  }

  void request;
  return NextResponse.json(
    mapSettings(project as Record<string, unknown>, assigned_clients, lastChem, companyPhotoTags)
  );
}

// PUT /api/projects/[id]/client-portal
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.client_portal_enabled === 'boolean') {
    patch.client_portal_enabled = body.client_portal_enabled;
  }
  if ('google_earth_url' in body) {
    const url =
      body.google_earth_url == null ? null : String(body.google_earth_url).trim() || null;
    patch.google_earth_url = url;
  }

  for (const key of [
    'next_wicking_date',
    'next_spraying_date',
    'next_mowing_date',
    'last_mowing_date',
  ] as const) {
    if (key in body) {
      patch[key] = dateOrNull(body[key]);
    }
  }

  if ('client_portal_allowed_photo_tags' in body) {
    const raw = body.client_portal_allowed_photo_tags;
    if (raw === null) {
      patch.client_portal_allowed_photo_tags = null;
    } else if (Array.isArray(raw)) {
      patch.client_portal_allowed_photo_tags = normalizePhotoTagList(raw);
    } else {
      return NextResponse.json(
        { error: 'client_portal_allowed_photo_tags must be an array or null' },
        { status: 400 }
      );
    }
  }

  const { error } = await supabaseServer.from('projects').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return GET(request, context);
}
