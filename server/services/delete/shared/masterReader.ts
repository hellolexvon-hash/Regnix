/**
 * shared/masterReader.ts
 *
 * Reads the Regnix Master Register workbook.
 * Returns strongly typed company info and employee rows.
 *
 * Rules:
 *  - Never scans for header names.
 *  - Never relies on worksheet titles.
 *  - Column numbers are provided by callers via mapping files.
 *  - Row 1 is skipped (assumed header).
 *  - Empty rows are skipped.
 */

import ExcelJS from 'exceljs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CellValue = string | number | Date | boolean | null;

export interface EmployeeRecord {
  [columnIndex: number]: CellValue;
}

export interface CompanyInfo {
  [columnIndex: number]: CellValue;
}

export interface MasterData {
  companyInfo: CompanyInfo;
  employees: EmployeeRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveCell(raw: ExcelJS.CellValue): CellValue {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && 'result' in (raw as object)) {
    const formula = raw as ExcelJS.CellFormulaValue;
    return resolveCell(formula.result as ExcelJS.CellValue);
  }
  if (typeof raw === 'object' && 'richText' in (raw as object)) {
    const rt = raw as ExcelJS.CellRichTextValue;
    return rt.richText.map((r) => r.text).join('').trim() || null;
  }
  if (typeof raw === 'object' && 'error' in (raw as object)) return null;
  return raw as CellValue;
}

function isRowEmpty(row: ExcelJS.Row): boolean {
  let empty = true;
  row.eachCell({ includeEmpty: false }, () => { empty = false; });
  return empty;
}

function extractRowRecord(row: ExcelJS.Row): EmployeeRecord {
  const record: EmployeeRecord = {};
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const v = resolveCell(cell.value);
    if (v !== null) record[colNumber] = v;
  });
  return record;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Read master workbook.
 *
 * @param buffer - Raw .xlsx bytes.
 * @param headerRow - 1-based row number of the header (default 1).
 * @param dataStartRow - 1-based row where employee data begins (default 2).
 * @returns MasterData with companyInfo (row 1 values) and employees array.
 */
export async function readMasterWorkbook(
  buffer: Buffer,
  headerRow = 1,
  dataStartRow = 2,
): Promise<MasterData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Use the first worksheet that has data
  let targetWs: ExcelJS.Worksheet | null = null;
  for (const ws of wb.worksheets) {
    if (ws.rowCount >= dataStartRow) {
      targetWs = ws;
      break;
    }
  }

  if (!targetWs) {
    throw new Error('readMasterWorkbook: no usable worksheet found in master workbook.');
  }

  // Company info = header row cell values
  const companyInfo: CompanyInfo = extractRowRecord(targetWs.getRow(headerRow));

  // Employee data rows
  const employees: EmployeeRecord[] = [];
  for (let r = dataStartRow; r <= targetWs.rowCount; r++) {
    const row = targetWs.getRow(r);
    if (isRowEmpty(row)) continue;
    employees.push(extractRowRecord(row));
  }

  return { companyInfo, employees };
}

// ─── Column accessor helpers ──────────────────────────────────────────────────

export function getString(record: EmployeeRecord, col: number): string {
  const v = record[col];
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return formatDate(v);
  return String(v).trim();
}

export function getNumber(record: EmployeeRecord, col: number): number | null {
  const v = record[col];
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

export function getDate(record: EmployeeRecord, col: number): Date | null {
  const v = record[col];
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string') {
    const d = new Date(v.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDate(date: Date | null): string {
  if (!date) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getFullYear()}`;
}

export function round2(v: number | null): number | null {
  if (v === null) return null;
  return Math.round(v * 100) / 100;
}

export function sumFields(record: EmployeeRecord, cols: number[]): number {
  return cols.reduce((s, c) => s + (getNumber(record, c) ?? 0), 0);
}
