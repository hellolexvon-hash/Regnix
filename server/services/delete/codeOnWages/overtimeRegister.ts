/**
 * codeOnWages/overtimeRegister.ts
 *
 * Generates Form III — Register of Overtime.
 * Reads overtime hours and wages via CODE_WAGES_MAPPING only.
 * Preserves template formatting exactly.
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate, round2 } from '../shared/masterReader.js';
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

const SHEET_TITLE    = 'Form III - Overtime Register';
const ROWS_PER_PAGE  = 6;  // Template has 6 data rows (rows 11–16)
const DATA_START_ROW = 11;
const DATA_END_ROW   = 16;

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateOvertimeRegister(
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
    fillCellAddress(ws, 'J3', getString(companyInfo, M.registrationNumber));
    fillCellAddress(ws, 'C4', getString(companyInfo, M.address));
    fillCellAddress(ws, 'J4', getString(companyInfo, M.year));
    fillCellAddress(ws, 'C5', getString(companyInfo, M.natureOfIndustry));
    fillCellAddress(ws, 'C6', getString(companyInfo, M.wagePeriod) || 'Monthly');

    clearRange(ws, DATA_START_ROW, DATA_END_ROW, 1, 16);

    const tableRows = pageEmployees.map((emp, idx) => {
      const slNo    = pageIndex * ROWS_PER_PAGE + idx + 1;
      const payDate = getDate(emp, M.paymentDate);

      const otHrsW1 = getNumber(emp, M.otHoursWeek1) ?? 0;
      const otHrsW2 = getNumber(emp, M.otHoursWeek2) ?? 0;
      const otHrsW3 = getNumber(emp, M.otHoursWeek3) ?? 0;
      const otHrsW4 = getNumber(emp, M.otHoursWeek4) ?? 0;
      const totalOt = getNumber(emp, M.totalOtHours) ?? (otHrsW1 + otHrsW2 + otHrsW3 + otHrsW4);
      const otAmt   = round2(getNumber(emp, M.otAmount));

      return {
        1:  slNo,
        2:  getString(emp, M.employeeCode),
        3:  getString(emp, M.employeeName),
        4:  getString(emp, M.department),
        5:  getString(emp, M.designation),
        6:  round2(getNumber(emp, M.normalWageRate)),
        7:  round2(getNumber(emp, M.otRatePerHour)),
        8:  otHrsW1 || null,
        9:  otHrsW2 || null,
        10: otHrsW3 || null,
        11: otHrsW4 || null,
        12: totalOt || null,
        13: otAmt,
        14: formatDate(payDate),
        15: null, // Employee signature
        16: null, // Remarks
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
