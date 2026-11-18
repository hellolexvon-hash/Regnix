import { supabase } from '@/lib/supabaseClient';
import type { PayrollRules, PtSlab, LwfRule, PayrollParams, Gender } from '../types';
import { DEFAULT_PARAMS, builtinRules } from './defaultRules';

const today = () => new Date().toISOString().slice(0, 10);

/** Most specific row wins: state+industry > industry > state > global; then latest effective_from. */
function pickParamRow(rows: any[], state: string, industry: string) {
  const score = (r: any) => (r.state === state ? 2 : r.state ? -99 : 0) + (r.industry === industry ? 1 : r.industry ? -99 : 0);
  return rows
    .filter((r) => score(r) >= 0)
    .sort((a, b) => score(b) - score(a) || String(b.effective_from).localeCompare(String(a.effective_from)))[0];
}

export async function loadRules(state: string, industry: string): Promise<PayrollRules> {
  const fallback = builtinRules(state, industry);
  if (!state) return fallback;
  try {
    const [p, pt, lw] = await Promise.all([
      supabase.from('payroll_param_rules').select('*').lte('effective_from', today()),
      supabase.from('professional_tax_slabs').select('*').eq('state', state).lte('effective_from', today()),
      supabase.from('lwf_rules').select('*').eq('state', state).lte('effective_from', today()),
    ]);
    if (p.error || pt.error || lw.error) throw p.error ?? pt.error ?? lw.error;

    const row = pickParamRow(p.data ?? [], state, industry);
    const params: PayrollParams = row ? {
      basicPct: Number(row.basic_pct), hraPctOfBasic: Number(row.hra_pct_of_basic),
      pfEmployeeRate: Number(row.pf_ee_rate), pfEmployerRate: Number(row.pf_er_rate), pfWageCeiling: Math.max(Number(row.pf_wage_ceiling) || 0, DEFAULT_PARAMS.pfWageCeiling), // old ₹15,000 DB value would cap PF at 1,800; ceiling is ₹25,000 from 17.09.2026
      esicEmployeeRate: Number(row.esic_ee_rate), esicEmployerRate: Number(row.esic_er_rate), esicGrossCeiling: Number(row.esic_gross_ceiling),
      gratuityRate: Number(row.gratuity_rate),
    } : { ...DEFAULT_PARAMS };

    // keep only the newest effective_from set of slabs
    const latest = (pt.data ?? []).reduce((m: string, r: any) => (r.effective_from > m ? r.effective_from : m), '');
    const ptSlabs: PtSlab[] = (pt.data ?? []).filter((r: any) => r.effective_from === latest).map((r: any) => ({
      gender: (r.gender ?? 'any') as Gender, minGross: Number(r.min_gross),
      maxGross: r.max_gross == null ? null : Number(r.max_gross),
      monthlyAmount: Number(r.monthly_amount), febAmount: r.feb_amount == null ? null : Number(r.feb_amount),
    }));

    const lrow = (lw.data ?? [])
      .filter((r: any) => !r.industry || r.industry === industry)
      .sort((a: any, b: any) => (b.industry ? 1 : 0) - (a.industry ? 1 : 0) || String(b.effective_from).localeCompare(String(a.effective_from)))[0];
    const lwf: LwfRule | null = lrow ? {
      employeeAmount: Number(lrow.employee_amount), employerAmount: Number(lrow.employer_amount),
      frequency: lrow.frequency, months: lrow.months ?? [], minGross: lrow.min_gross == null ? null : Number(lrow.min_gross),
    } : null;

    const all = [row, ...(pt.data ?? []), lrow].filter(Boolean);
    const verified = all.length > 0 && all.every((r: any) => r.verified === true);
    const notes: string[] = [];
    if (!row) notes.push('No parameter row found — default PF/ESIC/structure parameters used.');
    if (!ptSlabs.length) notes.push(`No professional-tax slabs in the database for ${state}.`);
    if (!verified) notes.push('Some rules are flagged as not yet verified in the database.');
    return { state, industry, params, ptSlabs, lwf, source: 'database', verified, notes };
  } catch {
    return fallback;
  }
}