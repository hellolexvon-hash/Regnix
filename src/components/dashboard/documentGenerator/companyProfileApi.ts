/**
 * companyProfileApi.ts
 *
 * Saves / loads the client's company details (DocumentGenerator Step 1) in the
 * `company_profiles` table (one row per user, protected by RLS) so the data is
 * pre-filled the next time the company opens the page.
 */

import { supabase } from '@/lib/supabaseClient';

export interface SavedCompany {
  name: string; cin: string; pan: string; gstin: string; address: string;
  state: string; industry: string; headcount: string; incorporationDate: string;
  authorizedPerson: string; designation: string; email: string; phone: string;
}

const db = supabase as any; // table is not in the generated types

const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export async function loadCompanyProfile(): Promise<Partial<SavedCompany> | null> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await db
      .from('company_profiles').select('*').eq('user_id', u.user.id).maybeSingle();
    if (error || !data) return null;
    return {
      name: s(data.name), cin: s(data.cin), pan: s(data.pan), gstin: s(data.gstin),
      address: s(data.address), state: s(data.state), industry: s(data.industry),
      headcount: s(data.headcount), incorporationDate: s(data.incorporation_date),
      authorizedPerson: s(data.authorized_person), designation: s(data.designation),
      email: s(data.email), phone: s(data.phone),
    };
  } catch { return null; }
}

export async function saveCompanyProfile(c: SavedCompany): Promise<boolean> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return false;
    const { error } = await db.from('company_profiles').upsert({
      user_id: u.user.id,
      name: c.name.trim(), cin: c.cin.trim(), pan: c.pan.trim().toUpperCase(), gstin: c.gstin.trim().toUpperCase(),
      address: c.address.trim(), state: c.state, industry: c.industry, headcount: c.headcount.trim(),
      incorporation_date: c.incorporationDate || null,
      authorized_person: c.authorizedPerson.trim(), designation: c.designation.trim(),
      email: c.email.trim(), phone: c.phone.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    return !error;
  } catch { return false; }
}
