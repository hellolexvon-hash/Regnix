/**
 * factoriesAct/form22Overtime.ts
 *
 * Generates Form_22_Overtime.xlsx
 * FORM NO. 22 — Register of Overtime (Statutory Form Variant)
 * [See Rule 63] — Factories Act, 1948 | Section 59 | Maharashtra Factories Rules, 1963
 *
 * ════════════════════════════════════════════════════════════════════════
 * TEMPLATE LAYOUT  (verified against Form_22_Overtime.xlsx)
 *
 *  Row 1  → "FORM NO. 22"
 *  Row 2  → "[See Rule 63] – Register of Overtime"
 *  Row 3  → "FACTORIES ACT, 1948 | Section 59 | Maharashtra Factories Rules, 1963"
 *  Row 4  → "Factory Name and Address:" | col 3 = factory name (OA/391)
 *  Row 5  → col 5 = "Factory Registration No.:" | col 6 = reg no (B/2=registrationNumber)
 *             col 13 = "Financial Year:"
 *             NOTE: Form 22 uses col code 'B' (=col 2=registrationNumber) for reg no,
 *                   NOT 'S' (=col 19=factoryLicenceNo) as in the tabular registers.
 *  Row 6  → (empty spacer row)
 *  Row 7  → Column headers (14 active cols):
 *             Sl.No | Token | Name | Designation | Department | Date |
 *             Normal Hours | OT Hours | Total Hours | Normal Wage | OT Rate | OT Wages |
 *             Worker Signature | Remarks
 *  Row 8  → Column letter codes: A, I, OK, AT, AU, DS, OY, PX, GH, HQ, HR, GY, OH, SI
 *
 *  ⚠  IMPORTANT SWAP: The Form 22 template header labels "Designation" and "Department"
 *     are swapped relative to the col codes:
 *       Col 4 header = "Designation" → col code AT (=46=department data)
 *       Col 5 header = "Department"  → col code AU (=47=designation data)
 *     This is intentional in the template. The col code drives the data, not the header.
 *     We write department (col 46) into col 4 and designation (col 47) into col 5.
 *
 *  Row 9  → DATA START
 *  Row 28 → DATA END  (20 employee rows)
 *  Row 29 → TOTAL row
 *
 * COLUMN MAP  (template col → master col via FACTORIES_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9   (I)
 *  C3  → employeeName               401 (OK)
 *  C4  → department                 46  (AT) ← header reads "Designation" — col code AT wins
 *  C5  → designation                47  (AU) ← header reads "Department"  — col code AU wins
 *  C6  → form22Date                 123 (DS)
 *  C7  → form22NormalHours          415 (OY)
 *  C8  → form22OtHours              440 (PX)
 *  C9  → form22TotalHours           190 (GH)
 *  C10 → form22NormalWageRate       225 (HQ)
 *  C11 → otWageRate                 226 (HR)
 *  C12 → form22OtWages              207 (GY)
 *  C13 → workerSignature            398 (OH)
 *  C14 → remarks                    503 (SI)
 *
 * META CELLS:
 *  (4, 3)  → establishmentName   (391 / OA)
 *  (5, 6)  → registrationNumber  (2   / B)   ← NOTE: B not S
 *
 * TOTALS: cols 8, 9, 12
 *
 * TO CHANGE A COLUMN: edit factoriesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { FACTORIES_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCell } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Form 22';
const DATA_START_ROW = 9;
const DATA_END_ROW   = 28;
const TOTAL_ROW      = 29;
const USED_COLUMNS   = 14;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCell(ws, 4, 3, getString(companyInfo, M.establishmentName));   // OA → row4 col3
  fillCell(ws, 5, 6, getString(companyInfo, M.registrationNumber));  // B  → row5 col6
}

export async function generateForm22Overtime(
  templateBuffer: Buffer,
  masterData: MasterData,
): Promise<Buffer> {
  return generateSingleSheetRegister(templateBuffer, masterData, {
    sheetName:    SHEET_TITLE,
    dataStartRow: DATA_START_ROW,
    dataEndRow:   DATA_END_ROW,
    totalRow:     TOTAL_ROW,
    usedColumns:  USED_COLUMNS,
    metaWriter: (ws) => writeCompanyMeta(ws, masterData.companyInfo),
    rowWriter: (emp, _, oneIndex) => ({
      1:  oneIndex,
      2:  getString(emp, M.employeeCode),
      3:  getString(emp, M.employeeName),
      4:  getString(emp, M.department),          // col code AT=46=department (header says "Designation")
      5:  getString(emp, M.designation),          // col code AU=47=designation (header says "Department")
      6:  formatDate(getDate(emp, M.form22Date)),
      7:  getString(emp, M.form22NormalHours),
      8:  getNumber(emp, M.form22OtHours),
      9:  getNumber(emp, M.form22TotalHours),
      10: getNumber(emp, M.form22NormalWageRate),
      11: getNumber(emp, M.otWageRate),
      12: getNumber(emp, M.form22OtWages),
      13: getString(emp, M.workerSignature),
      14: getString(emp, M.remarks),
    }),
    totalWriter: (ws, totalRow, rows) => {
      ws.getCell(totalRow, 1).value  = 'TOTAL';
      ws.getCell(totalRow, 8).value  = sumColumn(rows, 8);
      ws.getCell(totalRow, 9).value  = sumColumn(rows, 9);
      ws.getCell(totalRow, 12).value = sumColumn(rows, 12);
    },
  });
}
