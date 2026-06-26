/**
 * codeOnWages/overtimeRegister.ts
 *
 * Generates Form III — Register of Overtime
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CODE_ON_WAGES_COLUMNS)
 *
 *  C1  → Sl No              (generated)
 *  C2  → employeeCode       9
 *  C3  → employeeName       401   ← CORRECTED (was missing)
 *  C4  → department         46    ← CORRECTED (was missing)
 *  C5  → designation        47
 *  C6  → normalRateOfWages  204   ← CORRECTED (daily rate, was 225)
 *  C7  → otRatePerHour      187
 *  C8  → otHoursWeek1       183
 *  C9  → otHoursWeek2       184
 *  C10 → otHoursWeek3       185
 *  C11 → otHoursWeek4       186
 *  C12 → totalOtHours       190   ← CORRECTED (was 440/224)
 *  C13 → otAmount           207
 *  C14 → dateOfPayment      311   ← CORRECTED (was missing)
 *  C15 → signature          398   ← CORRECTED (was missing)
 *  C16 → overtimeRemarks    514   ← CORRECTED (was missing)
 *
 * TO CHANGE A COLUMN: edit codeOnWages/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate, round2 } from '../shared/masterReader.js';
import { CODE_ON_WAGES_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Form III - Overtime Register';
const DATA_START_ROW = 11;
const DATA_END_ROW   = 16;
const TOTAL_ROW      = 17;
const USED_COLUMNS   = 16;

function monthYearLabel(employees: MasterData['employees']): string {
  const first = employees
    .map((r) => getDate(r, M.dateOfPayment))
    .find((v): v is Date => v instanceof Date);
  return (first ?? new Date()).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
  employees: MasterData['employees'],
): void {
  fillCellAddress(ws, 'C3', getString(companyInfo, M.establishmentName));
  fillCellAddress(ws, 'J3', getString(companyInfo, M.registrationNumber));
  fillCellAddress(ws, 'C4', getString(companyInfo, M.address));
  const payDate = employees.map((r) => getDate(r, M.dateOfPayment)).find((v): v is Date => v instanceof Date);
  fillCellAddress(ws, 'J4', String((payDate ?? new Date()).getFullYear()));
  fillCellAddress(ws, 'C5', getString(companyInfo, M.natureOfIndustry)); // 38 ← CORRECTED
  fillCellAddress(ws, 'C6', monthYearLabel(employees));
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
    metaWriter: (ws) => writeCompanyMeta(ws, masterData.companyInfo, masterData.employees),
    rowWriter: (emp, _, oneIndex) => {
      const w1 = round2(getNumber(emp, M.otHoursWeek1));  // 183
      const w2 = round2(getNumber(emp, M.otHoursWeek2));  // 184
      const w3 = round2(getNumber(emp, M.otHoursWeek3));  // 185
      const w4 = round2(getNumber(emp, M.otHoursWeek4));  // 186
      const totalOt = round2(getNumber(emp, M.totalOtHours)) // 190 ← CORRECTED
        ?? round2((w1 ?? 0) + (w2 ?? 0) + (w3 ?? 0) + (w4 ?? 0));
      const otAmt = round2(getNumber(emp, M.otAmount));   // 207

      return {
        1:  oneIndex,
        2:  getString(emp, M.employeeCode),
        3:  getString(emp, M.employeeName),                    // 401 ← CORRECTED
        4:  getString(emp, M.department),                      // 46
        5:  getString(emp, M.designation),                     // 47
        6:  round2(getNumber(emp, M.normalRateOfWages)),       // 204 ← CORRECTED (daily rate)
        7:  round2(getNumber(emp, M.otRatePerHour)),           // 187
        8:  w1,
        9:  w2,
        10: w3,
        11: w4,
        12: totalOt,                                           // 190 ← CORRECTED
        13: otAmt,                                             // 207
        14: formatDate(getDate(emp, M.dateOfPayment)),         // 311 ← CORRECTED
        15: getString(emp, M.signatureOrThumbImpressionOfWorkmen) || null, // 398 ← CORRECTED
        16: getString(emp, M.overtimeRemarks) || getString(emp, M.remarks), // 514 ← CORRECTED
      };
    },
    totalWriter: (ws, totalRow, rows) => {
      fillCellAddress(ws, `A${totalRow}`, 'Total');
      fillCellAddress(ws, `H${totalRow}`, sumColumn(rows, 8));
      fillCellAddress(ws, `I${totalRow}`, sumColumn(rows, 9));
      fillCellAddress(ws, `J${totalRow}`, sumColumn(rows, 10));
      fillCellAddress(ws, `K${totalRow}`, sumColumn(rows, 11));
      fillCellAddress(ws, `L${totalRow}`, sumColumn(rows, 12));
      fillCellAddress(ws, `M${totalRow}`, sumColumn(rows, 13));
    },
  });
}
