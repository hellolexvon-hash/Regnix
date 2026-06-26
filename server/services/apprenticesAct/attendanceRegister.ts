/**
 * apprenticesAct/attendanceRegister.ts
 *
 * Generates Form AA-5 — Attendance Register (Apprentices)
 * The Apprentices Act, 1961 – Section 6 | Apprenticeship Rules, 1992 – Rule 11
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via APPRENTICES_ACT_COLUMNS)
 *
 *  C1      → Sl No               (generated)
 *  C2      → employeeName        401
 *  C3      → napsRegistrationNo  27
 *  C4      → trade               47
 *  C5      → shift               463
 *  C6–C36  → day1–day31          144–174
 *  C37     → totalDaysPresent    246  (Total Present)
 *  C38     → totalDaysAbsent     200  (Total Absent)
 *  C39     → totalDaysOnLeave    490  (On Leave)
 *  C40     → holidayDays         201  (Holiday)
 *  C41     → workingDays         92   (Working Days)
 *
 * TO CHANGE A COLUMN: edit apprenticesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate } from '../shared/masterReader.js';
import { APPRENTICES_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Attendance Register';
const DATA_START_ROW = 7;
const DATA_END_ROW   = 20;
const TOTAL_ROW      = 21;
const USED_COLUMNS   = 43; // A through AQ
const DAY_START_COL  = 6;  // template col 6 = Day 1

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

export async function generateAttendanceRegister(
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
        2: getString(emp, M.employeeName),           // 401
        3: getString(emp, M.napsRegistrationNo),     // 27
        4: getString(emp, M.trade),                  // 47
        5: getString(emp, M.shift),                  // 463
      };

      // Daily attendance: template cols 6–36 → master cols 144–174
      M.dayColumns.forEach((masterCol, dayIdx) => {
        row[DAY_START_COL + dayIdx] = getString(emp, masterCol) || null;
      });

      row[37] = getNumber(emp, M.workingDaysInMonth); // 246 — Total Present
      row[38] = getNumber(emp, M.totalDaysAbsent);    // 200 — Total Absent
      row[39] = getNumber(emp, M.totalDaysOnLeave);   // 490 — On Leave
      row[40] = getNumber(emp, M.holidayDays);        // 201 — Holiday
      row[41] = getNumber(emp, M.workingDays);        // 92  — Working Days

      return row;
    },
    totalWriter: (_ws, _totalRow, _rows) => {
      // Monthly totals block uses separate rows in the template
    },
  });
}
