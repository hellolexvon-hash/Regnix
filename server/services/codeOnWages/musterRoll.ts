/**
 * codeOnWages/musterRoll.ts
 *
 * Generates Form VI — Muster Roll (Attendance Register)
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CODE_ON_WAGES_COLUMNS)
 *
 *  C1      → Sl No             (generated)
 *  C2      → employeeCode      9
 *  C3      → employeeName      401   ← CORRECTED (was missing)
 *  C4      → designation       47
 *  C5–C35  → day1–day31        144–174
 *  C36     → totalDaysPresent  199   ← CORRECTED (was totalDaysWorked 246)
 *  C37     → totalDaysAbsent   200
 *  C38     → lwpDays           201   ← LOP Days CORRECTED (was 312)
 *  C39     → otHoursMusterRoll 275   ← OT Hours CORRECTED (was otAmount 207)
 *  C40     → musterRollRemarks 176
 *
 * TO CHANGE A COLUMN: edit codeOnWages/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate } from '../shared/masterReader.js';
import { CODE_ON_WAGES_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Form VI - Muster Roll';
const DATA_START_ROW = 10;
const DATA_END_ROW   = 15;
const TOTAL_ROW      = 16;
const USED_COLUMNS   = 40;
const DAY_START_COL  = 5; // template col 5 = Day 1, col 35 = Day 31

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
  fillCellAddress(ws, 'C4', getString(companyInfo, M.address));
  fillCellAddress(ws, 'C5', monthYearLabel(employees));
}

export async function generateMusterRoll(
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
      const row: Record<number, ExcelJS.CellValue | null> = {
        1: oneIndex,
        2: getString(emp, M.employeeCode),
        3: getString(emp, M.employeeName),     // 401 ← CORRECTED
        4: getString(emp, M.designation),
      };

      // Daily attendance: template cols 5–35 → master cols 144–174
      M.dayColumns.forEach((masterCol, dayIdx) => {
        row[DAY_START_COL + dayIdx] = getString(emp, masterCol) || null;
      });

      row[36] = getNumber(emp, M.totalDaysPresent);    // 199 ← CORRECTED (Total Present)
      row[37] = getNumber(emp, M.totalDaysAbsent);     // 200 (Total Absent)
      row[38] = getNumber(emp, M.lwpDays);             // 201 ← CORRECTED (LOP Days)
      row[39] = getNumber(emp, M.otHoursMusterRoll);   // 275 ← CORRECTED (OT Hours)
      row[40] = getString(emp, M.musterRollRemarks) || getString(emp, M.remarks); // 176

      return row;
    },
    totalWriter: (ws, totalRow, rows) => {
      fillCellAddress(ws, `A${totalRow}`, 'Total');
      fillCellAddress(ws, `AJ${totalRow}`, sumColumn(rows, 36));
      fillCellAddress(ws, `AK${totalRow}`, sumColumn(rows, 37));
      fillCellAddress(ws, `AL${totalRow}`, sumColumn(rows, 38));
      fillCellAddress(ws, `AM${totalRow}`, sumColumn(rows, 39));
    },
  });
}
