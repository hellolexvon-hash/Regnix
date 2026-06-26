/**
 * clraAct/lwfPtRegister.ts
 *
 * Generates LWF and PT Register
 * Labour Welfare Fund & Professional Tax — maintained under CLRA records
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9
 *  C3  → employeeName               101
 *  C4  → designation                47
 *  C5  → employeeState              454
 *  C6  → grossWagesLwf              273
 *  C7  → employeeLwfAmt             248
 *  C8  → employerLwfAmt             247
 *  C9  → totalLwf                   249
 *  C10 → lwfFrequency               417
 *  C11 → lwfDueDate                 250
 *  C12 → ptAmountLwf                251
 *  C13 → ptFrequency                253
 *  C14 → ptDueDate                  252
 *  C15 → ptChallanNo                412
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber } from '../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'LWF and PT Register';
const DATA_START_ROW = 5;
const DATA_END_ROW   = 12;
const TOTAL_ROW      = 13;
const USED_COLUMNS   = 15;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCellAddress(ws, 'A2', `LABOUR WELFARE FUND & PROFESSIONAL TAX REGISTER  |  ${getString(companyInfo, M.establishmentName)}`);
}

export async function generateLwfPtRegister(
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
      5:  getString(emp, M.employeeState),
      6:  getNumber(emp, M.grossWagesLwf),
      7:  getNumber(emp, M.employeeLwfAmt),
      8:  getNumber(emp, M.employerLwfAmt),
      9:  getNumber(emp, M.totalLwf),
      10: getString(emp, M.lwfFrequency),
      11: getString(emp, M.lwfDueDate),
      12: getNumber(emp, M.ptAmountLwf),
      13: getString(emp, M.ptFrequency),
      14: getString(emp, M.ptDueDate),
      15: getString(emp, M.ptChallanNo),
    }),
    totalWriter: (ws, totalRow, rows) => {
      ws.getCell(totalRow, 1).value = 'TOTAL';
      ws.getCell(totalRow, 6).value = sumColumn(rows, 6);
      ws.getCell(totalRow, 7).value = sumColumn(rows, 7);
      ws.getCell(totalRow, 8).value = sumColumn(rows, 8);
      ws.getCell(totalRow, 9).value = sumColumn(rows, 9);
      ws.getCell(totalRow, 12).value = sumColumn(rows, 12);
    },
  });
}
