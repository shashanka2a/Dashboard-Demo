import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { fetchActivitiesFeedRows } from '@/lib/activities-feed-server';

export const dynamic = 'force-dynamic';

/** Fast activity list for the global dashboard — unified `activities` view, not the heavy merge API. */
export async function GET() {
  const list = await fetchActivitiesFeedRows(supabaseServer, 100, { fast: true });
  return NextResponse.json(list);
}
