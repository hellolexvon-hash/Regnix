/**
 * shared/masterColumns.ts
 *
 * Full 500+ column master map from the Regnix Master Register workbook.
 *
 * HOW TO EDIT COLUMNS:
 * ─────────────────────────────────────────────────────────────────────
 * This file is the SINGLE SOURCE OF TRUTH for all master column numbers.
 *
 * Each number = the Excel column position in the Master Register sheet.
 * Example: employeeCode: 9  →  column I (9th column) in the master.
 *
 * To change where a field reads from, just change the number here.
 * Example: if "Basic Wage" moves to column 290, change basicWage: 284 → basicWage: 290
 *
 * ATTENDANCE_DAY_COLUMNS lists day-1 through day-31 column numbers in order.
 * ─────────────────────────────────────────────────────────────────────
 */

export const MASTER_COLUMNS = {
  // ── IDENTIFICATION ───────────────────────────────────────────────────────
  slNo:                        1,   // A  — Sl.no
  registrationNumber:          2,   // B  — Registration No. and date
  licenceNumber:               3,   // C  — Number and date of licence
  employeeCode:                9,   // I  — Employee code
  uanNumber:                   13,  // M  — UAN Number

  // ── EMPLOYEE INFO ────────────────────────────────────────────────────────
  employeeName:                401, // OK — Name of Employee / Workman
  designation:                 47,  // AU — Designation
  department:                  46,  // AT — Department
  tenureOfEmployment:          45,  // AS — Tenure of employment
  skillCategory:               64,  // BL — Skill Category
  ageAndSexGender:             74,  // BV — Age and sex / Gender
  employeeAge:                 239, // IE — Employee Age
  pfMemberId:                  237, // IC — PF Member ID
  dateOfEntryIntoService:      270, // JJ — EPF Date of joining / DOJ

  // ── ESTABLISHMENT ────────────────────────────────────────────────────────
  establishmentName:           391, // OA — Contractor Name / Establishment Name
  address:                     392, // OB — Principal Employer Address
  natureOfIndustry:            38,  // AL — Contractor's Nature / type of work  ← CORRECTED (was 394)

  // ── ATTENDANCE — DAILY (Day 1–31) ────────────────────────────────────────
  day1:  144, // EN
  day2:  145, // EO
  day3:  146, // EP
  day4:  147, // EQ
  day5:  148, // ER
  day6:  149, // ES
  day7:  150, // ET
  day8:  151, // EU
  day9:  152, // EV
  day10: 153, // EW
  day11: 154, // EX
  day12: 155, // EY
  day13: 156, // EZ
  day14: 157, // FA
  day15: 158, // FB
  day16: 159, // FC
  day17: 160, // FD
  day18: 161, // FE
  day19: 162, // FF
  day20: 163, // FG
  day21: 164, // FH
  day22: 165, // FI
  day23: 166, // FJ
  day24: 167, // FK
  day25: 168, // FL
  day26: 169, // FM
  day27: 170, // FN
  day28: 171, // FO
  day29: 172, // FP
  day30: 173, // FQ
  day31: 174, // FR

  // ── ATTENDANCE — TOTALS ──────────────────────────────────────────────────
  totalDaysWorked:             246, // IL — Total days worked
  totalDaysPresent:            199, // GQ — Total days Present         ← Form VI col 36
  totalDaysAbsent:             200, // GR — Total days Absent          ← Form VI col 37
  totalWeekOffsHolidaysLeaves: 201, // GS — Total number of Week Offs/Holidays/leaves ← Form VI col 38 (was misnamed "lwpDays")
  overtimeDaysCount:           202, // GT — Overtime Days
  lwpDays:                     275, // JO — Leave Without Pay (LWP) Days   ← FIXED (was 201; 201 is "Week Offs/Holidays/leaves", a different field)

  // ── PAYROLL / WAGES ──────────────────────────────────────────────────────
  basicWage:                   284, // JX — Basic Wage               ← CORRECTED (was wrong)
  da:                          229, // HU — D.A (DA)                 ← CORRECTED
  hra:                         230, // HV — HRA                      ← CORRECTED
  conveyanceAllowance:         233, // HY — Conveyance Allowance     ← CORRECTED
  specialAllowance:            235, // IA — Special / Other Allowance ← CORRECTED
  additionalSalaryComponent:   236, // IB — Additional Salary Component
  grossSalary:                 273, // JM — Gross Salary (Monthly)   ← CORRECTED
  netSalary:                   274, // JN — Net Salary (Monthly)     ← CORRECTED (was 275/208)
  netPaymentsAmountPaid:       208, // GZ — Net payments/ Amount paid  ← ADDED (distinct real field from netSalary; needed by musterRollCumWageRegister's actual template, confirmed via its embedded legend row)
  normalRateOfWages:           225, // HQ — Normal rate of wages
  dailyRateOfWages:            204, // GV — Daily rate of wages / piece rate ← Form III normalWage CORRECTED

  // ── OVERTIME ─────────────────────────────────────────────────────────────
  otRatePerHour:               187, // GE — OT Rate (₹/Hr) [2× Ordinary]
  otHoursWeek1:                183, // GA — OT Hours Week 1
  otHoursWeek2:                184, // GB — OT Hours Week 2
  otHoursWeek3:                185, // GC — OT Hours Week 3
  otHoursWeek4:                186, // GD — OT Hours Week 4
  totalOtHours:                440, // PX — Total Overtime Hours Worked  ← FIXED (was 190, which is generic "Total Hours worked", not OT-specific)
  otAmount:                    207, // GY — Overtime Amount
  otAmountFormIV:              227, // HS — Total Overtime Earning   ← Form IV OT col CORRECTED
  overtimeRemarks:             514, // ST — Register of Overtime Remarks

  // ── OT HOURS FOR MUSTER ROLL (Form VI col 39) ────────────────────────────
  otHoursMusterRoll:           440, // PX — Total Overtime Hours Worked (Form VI col 39) ← FIXED (was 275, which is "Leave Without Pay (LWP) Days" — an unrelated field)

  // ── DEDUCTIONS ───────────────────────────────────────────────────────────
  employeePf:                  262, // JB — EPF Contri remitted      ← CORRECTED (was 238)
  esicEmployee:                243, // II — ESIC Employee 0.75%      ← CORRECTED
  ptAmount:                    251, // IQ — PT amount
  advanceRefund:               266, // JF — Amount Refund of advances  ← FIXED (was 218, which is "Amount of advance given" — the initial advance, not the refund)
  otherDeduction:              310, // KX — Other deduction MW
  totalDeduction:              292, // KF — Total Deduction from salary

  // ── PAYMENT ──────────────────────────────────────────────────────────────
  dateOfPayment:               311, // KY — Date of payment or deduction
  bankName:                    244, // IJ — Bank Name
  bankAccountNumber:           276, // JP — Bank Account Number
  ifscCode:                    277, // JQ — IFSC Code

  // ── FINES (Form I) ───────────────────────────────────────────────────────
  dateOfOffence:               295, // KI — Date of Offence
  actOmissionForFine:          301, // KO — Act/Omission for which Fine Imposed
  dateOffenceNoticed:          299, // KM — Date on which Offence Noticed  ← CORRECTED (was 295)
  dateShowCauseNotice:         296, // KJ — Date of Show Cause Notice  ← FIXED (was 406/"PZ", which doesn't exist at that letter; col 406 is actually "Whether workmen showed cause against deduction", an unrelated Y/N field. Same source column as dateShowCauseDamage below — the master only has one Show Cause Notice date field.)
  dateFineOrder:               300, // KN — Date of Fine Order MW
  wagePeriodOfFine:            432, // PP — Wage Period of Fine MW
  amountOfFine:                215, // HG — Amount of fine imposed
  dateOfRecovery:              303, // KQ — Date of Recovery MW
  amountRecovered:             304, // KR — Amount Recovered Till Date     ← Form I col 14
  balancePending:              436, // PT — Balance Pending (₹) MW recovery
  finesRemarks:                217, // HI — Register of Fines Remarks

  // ── DEDUCTIONS FOR DAMAGE/LOSS (Form II) ─────────────────────────────────
  dateOfDamage:                210, // HB — Date of damage or loss
  natureOfDamage:              209, // HA — Nature/Particulars of damage or loss ← CORRECTED (was missing)
  estimatedDamage:             293, // KG — Estimated / Amount of Damage / Loss  ← CORRECTED (was missing)
  dateShowCauseDamage:         296, // KJ — Date of Show Cause Notice (Damage)   ← CORRECTED (was 296, still 296)
  replyReceived:               435, // PS — Reply Received MW
  dateOfOrder:                 305, // KS — Date of Order MW
  amountOrdered:               306, // KT — Amount Ordered (₹) Damages
  wagePeriodRecovery:          307, // KU — Wage Period of Recovery MW Damages   ← FIXED (was 304, which is "Amount Recovered Till Date" — swapped with amountRecoveredDamage below)
  amountRecoveredDamage:       304, // KR — Amount Recovered Till Date   ← FIXED (was 307, which is "Wage Period of Recovery" — swapped with wagePeriodRecovery above; same source col as amountRecovered in Fines section, master has one such field)
  cumulativeDeductedDamage:    308, // KV — Cumulative Deducted (₹) MW Damages
  pctWagesDeductedDamage:      309, // KW — % of Wages Deducted MW Damages
  damageRemarks:               213, // HE — Register of Deductions Remarks

  // ── MUSTER ROLL (Form VI) ─────────────────────────────────────────────────
  musterRollRemarks:           176, // FT — Muster Roll Remarks

  // ── MUSTER ROLL CUM WAGE REGISTER (Form II Muster) ───────────────────────
  workingAreaProject:          48,  // AV — Work Location  ← FLAGGED (was 400, which is "Principal Employer Nature of work done" — that's principalEmployerNatureOfWorkDone below, not a work area/project field. Best guess based on field name; please confirm against the actual Form II Muster template. Other candidates: col 34 AH "Location Contract Work", col 62 BJ "Location / Unit".)
  projectName:                 44,  // AR — Nature of employment/designation (used as Project name)
  endClientName:               525, // TE — Name of Employer / Proprietor (used as End Client)
  baseWorkLocation:             526, // TF — Address of Employer (used as base work location)
  medicalAllowance:            231, // HW — Medical Allowance
  leaveEncashment:             232, // HX — Leave Encashment
  nfh:                         414, // OX — NFH  (comment letter fixed, column unchanged)
  statutoryBonus:              234, // HZ — Statutory Bonus
  otherAllowances:             335, // LW — Others Allowance          ← CONFIRMED (was "???", now verified against reference)
  additionalComponent:         236, // IB — Additional Salary Component, If any  ← FIXED (was 336, which is "Society Deduction" — a deduction, not an addition; reused same col as additionalSalaryComponent)
  insuranceEE:                 337, // LY — Employee Insurance deduction  ← CONFIRMED (was "???", now verified against reference)
  employeeLwf:                 248, // IN — Employee LWF
  incomeTax:                   356, // MR — TDS Amount                ← FIXED (was 339, which is "Subsistance allowance if any" — completely unrelated field)
  // The following 6 fields have NO corresponding column in the master workbook —
  // the reference sheet only goes up to column 560 (UN). There is no "Govt Basic/DA/HRA/
  // Other/Total/Diff Actual vs Govt" wage comparison field anywhere in the 560-column
  // reference. These will always read blank until either (a) the master workbook adds
  // these columns, or (b) these values are computed some other way rather than read
  // from the master. Flagging rather than guessing a wrong column.
  govtBasicWage:               561, // NOT IN MASTER — no matching column found (max col is 560)
  govtDA:                      562, // NOT IN MASTER — no matching column found (max col is 560)
  govtHRA:                     563, // NOT IN MASTER — no matching column found (max col is 560)
  govtOther:                   564, // NOT IN MASTER — no matching column found (max col is 560)
  govtTotal:                   565, // NOT IN MASTER — no matching column found (max col is 560)
  diffActualGovt:              566, // NOT IN MASTER — no matching column found (max col is 560)
  minWageBasic:                52,  // AZ — Applicable Minimum Wage (Zone/Category)
  actualRateOfWages:           197, // GO — Actual rates of wages payable
  lopLoss:                     312, // KZ — Total Damages / Loss of pay (LOP)
  workingHoursFromTo:          415, // OY — Working hours From To
  restMealIntervals:           416, // OZ — Intervals for rest/meal From To

  // ── GENERAL ──────────────────────────────────────────────────────────────
  signatureOrThumbImpressionOfWorkmen: 398, // OH — Signature
  principalEmployerNatureOfWorkDone:   400, // OJ — Principal Employer / Nature of work
  remarks:                     503, // SI — Remarks
} as const;

/**
 * Ordered list of day attendance column numbers, Day 1–31.
 * Used by musterRoll.ts and musterRollCumWageRegister.ts.
 * Edit only when the daily attendance columns move in the master sheet.
 */
export const ATTENDANCE_DAY_COLUMNS: readonly number[] = [
  MASTER_COLUMNS.day1,  MASTER_COLUMNS.day2,  MASTER_COLUMNS.day3,
  MASTER_COLUMNS.day4,  MASTER_COLUMNS.day5,  MASTER_COLUMNS.day6,
  MASTER_COLUMNS.day7,  MASTER_COLUMNS.day8,  MASTER_COLUMNS.day9,
  MASTER_COLUMNS.day10, MASTER_COLUMNS.day11, MASTER_COLUMNS.day12,
  MASTER_COLUMNS.day13, MASTER_COLUMNS.day14, MASTER_COLUMNS.day15,
  MASTER_COLUMNS.day16, MASTER_COLUMNS.day17, MASTER_COLUMNS.day18,
  MASTER_COLUMNS.day19, MASTER_COLUMNS.day20, MASTER_COLUMNS.day21,
  MASTER_COLUMNS.day22, MASTER_COLUMNS.day23, MASTER_COLUMNS.day24,
  MASTER_COLUMNS.day25, MASTER_COLUMNS.day26, MASTER_COLUMNS.day27,
  MASTER_COLUMNS.day28, MASTER_COLUMNS.day29, MASTER_COLUMNS.day30,
  MASTER_COLUMNS.day31,
];

export type MasterColumnKey = keyof typeof MASTER_COLUMNS;