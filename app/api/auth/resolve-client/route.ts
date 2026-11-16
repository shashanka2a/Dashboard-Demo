import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { resolveBearerUser } from '@/lib/auth-request';
import { isClientAppRole } from '@/lib/client-auth-shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/resolve-client
 * Returns whether the signed-in user should use the client portal setup flow.
 * Checks user_metadata first, then clients table by auth_user_id / email.
 */
export async function GET(request: Request) {
  const resolved = await resolveBearerUser(request);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error, isClient: false }, { status: resolved.status });
  }

  const user = resolved.user;
  if (isClientAppRole(user) || typeof user.user_metadata?.client_id === 'string') {
    return NextResponse.json({ isClient: true });
  }

  const email = user.email?.trim().toLowerCase() || '';
  const userId = user.id;

  const byAuth = await supabaseServer
    .from('clients')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (byAuth.data?.id) {
    return NextResponse.json({ isClient: true, client_id: byAuth.data.id });
  }

  if (email) {
    const byEmail = await supabaseServer
      .from('clients')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (byEmail.data?.id) {
      // Best-effort: attach auth_user_id for next time
      await supabaseServer
        .from('clients')
        .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', byEmail.data.id);

      // Best-effort: stamp app_role for future JWTs
      try {
        await supabaseServer.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...user.user_metadata,
            app_role: 'client',
            client_id: byEmail.data.id,
          },
        });
      } catch {
        /* ignore */
      }

      return NextResponse.json({ isClient: true, client_id: byEmail.data.id });
    }
  }

  return NextResponse.json({ isClient: false });
}
