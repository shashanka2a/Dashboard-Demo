import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { deliverClientLoginInvite } from '@/lib/client-invite';
import {
  clientGeneralInfoFromBody,
  clientGeneralInfoToDb,
  mapClientGeneralInfoRow,
} from '@/lib/client-fields';

export const dynamic = 'force-dynamic';

const CLIENT_SELECT =
  'id, name, company_name, email, phone, title, notes, status, updated_at, street_address, city, state, zip_code';

export type ClientRow = {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  status: string;
  project_ids: string[];
  project_names: string[];
  updated_at?: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

async function attachProjects(rows: Array<Record<string, unknown>>): Promise<ClientRow[]> {
  if (!rows.length) return [];

  const clientIds = rows.map((r) => String(r.id));
  const { data: access } = await supabaseServer
    .from('client_project_access')
    .select('client_id, project_id')
    .in('client_id', clientIds);

  const projectIds = [...new Set((access ?? []).map((a) => String(a.project_id)))];
  let nameById: Record<string, string> = {};
  if (projectIds.length) {
    const { data: projects } = await supabaseServer.from('projects').select('id, name').in('id', projectIds);
    nameById = Object.fromEntries((projects ?? []).map((p) => [String(p.id), String(p.name)]));
  }

  const byClient = new Map<string, string[]>();
  for (const a of access ?? []) {
    const cid = String(a.client_id);
    const list = byClient.get(cid) ?? [];
    list.push(String(a.project_id));
    byClient.set(cid, list);
  }

  return rows.map((r) => {
    const pid = byClient.get(String(r.id)) ?? [];
    const general = mapClientGeneralInfoRow(r);
    return {
      id: String(r.id),
      name: String(r.name),
      company_name: r.company_name != null ? String(r.company_name) : null,
      email: r.email != null ? String(r.email) : null,
      phone: r.phone != null ? String(r.phone) : null,
      title: r.title != null ? String(r.title) : null,
      notes: r.notes != null ? String(r.notes) : null,
      status: String(r.status || 'active'),
      project_ids: pid,
      project_names: pid.map((id) => nameById[id] || id),
      updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
      ...general,
    };
  });
}

// GET /api/clients
export async function GET() {
  const { data, error } = await supabaseServer
    .from('clients')
    .select(CLIENT_SELECT)
    .order('name', { ascending: true });

  if (error) {
    if (/clients/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(await attachProjects((data ?? []) as Record<string, unknown>[]));
}

// POST /api/clients
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name as string | undefined)?.trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const projectIds = Array.isArray(body.project_ids)
      ? body.project_ids.map((x: unknown) => String(x)).filter(Boolean)
      : [];

    const general = clientGeneralInfoToDb(clientGeneralInfoFromBody(body));

    const { data, error } = await supabaseServer
      .from('clients')
      .insert({
        name,
        company_name: (body.company_name as string | undefined)?.trim() || null,
        email: (body.email as string | undefined)?.trim() || null,
        phone: (body.phone as string | undefined)?.trim() || null,
        title: (body.title as string | undefined)?.trim() || null,
        notes: (body.notes as string | undefined)?.trim() || null,
        status: body.status === 'inactive' ? 'inactive' : 'active',
        updated_at: new Date().toISOString(),
        ...general,
      })
      .select(CLIENT_SELECT)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (projectIds.length) {
      const { error: accErr } = await supabaseServer.from('client_project_access').insert(
        projectIds.map((project_id: string) => ({ client_id: data.id, project_id }))
      );
      if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
    }

    const [row] = await attachProjects([data as Record<string, unknown>]);

    let invite:
      | { sent: true; flow: 'invite' | 'recovery' }
      | { sent: false; error: string }
      | undefined;

    if (body.send_portal_invite === true && row.status === 'active') {
      const inviteResult = await deliverClientLoginInvite({
        id: row.id,
        name: row.name,
        email: row.email,
      });
      if (inviteResult.ok) {
        invite = { sent: true, flow: inviteResult.flow };
      } else {
        invite = { sent: false, error: inviteResult.error };
      }
    }

    return NextResponse.json(invite ? { ...row, invite } : row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid JSON' }, { status: 400 });
  }
}
