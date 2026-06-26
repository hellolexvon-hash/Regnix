/**
 * clraAct/finesRegister.ts
 *
 * Generates FORM XXI — Register of Fines
 * Contract Labour (Regulation & Abolition) Act, 1970
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9
 *  C3  → employeeName               101
 *  C4  → designation                47
 *  C5  → dateOfOffence              295
 *  C6  → natureOfOffence            431
 *  C7  → dateShowCauseNotice        296
 *  C8  → employeeExplanation        553
 *  C9  → dateExplanationReceived    297
 *  C10 → amountOfFine               302
 *  C11 → dateFinePeriod             298
 *  C12 → dateFineRealized           216
 *  C13 → fineRemarks                217
 *
 * Header cells (rows 4–5):
 *   Row 4: Contractor name (col AB=28) | Licence No. (col G=7)
 *   Row 5: Principal Employer (col AD=30) | Location (col AB=28)
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCell } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Form XXI – Register of Fines';
const DATA_START_ROW = 8;
const DATA_END_ROW   = 17;
const TOTAL_ROW      = 28; // note row placed before footer notes
const USED_COLUMNS   = 13;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  const name    = getString(companyInfo, M.establishmentName);
  const licNo   = getString(companyInfo, M.licenceNumber);
  // Row 4: contractor name in col 2, licence in col 10
  fillCell(ws, 4, 2,  name);
  fillCell(ws, 4, 10, licNo);
  // Row 5: principal employer in col 2, location (address) in col 2 (shifted by template layout)
  fillCell(ws, 5, 2,  name);
  fillCell(ws, 5, 10, getString(companyInfo, M.address));
}

export async function generateFinesRegister(
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
      4:  getString(emp, M.designation),
      5:  formatDate(getDate(emp, M.dateOfOffence)),
      6:  getString(emp, M.natureOfOffence),
      7:  formatDate(getDate(emp, M.dateShowCauseNotice)),
      8:  getString(emp, M.employeeExplanation),
      9:  formatDate(getDate(emp, M.dateExplanationReceived)),
      10: getNumber(emp, M.amountOfFine),
      11: formatDate(getDate(emp, M.dateFinePeriod)),
      12: formatDate(getDate(emp, M.dateFineRealized)),
      13: getString(emp, M.fineRemarks),
    }),
    totalWriter: (_ws, _totalRow, _rows) => { /* no totals for fines register */ },
  });
}

