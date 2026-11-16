import type { Activity } from '@/components/ActivityScreen';
import {
  ACTIVITY_FEED_CACHE_VERSION,
  setActivityFeedSnapshot,
} from '@/lib/activity-feed-client-cache';
import { writeDashboardCache, PROJECTS_RAW_CACHE_KEY } from '@/lib/dashboard-data-cache';

let inflight: Promise<void> | null = null;

type BootstrapPayload = {
  activities?: Activity[];
  projectNames?: string[];
  memberNames?: string[];
  projects?: unknown[];
};

/** Warm activity feed + project list before user opens /activity (hover / dashboard sub-nav). */
export function prefetchActivityBootstrap(): Promise<void> {
  if (inflight) return inflight;

  inflight = fetch('/api/activities/bootstrap', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: BootstrapPayload | null) => {
      if (!data || !Array.isArray(data.activities)) return;
      const projectNames = Array.isArray(data.projectNames) ? data.projectNames : [];
      const memberNames = Array.isArray(data.memberNames) ? data.memberNames : [];
      setActivityFeedSnapshot({
        activities: data.activities,
        projectNames,
        memberNames,
        source: 'feed',
        cacheVersion: ACTIVITY_FEED_CACHE_VERSION,
      });
      if (Array.isArray(data.projects) && data.projects.length) {
        writeDashboardCache(PROJECTS_RAW_CACHE_KEY, data.projects);
      }
    })
    .catch(() => {
      /* ignore prefetch errors */
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
