import type { User } from '@supabase/supabase-js';

export function isClientAppRole(user: User): boolean {
  return String(user.user_metadata?.app_role || '').toLowerCase() === 'client';
}
