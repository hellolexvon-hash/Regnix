/**
 * codeOnWages/musterRoll.ts
 *
 * Generates Form VI — Muster Roll (Attendance Register).
 * Reads attendance and working-day data via CODE_WAGES_MAPPING only.
 * Preserves template formatting exactly.
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, round2 } from '../shared/masterReader.js';
import { CODE_WAGES_MAPPING as M } from './mapping.js';
import {
  loadTemplate,
  duplicateTemplateSheet,
  fillCellAddress,
  fillTable,
  clearRange,
  exportWorkbook,
} from '../shared/templateFiller.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SHEET_TITLE    = 'Form VI - Muster Roll';
const ROWS_PER_PAGE  = 6;   // Template provides 6 data rows (rows 10–15)
const DATA_START_ROW = 10;
const DATA_END_ROW   = 15;

// Day columns in FormVI: col 5 = Day 1, col 35 = Day 31
const FIRST_DAY_COL = 5;

// Master day columns in order
const DAY_COLS = [
  M.day1,  M.day2,  M.day3,  M.day4,  M.day5,
  M.day6,  M.day7,  M.day8,  M.day9,  M.day10,
  M.day11, M.day12, M.day13, M.day14, M.day15,
  M.day16, M.day17, M.day18, M.day19, M.day20,
  M.day21, M.day22, M.day23, M.day24, M.day25,
  M.day26, M.day27, M.day28, M.day29, M.day30,
  M.day31,
];

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateMusterRoll(
  templateBuffer: Buffer,
  masterData: MasterData,
): Promise<Buffer> {
  const { companyInfo, employees } = masterData;

  const templateWb = await loadTemplate(templateBuffer);
  const outputWb   = new ExcelJS.Workbook();
  outputWb.creator  = 'Regnix';
  outputWb.created  = new Date();

  const pages = chunk(employees, ROWS_PER_PAGE);

  pages.forEach((pageEmployees, pageIndex) => {
    const sheetName = pageIndex === 0
      ? SHEET_TITLE
      : `${SHEET_TITLE} ${pageIndex + 1}`;

    const ws = duplicateTemplateSheet(templateWb, outputWb, sheetName);

    // Meta fields (rows 3–6)
    fillCellAddress(ws, 'C3', getString(companyInfo, M.establishmentName));
    fillCellAddress(ws, 'C4', getString(companyInfo, M.address));
    fillCellAddress(ws, 'C5', getString(companyInfo, M.wagePeriod) || 'Monthly');
    // Row 6 = Shift — not in master mapping; leave template value

    clearRange(ws, DATA_START_ROW, DATA_END_ROW, 1, 41);

    const tableRows = pageEmployees.map((emp, idx) => {
      const slNo        = pageIndex * ROWS_PER_PAGE + idx + 1;
      const daysWorked  = getNumber(emp, M.daysWorked);
      const daysAbsent  = getNumber(emp, M.daysAbsent);
      const lopDays     = getNumber(emp, M.lopDays);
      const otHours     = getNumber(emp, M.totalOtHours) ??
        (getNumber(emp, M.otHoursWeek1) ?? 0) +
        (getNumber(emp, M.otHoursWeek2) ?? 0) +
        (getNumber(emp, M.otHoursWeek3) ?? 0) +
        (getNumber(emp, M.otHoursWeek4) ?? 0);

      const row: Record<number, unknown> = {
        1: slNo,
        2: getString(emp, M.employeeCode),
        3: getString(emp, M.employeeName),
        4: getString(emp, M.designation),
      };

      // Daily attendance: cols 5–35
      DAY_COLS.forEach((masterCol, dayIdx) => {
        const templateCol = FIRST_DAY_COL + dayIdx;
        const attendance  = getString(emp, masterCol);
        row[templateCol]  = attendance || null;
      });

      // Totals
      row[36] = daysWorked;    // AJ - Total Present
      row[37] = daysAbsent;    // AK - Total Absent
      row[38] = lopDays;       // AL - LOP Days
      row[39] = round2(otHours || null); // AM - OT Hours
      row[40] = null;          // Remarks

      return row as Record<number, import('../shared/templateFiller.js').RawCellValue>;
    });

    fillTable(ws, DATA_START_ROW, tableRows);
  });

  return exportWorkbook(outputWb);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
