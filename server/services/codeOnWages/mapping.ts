/**
 * codeOnWages/mapping.ts
 *
 * Act-specific column choices for the Code on Wages forms.
 *
 * ════════════════════════════════════════════════════════════════════════
 * HOW TO EDIT COLUMNS:
 *
 * 1. To change which master column feeds a form field, edit the number here.
 *    Example: amountOfFine: MASTER_COLUMNS.amountOfFine  →  change masterColumns.ts
 *
 * 2. The master column numbers live in:
 *      server/services/shared/masterColumns.ts
 *
 * 3. This file only re-exports the ones used by Code on Wages forms.
 *    If a form needs a column not listed here, add it from MASTER_COLUMNS.
 * ════════════════════════════════════════════════════════════════════════
 */

import { MASTER_COLUMNS, ATTENDANCE_DAY_COLUMNS } from '../shared/masterColumns.js';

export const CODE_ON_WAGES_COLUMNS = {

  // ── ESTABLISHMENT ────────────────────────────────────────────────────────
  establishmentName:     MASTER_COLUMNS.establishmentName,  // 391
  registrationNumber:    MASTER_COLUMNS.registrationNumber, // 2
  address:               MASTER_COLUMNS.address,            // 392
  natureOfIndustry:      MASTER_COLUMNS.natureOfIndustry,   // 38  ← CORRECTED

  // ── EMPLOYEE ─────────────────────────────────────────────────────────────
  employeeCode:          MASTER_COLUMNS.employeeCode,       // 9
  employeeName:          MASTER_COLUMNS.employeeName,       // 401 ← CORRECTED (was missing)
  department:            MASTER_COLUMNS.department,         // 46
  designation:           MASTER_COLUMNS.designation,        // 47
  natureOfEmployment:    MASTER_COLUMNS.tenureOfEmployment, // 45

  // ── ATTENDANCE ────────────────────────────────────────────────────────────
  totalDaysWorked:       MASTER_COLUMNS.totalDaysWorked,    // 246
  totalDaysPresent:      MASTER_COLUMNS.totalDaysPresent,   // 199
  totalDaysAbsent:       MASTER_COLUMNS.totalDaysAbsent,    // 200
  lwpDays:               MASTER_COLUMNS.lwpDays,            // 201
  otHoursMusterRoll:     MASTER_COLUMNS.otHoursMusterRoll,  // 275 ← Form VI OT col CORRECTED

  // ── WAGES / PAYROLL ───────────────────────────────────────────────────────
  basicWage:             MASTER_COLUMNS.basicWage,          // 284 ← CORRECTED
  da:                    MASTER_COLUMNS.da,                  // 229 ← CORRECTED
  hra:                   MASTER_COLUMNS.hra,                 // 230 ← CORRECTED
  conveyanceAllowance:   MASTER_COLUMNS.conveyanceAllowance, // 233 ← CORRECTED
  specialAllowance:      MASTER_COLUMNS.specialAllowance,    // 235 ← CORRECTED
  grossSalary:           MASTER_COLUMNS.grossSalary,         // 273 ← CORRECTED
  netSalary:             MASTER_COLUMNS.netSalary,           // 274 ← CORRECTED
  otAmount:              MASTER_COLUMNS.otAmount,            // 207
  otAmountFormIV:        MASTER_COLUMNS.otAmountFormIV,      // 227 ← Form IV OT CORRECTED
  employeePf:            MASTER_COLUMNS.employeePf,          // 262 ← CORRECTED
  esicEmployee:          MASTER_COLUMNS.esicEmployee,        // 243 ← CORRECTED
  ptAmount:              MASTER_COLUMNS.ptAmount,            // 251
  advanceRefund:         MASTER_COLUMNS.advanceRefund,       // 218 ← CORRECTED
  otherDeduction:        MASTER_COLUMNS.otherDeduction,      // 310
  totalDeduction:        MASTER_COLUMNS.totalDeduction,      // 292
  dateOfPayment:         MASTER_COLUMNS.dateOfPayment,       // 311 ← CORRECTED
  bankName:              MASTER_COLUMNS.bankName,            // 244
  bankAccountNumber:     MASTER_COLUMNS.bankAccountNumber,   // 276

  // ── OVERTIME REGISTER (Form III) ──────────────────────────────────────────
  normalRateOfWages:     MASTER_COLUMNS.dailyRateOfWages,   // 204 ← Form III CORRECTED (daily rate)
  otRatePerHour:         MASTER_COLUMNS.otRatePerHour,      // 187
  otHoursWeek1:          MASTER_COLUMNS.otHoursWeek1,       // 183
  otHoursWeek2:          MASTER_COLUMNS.otHoursWeek2,       // 184
  otHoursWeek3:          MASTER_COLUMNS.otHoursWeek3,       // 185
  otHoursWeek4:          MASTER_COLUMNS.otHoursWeek4,       // 186
  totalOtHours:          MASTER_COLUMNS.totalOtHours,       // 190 ← CORRECTED (was 440/224)
  overtimeRemarks:       MASTER_COLUMNS.overtimeRemarks,    // 514

  // ── FINES (Form I) ────────────────────────────────────────────────────────
  dateOfOffence:         MASTER_COLUMNS.dateOfOffence,      // 295
  actOmissionForFine:    MASTER_COLUMNS.actOmissionForFine, // 301
  dateOffenceNoticed:    MASTER_COLUMNS.dateOffenceNoticed, // 299 ← CORRECTED (was 295)
  dateShowCauseNotice:   MASTER_COLUMNS.dateShowCauseNotice, // 406 ← CORRECTED (was 296)
  dateFineOrder:         MASTER_COLUMNS.dateFineOrder,      // 300
  wagePeriodOfFine:      MASTER_COLUMNS.wagePeriodOfFine,   // 432
  amountOfFine:          MASTER_COLUMNS.amountOfFine,       // 215
  dateOfRecovery:        MASTER_COLUMNS.dateOfRecovery,     // 303
  amountRecovered:       MASTER_COLUMNS.amountRecovered,    // 304 ← Form I col 14
  balancePending:        MASTER_COLUMNS.balancePending,     // 436
  finesRemarks:          MASTER_COLUMNS.finesRemarks,       // 217

  // ── DEDUCTIONS / DAMAGE (Form II) ─────────────────────────────────────────
  dateOfDamage:          MASTER_COLUMNS.dateOfDamage,       // 210
  natureOfDamage:        MASTER_COLUMNS.natureOfDamage,     // 209 ← CORRECTED (was missing)
  estimatedDamage:       MASTER_COLUMNS.estimatedDamage,    // 293 ← CORRECTED (was missing)
  dateShowCauseDamage:   MASTER_COLUMNS.dateShowCauseDamage, // 296
  replyReceived:         MASTER_COLUMNS.replyReceived,      // 435
  dateOfOrder:           MASTER_COLUMNS.dateOfOrder,        // 305
  amountOrdered:         MASTER_COLUMNS.amountOrdered,      // 306
  wagePeriodRecovery:    MASTER_COLUMNS.wagePeriodRecovery, // 304 ← CORRECTED (was 307)
  amountRecoveredDamage: MASTER_COLUMNS.amountRecoveredDamage, // 307 ← CORRECTED (was 304)
  cumulativeDeductedDamage: MASTER_COLUMNS.cumulativeDeductedDamage, // 308
  pctWagesDeductedDamage: MASTER_COLUMNS.pctWagesDeductedDamage,    // 309
  damageRemarks:         MASTER_COLUMNS.damageRemarks,     // 213

  // ── MUSTER ROLL / GENERAL ─────────────────────────────────────────────────
  musterRollRemarks:     MASTER_COLUMNS.musterRollRemarks, // 176
  remarks:               MASTER_COLUMNS.remarks,           // 503
  signatureOrThumbImpressionOfWorkmen: MASTER_COLUMNS.signatureOrThumbImpressionOfWorkmen, // 398
  principalEmployerNatureOfWorkDone:   MASTER_COLUMNS.principalEmployerNatureOfWorkDone,   // 400

  // ── MUSTER CUM WAGE REGISTER (Form II Muster) ─────────────────────────────
  uanNumber:             MASTER_COLUMNS.uanNumber,          // 13
  pfMemberId:            MASTER_COLUMNS.pfMemberId,         // 237
  baseWorkLocation:      MASTER_COLUMNS.baseWorkLocation,   // 526
  workingAreaProject:    MASTER_COLUMNS.workingAreaProject,  // 400
  projectName:           MASTER_COLUMNS.projectName,        // 44
  endClientName:         MASTER_COLUMNS.endClientName,      // 525
  ageAndSexGender:       MASTER_COLUMNS.ageAndSexGender,    // 74
  employeeAge:           MASTER_COLUMNS.employeeAge,        // 239
  skillCategory:         MASTER_COLUMNS.skillCategory,      // 64
  dateOfEntryIntoService: MASTER_COLUMNS.dateOfEntryIntoService, // 270
  workingHoursFromTo:    MASTER_COLUMNS.workingHoursFromTo, // 415
  restMealIntervals:     MASTER_COLUMNS.restMealIntervals,  // 416
  lopLoss:               MASTER_COLUMNS.lopLoss,            // 312
  minWageBasic:          MASTER_COLUMNS.minWageBasic,       // 52
  actualRateOfWages:     MASTER_COLUMNS.actualRateOfWages,  // 197
  medicalAllowance:      MASTER_COLUMNS.medicalAllowance,   // 231
  leaveEncashment:       MASTER_COLUMNS.leaveEncashment,    // 232
  nfh:                   MASTER_COLUMNS.nfh,                // 414
  statutoryBonus:        MASTER_COLUMNS.statutoryBonus,     // 234
  otherAllowances:       MASTER_COLUMNS.otherAllowances,    // 335
  additionalComponent:   MASTER_COLUMNS.additionalComponent, // 336
  insuranceEE:           MASTER_COLUMNS.insuranceEE,        // 337
  employeeLwf:           MASTER_COLUMNS.employeeLwf,        // 248
  incomeTax:             MASTER_COLUMNS.incomeTax,          // 339
  govtBasicWage:         MASTER_COLUMNS.govtBasicWage,      // 561
  govtDA:                MASTER_COLUMNS.govtDA,             // 562
  govtHRA:               MASTER_COLUMNS.govtHRA,            // 563
  govtOther:             MASTER_COLUMNS.govtOther,          // 564
  govtTotal:             MASTER_COLUMNS.govtTotal,          // 565
  diffActualGovt:        MASTER_COLUMNS.diffActualGovt,     // 566

  /** Day attendance columns: dayColumns[0] = Day 1, dayColumns[30] = Day 31 */
  dayColumns: ATTENDANCE_DAY_COLUMNS,

} as const;

export type CodeOnWagesColumnKey = keyof typeof CODE_ON_WAGES_COLUMNS;


// Backward-compatible aliases for older generator files.
export const CODE_WAGES_MAPPING = CODE_ON_WAGES_COLUMNS;
export const ATTENDANCE_DAY_COLS = ATTENDANCE_DAY_COLUMNS;

export type CodeWagesMappingKey = CodeOnWagesColumnKey;