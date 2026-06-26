/**
 * clraAct/overtimeRegister.ts
 *
 * Generates FORM XXIII — Register of Overtime
 * Contract Labour (Regulation & Abolition) Act, 1970
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9
 *  C3  → employeeName               101
 *  C4  → designation                47
 *  C5  → dateOfOvertime             223
 *  C6  → normalWorkingHours         415
 *  C7  → overtimeHours              434
 *  C8  → totalOtHours               440
 *  C9  → normalRateOfWages          225
 *  C10 → otRate                     226
 *  C11 → otWagesPayable             207
 *  C12 → dateOfPayment              311
 *  C13 → signature                  398
 *  C14 → overtimeRemarks            514
 *
 * Header cells:
 *   Row 4: contractor name (col 2) | licence (col 8)
 *   Row 5: principal employer (col 2) | location (col 8)
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCell } from '../../shared/templateFiller.js';

const SHEET_TITLE    = 'Form XXIII – Reg. of Overtime';
const DATA_START_ROW = 8;
const DATA_END_ROW   = 17;
const TOTAL_ROW      = 33;
const USED_COLUMNS   = 14;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  const name = getString(companyInfo, M.establishmentName);
  fillCell(ws, 4, 2, name);
  fillCell(ws, 4, 8, getString(companyInfo, M.licenceNumber));
  fillCell(ws, 5, 2, name);
  fillCell(ws, 5, 8, getString(companyInfo, M.address));
}

export async function generateOvertimeRegister(
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
      5:  formatDate(getDate(emp, M.dateOfOvertime)),
      6:  getString(emp, M.normalWorkingHours),
      7:  getString(emp, M.overtimeHours),
      8:  getNumber(emp, M.totalOtHours),
      9:  getNumber(emp, M.normalRateOfWages),
      10: getNumber(emp, M.otRate),
      11: getNumber(emp, M.otWagesPayable),
      12: getString(emp, M.dateOfPayment),
      13: getString(emp, M.signature),
      14: getString(emp, M.overtimeRemarks),
    }),
    totalWriter: (ws, totalRow, rows) => {
      ws.getCell(totalRow, 1).value  = 'TOTAL';
      ws.getCell(totalRow, 8).value  = sumColumn(rows, 8);
      ws.getCell(totalRow, 11).value = sumColumn(rows, 11);
    },
  });
}
