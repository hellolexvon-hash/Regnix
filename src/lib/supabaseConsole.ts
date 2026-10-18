/**
 * src/lib/supabaseConsole.ts
 *
 * Separate Supabase client for the Super Admin console. It stores its session
 * under its own key, so signing in at /admin never replaces (or signs out) a
 * normal user's session in the same browser — the same "separate session
 * boundary" rule superAdminStore.ts already follows.
 *
 * Supabase may log a "Multiple GoTrueClient instances" warning in dev; it is
 * harmless because the two clients use different storage keys.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabaseConsole = createClient(supabaseUrl, supabaseAnon, {
  auth: { storageKey: 'regnix-superadmin-auth' },
});