import type { SupabaseClient } from '@supabase/supabase-js';
import cloudinary from '@/lib/cloudinary';
import { normalizeRemotePhotoUrl, parseCloudinaryUrlsField } from '@/lib/photo-url';

export type PhotoSourceType =
  | 'Attachments'
  | 'Notes'
  | 'Metrics'
  | 'Chemicals'
  | 'Incidents'
  | 'Observations'
  | 'Checklists';

type PhotoSourceConfig = {
  table: string;
  column: string;
  /** Parallel array column (e.g. attachments.file_names). */
  namesColumn?: string;
};

export const PHOTO_SOURCE_BY_ACTIVITY_TYPE: Record<PhotoSourceType, PhotoSourceConfig> = {
  Attachments: { table: 'attachments', column: 'cloudinary_urls', namesColumn: 'file_names' },
  Notes: { table: 'notes', column: 'photos' },
  Metrics: { table: 'metrics', column: 'photos' },
  Chemicals: { table: 'chemicals_logs', column: 'photos' },
  Incidents: { table: 'incidents', column: 'photos' },
  Observations: { table: 'observations', column: 'attachments' },
  Checklists: { table: 'equipment_checklists', column: 'photos' },
};

const ALL_SOURCES = Object.values(PHOTO_SOURCE_BY_ACTIVITY_TYPE);

function urlKey(raw: string): string {
  return normalizeRemotePhotoUrl(String(raw || '').trim()).split('?')[0].toLowerCase();
}

function urlsMatch(a: string, b: string): boolean {
  const ka = urlKey(a);
  const kb = urlKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const fa = ka.split('/').pop() || '';
  const fb = kb.split('/').pop() || '';
  return Boolean(fa && fb && fa === fb);
}

function rowContainsUrl(row: Record<string, unknown>, column: string, targetUrl: string): boolean {
  return parseCloudinaryUrlsField(row[column]).some((u) => urlsMatch(u, targetUrl));
}

function filterPhotoArrayRaw(
  raw: unknown,
  targetUrl: string
): { updated: unknown; removed: boolean; removedIndex: number } {
  const removedIndex = -1;

  if (raw == null) return { updated: raw, removed: false, removedIndex };

  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return { updated: raw, removed: false, removedIndex };
    if (t.startsWith('[') || t.startsWith('{')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        const r = filterPhotoArrayRaw(parsed, targetUrl);
        return { updated: JSON.stringify(r.updated), removed: r.removed, removedIndex: r.removedIndex };
      } catch {
        return { updated: raw, removed: false, removedIndex };
      }
    }
    if (urlsMatch(t, targetUrl)) return { updated: null, removed: true, removedIndex: 0 };
    return { updated: raw, removed: false, removedIndex };
  }

  if (!Array.isArray(raw)) {
    if (typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      const u = String(o.secure_url ?? o.url ?? '');
      if (u && urlsMatch(u, targetUrl)) return { updated: null, removed: true, removedIndex: 0 };
    }
    return { updated: raw, removed: false, removedIndex };
  }

  const kept: unknown[] = [];
  let removed = false;
  let idx = -1;
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    let hit = false;
    if (typeof item === 'string') {
      hit = urlsMatch(item, targetUrl);
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const u = String(o.secure_url ?? o.url ?? '');
      hit = Boolean(u && urlsMatch(u, targetUrl));
    }
    if (hit) {
      removed = true;
      idx = i;
    } else {
      kept.push(item);
    }
  }
  return { updated: kept, removed, removedIndex: idx };
}

function cloudinaryPublicIdFromUrl(url: string): string | null {
  const normalized = normalizeRemotePhotoUrl(url);
  const m = normalized.match(/\/upload\/(.+?)(?:\?|#|$)/i);
  if (!m?.[1]) return null;
  let path = m[1].replace(/^v\d+\//, '');
  return path || null;
}

async function destroyCloudinaryAsset(url: string): Promise<void> {
  const publicId = cloudinaryPublicIdFromUrl(url);
  if (!publicId) return;
  try {
    await new Promise<void>((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, { invalidate: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (e) {
    console.warn('[project-photo-delete] Cloudinary destroy failed:', e);
  }
}

function isPhotoSourceType(v: string): v is PhotoSourceType {
  return v in PHOTO_SOURCE_BY_ACTIVITY_TYPE;
}

async function deleteFromSource(
  supabase: SupabaseClient,
  source: PhotoSourceConfig,
  rowId: string,
  targetUrl: string
): Promise<boolean> {
  const { data: row, error } = await supabase.from(source.table).select('*').eq('id', rowId).maybeSingle();

  if (error || !row) return false;

  const record = row as Record<string, unknown>;
  if (!rowContainsUrl(record, source.column, targetUrl)) return false;

  const { updated, removed, removedIndex } = filterPhotoArrayRaw(record[source.column], targetUrl);
  if (!removed) return false;

  const remaining = parseCloudinaryUrlsField(updated);
  if (source.table === 'attachments' && remaining.length === 0) {
    const { error: delErr } = await supabase.from(source.table).delete().eq('id', rowId);
    if (delErr) throw new Error(delErr.message);
    return true;
  }

  const patch: Record<string, unknown> = { [source.column]: updated };
  if (source.namesColumn && removedIndex >= 0 && Array.isArray(record[source.namesColumn])) {
    const names = [...(record[source.namesColumn] as unknown[])];
    if (removedIndex < names.length) names.splice(removedIndex, 1);
    patch[source.namesColumn] = names;
  }

  const { error: upErr } = await supabase.from(source.table).update(patch).eq('id', rowId);
  if (upErr) throw new Error(upErr.message);
  return true;
}

async function findRowByUrl(
  supabase: SupabaseClient,
  targetUrl: string,
  projectId?: string | null
): Promise<{ source: PhotoSourceConfig; rowId: string } | null> {
  for (const source of ALL_SOURCES) {
    let query = supabase.from(source.table).select('*').limit(300);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) continue;

    for (const row of data || []) {
      const record = row as Record<string, unknown>;
      if (!rowContainsUrl(record, source.column, targetUrl)) continue;
      const id = String(record.id ?? '').trim();
      if (id) return { source, rowId: id };
    }
  }
  return null;
}

export async function deleteProjectPhoto(
  supabase: SupabaseClient,
  opts: {
    url: string;
    sourceId?: string | null;
    sourceType?: string | null;
    projectId?: string | null;
  }
): Promise<{ deleted: boolean }> {
  const targetUrl = String(opts.url || '').trim();
  if (!targetUrl) throw new Error('Photo URL is required.');

  let deleted = false;

  if (opts.sourceId && opts.sourceType && isPhotoSourceType(opts.sourceType)) {
    const source = PHOTO_SOURCE_BY_ACTIVITY_TYPE[opts.sourceType];
    deleted = await deleteFromSource(supabase, source, opts.sourceId, targetUrl);
  }

  if (!deleted) {
    const hit = await findRowByUrl(supabase, targetUrl, opts.projectId);
    if (hit) {
      deleted = await deleteFromSource(supabase, hit.source, hit.rowId, targetUrl);
    }
  }

  if (!deleted) {
    return { deleted: false };
  }

  await destroyCloudinaryAsset(targetUrl);
  return { deleted: true };
}
