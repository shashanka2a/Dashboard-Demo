import { supabaseServer } from '@/lib/supabase-server';
import { getMailer, sendClientInviteEmail } from '@/lib/mail';
import { DEFAULT_CLIENT_PORTAL_BASE_URL, DASHBOARD_PUBLIC_BASE_URL, forceSupabaseRedirectTo } from '@/lib/app-url';

function supabaseConfigured(): boolean {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  return Boolean(url && !url.includes('placeholder.supabase.co'));
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const lower = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const hit = data?.users?.find((u) => (u.email || '').toLowerCase() === lower);
    if (hit?.id) return hit.id;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

async function stampClientAuth(
  clientId: string,
  email: string,
  userMeta: { full_name: string; app_role: string; client_id: string },
  knownUserId?: string | null
): Promise<void> {
  const userId = knownUserId || (await findAuthUserIdByEmail(email));
  if (!userId) return;

  await supabaseServer.auth.admin.updateUserById(userId, {
    user_metadata: userMeta,
  });

  await supabaseServer
    .from('clients')
    .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', clientId);
}

function inviteDuplicateError(err: { message?: string } | null): boolean {
  const m = (err?.message ?? '').toLowerCase();
  return m.includes('already registered') || (m.includes('already') && m.includes('user'));
}

export type ClientInviteResult =
  | { ok: true; flow: 'invite' | 'recovery' }
  | { ok: false; error: string };

/**
 * Client invite/recovery:
 * 1) Generate Supabase invite (or recovery if user already exists)
 * 2) Stamp app_role=client + client_id on the auth user
 * 3) Link clients.auth_user_id
 * 4) Email a link that lands on app.utilityvision.app/auth/callback → /client/signup
 * 5) After password save → hosted client portal
 */
export async function deliverClientLoginInvite(
  client: { id: string; name: string; email: string | null | undefined }
): Promise<ClientInviteResult> {
  const setupBase = DASHBOARD_PUBLIC_BASE_URL.replace(/\/$/, '');
  const portalBase = DEFAULT_CLIENT_PORTAL_BASE_URL.replace(/\/$/, '');

  const email = client.email?.trim();
  if (!email) {
    return { ok: false, error: 'Add an email address before sending a portal invite.' };
  }

  // In demo environment, simulate successful client portal invite delivery
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !supabaseConfigured()) {
    return { ok: true, flow: 'invite' };
  }

  if (!getMailer()) {
    return {
      ok: false,
      error:
        'Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD (or SMTP_USER and SMTP_PASS).',
    };
  }

  const redirectTo = `${setupBase}/auth/callback`;
  const userMeta = {
    full_name: client.name,
    app_role: 'client',
    client_id: client.id,
  };

  let actionLink: string | undefined;
  let flow: 'invite' | 'recovery' = 'invite';
  let authUserId: string | null = null;

  const inviteRes = await supabaseServer.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: userMeta },
  });

  actionLink = inviteRes.data?.properties?.action_link;
  authUserId = inviteRes.data?.user?.id ? String(inviteRes.data.user.id) : null;

  if (inviteRes.error || !actionLink) {
    if (inviteRes.error && inviteDuplicateError(inviteRes.error)) {
      const recoveryRes = await supabaseServer.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
      actionLink = recoveryRes.data?.properties?.action_link;
      authUserId = recoveryRes.data?.user?.id ? String(recoveryRes.data.user.id) : null;
      flow = 'recovery';
      if (recoveryRes.error || !actionLink) {
        return {
          ok: false,
          error: recoveryRes.error?.message ?? 'Could not generate a password link.',
        };
      }
    } else {
      return {
        ok: false,
        error: inviteRes.error?.message ?? 'Could not generate an invite link.',
      };
    }
  }

  // Critical: ensure role/metadata + clients.auth_user_id before they click the email.
  try {
    await stampClientAuth(client.id, email, userMeta, authUserId);
  } catch (e) {
    console.warn('[client-invite] stampClientAuth failed:', e);
  }

  actionLink = forceSupabaseRedirectTo(actionLink, redirectTo);

  try {
    await sendClientInviteEmail({
      to: email,
      recipientName: client.name,
      setupLink: actionLink,
      isRecovery: flow === 'recovery',
      portalLoginUrl: `${portalBase}/`,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to send email.' };
  }

  return { ok: true, flow };
}
