/**
 * factoriesAct/form24AccidentNotice.ts
 *
 * Generates Form_24_Accident_Notice.xlsx — sheet "Form 24"
 * FORM NO. 24 — Notice of Accident
 * [See Rule 121] — Factories Act, 1948 | Section 88
 * To be sent to the Inspector of Factories within 4 hours of Accident.
 *
 * ════════════════════════════════════════════════════════════════════════
 * TEMPLATE LAYOUT  (verified against Form_24_Accident_Notice.xlsx, sheet "Form 24")
 *
 * This is a VERTICAL (label–value) form. Col A = label, Col B = data value.
 * Rows 1–3: title / rule header rows (no data cells)
 * Row  4: (empty)
 * Row  5: "Sl.no"                             | col B → serial no (1)                  [A]
 * Row  6: "Accident Ref. No."                 | col B → accidentRefNo          (RC/471)
 * Row  7: "Name & Address of Factory:"        | col B → establishmentName      (OA/391) [company]
 * Row  8: "Factory Licence / Registration No."| col B → factoryLicenceNo       (S/19)   [company]
 * Row  9: "Name of Occupier:"                 | col B → occupierName           (BO/67)  [company]
 * Row 10: "Name of Manager:"                  | col B → managerName            (BP/68)  [company]
 * Row 11: "Date & Time of Accident:"          | col B → dateTimeOfAccident     (LH/320)
 * Row 12: "Place / Location of Accident:"     | col B → placeOfAccident        (QR/460)
 * Row 13: "Name of Injured Person:"           | col B → injuredPersonName      (PY/441)
 * Row 14: "Age & Sex of Injured Person:"      | col B → injuredPersonAgeSex    (SV/516)
 * Row 15: " Token / Employee No.:"            | col B → employeeCode           (I/9)
 * Row 16: "Designation / Occupation:"         | col B → designation            (AU/47)
 * Row 17: "Nature & Description of Accident:" | col B → natureOfAccident       (RE/473)
 * Row 18: "Body Part Injured:"                | col B → bodyPartInjured        (RG/475)
 * Row 19: "Severity (Minor / Major / Fatal):" | col B → severity               (RH/476)
 * Row 20: "Was First Aid Given? (Y/N):"       | col B → firstAidGiven          (RI/477)
 * Row 21: "Was Worker Hospitalised? (Y/N):"   | col B → workerHospitalised     (PZ/442)
 * Row 22: "Name & Address of Hospital:"       | col B → hospitalAddress        (RL/480)
 * Row 23: "Probable Cause of Accident:"       | col B → probableCauseAccident  (RM/481)
 * Row 24: "Witnesses (Names & Tokens):"       | col B → witnesses              (RN/482)
 * Row 25: "Immediate Action Taken:"           | col B → immediateActionTaken   (NK/375)
 * Row 26: "Estimated Days of Absence:"        | col B → estimatedDaysAbsence   (LI/321)
 * Row 27: "Compensation Applicable (Y/N):"    | col B → compensationApplicable (RO/483)
 * Row 28: "Estimated Compensation Amount (₹):"| col B → compensationAmount     (RJ/478)
 * Row 29: "Date of Notice to Inspector:"      | col B → 0 in template (no col code) → LEFT BLANK
 * Row 30: "Inspector's Name & Office:"        | col B → 0 in template (no col code) → LEFT BLANK
 * Row 31: "Remarks / Additional Details:"     | col B → accidentRemarks        (RP/484)
 * Row 33: Signature line (not written)
 * ════════════════════════════════════════════════════════════════════════
 *
 * NOTE ON ROWS 29 & 30: The template shows col code = 0 (integer zero), meaning
 * no master column is mapped. These fields are intentionally left blank for
 * manual completion by the authorized signatory.
 *
 * TO CHANGE A COLUMN: edit factoriesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { FACTORIES_ACT_COLUMNS as M } from './mapping.js';
import { fillCell } from '../shared/templateFiller.js';

export async function generateForm24AccidentNotice(
  templateBuffer: Buffer,
  masterData: MasterData,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const ws = workbook.getWorksheet('Form 24') ?? workbook.worksheets[0];
  if (!ws) throw new Error('Form 24: worksheet "Form 24" not found in template');

  const ci  = masterData.companyInfo;
  // Form 24 is a per-incident notice; use the first employee row for incident-specific data
  const emp = masterData.employees[0] ?? {};

  // ── Serial number ──────────────────────────────────────────────────────────
  fillCell(ws, 5,  2, 1);                                                       // Row5  col B

  // ── Accident identification ────────────────────────────────────────────────
  fillCell(ws, 6,  2, getString(emp, M.accidentRefNo));                         // Row6  col B (RC/471)

  // ── Company / establishment details ───────────────────────────────────────
  fillCell(ws, 7,  2, getString(ci,  M.establishmentName));                     // Row7  col B (OA/391)
  fillCell(ws, 8,  2, getString(ci,  M.factoryLicenceNo));                      // Row8  col B (S/19)
  fillCell(ws, 9,  2, getString(ci,  M.occupierName));                          // Row9  col B (BO/67)
  fillCell(ws, 10, 2, getString(ci,  M.managerName));                           // Row10 col B (BP/68)

  // ── Accident details ───────────────────────────────────────────────────────
  fillCell(ws, 11, 2, formatDate(getDate(emp, M.dateTimeOfAccident)));          // Row11 col B (LH/320)
  fillCell(ws, 12, 2, getString(emp, M.placeOfAccident));                       // Row12 col B (QR/460)
  fillCell(ws, 13, 2, getString(emp, M.injuredPersonName));                     // Row13 col B (PY/441)
  fillCell(ws, 14, 2, getString(emp, M.injuredPersonAgeSex));                   // Row14 col B (SV/516)
  fillCell(ws, 15, 2, getString(emp, M.employeeCode));                          // Row15 col B (I/9)
  fillCell(ws, 16, 2, getString(emp, M.designation));                           // Row16 col B (AU/47)
  fillCell(ws, 17, 2, getString(emp, M.natureOfAccident));                      // Row17 col B (RE/473)
  fillCell(ws, 18, 2, getString(emp, M.bodyPartInjured));                       // Row18 col B (RG/475)
  fillCell(ws, 19, 2, getString(emp, M.severity));                              // Row19 col B (RH/476)
  fillCell(ws, 20, 2, getString(emp, M.firstAidGiven));                         // Row20 col B (RI/477)
  fillCell(ws, 21, 2, getString(emp, M.workerHospitalised));                    // Row21 col B (PZ/442)
  fillCell(ws, 22, 2, getString(emp, M.hospitalAddress));                       // Row22 col B (RL/480)
  fillCell(ws, 23, 2, getString(emp, M.probableCauseAccident));                 // Row23 col B (RM/481)
  fillCell(ws, 24, 2, getString(emp, M.witnesses));                             // Row24 col B (RN/482)
  fillCell(ws, 25, 2, getString(emp, M.immediateActionTaken));                  // Row25 col B (NK/375)
  fillCell(ws, 26, 2, getNumber(emp, M.estimatedDaysAbsence));                  // Row26 col B (LI/321)
  fillCell(ws, 27, 2, getString(emp, M.compensationApplicable));                // Row27 col B (RO/483)
  fillCell(ws, 28, 2, getNumber(emp, M.compensationAmount));                    // Row28 col B (RJ/478)

  // Row 29 (Date of Notice to Inspector) — col code = 0 in template → left blank
  // Row 30 (Inspector's Name & Office)   — col code = 0 in template → left blank

  fillCell(ws, 31, 2, getString(emp, M.accidentRemarks));                       // Row31 col B (RP/484)

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
