import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export type PhotoTagRow = {
  id: string;
  name: string;
  sort_order: number;
  updated_at?: string;
};

export const dynamic = 'force-dynamic';

// GET /api/company/photo-tags — ordered list for dashboard + mobile photo picker
export async function GET() {
  const { data, error } = await supabaseServer
    .from('company_photo_tags')
    .select('id, name, sort_order, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (/company_photo_tags/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as PhotoTagRow[]);
}

// POST /api/company/photo-tags  body: { name: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name as string | undefined)?.trim();
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { data: maxRow } = await supabaseServer
      .from('company_photo_tags')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = typeof maxRow?.sort_order === 'number' ? maxRow.sort_order + 1 : 0;

    const { data, error } = await supabaseServer
      .from('company_photo_tags')
      .insert({
        name,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      })
      .select('id, name, sort_order, updated_at')
      .single();

    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return NextResponse.json({ error: `Tag "${name}" already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data as PhotoTagRow, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
