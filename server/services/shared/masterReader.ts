/**
 * shared/masterReader.ts
 *
 * Reads the Regnix Master Register workbook once and exposes structured rows
 * using fixed column numbers only.
 *
 * No header-name discovery. No string matching on field names.
 */

import ExcelJS from 'exceljs';
import { loadWorkbookFromBuffer, formatDateForCell, formatNumberForCell } from './excelUtils.js';

export type CellPrimitive = string | number | boolean | Date | null;
export type CellValue = CellPrimitive | ExcelJS.CellValue | Record<string, unknown>;

export interface MasterRow {
  rowNumber: number;
  [columnNumber: number]: CellValue;
}

export interface MasterData {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  companyInfo: Record<number, CellValue>;
  employees: MasterRow[];
}

const MASTER_SHEET_NAME = 'Master Register - Structured';
const FIRST_DATA_ROW = 3;

export async function readMasterWorkbook(
  buffer: Buffer | Uint8Array | ArrayBuffer,
): Promise<MasterData> {
  const workbook = await loadWorkbookFromBuffer(buffer);
  const sheet = workbook.getWorksheet(MASTER_SHEET_NAME) ?? workbook.worksheets[0];

  if (!sheet) {
    throw new Error('readMasterWorkbook: no worksheet found in the uploaded master workbook.');
  }

  const employees = readEmployeeRows(sheet);
  const companyInfo = deriveCompanyInfo(employees);

  return {
    workbook,
    sheetName: sheet.name,
    companyInfo,
    employees,
  };
}

export function getString(row: Record<number, unknown> | null | undefined, col: number): string {
  const value = getRawValue(row, col);
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (value instanceof Date) {
    return formatDateForCell(value);
  }

  if (typeof value === 'object') {
    const maybe = value as { text?: unknown; richText?: Array<{ text?: string }>; result?: unknown };
    if (typeof maybe.text === 'string') {
      return maybe.text.trim();
    }
    if (Array.isArray(maybe.richText)) {
      return maybe.richText.map((part) => part.text ?? '').join('').trim();
    }
    if ('result' in maybe) {
      return getString({ 1: maybe.result }, 1);
    }
  }

  return String(value).trim();
}

export function getNumber(row: Record<number, unknown> | null | undefined, col: number): number | null {
  const value = getRawValue(row, col);
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (value instanceof Date) {
    return null;
  }

  if (typeof value === 'object') {
    const maybe = value as { result?: unknown; text?: unknown };
    if ('result' in maybe) {
      return getNumber({ 1: maybe.result }, 1);
    }
    if (typeof maybe.text === 'string') {
      return getNumber({ 1: maybe.text }, 1);
    }
  }

  return formatNumberForCell(String(value)) ?? null;
}

export function getDate(row: Record<number, unknown> | null | undefined, col: number): Date | null {
  const value = getRawValue(row, col);
  return coerceDate(value);
}

export function isEmptyRow(row: ExcelJS.Row | Record<number, unknown> | null | undefined): boolean {
  if (!row) {
    return true;
  }

  if (typeof (row as ExcelJS.Row).eachCell === 'function') {
    let hasValue = false;
    (row as ExcelJS.Row).eachCell({ includeEmpty: false }, (cell) => {
      if (!isBlankValue(cell.value)) {
        hasValue = true;
      }
    });
    return !hasValue;
  }

  return Object.values(row).every(isBlankValue);
}

export function formatDate(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) {
    return '';
  }

  const dd = String(value.getDate()).padStart(2, '0');
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const yyyy = value.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function round2(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return null;
  }
  return Math.round(Number(value) * 100) / 100;
}

export function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) {
    return null;
  }

  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return Number.isNaN(dateInfo.getTime()) ? null : dateInfo;
}

function readEmployeeRows(sheet: ExcelJS.Worksheet): MasterRow[] {
  const rows: MasterRow[] = [];

  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (isEmptyRow(row)) {
      continue;
    }

    const structured: MasterRow = { rowNumber };
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      structured[colNumber] = normalizeCellValue(cell.value);
    });

    rows.push(structured);
  }

  return rows;
}

function deriveCompanyInfo(rows: MasterRow[]): Record<number, CellValue> {
  const priorityColumns = [391, 392, 394, 176, 2, 9, 401, 47, 45];
  const companyInfo: Record<number, CellValue> = {};

  for (const col of priorityColumns) {
    const value = findFirstNonEmptyValue(rows, col);
    if (value !== null && value !== undefined && value !== '') {
      companyInfo[col] = value;
    }
  }

  return companyInfo;
}

function findFirstNonEmptyValue(rows: MasterRow[], col: number): CellValue {
  for (const row of rows) {
    const value = row[col];
    if (!isBlankValue(value)) {
      return value;
    }
  }
  return null;
}

function isBlankValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  if (typeof value === 'number') {
    return Number.isNaN(value);
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime());
  }

  if (typeof value === 'object') {
    const maybe = value as {
      result?: unknown;
      text?: unknown;
      richText?: Array<{ text?: string }>;
    };

    if ('result' in maybe) {
      return isBlankValue(maybe.result);
    }

    if (typeof maybe.text === 'string') {
      return maybe.text.trim() === '';
    }

    if (Array.isArray(maybe.richText)) {
      return maybe.richText.map((part) => part.text ?? '').join('').trim() === '';
    }
  }

  return false;
}

function getRawValue(row: Record<number, unknown> | null | undefined, col: number): unknown {
  if (!row) {
    return null;
  }

  return col in row ? row[col] : null;
}

function normalizeCellValue(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object') {
    if ('text' in value && typeof (value as { text?: unknown }).text === 'string') {
      return (value as { text: string }).text;
    }
    if ('richText' in value) {
      const rich = value as { richText?: Array<{ text?: string }> };
      return (rich.richText ?? []).map((part) => part.text ?? '').join('');
    }
    if ('result' in value) {
      const formulaValue = value as { result?: ExcelJS.CellValue };
      return normalizeCellValue(formulaValue.result as ExcelJS.CellValue);
    }
  }

  return value as CellPrimitive;
}

function coerceDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }

  if (typeof value === 'object') {
    const maybe = value as { result?: unknown; text?: unknown };
    if ('result' in maybe) {
      return coerceDate(maybe.result);
    }
    if (typeof maybe.text === 'string') {
      return coerceDate(maybe.text);
    }
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
