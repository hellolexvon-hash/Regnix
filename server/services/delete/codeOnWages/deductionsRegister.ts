/**
 * codeOnWages/deductionsRegister.ts
 *
 * Generates Form II — Register of Deductions for Damage or Loss.
 * Reads deduction columns via CODE_WAGES_MAPPING only.
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

const SHEET_TITLE   = 'Form II - Deductions';
const ROWS_PER_PAGE = 5;  // Template has 5 data rows (11–15)
const DATA_START_ROW = 11;
const DATA_END_ROW   = 15;

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateDeductionsRegister(
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

    // Meta fields
    fillCellAddress(ws, 'C3', getString(companyInfo, M.establishmentName));
    fillCellAddress(ws, 'J3', getString(companyInfo, M.registrationNumber));
    fillCellAddress(ws, 'C4', getString(companyInfo, M.address));
    fillCellAddress(ws, 'J4', getString(companyInfo, M.year));
    fillCellAddress(ws, 'C5', getString(companyInfo, M.natureOfIndustry));
    fillCellAddress(ws, 'C6', getString(companyInfo, M.wagePeriod) || 'Monthly');

    clearRange(ws, DATA_START_ROW, DATA_END_ROW, 1, 18);

    const tableRows = pageEmployees.map((emp, idx) => {
      const slNo           = pageIndex * ROWS_PER_PAGE + idx + 1;
      const dateOfDmg      = getDate(emp, M.dateOfDamage);
      const dateShowCause  = getDate(emp, M.dateShowCauseDmg);
      const dateOrder      = getDate(emp, M.dateOfOrder);

      const amountOrdered  = round2(getNumber(emp, M.amountOrdered));
      const amountRecov    = round2(getNumber(emp, M.amountRecoveredDmg));
      const balance        = amountOrdered !== null && amountRecov !== null
        ? round2(amountOrdered - amountRecov)
        : null;

      // Cumulative deducted — use total deduction if available
      const cumulativeDeducted = round2(getNumber(emp, M.totalDeduction));
      const grossWage          = getNumber(emp, M.grossWage);
      const pctDeducted = cumulativeDeducted !== null && grossWage
        ? round2((cumulativeDeducted / grossWage) * 100)
        : null;

      return {
        1:  slNo,
        2:  getString(emp, M.employeeCode),
        3:  getString(emp, M.employeeName),
        4:  getString(emp, M.department),
        5:  getString(emp, M.designation),
        6:  formatDate(dateOfDmg),
        7:  getString(emp, M.natureOfDamage),
        8:  round2(getNumber(emp, M.estimatedLoss)),
        9:  formatDate(dateShowCause),
        10: getString(emp, M.replyReceived),
        11: formatDate(dateOrder),
        12: amountOrdered,
        13: getString(emp, M.wagePeriodRecovery),
        14: amountRecov,
        15: balance,
        16: cumulativeDeducted,
        17: pctDeducted !== null ? `${pctDeducted}%` : null,
        18: null, // Remarks
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
