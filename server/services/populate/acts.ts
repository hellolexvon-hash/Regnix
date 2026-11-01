/**
 * populate/acts.ts — which master columns each Act's registers need, so the gap report can say
 * which Acts a blank blocks. PROVISIONAL for every Act except CLRA: derived from masterColumns.ts
 * and the register names, because the other Acts' mapping.ts files were not supplied.
 */
import { F, type FieldKey } from './fields.js';

export interface Requirement { label: string; anyOf: number[] }
export interface ActSpec { act: string; provisional: boolean; requirements: Requirement[] }

const k = (...keys: FieldKey[]): number[] => keys.map((x) => F[x].col);
const r = (label: string, anyOf: number[]): Requirement => ({ label, anyOf });
const NAME = r('Employee name', [401, 101]);
const DAYS = r('Daily attendance', [144]);

export const ACTS: ActSpec[] = [
  { act: 'CLRA 1970', provisional: false, requirements: [
    NAME, r('Employee code', k('employeeCode')), r('Date of birth', k('dobB', 'dobA')),
    r('Gender', k('genderA', 'genderB')), r('Date of joining', k('dojC', 'dojB', 'dojA')),
    r('Designation', k('designation')), r('Permanent address', [452]), r('Principal employer', k('principalA')),
    DAYS, r('Days present', k('presentDays')), r('Basic wage', k('basic')), r('Gross salary', k('gross')),
    r('Total deduction', k('totalDeduction')), r('Net payments', k('netPaid')),
    r('UAN', k('uan')), r('EPF wages', k('epfWages')), r('EPF 12%', k('epfContri')), r('EPS 8.33%', k('epsContri')),
    r('Bonus calc', k('bonusCalc')), r('Gratuity date', k('gratuityDateA')), r('State', k('state')),
    r('PT amount', k('ptAmount')), r('Employee LWF', k('employeeLwf')),
  ] },
  { act: 'Code on Wages', provisional: true, requirements: [
    NAME, r('Employee code', k('employeeCode')), DAYS, r('Days present', k('presentDays')),
    r('Days absent', k('absentDays')), r('Week-offs/holidays', k('woHolidayDays')), r('Total OT hours', k('totalOtHours')),
    r('Basic wage', k('basic')), r('Gross salary', k('gross')), r('Total deduction', k('totalDeduction')),
    r('Net payments', k('netPaid')), r('Bank account', k('bankAccount')), r('OT rate', k('otRate')),
  ] },
  { act: 'Factories Act 1948', provisional: true, requirements: [
    NAME, r('Age', k('age')), r('Gender', k('genderA', 'genderB')), r('Date of joining', k('dojC', 'dojB', 'dojA')),
    r('Designation', k('designation')), DAYS, r('Days present', k('presentDays')),
    r('Total OT hours', k('totalOtHours')), r('OT rate', k('otRate')), r('OT amount', k('otAmount')),
  ] },
  { act: 'Shops & Establishments', provisional: true, requirements: [
    NAME, r('Employee code', k('employeeCode')), r('Designation', k('designation')),
    r('Date of joining', k('dojC', 'dojB', 'dojA')), DAYS, r('Days present', k('presentDays')),
    r('Basic wage', k('basic')), r('Gross salary', k('gross')), r('Net payments', k('netPaid')), r('State', k('state')),
  ] },
  { act: 'Apprentices Act 1961', provisional: true, requirements: [
    NAME, r('Apprentice flag', k('isApprentice')), r('Trade', [487]), r('Stipend', k('stipend')),
    r('Contract date', [323]), r('Contract expiry', [324]), r('Earned stipend', k('appEarnedStipend')),
    r('Net stipend', k('appNetStipend')), r('Apprenticeship from', [467]), r('Apprenticeship to', [468]),
  ] },
];
