/**
 * codeOnWages/finesRegister.ts
 *
 * Generates Form I — Register of Fines.
 * Reads fine data columns via CODE_WAGES_MAPPING only.
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

const SHEET_TITLE    = 'Form I - Register of Fines';
const ROWS_PER_PAGE  = 8;  // Template has 8 data rows (rows 8–15)
const DATA_START_ROW = 8;
const DATA_END_ROW   = 15;

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateFinesRegister(
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
      const slNo           = pageIndex * ROWS_PER_PAGE + idx + 1;
      const dateOffence    = getDate(emp, M.dateOfOffence);
      const dateNoticed    = getDate(emp, M.dateOffenceNoticed);
      const dateShowCause  = getDate(emp, M.dateShowCause);
      const dateFineOrder  = getDate(emp, M.dateFineOrder);
      const dateRecovery   = getDate(emp, M.dateOfRecovery);

      const amountFine     = round2(getNumber(emp, M.amountOfFine));
      const amountRecov    = round2(getNumber(emp, M.amountRecovered));
      const balance        = amountFine !== null && amountRecov !== null
        ? round2(amountFine - amountRecov)
        : null;

      return {
        1:  slNo,
        2:  getString(emp, M.employeeCode),
        3:  getString(emp, M.employeeName),
        4:  getString(emp, M.department),
        5:  getString(emp, M.designation),
        6:  formatDate(dateOffence),
        7:  getString(emp, M.actOmissionForFine),
        8:  formatDate(dateNoticed),
        9:  formatDate(dateShowCause),
        10: formatDate(dateFineOrder),
        11: getString(emp, M.wagePeriodOfFine),
        12: amountFine,
        13: formatDate(dateRecovery),
        14: amountRecov,
        15: balance,
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
