/**
 * factories/mapping.ts
 *
 * Master column mappings for the Factories Act, 1948.
 * All values are 1-based column numbers from the Regnix Master Register.
 *
 * Rules:
 *  - Store only column numbers. No logic here.
 *  - Never reference header names anywhere else.
 */

export const FACTORIES_MAPPING = {
  // ── Identity ───────────────────────────────────────────────────────────────
  slNo:                9,
  employeeCode:        9,
  employeeName:        10,
  fatherOrHusbandName: 11,
  age:                 42,
  gender:              40,
  designation:         47,
  department:          46,
  category:            48,   // Skilled / Unskilled / Semi-skilled

  // ── Service ────────────────────────────────────────────────────────────────
  dateOfJoining:       43,
  dateOfLeaving:       44,
  reasonForLeaving:    45,
  nationality:         39,

  // ── Attendance ─────────────────────────────────────────────────────────────
  daysWorked:          92,
  daysAbsent:          93,
  totalOtHours:        109,

  // ── Wages ──────────────────────────────────────────────────────────────────
  basicWage:           95,
  da:                  96,
  hra:                 97,
  grossWage:           101,
  netSalary:           110,
  otAmount:            111,

  // ── Deductions ─────────────────────────────────────────────────────────────
  pfDeduction:         120,
  esiDeduction:        121,
  ptDeduction:         122,
  totalDeduction:      125,

  // ── Payment ────────────────────────────────────────────────────────────────
  paymentDate:         160,
  bankAccountNumber:   162,

  // ── Establishment (company info row) ──────────────────────────────────────
  establishmentName:   1,
  registrationNumber:  2,
  address:             3,
  natureOfIndustry:    4,
  wagePeriod:          5,
  year:                6,
  occupierName:        7,    // Name of Occupier / Manager
  licenceNumber:       8,    // Factory Licence No.
} as const;

export type FactoriesMappingKey = keyof typeof FACTORIES_MAPPING;
