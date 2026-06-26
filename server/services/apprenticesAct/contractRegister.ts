/**
 * apprenticesAct/contractRegister.ts
 *
 * Generates Form AA-2 — Contract of Apprenticeship Register
 * The Apprentices Act, 1961 – Section 4 | Apprenticeship Rules, 1992 – Rule 5
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via APPRENTICES_ACT_COLUMNS)
 *
 *  C1  → Sl No                       (generated)
 *  C2  → employeeName                401
 *  C3  → napsRegistrationNo          27
 *  C4  → trade                       47
 *  C5  → contractNo                  94
 *  C6  → contractExecutionDate       323
 *  C7  → contractCommencementDate    554
 *  C8  → apprenticeshipPeriod        446
 *  C9  → contractExpiryDate          324
 *  C10 → stipendAgreed               290
 *  C11 → contractorName              39
 *  C12 → contractSignedEmployer      555
 *  C13 → contractSignedApprentice    557
 *  C14 → boatRegistered              492
 *  C15 → boatRegistrationDate        326
 *  C16 → contractStatus              493
 *  C17 → contractRemarks             489
 *
 * TO CHANGE A COLUMN: edit apprenticesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate, round2 } from '../shared/masterReader.js';
import { APPRENTICES_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Contract Register';
const DATA_START_ROW = 6;
const DATA_END_ROW   = 19;
const TOTAL_ROW      = 21;
const USED_COLUMNS   = 17;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCellAddress(ws, 'D3', getString(companyInfo, M.establishmentName));
  fillCellAddress(ws, 'M3', getString(companyInfo, M.registrationNumber));
}

export async function generateContractRegister(
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
      2:  getString(emp, M.employeeName),                                // 401
      3:  getString(emp, M.napsRegistrationNo),                          // 27
      4:  getString(emp, M.trade),                                       // 47
      5:  getString(emp, M.contractNo),                                  // 94
      6:  formatDate(getDate(emp, M.contractExecutionDate)),             // 323
      7:  formatDate(getDate(emp, M.contractCommencementDate)),          // 554
      8:  getNumber(emp, M.apprenticeshipPeriod),                        // 446
      9:  formatDate(getDate(emp, M.contractExpiryDate)),                // 324
      10: round2(getNumber(emp, M.stipendAgreed)),                       // 290
      11: getString(emp, M.contractorName),                              // 39
      12: getString(emp, M.contractSignedEmployer),                      // 555
      13: getString(emp, M.contractSignedApprentice),                    // 557
      14: getString(emp, M.boatRegistered),                              // 492
      15: formatDate(getDate(emp, M.boatRegistrationDate)),              // 326
      16: getString(emp, M.contractStatus),                              // 493
      17: getString(emp, M.contractRemarks),                             // 489
    }),
    totalWriter: (_ws, _totalRow, _rows) => {
      // Summary block uses COUNTIF formulas in the template
    },
  });
}
