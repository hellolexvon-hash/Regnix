/**
 * apprenticesAct/stipendRegister.ts
 *
 * Generates Form AA-6 — Stipend Payment Register (Apprentices)
 * The Apprentices Act, 1961 – Sections 13 & 14 | Apprenticeship Rules, 1992 – Rule 11
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via APPRENTICES_ACT_COLUMNS)
 *
 *  C1  → Sl No                       (generated)
 *  C2  → employeeName                401
 *  C3  → napsRegistrationNo          27
 *  C4  → trade                       47
 *  C5  → apprenticeshipType          46
 *  C6  → workingDaysInMonth          246
 *  C7  → totalDaysPresent            449
 *  C8  → totalDaysAbsent             200
 *  C9  → leaveDays                   201
 *  C10 → prescribedMonthlyStipend    316
 *  C11 → earnedStipend               325
 *  C12 → stipendDeductions           327
 *  C13 → netStipendPayable           328
 *  C14 → stipendPaidDate             311
 *  C15 → paymentMode                 430
 *  C16 → bankAccountNumber           276
 *  C17 → utrNumber                   344
 *  C18 → remarks                     503
 *
 * TO CHANGE A COLUMN: edit apprenticesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate, round2 } from '../shared/masterReader.js';
import { APPRENTICES_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Stipend Register';
const DATA_START_ROW = 7;
const DATA_END_ROW   = 20;
const TOTAL_ROW      = 21;
const USED_COLUMNS   = 18;

function monthYearLabel(employees: MasterData['employees']): string {
  const first = employees
    .map((r) => getDate(r, M.stipendPaidDate))
    .find((v): v is Date => v instanceof Date);
  return (first ?? new Date()).toLocaleString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
}

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
  employees: MasterData['employees'],
): void {
  fillCellAddress(ws, 'D3', getString(companyInfo, M.establishmentName));
  fillCellAddress(ws, 'M3', getString(companyInfo, M.registrationNumber));
  fillCellAddress(ws, 'A4', `MONTH: ${monthYearLabel(employees)}`);
}

export async function generateStipendRegister(
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
      const prescribed  = round2(getNumber(emp, M.prescribedMonthlyStipend)); // 316
      const earned      = round2(getNumber(emp, M.earnedStipend));            // 325
      const deductions  = round2(getNumber(emp, M.stipendDeductions));        // 327
      const net         = round2(getNumber(emp, M.netStipendPayable))         // 328
        ?? (earned !== null && deductions !== null ? round2(earned - deductions) : null);

      return {
        1:  oneIndex,
        2:  getString(emp, M.employeeName),                                  // 401
        3:  getString(emp, M.napsRegistrationNo),                            // 27
        4:  getString(emp, M.trade),                                         // 47
        5:  getString(emp, M.apprenticeshipType),                            // 46
        6:  getNumber(emp, M.workingDaysInMonth),                            // 246
        7:  getNumber(emp, M.totalDaysPresent),                              // 449
        8:  getNumber(emp, M.totalDaysAbsent),                               // 200
        9:  getNumber(emp, M.leaveDays),                                     // 201
        10: prescribed,                                                      // 316
        11: earned,                                                          // 325
        12: deductions,                                                      // 327
        13: net,                                                             // 328
        14: formatDate(getDate(emp, M.stipendPaidDate)),                     // 311
        15: getString(emp, M.paymentMode),                                   // 430
        16: getString(emp, M.bankAccountNumber),                             // 276
        17: getString(emp, M.utrNumber),                                     // 344
        18: getString(emp, M.remarks),                                       // 503
      };
    },
    totalWriter: (ws, totalRow, rows) => {
      fillCellAddress(ws, `A${totalRow}`, 'MONTHLY STIPEND TOTALS');
      fillCellAddress(ws, `J${totalRow}`, sumColumn(rows, 10)); // prescribed
      fillCellAddress(ws, `K${totalRow}`, sumColumn(rows, 11)); // earned
      fillCellAddress(ws, `L${totalRow}`, sumColumn(rows, 12)); // deductions
      fillCellAddress(ws, `M${totalRow}`, sumColumn(rows, 13)); // net payable
    },
  });
}
