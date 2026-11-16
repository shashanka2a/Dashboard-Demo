import type { User } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';
import { isClientAppRole } from '@/lib/client-auth-shared';

export { isClientAppRole };

export type ClientAuthProject = {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  location: string | null;
};

export type ResolvedClientSession = {
  user: User;
  client: {
    id: string;
    name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    title: string | null;
    status: string;
  };
  projects: ClientAuthProject[];
};

type ResolveResult =
  | { ok: true; session: ResolvedClientSession }
  | { ok: false; error: string; status: number };

function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

export async function resolveClientSession(request: Request): Promise<ResolveResult> {
  const token = bearerToken(request);
  if (!token) return { ok: false, error: 'Sign in required.', status: 401 };

  const { data: userData, error: userErr } = await supabaseServer.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return { ok: false, error: 'Invalid or expired session.', status: 401 };

  if (!isClientAppRole(user)) {
    return { ok: false, error: 'This account is not a client portal user.', status: 403 };
  }

  const metaClientId = user.user_metadata?.client_id;
  let clientRow: Record<string, unknown> | null = null;

  if (typeof metaClientId === 'string' && metaClientId) {
    const { data } = await supabaseServer
      .from('clients')
      .select('id, name, company_name, email, phone, title, status, auth_user_id')
      .eq('id', metaClientId)
      .maybeSingle();
    clientRow = data as Record<string, unknown> | null;
  }

  if (!clientRow && user.email) {
    const { data } = await supabaseServer
      .from('clients')
      .select('id, name, company_name, email, phone, title, status, auth_user_id')
      .ilike('email', user.email.trim())
      .maybeSingle();
    clientRow = data as Record<string, unknown> | null;
  }

  if (!clientRow || String(clientRow.status) !== 'active') {
    return { ok: false, error: 'Client account not found or inactive.', status: 403 };
  }

  const clientId = String(clientRow.id);

  if (!clientRow.auth_user_id) {
    await supabaseServer
      .from('clients')
      .update({ auth_user_id: user.id, updated_at: new Date().toISOString() })
      .eq('id', clientId);
  }

  const { data: access, error: accessErr } = await supabaseServer
    .from('client_project_access')
    .select('project_id')
    .eq('client_id', clientId);

  if (accessErr) return { ok: false, error: accessErr.message, status: 500 };

  const projectIds = (access ?? []).map((a) => String(a.project_id));
  if (!projectIds.length) {
    return {
      ok: true,
      session: {
        user,
        client: {
          id: clientId,
          name: String(clientRow.name),
          company_name: clientRow.company_name != null ? String(clientRow.company_name) : null,
          email: clientRow.email != null ? String(clientRow.email) : null,
          phone: clientRow.phone != null ? String(clientRow.phone) : null,
          title: clientRow.title != null ? String(clientRow.title) : null,
          status: String(clientRow.status),
        },
        projects: [],
      },
    };
  }

  const { data: projects, error: projErr } = await supabaseServer
    .from('projects')
    .select('id, name, client_name, status, city, state, client_portal_enabled')
    .in('id', projectIds)
    .eq('client_portal_enabled', true)
    .order('name', { ascending: true });

  if (projErr) return { ok: false, error: projErr.message, status: 500 };

  const mapped: ClientAuthProject[] = (projects ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    client_name: p.client_name != null ? String(p.client_name) : null,
    status: String(p.status || 'active'),
    location: [p.city, p.state].filter(Boolean).join(', ') || null,
  }));

  return {
    ok: true,
    session: {
      user,
      client: {
        id: clientId,
        name: String(clientRow.name),
        company_name: clientRow.company_name != null ? String(clientRow.company_name) : null,
        email: clientRow.email != null ? String(clientRow.email) : null,
        phone: clientRow.phone != null ? String(clientRow.phone) : null,
        title: clientRow.title != null ? String(clientRow.title) : null,
        status: String(clientRow.status),
      },
      projects: mapped,
    },
  };
}

export async function clientCanAccessProject(
  request: Request,
  projectId: string
): Promise<ResolveResult> {
  const resolved = await resolveClientSession(request);
  if (!resolved.ok) return resolved;
  const allowed = resolved.session.projects.some((p) => p.id === projectId);
  if (!allowed) {
    return { ok: false, error: 'You do not have access to this project.', status: 403 };
  }
  return resolved;
}
