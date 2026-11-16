import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { slugifyMetricKey } from '@/lib/metric-fields';

export type MetricFieldRow = {
  id: string;
  key: string;
  label: string;
  unit: string;
  sort_order: number;
  is_active: boolean;
  updated_at?: string;
};

export const dynamic = 'force-dynamic';

// GET /api/company/metric-fields — ordered list for dashboard + mobile metrics form
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === '1' || searchParams.get('active') === 'true';

  let query = supabaseServer
    .from('company_metric_fields')
    .select('id, key, label, unit, sort_order, is_active, updated_at')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;

  if (error) {
    if (/company_metric_fields/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as MetricFieldRow[]);
}

// POST /api/company/metric-fields  body: { label, unit?, key?, sort_order?, is_active? }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const label = (body.label as string | undefined)?.trim();
    if (!label) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    const unit =
      typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim().slice(0, 32) : 'acres';

    let key =
      typeof body.key === 'string' && body.key.trim()
        ? slugifyMetricKey(body.key)
        : slugifyMetricKey(label);

    const { data: maxRow } = await supabaseServer
      .from('company_metric_fields')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder =
      typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)
        ? Math.round(body.sort_order)
        : typeof maxRow?.sort_order === 'number'
          ? maxRow.sort_order + 1
          : 0;

    const isActive = body.is_active === false ? false : true;

    // Avoid unique collisions on auto-generated keys
    const { data: existing } = await supabaseServer
      .from('company_metric_fields')
      .select('id')
      .eq('key', key)
      .maybeSingle();
    if (existing?.id) {
      key = `${key}_${Date.now().toString(36)}`;
    }

    const { data, error } = await supabaseServer
      .from('company_metric_fields')
      .insert({
        key,
        label,
        unit,
        sort_order: sortOrder,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .select('id, key, label, unit, sort_order, is_active, updated_at')
      .single();

    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return NextResponse.json({ error: `A metric with key "${key}" already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data as MetricFieldRow, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
