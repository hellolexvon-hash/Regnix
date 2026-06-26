/**
 * codeOnWages/wageRegister.ts
 *
 * Generates Form IV — Wage Register.
 * Reads employee values using CODE_WAGES_MAPPING (column numbers only).
 * Preserves template formatting exactly.
 * Paginates: 8 employees per sheet.
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

const SHEET_TITLE   = 'Form IV - Wage Register';
const ROWS_PER_PAGE = 8;

// Template row layout
const META_ROW_ESTABLISHMENT = 3;  // C3 = establishment name, J3 = reg no
const META_ROW_ADDRESS       = 4;  // C4 = address, J4 = year
const META_ROW_INDUSTRY      = 5;  // C5 = nature of industry
const META_ROW_WAGE_PERIOD   = 6;  // C6 = wage period
const DATA_START_ROW         = 11; // Employee data rows start here
const DATA_END_ROW           = 18; // 8 rows (11–18)

// Column mapping: FormIV column letter → master column number
const COL_MAP: Record<number, number> = {
  1:  M.slNo,             // A  Sl. No.
  2:  M.employeeCode,     // B  Employee Code
  3:  M.employeeName,     // C  Employee Name
  4:  M.department,       // D  Department
  5:  M.designation,      // E  Designation
  6:  M.daysWorked,       // F  Days Worked
  7:  M.daysAbsent,       // G  Days Absent
  8:  M.basicWage,        // H  Basic Wage
  9:  M.da,               // I  DA
  10: M.hra,              // J  HRA
  11: M.conveyanceAllowance, // K Conv. Allowance
  12: M.specialAllowance, // L  Special Allowance
  13: M.otAmount,         // M  OT Amount
  14: M.grossWage,        // N  Gross Wage
  15: M.pfDeduction,      // O  PF Deduction
  16: M.esiDeduction,     // P  ESI Deduction
  17: M.ptDeduction,      // Q  PT
  18: M.advanceDeduction, // R  Advance
  19: M.otherDeduction,   // S  Other Dedns
  20: M.totalDeduction,   // T  Total Dedns
  21: M.netSalary,        // U  Net Payable
  22: M.paymentDate,      // V  Date of Payment
  23: M.bankAccountNumber,// W  Receipt/Bank ref
  // X = Employee Signature (blank)
  // Y = Remarks (blank)
};

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateWageRegister(
  templateBuffer: Buffer,
  masterData: MasterData,
): Promise<Buffer> {
  const { companyInfo, employees } = masterData;

  const templateWb = await loadTemplate(templateBuffer);
  const outputWb   = new ExcelJS.Workbook();
  outputWb.creator  = 'Regnix';
  outputWb.created  = new Date();

  // Paginate employees
  const pages = chunk(employees, ROWS_PER_PAGE);

  pages.forEach((pageEmployees, pageIndex) => {
    const sheetName = pageIndex === 0
      ? SHEET_TITLE
      : `${SHEET_TITLE} ${pageIndex + 1}`;

    const ws = duplicateTemplateSheet(templateWb, outputWb, sheetName);

    // Fill meta fields
    fillCellAddress(ws, 'C3', getString(companyInfo, M.establishmentName));
    fillCellAddress(ws, 'J3', getString(companyInfo, M.registrationNumber));
    fillCellAddress(ws, 'C4', getString(companyInfo, M.address));
    fillCellAddress(ws, 'J4', getString(companyInfo, M.year));
    fillCellAddress(ws, 'C5', getString(companyInfo, M.natureOfIndustry));
    fillCellAddress(ws, 'C6', getString(companyInfo, M.wagePeriod) || 'Monthly');

    // Clear placeholder data rows
    clearRange(ws, DATA_START_ROW, DATA_END_ROW, 1, 25);

    // Build table rows
    const tableRows = pageEmployees.map((emp, idx) => {
      const slNo         = pageIndex * ROWS_PER_PAGE + idx + 1;
      const payDate      = getDate(emp, M.paymentDate);
      const row: Record<number, unknown> = {};

      for (const [col, masterCol] of Object.entries(COL_MAP)) {
        const c = Number(col);
        if (c === 1) {
          row[c] = slNo;
        } else if (masterCol === M.paymentDate) {
          row[c] = formatDate(payDate);
        } else if (masterCol === M.grossWage) {
          const gross = getNumber(emp, M.grossWage) ??
            (getNumber(emp, M.basicWage) ?? 0) +
            (getNumber(emp, M.da) ?? 0) +
            (getNumber(emp, M.hra) ?? 0) +
            (getNumber(emp, M.conveyanceAllowance) ?? 0) +
            (getNumber(emp, M.specialAllowance) ?? 0) +
            (getNumber(emp, M.otAmount) ?? 0);
          row[c] = round2(gross);
        } else if (masterCol === M.totalDeduction) {
          const total = getNumber(emp, M.totalDeduction) ??
            (getNumber(emp, M.pfDeduction) ?? 0) +
            (getNumber(emp, M.esiDeduction) ?? 0) +
            (getNumber(emp, M.ptDeduction) ?? 0) +
            (getNumber(emp, M.advanceDeduction) ?? 0) +
            (getNumber(emp, M.otherDeduction) ?? 0);
          row[c] = round2(total);
        } else {
          const raw = emp[masterCol];
          if (raw instanceof Date) {
            row[c] = formatDate(raw);
          } else {
            row[c] = typeof raw === 'number' ? round2(raw) : (raw ?? null);
          }
        }
      }

      return row as Record<number, import('../shared/templateFiller.js').RawCellValue>;
    });

    fillTable(ws, DATA_START_ROW, tableRows);
  });

  return exportWorkbook(outputWb);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
