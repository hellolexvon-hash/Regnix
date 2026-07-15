/**
 * src/lib/supabaseClient.ts
 *
 * Supabase client singleton — import this everywhere you need DB / Auth.
 *
 * Set these in your .env file:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJh...
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing Supabase env vars.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ─── Typed DB helpers ────────────────────────────────────────────────────────

export interface Profile {
  id:           string;
  account_type: 'company' | 'client';
  full_name:    string;
  email:        string;
  company_name: string | null;
  industry:     string | null;
  gstin:        string | null;
  firm_name:    string | null;
  created_at:   string;
  updated_at:   string;
}

export interface DocumentRequest {
  id:                 string;
  user_id:            string;
  company_name:       string;
  contact_email:      string;
  act_type:           string;
  state:              string | null;
  head_count:         number;
  establishment_name: string | null;
  address:            string | null;
  status:             'pending' | 'processing' | 'completed' | 'failed';
  created_at:         string;
}
