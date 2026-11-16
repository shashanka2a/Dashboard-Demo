import { ActivityScreen } from "@/components/ActivityScreen";

/**
 * Client-driven feed load so navigation from Directory/Projects shows the Activity shell
 * immediately (no blank wait on server RSC). Initial rows hydrate from client cache or /api/activities/feed.
 */
export default function ActivityPage() {
  return <ActivityScreen excludeTestProjects />;
}
