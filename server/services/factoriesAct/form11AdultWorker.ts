/**
 * factoriesAct/form11AdultWorker.ts
 *
 * Generates Form_11_Adult_Worker.xlsx
 * FORM NO. 11 — Register of Adult Workers (Statutory Form Variant)
 * [See Rule 62(1)] — Factories Act, 1948 | Maharashtra Factories Rules, 1963
 *
 * ════════════════════════════════════════════════════════════════════════
 * TEMPLATE LAYOUT  (verified against Form_11_Adult_Worker.xlsx)
 *
 *  Row 1  → "FORM NO. 11"
 *  Row 2  → "[See Rule 62(1)] – Register of Adult Workers"
 *  Row 3  → "FACTORIES ACT, 1948 | Maharashtra Factories Rules, 1963"
 *  Row 4  → "Factory Name and Address:" | col 3 = factory name (OA/391)
 *  Row 5  → col 5 = "Factory Registration No.:" | col 6 = reg no (S/19)
 *             col 13 = "Financial Year:"
 *  Row 6  → (empty spacer row)
 *  Row 7  → Column headers (14 active cols)
 *  Row 8  → Column letter codes: A, I, OK, BU, CI, BV, QJ, JJ, AT, AU, AW, AG, JK, SI
 *             NOTE: No Nationality column in this form (differs from 01_Adult_Worker_Register)
 *  Row 9  → DATA START
 *  Row 28 → DATA END  (20 employee rows)
 *  Row 29 → TOTAL row
 *
 * COLUMN MAP  (template col → master col via FACTORIES_ACT_COLUMNS)
 *
 *  C1  → Serial No.                 (generated)
 *  C2  → employeeCode               9   (I)
 *  C3  → employeeName               401 (OK)
 *  C4  → guardianName               73  (BU)
 *  C5  → dateOfBirth                87  (CI)
 *  C6  → gender                     74  (BV)
 *  C7  → permanentAddress           452 (QJ)
 *  C8  → dateOfJoining              270 (JJ)
 *  C9  → department                 46  (AT)
 *  C10 → designation                47  (AU)
 *  C11 → shift                      49  (AW)
 *  C12 → natureOfWork               33  (AG)
 *  C13 → dateOfLeaving              271 (JK)
 *  C14 → remarks                    503 (SI)
 *
 * META CELLS:
 *  (4, 3)  → establishmentName  (391 / OA)
 *  (5, 6)  → factoryLicenceNo   (19  / S)
 *
 * TO CHANGE A COLUMN: edit factoriesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getDate, formatDate } from '../shared/masterReader.js';
import { FACTORIES_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCell } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Form 11';
const DATA_START_ROW = 9;
const DATA_END_ROW   = 28;
const TOTAL_ROW      = 29;
const USED_COLUMNS   = 14;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCell(ws, 4, 3, getString(companyInfo, M.establishmentName));  // OA → row4 col3
  fillCell(ws, 5, 6, getString(companyInfo, M.factoryLicenceNo));   // S  → row5 col6
}

export async function generateForm11AdultWorker(
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
      4:  getString(emp, M.guardianName),
      5:  formatDate(getDate(emp, M.dateOfBirth)),
      6:  getString(emp, M.gender),
      7:  getString(emp, M.permanentAddress),
      8:  formatDate(getDate(emp, M.dateOfJoining)),
      9:  getString(emp, M.department),
      10: getString(emp, M.designation),
      11: getString(emp, M.shift),
      12: getString(emp, M.natureOfWork),
      13: formatDate(getDate(emp, M.dateOfLeaving)),
      14: getString(emp, M.remarks),
    }),
    totalWriter: (_ws, _totalRow, _rows) => { /* no numeric totals for this register */ },
  });
}
