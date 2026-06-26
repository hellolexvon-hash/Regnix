/**
 * shared/templateFiller.ts
 *
 * Generic template cloning and filling engine.
 * No act-specific logic here.
 */

import ExcelJS from 'exceljs';
import {
  cloneWorksheet,
  workbookToBuffer,
  loadWorkbookFromBuffer,
  clearRange as clearRangeInExcelUtils,
  RawCellValue,
} from './excelUtils.js';

export type RowValues = Record<number, RawCellValue>;
export type TableValues = RowValues[];

export async function loadTemplate(buffer: Buffer | Uint8Array | ArrayBuffer): Promise<ExcelJS.Workbook> {
  return loadWorkbookFromBuffer(buffer);
}

function sanitizeSheetName(name: string, outputWb: ExcelJS.Workbook): string {
  let safe = name.replace(/[\\/?*[\]]/g, '').trim();
  if (!safe) {
    safe = 'Sheet';
  }

  if (safe.length > 31) {
    safe = safe.slice(0, 31).trimEnd();
  }

  const existing = new Set(outputWb.worksheets.map((ws) => ws.name));
  if (!existing.has(safe)) {
    return safe;
  }

  const base = safe.length > 28 ? safe.slice(0, 28).trimEnd() : safe;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}_${n}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`duplicateTemplateSheet: cannot find unique name for "${name}"`);
}

export function duplicateTemplateSheet(
  templateWb: ExcelJS.Workbook,
  outputWb: ExcelJS.Workbook,
  sheetName: string,
  sourceSheetIndex = 1,
): ExcelJS.Worksheet {
  const sourceSheet = templateWb.getWorksheet(sourceSheetIndex);
  if (!sourceSheet) {
    throw new Error(`templateFiller.duplicateTemplateSheet: source sheet ${sourceSheetIndex} not found.`);
  }

  const outWs = outputWb.addWorksheet(sanitizeSheetName(sheetName, outputWb));
  cloneWorksheet(sourceSheet, outWs);
  return outWs;
}

export function fillCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: RawCellValue,
): void {
  ws.getCell(row, col).value = value as ExcelJS.CellValue;
}

export function fillCellAddress(
  ws: ExcelJS.Worksheet,
  address: string,
  value: RawCellValue,
): void {
  ws.getCell(address).value = value as ExcelJS.CellValue;
}

export function fillRow(
  ws: ExcelJS.Worksheet,
  excelRow: number,
  values: RowValues,
): void {
  for (const [col, value] of Object.entries(values)) {
    ws.getCell(excelRow, Number(col)).value = value as ExcelJS.CellValue;
  }
}

export function fillTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  rows: TableValues,
): void {
  rows.forEach((rowValues, index) => {
    fillRow(ws, startRow + index, rowValues);
  });
}

export function clearRange(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
): void {
  clearRangeInExcelUtils(ws, startRow, endRow, startCol, endCol);
}

export async function exportWorkbook(wb: ExcelJS.Workbook): Promise<Buffer> {
  return workbookToBuffer(wb);
}
