/**
 * populate/ingest.ts
 *
 * Reads a source file (payroll / HRMS / attendance export, .xlsx or .csv) and maps its
 * columns onto master columns. Mapping order per source header:
 *   1. explicit  — caller-supplied { "Source header": "AB" | 28 }
 *   2. alias     — curated dictionary of common payroll header names
 *   3. exact     — identical (normalised) to a master header
 *   4. fuzzy     — token similarity ≥ cfg.fuzzyThreshold; weaker ones are only suggested
 *   5. day       — bare 1..31 / D1..D31 headers → attendance columns EN:FR
 */

import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { F, normHeader, dayCol, type FieldKey } from './fields.js';
import { type Val, isBlank } from './normalize.js';

export interface SourceTable {
  name: string;
  headerRow: number;
  headers: string[];
  rows: Record<string, Val>[];
}

export type MatchMethod = 'explicit' | 'alias' | 'exact' | 'fuzzy' | 'day' | 'none';
export interface ColumnMatch {
  source: string;
  col: number | null;
  method: MatchMethod;
  confidence: number;
  suggestion?: { col: number; header: string; confidence: number };
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export function cellVal(v: ExcelJS.CellValue): Val {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>;
    if ('result' in o) return cellVal(o.result as ExcelJS.CellValue);
    if (Array.isArray(o.richText)) return (o.richText as { text?: string }[]).map((t) => t.text ?? '').join('');
    if (typeof o.text === 'string') return o.text;
    if ('error' in o) return null;
    return null;
  }
  return v as Val;
}

export async function readSource(buffer: Buffer, fileName: string): Promise<SourceTable[]> {
  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(fileName)) await wb.csv.read(Readable.from(buffer));
  else await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const tables: SourceTable[] = [];
  for (const ws of wb.worksheets) {
    // header row = row with most text cells in the first 15 rows
    let best = 0; let bestScore = 0;
    for (let r = 1; r <= Math.min(15, ws.rowCount); r += 1) {
      let score = 0;
      ws.getRow(r).eachCell({ includeEmpty: false }, (c) => { if (typeof cellVal(c.value) === 'string') score += 1; });
      if (score > bestScore) { best = r; bestScore = score; }
    }
    if (best === 0 || bestScore < 2) continue;

    const headerRow = ws.getRow(best);
    const headers: string[] = [];
    for (let c = 1; c <= ws.columnCount; c += 1) {
      const v = cellVal(headerRow.getCell(c).value);
      headers.push(isBlank(v) ? '' : String(v).replace(/\s+/g, ' ').trim());
    }
    const rows: Record<string, Val>[] = [];
    for (let r = best + 1; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const obj: Record<string, Val> = {};
      let any = false;
      headers.forEach((h, i) => {
        if (!h) return;
        const v = cellVal(row.getCell(i + 1).value);
        obj[h] = v;
        if (!isBlank(v)) any = true;
      });
      if (any) rows.push(obj);
    }
    if (rows.length) tables.push({ name: ws.name, headerRow: best, headers: headers.filter(Boolean), rows });
  }
  return tables;
}

// ─── Alias dictionary (normalised source header → registry key) ──────────────

const ALIASES: Record<string, FieldKey> = {};
const alias = (key: FieldKey, ...names: string[]) => { for (const n of names) ALIASES[normHeader(n)] = key; };

alias('employeeCode', 'emp code', 'employee code', 'emp id', 'employee id', 'employee no', 'emp no', 'ecode', 'code', 'staff id', 'worker code');
alias('fullName', 'name', 'employee name', 'emp name', 'full name', 'name of employee', 'name of workman', 'worker name', 'workman name');
alias('uan', 'uan', 'uan no', 'uan number', 'pf uan');
alias('pfMemberId', 'pf no', 'pf number', 'pf account no', 'pf member id', 'epf no', 'pf a/c no');
alias('esicIpA', 'esic no', 'esi no', 'esic ip', 'esic ip no', 'esic number', 'esi number', 'ip number', 'ip no');
alias('aadhaarB', 'aadhaar', 'aadhar', 'aadhaar no', 'aadhaar number', 'aadhar no', 'aadhar number', 'uid');
alias('panB', 'pan', 'pan no', 'pan number');
alias('genderB', 'gender', 'sex');
alias('dobB', 'dob', 'date of birth', 'birth date', 'd o b');
alias('dojC', 'doj', 'date of joining', 'joining date', 'date of join', 'd o j');
alias('dateOfTermA', 'dol', 'date of leaving', 'leaving date', 'date of exit', 'last working day', 'resignation date', 'date of resignation');
alias('designation', 'designation', 'position', 'job title', 'trade', 'skill', 'grade');
alias('department', 'department', 'dept', 'division');
alias('workLocation', 'location', 'work location', 'site', 'unit', 'branch');
alias('mobile', 'mobile', 'mobile no', 'mobile number', 'phone', 'contact no', 'contact number', 'cell no');
alias('personalEmail', 'email', 'email id', 'e mail', 'personal email');
alias('bankName', 'bank', 'bank name');
alias('bankAccount', 'bank account', 'bank account no', 'bank account number', 'account no', 'account number', 'a/c no', 'ac no', 'acc no');
alias('ifsc', 'ifsc', 'ifsc code', 'ifs code');
alias('state', 'state', 'work state');
alias('monthOf', 'month', 'pay month', 'payroll month', 'salary month', 'for the month of', 'period', 'wage period');
alias('basic', 'basic', 'basic pay', 'basic salary', 'basic wage', 'basic wages', 'basic earned');
alias('da', 'da', 'd a', 'dearness allowance');
alias('vda', 'vda', 'v d a', 'variable dearness allowance');
alias('hra', 'hra', 'house rent allowance');
alias('medical', 'medical', 'medical allowance', 'med allowance');
alias('conveyance', 'conveyance', 'conveyance allowance', 'transport allowance', 'travel allowance');
alias('specialAllow', 'special allowance', 'special allow', 'other allowance', 'other allowances', 'spl allowance');
alias('othersAllow', 'others allowance');
alias('additionalComp', 'additional component', 'additional salary component');
alias('nightAllowance', 'night allowance', 'night shift allowance', 'nsa');
alias('gross', 'gross', 'gross pay', 'gross salary', 'gross wages', 'total earnings', 'gross earnings');
alias('net', 'net', 'net pay', 'net salary', 'net wages', 'take home');
alias('netPaid', 'net payable', 'amount paid', 'net amount paid', 'net payment');
alias('dailyRate', 'daily rate', 'rate per day', 'per day rate', 'daily wage');
alias('epfContri', 'pf', 'epf', 'employee pf', 'pf employee', 'pf deduction', 'epf employee', 'employee epf');
alias('esicEmployee', 'esi', 'esic', 'employee esi', 'esi employee', 'esic employee', 'esi deduction');
alias('esicEmployer', 'employer esi', 'esi employer', 'esic employer');
alias('ptAmount', 'pt', 'professional tax', 'prof tax', 'p tax');
alias('employeeLwf', 'lwf', 'employee lwf', 'lwf employee', 'labour welfare fund');
alias('tds', 'tds', 'income tax', 'tax deducted');
alias('advanceRefund', 'advance', 'advance recovery', 'advance deduction', 'loan recovery');
alias('otherDeduction', 'other deduction', 'other deductions');
alias('totalDeduction', 'total deduction', 'total deductions', 'deductions');
alias('otWeek1', 'ot hours week 1');
alias('totalOtHours', 'ot hours', 'overtime hours', 'ot hrs', 'total ot hours', 'total overtime hours');
alias('otAmount', 'ot amount', 'overtime amount', 'ot pay', 'overtime pay');
alias('presentDays', 'present days', 'days present', 'present', 'total present');
alias('absentDays', 'absent days', 'days absent', 'absent', 'total absent');
alias('woHolidayDays', 'week off', 'weekly off', 'wo', 'week offs', 'holidays');
alias('lwpDays', 'lwp', 'lwp days', 'lop', 'lop days', 'leave without pay');
alias('ncpDays', 'ncp days', 'ncp');
alias('daysWorkedA', 'days worked', 'worked days', 'paid days', 'total days worked', 'no of days worked');
alias('stipend', 'stipend', 'stipend amount');
alias('isApprentice', 'apprentice', 'is apprentice');
alias('employeeStatus', 'status', 'employee status');
alias('contractorA', 'contractor', 'contractor name', 'vendor name', 'agency');
alias('principalA', 'principal employer', 'principal employer name', 'client name', 'company name');
alias('minWage', 'minimum wage', 'min wage', 'applicable minimum wage');

// ─── Matching ────────────────────────────────────────────────────────────────

const tokens = (s: string): Set<string> => new Set(normHeader(s).split(' ').filter((w) => w.length > 1));

function similarity(a: string, b: string): number {
  const ta = tokens(a); const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const jaccard = inter / new Set([...ta, ...tb]).size;
  const containment = inter / Math.min(ta.size, tb.size);
  return Math.max(jaccard, inter >= 2 ? containment * 0.9 : 0);
}

function dayNumber(h: string): number | null {
  const m = h.trim().match(/^(?:d|day)?[\s-]*0?(\d{1,2})(?:\.0)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 31 ? n : null;
}

export function colFromRef(ref: string | number): number | null {
  if (typeof ref === 'number') return ref >= 1 && ref <= 700 ? ref : null;
  if (/^\d+$/.test(ref.trim())) return colFromRef(Number(ref));
  const s = ref.trim().toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(s)) return null;
  let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64;
  return n >= 1 && n <= 700 ? n : null;
}

export function matchColumns(
  sourceHeaders: string[],
  masterHeaders: string[], // index 0 = column 1
  explicit: Record<string, string | number> = {},
  fuzzyThreshold = 0.85,
): ColumnMatch[] {
  const masterNorm = masterHeaders.map(normHeader);
  const explicitNorm = new Map(Object.entries(explicit).map(([k, v]) => [normHeader(k), v]));
  const dayHeaders = sourceHeaders.filter((h) => dayNumber(h) !== null);
  const treatDays = dayHeaders.length >= 20; // a real attendance matrix, not a stray "1"

  const out: ColumnMatch[] = sourceHeaders.map((source): ColumnMatch => {
    const n = normHeader(source);
    const ex = explicitNorm.get(n);
    if (ex !== undefined) {
      const col = colFromRef(ex);
      if (col) return { source, col, method: 'explicit', confidence: 1 };
    }
    if (treatDays) {
      const d = dayNumber(source);
      if (d !== null) return { source, col: dayCol(d), method: 'day', confidence: 1 };
    }
    const key = ALIASES[n];
    if (key) return { source, col: F[key].col, method: 'alias', confidence: 0.95 };

    const exact = masterNorm.indexOf(n);
    if (exact >= 0 && n) return { source, col: exact + 1, method: 'exact', confidence: 1 };

    let bestCol = -1; let best = 0;
    masterNorm.forEach((mh, i) => {
      if (!mh || /^\d+$/.test(mh)) return;
      const s = similarity(n, mh);
      if (s > best) { best = s; bestCol = i + 1; }
    });
    if (bestCol > 0 && best >= fuzzyThreshold) return { source, col: bestCol, method: 'fuzzy', confidence: Number(best.toFixed(2)) };
    const base: ColumnMatch = { source, col: null, method: 'none', confidence: 0 };
    if (bestCol > 0 && best >= 0.5) {
      base.suggestion = { col: bestCol, header: masterHeaders[bestCol - 1], confidence: Number(best.toFixed(2)) };
    }
    return base;
  });

  // One source column per master column: keep the most confident, demote the rest.
  const winner = new Map<number, ColumnMatch>();
  for (const m of out) {
    if (m.col === null) continue;
    const cur = winner.get(m.col);
    if (!cur || m.confidence > cur.confidence) winner.set(m.col, m);
  }
  for (const m of out) {
    if (m.col !== null && winner.get(m.col) !== m) {
      m.suggestion = { col: m.col, header: masterHeaders[m.col - 1], confidence: m.confidence };
      m.col = null; m.method = 'none'; m.confidence = 0;
    }
  }
  return out;
}
