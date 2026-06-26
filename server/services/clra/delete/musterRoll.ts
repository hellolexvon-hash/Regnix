/**
 * clraAct/musterRoll.ts
 *
 * Generates FORM XIV / FORM XVI — Muster Roll
 * Contract Labour (Regulation & Abolition) Act, 1970
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1     → Sl. No.                 (generated)
 *  C2     → employeeCode            9
 *  C3     → employeeName            101
 *  C4     → designation             47
 *  C5     → department              46
 *  C6–C36 → dayColumns[0..30]       144–174
 *  C37    → totalDaysPresent        199
 *  C38    → totalDaysAbsent         200
 *  C39    → totalWoHolidays         201
 *  C40    → overtimeDays            202
 *  C41    → totalLop                312
 *  C42    → netDaysWorked           246
 *  C43    → musterRollRemarks       176
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber } from '../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Form XIV-XVI Muster Roll';
const DATA_START_ROW = 6;
const DATA_END_ROW   = 15;
const TOTAL_ROW      = 16;
const USED_COLUMNS   = 43;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCellAddress(ws, 'A1', `FORM XIV / FORM XVI — MUSTER ROLL  |  ${getString(companyInfo, M.establishmentName)}`);
}

export async function generateMusterRoll(
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
    rowWriter: (emp, _, oneIndex) => {
      const row: Record<number, string | number | null> = {
        1:  oneIndex,
        2:  getString(emp, M.employeeCode),
        3:  getString(emp, M.employeeName),
        4:  getString(emp, M.designation),
        5:  getString(emp, M.department),
      };

      // Day columns C6–C36 (31 days)
      M.dayColumns.forEach((masterCol, dayIdx) => {
        row[6 + dayIdx] = getString(emp, masterCol);
      });

      row[37] = getNumber(emp, M.totalDaysPresent);
      row[38] = getNumber(emp, M.totalDaysAbsent);
      row[39] = getNumber(emp, M.totalWoHolidays);
      row[40] = getNumber(emp, M.overtimeDays);
      row[41] = getNumber(emp, M.totalLop);
      row[42] = getNumber(emp, M.netDaysWorked);
      row[43] = getString(emp, M.musterRollRemarks);

      return row;
    },
    totalWriter: (_ws, _totalRow, _rows) => { /* template has no totals row */ },
  });
}
