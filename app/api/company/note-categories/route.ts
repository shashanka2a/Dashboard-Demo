import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export type NoteCategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  updated_at?: string;
};

export const dynamic = 'force-dynamic';

// GET /api/company/note-categories — ordered list for dashboard + mobile note picker
export async function GET() {
  const { data, error } = await supabaseServer
    .from('company_note_categories')
    .select('id, name, sort_order, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (/company_note_categories/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as NoteCategoryRow[]);
}

// POST /api/company/note-categories  body: { name: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name as string | undefined)?.trim();
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { data: maxRow } = await supabaseServer
      .from('company_note_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = typeof maxRow?.sort_order === 'number' ? maxRow.sort_order + 1 : 0;

    const { data, error } = await supabaseServer
      .from('company_note_categories')
      .insert({
        name,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      })
      .select('id, name, sort_order, updated_at')
      .single();

    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return NextResponse.json({ error: `Category "${name}" already exists.` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data as NoteCategoryRow, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
