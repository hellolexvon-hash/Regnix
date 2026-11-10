import type { PayrollRules, SalaryBreakdown, SalaryInput, Gender } from '../types';

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ceil = (n: number) => Math.ceil(n - 1e-9);

export function ptFor(rules: PayrollRules, gross: number, gender: Gender, month: number): number {
  const slabs = rules.ptSlabs;
  if (!slabs.length) return 0;
  // gender-specific slabs win if present for this gender, otherwise 'any'
  const g: Gender = slabs.some((s) => s.gender === gender) ? gender : 'any';
  let pool = slabs.filter((s) => s.gender === g);
  if (!pool.length) pool = slabs.filter((s) => s.gender === 'any');
  if (!pool.length) pool = slabs;
  const hit = pool.find((s) => gross >= s.minGross && (s.maxGross == null || gross <= s.maxGross));
  if (!hit) return 0;
  return month === 2 && hit.febAmount != null ? hit.febAmount : hit.monthlyAmount;
}

export function lwfFor(rules: PayrollRules, gross: number, month: number) {
  const l = rules.lwf;
  if (!l || !l.months.includes(month) || (l.minGross != null && gross <= l.minGross)) return { ee: 0, er: 0 };
  return { ee: l.employeeAmount, er: l.employerAmount };
}

export function pfWage(rules: PayrollRules, basic: number, onCeiling: boolean) {
  return onCeiling ? Math.min(basic, rules.params.pfWageCeiling) : basic;
}

interface Parts { basic: number; pfEr: number; esicEr: number; gratuity: number }

function parts(g: number, inp: SalaryInput, esicOn: boolean): Parts {
  const p = inp.rules.params;
  const basic = g * inp.basicPct;
  return {
    basic,
    pfEr: pfWage(inp.rules, basic, inp.pfOnCeiling) * p.pfEmployerRate,
    esicEr: esicOn ? ceil(g * p.esicEmployerRate) : 0,
    gratuity: inp.gratuityInCtc ? basic * p.gratuityRate : 0,
  };
}
const cost = (g: number, inp: SalaryInput, esicOn: boolean) => {
  const x = parts(g, inp, esicOn);
  return g + x.pfEr + x.esicEr + x.gratuity;
};

function bisect(f: (g: number) => number, target: number, lo: number, hi: number): number {
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function calcSalary(inp: SalaryInput): SalaryBreakdown {
  const { rules } = inp;
  const p = rules.params;
  const warnings: string[] = [];
  const ctcMonthly = inp.period === 'annual' ? inp.ctc / 12 : inp.ctc;
  if (!(ctcMonthly > 0)) throw new Error('CTC must be greater than zero');

  // Solve gross so that gross + employer contributions = CTC.
  // ESIC creates a cliff at the ceiling, so solve each regime separately.
  let gross: number;
  const ceilCost = cost(p.esicGrossCeiling, inp, true);
  if (ctcMonthly <= ceilCost) {
    gross = bisect((g) => cost(g, inp, true), ctcMonthly, 0, p.esicGrossCeiling);
  } else {
    gross = bisect((g) => cost(g, inp, false), ctcMonthly, p.esicGrossCeiling, ctcMonthly * 2);
    const lowCost = cost(p.esicGrossCeiling + 0.01, inp, false);
    if (ctcMonthly < ceilCost + 1 && ctcMonthly >= lowCost) {
      warnings.push('CTC falls in the ESIC cliff band — a gross just under the ceiling (ESIC-covered) and one just above both fit; the higher, ESIC-exempt gross is shown.');
    }
    if (gross <= p.esicGrossCeiling) gross = p.esicGrossCeiling + 0.01;
  }
  gross = r2(gross);

  const basic = r2(gross * inp.basicPct);
  const hra = r2(basic * inp.hraPctOfBasic);
  const special = r2(Math.max(0, gross - basic - hra));
  if (gross - basic - hra < 0) warnings.push('Basic + HRA exceed gross — reduce HRA % or raise basic.');
  if (inp.basicPct < 0.5) warnings.push('Basic is below 50% of gross. Under the Code on Wages / Social Security Code, "wages" must be at least 50% of total remuneration, so PF, gratuity and bonus may be assessed on a higher base.');

  const esicApplicable = gross <= p.esicGrossCeiling;
  const wage = pfWage(rules, basic, inp.pfOnCeiling);
  const pfEmployee = Math.round(wage * p.pfEmployeeRate);
  const pfEmployer = Math.round(wage * p.pfEmployerRate);
  const esicEmployee = esicApplicable ? ceil(gross * p.esicEmployeeRate) : 0;
  const esicEmployer = esicApplicable ? ceil(gross * p.esicEmployerRate) : 0;
  const pt = ptFor(rules, gross, inp.gender, inp.month);
  const lw = lwfFor(rules, gross, inp.month);
  const gratuity = inp.gratuityInCtc ? r2(basic * p.gratuityRate) : 0;

  const totalDeductions = r2(pfEmployee + esicEmployee + pt + lw.ee);
  return {
    gross, basic, hra, special,
    pfEmployee, pfEmployer, esicEmployee, esicEmployer, esicApplicable,
    pt, lwfEmployee: lw.ee, lwfEmployer: lw.er, gratuity,
    totalDeductions,
    netPay: r2(gross - totalDeductions),
    employerCost: r2(gross + pfEmployer + esicEmployer + gratuity + lw.er),
    ctcMonthly: r2(ctcMonthly),
    warnings,
  };
}
