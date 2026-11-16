import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createMockSupabaseServer } from './mock-supabase';

const supabaseUrl = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).trim() || 'https://placeholder.supabase.co';

function getServerSupabaseKey(): string {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) return service;

  return (
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    'placeholder-key'
  );
}

const supabaseKey = getServerSupabaseKey();

export const isDemoEnvironment =
  supabaseUrl.includes('placeholder.supabase.co') ||
  supabaseKey === 'placeholder-key' ||
  process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

// If running in demo mode or without configured credentials, use mock query engine
export const supabaseServer: SupabaseClient = isDemoEnvironment
  ? (createMockSupabaseServer() as unknown as SupabaseClient)
  : createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
