/**
 * populate/validate.ts — row- and column-level data-quality checks on the populated master.
 */
import { F, KEY_BY_COL, type FieldKey } from './fields.js';
import {
  type Val, isBlank, parseDate, parseNum, normAadhaar, normPan, normUan, normIfsc, normMobile,
  normGender, normYesNo, isEmail, ageOn, isYes,
} from './normalize.js';
import { colLetter } from './rules.js';

export type Severity = 'error' | 'warn' | 'info';
export interface Issue {
  severity: Severity; code: string; row: number | null; employee: string;
  col: number | null; field: string; message: string;
}
export interface RowData { rowNumber: number; data: Map<number, Val> }

const get = (r: RowData, k: FieldKey): Val => r.data.get(F[k].col) ?? null;
const first = (r: RowData, ...ks: FieldKey[]): Val => { for (const k of ks) if (!isBlank(get(r, k))) return get(r, k); return null; };
export const employeeLabel = (r: RowData): string =>
  String(first(r, 'employeeCode', 'fullName') ?? `row ${r.rowNumber}`);

export function validateRows(rows: RowData[], asOf: Date, headers: string[]): Issue[] {
  const issues: Issue[] = [];
  const add = (r: RowData, severity: Severity, code: string, k: FieldKey | null, message: string) =>
    issues.push({ severity, code, row: r.rowNumber, employee: employeeLabel(r), col: k ? F[k].col : null,
      field: k ? `${colLetter(F[k].col)} ${F[k].h}` : '', message });

  const seen: Record<string, Map<string, RowData>> = { code: new Map(), uan: new Map(), aadhaar: new Map(), pan: new Map(), bank: new Map() };
  const dup = (bucket: string, value: string, r: RowData, k: FieldKey, label: string) => {
    if (!value) return;
    const prev = seen[bucket].get(value);
    if (prev) add(r, 'error', `DUP_${bucket.toUpperCase()}`, k, `${label} ${value} is also used by ${employeeLabel(prev)} (row ${prev.rowNumber})`);
    else seen[bucket].set(value, r);
  };

  for (const r of rows) {
    const check = (k: FieldKey, code: string, p: { valid: boolean; reason?: string; value: string | null }) => {
      if (!isBlank(get(r, k)) && !p.valid) add(r, 'error', code, k, p.reason ?? 'invalid value');
    };
    check('aadhaarA', 'AADHAAR_INVALID', normAadhaar(get(r, 'aadhaarA')));
    check('aadhaarB', 'AADHAAR_INVALID', normAadhaar(get(r, 'aadhaarB')));
    check('panA', 'PAN_INVALID', normPan(get(r, 'panA')));
    check('panB', 'PAN_INVALID', normPan(get(r, 'panB')));
    check('uan', 'UAN_INVALID', normUan(get(r, 'uan')));
    check('ifsc', 'IFSC_INVALID', normIfsc(get(r, 'ifsc')));
    check('mobile', 'MOBILE_INVALID', normMobile(get(r, 'mobile')));
    check('genderA', 'GENDER_INVALID', normGender(get(r, 'genderA')));
    check('genderB', 'GENDER_INVALID', normGender(get(r, 'genderB')));
    if (!isBlank(get(r, 'personalEmail')) && !isEmail(get(r, 'personalEmail'))) add(r, 'warn', 'EMAIL_INVALID', 'personalEmail', 'not a valid email address');

    dup('code', String(get(r, 'employeeCode') ?? '').trim(), r, 'employeeCode', 'Employee code');
    dup('uan', String(get(r, 'uan') ?? ''), r, 'uan', 'UAN');
    dup('aadhaar', String(first(r, 'aadhaarB', 'aadhaarA') ?? ''), r, 'aadhaarB', 'Aadhaar');
    dup('pan', String(first(r, 'panB', 'panA') ?? ''), r, 'panB', 'PAN');
    dup('bank', `${String(get(r, 'ifsc') ?? '')}|${String(get(r, 'bankAccount') ?? '')}`.replace(/^\|$/, ''), r, 'bankAccount', 'Bank account');

    const apprentice = isYes(get(r, 'isApprentice'));
    const dob = parseDate(first(r, 'dobB', 'dobA'));
    const doj = parseDate(first(r, 'dojC', 'dojB', 'dojA', 'employedFrom'));
    const dot = parseDate(first(r, 'dateOfTermA', 'dateOfTermB'));
    if (dob) {
      const age = ageOn(dob, asOf);
      if (age < 14) add(r, 'error', 'CHILD_LABOUR', 'dobB', `age ${age} — below the minimum employment age of 14`);
      else if (age < 18 && !apprentice) add(r, 'warn', 'ADOLESCENT', 'dobB', `age ${age} — adolescent worker rules apply (Factories Act / CLRA)`);
      else if (age > 75) add(r, 'warn', 'AGE_IMPLAUSIBLE', 'dobB', `age ${age} looks implausible`);
      if (doj && ageOn(dob, doj) < 14) add(r, 'error', 'DOJ_BEFORE_14', 'dojC', 'joined before turning 14');
    }
    if (doj && doj.getTime() > asOf.getTime()) add(r, 'warn', 'DOJ_FUTURE', 'dojC', 'date of joining is after the payroll month end');
    if (doj && dot && dot.getTime() < doj.getTime()) add(r, 'error', 'EXIT_BEFORE_JOIN', 'dateOfTermA', 'exit date is before joining date');

    for (const k of ['basic', 'gross', 'net', 'otAmount', 'epfContri', 'totalDeduction'] as FieldKey[]) {
      const n = parseNum(get(r, k));
      if (n !== null && n < 0) add(r, 'error', 'NEGATIVE_AMOUNT', k, `negative amount ${n}`);
    }
    const basic = parseNum(get(r, 'basic')); const gross = parseNum(get(r, 'gross'));
    if (basic !== null && gross !== null && gross + 0.01 < basic) add(r, 'error', 'GROSS_LT_BASIC', 'gross', `gross ${gross} is less than basic ${basic}`);
    const net = parseNum(get(r, 'net'));
    if (net !== null && gross !== null && net > gross + 0.01) add(r, 'error', 'NET_GT_GROSS', 'net', `net ${net} exceeds gross ${gross}`);
  }

  // Column-level: does the content of a typed column look like its header says?
  // This is how a column whose data has shifted (e.g. marital status under a DOB header) is caught.
  const maxCol = headers.length;
  for (let col = 1; col <= maxCol; col += 1) {
    const key = KEY_BY_COL.get(col);
    const header = headers[col - 1] ?? '';
    const type = key ? F[key].t : (/^date\b|\bdate of birth\b|\bdob\b/i.test(header) && !/\b(no\.?|number|time|and date)\b/i.test(header) ? 'date' : null);
    if (!type || !['date', 'num', 'bool'].includes(type)) continue;
    const vals = rows.map((r) => r.data.get(col) ?? null).filter((v) => !isBlank(v));
    if (vals.length < 3) continue;
    const bad = vals.filter((v) =>
      type === 'date' ? parseDate(v) === null : type === 'num' ? parseNum(v) === null : !normYesNo(v).valid);
    if (bad.length / vals.length >= 0.5) {
      issues.push({
        severity: 'error', code: 'COLUMN_TYPE_MISMATCH', row: null, employee: '', col,
        field: `${colLetter(col)} ${header}`,
        message: `${bad.length}/${vals.length} values are not valid ${type} values (e.g. ${bad.slice(0, 3).map((v) => `"${String(v)}"`).join(', ')}) — data may be shifted into the wrong column`,
      });
    }
  }
  return issues;
}
