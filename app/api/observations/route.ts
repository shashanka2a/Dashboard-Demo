import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// GET /api/observations?project=<name>&status=open|resolved|all
// Default: open only (watchlist of ongoing site conditions).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get('project');
  const statusParam = (searchParams.get('status') || 'open').toLowerCase();
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  let projectId: string | null = null;
  if (projectName && projectName !== 'All Projects') {
    const { data: proj } = await supabaseServer.from('projects').select('id').eq('name', projectName).single();
    projectId = proj?.id ?? null;
  }

  let query = supabaseServer
    .from('observations')
    .select('*')
    .order('logged_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);

  if (statusParam === 'open') {
    query = query.eq('status', 'Open');
  } else if (statusParam === 'resolved') {
    query = query.eq('status', 'Resolved');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = data ?? [];
  const projectIds = [...new Set(list.map((r) => String((r as { project_id?: string }).project_id || '')).filter(Boolean))];
  let projectNameById: Record<string, string> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabaseServer.from('projects').select('id, name').in('id', projectIds);
    projectNameById = Object.fromEntries(
      (projects || []).map((p) => [String((p as { id: string }).id), String((p as { name?: string }).name || '')])
    );
  }

  let enriched = list.map((row) => {
    const pid = String((row as { project_id?: string }).project_id || '');
    return {
      ...row,
      project_name: projectNameById[pid] || 'Unknown project',
    };
  });

  if (q) {
    enriched = enriched.filter((r) => {
      const hay = [
        r.title,
        r.type,
        r.description,
        r.location,
        r.progress,
        r.status,
        r.project_name,
        ...(Array.isArray(r.description_tags) ? r.description_tags : []),
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }

  return NextResponse.json(enriched);
}

// PATCH /api/observations  body: { id, status?: 'Open' | 'Resolved' }
export async function PATCH(request: Request) {
  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const status = String(body.status || '').trim();
  if (status !== 'Open' && status !== 'Resolved') {
    return NextResponse.json({ error: 'status must be Open or Resolved' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('observations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
