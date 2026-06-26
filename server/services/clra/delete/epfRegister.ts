/**
 * clraAct/epfRegister.ts
 *
 * Generates EPF Register — Form 5 / 10 / 3A
 * Employees' Provident Funds & Miscellaneous Provisions Act, 1952
 * Maintained under CLRA Act 1970 records
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9
 *  C3  → employeeName               101
 *  C4  → guardianName               73
 *  C5  → dateOfBirth                87
 *  C6  → dateOfJoining              270
 *  C7  → uanNumber                  13
 *  C8  → pfMemberId                 237
 *  C9  → epfWages (Basic)           284
 *  C10 → epsWages                   260
 *  C11 → edliWages                  261
 *  C12 → employeePf12pct            262
 *  C13 → employerEps833             263
 *  C14 → employerEpfDiff            238
 *  C15 → edliEmployer05             261  (reuses JA column per template)
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'EPF Register Form 5-10-12';
const DATA_START_ROW = 5;
const DATA_END_ROW   = 12;
const TOTAL_ROW      = 13;
const USED_COLUMNS   = 15;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCellAddress(ws, 'A2', `EPF REGISTER  |  Establishment: ${getString(companyInfo, M.establishmentName)}`);
}

export async function generateEpfRegister(
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
      4:  getString(emp, M.guardianName),
      5:  formatDate(getDate(emp, M.dateOfBirth)),
      6:  formatDate(getDate(emp, M.dateOfJoining)),
      7:  getString(emp, M.uanNumber),
      8:  getString(emp, M.pfMemberId),
      9:  getNumber(emp, M.epfWages),
      10: getNumber(emp, M.epsWages),
      11: getNumber(emp, M.edliWages),
      12: getNumber(emp, M.employeePf12pct),
      13: getNumber(emp, M.employerEps833),
      14: getNumber(emp, M.employerEpfDiff),
      15: getNumber(emp, M.edliEmployer05),
    }),
    totalWriter: (ws, totalRow, rows) => {
      ws.getCell(totalRow, 1).value  = 'TOTAL';
      ws.getCell(totalRow, 9).value  = sumColumn(rows, 9);
      ws.getCell(totalRow, 10).value = sumColumn(rows, 10);
      ws.getCell(totalRow, 11).value = sumColumn(rows, 11);
      ws.getCell(totalRow, 12).value = sumColumn(rows, 12);
      ws.getCell(totalRow, 13).value = sumColumn(rows, 13);
      ws.getCell(totalRow, 14).value = sumColumn(rows, 14);
      ws.getCell(totalRow, 15).value = sumColumn(rows, 15);
    },
  });
}
