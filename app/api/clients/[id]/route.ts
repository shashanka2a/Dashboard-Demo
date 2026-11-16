import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  clientGeneralInfoFromBody,
  clientGeneralInfoToDb,
  mapClientGeneralInfoRow,
} from '@/lib/client-fields';

export const dynamic = 'force-dynamic';

const CLIENT_SELECT =
  'id, name, company_name, email, phone, title, notes, status, updated_at, street_address, city, state, zip_code';

async function clientWithProjects(id: string) {
  const { data, error } = await supabaseServer
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const { data: access } = await supabaseServer
    .from('client_project_access')
    .select('project_id')
    .eq('client_id', id);

  const projectIds = (access ?? []).map((a) => String(a.project_id));
  let projectNames: string[] = [];
  if (projectIds.length) {
    const { data: projects } = await supabaseServer.from('projects').select('id, name').in('id', projectIds);
    const nameById = Object.fromEntries((projects ?? []).map((p) => [String(p.id), String(p.name)]));
    projectNames = projectIds.map((pid) => nameById[pid] || pid);
  }

  return {
    ...data,
    ...mapClientGeneralInfoRow(data as Record<string, unknown>),
    project_ids: projectIds,
    project_names: projectNames,
  };
}

// PUT /api/clients/[id]
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const name = (body.name as string | undefined)?.trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const general = clientGeneralInfoToDb(clientGeneralInfoFromBody(body));

    const { error } = await supabaseServer
      .from('clients')
      .update({
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
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (Array.isArray(body.project_ids)) {
      const projectIds = body.project_ids.map((x: unknown) => String(x)).filter(Boolean);
      await supabaseServer.from('client_project_access').delete().eq('client_id', id);
      if (projectIds.length) {
        const { error: accErr } = await supabaseServer.from('client_project_access').insert(
          projectIds.map((project_id: string) => ({ client_id: id, project_id }))
        );
        if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
      }
    }

    const row = await clientWithProjects(id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid JSON' }, { status: 400 });
  }
}

// DELETE /api/clients/[id]
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Load auth linkage before deleting the row.
  const { data: clientRow, error: loadErr } = await supabaseServer
    .from('clients')
    .select('id, email, auth_user_id')
    .eq('id', id)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!clientRow) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  // Remove Supabase Auth user for this client (if present).
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    const authUserId = clientRow.auth_user_id ? String(clientRow.auth_user_id).trim() : '';
    const email = clientRow.email ? String(clientRow.email).trim().toLowerCase() : '';

    try {
      if (authUserId) {
        await supabaseServer.auth.admin.deleteUser(authUserId);
      } else if (email) {
        // Fallback: locate auth user by email.
        const { data, error } = await supabaseServer.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (!error) {
          const hit = data?.users?.find((u) => (u.email || '').toLowerCase() === email);
          if (hit?.id) {
            await supabaseServer.auth.admin.deleteUser(hit.id);
          }
        }
      }
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Could not delete Supabase auth user.' },
        { status: 500 }
      );
    }
  }

  const { error } = await supabaseServer.from('clients').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
