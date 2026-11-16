import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isDemoSuperuserSession } from './demo-auth';
import { MockQueryBuilder } from './mock-supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const isDemo =
  supabaseUrl.includes('placeholder.supabase.co') ||
  supabaseKey === 'placeholder-key' ||
  process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const realSupabase = createClient(supabaseUrl, supabaseKey);

const DEMO_USER = {
  id: 'demo-admin-001',
  email: 'admin@utilityvision.demo',
  user_metadata: {
    app_role: 'account_admin',
    full_name: 'Brad Wickstrom',
  },
};

const DEMO_SESSION = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: DEMO_USER,
};

// Client proxy that intercepts auth & queries in demo mode
export const supabase = isDemo
  ? ({
      from: (table: string) => new MockQueryBuilder(table),
      auth: {
        getSession: async () => {
          if (typeof window !== 'undefined' && !isDemoSuperuserSession()) {
            // In demo mode, automatically enable demo session for seamless walkthrough
            const key = 'uv_demo_superuser_v1';
            sessionStorage.setItem(key, '1');
          }
          return { data: { session: DEMO_SESSION }, error: null };
        },
        signInWithPassword: async ({ email, password }: { email: string; password?: string }) => {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('uv_demo_superuser_v1', '1');
          }
          return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null };
        },
        signOut: async () => {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('uv_demo_superuser_v1');
          }
          return { error: null };
        },
        onAuthStateChange: (callback: (event: string, session: typeof DEMO_SESSION | null) => void) => {
          if (typeof window !== 'undefined') {
            setTimeout(() => callback('SIGNED_IN', DEMO_SESSION), 10);
          }
          return {
            data: {
              subscription: {
                unsubscribe: () => {},
              },
            },
          };
        },
        getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
      },
    } as unknown as SupabaseClient)
  : realSupabase;
