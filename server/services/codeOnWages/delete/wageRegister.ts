/**
 * codeOnWages/wageRegister.ts
 *
 * Generates Form IV — Wage Register
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CODE_ON_WAGES_COLUMNS)
 *
 *  C1  → Sl No              (generated)
 *  C2  → employeeCode       9
 *  C3  → employeeName       401   ← CORRECTED (was missing)
 *  C4  → department         46
 *  C5  → designation        47
 *  C6  → totalDaysWorked    246
 *  C7  → totalDaysAbsent    200
 *  C8  → basicWage          284   ← CORRECTED (was 259/ctc)
 *  C9  → da                 229   ← CORRECTED
 *  C10 → hra                230   ← CORRECTED
 *  C11 → conveyanceAllowance 233  ← CORRECTED
 *  C12 → specialAllowance   235   ← CORRECTED
 *  C13 → otAmount           227   ← CORRECTED (Form IV uses col 227)
 *  C14 → grossSalary        273   ← CORRECTED (was 274)
 *  C15 → employeePf         262   ← CORRECTED (was 238)
 *  C16 → esicEmployee       243   ← CORRECTED
 *  C17 → ptAmount           251
 *  C18 → advanceRefund      218   ← CORRECTED (was 266)
 *  C19 → otherDeduction     310
 *  C20 → totalDeduction     292
 *  C21 → netSalary          274   ← CORRECTED (was 208/275)
 *  C22 → dateOfPayment      311   ← CORRECTED
 *  C23 → bankAccountNumber  276   (Receipt/Bank txn ID)
 *  C24 → signature          398   ← CORRECTED (was null)
 *  C25 → remarks            503   ← CORRECTED
 *
 * TO CHANGE A COLUMN: edit codeOnWages/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import * as ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate, round2 } from '../shared/masterReader.js';
import { CODE_ON_WAGES_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Form IV - Wage Register';
const DATA_START_ROW = 11;
const DATA_END_ROW   = 18;
const TOTAL_ROW      = 19;
const USED_COLUMNS   = 25;

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

export async function generateWageRegister(
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
      const basic     = round2(getNumber(emp, M.basicWage));          // 284 ← CORRECTED
      const da        = round2(getNumber(emp, M.da));                 // 229 ← CORRECTED
      const hra       = round2(getNumber(emp, M.hra));                // 230 ← CORRECTED
      const conv      = round2(getNumber(emp, M.conveyanceAllowance)); // 233 ← CORRECTED
      const special   = round2(getNumber(emp, M.specialAllowance));   // 235 ← CORRECTED
      const otAmt     = round2(getNumber(emp, M.otAmountFormIV));     // 227 ← CORRECTED

      const gross = round2(getNumber(emp, M.grossSalary)) ?? round2( // 273 ← CORRECTED
        (basic ?? 0) + (da ?? 0) + (hra ?? 0) + (conv ?? 0) + (special ?? 0) + (otAmt ?? 0),
      );

      const pf        = round2(getNumber(emp, M.employeePf));         // 262 ← CORRECTED
      const esi       = round2(getNumber(emp, M.esicEmployee));       // 243 ← CORRECTED
      const pt        = round2(getNumber(emp, M.ptAmount));           // 251
      const advance   = round2(getNumber(emp, M.advanceRefund));      // 218 ← CORRECTED
      const otherDedn = round2(getNumber(emp, M.otherDeduction));     // 310

      const totalDedn = round2(getNumber(emp, M.totalDeduction)) ?? round2(
        (pf ?? 0) + (esi ?? 0) + (pt ?? 0) + (advance ?? 0) + (otherDedn ?? 0),
      );

      const net = round2(getNumber(emp, M.netSalary)) ?? round2(     // 274 ← CORRECTED
        (gross ?? 0) - (totalDedn ?? 0),
      );

      return {
        1:  oneIndex,
        2:  getString(emp, M.employeeCode),
        3:  getString(emp, M.employeeName),                             // 401 ← CORRECTED
        4:  getString(emp, M.department),
        5:  getString(emp, M.designation),
        6:  getNumber(emp, M.totalDaysWorked),                         // 246
        7:  getNumber(emp, M.totalDaysAbsent),                         // 200
        8:  basic,                                                     // 284 ← CORRECTED
        9:  da,                                                        // 229 ← CORRECTED
        10: hra,                                                       // 230 ← CORRECTED
        11: conv,                                                      // 233 ← CORRECTED
        12: special,                                                   // 235 ← CORRECTED
        13: otAmt,                                                     // 227 ← CORRECTED
        14: gross,                                                     // 273 ← CORRECTED
        15: pf,                                                        // 262 ← CORRECTED
        16: esi,                                                       // 243 ← CORRECTED
        17: pt,                                                        // 251
        18: advance,                                                   // 218 ← CORRECTED
        19: otherDedn,                                                 // 310
        20: totalDedn,                                                 // 292
        21: net,                                                       // 274 ← CORRECTED
        22: formatDate(getDate(emp, M.dateOfPayment)),                 // 311 ← CORRECTED
        23: getString(emp, M.bankAccountNumber),                       // 276
        24: getString(emp, M.signatureOrThumbImpressionOfWorkmen) || null, // 398 ← CORRECTED
        25: getString(emp, M.remarks),                                 // 503 ← CORRECTED
      };
    },
    totalWriter: (ws, totalRow, rows) => {
      fillCellAddress(ws, `A${totalRow}`, 'Total');
      fillCellAddress(ws, `F${totalRow}`, sumColumn(rows, 6));
      fillCellAddress(ws, `G${totalRow}`, sumColumn(rows, 7));
      fillCellAddress(ws, `H${totalRow}`, sumColumn(rows, 8));
      fillCellAddress(ws, `I${totalRow}`, sumColumn(rows, 9));
      fillCellAddress(ws, `J${totalRow}`, sumColumn(rows, 10));
      fillCellAddress(ws, `K${totalRow}`, sumColumn(rows, 11));
      fillCellAddress(ws, `L${totalRow}`, sumColumn(rows, 12));
      fillCellAddress(ws, `M${totalRow}`, sumColumn(rows, 13));
      fillCellAddress(ws, `N${totalRow}`, sumColumn(rows, 14));
      fillCellAddress(ws, `O${totalRow}`, sumColumn(rows, 15));
      fillCellAddress(ws, `P${totalRow}`, sumColumn(rows, 16));
      fillCellAddress(ws, `Q${totalRow}`, sumColumn(rows, 17));
      fillCellAddress(ws, `R${totalRow}`, sumColumn(rows, 18));
      fillCellAddress(ws, `S${totalRow}`, sumColumn(rows, 19));
      fillCellAddress(ws, `T${totalRow}`, sumColumn(rows, 20));
      fillCellAddress(ws, `U${totalRow}`, sumColumn(rows, 21));
    },
  });
}
