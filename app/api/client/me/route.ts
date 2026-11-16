import { NextResponse } from 'next/server';
import { resolveClientSession } from '@/lib/client-session';

export const dynamic = 'force-dynamic';

// GET /api/client/me — signed-in client profile + portal-enabled assigned projects
export async function GET(request: Request) {
  const resolved = await resolveClientSession(request);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { client, projects } = resolved.session;
  return NextResponse.json({ client, projects });
}
