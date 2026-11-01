/**
 * populate/normalize.ts
 *
 * Pure parsing / validation helpers. No ExcelJS, no I/O.
 * All dates are handled as UTC midnight (ExcelJS reads/writes dates as UTC), so results
 * do not shift by a day on servers that are not in UTC.
 */

export type Val = string | number | boolean | Date | null;

export const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ||
  (typeof v === 'number' && Number.isNaN(v));

// ─── Numbers ─────────────────────────────────────────────────────────────────

export function parseNum(v: unknown): number | null {
  if (isBlank(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean' || v instanceof Date) return null;
  let s = String(v).trim();
  if (/^[-–—]+$/.test(s)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[₹,\s]|^rs\.?/gi, '').replace(/%$/, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
/** Round to nearest rupee, .5 rounds up (EPFO convention). */
export const roundRupee = (n: number): number => Math.floor(Number(n.toFixed(4)) + 0.5);
/** Round UP to next rupee (ESIC convention). Guards float noise such as 111.00000000000001. */
export const ceilRupee = (n: number): number => Math.ceil(Number(n.toFixed(2)));

// ─── Dates ───────────────────────────────────────────────────────────────────

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthIdx = (s: string): number => MONTHS.indexOf(s.slice(0, 3).toLowerCase());

export const utcDate = (y: number, m0: number, d: number): Date => new Date(Date.UTC(y, m0, d));

function validYMD(y: number, m0: number, d: number): Date | null {
  if (y < 1900 || y > 2200 || m0 < 0 || m0 > 11 || d < 1 || d > 31) return null;
  const dt = utcDate(y, m0, d);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m0 && dt.getUTCDate() === d ? dt : null;
}

function fullYear(yy: number): number {
  if (yy >= 100) return yy;
  return yy <= 49 ? 2000 + yy : 1900 + yy;
}

/** Excel serial → UTC date. Accepts the 1900 date system only. */
export function serialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000) return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return Number.isNaN(d.getTime()) ? null : utcDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Parse a date from: Date, Excel serial, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD,
 * DD-Mon-YYYY, "Mon DD, YYYY". Day-first is assumed for ambiguous numeric strings (India).
 */
export function parseDate(v: unknown): Date | null {
  if (isBlank(v)) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : utcDate(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
  }
  if (typeof v === 'number') return v > 20000 ? serialToDate(v) : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  let m: RegExpMatchArray | null;

  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/))) {
    return validYMD(+m[1], +m[2] - 1, +m[3]);
  }
  if ((m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/))) {
    return validYMD(fullYear(+m[3]), +m[2] - 1, +m[1]);
  }
  if ((m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ,]*(\d{2,4})$/))) {
    const mi = monthIdx(m[2]);
    return mi < 0 ? null : validYMD(fullYear(+m[3]), mi, +m[1]);
  }
  if ((m = s.match(/^([A-Za-z]{3,9})[-/. ]+(\d{1,2}),?[-/. ]+(\d{2,4})$/))) {
    const mi = monthIdx(m[1]);
    return mi < 0 ? null : validYMD(fullYear(+m[3]), mi, +m[2]);
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return serialToDate(Number(s));
  return null;
}

export const formatDMY = (d: Date): string =>
  `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;

export const formatISO = (d: Date): string => d.toISOString().slice(0, 10);

export const daysInMonth = (y: number, m0: number): number => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

export function addYears(d: Date, years: number): Date {
  const y = d.getUTCFullYear() + years;
  const m = d.getUTCMonth();
  // 29-Feb + n years → 28-Feb when the target year is not a leap year
  return utcDate(y, m, Math.min(d.getUTCDate(), daysInMonth(y, m)));
}

/** Whole months from `a` to `b` (b ≥ a), counting a month only when the day-of-month has been reached. */
export function monthsBetween(a: Date, b: Date): number {
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export interface MonthInfo { year: number; month0: number; days: number; start: Date; end: Date }

export function monthInfo(y: number, m0: number): MonthInfo {
  const days = daysInMonth(y, m0);
  return { year: y, month0: m0, days, start: utcDate(y, m0, 1), end: utcDate(y, m0, days) };
}

/** Parse "Oct-2026", "October 2026", "10/2026", "2026-10", or any full date (its month is used). */
export function parseMonth(v: unknown): MonthInfo | null {
  if (isBlank(v)) return null;
  if (v instanceof Date || typeof v === 'number') {
    const d = parseDate(v);
    return d ? monthInfo(d.getUTCFullYear(), d.getUTCMonth()) : null;
  }
  const s = String(v).trim().replace(/\s+/g, ' ');
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^([A-Za-z]{3,9})[-/. ,']*(\d{2,4})$/))) {
    const mi = monthIdx(m[1]);
    if (mi >= 0) return monthInfo(fullYear(+m[2]), mi);
  }
  if ((m = s.match(/^(\d{1,2})[-/. ](\d{4})$/)) && +m[1] >= 1 && +m[1] <= 12) return monthInfo(+m[2], +m[1] - 1);
  if ((m = s.match(/^(\d{4})[-/. ](\d{1,2})$/)) && +m[2] >= 1 && +m[2] <= 12) return monthInfo(+m[1], +m[2] - 1);
  const d = parseDate(s);
  return d ? monthInfo(d.getUTCFullYear(), d.getUTCMonth()) : null;
}

// ─── Identity documents ──────────────────────────────────────────────────────

export const digitsOnly = (v: unknown): string => String(v ?? '').replace(/\D+/g, '');

// Verhoeff tables (UIDAI uses this checksum for Aadhaar)
const VD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
export function verhoeffValid(num: string): boolean {
  let c = 0;
  const rev = num.split('').reverse().map(Number);
  for (let i = 0; i < rev.length; i += 1) c = VD[c][VP[i % 8][rev[i]]];
  return c === 0;
}
/** Generate a Verhoeff check digit (used only to build valid test fixtures). */
export function verhoeffCheckDigit(base: string): string {
  const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];
  let c = 0;
  const rev = base.split('').reverse().map(Number);
  for (let i = 0; i < rev.length; i += 1) c = VD[c][VP[(i + 1) % 8][rev[i]]];
  return String(INV[c]);
}

export interface Parsed<T> { value: T | null; valid: boolean; reason?: string }

export function normAadhaar(v: unknown): Parsed<string> {
  const d = digitsOnly(v);
  if (!d) return { value: null, valid: false };
  if (d.length !== 12) return { value: d, valid: false, reason: `Aadhaar must be 12 digits (found ${d.length})` };
  if (/^[01]/.test(d)) return { value: d, valid: false, reason: 'Aadhaar cannot start with 0 or 1' };
  if (!verhoeffValid(d)) return { value: d, valid: false, reason: 'Aadhaar checksum (Verhoeff) failed' };
  return { value: d, valid: true };
}

export function normPan(v: unknown): Parsed<string> {
  const s = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return { value: null, valid: false };
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(s)
    ? { value: s, valid: true }
    : { value: s, valid: false, reason: 'PAN must look like ABCDE1234F' };
}

export function normUan(v: unknown): Parsed<string> {
  const d = digitsOnly(v);
  if (!d) return { value: null, valid: false };
  return d.length === 12 ? { value: d, valid: true } : { value: d, valid: false, reason: `UAN must be 12 digits (found ${d.length})` };
}

export function normIfsc(v: unknown): Parsed<string> {
  const s = String(v ?? '').toUpperCase().replace(/\s+/g, '');
  if (!s) return { value: null, valid: false };
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(s)
    ? { value: s, valid: true }
    : { value: s, valid: false, reason: 'IFSC must be 4 letters + 0 + 6 alphanumerics' };
}

export function normMobile(v: unknown): Parsed<string> {
  let d = digitsOnly(v);
  if (!d) return { value: null, valid: false };
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d)
    ? { value: d, valid: true }
    : { value: d, valid: false, reason: 'Mobile must be a 10-digit Indian number starting 6-9' };
}

export const isEmail = (v: unknown): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());

export function normGender(v: unknown): Parsed<string> {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return { value: null, valid: false };
  if (['m', 'male', 'man', 'boy'].includes(s)) return { value: 'Male', valid: true };
  if (['f', 'female', 'woman', 'girl'].includes(s)) return { value: 'Female', valid: true };
  if (['t', 'o', 'other', 'others', 'transgender', 'third gender', 'tg'].includes(s)) return { value: 'Other', valid: true };
  return { value: String(v).trim(), valid: false, reason: `Unrecognised gender "${String(v).trim()}"` };
}

export function normYesNo(v: unknown): Parsed<string> {
  if (typeof v === 'boolean') return { value: v ? 'Yes' : 'No', valid: true };
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return { value: null, valid: false };
  if (['y', 'yes', 'true', '1', 'applicable'].includes(s)) return { value: 'Yes', valid: true };
  if (['n', 'no', 'false', '0', 'na', 'n/a', 'not applicable'].includes(s)) return { value: 'No', valid: true };
  return { value: String(v).trim(), valid: false, reason: `Expected Yes/No, found "${String(v).trim()}"` };
}

export const isYes = (v: unknown): boolean => normYesNo(v).value === 'Yes' && normYesNo(v).valid;

// ─── Attendance codes ────────────────────────────────────────────────────────

export type AttendanceClass = 'P' | 'HD' | 'A' | 'WO' | 'H' | 'PL' | 'LWP' | 'OT' | 'UNK';

const ATT: Record<string, AttendanceClass> = {
  P: 'P', PRESENT: 'P', '1': 'P', '1.0': 'P',
  HD: 'HD', 'H/D': 'HD', HALF: 'HD', HALFDAY: 'HD', '0.5': 'HD', 'P/2': 'HD', 'P/A': 'HD', 'A/P': 'HD', '½': 'HD',
  A: 'A', AB: 'A', ABS: 'A', ABSENT: 'A', '0': 'A', '0.0': 'A',
  WO: 'WO', 'W/O': 'WO', WOFF: 'WO', OFF: 'WO', W: 'WO', SUN: 'WO',
  H: 'H', PH: 'H', NFH: 'H', NH: 'H', FH: 'H', HOL: 'H', HOLIDAY: 'H',
  L: 'PL', CL: 'PL', SL: 'PL', EL: 'PL', PL: 'PL', ML: 'PL', CO: 'PL', LV: 'PL', LEAVE: 'PL',
  LWP: 'LWP', LOP: 'LWP', UL: 'LWP', UPL: 'LWP',
  OT: 'OT', 'P+OT': 'OT', POT: 'OT', 'P/OT': 'OT',
};

/** null = cell is empty (not recorded). */
export function classifyAttendance(v: unknown): AttendanceClass | null {
  if (isBlank(v)) return null;
  const key = (typeof v === 'number' ? String(v) : String(v)).trim().toUpperCase().replace(/\s+/g, '');
  return ATT[key] ?? 'UNK';
}
