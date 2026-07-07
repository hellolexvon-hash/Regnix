/**
 * codeOnWages/registerEngine.ts
 *
 * Generic one-sheet generator engine for Code on Wages forms.
 * Expands the template vertically instead of splitting employees across pages.
 * The total row is always pushed to the bottom after all employee rows.
 */

import ExcelJS from 'exceljs';
import { MasterData } from '../shared/masterReader.js';
import { copyRowStyle, clearRange } from '../shared/excelUtils.js';
import {
  RowValues,
  loadTemplate,
  duplicateTemplateSheet,
  fillTable,
  exportWorkbook,
} from '../shared/templateFiller.js';

export interface RegisterLayout {
  sheetName: string;
  /** First data row in template (1-based) */
  dataStartRow: number;
  /** Last pre-built data row in template (rows beyond this are inserted) */
  dataEndRow: number;
  /** The total/summary row number in the original template */
  totalRow: number;
  /** Number of data columns (for style copy and clear) */
  usedColumns: number;
  /** Which template sheet to clone (default: 1) */
  templateSheetIndex?: number;
  metaWriter: (ws: ExcelJS.Worksheet, companyInfo: MasterData['companyInfo']) => void;
  rowWriter: (
    employee: MasterData['employees'][number],
    zeroIndex: number,
    oneIndex: number,
  ) => RowValues;
  totalWriter: (ws: ExcelJS.Worksheet, totalRow: number, rows: RowValues[]) => void;
}

export async function generateSingleSheetRegister(
  templateBuffer: Buffer,
  masterData: MasterData,
  layout: RegisterLayout,
): Promise<Buffer> {
  const templateWb = await loadTemplate(templateBuffer);
  const outputWb = new ExcelJS.Workbook();
  outputWb.creator = 'Regnix';
  outputWb.created = new Date();
  outputWb.modified = new Date();

  const sheetIndex = layout.templateSheetIndex ?? 1;
  const ws = duplicateTemplateSheet(templateWb, outputWb, layout.sheetName, sheetIndex);

  layout.metaWriter(ws, masterData.companyInfo);

  const capacity = layout.dataEndRow - layout.dataStartRow + 1;
  const extraRows = Math.max(0, masterData.employees.length - capacity);

  // Insert extra rows before the total row, copying style from the last data row
  if (extraRows > 0) {
    const emptyRows: ExcelJS.Row[] = [];
    ws.spliceRows(layout.totalRow, 0, ...Array.from({ length: extraRows }, () => emptyRows));
    for (let i = 0; i < extraRows; i += 1) {
      copyRowStyle(ws, layout.dataEndRow, layout.totalRow + i, layout.usedColumns);
    }
  }

  const actualTotalRow = layout.totalRow + extraRows;

  clearRange(ws, layout.dataStartRow, actualTotalRow, 1, layout.usedColumns);

  const tableRows: RowValues[] = masterData.employees.map((emp, idx) =>
    layout.rowWriter(emp, idx, idx + 1),
  );

  fillTable(ws, layout.dataStartRow, tableRows);
  layout.totalWriter(ws, actualTotalRow, tableRows);

  return exportWorkbook(outputWb);
}

/** Sum a numeric column across all row objects. */
export function sumColumn(rows: RowValues[], column: number): number {
  let total = 0;
  for (const row of rows) {
    const v = row[column];
    if (typeof v === 'number' && Number.isFinite(v)) {
      total += v;
    }
  }
  return Math.round(total * 100) / 100;
}
