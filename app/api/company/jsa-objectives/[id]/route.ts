import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

const TABLE = 'company_jsa_objectives';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === 'string') {
      const n = body.name.trim();
      if (!n) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
      updates.name = n;
    }
    if (body.sort_order !== undefined) {
      updates.sort_order = Math.round(Number(body.sort_order));
    }
    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    const { data, error } = await supabaseServer
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .select('id, name, sort_order, updated_at')
      .single();
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return NextResponse.json({ error: 'An objective with that name already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid JSON' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { error } = await supabaseServer.from(TABLE).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
