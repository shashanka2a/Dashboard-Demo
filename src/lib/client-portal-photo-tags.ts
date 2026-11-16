/** Photo tags hidden from the client portal unless explicitly enabled per project. */
export const DEFAULT_CLIENT_PORTAL_EXCLUDED_PHOTO_TAGS = [
  'Equipment',
  'Chemicals',
  'Safety',
] as const;

function normTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function normalizePhotoTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t ?? '').trim())
    .filter(Boolean);
}

/** Union of company tags + internal defaults so settings always list Equipment/Chemicals/Safety. */
export function mergePhotoTagCatalog(companyTagNames: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...companyTagNames, ...DEFAULT_CLIENT_PORTAL_EXCLUDED_PHOTO_TAGS]) {
    const trimmed = String(name || '').trim();
    if (!trimmed) continue;
    const key = normTag(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Default allowlist when `projects.client_portal_allowed_photo_tags` is NULL. */
export function defaultClientPortalAllowedPhotoTags(catalog: string[]): string[] {
  const excluded = new Set(DEFAULT_CLIENT_PORTAL_EXCLUDED_PHOTO_TAGS.map(normTag));
  return catalog.filter((t) => !excluded.has(normTag(t)));
}

export function resolveClientPortalAllowedPhotoTags(
  stored: string[] | null | undefined,
  catalog: string[]
): string[] {
  const mergedCatalog = mergePhotoTagCatalog(catalog);
  if (stored == null) return defaultClientPortalAllowedPhotoTags(mergedCatalog);
  const catalogKeys = new Set(mergedCatalog.map(normTag));
  const allowed = new Set<string>();
  for (const t of normalizePhotoTagList(stored)) {
    if (catalogKeys.has(normTag(t))) allowed.add(normTag(t));
  }
  return mergedCatalog.filter((t) => allowed.has(normTag(t)));
}

/**
 * Client portal visibility for a photo.
 * Untagged photos are shown. Tagged photos require every tag to be on the allowlist.
 */
export function photoTagsAllowedInClientPortal(
  photoTags: string[],
  allowedTags: string[]
): boolean {
  const tags = normalizePhotoTagList(photoTags);
  if (tags.length === 0) return true;
  const allow = new Set(allowedTags.map(normTag));
  return tags.every((t) => allow.has(normTag(t)));
}
