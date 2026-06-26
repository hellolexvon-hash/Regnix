/**
 * factoriesAct/leaveWithWagesRegister.ts
 *
 * Generates 02_Leave_With_Wages_Register.xlsx
 * Leave With Wages Register
 * Factories Act, 1948 — Rule 78-A | Section 79
 *
 * ════════════════════════════════════════════════════════════════════════
 * TEMPLATE LAYOUT  (verified against 02_Leave_With_Wages_Register.xlsx)
 *
 *  Row 1  → Title
 *  Row 2  → "LEAVE WITH WAGES REGISTER"
 *  Row 3  → Rule reference
 *  Row 4  → "Factory Name and Address:" | col 3 = factory name (OA/391)
 *  Row 5  → col 5 = "Factory Registration No.:" | col 6 = reg no (S/19)
 *             col 13 = "Financial Year:"
 *  Row 6  → (empty spacer row)
 *  Row 7  → Column headers
 *  Row 8  → Column letter codes (A, I, OK, AT, GU, LC, PU, PV, LD, LF, LG, RV, PW, FZ, LE, SI)
 *  Row 9  → DATA START
 *  Row 28 → DATA END  (20 employee rows)
 *  Row 29 → TOTAL row
 *
 * COLUMN MAP  (template col → master col via FACTORIES_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9   (I)
 *  C3  → employeeName               401 (OK)
 *  C4  → department                 46  (AT)
 *  C5  → daysWorkedPrevYear         203 (GU)
 *  C6  → leaveEntitlement           315 (LC)
 *  C7  → leaveCF                    437 (PU)
 *  C8  → totalLeaveAvailable        438 (PV)
 *  C9  → leaveApplied               316 (LD)
 *  C10 → leaveFromDate              318 (LF)
 *  C11 → leaveToDate                319 (LG)
 *  C12 → typeOfLeave                490 (RV)
 *  C13 → leaveAvailed               439 (PW)
 *  C14 → leaveBalance               182 (FZ)
 *  C15 → wagesPaidDuringLeave       317 (LE)
 *  C16 → remarks                    503 (SI)
 *
 * META CELLS:
 *  (4, 3)  → establishmentName  (391 / OA)
 *  (5, 6)  → factoryLicenceNo   (19  / S)
 *
 * TOTALS: cols 5, 6, 9, 13, 14, 15
 *
 * TO CHANGE A COLUMN: edit factoriesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { FACTORIES_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCell } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Leave With Wages';
const DATA_START_ROW = 9;
const DATA_END_ROW   = 28;
const TOTAL_ROW      = 29;
const USED_COLUMNS   = 16;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCell(ws, 4, 3, getString(companyInfo, M.establishmentName));  // OA → row4 col3
  fillCell(ws, 5, 6, getString(companyInfo, M.factoryLicenceNo));   // S  → row5 col6
}

export async function generateLeaveWithWagesRegister(
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
      5:  getNumber(emp, M.daysWorkedPrevYear),
      6:  getNumber(emp, M.leaveEntitlement),
      7:  getNumber(emp, M.leaveCF),
      8:  getNumber(emp, M.totalLeaveAvailable),
      9:  getNumber(emp, M.leaveApplied),
      10: formatDate(getDate(emp, M.leaveFromDate)),
      11: formatDate(getDate(emp, M.leaveToDate)),
      12: getString(emp, M.typeOfLeave),
      13: getNumber(emp, M.leaveAvailed),
      14: getNumber(emp, M.leaveBalance),
      15: getNumber(emp, M.wagesPaidDuringLeave),
      16: getString(emp, M.remarks),
    }),
    totalWriter: (ws, totalRow, rows) => {
      ws.getCell(totalRow, 1).value  = 'TOTAL';
      ws.getCell(totalRow, 5).value  = sumColumn(rows, 5);
      ws.getCell(totalRow, 6).value  = sumColumn(rows, 6);
      ws.getCell(totalRow, 9).value  = sumColumn(rows, 9);
      ws.getCell(totalRow, 13).value = sumColumn(rows, 13);
      ws.getCell(totalRow, 14).value = sumColumn(rows, 14);
      ws.getCell(totalRow, 15).value = sumColumn(rows, 15);
    },
  });
}
