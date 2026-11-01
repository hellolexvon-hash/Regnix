/**
 * populate/config.ts
 *
 * Every statutory rate, ceiling and policy switch lives here — nothing is hard-coded in
 * rules.ts. Each value cites where it comes from so it can be re-checked when law changes.
 */

import type { FieldKey } from './fields.js';
import { STATUTORY_TABLES } from './statutoryTables.js';

export interface PopulateConfig {
  // ── wage arithmetic ──────────────────────────────────────────────────────
  /** Monthly → daily divisor. 26 matches the COLUMN_MAP overtime/gratuity formulas. */
  workingDaysDivisor: number;
  hoursPerDay: number;
  /** Overtime paid at twice the ordinary rate (Factories Act s.59 / Code on Wages s.13). */
  otMultiplier: number;
  /** Earnings that make up Gross Salary (Monthly). OT is deliberately excluded. */
  grossComponents: FieldKey[];

  // ── EPF (EPF & MP Act 1952; ECR rules) ────────────────────────────────────
  pfWageCeiling: number;
  pfEmployeeRate: number;
  epsRate: number;
  epsMaxContribution: number;
  /** Members aged 58+ do not contribute to EPS; the full 12% goes to EPF. */
  epsAgeCutoff: number;
  pfAdminRate: number;
  edliRate: number;
  /** HEADER SAYS "same as Basic". Set true to use Basic+DA+VDA (the statutory definition). */
  epfWagesIncludeDA: boolean;

  // ── ESIC (ESI Act 1948) ───────────────────────────────────────────────────
  esicWageCeiling: number;
  esicEmployerRate: number;
  esicEmployeeRate: number;
  /** Employees earning ≤ this per day pay no employee share. */
  esicDailyWageExemption: number;
  /** COLUMN_MAP formula uses gross only. Set true to add overtime to the contribution base. */
  esicIncludesOT: boolean;

  // ── Bonus (Payment of Bonus Act 1965) ────────────────────────────────────
  bonusEligibilityCeiling: number;
  /** Calculation ceiling = higher of this and the minimum wage (s.12). */
  bonusCalcFloor: number;
  bonusRate: number;

  // ── Gratuity (Payment of Gratuity Act 1972) ──────────────────────────────
  /** Statute = 5 years. Master header says "4.6 years" — see report note. */
  gratuityYears: number;
  gratuityDays: number;
  gratuityDivisor: number;
  gratuityCap: number;

  // ── CTC ──────────────────────────────────────────────────────────────────
  /** COLUMN_MAP formula omits employer PF/ESIC. true = add them (conventional CTC). */
  ctcIncludesEmployerStatutory: boolean;

  // ── policy switches ──────────────────────────────────────────────────────
  allowUnverifiedTables: boolean;
  /** Replace non-blank master cells with computed values (default: only fill blanks). */
  overwrite: boolean;
  /** Reconciliation tolerance (₹) when comparing an entered value with the computed one. */
  tolerance: number;
  /** Source rows with no match in the master become new master rows. */
  appendUnmatched: boolean;
  /** Minimum confidence for auto-applying a fuzzy header match from a source file. */
  fuzzyThreshold: number;
  /** Reference date for age / service / eligibility. Default: end of the payroll month. */
  asOf?: Date;
}

export const DEFAULT_CONFIG: PopulateConfig = {
  workingDaysDivisor: 26,
  hoursPerDay: 8,
  otMultiplier: 2,
  grossComponents: [
    'basic', 'da', 'vda', 'hra', 'medical', 'conveyance', 'specialAllow',
    'additionalComp', 'othersAllow', 'nightAllowance',
  ],

  pfWageCeiling: 15000,
  pfEmployeeRate: 0.12,
  epsRate: 0.0833,
  epsMaxContribution: 1250,
  epsAgeCutoff: 58,
  pfAdminRate: 0.005,
  edliRate: 0.005,
  epfWagesIncludeDA: false,

  esicWageCeiling: 21000,
  esicEmployerRate: 0.0325,
  esicEmployeeRate: 0.0075,
  esicDailyWageExemption: 176,
  esicIncludesOT: false,

  bonusEligibilityCeiling: 21000,
  bonusCalcFloor: 7000,
  bonusRate: 0.0833,

  gratuityYears: 5,
  gratuityDays: 15,
  gratuityDivisor: 26,
  gratuityCap: 2_000_000,

  ctcIncludesEmployerStatutory: true,

  allowUnverifiedTables: false,
  overwrite: false,
  tolerance: 1,
  appendUnmatched: true,
  fuzzyThreshold: 0.85,
};

// ─── State PT / LWF tables ───────────────────────────────────────────────────

export interface PtSlab { gender: 'Male' | 'Female' | 'Other' | 'any'; min: number; max: number | null; amount: number; feb?: number }
export interface PtEntry { verified: boolean; frequency: string; slabs: PtSlab[]; notes?: string }
export interface LwfEntry { verified: boolean; frequency: string; months: number[]; employee: number; employer: number; notes?: string }
export interface StatutoryTables {
  pt: Record<string, PtEntry>;
  noPt: string[];
  lwf: Record<string, LwfEntry>;
  noLwf: string[];
  aliases: Record<string, string>;
}

export function loadTables(override?: Partial<StatutoryTables>): StatutoryTables {
  const raw = STATUTORY_TABLES as unknown as StatutoryTables;
  const strip = <T>(o: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));
  return {
    pt: strip({ ...raw.pt, ...(override?.pt ?? {}) }),
    noPt: override?.noPt ?? raw.noPt ?? [],
    lwf: strip({ ...raw.lwf, ...(override?.lwf ?? {}) }),
    noLwf: override?.noLwf ?? raw.noLwf ?? [],
    aliases: { ...raw.aliases, ...(override?.aliases ?? {}) },
  };
}

export function canonicalState(input: string, tables: StatutoryTables): string {
  const s = input.trim();
  const alias = tables.aliases[s.toLowerCase()];
  if (alias) return alias;
  const all = [...Object.keys(tables.pt), ...Object.keys(tables.lwf), ...tables.noPt, ...tables.noLwf];
  return all.find((x) => x.toLowerCase() === s.toLowerCase()) ?? s;
}
