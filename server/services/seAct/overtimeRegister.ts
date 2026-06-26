/**
 * server/services/seAct/overtimeRegister.ts
 *
 * Overtime Register (State-Specific) — all states.
 *
 * COLUMN MAP (template col position → master col):
 *   1  → 1   slNo
 *   2  → 567 month           (blank — no master col)
 *   3  → 9   employeeCode
 *   4  → 401 employeeName
 *   5  → 47  designation
 *   6  → 223 dateOfOt
 *   7  → 415 otStartTime
 *   8  → 434 otEndTime
 *   9  → 440 otHours
 *   10 → 225 otRate
 *   11 → 226 otAmount
 *   12 → 524 reasonForOt
 *   13 → 567 supervisorApproval  (blank)
 *   14 → 514 otRemarks
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

const DATA_START_ROW = 6; // row 5 = note row, row 6 = first data row

export async function generateOvertimeRegister(
  templateBuffer: Buffer,
  employees: MasterRow[],
): Promise<Buffer> {
  const wb = await loadWorkbookFromBuffer(templateBuffer);
  const ws = wb.getWorksheet(1) ?? wb.worksheets[0];
  if (!ws) throw new Error('seAct/overtimeRegister: no worksheet in template');

  const templateDataRows = countTemplateDataRows(ws, DATA_START_ROW);
  if (employees.length > templateDataRows) {
    ws.spliceRows(DATA_START_ROW + templateDataRows, 0, ...Array(employees.length - templateDataRows).fill([]));
  }

  employees.forEach((emp, idx) => {
    const rowNum = DATA_START_ROW + idx;
    safeSetCell(ws, rowNum, 1,  idx + 1);
    safeSetCell(ws, rowNum, 2,  null);  // month — manual entry
    safeSetCell(ws, rowNum, 3,  getString(emp, C.employeeCode));
    safeSetCell(ws, rowNum, 4,  getString(emp, C.employeeName));
    safeSetCell(ws, rowNum, 5,  getString(emp, C.designation));
    safeSetCell(ws, rowNum, 6,  formatDate(getDate(emp, C.dateOfOt)));
    safeSetCell(ws, rowNum, 7,  getString(emp, C.otStartTime));
    safeSetCell(ws, rowNum, 8,  getString(emp, C.otEndTime));
    safeSetCell(ws, rowNum, 9,  getNumber(emp, C.otHours));
    safeSetCell(ws, rowNum, 10, getNumber(emp, C.otRate));
    safeSetCell(ws, rowNum, 11, getNumber(emp, C.otAmount));
    safeSetCell(ws, rowNum, 12, getString(emp, C.reasonForOt));
    safeSetCell(ws, rowNum, 13, null);  // supervisor approval — manual
    safeSetCell(ws, rowNum, 14, getString(emp, C.otRemarks));
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
