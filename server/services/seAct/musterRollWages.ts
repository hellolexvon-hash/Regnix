/**
 * server/services/seAct/musterRollWages.ts
 *
 * Form T — Combined Muster Roll cum Register of Wages (Telangana only).
 * Also used for other states that have a combined muster+wage register.
 *
 * COLUMN MAP (template col position → master col):
 *   1   → 9   employeeCode
 *   2   → 401 employeeName
 *   3   → 73  fatherOrHusbandName
 *   4   → 80  maleFemale
 *   5   → 47  designation
 *   6   → 270 dateOfJoining
 *   7   → 16  esicIpNo
 *   8   → 13  uanPf
 *   9–39 → 144–174  day1–day31
 *   40  → 271 dateOfSuspension
 *   41  → 246 daysWorked
 *   42  → 440 totalOtHours
 *   43  → 284 basicWage
 *   44  → 229 da
 *   45  → 230 hra
 *   46  → 233 conveyance
 *   47  → 231 medicalAllowance
 *   48  → 278 bonus
 *   49  → 235 specialAllowance
 *   50  → 207 otAmount
 *   51  → 414 nfh
 *   52  → 450 maternity
 *   53  → 335 others
 *   54  → 339 subsistenceAllowance
 *   55  → 232 leaveEncashment
 *   56  → 273 grossTotal
 *   57  → 243 esic
 *   58  → 238 epf
 *   59  → 251 pt
 *   60  → 356 tds
 *   61  → 336 society
 *   62  → 337 insurance
 *   63  → 218 salaryAdvance
 *   64  → 302 fines
 *   65  → 312 damagesLoss
 *   66  → 335 other
 *   67  → 292 total
 *   68  → 274 netPayable
 *   69  → 430 modeOfPayment
 *   70  → 398 employeeSignature
 */

import ExcelJS from 'exceljs';
import {
  loadWorkbookFromBuffer,
  workbookToBuffer,
  safeSetCell,
} from '../shared/excelUtils.js';
import { getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { SE_ACT_COLUMNS as C } from './mapping.js';
import { ATTENDANCE_DAY_COLUMNS } from '../shared/masterColumns.js';
import type { MasterRow } from '../shared/masterReader.js';

const DATA_START_ROW = 4;

export async function generateMusterRollWages(
  templateBuffer: Buffer,
  employees: MasterRow[],
): Promise<Buffer> {
  const wb = await loadWorkbookFromBuffer(templateBuffer);
  const ws = wb.getWorksheet(1) ?? wb.worksheets[0];
  if (!ws) throw new Error('seAct/musterRollWages: no worksheet in template');

  const templateDataRows = countTemplateDataRows(ws, DATA_START_ROW);
  if (employees.length > templateDataRows) {
    ws.spliceRows(DATA_START_ROW + templateDataRows, 0, ...Array(employees.length - templateDataRows).fill([]));
  }

  employees.forEach((emp, idx) => {
    const rowNum = DATA_START_ROW + idx;
    let col = 1;

    safeSetCell(ws, rowNum, col++, getString(emp, C.employeeCode));
    safeSetCell(ws, rowNum, col++, getString(emp, C.employeeName));
    safeSetCell(ws, rowNum, col++, getString(emp, C.fatherOrHusbandName));
    safeSetCell(ws, rowNum, col++, getString(emp, C.maleFemale));
    safeSetCell(ws, rowNum, col++, getString(emp, C.designation));
    safeSetCell(ws, rowNum, col++, formatDate(getDate(emp, C.dateOfJoining)));
    safeSetCell(ws, rowNum, col++, getString(emp, C.esicIpNo));
    safeSetCell(ws, rowNum, col++, getString(emp, C.uanPf));

    // Day 1–31 attendance
    for (const dayCol of ATTENDANCE_DAY_COLUMNS) {
      safeSetCell(ws, rowNum, col++, getString(emp, dayCol));
    }

    safeSetCell(ws, rowNum, col++, formatDate(getDate(emp, C.dateOfTermination)));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.daysWorked));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.totalOtHours));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.basicWage));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.da));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.hra));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.conveyance));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.medicalAllowance));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.bonus));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.otherAllowance));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.otAmountMuster));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.nationalHolidays));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.maternity));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.others));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.subsistenceAllowance));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.leaveEncashment));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.grossWages));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.esicEmployee));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.epfEmployee));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.pt));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.tds));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.society));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.insurance));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.salaryAdvance));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.fines));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.damagesLoss));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.others));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.totalDeductions));
    safeSetCell(ws, rowNum, col++, getNumber(emp, C.netPayable));
    safeSetCell(ws, rowNum, col++, getString(emp, C.modeOfPayment));
    safeSetCell(ws, rowNum, col++, getString(emp, C.signature));
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
