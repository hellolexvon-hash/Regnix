/**
 * clraAct/bonusRegister.ts
 *
 * Generates Register of Bonus — Payment of Bonus Act
 * Maintained under CLRA Act 1970 records
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9
 *  C3  → employeeName               101
 *  C4  → designation                47
 *  C5  → bonusDoj                   270
 *  C6–C15 → calculated/blank        (bonus calculations; left blank for manual entry)
 *
 * Template columns C6–C15 (months worked, basic+DA, annual, allocable surplus,
 * min bonus, max bonus, bonus %, bonus amount, paid date, mode) are financial
 * calculations that depend on annual payroll data not in the monthly master.
 * They are intentionally left blank for manual completion.
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getDate, formatDate } from '../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Bonus Register Bonus Act';
const DATA_START_ROW = 5;
const DATA_END_ROW   = 12;
const TOTAL_ROW      = 13;
const USED_COLUMNS   = 15;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCellAddress(ws, 'A2', `REGISTER OF BONUS  |  Establishment: ${getString(companyInfo, M.establishmentName)}`);
}

export async function generateBonusRegister(
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
      5:  formatDate(getDate(emp, M.bonusDoj)),
      // C6–C15: bonus calculation fields — left blank for manual entry
    }),
    totalWriter: (_ws, _totalRow, _rows) => { /* no auto totals */ },
  });
}
