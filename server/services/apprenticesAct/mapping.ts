/**
 * apprenticesAct/mapping.ts
 *
 * Act-specific column choices for the Apprentices Act 1961 registers.
 *
 * ════════════════════════════════════════════════════════════════════════
 * HOW TO EDIT COLUMNS:
 * 1. Change the number here to use a different master column.
 * 2. Master column numbers live in: server/services/shared/masterColumns.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import { MASTER_COLUMNS, ATTENDANCE_DAY_COLUMNS } from '../shared/masterColumns.js';

export const APPRENTICES_ACT_COLUMNS = {

  // ── ESTABLISHMENT ────────────────────────────────────────────────────────
  establishmentName:            MASTER_COLUMNS.establishmentName,       // 391 (OA)
  registrationNumber:           MASTER_COLUMNS.registrationNumber,      // 2   (G)

  // ── APPRENTICE PERSONAL ───────────────────────────────────────────────────
  employeeName:                 MASTER_COLUMNS.employeeName,            // 401 (OK) — often blank; registers fall back to col 101
  employeeNameFallback:         101,  // CW — Employee Full Name
  napsRegistrationNo:           27,   // AA — Registration No. (NAPS/BOAT)
  dateOfBirth:                  87,   // CI — Date of Birth
  gender:                       516,  // SV — Gender (M/F/T)
  category:                     444,  // QB — Category (SC/ST/OBC/GEN/PwD)
  educationalQualification:     445,  // QC — Educational Qualification
  trade:                        487,  // RC — Apprenticeship Trade / Subject (registers fall back to Designation col 47 when blank)
  tradeFallback:                MASTER_COLUMNS.designation,             // 47 (AU)
  apprenticeshipType:           486,  // RB — Apprentice Category (registers fall back to Department col 46 when blank)
  apprenticeshipTypeFallback:   MASTER_COLUMNS.department,              // 46 (AT)
  durationMonths:               446,  // QD — Duration of Apprenticeship (Months)
  dateOfCommencement:           467,  // QY — Date of Commencement
  dateOfCompletion:             468,  // QZ — Date of Completion (Expected)
  aadharNumber:                 76,   // BX — Aadhar No.
  guardianName:                 73,   // BU — Guardian / Parent Name
  contactNumber:                94,   // CP — Contact Number
  address:                      452,  // QJ — Address
  currentStatus:                463,  // QU — Current Status / Shift
  remarks:                      MASTER_COLUMNS.remarks,                 // 503 (SI)

  // ── ATTENDANCE ────────────────────────────────────────────────────────────
  workingDaysInMonth:           MASTER_COLUMNS.totalDaysWorked,         // 246 (IL) — Working Days / Total Present (attendance)
  totalDaysPresent:             MASTER_COLUMNS.totalDaysPresent,        // 199 (GQ) — FIXED (449 is 'MATERNITY Weeks of Leave Entitled')
  totalDaysAbsent:              MASTER_COLUMNS.totalDaysAbsent,         // 200 (GR)
  leaveDays:                    MASTER_COLUMNS.lwpDays,                 // 275 (JO) Leave Without Pay days
  totalDaysOnLeave:             490,  // RV — On Leave (SL/CL/EL) in Attendance Register
  holidayDays:                  MASTER_COLUMNS.totalWeekOffsHolidaysLeaves, // 201 (GS) — FIXED (was 275 LWP)
  // workingDays: removed — col 92 is 'Differently Abled'; the master has no working-days-in-month column,
  //   so the registers derive it from the daily attendance codes.
  shift:                        49,   // AW — Shift Type — FIXED (463 is Employee Status)

  /** Day attendance columns: dayColumns[0] = Day 1, dayColumns[30] = Day 31 */
  dayColumns: ATTENDANCE_DAY_COLUMNS,                                   // 144–174

  // ── CONTRACT ──────────────────────────────────────────────────────────────
  contractNo:                   491,  // RS — Apprentices Act Contract No. — FIXED (94 is the mobile number)
  contractExecutionDate:        323,  // LK — Date of Contract Execution
  contractCommencementDate:     554,  // UH — Date of Commencement (contract)
  apprenticeshipPeriod:         446,  // QD — Period of Apprenticeship (Months)
  contractExpiryDate:           324,  // LL — Date of Expiry
  stipendAgreed:                290,  // KD — Stipend Agreed (₹) / Month
  contractorName:               39,   // AM — Contractor / TPEA Name
  contractSignedEmployer:       555,  // UI — Contract Signed By (Employer)
  contractSignedApprentice:     557,  // UK — Contract Signed By (Apprentice)
  boatRegistered:               492,  // RX — Registered With BOAT (Y/N)
  boatRegistrationDate:         326,  // LN — BOAT Registration Date
  contractStatus:               493,  // RY — Contract Status
  contractRemarks:              489,  // RU — Contract Remarks

  // ── STIPEND ───────────────────────────────────────────────────────────────
  prescribedMonthlyStipend:     290,  // KD — Stipend Amount (₹) - Apprentice — FIXED (316 is 'Leave Applied (Days)')
  earnedStipend:                325,  // LM — Earned Stipend (₹) (Prorated)
  stipendDeductions:            327,  // LO — Deductions (₹) (Absence)
  netStipendPayable:            328,  // LP — Net Stipend Payable (₹)
  stipendPaidDate:              MASTER_COLUMNS.dateOfPayment,           // 311 (KY)
  paymentMode:                  430,  // PN — Payment Mode (Cash/Bank/UPI)
  bankAccountNumber:            MASTER_COLUMNS.bankAccountNumber,       // 276 (JP)
  // utrNumber: removed — the master has no UTR column (344 is 'Mode of Wage Payment'); register leaves it blank.
  stipendRemarks:               495,  // RW — Stipend Register Remarks (falls back to Remarks col 503)

} as const;

export type ApprenticesActColumnKey = keyof typeof APPRENTICES_ACT_COLUMNS;
