import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { slugifyMetricKey } from '@/lib/metric-fields';

// PATCH /api/company/metric-fields/[id]
// body: { label?, unit?, sort_order?, is_active?, key? }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.label === 'string') {
      const n = body.label.trim();
      if (!n) return NextResponse.json({ error: 'label cannot be empty' }, { status: 400 });
      updates.label = n;
    }

    if (typeof body.unit === 'string') {
      const u = body.unit.trim();
      if (!u) return NextResponse.json({ error: 'unit cannot be empty' }, { status: 400 });
      updates.unit = u.slice(0, 32);
    }

    if (typeof body.key === 'string' && body.key.trim()) {
      updates.key = slugifyMetricKey(body.key);
    }

    if (body.sort_order !== undefined) {
      const s = Number(body.sort_order);
      if (!Number.isFinite(s)) return NextResponse.json({ error: 'sort_order must be a number' }, { status: 400 });
      updates.sort_order = Math.round(s);
    }

    if (typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('company_metric_fields')
      .update(updates)
      .eq('id', id)
      .select('id, key, label, unit, sort_order, is_active, updated_at')
      .single();

    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return NextResponse.json({ error: 'A metric with that key already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// DELETE /api/company/metric-fields/[id]
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { error } = await supabaseServer.from('company_metric_fields').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
