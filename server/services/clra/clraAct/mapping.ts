/**
 * clraAct/mapping.ts
 *
 * Act-specific column choices for the Contract Labour (R&A) Act 1970 registers.
 *
 * ════════════════════════════════════════════════════════════════════════
 * HOW TO EDIT COLUMNS:
 * 1. Change the number here to use a different master column.
 * 2. Master column numbers live in: server/services/shared/masterColumns.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import { MASTER_COLUMNS, ATTENDANCE_DAY_COLUMNS } from '../../shared/masterColumns.js';

export const CLRA_ACT_COLUMNS = {

  // ── ESTABLISHMENT ────────────────────────────────────────────────────────
  // FIXED: col 391/392 ("Contractor Name..." / "Name of principal employer and
  // his address") are EMPTY in every row of the master. Col 30 holds the real
  // "Name and address of the principal employer" value and is non-empty.
  establishmentName:            30,                                      // AD — Name and address of the principal employer
  registrationNumber:           MASTER_COLUMNS.registrationNumber,      // 2   (B)
  licenceNumber:                MASTER_COLUMNS.licenceNumber,           // 3   (C)
  address:                      30,                                      // AD — reuse col 30 (combined name+address; col 392 is empty)

  // ── EMPLOYEE PERSONAL ────────────────────────────────────────────────────
  employeeName:                 101,   // CW — Employee Full Name (fallback; col 401/OK may be empty)
  employeeCode:                 MASTER_COLUMNS.employeeCode,            // 9  (I)
  regnixId:                     20,    // T  — Regnix ID
  // FIXED: col 73 ("Name and Father's/husband's name") holds shuffled
  // age/sex data, not a name, in every sampled row. Col 131/132
  // (PF Nominee Name / Relationship = "Father") is the most reliable
  // proxy for guardian name available in the master.
  guardianName:                 131,   // EA — Nominee Name (PF) [proxy; relation usually "Father" — verify col 132 if used for legal forms]
  // FIXED: col 87 ("Date of Birth (DD-MM-YYYY)") holds marital-status
  // strings ("Single"/"Married") in every sampled row — not a date.
  // Col 104 ("Date of Birth") holds the real ISO date in every row.
  dateOfBirth:                  104,   // CZ — Date of Birth (verified real date data; col 87 is corrupted)
  age:                          74,    // BV — Age and sex / Gender (age field)
  gender:                       516,   // SV — Gender
  maritalStatus:                88,    // CJ — Marital Status
  religion:                     89,    // CK — Religion
  nationality:                  90,    // CL — Nationality
  bloodGroup:                   91,    // CM — Blood Group
  differentlyAbled:             92,    // CN — Differently Abled
  designation:                  MASTER_COLUMNS.designation,             // 47 (AU)
  department:                   MASTER_COLUMNS.department,              // 46 (AT)
  permanentAddress:             452,   // QJ — Permanent Home Address
  localAddress:                 453,   // QK — Local Address
  mobileNumber:                 94,    // CP — Mobile No.
  emailId:                      96,    // CR — Email ID
  dateOfJoining:                MASTER_COLUMNS.dateOfEntryIntoService,  // 270 (JJ)
  dateOfTermination:            271,   // JK — Date of Termination
  reasonForTermination:         399,   // OI — Reason for Termination
  aadhaarNumber:                76,    // BX — Aadhaar No.
  panNumber:                    77,    // BY — PAN No.
  uanNumber:                    MASTER_COLUMNS.uanNumber,               // 13 (M)
  esicIpNumber:                 16,    // P  — ESIC IP No.
  bankName:                     MASTER_COLUMNS.bankName,                // 244 (IJ)
  bankAccountNumber:            MASTER_COLUMNS.bankAccountNumber,       // 276 (JP)
  ifscCode:                     MASTER_COLUMNS.ifscCode,                // 277 (JQ)
  identificationMarks:          75,    // BW — Identification Marks
  employeeStatus:               463,   // QU — Employee Status / Current Status
  offerLetterIssued:            345,   // MG — Offer Letter Issued
  appointmentLetterIssued:      346,   // MH — Appointment Letter Issued
  form11Submitted:              347,   // MI — Form 11 (EPF) Submitted
  form1Submitted:               348,   // MJ — Form 1 (ESIC) Submitted
  nominationFormSubmitted:      349,   // MK — Nomination Form Submitted
  complianceOfficer:            353,   // MO — Compliance Officer
  lastAuditDate:                351,   // MM — Last Audit Date
  remarks:                      MASTER_COLUMNS.remarks,                 // 503 (SI)

  // ── ATTENDANCE — DAILY ───────────────────────────────────────────────────
  /** Day attendance columns: dayColumns[0] = Day 1, dayColumns[30] = Day 31 */
  dayColumns:                   ATTENDANCE_DAY_COLUMNS,                 // 144–174

  // ── ATTENDANCE — TOTALS ──────────────────────────────────────────────────
  totalDaysPresent:             MASTER_COLUMNS.totalDaysPresent,        // 199 (GQ)
  totalDaysAbsent:              MASTER_COLUMNS.totalDaysAbsent,         // 200 (GR)
  totalWoHolidays:              MASTER_COLUMNS.lwpDays,                 // 201 (GS)
  overtimeDays:                 MASTER_COLUMNS.overtimeDaysCount,       // 202 (GT)
  totalLop:                     MASTER_COLUMNS.lopLoss,                 // 312 (KZ)
  netDaysWorked:                MASTER_COLUMNS.totalDaysWorked,         // 246 (IL)
  musterRollRemarks:            MASTER_COLUMNS.musterRollRemarks,       // 176 (FT)

  // ── WAGES (Form XVII) ────────────────────────────────────────────────────
  basicWage:                    MASTER_COLUMNS.basicWage,               // 284 (JX)
  da:                           MASTER_COLUMNS.da,                      // 229 (HU)
  hra:                          MASTER_COLUMNS.hra,                     // 230 (HV)
  conveyanceAllowance:          MASTER_COLUMNS.conveyanceAllowance,     // 233 (HY)
  medicalAllowance:             MASTER_COLUMNS.medicalAllowance,        // 231 (HW)
  otherAllowance:               MASTER_COLUMNS.specialAllowance,        // 235 (IA)
  grossWages:                   MASTER_COLUMNS.grossSalary,             // 273 (JM)
  employeePf:                   MASTER_COLUMNS.employeePf,              // 262 (JB)
  esicEmployee:                 MASTER_COLUMNS.esicEmployee,            // 243 (II)
  ptAmount:                     MASTER_COLUMNS.ptAmount,                // 251 (IQ)
  employeeLwf:                  247,   // IM — Employee LWF
  advanceDeduction:             266,   // JF — Advance Deduction
  tdsAmount:                    356,   // MR — TDS
  totalDeductions:              MASTER_COLUMNS.totalDeduction,          // 292 (KF)
  netWages:                     208,   // GZ — Net Wages Payable
  paymentMode:                  430,   // PN — Mode of Payment
  dateOfPayment:                MASTER_COLUMNS.dateOfPayment,           // 311 (KY)
  signature:                    MASTER_COLUMNS.signatureOrThumbImpressionOfWorkmen, // 398 (OH)

  // ── FINES (Form XXI) ────────────────────────────────────────────────────
  dateOfOffence:                MASTER_COLUMNS.dateOfOffence,           // 295 (KI)
  natureOfOffence:              431,   // PO — Nature of Offence
  dateShowCauseNotice:          MASTER_COLUMNS.dateShowCauseNotice,     // 296 (KJ) — from dateShowCauseDamage in MASTER
  employeeExplanation:          553,   // UG — Employee Explanation
  dateExplanationReceived:      297,   // KK — Date explanation received
  amountOfFine:                 302,   // KP — Amount of Fine (₹)
  dateFinePeriod:               298,   // KL — Date fine imposed period
  dateFineRealized:             216,   // HH — Date fine realized
  fineRemarks:                  MASTER_COLUMNS.finesRemarks,            // 217 (HI)

  // ── DEDUCTIONS FOR DAMAGE/LOSS (Form XX) ────────────────────────────────
  dateOfDamage:                 MASTER_COLUMNS.dateOfDamage,            // 210 (HB)
  natureOfDamage:               MASTER_COLUMNS.natureOfDamage,          // 209 (HA)
  estimatedDamage:              MASTER_COLUMNS.estimatedDamage,         // 293 (KG)
  amountOfDeduction:            MASTER_COLUMNS.totalDeduction,          // 292 (KF)
  numberOfInstallments:         409,   // OS — Number of Installments
  amountPerInstallment:         MASTER_COLUMNS.estimatedDamage,         // 293 (KH) reuse KH=294
  dateOfRecovery:               MASTER_COLUMNS.dateOfRecovery,          // 303 (KQ)
  damageRemarks:                222,   // HN — Remarks by Contractor
  damageSignature:              MASTER_COLUMNS.signatureOrThumbImpressionOfWorkmen, // 398 (OH)

  // ── ADVANCES (Form XXII) ────────────────────────────────────────────────
  dateOfAdvance:                523,   // TC — Date of Advance
  purposeOfAdvance:             411,   // OU — Purpose of Advance
  amountOfAdvance:              MASTER_COLUMNS.advanceRefund,           // 218 (HJ)
  numberOfInstallmentsAdv:      219,   // HK — No. of Installments
  amountEachInstallment:        294,   // KH — Amount each installment
  dateFirstRecovery:            211,   // HC — Date of 1st Recovery
  amountRecoveredTillDate:      MASTER_COLUMNS.amountRecovered,         // 304 (KR)
  balanceOutstanding:           433,   // PQ — Balance Outstanding
  advanceSignature:             MASTER_COLUMNS.signatureOrThumbImpressionOfWorkmen, // 398 (OH)
  advanceRemarks:               MASTER_COLUMNS.finesRemarks,            // 217 (HI)

  // ── OVERTIME (Form XXIII) ────────────────────────────────────────────────
  dateOfOvertime:               223,   // HO — Date of overtime
  normalWorkingHours:           MASTER_COLUMNS.workingHoursFromTo,      // 415 (OY)
  overtimeHours:                434,   // PR — Overtime Hours (From–To)
  totalOtHours:                 440,   // PX — Total OT Hours
  normalRateOfWages:            MASTER_COLUMNS.normalRateOfWages,       // 225 (HQ)
  otRate:                       226,   // HR — OT Rate (₹/hr)
  otWagesPayable:               MASTER_COLUMNS.otAmount,                // 207 (GY)
  overtimeRemarks:              MASTER_COLUMNS.overtimeRemarks,         // 514 (ST)

  // ── BONUS ────────────────────────────────────────────────────────────────
  bonusDoj:                     MASTER_COLUMNS.dateOfEntryIntoService,  // 270 (JJ)

  // ── GRATUITY ─────────────────────────────────────────────────────────────
  dateOfEligibility:            280,   // JT — Date of Eligibility (5 yrs)
  nomineeName:                  131,   // EA — Nominee Name
  nomineeRelation:              132,   // EB — Nominee Relation
  nomineeDob:                   98,    // CT — Nominee DOB

  // ── EPF ──────────────────────────────────────────────────────────────────
  pfMemberId:                   MASTER_COLUMNS.pfMemberId,              // 237 (IC)
  epfWages:                     MASTER_COLUMNS.basicWage,               // 284 (JX)
  epsWages:                     260,   // IZ — EPS Wages
  edliWages:                    261,   // JA — EDLI Wages
  employeePf12pct:              MASTER_COLUMNS.employeePf,              // 262 (JB)
  employerEps833:               263,   // JC — Employer EPS 8.33%
  employerEpfDiff:              238,   // ID — Employer EPF Difference
  edliEmployer05:               261,   // JA — EDLI Employer 0.5% (reuses JA)

  // ── LWF + PT ─────────────────────────────────────────────────────────────
  employeeState:                454,   // QL — State
  grossWagesLwf:                MASTER_COLUMNS.grossSalary,             // 273 (JM)
  employeeLwfAmt:               248,   // IN — Employee LWF
  employerLwfAmt:               247,   // IM — Employer LWF
  totalLwf:                     249,   // IO — Total LWF
  lwfFrequency:                 417,   // PA — LWF Frequency
  lwfDueDate:                   250,   // IP — LWF Due Date
  ptAmountLwf:                  MASTER_COLUMNS.ptAmount,                // 251 (IQ)
  ptFrequency:                  253,   // IS — PT Frequency
  ptDueDate:                    252,   // IR — PT Due Date
  ptChallanNo:                  412,   // OV — PT Challan No.

} as const;

export type ClraActColumnKey = keyof typeof CLRA_ACT_COLUMNS;