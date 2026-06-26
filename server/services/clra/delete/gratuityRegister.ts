/**
 * clraAct/gratuityRegister.ts
 *
 * Generates Gratuity Register — Payment of Gratuity Act
 * Maintained under CLRA Act 1970 records
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9
 *  C3  → employeeName               101
 *  C4  → designation                47
 *  C5  → bonusDoj (DOJ)             270
 *  C6  → dateOfEligibility          280
 *  C7  → basicWage (last drawn)     284
 *  C8  → years of service           (blank — calculated)
 *  C9  → gratuity formula           (static text in template)
 *  C10 → gratuity amount payable    (blank — calculated)
 *  C11 → nomineeName                131
 *  C12 → nomineeRelation            132
 *  C13 → nomineeDob                 98
 *  C14 → gratuity paid date         (blank — manual)
 *  C15 → mode of payment            (blank — manual)
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Gratuity Register Gratuity Act';
const DATA_START_ROW = 5;
const DATA_END_ROW   = 12;
const TOTAL_ROW      = 13;
const USED_COLUMNS   = 15;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCellAddress(ws, 'A2', `GRATUITY REGISTER  |  Establishment: ${getString(companyInfo, M.establishmentName)}`);
}

export async function generateGratuityRegister(
  templateBuffer: Buffer,
  masterData: MasterData,
): Promise<Buffer> {
  return generateSingleSheetRegister(templateBuffer, masterData, {
    sheetName:    SHEET_TITLE,
    dataStartRow: DATA_START_ROW,
    dataEndRow:   DATA_END_ROW,
    totalRow:     TOTAL_ROW,
    usedColumns:  USED_COLUMNS,
    metaWriter: (ws) => writeCompanyMeta(ws, masterData.companyInfo),
    rowWriter: (emp, _, oneIndex) => ({
      1:  oneIndex,
      2:  getString(emp, M.employeeCode),
      3:  getString(emp, M.employeeName),
      4:  getString(emp, M.designation),
      5:  formatDate(getDate(emp, M.bonusDoj)),
      6:  formatDate(getDate(emp, M.dateOfEligibility)),
      7:  getNumber(emp, M.basicWage),
      // C8: years of service — calculated field, left blank
      // C9: formula text — static in template
      // C10: gratuity amount — calculated field, left blank
      11: getString(emp, M.nomineeName),
      12: getString(emp, M.nomineeRelation),
      13: formatDate(getDate(emp, M.nomineeDob)),
      // C14, C15: paid date and mode — manual entry
    }),
    totalWriter: (_ws, _totalRow, _rows) => { /* no auto totals */ },
  });
}
