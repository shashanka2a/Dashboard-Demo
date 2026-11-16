import type { User } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';
import { isClientAppRole } from '@/lib/client-auth-shared';

export type AccountDeletionResult =
  | { ok: true; accountType: 'client' | 'employee' }
  | { ok: false; error: string };

async function anonymizeClientAccount(user: User): Promise<void> {
  const userId = user.id;
  const email = user.email?.trim().toLowerCase();

  let clientId =
    typeof user.user_metadata?.client_id === 'string' ? user.user_metadata.client_id.trim() : '';

  if (!clientId) {
    const { data } = await supabaseServer
      .from('clients')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle();
    clientId = data?.id ? String(data.id) : '';
  }

  if (!clientId && email) {
    const { data } = await supabaseServer
      .from('clients')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    clientId = data?.id ? String(data.id) : '';
  }

  if (!clientId) return;

  await supabaseServer.from('client_project_access').delete().eq('client_id', clientId);

  const { error } = await supabaseServer
    .from('clients')
    .update({
      auth_user_id: null,
      status: 'inactive',
      email: null,
      phone: null,
      name: 'Deleted account',
      company_name: null,
      notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId);

  if (error) throw new Error(error.message);
}

async function anonymizeEmployeeAccount(user: User): Promise<void> {
  const email = user.email?.trim();
  if (!email) return;

  const { error } = await supabaseServer
    .from('employees')
    .update({
      status: 'inactive',
      email: null,
      phone: null,
      employee_id: null,
      name: 'Deleted account',
    })
    .ilike('email', email);

  if (error) throw new Error(error.message);
}

/**
 * Removes login access and anonymizes linked directory records.
 * Project field data logged by the user is retained for business records.
 */
export async function deleteAuthenticatedAccount(user: User): Promise<AccountDeletionResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { ok: false, error: 'Account deletion is not configured on this server.' };
  }

  const accountType = isClientAppRole(user) ? 'client' : 'employee';

  if (accountType === 'client') {
    await anonymizeClientAccount(user);
  } else {
    await anonymizeEmployeeAccount(user);
  }

  const { error: authErr } = await supabaseServer.auth.admin.deleteUser(user.id);
  if (authErr) {
    return { ok: false, error: authErr.message };
  }

  return { ok: true, accountType };
}
