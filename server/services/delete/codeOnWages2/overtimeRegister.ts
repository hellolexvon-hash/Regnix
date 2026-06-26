/**
 * codeOnWages/overtimeRegister.ts
 *
 * Generates Form III — Register of Overtime.
 * Uses fixed master column indices only.
 * Preserves template formatting and pagination.
 */

import ExcelJS from 'exceljs';
import {
  MasterData,
  MasterRow,
  getString,
  getNumber,
  round2,
} from '../shared/masterReader.js';
import { FORM_III_MAPPING as M } from './mapping.js';
import {
  loadTemplate,
  duplicateTemplateSheet,
  fillCellAddress,
  fillTable,
  clearRange,
  exportWorkbook,
} from '../shared/templateFiller.js';

const SHEET_TITLE = 'Form III - Overtime Register';
const ROWS_PER_PAGE = 6;
const DATA_START_ROW = 11;
const DATA_END_ROW = 16;

export async function generateOvertimeRegister(
  templateBuffer: Buffer,
  masterData: MasterData,
): Promise<Buffer> {
  const templateWb = await loadTemplate(templateBuffer);
  const outputWb = new ExcelJS.Workbook();
  outputWb.creator = 'Regnix';
  outputWb.created = new Date();
  outputWb.modified = new Date();

  paginate(masterData.employees, ROWS_PER_PAGE).forEach((pageEmployees, pageIndex) => {
    const ws = duplicateTemplateSheet(
      templateWb,
      outputWb,
      pageIndex === 0 ? SHEET_TITLE : `${SHEET_TITLE} ${pageIndex + 1}`,
    );

    fillMetaFields(ws, masterData.companyInfo);
    clearRange(ws, DATA_START_ROW, DATA_END_ROW, 1, 16);

    const rows = pageEmployees.map((emp) => buildRow(emp));
    fillTable(ws, DATA_START_ROW, rows);
  });

  return exportWorkbook(outputWb);
}

function buildRow(emp: MasterRow): Record<number, ExcelJS.CellValue> {
  const rowValues = mapByTemplateColumns(emp, M);

  const fallbackTotalHours = sumMoney(
    getNumber(emp, M[8]),
    getNumber(emp, M[9]),
    getNumber(emp, M[10]),
    getNumber(emp, M[11]),
  );

  rowValues[12] = roundOrBlank(getNumber(emp, M[12]) ?? fallbackTotalHours);
  rowValues[13] = roundOrBlank(getNumber(emp, M[13]));

  return rowValues;
}

function fillMetaFields(ws: ExcelJS.Worksheet, companyInfo: Record<number, unknown>): void {
  fillCellAddress(ws, 'C3', getString(companyInfo, 1));
  fillCellAddress(ws, 'J3', getString(companyInfo, 2));
  fillCellAddress(ws, 'C4', getString(companyInfo, 3));
  fillCellAddress(ws, 'J4', getString(companyInfo, 6));
  fillCellAddress(ws, 'C5', getString(companyInfo, 4));
  fillCellAddress(ws, 'C6', getString(companyInfo, 5) || 'Monthly');
}

function paginate<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function getValue(row: MasterRow, masterCol: number): ExcelJS.CellValue {
  const value = row[masterCol];
  return value === undefined ? null : (value as ExcelJS.CellValue);
}

function mapByTemplateColumns(emp: MasterRow, mapping: Record<number, number>): Record<number, ExcelJS.CellValue> {
  const out: Record<number, ExcelJS.CellValue> = {};
  for (const [templateColKey, masterCol] of Object.entries(mapping)) {
    const templateCol = Number(templateColKey);
    out[templateCol] = getValue(emp, masterCol);
  }
  return out;
}

function sumMoney(...values: Array<number | null | undefined>): number | null {
  let hasAny = false;
  let sum = 0;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    hasAny = true;
    sum += Number(v);
  }
  return hasAny ? round2(sum) : null;
}

function roundOrBlank(value: number | null): number | null {
  return value === null ? null : round2(value);
}

