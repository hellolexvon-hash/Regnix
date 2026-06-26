/**
 * codeOnWages/deductionsRegister.ts
 *
 * Generates Form II — Register of Deductions for Damage or Loss
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CODE_ON_WAGES_COLUMNS)
 *
 *  C1  → Sl No                 (generated)
 *  C2  → employeeCode          9
 *  C3  → employeeName          401   ← CORRECTED (was missing)
 *  C4  → department            46    ← CORRECTED (was missing)
 *  C5  → designation           47
 *  C6  → dateOfDamage          210
 *  C7  → natureOfDamage        209   ← CORRECTED (was missing)
 *  C8  → estimatedDamage       293   ← CORRECTED (was missing)
 *  C9  → dateShowCauseDamage   296
 *  C10 → replyReceived         435
 *  C11 → dateOfOrder           305
 *  C12 → amountOrdered         306
 *  C13 → wagePeriodRecovery    304   ← CORRECTED (was 307)
 *  C14 → amountRecoveredDamage 307   ← CORRECTED (was 304)
 *  C15 → balancePending        436
 *  C16 → cumulativeDeductedDamage 308
 *  C17 → pctWagesDeductedDamage   309
 *  C18 → damageRemarks         213
 *
 * TO CHANGE A COLUMN: edit codeOnWages/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate, round2 } from '../shared/masterReader.js';
import { CODE_ON_WAGES_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Form II - Deductions';
const DATA_START_ROW = 11;
const DATA_END_ROW   = 15;
const TOTAL_ROW      = 16;
const USED_COLUMNS   = 18;

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

export async function generateDeductionsRegister(
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
      const estimated     = round2(getNumber(emp, M.estimatedDamage));     // 293 ← CORRECTED
      const amtOrdered    = round2(getNumber(emp, M.amountOrdered));       // 306
      const amtRecovered  = round2(getNumber(emp, M.amountRecoveredDamage)); // 307 ← CORRECTED
      const balance       = amtOrdered !== null && amtRecovered !== null
        ? round2(amtOrdered - amtRecovered)
        : round2(getNumber(emp, M.balancePending));
      const cumulative    = round2(getNumber(emp, M.cumulativeDeductedDamage)); // 308
      const pct           = round2(getNumber(emp, M.pctWagesDeductedDamage));   // 309

      return {
        1:  oneIndex,
        2:  getString(emp, M.employeeCode),
        3:  getString(emp, M.employeeName),                              // 401 ← CORRECTED
        4:  getString(emp, M.department),                                // 46  ← CORRECTED
        5:  getString(emp, M.designation),
        6:  formatDate(getDate(emp, M.dateOfDamage)),                    // 210
        7:  getString(emp, M.natureOfDamage),                            // 209 ← CORRECTED
        8:  estimated,                                                   // 293 ← CORRECTED
        9:  formatDate(getDate(emp, M.dateShowCauseDamage)),             // 296
        10: getString(emp, M.replyReceived),                             // 435
        11: formatDate(getDate(emp, M.dateOfOrder)),                     // 305
        12: amtOrdered,                                                  // 306
        13: getString(emp, M.wagePeriodRecovery),                        // 304 ← CORRECTED
        14: amtRecovered,                                                // 307 ← CORRECTED
        15: balance,                                                     // 436
        16: cumulative,                                                  // 308
        17: pct !== null ? `${pct}%` : null,                             // 309
        18: getString(emp, M.damageRemarks) || getString(emp, M.remarks), // 213
      };
    },
    totalWriter: (ws, totalRow, rows) => {
      fillCellAddress(ws, `A${totalRow}`, 'Total');
      fillCellAddress(ws, `H${totalRow}`, sumColumn(rows, 8));
      fillCellAddress(ws, `L${totalRow}`, sumColumn(rows, 12));
      fillCellAddress(ws, `N${totalRow}`, sumColumn(rows, 14));
      fillCellAddress(ws, `O${totalRow}`, sumColumn(rows, 15));
      fillCellAddress(ws, `P${totalRow}`, sumColumn(rows, 16));
    },
  });
}
