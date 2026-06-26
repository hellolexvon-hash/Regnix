/**
 * clraAct/wagesRegister.ts
 *
 * Generates FORM XVII — Register of Wages
 * Contract Labour (Regulation & Abolition) Act, 1970
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9
 *  C3  → employeeName               101
 *  C4  → department                 46
 *  C5  → netDaysWorked              246
 *  C6  → basicWage                  284
 *  C7  → da                         229
 *  C8  → hra                        230
 *  C9  → conveyanceAllowance        233
 *  C10 → medicalAllowance           231
 *  C11 → otherAllowance             235
 *  C12 → grossWages                 273
 *  C13 → employeePf                 262
 *  C14 → esicEmployee               243
 *  C15 → ptAmount                   251
 *  C16 → employeeLwf                247
 *  C17 → advanceDeduction           266
 *  C18 → tdsAmount                  356
 *  C19 → totalDeductions            292
 *  C20 → netWages                   208
 *  C21 → paymentMode                430
 *  C22 → dateOfPayment              311
 *  C23 → signature                  398
 *  C24 → remarks                    503
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber } from '../../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../../shared/templateFiller.js';

const SHEET_TITLE    = 'Form XVII Wages Register';
const DATA_START_ROW = 5;
const DATA_END_ROW   = 14;
const TOTAL_ROW      = 15;
const USED_COLUMNS   = 24;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCellAddress(ws, 'A2', `FORM XVII — REGISTER OF WAGES  |  ${getString(companyInfo, M.establishmentName)}`);
}

export async function generateWagesRegister(
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
      4:  getString(emp, M.department),
      5:  getNumber(emp, M.netDaysWorked),
      6:  getNumber(emp, M.basicWage),
      7:  getNumber(emp, M.da),
      8:  getNumber(emp, M.hra),
      9:  getNumber(emp, M.conveyanceAllowance),
      10: getNumber(emp, M.medicalAllowance),
      11: getNumber(emp, M.otherAllowance),
      12: getNumber(emp, M.grossWages),
      13: getNumber(emp, M.employeePf),
      14: getNumber(emp, M.esicEmployee),
      15: getNumber(emp, M.ptAmount),
      16: getNumber(emp, M.employeeLwf),
      17: getNumber(emp, M.advanceDeduction),
      18: getNumber(emp, M.tdsAmount),
      19: getNumber(emp, M.totalDeductions),
      20: getNumber(emp, M.netWages),
      21: getString(emp, M.paymentMode),
      22: getString(emp, M.dateOfPayment),
      23: getString(emp, M.signature),
      24: getString(emp, M.remarks),
    }),
    totalWriter: (ws, totalRow, rows) => {
      ws.getCell(totalRow, 1).value  = 'TOTAL';
      ws.getCell(totalRow, 5).value  = sumColumn(rows, 5);
      ws.getCell(totalRow, 6).value  = sumColumn(rows, 6);
      ws.getCell(totalRow, 7).value  = sumColumn(rows, 7);
      ws.getCell(totalRow, 8).value  = sumColumn(rows, 8);
      ws.getCell(totalRow, 9).value  = sumColumn(rows, 9);
      ws.getCell(totalRow, 10).value = sumColumn(rows, 10);
      ws.getCell(totalRow, 11).value = sumColumn(rows, 11);
      ws.getCell(totalRow, 12).value = sumColumn(rows, 12);
      ws.getCell(totalRow, 13).value = sumColumn(rows, 13);
      ws.getCell(totalRow, 14).value = sumColumn(rows, 14);
      ws.getCell(totalRow, 15).value = sumColumn(rows, 15);
      ws.getCell(totalRow, 16).value = sumColumn(rows, 16);
      ws.getCell(totalRow, 17).value = sumColumn(rows, 17);
      ws.getCell(totalRow, 18).value = sumColumn(rows, 18);
      ws.getCell(totalRow, 19).value = sumColumn(rows, 19);
      ws.getCell(totalRow, 20).value = sumColumn(rows, 20);
    },
  });
}
