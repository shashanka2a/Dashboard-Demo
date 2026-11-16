import type { User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';

type ResolveResult =
  | { ok: true; user: User }
  | { ok: false; error: string; status: number };

export function bearerTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

export async function resolveBearerUser(request: Request): Promise<ResolveResult> {
  const token = bearerTokenFromRequest(request);
  if (!token) return { ok: false, error: 'Sign in required.', status: 401 };

  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, error: 'Invalid or expired session.', status: 401 };
  }

  return { ok: true, user: data.user };
}

function supabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    ''
  );
}

function supabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    ''
  );
}

/** Re-verify password before destructive actions. */
export async function verifyUserPassword(email: string, password: string): Promise<boolean> {
  const url = supabaseUrl();
  const anonKey = supabaseAnonKey();
  if (!url || !anonKey) return false;

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  return !error;
}
