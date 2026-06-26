/**
 * server/services/seAct/registerFines.ts
 *
 * Register of Fines (Form-B / Form-B) — all states.
 *
 * COLUMN MAP (template col position → master col):
 *   1  → 1   slNo
 *   2  → 9   employeeCode
 *   3  → 401 employeeName
 *   4  → 47  designation
 *   5  → 295 dateOfOffence
 *   6  → 431 natureOfOffence
 *   7  → 296 dateShowCauseNotice
 *   8  → 553 employeeExplanation
 *   9  → 297 dateExplanationReceived
 *   10 → 302 amountOfFine
 *   11 → 298 dateFineImposed
 *   12 → 216 dateFineRealized
 *   13 → 217 remarks
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

export async function generateRegisterFines(
  templateBuffer: Buffer,
  employees: MasterRow[],
): Promise<Buffer> {
  const wb = await loadWorkbookFromBuffer(templateBuffer);
  const ws = wb.getWorksheet(1) ?? wb.worksheets[0];
  if (!ws) throw new Error('seAct/registerFines: no worksheet in template');

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
    safeSetCell(ws, rowNum, 5,  formatDate(getDate(emp, C.dateOfOffence)));
    safeSetCell(ws, rowNum, 6,  getString(emp, C.natureOfOffence));
    safeSetCell(ws, rowNum, 7,  formatDate(getDate(emp, C.dateShowCauseNotice)));
    safeSetCell(ws, rowNum, 8,  getString(emp, C.employeeExplanation));
    safeSetCell(ws, rowNum, 9,  formatDate(getDate(emp, C.dateExplanationReceived)));
    safeSetCell(ws, rowNum, 10, getNumber(emp, C.amountOfFine));
    safeSetCell(ws, rowNum, 11, formatDate(getDate(emp, C.dateFineImposed)));
    safeSetCell(ws, rowNum, 12, formatDate(getDate(emp, C.dateFineRealized)));
    safeSetCell(ws, rowNum, 13, getString(emp, C.fineRemarks));
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
