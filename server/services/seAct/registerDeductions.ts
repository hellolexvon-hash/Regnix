/**
 * server/services/seAct/registerDeductions.ts
 *
 * Register of Deductions (Form-C) — all states.
 *
 * COLUMN MAP (template col position → master col):
 *   1  → 1   slNo
 *   2  → 568 monthYear        (blank — no master col, left empty)
 *   3  → 9   employeeCode
 *   4  → 401 employeeName
 *   5  → 47  designation
 *   6  → 209 natureOfDeduction
 *   7  → 292 amountDeducted
 *   8  → 311 dateOfDeduction
 *   9  → 567 reasonAuthority  (blank — no master col)
 *   10 → 569 showCauseIssued  (blank — no master col)
 *   11 → 569 employeeConsent  (blank)
 *   12 → 436 balanceAfterDeduction
 *   13 → 569 authorisedBy     (blank)
 *   14 → 569 remarks          (blank)
 *
 * Columns 568, 567, 569 are placeholders with no master data — left blank.
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

export async function generateRegisterDeductions(
  templateBuffer: Buffer,
  employees: MasterRow[],
): Promise<Buffer> {
  const wb = await loadWorkbookFromBuffer(templateBuffer);
  const ws = wb.getWorksheet(1) ?? wb.worksheets[0];
  if (!ws) throw new Error('seAct/registerDeductions: no worksheet in template');

  const templateDataRows = countTemplateDataRows(ws, DATA_START_ROW);
  if (employees.length > templateDataRows) {
    ws.spliceRows(DATA_START_ROW + templateDataRows, 0, ...Array(employees.length - templateDataRows).fill([]));
  }

  employees.forEach((emp, idx) => {
    const rowNum = DATA_START_ROW + idx;
    safeSetCell(ws, rowNum, 1,  idx + 1);
    safeSetCell(ws, rowNum, 2,  null);  // monthYear — manual entry
    safeSetCell(ws, rowNum, 3,  getString(emp, C.employeeCode));
    safeSetCell(ws, rowNum, 4,  getString(emp, C.employeeName));
    safeSetCell(ws, rowNum, 5,  getString(emp, C.designation));
    safeSetCell(ws, rowNum, 6,  getString(emp, C.natureOfDeduction));
    safeSetCell(ws, rowNum, 7,  getNumber(emp, C.amountDeducted));
    safeSetCell(ws, rowNum, 8,  formatDate(getDate(emp, C.dateOfPayment)));
    safeSetCell(ws, rowNum, 9,  null);  // reason/authority — manual
    safeSetCell(ws, rowNum, 10, null);  // show cause issued — manual
    safeSetCell(ws, rowNum, 11, null);  // employee consent — manual
    safeSetCell(ws, rowNum, 12, getNumber(emp, C.balanceAfterDeduction));
    safeSetCell(ws, rowNum, 13, null);  // authorised by — manual
    safeSetCell(ws, rowNum, 14, null);  // remarks — manual
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
