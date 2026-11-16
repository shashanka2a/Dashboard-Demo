import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { deleteProjectPhoto } from '@/lib/project-photo-delete';
import { resolveProjectRow } from '@/lib/resolve-project';

export const dynamic = 'force-dynamic';

// DELETE /api/photos — remove a photo from project records (gallery / activity viewer)
export async function DELETE(request: Request) {
  let body: {
    url?: string;
    sourceId?: string;
    sourceType?: string;
    projectId?: string;
    project?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const url = String(body.url || '').trim();
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  let projectId = body.projectId?.trim() || null;
  if (!projectId && body.project?.trim()) {
    const { row } = await resolveProjectRow(supabaseServer, { projectName: body.project.trim() });
    projectId = row?.id ?? null;
  }

  try {
    const result = await deleteProjectPhoto(supabaseServer, {
      url,
      sourceId: body.sourceId,
      sourceType: body.sourceType,
      projectId,
    });

    if (!result.deleted) {
      return NextResponse.json({ error: 'Photo not found in project records.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete photo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
