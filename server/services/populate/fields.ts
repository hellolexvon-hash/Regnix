/**
 * populate/fields.ts
 *
 * Typed registry of every master column the populate engine reads or writes.
 *
 * Unlike MASTER_COLUMNS (bare numbers), each entry also carries the header text it
 * EXPECTS to find in that column. `verifySchema()` compares that against the real
 * template at load time, so a moved/renamed column fails loudly instead of silently
 * filling the wrong field.
 */

export type FieldType = 'text' | 'id' | 'date' | 'num' | 'bool' | 'gender';

export interface FieldDef {
  col: number;
  /** Text that must appear (case/spacing-insensitive) in the header of `col`. */
  h: string;
  t: FieldType;
}

const f = (col: number, h: string, t: FieldType = 'text'): FieldDef => ({ col, h, t });

export const F = {
  // ── identification ────────────────────────────────────────────────────────
  slNo:            f(1,   'Sl.no'),
  employeeCode:    f(9,   'Employee code', 'id'),
  workmanSlNo:     f(10,  'Workman sl'),
  serialWorkmenA:  f(11,  'Serial number in the register of workmen employed'),
  serialWorkmenB:  f(12,  'Serial No.in the register of workmen'),
  uan:             f(13,  'UAN Number', 'id'),
  esicIpA:         f(16,  'ESIC IP no', 'id'),
  esicIpB:         f(17,  'IP Number (ESIC)', 'id'),
  regnixId:        f(20,  'Regnix Employee ID', 'id'),
  esicIpC:         f(21,  'ESIC IP Number', 'id'),

  // ── contractor / principal employer (same fact, several columns) ──────────
  contractorA:     f(28,  'Name and address of contractor'),
  contractorB:     f(29,  'Name and address of the contractor'),
  principalA:      f(30,  'Name and address of the principal employer'),
  contractorC:     f(32,  'Name and Address of Contractor / Postal address'),
  contractorD:     f(391, 'Contractor Name and address of the establishment registered'),
  principalB:      f(392, 'Name of the principal employer and his address'),
  contractorE:     f(397, 'Name and Address of the establishment Contractor'),

  // ── employment ────────────────────────────────────────────────────────────
  natureEmpA:      f(42,  'Nature of Employment /designation'),
  dojA:            f(43,  'Date of commence', 'date'),
  natureEmpB:      f(44,  'Nature of employment/designation'),
  department:      f(46,  'Department'),
  designation:     f(47,  'Designation'),
  workLocation:    f(48,  'Work Location'),
  shiftType:       f(49,  'Shift Type'),
  minWage:         f(52,  'Applicable Minimum Wage', 'num'),
  locationUnit:    f(62,  'Location / Unit'),
  shift:           f(63,  'Shift'),
  dojB:            f(66,  'Date of entry into service', 'date'),

  // ── personal ──────────────────────────────────────────────────────────────
  aadhaarA:        f(76,  'Aadhaar card number employee', 'id'),
  panA:            f(77,  'Pan card details employee', 'id'),
  genderA:         f(80,  'Gender', 'gender'),
  dobA:            f(87,  'Date of Birth (DD-MM-YYYY)', 'date'),
  mobile:          f(94,  'Mobile Number', 'id'),
  altMobile:       f(95,  'Alternate Mobile Number', 'id'),
  personalEmail:   f(96,  'Personal Email ID'),
  officialEmail:   f(97,  'Official Email ID'),
  nomineeDobA:     f(98,  'Nominee DOB (PF)', 'date'),
  fullName:        f(101, 'Employee Full Name'),
  dobB:            f(104, 'Date of Birth', 'date'),
  aadhaarB:        f(105, 'Aadhaar Number', 'id'),
  panB:            f(106, 'PAN Number', 'id'),
  nomineeDobB:     f(108, 'Nominee DOB', 'date'),
  nomineeNameA:    f(131, 'Nominee Name (PF)'),
  nomineeRelA:     f(132, 'Nominee Relationship (PF)'),
  nomineeNameB:    f(137, 'Nominee Name'),
  nomineeRelB:     f(138, 'Nominee Relation'),

  // ── attendance / overtime ─────────────────────────────────────────────────
  monthOf:         f(175, 'For the month of'),
  otWeek1:         f(183, 'OT Hours Week 1', 'num'),
  otWeek2:         f(184, 'OT Hours Week 2', 'num'),
  otWeek3:         f(185, 'OT Hours Week 3', 'num'),
  otWeek4:         f(186, 'OT Hours Week 4', 'num'),
  otRate:          f(187, 'OT Rate', 'num'),
  dateOfTermA:     f(196, 'Date of termination of employment', 'date'),
  presentDays:     f(199, 'Total days Present', 'num'),
  absentDays:      f(200, 'Total days Absent', 'num'),
  woHolidayDays:   f(201, 'Total number of Week Offs', 'num'),
  otDays:          f(202, 'Overtime Days', 'num'),
  daysWorkedA:     f(203, 'No.of days worked', 'num'),
  dailyRate:       f(204, 'Daily rate of wages', 'num'),
  vda:             f(205, 'V.D.A', 'num'),
  nightAllowance:  f(206, 'Night Shift allowances', 'num'),
  otAmount:        f(207, 'Overtime Amount', 'num'),
  netPaid:         f(208, 'Net payments', 'num'),
  otHoursB:        f(224, 'Total overtime worked per hour', 'num'),
  normalRate:      f(225, 'Normal rate of wages', 'num'),
  otRateHr:        f(226, 'Overtime rate of', 'num'),
  otEarning:       f(227, 'Total Overtime earning', 'num'),

  // ── earnings ──────────────────────────────────────────────────────────────
  da:              f(229, 'D.A (DA)', 'num'),
  hra:             f(230, 'HRA', 'num'),
  medical:         f(231, 'Medical Allowance', 'num'),
  conveyance:      f(233, 'Conveyance Allowance', 'num'),
  specialAllow:    f(235, 'Special / Other Allowance', 'num'),
  additionalComp:  f(236, 'Additional Salary Component', 'num'),
  othersAllow:     f(335, 'Others Allowance', 'num'),
  basic:           f(284, 'Basic Wage', 'num'),

  // ── statutory (PF / ESIC / bonus / gratuity) ──────────────────────────────
  pfMemberId:      f(237, 'PF Member ID', 'id'),
  employerPf:      f(238, 'Employer PF', 'num'),
  age:             f(239, 'Employee Age', 'num'),
  totalEmployer:   f(240, 'Total Employer Contribution', 'num'),
  pfAdmin:         f(241, 'Employer PF admin charges', 'num'),
  esicEmployer:    f(242, 'ESIC Employer', 'num'),
  esicEmployee:    f(243, 'ESIC Employee', 'num'),
  bankName:        f(244, 'Bank Name'),
  totalDaysWorked: f(246, 'Total days worked', 'num'),
  employerLwf:     f(247, 'Employer LWF', 'num'),
  employeeLwf:     f(248, 'Employee LWF', 'num'),
  totalLwf:        f(249, 'Total LWF', 'num'),
  ptAmount:        f(251, 'PT amount', 'num'),
  ptFrequency:     f(253, 'PT payment monthly', 'text'),
  bonusCalc:       f(254, 'Bonus calculation', 'num'),
  bonusEligA:      f(255, 'Bonus eligibility', 'bool'),
  gratuityCalc:    f(256, 'Monthly Gratuity calculation', 'num'),
  gratuityElig:    f(257, 'Gratuity Eligibility', 'bool'),
  epfWages:        f(259, 'EPF wages', 'num'),
  epsWages:        f(260, 'EPS wages', 'num'),
  edliWages:       f(261, 'Employer EDLI wages', 'num'),
  epfContri:       f(262, 'EPF Contri remitted', 'num'),
  epsContri:       f(263, 'EPS Contri remitted', 'num'),
  epfEpsDiff:      f(264, 'EPF and EPS differences', 'num'),
  ncpDays:         f(265, 'NCP days', 'num'),
  advanceRefund:   f(266, 'Amount Refund of advances', 'num'),
  lastWorkingDay:  f(267, 'Last Working Day', 'date'),
  dojC:            f(270, 'EPF Date of Joining', 'date'),
  dateOfTermB:     f(271, 'EPF Date of Exit', 'date'),
  ctcAnnual:       f(272, 'CTC (Annual)', 'num'),
  gross:           f(273, 'Gross Salary (Monthly)', 'num'),
  net:             f(274, 'Net Salary (Monthly)', 'num'),
  lwpDays:         f(275, 'Leave Without Pay', 'num'),
  bankAccount:     f(276, 'Bank Account Number', 'id'),
  ifsc:            f(277, 'IFSC Code', 'id'),
  bonusPaidA:      f(279, 'Bonus Amount Paid', 'num'),
  gratuityDateA:   f(280, 'Date of Gratuity Eligibility', 'date'),
  gratuityPayable: f(281, 'Gratuity Amount Payable', 'num'),
  ctcB:            f(283, 'CTC', 'num'),
  bonusEligB:      f(286, 'Bonus Eligibility', 'bool'),
  bonusPaidB:      f(287, 'Bonus Paid', 'num'),
  gratuityDateB:   f(288, 'Gratuity Eligibility Date', 'date'),
  stipend:         f(290, 'Stipend Amount', 'num'),
  totalDeduction:  f(292, 'Total Deduction from salary', 'num'),
  otherDeduction:  f(310, 'Other deduction MW', 'num'),
  appEarnedStipend:f(325, 'Earned Stipend', 'num'),
  appDeductions:   f(327, 'Apprentices Deductions', 'num'),
  appNetStipend:   f(328, 'Apprentices Net Stipend', 'num'),
  societyDed:      f(336, 'Society Deduction', 'num'),
  insuranceDed:    f(337, 'Employee Insurance deduction', 'num'),
  medInsuranceDed: f(338, 'Medical Insurance deduction', 'num'),
  tds:             f(356, 'TDS Amount', 'num'),

  // ── compliance / status ───────────────────────────────────────────────────
  lwfFrequency:    f(417, 'LWF payment monthly'),
  lwfApplicable:   f(427, 'LWF Applicability', 'bool'),
  ptApplicable:    f(428, 'Professional Tax Applicability', 'bool'),
  totalOtHours:    f(440, 'Total Overtime Hours Worked', 'num'),
  state:           f(454, 'State'),
  employeeStatus:  f(463, 'Employee Status'),
  employedFrom:    f(465, 'Total period for Which employed From', 'date'),
  isApprentice:    f(485, 'Apprentice (Yes/No)', 'bool'),
  genderB:         f(516, 'Employee Gender', 'gender'),
  esicTotalA:      f(517, 'Total Member + Employer', 'num'),
  esicTotalB:      f(518, 'Total ESIC', 'num'),
} as const satisfies Record<string, FieldDef>;

export type FieldKey = keyof typeof F;

export const DAY_COL_FIRST = 144; // EN = day 1
export const DAY_COL_LAST  = 174; // FR = day 31
export const dayCol = (day1Based: number): number => DAY_COL_FIRST + day1Based - 1;

export const FIELD_KEYS = Object.keys(F) as FieldKey[];
export const colOf = (k: FieldKey): number => F[k].col;

/** Reverse lookup: master column number → registry key (if registered). */
export const KEY_BY_COL: ReadonlyMap<number, FieldKey> = new Map(
  FIELD_KEYS.map((k) => [F[k].col, k] as const),
);

// ─── Duplicate-column synonym groups ─────────────────────────────────────────
// The master carries the same fact in several columns because different statutory
// forms name it differently. When one is filled and its siblings are blank, copy it
// across. `keys` are ordered by priority (first non-blank wins).

export interface SyncGroup {
  name: string;
  keys: FieldKey[];
}

export const SYNC_GROUPS: readonly SyncGroup[] = [
  { name: 'Serial number',           keys: ['slNo', 'workmanSlNo', 'serialWorkmenA', 'serialWorkmenB'] },
  { name: 'UAN / ESIC IP',           keys: ['esicIpA', 'esicIpB', 'esicIpC'] },
  { name: 'Contractor name+address', keys: ['contractorA', 'contractorB', 'contractorC', 'contractorD', 'contractorE'] },
  { name: 'Principal employer',      keys: ['principalA', 'principalB'] },
  { name: 'Designation',             keys: ['designation', 'natureEmpA', 'natureEmpB'] },
  { name: 'Date of joining',         keys: ['dojC', 'dojB', 'dojA', 'employedFrom'] },
  { name: 'Date of exit',            keys: ['dateOfTermA', 'dateOfTermB', 'lastWorkingDay'] },
  { name: 'Work location',           keys: ['workLocation', 'locationUnit'] },
  { name: 'Shift',                   keys: ['shiftType', 'shift'] },
  { name: 'Aadhaar',                 keys: ['aadhaarA', 'aadhaarB'] },
  { name: 'PAN',                     keys: ['panA', 'panB'] },
  { name: 'Gender',                  keys: ['genderA', 'genderB'] },
  { name: 'Date of birth',           keys: ['dobB', 'dobA'] },
  { name: 'Nominee DOB',             keys: ['nomineeDobA', 'nomineeDobB'] },
  { name: 'Nominee name',            keys: ['nomineeNameA', 'nomineeNameB'] },
  { name: 'Nominee relation',        keys: ['nomineeRelA', 'nomineeRelB'] },
  { name: 'Days worked',             keys: ['totalDaysWorked', 'daysWorkedA'] },
  { name: 'Total OT hours',          keys: ['totalOtHours', 'otHoursB'] },
  { name: 'OT rate / hour',          keys: ['otRate', 'otRateHr'] },
  { name: 'OT amount',               keys: ['otAmount', 'otEarning'] },
  { name: 'Bonus eligibility',       keys: ['bonusEligA', 'bonusEligB'] },
  { name: 'Bonus paid',              keys: ['bonusPaidA', 'bonusPaidB'] },
  { name: 'Gratuity eligibility date', keys: ['gratuityDateA', 'gratuityDateB'] },
  { name: 'CTC',                     keys: ['ctcAnnual', 'ctcB'] },
  { name: 'ESIC total',              keys: ['esicTotalA', 'esicTotalB'] },
];

// ─── Schema verification ─────────────────────────────────────────────────────

export const normHeader = (s: unknown): string =>
  String(s ?? '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

export interface SchemaProblem { key: string; col: number; expected: string; actual: string }

/** Compare every registered field against the real header row (row 2 of the master). */
export function verifySchema(headerAt: (col: number) => string): SchemaProblem[] {
  const problems: SchemaProblem[] = [];
  for (const key of FIELD_KEYS) {
    const def = F[key];
    const actual = headerAt(def.col);
    if (!normHeader(actual).includes(normHeader(def.h))) {
      problems.push({ key, col: def.col, expected: def.h, actual });
    }
  }
  return problems;
}
