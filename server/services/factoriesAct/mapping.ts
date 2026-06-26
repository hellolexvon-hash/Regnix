/**
 * factoriesAct/mapping.ts
 *
 * Act-specific column choices for the Factories Act 1948 registers.
 * ALL column numbers verified against:
 *   — Factory_s_Act.xlsx  (master mapping reference)
 *   — Each template's col-code row (row 8 in tabular forms)
 *   — Form 24 / Form 25 col-code cells (col B in vertical forms)
 *
 * ════════════════════════════════════════════════════════════════════════
 * HOW TO EDIT COLUMNS:
 * 1. Change the number here to use a different master column.
 * 2. Master column numbers live in: server/services/shared/masterColumns.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import { MASTER_COLUMNS } from '../shared/masterColumns.js';

export const FACTORIES_ACT_COLUMNS = {

  // ── ESTABLISHMENT ─────────────────────────────────────────────────────────
  establishmentName:      391,  // OA — Factory Name & Address
  registrationNumber:     MASTER_COLUMNS.registrationNumber,  // 2  (B)
  factoryLicenceNo:       19,   // S  — Factory Licence / Reg No
  occupierName:           67,   // BO — Name of Occupier
  managerName:            68,   // BP — Name of Manager

  // ── EMPLOYEE PERSONAL ─────────────────────────────────────────────────────
  employeeCode:           MASTER_COLUMNS.employeeCode,        // 9  (I)
  employeeName:           401,  // OK — Full Name of Worker
  guardianName:           73,   // BU — Father / Husband Name
  dateOfBirth:            87,   // CI — Date of Birth
  gender:                 74,   // BV — Sex (M/F)
  nationality:            90,   // CL — Nationality
  permanentAddress:       452,  // QJ — Permanent Address
  dateOfJoining:          270,  // JJ — Date of Joining
  department:             46,   // AT — Department / Section
  designation:            47,   // AU — Designation / Occupation
  natureOfWork:           33,   // AG — Nature of Work
  shift:                  49,   // AW — Shift (A/B/C/G)
  weeklyHoliday:          313,  // LA — Weekly Holiday
  dateOfLeaving:          271,  // JK — Date of Leaving / Termination
  remarks:                503,  // SI — Remarks

  // ── LEAVE WITH WAGES (02_Leave_With_Wages / Form 15) ─────────────────────
  // Template col-code row: A, I, OK, AT, GU, LC, PU, PV, LD, LF, LG, RV, PW, FZ, LE, SI
  daysWorkedPrevYear:     203,  // GU — Days Worked Previous Year
  leaveEntitlement:       315,  // LC — Leave Entitlement (Days)
  leaveCF:                437,  // PU — Leave Carried Forward
  totalLeaveAvailable:    438,  // PV — Total Leave Available
  leaveApplied:           316,  // LD — Leave Applied (Days)
  leaveFromDate:          318,  // LF — Leave From Date
  leaveToDate:            319,  // LG — Leave To Date
  typeOfLeave:            490,  // RV — Type of Leave (EL/CL/SL)
  leaveAvailed:           439,  // PW — Leave Availed
  leaveBalance:           182,  // FZ — Leave Balance
  wagesPaidDuringLeave:   317,  // LE — Wages Paid During Leave

  // ── OVERTIME REGISTER (03_Overtime_Register) ─────────────────────────────
  // Template col-code row: A, I, OK, AT, [none], HO, GG, PR, PX, GE, HR, HS, TD, JY, OH, [none]
  // Col 5 (Designation) has no col code in template — use Factory_s_Act.xlsx ref (AU=47)
  // Col 16 (Remarks) has no col code in template — use SI=503
  dateOfOvertime:         223,  // HO — Date of Overtime
  normalHoursWorked:      189,  // GG — Normal Hours Worked
  overtimeHoursWorked:    434,  // PR — Overtime Hours Worked
  totalHoursWorked:       440,  // PX — Total Hours Worked
  normalWageRate:         187,  // GE — Normal Wage Rate (₹/hr)
  otWageRate:             226,  // HR — OT Wage Rate (₹/hr, 2× Normal)
  otWagesPayable:         227,  // HS — OT Wages Payable (₹)
  reasonForOvertime:      524,  // TD — Reason for Overtime
  supervisorSignature:    285,  // JY — Supervisor Signature
  workerSignature:        398,  // OH — Worker Signature / Thumb

  // ── FORM 22 OVERTIME (Form_22_Overtime) ──────────────────────────────────
  // Template col-code row: A, I, OK, AT, AU, DS, OY, PX, GH, HQ, HR, GY, OH, SI
  // NOTE: Col 4 header says "Designation" but col code is AT (=46=department)
  //       Col 5 header says "Department"  but col code is AU (=47=designation)
  //       This swap is intentional per the Form 22 template design.
  // Registration no in Form 22 meta: col code 'B' = col 2 = registrationNumber
  form22Date:             123,  // DS — Date
  form22NormalHours:      415,  // OY — Normal Hours Worked (From–To)
  form22OtHours:          440,  // PX — Overtime Hours
  form22TotalHours:       190,  // GH — Total Hours
  form22NormalWageRate:   225,  // HQ — Normal Wage Rate
  form22OtWages:          207,  // GY — OT Wages Payable

  // ── ACCIDENT NOTICE (Form 24) ─────────────────────────────────────────────
  // Template rows 5–31 col B verified against Form_24_Accident_Notice.xlsx
  accidentRefNo:          471,  // RC — Accident Ref. No.
  dateTimeOfAccident:     320,  // LH — Date & Time of Accident
  placeOfAccident:        460,  // QR — Place / Location of Accident
  injuredPersonName:      441,  // PY — Name of Injured Person
  injuredPersonAgeSex:    516,  // SV — Age & Sex of Injured Person
  natureOfAccident:       473,  // RE — Nature & Description of Accident
  bodyPartInjured:        475,  // RG — Body Part Injured
  severity:               476,  // RH — Severity (Minor / Major / Fatal)
  firstAidGiven:          477,  // RI — Was First Aid Given?
  workerHospitalised:     442,  // PZ — Was Worker Hospitalised?
  hospitalAddress:        480,  // RL — Name & Address of Hospital
  probableCauseAccident:  481,  // RM — Probable Cause of Accident
  witnesses:              482,  // RN — Witnesses
  immediateActionTaken:   375,  // NK — Immediate Action Taken
  estimatedDaysAbsence:   321,  // LI — Estimated Days of Absence
  compensationApplicable: 483,  // RO — Compensation Applicable (Y/N)
  compensationAmount:     478,  // RJ — Estimated Compensation Amount (₹)
  // Row 29 (Date of Notice) and Row 30 (Inspector Name) have col code = 0 in template
  // → no master column; these rows left blank
  accidentRemarks:        484,  // RP — Remarks / Additional Details

  // ── DANGEROUS OCCURRENCE (Form 25) ───────────────────────────────────────
  // Template rows 5–33 col B verified against Form_25_Dangerous_Occurrence.xlsx
  occurrenceRefNo:               387,  // NW — Occurrence Ref. No.
  investigationCommittee:        388,  // NX — Investigation Committee
  dangDateTimeOccurrence:        367,  // NC — Date, Time & Day
  exactLocation:                 368,  // ND — Exact Location within Factory
  typeOfOccurrence:              369,  // NE — Type / Category
  detailedDescription:           370,  // NF — Detailed Description
  plantMachineryInvolved:        371,  // NG — Plant/Machinery/Equipment Involved
  injuriesPersons:               372,  // NH — Injuries to Person(s)
  damageToProperty:              373,  // NI — Damage to Property
  probableCauseOccurrence:       374,  // NJ — Probable Cause
  productionStopped:             376,  // NL — Was Factory Production Stopped?
  stoppageDuration:              377,  // NM — Estimated Duration of Stoppage (hrs)
  fireBrigadeInformed:           378,  // NN — Was Fire Brigade / MIDC / PESO Informed?
  witnamessDangerous:            379,  // NO — Names of Witnesses
  internalInvestigator:          380,  // NP — Name of Investigator (Internal)
  investigationCommitteeMembers: 381,  // NQ — Investigation Committee Members
  rootCauseAnalysis:             382,  // NR — Root Cause Analysis Summary
  correctiveMeasures:            383,  // NS — Corrective & Preventive Measures
  targetDate:                    384,  // NT — Target Date for Implementation
  dateReportingChiefInspector:   385,  // NU — Date of Reporting to Chief Inspector
  chiefInspectorOffice:          443,  // QA — Office of Chief Inspector (Address)
  dangRemarks:                   386,  // NV — Remarks / Additional Information
  followUpDate:                  389,  // NY — Follow-up Date
  occurrenceStatus:              390,  // NZ — Status

} as const;

export type FactoriesActColumnKey = keyof typeof FACTORIES_ACT_COLUMNS;
