/**
 * shared/excelUtils.ts
 *
 * Reusable Excel helpers only.
 * No act-specific logic here.
 */

import ExcelJS from 'exceljs';

export type RawCellValue = ExcelJS.CellValue | null | undefined;

export function deepClone<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  const structured = globalThis.structuredClone;
  if (typeof structured === 'function') {
    return structured(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function columnLetterToNumber(letter: string): number {
  const normalized = letter.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) {
    throw new Error(`Invalid column letter: ${letter}`);
  }

  let result = 0;
  for (const ch of normalized) {
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result;
}

export function columnNumberToLetter(col: number): string {
  if (!Number.isInteger(col) || col <= 0) {
    throw new Error(`Invalid column number: ${col}`);
  }

  let result = '';
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export function loadWorkbookFromBuffer(buffer: Buffer | Uint8Array | ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  return wb.xlsx.load(toArrayBuffer(buffer)).then(() => wb);
}

export async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const result = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(result) ? result : Buffer.from(result);
}

export function safeSetCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: RawCellValue,
): void {
  const cell = ws.getCell(row, col);
  const merged = cell.master;
  if (cell.isMerged && merged && merged.address !== cell.address) {
    return;
  }
  cell.value = value as ExcelJS.CellValue;
}

export function clearRange(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
): void {
  for (let r = startRow; r <= endRow; r += 1) {
    for (let c = startCol; c <= endCol; c += 1) {
      safeSetCell(ws, r, c, null);
    }
  }
}

export function copyRowStyle(
  ws: ExcelJS.Worksheet,
  sourceRowNumber: number,
  targetRowNumber: number,
  maxColumn: number,
): void {
  const sourceRow = ws.getRow(sourceRowNumber);
  const targetRow = ws.getRow(targetRowNumber);

  if (typeof sourceRow.height === 'number') {
    targetRow.height = sourceRow.height;
  }

  if (typeof sourceRow.hidden === 'boolean') {
    targetRow.hidden = sourceRow.hidden;
  }

  if (typeof sourceRow.outlineLevel === 'number') {
    targetRow.outlineLevel = sourceRow.outlineLevel;
  }

  for (let col = 1; col <= maxColumn; col += 1) {
    const sourceCell = sourceRow.getCell(col);
    const targetCell = targetRow.getCell(col);

    targetCell.style = deepClone(sourceCell.style);
    if (sourceCell.numFmt) {
      targetCell.numFmt = sourceCell.numFmt;
    }
    if (sourceCell.font) {
      targetCell.font = deepClone(sourceCell.font);
    }
    if (sourceCell.fill) {
      targetCell.fill = deepClone(sourceCell.fill);
    }
    if (sourceCell.border) {
      targetCell.border = deepClone(sourceCell.border);
    }
    if (sourceCell.alignment) {
      targetCell.alignment = deepClone(sourceCell.alignment);
    }
    if (sourceCell.protection) {
      targetCell.protection = deepClone(sourceCell.protection);
    }
  }
}

export function cloneWorksheet(sourceWs: ExcelJS.Worksheet, targetWs: ExcelJS.Worksheet): void {
  targetWs.state = sourceWs.state;
  targetWs.properties = deepClone(sourceWs.properties);
  targetWs.pageSetup = deepClone(sourceWs.pageSetup);
  targetWs.headerFooter = deepClone(sourceWs.headerFooter);
  targetWs.views = deepClone(sourceWs.views);
  targetWs.autoFilter = sourceWs.autoFilter ? deepClone(sourceWs.autoFilter) : undefined;

  sourceWs.columns.forEach((column, index) => {
    const targetColumn = targetWs.getColumn(index + 1);

    if (typeof column.width === 'number') {
      targetColumn.width = column.width;
    }
    if (typeof column.hidden === 'boolean') {
      targetColumn.hidden = column.hidden;
    }
    if (typeof column.outlineLevel === 'number') {
      targetColumn.outlineLevel = column.outlineLevel;
    }
    if (column.style) {
      targetColumn.style = deepClone(column.style);
    }
    if (column.numFmt) {
      targetColumn.numFmt = column.numFmt;
    }
  });

  sourceWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = targetWs.getRow(rowNumber);

    if (typeof row.height === 'number') {
      targetRow.height = row.height;
    }
    if (typeof row.hidden === 'boolean') {
      targetRow.hidden = row.hidden;
    }
    if (typeof row.outlineLevel === 'number') {
      targetRow.outlineLevel = row.outlineLevel;
    }

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = cloneCellValue(cell.value);
      targetCell.style = deepClone(cell.style);
      if (cell.numFmt) targetCell.numFmt = cell.numFmt;
      if (cell.font) targetCell.font = deepClone(cell.font);
      if (cell.fill) targetCell.fill = deepClone(cell.fill);
      if (cell.border) targetCell.border = deepClone(cell.border);
      if (cell.alignment) targetCell.alignment = deepClone(cell.alignment);
      if (cell.protection) targetCell.protection = deepClone(cell.protection);
    });
  });

  const merges = sourceWs.model.merges ?? [];
  for (const merge of merges) {
    targetWs.mergeCells(merge);
  }
}

export function formatDateForCell(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatNumberForCell(value: unknown, decimals = 2): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[,\s₹]/g, '').trim());

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const factor = 10 ** decimals;
  return Math.round(parsed * factor) / factor;
}

function toArrayBuffer(buffer: Buffer | Uint8Array | ArrayBuffer): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) {
    return buffer;
  }

  if (Buffer.isBuffer(buffer)) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  }

  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function cloneCellValue(value: ExcelJS.CellValue): ExcelJS.CellValue | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === 'object') {
    const maybe = value as {
      formula?: string;
      result?: ExcelJS.CellValue;
      richText?: Array<{ text?: string }>;
      text?: string;
      hyperlink?: string;
    };

    if (maybe.formula !== undefined) {
      return {
        formula: maybe.formula,
        result: cloneCellValue(maybe.result) ?? undefined,
      } as ExcelJS.CellFormulaValue;
    }

    if (Array.isArray(maybe.richText)) {
      return {
        richText: maybe.richText.map((part) => ({ text: part.text ?? '' })),
      };
    }

    if (typeof maybe.text === 'string' && maybe.hyperlink) {
      return { text: maybe.text, hyperlink: maybe.hyperlink };
    }
  }

  return value;
}
