/**
 * factories/registerB.ts
 *
 * Generates Factories Act Register B — Register of Leave with Wages.
 * [Factories Act, 1948 — Section 75 & Rule 105]
 *
 * Reads master data via FACTORIES_MAPPING column numbers only.
 * Preserves template formatting exactly.
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate, round2 } from '../shared/masterReader.js';
import { FACTORIES_MAPPING as M } from './mapping.js';
import {
  loadTemplate,
  duplicateTemplateSheet,
  fillCellAddress,
  fillTable,
  clearRange,
  exportWorkbook,
} from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Register B - Leave with Wages';
const ROWS_PER_PAGE  = 8;
const DATA_START_ROW = 9;
const DATA_END_ROW   = 16;

export async function generateRegisterB(
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

    // Meta
    fillCellAddress(ws, 'C3', getString(companyInfo, M.establishmentName));
    fillCellAddress(ws, 'J3', getString(companyInfo, M.registrationNumber));
    fillCellAddress(ws, 'C4', getString(companyInfo, M.address));
    fillCellAddress(ws, 'J4', getString(companyInfo, M.year));
    fillCellAddress(ws, 'C5', getString(companyInfo, M.occupierName));

    clearRange(ws, DATA_START_ROW, DATA_END_ROW, 1, 14);

    const tableRows = pageEmployees.map((emp, idx) => {
      const daysWorked   = getNumber(emp, M.daysWorked) ?? 0;
      // Leave entitlement = 1 day per 20 days worked (Factories Act Section 79)
      const leaveEarned  = Math.floor(daysWorked / 20);
      const grossWage    = getNumber(emp, M.grossWage);
      const leaveWage    = grossWage && daysWorked
        ? round2((grossWage / daysWorked) * leaveEarned)
        : null;

      return {
        1:  pageIndex * ROWS_PER_PAGE + idx + 1,
        2:  getString(emp, M.employeeCode),
        3:  getString(emp, M.employeeName),
        4:  getString(emp, M.department),
        5:  getString(emp, M.designation),
        6:  formatDate(getDate(emp, M.dateOfJoining)),
        7:  daysWorked,
        8:  leaveEarned,
        9:  null,   // Leave availed (date from)
        10: null,   // Leave availed (date to)
        11: null,   // Leave days availed
        12: null,   // Leave balance
        13: leaveWage,
        14: null,   // Remarks
      };
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
