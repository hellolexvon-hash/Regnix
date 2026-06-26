/**
 * shared/excelUtils.ts
 *
 * Reusable ExcelJS utility functions.
 * No Act-specific logic. No mapping information.
 */

import ExcelJS from 'exceljs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RawCellValue = string | number | boolean | Date | null;

// ─── Style cloning ────────────────────────────────────────────────────────────

export function cloneStyle<T>(obj: T): T {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj)) as T;
}

// ─── Worksheet cloning ────────────────────────────────────────────────────────

/**
 * Clone all content, styles, merged cells, column widths, and row heights
 * from `source` worksheet into `target` worksheet.
 */
export function cloneWorksheet(
  source: ExcelJS.Worksheet,
  target: ExcelJS.Worksheet,
): void {
  // Worksheet-level properties
  target.properties  = cloneStyle(source.properties);
  target.pageSetup   = cloneStyle(source.pageSetup);
  target.views       = cloneStyle(source.views);
  if (source.autoFilter) target.autoFilter = cloneStyle(source.autoFilter);

  // Column widths + styles
  copyColumns(source, target);

  // Row data + cell styles
  source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    copyRow(source, target, rowNumber);
  });

  // Merged cells
  copyMergedCells(source, target);
}

/** Copy column widths, hidden, outlineLevel, and style from source to target. */
export function copyColumns(
  source: ExcelJS.Worksheet,
  target: ExcelJS.Worksheet,
): void {
  source.columns.forEach((col, idx) => {
    const t = target.getColumn(idx + 1);
    if (col.width    !== undefined) t.width        = col.width;
    if (col.hidden   !== undefined) t.hidden        = col.hidden;
    if (col.outlineLevel !== undefined) t.outlineLevel = col.outlineLevel;
    if (col.style)                  t.style         = cloneStyle(col.style);
  });
}

/** Copy a single row (height, hidden, cells) from source to target. */
export function copyRow(
  source: ExcelJS.Worksheet,
  target: ExcelJS.Worksheet,
  rowNumber: number,
): void {
  const srcRow = source.getRow(rowNumber);
  const tgtRow = target.getRow(rowNumber);

  if (srcRow.height   !== undefined) tgtRow.height       = srcRow.height;
  if (srcRow.hidden   !== undefined) tgtRow.hidden        = srcRow.hidden;
  if (srcRow.outlineLevel !== undefined) tgtRow.outlineLevel = srcRow.outlineLevel;

  srcRow.eachCell({ includeEmpty: true }, (srcCell, colNumber) => {
    copyStyles(srcCell, tgtRow.getCell(colNumber));
    tgtRow.getCell(colNumber).value = srcCell.value as never;
  });
}

/** Copy all style attributes from one cell to another. */
export function copyStyles(
  source: ExcelJS.Cell,
  target: ExcelJS.Cell,
): void {
  if (source.numFmt)    target.numFmt    = source.numFmt;
  if (source.font)      target.font      = cloneStyle(source.font);
  if (source.fill)      target.fill      = cloneStyle(source.fill);
  if (source.border)    target.border    = cloneStyle(source.border);
  if (source.alignment) target.alignment = cloneStyle(source.alignment);
  if (source.protection) target.protection = cloneStyle(source.protection);
}

/** Re-apply merged-cell ranges from source to target. */
export function copyMergedCells(
  source: ExcelJS.Worksheet,
  target: ExcelJS.Worksheet,
): void {
  const merges = (source.model as { merges?: string[] }).merges ?? [];
  for (const merge of merges) {
    try { target.mergeCells(merge); } catch { /* ignore duplicate merge */ }
  }
}

// ─── Cell value helpers ───────────────────────────────────────────────────────

export function getCellValue(ws: ExcelJS.Worksheet, row: number, col: number): RawCellValue {
  const cell = ws.getCell(row, col);
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && 'result' in (v as object)) {
    return (v as ExcelJS.CellFormulaValue).result as RawCellValue;
  }
  return v as RawCellValue;
}

export function setCellValue(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: RawCellValue,
): void {
  ws.getCell(row, col).value = value as never;
}

export function setCellAddress(
  ws: ExcelJS.Worksheet,
  address: string,
  value: RawCellValue,
): void {
  ws.getCell(address).value = value as never;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getFullYear()}`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

// ─── Workbook I/O ─────────────────────────────────────────────────────────────

export async function loadWorkbookFromBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

export async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const raw = await wb.xlsx.writeBuffer();
  return Buffer.from(raw);
}
