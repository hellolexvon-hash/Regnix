/**
 * codeOnWages/musterRoll.ts
 *
 * Generates Form VI — Muster Roll.
 * Form VI uses the mapping row at row 10.
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
import { FORM_VI_MAPPING as M } from './mapping.js';
import {
  loadTemplate,
  duplicateTemplateSheet,
  fillCellAddress,
  fillTable,
  clearRange,
  exportWorkbook,
} from '../shared/templateFiller.js';

const SHEET_TITLE = 'Form VI - Muster Roll';
const ROWS_PER_PAGE = 6;
const DATA_START_ROW = 10;
const DATA_END_ROW = 15;

const DAY_TEMPLATE_START_COL = 5; // E

const DAY_MASTER_COLS = [
  M[5], M[6], M[7], M[8], M[9], M[10], M[11], M[12], M[13], M[14],
  M[15], M[16], M[17], M[18], M[19], M[20], M[21], M[22], M[23], M[24],
  M[25], M[26], M[27], M[28], M[29], M[30], M[31], M[32], M[33], M[34],
  M[35],
];

export async function generateMusterRoll(
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
    clearRange(ws, DATA_START_ROW, DATA_END_ROW, 1, 40);

    const rows = pageEmployees.map((emp) => buildRow(emp));
    fillTable(ws, DATA_START_ROW, rows);
  });

  return exportWorkbook(outputWb);
}

function buildRow(emp: MasterRow): Record<number, ExcelJS.CellValue> {
  const row: Record<number, ExcelJS.CellValue> = {
    1: getValue(emp, 1),
    2: getValue(emp, 2),
    3: getValue(emp, 3),
    4: getValue(emp, 4),
  };

  DAY_MASTER_COLS.forEach((masterCol, idx) => {
    const templateCol = DAY_TEMPLATE_START_COL + idx;
    row[templateCol] = getValue(emp, masterCol);
  });

  row[36] = roundOrBlank(getNumber(emp, M[36]));
  row[37] = roundOrBlank(getNumber(emp, M[37]));
  row[38] = roundOrBlank(getNumber(emp, M[38]));
  row[39] = roundOrBlank(getNumber(emp, M[39]) ?? getNumber(emp, 207));
  row[40] = getValue(emp, M[40]);

  return row;
}

function fillMetaFields(ws: ExcelJS.Worksheet, companyInfo: Record<number, unknown>): void {
  fillCellAddress(ws, 'C3', getString(companyInfo, 1));
  fillCellAddress(ws, 'C4', getString(companyInfo, 3));
  fillCellAddress(ws, 'C5', getString(companyInfo, 5) || 'Monthly');
  // Row 6 in the template can remain as-is if it contains shift or other text.
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
