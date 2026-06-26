/**
 * factoriesAct/form25DangerousOccurrence.ts
 *
 * Generates Form_25_Dangerous_Occurrence.xlsx — sheet "Form 25"
 * FORM NO. 25 — Notice of Dangerous Occurrence
 * [See Rule 121-A] — Factories Act, 1948 | Section 88-A
 * Report to be sent to Chief Inspector of Factories within 2 hours.
 *
 * ════════════════════════════════════════════════════════════════════════
 * TEMPLATE LAYOUT  (verified against Form_25_Dangerous_Occurrence.xlsx, sheet "Form 25")
 *
 * This is a VERTICAL (label–value) form. Col A = label, Col B = data value.
 * Rows 1–3: title / rule header rows (no data cells)
 * Row  4: (empty)
 * Row  5:  "Occurrence Ref. No."                           | col B → occurrenceRefNo               (NW/387)
 * Row  6:  "Investigation Committee"                       | col B → investigationCommittee         (NX/388)
 * Row  7:  " Name & Full Address of Factory:"              | col B → establishmentName              (OA/391) [company]
 * Row  8:  "Factory Registration / Licence No.:"           | col B → registrationNumber             (B/2)    [company]
 * Row  9:  "Name of Occupier:"                             | col B → occupierName                   (BO/67)  [company]
 * Row 10:  "Name of Manager:"                              | col B → managerName                    (BP/68)  [company]
 * Row 11:  "Date, Time & Day of Dangerous Occurrence:"     | col B → dangDateTimeOccurrence         (NC/367)
 * Row 12:  "Exact Location within Factory:"                | col B → exactLocation                  (ND/368)
 * Row 13:  "Type / Category of Dangerous Occurrence:"      | col B → typeOfOccurrence               (NE/369)
 * Row 14:  "Detailed Description of the Occurrence:"       | col B → detailedDescription             (NF/370)
 * Row 15:  "Plant, Machinery, Equipment Involved:"         | col B → plantMachineryInvolved          (NG/371)
 * Row 16:  "Injuries to Person(s) – Names & Extent:"       | col B → injuriesPersons                (NH/372)
 * Row 17:  "Damage to Property – Description & Value (₹):" | col B → damageToProperty               (NI/373)
 * Row 18:  "Probable Cause of Dangerous Occurrence:"       | col B → probableCauseOccurrence         (NJ/374)
 * Row 19:  "Immediate Action Taken:"                       | col B → immediateActionTaken            (NK/375)
 * Row 20:  "Was Factory Production Stopped? (Y/N):"        | col B → productionStopped              (NL/376)
 * Row 21:  "Estimated Duration of Stoppage (hrs):"         | col B → stoppageDuration               (NM/377)
 * Row 22:  "Was Fire Brigade / MIDC / PESO Informed?:"     | col B → fireBrigadeInformed             (NN/378)
 * Row 23:  "Names of Witnesses:"                           | col B → witnamessDangerous              (NO/379)
 * Row 24:  "Name of Investigator (Internal):"              | col B → internalInvestigator            (NP/380)
 * Row 25:  "Investigation Committee Members:"              | col B → investigationCommitteeMembers   (NQ/381)
 * Row 26:  "Root Cause Analysis Summary:"                  | col B → rootCauseAnalysis               (NR/382)
 * Row 27:  "Corrective & Preventive Measures Proposed:"    | col B → correctiveMeasures              (NS/383)
 * Row 28:  "Target Date for Implementation:"               | col B → targetDate                      (NT/384)
 * Row 29:  "Date of Reporting to Chief Inspector:"         | col B → dateReportingChiefInspector     (NU/385)
 * Row 30:  "Office of Chief Inspector (Address):"          | col B → chiefInspectorOffice            (QA/443)
 * Row 31:  "Remarks / Additional Information:"             | col B → dangRemarks                     (NV/386)
 * Row 32:  "Follow-up Date"                                | col B → followUpDate                    (NY/389)
 * Row 33:  "Status"                                        | col B → occurrenceStatus                (NZ/390)
 * Row 35: Signature line (not written)
 *
 * NOTE ON REGISTRATION NUMBER: Form 25 uses col code 'B' (=col 2=registrationNumber),
 * not 'S' (=col 19=factoryLicenceNo). Verified against template row 8 col B = 'B'.
 *
 * TO CHANGE A COLUMN: edit factoriesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getDate, formatDate } from '../shared/masterReader.js';
import { FACTORIES_ACT_COLUMNS as M } from './mapping.js';
import { fillCell } from '../shared/templateFiller.js';

export async function generateForm25DangerousOccurrence(
  templateBuffer: Buffer,
  masterData: MasterData,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const ws = workbook.getWorksheet('Form 25') ?? workbook.worksheets[0];
  if (!ws) throw new Error('Form 25: worksheet "Form 25" not found in template');

  const ci  = masterData.companyInfo;
  // Form 25 is a per-incident notice; use the first employee row for occurrence-specific data
  const emp = masterData.employees[0] ?? {};

  // ── Occurrence identification ──────────────────────────────────────────────
  fillCell(ws, 5,  2, getString(emp, M.occurrenceRefNo));                       // Row5  col B (NW/387)
  fillCell(ws, 6,  2, getString(emp, M.investigationCommittee));                // Row6  col B (NX/388)

  // ── Company / establishment details ───────────────────────────────────────
  fillCell(ws, 7,  2, getString(ci,  M.establishmentName));                     // Row7  col B (OA/391)
  fillCell(ws, 8,  2, getString(ci,  M.registrationNumber));                    // Row8  col B (B/2)
  fillCell(ws, 9,  2, getString(ci,  M.occupierName));                          // Row9  col B (BO/67)
  fillCell(ws, 10, 2, getString(ci,  M.managerName));                           // Row10 col B (BP/68)

  // ── Occurrence details ─────────────────────────────────────────────────────
  fillCell(ws, 11, 2, formatDate(getDate(emp, M.dangDateTimeOccurrence)));      // Row11 col B (NC/367)
  fillCell(ws, 12, 2, getString(emp, M.exactLocation));                         // Row12 col B (ND/368)
  fillCell(ws, 13, 2, getString(emp, M.typeOfOccurrence));                      // Row13 col B (NE/369)
  fillCell(ws, 14, 2, getString(emp, M.detailedDescription));                   // Row14 col B (NF/370)
  fillCell(ws, 15, 2, getString(emp, M.plantMachineryInvolved));                // Row15 col B (NG/371)
  fillCell(ws, 16, 2, getString(emp, M.injuriesPersons));                       // Row16 col B (NH/372)
  fillCell(ws, 17, 2, getString(emp, M.damageToProperty));                      // Row17 col B (NI/373)
  fillCell(ws, 18, 2, getString(emp, M.probableCauseOccurrence));               // Row18 col B (NJ/374)
  fillCell(ws, 19, 2, getString(emp, M.immediateActionTaken));                  // Row19 col B (NK/375)
  fillCell(ws, 20, 2, getString(emp, M.productionStopped));                     // Row20 col B (NL/376)
  fillCell(ws, 21, 2, getString(emp, M.stoppageDuration));                      // Row21 col B (NM/377)
  fillCell(ws, 22, 2, getString(emp, M.fireBrigadeInformed));                   // Row22 col B (NN/378)
  fillCell(ws, 23, 2, getString(emp, M.witnamessDangerous));                    // Row23 col B (NO/379)
  fillCell(ws, 24, 2, getString(emp, M.internalInvestigator));                  // Row24 col B (NP/380)
  fillCell(ws, 25, 2, getString(emp, M.investigationCommitteeMembers));         // Row25 col B (NQ/381)
  fillCell(ws, 26, 2, getString(emp, M.rootCauseAnalysis));                     // Row26 col B (NR/382)
  fillCell(ws, 27, 2, getString(emp, M.correctiveMeasures));                    // Row27 col B (NS/383)
  fillCell(ws, 28, 2, formatDate(getDate(emp, M.targetDate)));                  // Row28 col B (NT/384)
  fillCell(ws, 29, 2, formatDate(getDate(emp, M.dateReportingChiefInspector))); // Row29 col B (NU/385)
  fillCell(ws, 30, 2, getString(emp, M.chiefInspectorOffice));                  // Row30 col B (QA/443)
  fillCell(ws, 31, 2, getString(emp, M.dangRemarks));                           // Row31 col B (NV/386)
  fillCell(ws, 32, 2, formatDate(getDate(emp, M.followUpDate)));                // Row32 col B (NY/389)
  fillCell(ws, 33, 2, getString(emp, M.occurrenceStatus));                      // Row33 col B (NZ/390)

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
