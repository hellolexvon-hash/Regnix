/**
 * server/services/seAct/mapping.ts
 *
 * Master column numbers for the Shops & Establishments Act registers.
 * Column numbers are Excel column positions in the Master Register sheet.
 *
 * All registers share the same column set — only templates differ per state.
 */

import { MASTER_COLUMNS } from '../shared/masterColumns.js';

export const SE_ACT_COLUMNS = {
  // ── IDENTIFICATION ─────────────────────────────────────────────────────────
  slNo:                    MASTER_COLUMNS.slNo,              // 1
  employeeCode:            MASTER_COLUMNS.employeeCode,      // 9
  regnixId:                20,   // T  — Regnix ID
  employeeName:            MASTER_COLUMNS.employeeName,      // 401
  designation:             MASTER_COLUMNS.designation,       // 47
  department:              MASTER_COLUMNS.department,        // 46

  // ── EMPLOYEE DEMOGRAPHICS ──────────────────────────────────────────────────
  fatherOrHusbandName:     73,   // BU — Father / Husband Name
  dateOfBirth:             87,   // CI — Date of Birth
  age:                     MASTER_COLUMNS.ageAndSexGender,   // 74
  gender:                  516,  // TX — Gender
  maritalStatus:           88,   // CJ — Marital Status
  religion:                89,   // CK — Religion
  nationality:             90,   // CL — Nationality
  bloodGroup:              91,   // CM — Blood Group
  differentlyAbled:        92,   // CN — Differently Abled
  permanentAddress:        452,  // QJ — Permanent Home Address
  localAddress:            453,  // QK — Local Address
  mobileNo:                94,   // CP — Mobile No.
  emailId:                 96,   // CR — Email ID
  identificationMarks:     75,   // BW — Identification Marks
  employeeStatus:          463,  // QU — Employee Status
  qualification:           445,  // QC — Qualification
  category:                444,  // QB — Category (Gen/SC/ST/OBC)

  // ── EMPLOYMENT DATES ───────────────────────────────────────────────────────
  dateOfJoining:           MASTER_COLUMNS.dateOfEntryIntoService, // 270
  dateOfTermination:       271,  // JK — Date of Termination
  reasonForTermination:    399,  // OI — Reason for Termination

  // ── STATUTORY IDS ─────────────────────────────────────────────────────────
  aadhaarNo:               76,   // BX — Aadhaar No.
  panNo:                   77,   // BY — PAN No.
  uanPf:                   MASTER_COLUMNS.uanNumber,          // 13
  esicIpNo:                16,   // P  — ESIC IP No.
  pfMemberId:              MASTER_COLUMNS.pfMemberId,          // 237

  // ── BANKING ────────────────────────────────────────────────────────────────
  bankName:                MASTER_COLUMNS.bankName,            // 244
  bankAccountNo:           MASTER_COLUMNS.bankAccountNumber,   // 276
  ifscCode:                MASTER_COLUMNS.ifscCode,            // 277

  // ── COMPLIANCE FLAGS ───────────────────────────────────────────────────────
  offerLetterIssued:       345,  // MD — Offer Letter Issued
  appointmentLetterIssued: 346,  // ME — Appointment Letter Issued
  form11Submitted:         347,  // MF — Form 11 (EPF) Submitted
  form1Submitted:          348,  // MG — Form 1 (ESIC) Submitted
  nominationFormSubmitted: 349,  // MH — Nomination Form Submitted
  complianceOfficer:       353,  // MO — Compliance Officer
  lastAuditDate:           351,  // ML — Last Audit Date

  // ── WAGES ──────────────────────────────────────────────────────────────────
  daysWorked:              MASTER_COLUMNS.totalDaysWorked,     // 246
  basicWage:               MASTER_COLUMNS.basicWage,           // 284
  da:                      MASTER_COLUMNS.da,                  // 229
  hra:                     MASTER_COLUMNS.hra,                 // 230
  conveyance:              MASTER_COLUMNS.conveyanceAllowance, // 233
  medicalAllowance:        MASTER_COLUMNS.medicalAllowance,    // 231
  otherAllowance:          MASTER_COLUMNS.specialAllowance,    // 235
  grossWages:              MASTER_COLUMNS.grossSalary,         // 273
  epfEmployee:             238,  // ID — EPF Employee contribution
  esicEmployee:            MASTER_COLUMNS.esicEmployee,        // 243
  pt:                      MASTER_COLUMNS.ptAmount,            // 251
  lwfEmployee:             MASTER_COLUMNS.employeeLwf,         // 248
  advanceDeduction:        266,  // JF — Advance Deduction
  tds:                     356,  // MR — TDS (Income Tax)
  totalDeductions:         MASTER_COLUMNS.totalDeduction,      // 292
  netWages:                208,  // GZ — Net Wages Payable
  modeOfPayment:           430,  // PN — Mode of Payment
  dateOfPayment:           MASTER_COLUMNS.dateOfPayment,       // 311
  signature:               MASTER_COLUMNS.signatureOrThumbImpressionOfWorkmen, // 398
  remarks:                 MASTER_COLUMNS.remarks,             // 503

  // ── LEAVE ──────────────────────────────────────────────────────────────────
  elOpeningBalance:        178,  // FV — EL Opening Balance
  elEarned:                191,  // GI — EL Earned (Current Year)
  elAvailed:               439,  // PP — EL Availed
  slOpeningBalance:        180,  // FX — SL Opening Balance
  slAvailed:               180,  // FX — SL Availed (same col, used as availed)
  slClosingBalance:        193,  // GL — SL Closing Balance
  clOpeningBalance:        179,  // FW — CL Opening Balance
  clAvailed:               192,  // GJ — CL Availed
  clClosingBalance:        192,  // GJ — CL Closing Balance (computed from availed)
  nationalHolidays:        MASTER_COLUMNS.nfh,                 // 414
  weeklyOffAvailed:        313,  // LA — Weekly Off Availed

  // ── ADVANCES ───────────────────────────────────────────────────────────────
  dateOfAdvance:           523,  // TE — Date of Advance
  purposeOfAdvance:        411,  // PE — Purpose of Advance
  amountOfAdvance:         MASTER_COLUMNS.advanceRefund,       // 218
  noOfInstallments:        219,  // HK — No. of Installments for Recovery
  installmentAmount:       294,  // KH — Amount of Each Installment
  dateOf1stRecovery:       211,  // HC — Date of 1st Recovery
  amountRecoveredTillDate: MASTER_COLUMNS.amountRecovered,     // 304
  balanceOutstanding:      433,  // PP — Balance Outstanding

  // ── FINES ──────────────────────────────────────────────────────────────────
  dateOfOffence:           MASTER_COLUMNS.dateOfOffence,       // 295
  natureOfOffence:         431,  // PO — Nature of Offence
  dateShowCauseNotice:     296,  // KJ — Date of Show Cause Notice
  employeeExplanation:     553,  // UG — Employee Explanation
  dateExplanationReceived: 297,  // KK — Date of Explanation Received
  amountOfFine:            302,  // KP — Amount of Fine
  dateFineImposed:         298,  // KL — Date on which Fine Imposed
  dateFineRealized:        216,  // HH — Date on which Fine Realized
  fineRemarks:             217,  // HI — Remarks

  // ── DEDUCTIONS ─────────────────────────────────────────────────────────────
  monthYear:               568,  // blank/special — month/year
  natureOfDeduction:       209,  // HA — Nature of Deduction
  amountDeducted:          MASTER_COLUMNS.totalDeduction,      // 292
  dateOfDeduction:         MASTER_COLUMNS.dateOfPayment,       // 311
  balanceAfterDeduction:   436,  // PT — Balance After Deduction

  // ── OVERTIME ───────────────────────────────────────────────────────────────
  month:                   567,  // blank/special — month
  dateOfOt:                223,  // HO — Date of OT
  otStartTime:             415,  // OY — OT Start Time
  otEndTime:               434,  // PP — OT End Time
  otHours:                 440,  // PP — OT Hours
  otRate:                  225,  // HQ — OT Rate (₹/hr)
  otAmount:                226,  // HR — OT Amount (₹)
  reasonForOt:             524,  // TE — Reason for OT
  otRemarks:               514,  // ST — OT Remarks

  // ── TELANGANA MUSTER ROLL ONLY ─────────────────────────────────────────────
  maleFemale:              80,   // CB — Male/Female
  bonus:                   278,  // JR — Bonus
  society:                 336,  // ??? — Society deduction
  insurance:               337,  // ??? — Insurance deduction
  day1:                    MASTER_COLUMNS.day1,  day2:  MASTER_COLUMNS.day2,
  day3:                    MASTER_COLUMNS.day3,  day4:  MASTER_COLUMNS.day4,
  day5:                    MASTER_COLUMNS.day5,  day6:  MASTER_COLUMNS.day6,
  day7:                    MASTER_COLUMNS.day7,  day8:  MASTER_COLUMNS.day8,
  day9:                    MASTER_COLUMNS.day9,  day10: MASTER_COLUMNS.day10,
  day11:                   MASTER_COLUMNS.day11, day12: MASTER_COLUMNS.day12,
  day13:                   MASTER_COLUMNS.day13, day14: MASTER_COLUMNS.day14,
  day15:                   MASTER_COLUMNS.day15, day16: MASTER_COLUMNS.day16,
  day17:                   MASTER_COLUMNS.day17, day18: MASTER_COLUMNS.day18,
  day19:                   MASTER_COLUMNS.day19, day20: MASTER_COLUMNS.day20,
  day21:                   MASTER_COLUMNS.day21, day22: MASTER_COLUMNS.day22,
  day23:                   MASTER_COLUMNS.day23, day24: MASTER_COLUMNS.day24,
  day25:                   MASTER_COLUMNS.day25, day26: MASTER_COLUMNS.day26,
  day27:                   MASTER_COLUMNS.day27, day28: MASTER_COLUMNS.day28,
  day29:                   MASTER_COLUMNS.day29, day30: MASTER_COLUMNS.day30,
  day31:                   MASTER_COLUMNS.day31,
  totalOtHours:            440,  // PP — Total OT Hours
  bonus:                   278,  // JR — Bonus
  otAmountMuster:          MASTER_COLUMNS.otAmount,            // 207
  maternity:               450,  // PP — Maternity Benefit
  others:                  335,  // ??? — Others
  subsistenceAllowance:    339,  // ??? — Subsistance allowance
  leaveEncashment:         MASTER_COLUMNS.leaveEncashment,     // 232
  society:                 336,  // ??? — Society
  insurance:               337,  // ??? — Insurance
  salaryAdvance:           MASTER_COLUMNS.advanceRefund,       // 218
  fines:                   302,  // KP — Fines
  damagesLoss:             MASTER_COLUMNS.lopLoss,             // 312
  netPayable:              MASTER_COLUMNS.netSalary,           // 274
} as const;
