/**
 * populate/rules.ts
 *
 * Derivation rules: compute blank master columns from the columns that ARE filled.
 *
 * Each rule declares what it `consumes` and `produces`; `orderRules()` sorts them so a
 * value is always computed before anything that depends on it (and rejects cycles).
 *
 * A rule can end three ways:
 *   - return outputs          → engine fills blanks (or reconciles non-blank cells)
 *   - throw Missing([...])    → an input is blank       → reported as a data gap
 *   - throw Blocked(reason)   → inputs exist but cannot be used (bad code, no table)
 *   - return { na: reason }   → rule does not apply to this employee (e.g. apprentice)
 */

import { F, FIELD_KEYS, dayCol, type FieldKey } from './fields.js';
import {
  type Val, type MonthInfo, isBlank, parseNum, parseDate, parseMonth, normGender, isYes,
  round2, roundRupee, ceilRupee, ageOn, addYears, monthsBetween, classifyAttendance,
} from './normalize.js';
import { type PopulateConfig, type StatutoryTables, canonicalState } from './config.js';

// ─── Outcomes ────────────────────────────────────────────────────────────────

export class Missing extends Error {
  constructor(public items: string[]) { super(`missing: ${items.join(', ')}`); }
}
export class Blocked extends Error {
  constructor(public reason: string) { super(reason); }
}
export type Outputs = Partial<Record<FieldKey, Val>>;
export type RuleOutput = Outputs | { na: string };

export interface Rule {
  id: string;
  title: string;
  consumes: FieldKey[];
  produces: FieldKey[];
  run(ctx: Ctx): RuleOutput;
}

// ─── Per-row context ─────────────────────────────────────────────────────────

export const colLetter = (n: number): string => {
  let s = ''; let x = n;
  while (x > 0) { s = String.fromCharCode(65 + ((x - 1) % 26)) + s; x = Math.floor((x - 1) / 26); }
  return s;
};

export interface Ctx {
  cfg: PopulateConfig;
  tables: StatutoryTables;
  month: MonthInfo | null;
  asOf: Date;
  raw(k: FieldKey): Val;
  rawCol(col: number): Val;
  num(k: FieldKey): number | null;
  /** Throws Missing when blank / non-numeric. */
  need(k: FieldKey): number;
  numOr0(k: FieldKey): number;
  str(k: FieldKey): string;
  date(k: FieldKey): Date | null;
  firstDate(...ks: FieldKey[]): Date | null;
  isApprentice(): boolean;
  label(k: FieldKey): string;
}

export function makeCtx(
  row: ReadonlyMap<number, Val>, cfg: PopulateConfig, tables: StatutoryTables,
): Ctx {
  const rawCol = (c: number): Val => row.get(c) ?? null;
  const raw = (k: FieldKey): Val => rawCol(F[k].col);
  const label = (k: FieldKey): string => `${colLetter(F[k].col)} ${F[k].h}`;
  const num = (k: FieldKey): number | null => parseNum(raw(k));
  const month = parseMonth(raw('monthOf'));
  const asOfBase = cfg.asOf ?? month?.end ?? new Date();
  return {
    cfg, tables, month,
    asOf: asOfBase,
    raw, rawCol, num, label,
    need(k) {
      const n = num(k);
      if (n === null) throw new Missing([label(k)]);
      return n;
    },
    numOr0: (k) => num(k) ?? 0,
    str: (k) => { const v = raw(k); return isBlank(v) ? '' : String(v).trim(); },
    date: (k) => parseDate(raw(k)),
    firstDate: (...ks) => { for (const k of ks) { const d = parseDate(raw(k)); if (d) return d; } return null; },
    isApprentice: () => isYes(raw('isApprentice')),
  };
}

const NA_APPRENTICE = { na: 'apprentice — Apprentices Act stipend, not wages' } as const;

// ─── Rules ───────────────────────────────────────────────────────────────────

const R_ATTENDANCE: Rule = {
  id: 'attendance.summary',
  title: 'Daily attendance (EN:FR) → present / absent / week-off / NCP / LWP days',
  consumes: ['monthOf'],
  produces: ['presentDays', 'absentDays', 'woHolidayDays', 'otDays', 'daysWorkedA', 'totalDaysWorked', 'lwpDays', 'ncpDays'],
  run(ctx) {
    if (!ctx.month) throw new Missing([ctx.label('monthOf')]);
    const days = ctx.month.days;
    const c = { P: 0, HD: 0, A: 0, WO: 0, H: 0, PL: 0, LWP: 0, OT: 0 };
    let recorded = 0;
    for (let d = 1; d <= days; d += 1) {
      const cls = classifyAttendance(ctx.rawCol(dayCol(d)));
      if (cls === null) continue;
      if (cls === 'UNK') {
        throw new Blocked(`unrecognised attendance code "${String(ctx.rawCol(dayCol(d)))}" on day ${d} (${colLetter(dayCol(d))})`);
      }
      c[cls] += 1;
      recorded += 1;
    }
    if (recorded === 0) throw new Missing([`EN:FR daily attendance (month has ${days} days)`]);
    if (recorded < days) throw new Blocked(`attendance recorded for only ${recorded} of ${days} days`);

    const present = c.P + c.OT + 0.5 * c.HD;
    const absent = c.A + 0.5 * c.HD;
    const out: Outputs = {
      presentDays: present,
      absentDays: absent,
      woHolidayDays: c.WO + c.H,
      daysWorkedA: present,
      totalDaysWorked: present,
      lwpDays: c.LWP,
      ncpDays: absent + c.LWP,
    };
    if (c.OT > 0) out.otDays = c.OT;
    return out;
  },
};

const R_OT_HOURS: Rule = {
  id: 'ot.hours',
  title: 'OT hours weeks 1-4 → total overtime hours',
  consumes: ['otWeek1', 'otWeek2', 'otWeek3', 'otWeek4'],
  produces: ['totalOtHours', 'otHoursB'],
  run(ctx) {
    const ks = ['otWeek1', 'otWeek2', 'otWeek3', 'otWeek4'] as const;
    if (ks.every((k) => ctx.num(k) === null)) return { na: 'no overtime hours recorded' };
    const total = round2(ks.reduce((s, k) => s + ctx.numOr0(k), 0));
    return { totalOtHours: total, otHoursB: total };
  },
};

const R_RATES: Rule = {
  id: 'wages.rates',
  title: 'Basic (+DA/VDA) → daily rate, hourly ordinary rate, OT rate (2×)',
  consumes: ['basic', 'da', 'vda', 'dailyRate'],
  produces: ['dailyRate', 'normalRate', 'otRate', 'otRateHr'],
  run(ctx) {
    if (ctx.isApprentice()) return NA_APPRENTICE;
    const { cfg } = ctx;
    const daily = ctx.num('dailyRate') ??
      round2((ctx.need('basic') + ctx.numOr0('da') + ctx.numOr0('vda')) / cfg.workingDaysDivisor);
    const hourly = round2(daily / cfg.hoursPerDay);
    const ot = round2(hourly * cfg.otMultiplier);
    return { dailyRate: daily, normalRate: hourly, otRate: ot, otRateHr: ot };
  },
};

const R_OT_AMOUNT: Rule = {
  id: 'ot.amount',
  title: 'Total OT hours × OT rate → overtime amount',
  consumes: ['totalOtHours', 'otRate'],
  produces: ['otAmount', 'otEarning'],
  run(ctx) {
    if (ctx.isApprentice()) return NA_APPRENTICE;
    const hours = ctx.num('totalOtHours');
    if (hours === null) return { na: 'no overtime hours' };
    const amt = round2(hours * ctx.need('otRate'));
    return { otAmount: amt, otEarning: amt };
  },
};

const R_GROSS: Rule = {
  id: 'wages.gross',
  title: 'Sum of earnings components → Gross Salary (Monthly)',
  consumes: ['basic', 'da', 'vda', 'hra', 'medical', 'conveyance', 'specialAllow', 'additionalComp', 'othersAllow', 'nightAllowance'],
  produces: ['gross'],
  run(ctx) {
    if (ctx.isApprentice()) return NA_APPRENTICE;
    ctx.need('basic');
    return { gross: round2(ctx.cfg.grossComponents.reduce((s, k) => s + ctx.numOr0(k), 0)) };
  },
};

const R_AGE: Rule = {
  id: 'person.age',
  title: 'Date of birth → Employee Age',
  consumes: ['dobA', 'dobB'],
  produces: ['age'],
  run(ctx) {
    const dob = ctx.firstDate('dobB', 'dobA');
    if (!dob) throw new Missing([`${ctx.label('dobB')} (or ${ctx.label('dobA')})`]);
    return { age: ageOn(dob, ctx.asOf) };
  },
};

const R_PF: Rule = {
  id: 'epf.contributions',
  title: 'EPF wages → EPS/EDLI wages, 12% EPF, 8.33% EPS (max 1,250), difference, admin, total employer',
  consumes: ['basic', 'da', 'vda', 'age'],
  produces: [
    'epfWages', 'epsWages', 'edliWages', 'epfContri', 'epsContri', 'epfEpsDiff',
    'employerPf', 'pfAdmin', 'totalEmployer',
  ],
  run(ctx) {
    if (ctx.isApprentice()) return { na: 'apprentice — EPF not applicable' };
    const { cfg } = ctx;
    const wages = ctx.need('basic') + (cfg.epfWagesIncludeDA ? ctx.numOr0('da') + ctx.numOr0('vda') : 0);
    const capped = Math.min(wages, cfg.pfWageCeiling);
    const age = ctx.num('age');
    const epsEligible = age === null || age < cfg.epsAgeCutoff;

    const epf12 = roundRupee(capped * cfg.pfEmployeeRate);
    const eps = epsEligible ? Math.min(roundRupee(capped * cfg.epsRate), cfg.epsMaxContribution) : 0;
    const admin = roundRupee(capped * cfg.pfAdminRate);
    const edli = roundRupee(capped * cfg.edliRate);
    return {
      epfWages: round2(wages),
      epsWages: epsEligible ? capped : 0,
      edliWages: capped,
      epfContri: epf12,
      epsContri: eps,
      epfEpsDiff: epf12 - eps,
      employerPf: epf12,
      pfAdmin: admin,
      totalEmployer: epf12 + admin + edli,
    };
  },
};

const R_ESIC: Rule = {
  id: 'esic.contributions',
  title: 'Gross ≤ ceiling → ESIC 3.25% employer + 0.75% employee (rounded up)',
  consumes: ['gross', 'otAmount'],
  produces: ['esicEmployer', 'esicEmployee', 'esicTotalA', 'esicTotalB'],
  run(ctx) {
    if (ctx.isApprentice()) return { na: 'apprentice — ESIC not applicable' };
    const { cfg } = ctx;
    const gross = ctx.need('gross');
    if (gross > cfg.esicWageCeiling) {
      return { esicEmployer: 0, esicEmployee: 0, esicTotalA: 0, esicTotalB: 0 };
    }
    const base = gross + (cfg.esicIncludesOT ? ctx.numOr0('otAmount') : 0);
    const er = ceilRupee(base * cfg.esicEmployerRate);
    const ee = gross / cfg.workingDaysDivisor <= cfg.esicDailyWageExemption
      ? 0
      : ceilRupee(base * cfg.esicEmployeeRate);
    return { esicEmployer: er, esicEmployee: ee, esicTotalA: er + ee, esicTotalB: er + ee };
  },
};

const R_BONUS: Rule = {
  id: 'bonus.accrual',
  title: 'Basic+DA ≤ 21,000 → Bonus eligibility and monthly accrual (8.33% of capped wage)',
  consumes: ['basic', 'da', 'minWage'],
  produces: ['bonusCalc', 'bonusEligA', 'bonusEligB'],
  run(ctx) {
    if (ctx.isApprentice()) return { na: 'apprentice — Bonus Act not applicable' };
    const { cfg } = ctx;
    const wage = ctx.need('basic') + ctx.numOr0('da');
    const eligible = wage <= cfg.bonusEligibilityCeiling;
    const mw = ctx.num('minWage') ?? 0;
    const base = Math.min(wage, Math.max(cfg.bonusCalcFloor, mw));
    const label = eligible ? 'Yes' : 'No';
    return { bonusEligA: label, bonusEligB: label, bonusCalc: eligible ? round2(base * cfg.bonusRate) : 0 };
  },
};

const R_GRATUITY: Rule = {
  id: 'gratuity.eligibility',
  title: 'Date of joining → eligibility date, eligibility flag, monthly provision, amount payable',
  consumes: ['basic', 'da', 'dojA', 'dojB', 'dojC', 'employedFrom', 'dateOfTermA', 'dateOfTermB'],
  produces: ['gratuityDateA', 'gratuityDateB', 'gratuityElig', 'gratuityCalc', 'gratuityPayable'],
  run(ctx) {
    if (ctx.isApprentice()) return { na: 'apprentice — Gratuity Act not applicable' };
    const { cfg } = ctx;
    const doj = ctx.firstDate('dojC', 'dojB', 'dojA', 'employedFrom');
    if (!doj) throw new Missing([`${ctx.label('dojC')} (or ${ctx.label('dojB')} / ${ctx.label('dojA')})`]);
    const wage = ctx.need('basic') + ctx.numOr0('da');

    const exit = ctx.firstDate('dateOfTermA', 'dateOfTermB');
    const until = exit && exit.getTime() < ctx.asOf.getTime() ? exit : ctx.asOf;
    const eligibleOn = addYears(doj, cfg.gratuityYears);
    const eligible = until.getTime() >= eligibleOn.getTime();

    const out: Outputs = {
      gratuityDateA: eligibleOn,
      gratuityDateB: eligibleOn,
      gratuityElig: eligible ? 'Yes' : 'No',
      gratuityCalc: round2((wage * cfg.gratuityDays) / cfg.gratuityDivisor / 12),
    };
    if (eligible) {
      const months = monthsBetween(doj, until);
      const years = Math.floor(months / 12) + (months % 12 >= 6 ? 1 : 0); // >6 months rounds up
      out.gratuityPayable = Math.min(
        cfg.gratuityCap, round2((wage / cfg.gratuityDivisor) * cfg.gratuityDays * years),
      );
    }
    return out;
  },
};

function stateOf(ctx: Ctx): string {
  const s = ctx.str('state');
  if (!s) throw new Missing([ctx.label('state')]);
  return canonicalState(s, ctx.tables);
}

const R_PT: Rule = {
  id: 'pt.amount',
  title: 'State + gross (+gender, month) → Professional Tax amount, frequency, applicability',
  consumes: ['state', 'gross', 'genderA', 'genderB', 'monthOf'],
  produces: ['ptAmount', 'ptFrequency', 'ptApplicable'],
  run(ctx) {
    if (ctx.isApprentice()) return NA_APPRENTICE;
    const state = stateOf(ctx);
    if (ctx.tables.noPt.some((s) => s.toLowerCase() === state.toLowerCase())) {
      return { ptAmount: 0, ptApplicable: 'No' };
    }
    const entry = ctx.tables.pt[state];
    if (!entry) throw new Blocked(`no Professional Tax table for state "${state}" — add it to statutoryTables.ts`);
    if (!entry.verified && !ctx.cfg.allowUnverifiedTables) {
      throw new Blocked(`PT table for ${state} is not marked verified (statutoryTables.ts)`);
    }
    const gross = ctx.need('gross');
    const g = normGender(ctx.raw('genderA') ?? ctx.raw('genderB')).value ?? normGender(ctx.raw('genderB')).value;
    const needsGender = entry.slabs.some((s) => s.gender !== 'any');
    if (needsGender && !g) throw new Missing([`${ctx.label('genderA')} (PT slabs for ${state} depend on gender)`]);
    const slab = entry.slabs.find(
      (s) => (s.gender === 'any' || s.gender === g) && gross >= s.min && (s.max === null || gross <= s.max),
    );
    if (!slab) throw new Blocked(`no PT slab in ${state} covers gross ${gross}${g ? ` for ${g}` : ''}`);
    const feb = ctx.month?.month0 === 1 && slab.feb !== undefined;
    return { ptAmount: feb ? slab.feb! : slab.amount, ptFrequency: entry.frequency, ptApplicable: 'Yes' };
  },
};

const R_LWF: Rule = {
  id: 'lwf.amount',
  title: 'State + month → Labour Welfare Fund (employee / employer / total, frequency)',
  consumes: ['state', 'monthOf'],
  produces: ['employeeLwf', 'employerLwf', 'totalLwf', 'lwfFrequency', 'lwfApplicable'],
  run(ctx) {
    if (ctx.isApprentice()) return NA_APPRENTICE;
    const state = stateOf(ctx);
    if (ctx.tables.noLwf.some((s) => s.toLowerCase() === state.toLowerCase())) {
      return { employeeLwf: 0, employerLwf: 0, totalLwf: 0, lwfApplicable: 'No' };
    }
    const entry = ctx.tables.lwf[state];
    if (!entry) throw new Blocked(`no LWF table for state "${state}" — add it to statutoryTables.ts`);
    if (!entry.verified && !ctx.cfg.allowUnverifiedTables) {
      throw new Blocked(`LWF table for ${state} is not marked verified (statutoryTables.ts)`);
    }
    if (!ctx.month) throw new Missing([ctx.label('monthOf')]);
    const due = entry.months.includes(ctx.month.month0 + 1);
    const ee = due ? entry.employee : 0;
    const er = due ? entry.employer : 0;
    return {
      employeeLwf: ee, employerLwf: er, totalLwf: ee + er,
      lwfFrequency: entry.frequency, lwfApplicable: 'Yes',
    };
  },
};

const R_DEDUCTIONS: Rule = {
  id: 'wages.deductions',
  title: 'EPF + ESIC + PT + LWF + TDS + other recoveries → Total Deduction from salary',
  consumes: [
    'epfContri', 'esicEmployee', 'ptAmount', 'employeeLwf', 'tds', 'societyDed', 'insuranceDed',
    'medInsuranceDed', 'otherDeduction', 'advanceRefund',
  ],
  produces: ['totalDeduction'],
  run(ctx) {
    if (ctx.isApprentice()) return NA_APPRENTICE;
    // Statutory components must be KNOWN (a value or an explicit 0); optional recoveries default to 0.
    const required: FieldKey[] = ['epfContri', 'esicEmployee', 'ptAmount', 'employeeLwf'];
    const missing = required.filter((k) => ctx.num(k) === null).map((k) => ctx.label(k));
    if (missing.length) throw new Missing(missing);
    const optional: FieldKey[] = ['tds', 'societyDed', 'insuranceDed', 'medInsuranceDed', 'otherDeduction', 'advanceRefund'];
    const total = [...required, ...optional].reduce((s, k) => s + ctx.numOr0(k), 0);
    return { totalDeduction: round2(total) };
  },
};

const R_NET: Rule = {
  id: 'wages.net',
  title: 'Gross − deductions → Net Salary; + overtime → Net payments',
  consumes: ['gross', 'totalDeduction', 'otAmount'],
  produces: ['net', 'netPaid'],
  run(ctx) {
    if (ctx.isApprentice()) return NA_APPRENTICE;
    const net = round2(ctx.need('gross') - ctx.need('totalDeduction'));
    return { net, netPaid: round2(net + ctx.numOr0('otAmount')) };
  },
};

const R_CTC: Rule = {
  id: 'ctc.annual',
  title: '(Gross + bonus + gratuity provision [+ employer PF/EDLI/ESIC]) × 12 → CTC (Annual)',
  consumes: ['gross', 'bonusCalc', 'gratuityCalc', 'employerPf', 'pfAdmin', 'edliWages', 'esicEmployer'],
  produces: ['ctcAnnual', 'ctcB'],
  run(ctx) {
    if (ctx.isApprentice()) return NA_APPRENTICE;
    const { cfg } = ctx;
    let monthly = ctx.need('gross') + ctx.need('bonusCalc') + ctx.need('gratuityCalc');
    if (cfg.ctcIncludesEmployerStatutory) {
      const edli = roundRupee(ctx.numOr0('edliWages') * cfg.edliRate);
      monthly += ctx.need('employerPf') + ctx.need('pfAdmin') + edli + ctx.need('esicEmployer');
    }
    const annual = round2(monthly * 12);
    return { ctcAnnual: annual, ctcB: annual };
  },
};

const R_STIPEND: Rule = {
  id: 'apprentice.stipend',
  title: 'Stipend − absence deduction → earned / net stipend (Apprentices Act)',
  consumes: ['stipend', 'ncpDays', 'monthOf'],
  produces: ['appDeductions', 'appEarnedStipend', 'appNetStipend'],
  run(ctx) {
    if (!ctx.isApprentice()) return { na: 'not an apprentice' };
    if (!ctx.month) throw new Missing([ctx.label('monthOf')]);
    const stipend = ctx.need('stipend');
    const ncp = ctx.need('ncpDays');
    const deduction = round2((stipend * ncp) / ctx.month.days);
    const earned = round2(stipend - deduction);
    return { appDeductions: deduction, appEarnedStipend: earned, appNetStipend: earned };
  },
};

export const ALL_RULES: readonly Rule[] = [
  R_ATTENDANCE, R_OT_HOURS, R_RATES, R_OT_AMOUNT, R_GROSS, R_AGE, R_PF, R_ESIC, R_BONUS,
  R_GRATUITY, R_PT, R_LWF, R_DEDUCTIONS, R_NET, R_CTC, R_STIPEND,
];

// ─── Dependency ordering ─────────────────────────────────────────────────────

/** Stable topological sort: a rule runs after every rule that produces something it consumes. */
export function orderRules(rules: readonly Rule[] = ALL_RULES): Rule[] {
  const producers = new Map<FieldKey, Rule[]>();
  for (const r of rules) for (const k of r.produces) {
    if (!producers.has(k)) producers.set(k, []);
    producers.get(k)!.push(r);
  }
  const deps = new Map<Rule, Set<Rule>>();
  for (const r of rules) {
    const set = new Set<Rule>();
    for (const k of r.consumes) for (const p of producers.get(k) ?? []) if (p !== r) set.add(p);
    deps.set(r, set);
  }
  const ordered: Rule[] = [];
  const state = new Map<Rule, 0 | 1 | 2>();
  const visit = (r: Rule, trail: string[]): void => {
    const s = state.get(r) ?? 0;
    if (s === 2) return;
    if (s === 1) throw new Error(`Rule dependency cycle: ${[...trail, r.id].join(' → ')}`);
    state.set(r, 1);
    for (const d of deps.get(r)!) visit(d, [...trail, r.id]);
    state.set(r, 2);
    ordered.push(r);
  };
  for (const r of rules) visit(r, []);
  return ordered;
}

/** Sanity check used by the self-test: every key a rule names must exist in the registry. */
export function assertRuleKeysKnown(rules: readonly Rule[] = ALL_RULES): void {
  const known = new Set<string>(FIELD_KEYS);
  for (const r of rules) for (const k of [...r.consumes, ...r.produces]) {
    if (!known.has(k)) throw new Error(`Rule ${r.id} references unknown field "${k}"`);
  }
}
