/**
 * codeOnWages/finesRegister.ts
 *
 * Generates Form I — Register of Fines.
 * Uses fixed master column indices only.
 * Preserves template formatting and pagination.
 */

import ExcelJS from 'exceljs';
import {
  MasterData,
  MasterRow,
  getString,
  getNumber,
  getDate,
  formatDate,
  round2,
} from '../shared/masterReader.js';
import { FORM_I_MAPPING as M } from './mapping.js';
import {
  loadTemplate,
  duplicateTemplateSheet,
  fillCellAddress,
  fillTable,
  clearRange,
  exportWorkbook,
} from '../shared/templateFiller.js';

const SHEET_TITLE = 'Form I - Register of Fines';
const ROWS_PER_PAGE = 8;
const DATA_START_ROW = 8;
const DATA_END_ROW = 15;

export async function generateFinesRegister(
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
  const amountFine = getNumber(emp, M[12]);
  const amountRecovered = getNumber(emp, M[14]);
  const balance = amountFine !== null && amountRecovered !== null
    ? round2(amountFine - amountRecovered)
    : null;

  return {
    1: getValue(emp, 1),
    2: getValue(emp, 2),
    3: getValue(emp, 3),
    4: getValue(emp, 4),
    5: getValue(emp, 5),
    6: formatDateOrBlank(getDate(emp, M[6])),
    7: getValue(emp, M[7]),
    8: formatDateOrBlank(getDate(emp, M[8])),
    9: formatDateOrBlank(getDate(emp, M[9])),
    10: formatDateOrBlank(getDate(emp, M[10])),
    11: getValue(emp, M[11]),
    12: roundOrBlank(amountFine),
    13: formatDateOrBlank(getDate(emp, M[13])),
    14: roundOrBlank(amountRecovered),
    15: balance,
    16: getValue(emp, M[16]),
  };
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

function roundOrBlank(value: number | null): number | null {
  return value === null ? null : round2(value);
}

function formatDateOrBlank(value: Date | null): string {
  return value ? formatDate(value) : '';
}
