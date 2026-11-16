import type { SupabaseClient } from '@supabase/supabase-js';
import type { Activity } from '@/components/ActivityScreen';
import { enrichActivitiesWithEmployeeNames } from '@/lib/activity-employee-names';
import { enrichActivitiesWithReportTimestamps } from '@/lib/activity-report-timestamps';
import { mapActivitiesViewRows } from '@/lib/activities-view-mapper';
import { isDemoEnvironment } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-data';

const ACTIVITIES_RELATIONS = ['activities_view', 'activities'] as const;

const ACTIVITY_VIEW_COLUMNS =
  'id, employee_name, action, project_name, activity_type, timestamp_label, created_at, updated_at, metrics, photos';

/** Load recent rows from the unified activities view (tries known relation names). */
export async function fetchActivitiesFeedRows(
  supabase: SupabaseClient,
  limit = 100,
  options?: { fast?: boolean }
): Promise<Activity[]> {
  if (isDemoEnvironment) {
    return (demoStore.activities as unknown as Activity[]).slice(0, limit);
  }
  for (const relation of ACTIVITIES_RELATIONS) {
    const { data, error } = await supabase
      .from(relation)
      .select(ACTIVITY_VIEW_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data)) {
      const mapped = mapActivitiesViewRows(data as Record<string, unknown>[]);
      const withTimestamps = await enrichActivitiesWithReportTimestamps(supabase, mapped);
      return enrichActivitiesWithEmployeeNames(supabase, withTimestamps, { fast: options?.fast });
    }
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      console.warn(`[activities-feed] ${relation}:`, error.message);
    }
  }
  return [];
}
