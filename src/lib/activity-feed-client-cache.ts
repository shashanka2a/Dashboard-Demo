import type { Activity } from '@/components/ActivityScreen';

export type ActivityFeedSnapshot = {
  activities: Activity[];
  projectNames: string[];
  memberNames: string[];
  /** `feed` = fast activities view; `full` = merged `/api/activities` payload. */
  source?: 'feed' | 'full';
  cacheVersion?: number;
  /** Set when a full client fetch completed (even if `activities` is empty). */
  fetchedAt: number;
};

/** Skip background refetch on main dashboard when revisiting Activity within this window. */
export const ACTIVITY_FEED_STALE_MS = 2 * 60 * 1000;

/** Bump when feed/name resolution logic changes so clients refetch once. */
export const ACTIVITY_FEED_CACHE_VERSION = 7;

let snapshot: ActivityFeedSnapshot | null = null;

export function getActivityFeedSnapshot(): ActivityFeedSnapshot | null {
  return snapshot;
}

export function setActivityFeedSnapshot(
  data: Omit<ActivityFeedSnapshot, 'fetchedAt'>
): void {
  snapshot = { ...data, fetchedAt: Date.now() };
}

export function clearActivityFeedSnapshot(): void {
  snapshot = null;
}

/** Update activities after any `/api/activities` fetch; keep project/member names when already loaded. */
export function upsertActivitiesInFeedCache(activities: Activity[]): void {
  if (!snapshot) {
    snapshot = {
      activities,
      projectNames: [],
      memberNames: [],
      fetchedAt: Date.now(),
    };
    return;
  }
  snapshot = {
    ...snapshot,
    activities,
    fetchedAt: Date.now(),
  };
}
