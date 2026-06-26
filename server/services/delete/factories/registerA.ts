/**
 * factories/registerA.ts
 *
 * Generates Factories Act Register A — Register of Adult Workers.
 * [Factories Act, 1948 — Section 62 & Rule 103]
 *
 * Reads master data via FACTORIES_MAPPING column numbers only.
 * Preserves template formatting exactly.
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getDate, formatDate } from '../shared/masterReader.js';
import { FACTORIES_MAPPING as M } from './mapping.js';
import {
  loadTemplate,
  duplicateTemplateSheet,
  fillCellAddress,
  fillTable,
  clearRange,
  exportWorkbook,
} from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Register A - Adult Workers';
const ROWS_PER_PAGE  = 10;
const DATA_START_ROW = 9;
const DATA_END_ROW   = 18;

export async function generateRegisterA(
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
    fillCellAddress(ws, 'J4', getString(companyInfo, M.licenceNumber));
    fillCellAddress(ws, 'C5', getString(companyInfo, M.occupierName));
    fillCellAddress(ws, 'C6', getString(companyInfo, M.natureOfIndustry));
    fillCellAddress(ws, 'J5', getString(companyInfo, M.year));

    clearRange(ws, DATA_START_ROW, DATA_END_ROW, 1, 14);

    const tableRows = pageEmployees.map((emp, idx) => ({
      1:  pageIndex * ROWS_PER_PAGE + idx + 1,
      2:  getString(emp, M.employeeCode),
      3:  getString(emp, M.employeeName),
      4:  getString(emp, M.fatherOrHusbandName),
      5:  getString(emp, M.gender),
      6:  getString(emp, M.nationality),
      7:  getString(emp, M.age),
      8:  getString(emp, M.designation),
      9:  getString(emp, M.department),
      10: getString(emp, M.category),
      11: formatDate(getDate(emp, M.dateOfJoining)),
      12: formatDate(getDate(emp, M.dateOfLeaving)),
      13: getString(emp, M.reasonForLeaving),
      14: null, // Remarks
    }));

    fillTable(ws, DATA_START_ROW, tableRows);
  });

  return exportWorkbook(outputWb);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
