import { supabase } from '@/lib/supabase';

/** Authenticated fetch for client portal API routes (Bearer session token). */
export async function clientApiFetch(input: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
    cache: 'no-store',
  });
}
