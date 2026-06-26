/**
 * templateFiller.ts
 * Opens a single .xlsx template with ExcelJS, locates its header row,
 * then writes employee data rows beneath it.
 * Returns the filled workbook as a Buffer — no Python, no subprocess.
 */

import ExcelJS         from 'exceljs';
import { EmployeeRow } from '../types/index.js';
import { cellStr }     from './utils.js';

/** Find the row whose cells best match the master headers. */
function findHeaderRow(
  ws: ExcelJS.Worksheet,
  masterHeaders: Set<string>,
): { rowNum: number; colMap: Map<number, string> } | null {
  let bestRowNum  = -1;
  let bestMatches = 0;
  let bestColMap  = new Map<number, string>();

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const values = row.values as ExcelJS.CellValue[];
    const colMap = new Map<number, string>();
    let matches  = 0;

    values.forEach((cell, colIdx) => {
      if (colIdx === 0) return;
      const txt = cellStr(cell);
      if (masterHeaders.has(txt)) {
        colMap.set(colIdx, txt);
        matches++;
      }
    });

    if (matches > bestMatches) {
      bestMatches = matches;
      bestRowNum  = rowNum;
      bestColMap  = colMap;
    }
  });

  return bestMatches > 0 ? { rowNum: bestRowNum, colMap: bestColMap } : null;
}

export async function fillTemplate(
  templateBuffer: Buffer,
  rows:           EmployeeRow[],
  masterHeaders:  string[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);

  const headerSet = new Set(masterHeaders);

  for (const ws of wb.worksheets) {
    const match = findHeaderRow(ws, headerSet);
    if (!match) continue;

    const { rowNum: headerRowNum, colMap } = match;

    rows.forEach((emp, i) => {
      const writeRowNum = headerRowNum + 1 + i;
      const writeRow    = ws.getRow(writeRowNum);

      colMap.forEach((header, colIdx) => {
        const val = emp[header];
        if (val !== null && val !== undefined) {
          writeRow.getCell(colIdx).value = val instanceof Date
            ? val.toLocaleDateString('en-IN')
            : val;
        }
      });

      writeRow.commit();
    });

    break; // only fill the first matching sheet
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
