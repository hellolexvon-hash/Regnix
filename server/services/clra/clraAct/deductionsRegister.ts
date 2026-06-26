/**
 * clraAct/deductionsRegister.ts
 *
 * Generates FORM XX — Register of Deductions for Damage or Loss
 * Contract Labour (Regulation & Abolition) Act, 1970
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                    (generated)
 *  C2  → employeeCode               9
 *  C3  → employeeName               101
 *  C4  → designation                47
 *  C5  → dateOfDamage               210
 *  C6  → natureOfDamage             209
 *  C7  → estimatedDamage            293
 *  C8  → amountOfDeduction          292
 *  C9  → numberOfInstallments       409
 *  C10 → amountPerInstallment       294
 *  C11 → dateOfRecovery             303
 *  C12 → damageRemarks              222
 *  C13 → damageSignature            398
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCell } from '../../shared/templateFiller.js';

const SHEET_TITLE    = 'Form XX – Reg. of Deductions';
const DATA_START_ROW = 8;
const DATA_END_ROW   = 17;
const TOTAL_ROW      = 28;
const USED_COLUMNS   = 13;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  const name = getString(companyInfo, M.establishmentName);
  fillCell(ws, 4, 2,  name);
  fillCell(ws, 4, 8,  getString(companyInfo, M.licenceNumber));
  fillCell(ws, 5, 2,  name);
  fillCell(ws, 5, 8,  getString(companyInfo, M.address));
}

export async function generateDeductionsRegister(
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
      5:  formatDate(getDate(emp, M.dateOfDamage)),
      6:  getString(emp, M.natureOfDamage),
      7:  getNumber(emp, M.estimatedDamage),
      8:  getNumber(emp, M.amountOfDeduction),
      9:  getNumber(emp, M.numberOfInstallments),
      10: getNumber(emp, M.amountPerInstallment),
      11: formatDate(getDate(emp, M.dateOfRecovery)),
      12: getString(emp, M.damageRemarks),
      13: getString(emp, M.damageSignature),
    }),
    totalWriter: (_ws, _totalRow, _rows) => { /* no totals */ },
  });
}
