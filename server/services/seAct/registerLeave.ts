/**
 * server/services/seAct/registerLeave.ts
 *
 * Register of Leave (Form-K / Form T / Form XXV) — all states.
 *
 * COLUMN MAP (template col position → master col):
 *   1  → 1   slNo
 *   2  → 9   employeeCode
 *   3  → 401 employeeName
 *   4  → 47  designation
 *   5  → 46  department
 *   6  → 178 elOpeningBalance
 *   7  → 191 elEarned
 *   8  → 439 elAvailed
 *   9  → 191 elClosingBalance  (same col — template computed, we write earned)
 *   10 → 180 slOpeningBalance
 *   11 → 180 slAvailed
 *   12 → 193 slClosingBalance
 *   13 → 179 clOpeningBalance
 *   14 → 192 clAvailed
 *   15 → 192 clClosingBalance
 *   16 → 414 nationalHolidays
 *   17 → 313 weeklyOffAvailed
 *   18 → 503 remarks
 *
 * Karnataka Form T uses 13 cols (no dept, condensed leave fields):
 *   1  → 1   slNo
 *   2  → 9   employeeCode
 *   3  → 401 employeeName
 *   4  → 47  designation
 *   5  → 178 elOpeningBalance
 *   6  → 191 elEarned
 *   7  → 179 clAvailable
 *   8  → 180 slAvailable
 *   9  → 439 leaveAvailedEL
 *   10 → 192 leaveAvailedCL
 *   11 → 180 leaveAvailedSL
 *   12 → 191 leaveClosingBalance
 *   13 → 503 remarks
 */

import ExcelJS from 'exceljs';
import {
  loadWorkbookFromBuffer,
  workbookToBuffer,
  safeSetCell,
} from '../shared/excelUtils.js';
import { getString, getNumber } from '../shared/masterReader.js';
import { SE_ACT_COLUMNS as C } from './mapping.js';
import type { MasterRow } from '../shared/masterReader.js';

const DATA_START_ROW = 8;

export async function generateRegisterLeave(
  templateBuffer: Buffer,
  employees: MasterRow[],
  state: string,
): Promise<Buffer> {
  const wb = await loadWorkbookFromBuffer(templateBuffer);
  const ws = wb.getWorksheet(1) ?? wb.worksheets[0];
  if (!ws) throw new Error('seAct/registerLeave: no worksheet in template');

  const templateDataRows = countTemplateDataRows(ws, DATA_START_ROW);
  if (employees.length > templateDataRows) {
    ws.spliceRows(DATA_START_ROW + templateDataRows, 0, ...Array(employees.length - templateDataRows).fill([]));
  }

  const isKarnataka = state.toLowerCase() === 'karnataka';

  employees.forEach((emp, idx) => {
    const rowNum = DATA_START_ROW + idx;
    if (isKarnataka) {
      // Karnataka Form T — 13 columns
      safeSetCell(ws, rowNum, 1,  idx + 1);
      safeSetCell(ws, rowNum, 2,  getString(emp, C.employeeCode));
      safeSetCell(ws, rowNum, 3,  getString(emp, C.employeeName));
      safeSetCell(ws, rowNum, 4,  getString(emp, C.designation));
      safeSetCell(ws, rowNum, 5,  getNumber(emp, C.elOpeningBalance));
      safeSetCell(ws, rowNum, 6,  getNumber(emp, C.elEarned));
      safeSetCell(ws, rowNum, 7,  getNumber(emp, C.clOpeningBalance));
      safeSetCell(ws, rowNum, 8,  getNumber(emp, C.slOpeningBalance));
      safeSetCell(ws, rowNum, 9,  getNumber(emp, C.elAvailed));
      safeSetCell(ws, rowNum, 10, getNumber(emp, C.clAvailed));
      safeSetCell(ws, rowNum, 11, getNumber(emp, C.slAvailed));
      safeSetCell(ws, rowNum, 12, getNumber(emp, C.elEarned)); // closing balance (EL earned - availed)
      safeSetCell(ws, rowNum, 13, getString(emp, C.remarks));
    } else {
      // Standard Form-K — 18 columns
      safeSetCell(ws, rowNum, 1,  idx + 1);
      safeSetCell(ws, rowNum, 2,  getString(emp, C.employeeCode));
      safeSetCell(ws, rowNum, 3,  getString(emp, C.employeeName));
      safeSetCell(ws, rowNum, 4,  getString(emp, C.designation));
      safeSetCell(ws, rowNum, 5,  getString(emp, C.department));
      safeSetCell(ws, rowNum, 6,  getNumber(emp, C.elOpeningBalance));
      safeSetCell(ws, rowNum, 7,  getNumber(emp, C.elEarned));
      safeSetCell(ws, rowNum, 8,  getNumber(emp, C.elAvailed));
      safeSetCell(ws, rowNum, 9,  getNumber(emp, C.elEarned));   // EL closing
      safeSetCell(ws, rowNum, 10, getNumber(emp, C.slOpeningBalance));
      safeSetCell(ws, rowNum, 11, getNumber(emp, C.slAvailed));
      safeSetCell(ws, rowNum, 12, getNumber(emp, C.slClosingBalance));
      safeSetCell(ws, rowNum, 13, getNumber(emp, C.clOpeningBalance));
      safeSetCell(ws, rowNum, 14, getNumber(emp, C.clAvailed));
      safeSetCell(ws, rowNum, 15, getNumber(emp, C.clClosingBalance));
      safeSetCell(ws, rowNum, 16, getNumber(emp, C.nationalHolidays));
      safeSetCell(ws, rowNum, 17, getNumber(emp, C.weeklyOffAvailed));
      safeSetCell(ws, rowNum, 18, getString(emp, C.remarks));
    }
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
