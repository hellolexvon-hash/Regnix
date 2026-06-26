/**
 * codeOnWages/mapping.ts
 *
 * Single source of truth for Code on Wages master column mappings.
 * All values are 1-based column numbers from the Regnix Master Register.
 *
 * Rules:
 *  - Store only column numbers. No business logic here.
 *  - Never reference header names anywhere in generation code.
 *  - Update this file when the master register schema changes.
 */

export const CODE_WAGES_MAPPING = {
  // ── Identity ───────────────────────────────────────────────────────────────
  slNo:                9,   // Serial / row number
  employeeCode:        9,   // Regnix Employee ID / Employee code
  employeeName:        10,  // Full name of the employee
  department:          46,  // Department / Location / Unit
  designation:         47,  // Designation / Nature of employment

  // ── Service ────────────────────────────────────────────────────────────────
  dateOfJoining:       43,  // Date of entry into service
  dateOfBirth:         41,  // Date of birth
  age:                 42,  // Age
  gender:              40,  // Gender

  // ── Attendance ─────────────────────────────────────────────────────────────
  daysWorked:          92,  // No. of days worked / Total days present
  daysAbsent:          93,  // Total days absent
  lopDays:             94,  // Loss of pay days

  // ── Daily attendance columns (cols 51–81 = days 1–31) ─────────────────────
  day1:                51,
  day2:                52,
  day3:                53,
  day4:                54,
  day5:                55,
  day6:                56,
  day7:                57,
  day8:                58,
  day9:                59,
  day10:               60,
  day11:               61,
  day12:               62,
  day13:               63,
  day14:               64,
  day15:               65,
  day16:               66,
  day17:               67,
  day18:               68,
  day19:               69,
  day20:               70,
  day21:               71,
  day22:               72,
  day23:               73,
  day24:               74,
  day25:               75,
  day26:               76,
  day27:               77,
  day28:               78,
  day29:               79,
  day30:               80,
  day31:               81,

  // ── Wage components ────────────────────────────────────────────────────────
  basicWage:           95,  // Basic wage
  da:                  96,  // Dearness allowance (DA/VDA)
  hra:                 97,  // HRA
  conveyanceAllowance: 98,  // Conveyance allowance
  specialAllowance:    99,  // Special / other allowance
  grossWage:           101, // Gross salary (monthly)
  netSalary:           110, // Net salary (monthly)

  // ── Overtime ───────────────────────────────────────────────────────────────
  normalWageRate:      103, // Normal daily wage rate
  otRatePerHour:       104, // OT rate per hour
  otHoursWeek1:        105, // OT hours week 1
  otHoursWeek2:        106, // OT hours week 2
  otHoursWeek3:        107, // OT hours week 3
  otHoursWeek4:        108, // OT hours week 4
  totalOtHours:        109, // Total OT hours
  otAmount:            111, // OT amount (₹)

  // ── Deductions ─────────────────────────────────────────────────────────────
  pfDeduction:         120, // Employee PF deduction
  esiDeduction:        121, // ESI employee contribution (0.75%)
  ptDeduction:         122, // Professional tax (PT)
  advanceDeduction:    123, // Advance recovery
  otherDeduction:      124, // Other deductions (LWF, etc.)
  totalDeduction:      125, // Total deductions

  // ── Fines ──────────────────────────────────────────────────────────────────
  dateOfOffence:       130, // Date of offence
  actOmissionForFine:  131, // Nature of offence
  dateOffenceNoticed:  132, // Date offence noticed
  dateShowCause:       133, // Date show cause issued
  dateFineOrder:       134, // Date fine order issued
  wagePeriodOfFine:    135, // Wage period of fine
  amountOfFine:        136, // Fine amount (₹)
  dateOfRecovery:      137, // Date fine recovered
  amountRecovered:     138, // Amount recovered (₹)

  // ── Deductions for damage / loss ───────────────────────────────────────────
  dateOfDamage:        140, // Date of damage/loss
  natureOfDamage:      141, // Nature of damage/loss
  estimatedLoss:       142, // Estimated loss (₹)
  dateShowCauseDmg:    143, // Show cause date (damage)
  replyReceived:       144, // Reply received (Y/N)
  dateOfOrder:         145, // Order date
  amountOrdered:       146, // Amount ordered for recovery (₹)
  wagePeriodRecovery:  147, // Wage period of recovery
  amountRecoveredDmg:  148, // Amount recovered (₹)
  balancePending:      149, // Balance pending (₹)

  // ── Payment ────────────────────────────────────────────────────────────────
  paymentDate:         160, // Date of payment / remittance
  bankName:            161, // Bank name
  bankAccountNumber:   162, // Bank account number
  utrReference:        163, // UTR / receipt reference

  // ── Company / establishment (row 1 header record) ─────────────────────────
  establishmentName:   1,   // Company / establishment name
  registrationNumber:  2,   // Factory/Establishment Reg. No.
  address:             3,   // Address
  natureOfIndustry:    4,   // Nature of industry
  wagePeriod:          5,   // Wage period
  year:                6,   // Year
} as const;

export type CodeWagesMappingKey = keyof typeof CODE_WAGES_MAPPING;
