import type { Gender, PayrollRules } from '../types';
import type { RegisterTable, Cell } from './parseRegister';
import { ptFor, lwfFor, r2 } from './salaryEngine';

export type Role =
  | 'empId' | 'name' | 'designation' | 'basic' | 'da' | 'hra' | 'allowance' | 'gross'
  | 'pfEe' | 'pfEr' | 'esicEe' | 'esicEr' | 'pt' | 'lwf' | 'otherDed' | 'totalDed' | 'net' | 'serial' | 'ot';

export type Basis = 'arithmetic' | 'statutory' | 'pattern' | 'data';
export interface Finding {
  id: string;
  row: number; col: number;
  rule: string;
  basis: Basis;
  message: string;
  actual: Cell;
  expected: number | null;   // value that would make the cell pass, when computable
}
export type CellState = 'ok' | 'bad' | 'none';

export interface AnalysisOptions {
  rules: PayrollRules;
  gender: Gender;
  month: number;
  tolerance: number;         // rupees
}

export interface Analysis {
  roles: Partial<Record<Role, number[]>>;
  findings: Finding[];
  checked: Set<string>;      // cells that were examined (green unless a finding exists)
  patterns: string[];        // human-readable patterns the engine learned from the register
  skipped: string[];         // checks that could not run (missing column etc.)
  notices: string[];         // things the user should confirm (not errors)
}

export const key = (r: number, c: number) => `${r}:${c}`;

const ROLE_RULES: Array<[Role, RegExp, RegExp?]> = [
  ['serial', /^(sl\.?\s*no\.?|s\.?\s*no\.?|serial)/i],
  ['empId', /(emp(loyee)?\.?\s*(code|id|no)|ecode|token\s*no)/i],
  ['name', /(^|\s)name(\s|$)/i, /(father|husband|company|establishment|bank|nominee)/i],
  ['designation', /(designation|grade|category|skill)/i],
  ['pfEr', /(employer).*(pf|provident|epf)|(pf|provident|epf).*(employer|er\b)/i],
  ['pfEe', /(^|\s)(pf|epf|provident)/i, /(employer|uan|member|number|no\.|wages|wage)/i],
  ['esicEr', /(employer).*(esi|esic)|(esi|esic).*(employer|er\b)/i],
  ['esicEe', /(esi|esic)/i, /(employer|number|no\.|ip\b)/i],
  ['pt', /(professional\s*tax|^pt\b|\bptax\b|\bp\.?\s?tax\b)/i],
  ['lwf', /(lwf|labou?r\s*welfare)/i],
  ['totalDed', /total\s*deduction/i],
  ['net', /net\s*(pay|salary|wage|payment|paid|amount)/i],
  ['gross', /gross/i, /(deduction|total\s*days)/i],
  ['basic', /^basic|basic\s*(wage|salary|pay)/i, /(rate|da\b)/i],
  ['da', /(dearness|^da\b|\bda\s*(amount|allow))/i],
  ['hra', /(\bhra\b|house\s*rent)/i],
  ['otherDed', /(advance|loan|tds|income\s*tax|other\s*deduction|canteen|insurance)/i],
  ['ot', /(over\s*time|^ot\b|\bot\s*(amount|pay|wages))/i],
  ['allowance', /(allowance|conveyance|special|medical|washing|bonus|incentive|attendance\s*award|other\s*earning)/i, /(rate|days)/i],
];

export function detectRoles(headers: string[]): Partial<Record<Role, number[]>> {
  const out: Partial<Record<Role, number[]>> = {};
  headers.forEach((h, i) => {
    for (const [role, inc, exc] of ROLE_RULES) {
      if (inc.test(h) && !(exc && exc.test(h))) {
        (out[role] ??= []).push(i);
        break;
      }
    }
  });
  return out;
}

const num = (v: Cell): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.replace(/[,₹\s]/g, '');
    if (t === '' || t === '-') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const blank = (v: Cell) => v == null || String(v).trim() === '';
const isNumLike = (v: Cell) => num(v) !== null;
const ceil = (n: number) => Math.ceil(n - 1e-9);
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function analyze(table: RegisterTable, opt: AnalysisOptions): Analysis {
  const { rows, headers } = table;
  const roles = detectRoles(headers);
  const findings: Finding[] = [];
  const checked = new Set<string>();
  const patterns: string[] = [];
  const skipped: string[] = [];
  const notices: string[] = [];
  const tol = opt.tolerance;
  const P = opt.rules.params;
  let fid = 0;

  const first = (r: Role) => roles[r]?.[0];
  const wageOf50 = (i: number) => (num(rows[i][first('basic') as number]) ?? 0) + (first('da') != null ? (num(rows[i][first('da') as number]) ?? 0) : 0);
  const val = (i: number, c: number | undefined) => (c == null ? null : num(rows[i][c]));
  const sumCols = (i: number, cols: number[] = []) => cols.reduce((s, c) => s + (val(i, c) ?? 0), 0);

  const mark = (i: number, c: number) => checked.add(key(i, c));
  const flag = (i: number, c: number, rule: string, basis: Basis, message: string, expected: number | null) => {
    findings.push({ id: `f${fid++}`, row: i, col: c, rule, basis, message, actual: rows[i][c], expected: expected == null ? null : r2(expected) });
  };
  const differs = (a: number, b: number) => Math.abs(a - b) > tol;

  const basicC = first('basic'), daC = first('da'), hraC = first('hra'), grossC = first('gross');
  const pfEeC = first('pfEe'), pfErC = first('pfEr'), esEeC = first('esicEe'), esErC = first('esicEr');
  const ptC = first('pt'), lwfC = first('lwf'), tdC = first('totalDed'), netC = first('net');

  // ── 1. Arithmetic identities (row-wise) ───────────────────────────────────
  if (grossC != null && basicC != null) {
    const earnCols = [basicC, daC, hraC, ...(roles.allowance ?? [])].filter((c): c is number => c != null);
    patterns.push(`Gross = ${earnCols.map((c) => headers[c]).join(' + ')}`);
    rows.forEach((_, i) => {
      const g = val(i, grossC); if (g == null) return;
      const exp = sumCols(i, earnCols);
      mark(i, grossC);
      if (differs(g, exp)) flag(i, grossC, 'Gross = sum of earnings', 'arithmetic', `Gross is ${g} but earnings add up to ${r2(exp)}.`, exp);
    });
  } else skipped.push('Gross = sum of earnings (needs Basic and Gross columns)');

  const dedCols = [pfEeC, esEeC, ptC, lwfC, ...(roles.otherDed ?? [])].filter((c): c is number => c != null);
  if (tdC != null && dedCols.length) {
    patterns.push(`Total deductions = ${dedCols.map((c) => headers[c]).join(' + ')}`);
    rows.forEach((_, i) => {
      const t = val(i, tdC); if (t == null) return;
      const exp = sumCols(i, dedCols);
      mark(i, tdC);
      if (differs(t, exp)) flag(i, tdC, 'Total deductions = sum of deductions', 'arithmetic', `Total deductions is ${t} but the listed deductions add up to ${r2(exp)}.`, exp);
    });
  } else skipped.push('Total deductions check (needs a Total Deduction column and deduction columns)');

  if (netC != null && (grossC != null || basicC != null)) {
    rows.forEach((_, i) => {
      const n = val(i, netC); if (n == null) return;
      const g = grossC != null ? val(i, grossC) : sumCols(i, [basicC!, daC, hraC, ...(roles.allowance ?? [])].filter((c): c is number => c != null));
      if (g == null) return;
      const ot = sumCols(i, roles.ot);
      const ded = tdC != null ? (val(i, tdC) ?? sumCols(i, dedCols)) : sumCols(i, dedCols);
      const exp = g + ot - ded;
      mark(i, netC);
      if (differs(n, exp)) flag(i, netC, 'Net = Gross − Deductions', 'arithmetic', `Net pay is ${n} but gross ${r2(g)}${ot ? ` + OT ${r2(ot)}` : ''} − deductions ${r2(ded)} = ${r2(exp)}.`, exp);
    });
  }

  // ── 1b. 50% wage rule: Basic + DA must be at least 50% of Gross Wages ────
  if (grossC != null && basicC != null) {
    let n = 0, ok = 0;
    rows.forEach((_, i) => {
      const g = val(i, grossC); if (g == null || g <= 0) return;
      n += 1;
      const w = wageOf50(i);
      mark(i, basicC);
      const short = 0.5 * g - w;
      if (short > tol) flag(i, basicC, 'Basic + DA ≥ 50% of Gross', 'statutory',
        `Basic+DA is ₹${w.toLocaleString('en-IN')} = ${((w / g) * 100).toFixed(1)}% of Gross ₹${g.toLocaleString('en-IN')}; it must be at least 50%. Raise Basic/DA by ₹${r2(short)} (and reduce allowances so Gross stays the same).`, null);
      else ok += 1;
    });
    if (n) patterns.push(`Basic + DA ≥ 50% of Gross Wages — met in ${ok} of ${n} rows`);
  }

  // ── 2. Statutory checks using the state / industry rules ─────────────────
  const grossOf = (i: number) => (grossC != null ? val(i, grossC) : null);

  // PF rule (EPFO illustration table, wage ceiling ₹25,000): contribution wage = Basic + DA, capped at ₹25,000.
  //   ₹10,000 → 1,200 · ₹15,000 → 1,800 · ₹20,000 → 2,400 · ₹25,000 → 3,000 · ₹35,000 (above cap) → 3,000.
  //   i.e. 12% of the actual Basic+DA up to the ceiling, and 12% of ₹25,000 beyond it. No special ₹20,000 case.
  const wageOf = (i: number) => (val(i, basicC) ?? 0) + (val(i, daC) ?? 0);
  const inr = (n: number) => n.toLocaleString('en-IN');
  const ceilingTxt = `₹${inr(P.pfWageCeiling)}`;
  const pfCheck = (col: number, rate: number, label: string, rule: string) => {
    let n = 0, hits = 0, below = 0;
    rows.forEach((_, i) => {
      const v = val(i, col); if (v == null) return;
      n += 1;
      const w = wageOf(i);
      if (w < P.pfWageCeiling) below += 1;
      const exp = Math.round(Math.min(w, P.pfWageCeiling) * rate);
      mark(i, col);
      if (!differs(v, exp)) { hits += 1; return; }
      let why = `${label} is ${v}; expected ${exp} (${(rate * 100).toFixed(0)}% of Basic+DA ₹${inr(w)}${w > P.pfWageCeiling ? `, capped at ${ceilingTxt}` : ''}).`;
      if (P.pfWageCeiling !== 15000 && w > 15000 && !differs(v, Math.round(Math.min(w, 15000) * rate)))
        why = `${label} looks capped at the old ₹15,000 ceiling, but Basic+DA is ₹${inr(w)} — it must be on the actual Basic+DA up to ${ceilingTxt}. Expected ${exp}, found ${v}.`;
      else if (w >= P.pfWageCeiling && !differs(v, Math.round(w * rate)))
        why = `${label} is on the full Basic+DA of ₹${inr(w)}; the contribution wage is capped at ${ceilingTxt}. Expected ${exp}, found ${v}.`;
      flag(i, col, rule, 'statutory', why, exp);
    });
    return { n, hits, below };
  };

  if (pfEeC != null && basicC != null) {
    const { n, hits, below } = pfCheck(pfEeC, P.pfEmployeeRate, 'Employee PF', 'Employee PF 12% (Basic+DA, cap)');
    if (n) {
      patterns.push(`Employee PF = 12% of Basic+DA, capped at ${ceilingTxt} — correct in ${hits} of ${n} rows`);
      if (below) patterns.push(`PF reviewed for ${below} employees with Basic+DA below ${ceilingTxt}`);
    }
  } else skipped.push('PF check (needs Employee PF and Basic columns)');

  if (pfErC != null && basicC != null) pfCheck(pfErC, P.pfEmployerRate, 'Employer PF', 'Employer PF 12% (Basic+DA, cap)');

  if (esEeC != null && grossC != null) {
    rows.forEach((_, i) => {
      const v = val(i, esEeC), g = grossOf(i); if (v == null || g == null) return;
      mark(i, esEeC);
      const exp = g <= P.esicGrossCeiling ? ceil(g * P.esicEmployeeRate) : 0;
      if (differs(v, exp)) flag(i, esEeC, 'Employee ESIC 0.75%', 'statutory',
        g <= P.esicGrossCeiling ? `Gross ${g} is within the ₹${P.esicGrossCeiling.toLocaleString('en-IN')} ESIC ceiling; expected ${exp}, found ${v}.`
          : `Gross ${g} exceeds the ₹${P.esicGrossCeiling.toLocaleString('en-IN')} ESIC ceiling, so ESIC is normally nil. (If the employee crossed the ceiling mid contribution-period it stays covered — mark correct if so.)`, exp);
    });
  } else skipped.push('ESIC check (needs Employee ESIC and Gross columns)');

  if (esErC != null && grossC != null) {
    rows.forEach((_, i) => {
      const v = val(i, esErC), g = grossOf(i); if (v == null || g == null) return;
      mark(i, esErC);
      const exp = g <= P.esicGrossCeiling ? ceil(g * P.esicEmployerRate) : 0;
      if (differs(v, exp)) flag(i, esErC, 'Employer ESIC 3.25%', 'statutory', `Expected ${exp} for gross ${g}, found ${v}.`, exp);
    });
  }

  if (ptC != null && grossC != null) {
    if (!opt.rules.ptSlabs.length) skipped.push(`PT check (no professional-tax slabs loaded for ${opt.rules.state || 'the selected state'})`);
    else {
      patterns.push(`PT follows ${opt.rules.state} slabs${opt.month === 2 ? ' (February amount applies)' : ''}`);
      rows.forEach((_, i) => {
        const v = val(i, ptC), g = grossOf(i); if (v == null || g == null) return;
        mark(i, ptC);
        const exp = ptFor(opt.rules, g, opt.gender, opt.month);
        if (differs(v, exp)) flag(i, ptC, 'Professional tax slab', 'statutory', `Gross ${g} falls in a ${opt.rules.state} slab of ₹${exp}; found ${v}.`, exp);
      });
    }
  } else skipped.push('PT check (needs PT and Gross columns)');

  if (lwfC != null && grossC != null && opt.rules.lwf) {
    rows.forEach((_, i) => {
      const v = val(i, lwfC), g = grossOf(i); if (v == null || g == null) return;
      mark(i, lwfC);
      const exp = lwfFor(opt.rules, g, opt.month).ee;
      if (differs(v, exp)) flag(i, lwfC, 'Labour Welfare Fund', 'statutory', `LWF for ${opt.rules.state} in this month should be ${exp}; found ${v}.`, exp);
    });
  }

  // ── 3. Pattern learning: dominant ratios across rows / designation groups ─
  const groupC = first('designation');
  const learnRatio = (numC: number | undefined, denCols: Array<number | undefined>, label: string) => {
    const dens = denCols.filter((c): c is number => c != null);
    if (numC == null || !dens.length) return;
    const idx = rows.map((_, i) => i).filter((i) => (val(i, numC) ?? 0) > 0 && sumCols(i, dens) > 0);
    if (idx.length < 5) return;
    const ratio = (i: number) => (val(i, numC) as number) / sumCols(i, dens);
    const dominant = (set: number[]) => {
      const buckets = new Map<number, number[]>();
      set.forEach((i) => { const b = Math.round(ratio(i) * 200) / 200; (buckets.get(b) ?? buckets.set(b, []).get(b)!).push(i); });
      const top = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)[0];
      return { mode: median(top[1].map(ratio)), support: top[1].length / set.length };
    };
    let groups: number[][] = [idx];
    let g = dominant(idx);
    if (g.support < 0.6 && groupC != null) {
      const by = new Map<string, number[]>();
      idx.forEach((i) => { const k = String(rows[i][groupC] ?? ''); (by.get(k) ?? by.set(k, []).get(k)!).push(i); });
      groups = [...by.values()].filter((x) => x.length >= 5);
      if (!groups.length) groups = [idx];
    }
    let learned = false;
    groups.forEach((set) => {
      const d = dominant(set);
      if (d.support < 0.6) return;
      learned = true;
      const tag = groups.length > 1 || set !== idx ? ` for ${String(rows[set[0]][groupC!] ?? '')}` : '';
      patterns.push(`${label} ≈ ${(d.mode * 100).toFixed(1)}%${tag} in ${Math.round(d.support * set.length)} of ${set.length} rows`);
      set.forEach((i) => {
        mark(i, numC);
        if (Math.abs(ratio(i) - d.mode) > 0.005) {
          const exp = d.mode * sumCols(i, dens);
          if (differs(val(i, numC) as number, exp))
            flag(i, numC, `${label} pattern`, 'pattern', `${label} is ${(ratio(i) * 100).toFixed(1)}% here, but ${Math.round(d.support * 100)}% of comparable rows use ${(d.mode * 100).toFixed(1)}%.`, exp);
        }
      });
    });
    if (!learned && g.support < 0.6) skipped.push(`${label}: no dominant pattern (rows are too varied to infer one)`);
  };
  learnRatio(basicC, [grossC], 'Basic ÷ Gross');
  learnRatio(hraC, [basicC], 'HRA ÷ Basic');

  // ── 4. Column / row hygiene patterns ─────────────────────────────────────
  const numericCols = [basicC, daC, hraC, grossC, pfEeC, pfErC, esEeC, esErC, ptC, tdC, netC, ...(roles.allowance ?? [])].filter((c): c is number => c != null);
  numericCols.forEach((c) => {
    const filled = rows.filter((r) => !blank(r[c])).length;
    rows.forEach((r, i) => {
      const v = r[c];
      if (!blank(v) && !isNumLike(v)) flag(i, c, 'Numeric column', 'data', `"${String(v)}" is text in a numeric column.`, null);
      else if (!blank(v) && (num(v) as number) < 0) flag(i, c, 'Negative amount', 'data', `Negative value ${v}.`, null);
      else if (blank(v) && filled / rows.length >= 0.8 && c !== lwfC && c !== esEeC && c !== esErC)
        flag(i, c, 'Blank cell', 'data', `Empty, while ${filled} of ${rows.length} rows in "${headers[c]}" are filled.`, null);
    });
  });

  const idC = first('empId') ?? first('name');
  if (idC != null) {
    const seen = new Map<string, number>();
    rows.forEach((r) => { const k = String(r[idC] ?? '').trim().toLowerCase(); if (k) seen.set(k, (seen.get(k) ?? 0) + 1); });
    rows.forEach((r, i) => {
      const k = String(r[idC] ?? '').trim().toLowerCase();
      mark(i, idC);
      if (k && (seen.get(k) ?? 0) > 1) flag(i, idC, 'Duplicate employee', 'data', `"${r[idC]}" appears ${seen.get(k)} times.`, null);
    });
  }

  const serC = first('serial');
  if (serC != null) {
    const vals = rows.map((r) => num(r[serC]));
    if (vals.filter((v) => v != null).length >= rows.length * 0.8) {
      patterns.push('Serial numbers run 1, 2, 3 … without gaps');
      vals.forEach((v, i) => { mark(i, serC); if (v !== i + 1) flag(i, serC, 'Serial sequence', 'data', `Serial is ${v ?? 'blank'}; the sequence expects ${i + 1}.`, i + 1); });
    }
  }

  return { roles, findings, checked, patterns, skipped, notices };
}

/** Return the cells' final state given the findings that are still active. */
export function cellStates(a: Analysis, active: Finding[]): Map<string, CellState> {
  const m = new Map<string, CellState>();
  a.checked.forEach((k) => m.set(k, 'ok'));
  active.forEach((f) => m.set(key(f.row, f.col), 'bad'));
  return m;
}

/**
 * If the register has no Gross column, append a calculated "Gross Wages" column
 * (sum of earnings, excluding overtime) so the 50% rule can be tested.
 */
export function withGrossColumn(table: RegisterTable): { table: RegisterTable; added: boolean } {
  const roles = detectRoles(table.headers);
  if (roles.gross?.length || roles.basic == null) return { table, added: false };
  const earn = [roles.basic[0], roles.da?.[0], roles.hra?.[0], ...(roles.allowance ?? [])].filter((c): c is number => c != null);
  const rows = table.rows.map((r) => {
    const any = earn.some((c) => num(r[c]) !== null);
    return [...r, any ? r2(earn.reduce((s, c) => s + (num(r[c]) ?? 0), 0)) : null] as Cell[];
  });
  return { table: { ...table, headers: [...table.headers, 'Gross Wages (calculated)'], rows }, added: true };
}
