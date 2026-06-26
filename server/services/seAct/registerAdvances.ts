/**
 * server/services/seAct/registerAdvances.ts
 *
 * Register of Advances (Form-D) — all states.
 *
 * COLUMN MAP (template col position → master col):
 *   1  → 1   slNo
 *   2  → 9   employeeCode
 *   3  → 401 employeeName
 *   4  → 47  designation
 *   5  → 523 dateOfAdvance
 *   6  → 411 purposeOfAdvance
 *   7  → 218 amountOfAdvance
 *   8  → 219 noOfInstallments
 *   9  → 294 installmentAmount
 *   10 → 211 dateOf1stRecovery
 *   11 → 304 amountRecoveredTillDate
 *   12 → 433 balanceOutstanding
 *   13 → 398 signature
 *   14 → 217 remarks
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

const DATA_START_ROW = 5;

export async function generateRegisterAdvances(
  templateBuffer: Buffer,
  employees: MasterRow[],
): Promise<Buffer> {
  const wb = await loadWorkbookFromBuffer(templateBuffer);
  const ws = wb.getWorksheet(1) ?? wb.worksheets[0];
  if (!ws) throw new Error('seAct/registerAdvances: no worksheet in template');

  const templateDataRows = countTemplateDataRows(ws, DATA_START_ROW);
  if (employees.length > templateDataRows) {
    ws.spliceRows(DATA_START_ROW + templateDataRows, 0, ...Array(employees.length - templateDataRows).fill([]));
  }

  employees.forEach((emp, idx) => {
    const rowNum = DATA_START_ROW + idx;
    safeSetCell(ws, rowNum, 1,  idx + 1);
    safeSetCell(ws, rowNum, 2,  getString(emp, C.employeeCode));
    safeSetCell(ws, rowNum, 3,  getString(emp, C.employeeName));
    safeSetCell(ws, rowNum, 4,  getString(emp, C.designation));
    safeSetCell(ws, rowNum, 5,  formatDate(getDate(emp, C.dateOfAdvance)));
    safeSetCell(ws, rowNum, 6,  getString(emp, C.purposeOfAdvance));
    safeSetCell(ws, rowNum, 7,  getNumber(emp, C.amountOfAdvance));
    safeSetCell(ws, rowNum, 8,  getNumber(emp, C.noOfInstallments));
    safeSetCell(ws, rowNum, 9,  getNumber(emp, C.installmentAmount));
    safeSetCell(ws, rowNum, 10, formatDate(getDate(emp, C.dateOf1stRecovery)));
    safeSetCell(ws, rowNum, 11, getNumber(emp, C.amountRecoveredTillDate));
    safeSetCell(ws, rowNum, 12, getNumber(emp, C.balanceOutstanding));
    safeSetCell(ws, rowNum, 13, getString(emp, C.signature));
    safeSetCell(ws, rowNum, 14, getString(emp, C.fineRemarks));
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
