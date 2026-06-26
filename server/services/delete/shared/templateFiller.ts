/**
 * shared/templateFiller.ts
 *
 * Generic template engine.
 * Opens an .xlsx template, clones its worksheet, inserts values,
 * and preserves all formatting, merged cells, and formulas.
 *
 * Has no knowledge of compliance Acts or column mappings.
 */

import ExcelJS from 'exceljs';
import {
  cloneWorksheet,
  workbookToBuffer,
  loadWorkbookFromBuffer,
  RawCellValue,
} from './excelUtils.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A row of values: column-index → value */
export type RowValues = Record<number, RawCellValue>;

/** A table of rows */
export type TableValues = RowValues[];

// ─── Core API ─────────────────────────────────────────────────────────────────

/** Load a template workbook from a Buffer. */
export async function loadTemplate(buffer: Buffer): Promise<ExcelJS.Workbook> {
  return loadWorkbookFromBuffer(buffer);
}

/**
 * Duplicate the first (or named) worksheet from a template workbook into
 * a new output workbook, then return both the output workbook and the new sheet.
 */
export function duplicateTemplateSheet(
  templateWb: ExcelJS.Workbook,
  outputWb: ExcelJS.Workbook,
  sheetName: string,
  sourceSheetIndex = 1,
): ExcelJS.Worksheet {
  const srcWs = templateWb.getWorksheet(sourceSheetIndex);
  if (!srcWs) {
    throw new Error(`templateFiller.duplicateTemplateSheet: source sheet ${sourceSheetIndex} not found.`);
  }

  const outWs = outputWb.addWorksheet(sheetName);
  cloneWorksheet(srcWs, outWs);
  return outWs;
}

/**
 * Write a single value into a specific cell (row, col — 1-based).
 * Preserves existing cell style.
 */
export function fillCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: RawCellValue,
): void {
  ws.getCell(row, col).value = value as never;
}

/** Write to a named address like "C4". */
export function fillCellAddress(
  ws: ExcelJS.Worksheet,
  address: string,
  value: RawCellValue,
): void {
  ws.getCell(address).value = value as never;
}

/**
 * Write a map of column → value into a specific Excel row.
 * Preserves existing styles on each cell.
 */
export function fillRow(
  ws: ExcelJS.Worksheet,
  excelRow: number,
  values: RowValues,
): void {
  for (const [col, value] of Object.entries(values)) {
    ws.getCell(excelRow, Number(col)).value = value as never;
  }
}

/**
 * Write a table of rows starting at `startRow`.
 * Each entry in `rows` maps column index → value.
 */
export function fillTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  rows: TableValues,
): void {
  rows.forEach((rowValues, idx) => {
    fillRow(ws, startRow + idx, rowValues);
  });
}

/**
 * Serialize an output workbook to a Buffer.
 */
export async function exportWorkbook(wb: ExcelJS.Workbook): Promise<Buffer> {
  return workbookToBuffer(wb);
}

/**
 * Utility: clear a rectangular cell range (set all values to null).
 * Useful to wipe placeholder text from template rows before writing data.
 */
export function clearRange(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
): void {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      ws.getCell(r, c).value = null;
    }
  }
}
