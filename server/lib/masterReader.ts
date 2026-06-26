/**
 * masterReader.ts
 * Reads the uploaded Regnix master workbook with ExcelJS (pure Node — no Python).
 * Returns a flat array of employee-row objects keyed by column header.
 */

import ExcelJS         from 'exceljs';
import { EmployeeRow } from '../types/index.js';
import { cellStr }     from './utils.js';

export interface MasterData {
  rows:    EmployeeRow[];
  headers: string[];
}

/** Find the first row where ≥ 2 cells look like text headers (non-numeric). */
function detectHeaderRow(ws: ExcelJS.Worksheet): number | null {
  let found: number | null = null;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (found !== null) return;
    const cells = row.values as ExcelJS.CellValue[];
    const textCells = cells.filter(
      (v) => v !== null && v !== undefined && typeof v === 'string' && isNaN(Number(v)),
    );
    if (textCells.length >= 2) found = rowNumber;
  });
  return found;
}

export async function readMaster(masterBuffer: Buffer): Promise<MasterData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(masterBuffer);

  for (const ws of wb.worksheets) {
    const headerRowNum = detectHeaderRow(ws);
    if (headerRowNum === null) continue;

    const headerRow = ws.getRow(headerRowNum);
    const headers: string[] = [];
    (headerRow.values as ExcelJS.CellValue[]).forEach((cell, idx) => {
      if (idx === 0) return; // ExcelJS row.values is 1-indexed
      headers.push(cellStr(cell) || `Col${idx}`);
    });

    if (headers.length === 0) continue;

    const rows: EmployeeRow[] = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNum) return;

      const values  = row.values as ExcelJS.CellValue[];
      const isEmpty = values.every((v) => v === null || v === undefined || v === '');
      if (isEmpty) return;

      const obj: EmployeeRow = {};
      headers.forEach((hdr, i) => {
        const raw = values[i + 1] ?? null;
        if (raw === null || raw === undefined) {
          obj[hdr] = null;
        } else if (raw instanceof Date) {
          obj[hdr] = raw;
        } else if (typeof raw === 'object' && 'result' in (raw as object)) {
          obj[hdr] = (raw as ExcelJS.CellFormulaValue).result as string | number | null;
        } else {
          obj[hdr] = raw as string | number;
        }
      });
      rows.push(obj);
    });

    if (rows.length > 0) return { rows, headers };
  }

  return { rows: [], headers: [] };
}
