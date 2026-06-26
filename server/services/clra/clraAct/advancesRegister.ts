/**
 * clraAct/advancesRegister.ts
 *
 * Generates FORM XXII — Register of Advances
 * Contract Labour (Regulation & Abolition) Act, 1970
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9
 *  C3  → employeeName               101
 *  C4  → designation                47
 *  C5  → dateOfAdvance              523
 *  C6  → purposeOfAdvance           411
 *  C7  → amountOfAdvance            218
 *  C8  → numberOfInstallmentsAdv    219
 *  C9  → amountEachInstallment      294
 *  C10 → dateFirstRecovery          211
 *  C11 → amountRecoveredTillDate    304
 *  C12 → balanceOutstanding         433
 *  C13 → advanceSignature           398
 *  C14 → advanceRemarks             217
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCell } from '../../shared/templateFiller.js';

const SHEET_TITLE    = 'Form XXII – Reg. of Advances';
const DATA_START_ROW = 8;
const DATA_END_ROW   = 17;
const TOTAL_ROW      = 28;
const USED_COLUMNS   = 14;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  const name = getString(companyInfo, M.establishmentName);
  // Row 4: col 3 = contractor name, col 10 = licence no
  fillCell(ws, 4, 3,  name);
  fillCell(ws, 4, 10, getString(companyInfo, M.licenceNumber));
  // Row 5: col 3 = principal employer, col 10 = location/address
  fillCell(ws, 5, 3,  name);
  fillCell(ws, 5, 10, getString(companyInfo, M.address));
}

export async function generateAdvancesRegister(
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
      5:  formatDate(getDate(emp, M.dateOfAdvance)),
      6:  getString(emp, M.purposeOfAdvance),
      7:  getNumber(emp, M.amountOfAdvance),
      8:  getNumber(emp, M.numberOfInstallmentsAdv),
      9:  getNumber(emp, M.amountEachInstallment),
      10: formatDate(getDate(emp, M.dateFirstRecovery)),
      11: getNumber(emp, M.amountRecoveredTillDate),
      12: getNumber(emp, M.balanceOutstanding),
      13: getString(emp, M.advanceSignature),
      14: getString(emp, M.advanceRemarks),
    }),
    totalWriter: (_ws, _totalRow, _rows) => { /* no totals */ },
  });
}
