/**
 * codeOnWages/finesRegister.ts
 *
 * Generates Form I — Register of Fines
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CODE_ON_WAGES_COLUMNS)
 *
 *  C1  → Sl No             (generated)
 *  C2  → employeeCode      9
 *  C3  → employeeName      401   ← CORRECTED
 *  C4  → department        46
 *  C5  → designation       47
 *  C6  → dateOfOffence     295
 *  C7  → actOmissionForFine 301
 *  C8  → dateOffenceNoticed 299   ← CORRECTED (was 295)
 *  C9  → dateShowCauseNotice 406  ← CORRECTED (was 296)
 *  C10 → dateFineOrder     300
 *  C11 → wagePeriodOfFine  432
 *  C12 → amountOfFine      215
 *  C13 → dateOfRecovery    303
 *  C14 → amountRecovered   304
 *  C15 → balancePending    436
 *  C16 → finesRemarks      217
 *
 * TO CHANGE A COLUMN: edit the mapping in codeOnWages/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate, round2 } from '../shared/masterReader.js';
import { CODE_ON_WAGES_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Form I - Register of Fines';
const DATA_START_ROW = 11;
const DATA_END_ROW   = 18;
const TOTAL_ROW      = 19;
const USED_COLUMNS   = 16;

function monthYearLabel(employees: MasterData['employees']): string {
  const first = employees
    .map((r) => getDate(r, M.dateOfPayment))
    .find((v): v is Date => v instanceof Date);
  return (first ?? new Date()).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
  employees: MasterData['employees'],
): void {
  // The template's labels live on rows 4-7.
  // Establishment name and address share the merged value cell C4:E5.
  const establishment = getString(companyInfo, M.establishmentName);
  const address = getString(companyInfo, M.address);
  fillCellAddress(ws, 'C4', address ? `${establishment}\n${address}` : establishment);
  fillCellAddress(ws, 'J4', getString(companyInfo, M.registrationNumber));
  const payDate = employees.map((r) => getDate(r, M.dateOfPayment)).find((v): v is Date => v instanceof Date);
  fillCellAddress(ws, 'J5', String((payDate ?? new Date()).getFullYear()));
  fillCellAddress(ws, 'C6', getString(companyInfo, M.natureOfIndustry));
  fillCellAddress(ws, 'C7', monthYearLabel(employees));
}

export async function generateFinesRegister(
  templateBuffer: Buffer,
  masterData: MasterData,
): Promise<Buffer> {
  return generateSingleSheetRegister(templateBuffer, masterData, {
    sheetName:    SHEET_TITLE,
    dataStartRow: DATA_START_ROW,
    dataEndRow:   DATA_END_ROW,
    totalRow:     TOTAL_ROW,
    usedColumns:  USED_COLUMNS,
    metaWriter: (ws) => writeCompanyMeta(ws, masterData.companyInfo, masterData.employees),
    rowWriter: (emp, _, oneIndex) => {
      const fineAmt   = round2(getNumber(emp, M.amountOfFine));
      const recovered = round2(getNumber(emp, M.amountRecovered));
      const balance   = fineAmt !== null && recovered !== null
        ? round2(fineAmt - recovered)
        : round2(getNumber(emp, M.balancePending));

      return {
        1:  oneIndex,
        2:  getString(emp, M.employeeCode),
        3:  getString(emp, M.employeeName),
        4:  getString(emp, M.department),
        5:  getString(emp, M.designation),
        6:  formatDate(getDate(emp, M.dateOfOffence)),
        7:  getString(emp, M.actOmissionForFine),
        8:  formatDate(getDate(emp, M.dateOffenceNoticed)),
        9:  formatDate(getDate(emp, M.dateShowCauseNotice)),
        10: formatDate(getDate(emp, M.dateFineOrder)),
        11: getString(emp, M.wagePeriodOfFine),
        12: fineAmt,
        13: formatDate(getDate(emp, M.dateOfRecovery)),
        14: recovered,
        15: balance,
        16: getString(emp, M.finesRemarks) || getString(emp, M.remarks),
      };
    },
    totalWriter: (ws, totalRow, rows) => {
      fillCellAddress(ws, `A${totalRow}`, 'Total');
      fillCellAddress(ws, `L${totalRow}`, sumColumn(rows, 12));
      fillCellAddress(ws, `N${totalRow}`, sumColumn(rows, 14));
      fillCellAddress(ws, `O${totalRow}`, sumColumn(rows, 15));
    },
  });
}