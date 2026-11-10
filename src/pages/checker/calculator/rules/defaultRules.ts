import type { PayrollParams, PayrollRules, PtSlab, LwfRule } from '../types';

export const DEFAULT_PARAMS: PayrollParams = {
  basicPct: 0.5,
  hraPctOfBasic: 0.4,
  pfEmployeeRate: 0.12,
  pfEmployerRate: 0.12,
  pfWageCeiling: 15000,
  esicEmployeeRate: 0.0075,
  esicEmployerRate: 0.0325,
  esicGrossCeiling: 21000,
  gratuityRate: 0.0481,
};

const s = (gender: PtSlab['gender'], minGross: number, maxGross: number | null, monthlyAmount: number, febAmount: number | null = null): PtSlab =>
  ({ gender, minGross, maxGross, monthlyAmount, febAmount });

/** Starter data only — used when the database is unreachable. Verify against current state notifications. */
export const BUILTIN_PT: Record<string, PtSlab[]> = {
  Maharashtra: [s('M', 0, 7500, 0), s('M', 7500.01, 10000, 175), s('M', 10000.01, null, 200, 300),
                s('F', 0, 25000, 0), s('F', 25000.01, null, 200, 300)],
  Karnataka: [s('any', 0, 24999.99, 0), s('any', 25000, null, 200, 300)],
  'West Bengal': [s('any', 0, 10000, 0), s('any', 10000.01, 15000, 110), s('any', 15000.01, 25000, 130),
                  s('any', 25000.01, 40000, 150), s('any', 40000.01, null, 200)],
  Gujarat: [s('any', 0, 12000, 0), s('any', 12000.01, null, 200)],
  Telangana: [s('any', 0, 15000, 0), s('any', 15000.01, 20000, 150), s('any', 20000.01, null, 200)],
  'Andhra Pradesh': [s('any', 0, 15000, 0), s('any', 15000.01, 20000, 150), s('any', 20000.01, null, 200)],
};

export const BUILTIN_LWF: Record<string, LwfRule> = {
  Maharashtra:  { employeeAmount: 25, employerAmount: 75, frequency: 'half-yearly', months: [6, 12], minGross: 3000 },
  Karnataka:    { employeeAmount: 50, employerAmount: 100, frequency: 'yearly', months: [12], minGross: null },
  Gujarat:      { employeeAmount: 6, employerAmount: 12, frequency: 'half-yearly', months: [6, 12], minGross: null },
  Telangana:    { employeeAmount: 2, employerAmount: 5, frequency: 'yearly', months: [12], minGross: null },
  'West Bengal':{ employeeAmount: 3, employerAmount: 15, frequency: 'half-yearly', months: [6, 12], minGross: null },
  'Andhra Pradesh': { employeeAmount: 30, employerAmount: 70, frequency: 'yearly', months: [12], minGross: null },
};

export const RULE_STATES = Object.keys(BUILTIN_PT);

export function builtinRules(state: string, industry: string): PayrollRules {
  return {
    state, industry,
    params: { ...DEFAULT_PARAMS },
    ptSlabs: BUILTIN_PT[state] ?? [],
    lwf: BUILTIN_LWF[state] ?? null,
    source: 'builtin',
    verified: false,
    notes: [
      'Built-in starter rates are in use (database not reached). Verify PT / LWF against the current state notification.',
      ...(BUILTIN_PT[state] ? [] : [`No professional-tax slabs loaded for ${state || 'this state'} — PT shows 0.`]),
    ],
  };
}
