/**
 * factoriesAct/overtimeRegister.ts
 *
 * Generates 03_Overtime_Register.xlsx
 * Overtime Register
 * Factories Act, 1948 — Rule 63 | Section 59
 *
 * ════════════════════════════════════════════════════════════════════════
 * TEMPLATE LAYOUT  (verified against 03_Overtime_Register.xlsx)
 *
 *  Row 1  → Title
 *  Row 2  → "OVERTIME REGISTER"
 *  Row 3  → Rule reference
 *  Row 4  → "Factory Name and Address:" | col 3 = factory name (OA/391)
 *  Row 5  → col 5 = "Factory Registration No.:" | col 6 = reg no (S/19)
 *             col 13 = "Financial Year:"
 *  Row 6  → (empty spacer row)
 *  Row 7  → Column headers
 *  Row 8  → Column letter codes:
 *             A, I, OK, AT, [none], HO, GG, PR, PX, GE, HR, HS, TD, JY, OH, [none]
 *             Note: col 5 (Designation) and col 16 (Remarks) have no letter code in template
 *             but Factory_s_Act.xlsx confirms col5=AU=47, col16=SI=503
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
 *  C5  → designation                47  (AU) — no code in template col-code row; ref: Factory_s_Act row 38
 *  C6  → dateOfOvertime             223 (HO)
 *  C7  → normalHoursWorked          189 (GG)
 *  C8  → overtimeHoursWorked        434 (PR)
 *  C9  → totalHoursWorked           440 (PX)
 *  C10 → normalWageRate             187 (GE)
 *  C11 → otWageRate                 226 (HR)
 *  C12 → otWagesPayable             227 (HS)
 *  C13 → reasonForOvertime          524 (TD)
 *  C14 → supervisorSignature        285 (JY)
 *  C15 → workerSignature            398 (OH)
 *  C16 → remarks                    503 (SI) — no code in template col-code row; ref: Factory_s_Act row 49
 *
 * META CELLS:
 *  (4, 3)  → establishmentName  (391 / OA)
 *  (5, 6)  → factoryLicenceNo   (19  / S)
 *
 * TOTALS: cols 7, 8, 9, 12
 *
 * TO CHANGE A COLUMN: edit factoriesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { FACTORIES_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCell } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Overtime Register';
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

export async function generateOvertimeRegister(
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
      5:  getString(emp, M.designation),
      6:  formatDate(getDate(emp, M.dateOfOvertime)),
      7:  getNumber(emp, M.normalHoursWorked),
      8:  getNumber(emp, M.overtimeHoursWorked),
      9:  getNumber(emp, M.totalHoursWorked),
      10: getNumber(emp, M.normalWageRate),
      11: getNumber(emp, M.otWageRate),
      12: getNumber(emp, M.otWagesPayable),
      13: getString(emp, M.reasonForOvertime),
      14: getString(emp, M.supervisorSignature),
      15: getString(emp, M.workerSignature),
      16: getString(emp, M.remarks),
    }),
    totalWriter: (ws, totalRow, rows) => {
      ws.getCell(totalRow, 1).value  = 'TOTAL';
      ws.getCell(totalRow, 7).value  = sumColumn(rows, 7);
      ws.getCell(totalRow, 8).value  = sumColumn(rows, 8);
      ws.getCell(totalRow, 9).value  = sumColumn(rows, 9);
      ws.getCell(totalRow, 12).value = sumColumn(rows, 12);
    },
  });
}
