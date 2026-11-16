type CacheEntry = { payload: unknown; fetchedAt: number };

const store = new Map<string, CacheEntry>();

export function readDashboardCache<T>(key: string): T | null {
  const e = store.get(key);
  return e ? (e.payload as T) : null;
}

export function readDashboardCacheFetchedAt(key: string): number | null {
  const e = store.get(key);
  return e ? e.fetchedAt : null;
}

export function isDashboardCacheFresh(key: string, maxAgeMs: number): boolean {
  const at = readDashboardCacheFetchedAt(key);
  if (at == null) return false;
  return Date.now() - at < maxAgeMs;
}

export function writeDashboardCache(key: string, payload: unknown): void {
  store.set(key, { payload, fetchedAt: Date.now() });
}

export function hasDashboardCache(key: string): boolean {
  return store.has(key);
}

export function invalidateDashboardCacheKey(key: string): void {
  store.delete(key);
}

export function invalidateDashboardCachePrefix(prefix: string): void {
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

/** Full JSON array from `GET /api/projects` (shared across screens). */
export const PROJECTS_RAW_CACHE_KEY = 'api:projects:raw';
