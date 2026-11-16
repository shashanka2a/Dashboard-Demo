import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// PATCH /api/attachments/[id]/tags  body: { tags: string[] }
// Replaces the tag list on an attachment row. New tags must exist in company_photo_tags;
// tags already on the row (e.g. set by crew in the field app) can always be kept or removed.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: { tags?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!Array.isArray(body.tags)) {
    return NextResponse.json({ error: 'tags must be an array of strings' }, { status: 400 });
  }

  const requested = [
    ...new Set(body.tags.map((t) => String(t ?? '').trim()).filter(Boolean)),
  ];

  const [{ data: row, error: rowErr }, { data: company, error: tagErr }] = await Promise.all([
    supabaseServer.from('attachments').select('id, tags').eq('id', id).maybeSingle(),
    supabaseServer.from('company_photo_tags').select('name'),
  ]);

  if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
  if (tagErr) return NextResponse.json({ error: tagErr.message }, { status: 500 });

  const canonical = new Map<string, string>();
  for (const c of company ?? []) {
    const name = String((c as { name?: string }).name ?? '').trim();
    if (name) canonical.set(name.toLowerCase(), name);
  }
  const existing = new Map<string, string>();
  for (const t of Array.isArray(row.tags) ? (row.tags as string[]) : []) {
    const name = String(t ?? '').trim();
    if (name) existing.set(name.toLowerCase(), name);
  }

  const next: string[] = [];
  const rejected: string[] = [];
  for (const t of requested) {
    const key = t.toLowerCase();
    const resolved = canonical.get(key) ?? existing.get(key);
    if (resolved) next.push(resolved);
    else rejected.push(t);
  }
  if (rejected.length) {
    return NextResponse.json(
      { error: `Unknown tag(s): ${rejected.join(', ')}. Choose from the company tag list.` },
      { status: 400 }
    );
  }

  const { error: updErr } = await supabaseServer.from('attachments').update({ tags: next }).eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ id, tags: next });
}
