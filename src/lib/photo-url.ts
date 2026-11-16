/** True if the string looks like a host/path URL but may omit https:// (common from mobile clients). */
export function looksLikeRemoteAssetUrl(t: string): boolean {
  const s = t.trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s) || s.startsWith('//')) return true;
  return /\.cloudinary\.com\//i.test(s) || /\.supabase\.co\//i.test(s) || /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\//i.test(s);
}

/** Normalize remote image URLs for Next/Image and <img> (protocol-relative, http→https, bare host/path). */
export function normalizeRemotePhotoUrl(raw: string): string {
  let s = String(raw || '').trim();
  if (!s) return s;
  if (s.startsWith('//')) s = `https:${s}`;
  else if (!/^https?:\/\//i.test(s) && looksLikeRemoteAssetUrl(s)) {
    s = `https://${s.replace(/^\/+/, '')}`;
  }
  if (s.startsWith('http://')) s = `https://${s.slice(7)}`;
  return s;
}

/**
 * True if the URL can be loaded in the browser as `img src` / `next/image` (https/http or //).
 * Rejects bare filenames (e.g. iOS temp `671FFD68-....jpg`), `file://`, and other non-remote values
 * that would otherwise resolve as same-origin paths and return 404.
 */
export function isBrowserResolvableUrl(raw: string): boolean {
  const s = normalizeRemotePhotoUrl(String(raw || '').trim());
  if (!s || /^file:/i.test(s)) return false;
  return /^https?:\/\//i.test(s) || s.startsWith('//');
}

/** `<img>` cannot render PDFs/ZIPs — show a link instead. */
export function isDisplayableImageUrl(url: string): boolean {
  const path = url.split('?')[0].toLowerCase();
  if (/\.(pdf|zip|doc|docx)$/i.test(path)) return false;
  return true;
}

/**
 * Parse Cloudinary URL field from DB: JSON string, array of strings, array of { url | secure_url }, or single URL string.
 */
export function parseCloudinaryUrlsField(raw: unknown): string[] {
  if (raw == null) return [];

  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith('[') || t.startsWith('{')) {
      try {
        return parseCloudinaryUrlsField(JSON.parse(t));
      } catch {
        return looksLikeRemoteAssetUrl(t) ? [normalizeRemotePhotoUrl(t)] : [];
      }
    }
    if (looksLikeRemoteAssetUrl(t)) return [normalizeRemotePhotoUrl(t)];
    return [];
  }

  if (!Array.isArray(raw)) {
    if (typeof raw === 'object' && raw !== null) {
      const o = raw as Record<string, unknown>;
      const nested = o.urls ?? o.resources ?? o.files ?? o.images ?? o.data ?? o.attachments;
      if (nested != null && nested !== raw) return parseCloudinaryUrlsField(nested);
      const u = (o.secure_url ?? o.url) as string | undefined;
      if (typeof u === 'string' && u.trim()) return [normalizeRemotePhotoUrl(u)];
    }
    return [];
  }

  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push(normalizeRemotePhotoUrl(item));
    } else if (item && typeof item === 'object') {
      const o = item as { secure_url?: string; url?: string };
      const u = o.secure_url || o.url;
      if (typeof u === 'string' && u.trim()) out.push(normalizeRemotePhotoUrl(u));
    }
  }
  return out.filter(Boolean);
}

const CLOUDINARY_HOST_RE = /\.cloudinary\.com\//i;

/** True when the URL points at a Cloudinary-hosted asset (upload finished). */
export function isCloudinaryAssetUrl(url: string): boolean {
  const s = normalizeRemotePhotoUrl(String(url || '').trim());
  return Boolean(s) && CLOUDINARY_HOST_RE.test(s);
}

/** Parsed URLs limited to Cloudinary (excludes bare filenames, Supabase-only, etc.). */
export function cloudinaryUploadedUrls(raw: unknown): string[] {
  return parseCloudinaryUrlsField(raw).filter(isCloudinaryAssetUrl);
}

export function hasCloudinaryUploadedUrls(raw: unknown): boolean {
  return cloudinaryUploadedUrls(raw).length > 0;
}

const REPORT_EMBED_TRANSFORM = 'w_520,c_limit,q_auto:good,f_auto';

/**
 * Smaller Cloudinary variant for PDF/print embeds (~3-col grid @ ~170px).
 * Full-size URLs are unchanged for non-Cloudinary hosts.
 */
export function photoUrlForDailyReportEmbed(raw: string): string {
  const url = normalizeRemotePhotoUrl(raw);
  if (!isCloudinaryAssetUrl(url)) return url;

  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  const prefix = url.slice(0, idx + marker.length);
  let suffix = url.slice(idx + marker.length);

  if (suffix.startsWith(`${REPORT_EMBED_TRANSFORM}/`)) return url;

  // Drop existing transformation segments before version or public id.
  suffix = suffix.replace(/^([^/]+\/)*?(?=v\d+\/)/, '');
  if (!/^v\d+\//.test(suffix)) {
    suffix = suffix.replace(/^([^/]+\/)+/, '');
  }

  return `${prefix}${REPORT_EMBED_TRANSFORM}/${suffix}`;
}
