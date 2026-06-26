/**
 * server/services/seAct/registerWages.ts
 *
 * Register of Wages (Form-M / Form XXIII) — all states.
 *
 * COLUMN MAP (template col position → master col):
 *   1  → 1   slNo
 *   2  → 9   employeeCode
 *   3  → 401 employeeName
 *   4  → 46  department/designation
 *   5  → 246 daysWorked
 *   6  → 284 basicWage
 *   7  → 229 da
 *   8  → 230 hra
 *   9  → 233 conveyance
 *   10 → 231 medicalAllowance
 *   11 → 235 otherAllowance
 *   12 → 273 grossWages
 *   13 → 238 epfEmployee
 *   14 → 243 esicEmployee
 *   15 → 251 pt
 *   16 → 248 lwfEmployee
 *   17 → 266 advanceDeduction
 *   18 → 356 tds
 *   19 → 292 totalDeductions
 *   20 → 208 netWages
 *   21 → 430 modeOfPayment
 *   22 → 311 dateOfPayment
 *   23 → 398 signature
 *   24 → 503 remarks
 */

import ExcelJS from 'exceljs';
import {
  loadWorkbookFromBuffer,
  workbookToBuffer,
  safeSetCell,
} from '../shared/excelUtils.js';
import { getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { SE_ACT_COLUMNS as C } from './mapping.js';
import type { MasterRow } from '../shared/masterReader.js';

const DATA_START_ROW = 5; // row 4 = headers, row 5 = first data row

export async function generateRegisterWages(
  templateBuffer: Buffer,
  employees: MasterRow[],
): Promise<Buffer> {
  const wb = await loadWorkbookFromBuffer(templateBuffer);
  const ws = wb.getWorksheet(1) ?? wb.worksheets[0];
  if (!ws) throw new Error('seAct/registerWages: no worksheet in template');

  const templateDataRows = countTemplateDataRows(ws, DATA_START_ROW);
  if (employees.length > templateDataRows) {
    ws.spliceRows(DATA_START_ROW + templateDataRows, 0, ...Array(employees.length - templateDataRows).fill([]));
  }

  employees.forEach((emp, idx) => {
    const rowNum = DATA_START_ROW + idx;
    safeSetCell(ws, rowNum, 1,  idx + 1);
    safeSetCell(ws, rowNum, 2,  getString(emp, C.employeeCode));
    safeSetCell(ws, rowNum, 3,  getString(emp, C.employeeName));
    safeSetCell(ws, rowNum, 4,  getString(emp, C.department));
    safeSetCell(ws, rowNum, 5,  getNumber(emp, C.daysWorked));
    safeSetCell(ws, rowNum, 6,  getNumber(emp, C.basicWage));
    safeSetCell(ws, rowNum, 7,  getNumber(emp, C.da));
    safeSetCell(ws, rowNum, 8,  getNumber(emp, C.hra));
    safeSetCell(ws, rowNum, 9,  getNumber(emp, C.conveyance));
    safeSetCell(ws, rowNum, 10, getNumber(emp, C.medicalAllowance));
    safeSetCell(ws, rowNum, 11, getNumber(emp, C.otherAllowance));
    safeSetCell(ws, rowNum, 12, getNumber(emp, C.grossWages));
    safeSetCell(ws, rowNum, 13, getNumber(emp, C.epfEmployee));
    safeSetCell(ws, rowNum, 14, getNumber(emp, C.esicEmployee));
    safeSetCell(ws, rowNum, 15, getNumber(emp, C.pt));
    safeSetCell(ws, rowNum, 16, getNumber(emp, C.lwfEmployee));
    safeSetCell(ws, rowNum, 17, getNumber(emp, C.advanceDeduction));
    safeSetCell(ws, rowNum, 18, getNumber(emp, C.tds));
    safeSetCell(ws, rowNum, 19, getNumber(emp, C.totalDeductions));
    safeSetCell(ws, rowNum, 20, getNumber(emp, C.netWages));
    safeSetCell(ws, rowNum, 21, getString(emp, C.modeOfPayment));
    safeSetCell(ws, rowNum, 22, formatDate(getDate(emp, C.dateOfPayment)));
    safeSetCell(ws, rowNum, 23, getString(emp, C.signature));
    safeSetCell(ws, rowNum, 24, getString(emp, C.remarks));
  });

  return workbookToBuffer(wb);
}

function countTemplateDataRows(ws: ExcelJS.Worksheet, startRow: number): number {
  let count = 0;
  for (let r = startRow; r <= ws.rowCount; r++) {
    const cell = ws.getCell(r, 1);
    if (cell.value !== null && cell.value !== undefined) count++;
    else break;
  }
  return Math.max(count, 1);
}
