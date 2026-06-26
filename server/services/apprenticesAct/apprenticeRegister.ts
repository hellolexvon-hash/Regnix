/**
 * apprenticesAct/apprenticeRegister.ts
 *
 * Generates Form AA-1 — Apprentice Register
 * The Apprentices Act, 1961 – Section 18 | Apprenticeship Rules, 1992 – Rule 13
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via APPRENTICES_ACT_COLUMNS)
 *
 *  C1  → Sl No                       (generated)
 *  C2  → employeeName                401
 *  C3  → napsRegistrationNo          27
 *  C4  → dateOfBirth                 87
 *  C5  → gender                      516
 *  C6  → category                    444
 *  C7  → educationalQualification    445
 *  C8  → trade                       47
 *  C9  → apprenticeshipType          46
 *  C10 → durationMonths              446
 *  C11 → dateOfCommencement          467
 *  C12 → dateOfCompletion            468
 *  C13 → aadharNumber                76
 *  C14 → guardianName                73
 *  C15 → contactNumber               94
 *  C16 → address                     452
 *  C17 → currentStatus               463
 *  C18 → remarks                     503
 *
 * TO CHANGE A COLUMN: edit apprenticesAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate } from '../shared/masterReader.js';
import { APPRENTICES_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'Apprentice Register';
const DATA_START_ROW = 6;
const DATA_END_ROW   = 19;
const TOTAL_ROW      = 21; // summary block starts at 21; no totals row needed
const USED_COLUMNS   = 18;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  fillCellAddress(ws, 'D3', getString(companyInfo, M.establishmentName));
  fillCellAddress(ws, 'M3', getString(companyInfo, M.registrationNumber));
}

export async function generateApprenticeRegister(
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
      4:  formatDate(getDate(emp, M.dateOfBirth)),                       // 87
      5:  getString(emp, M.gender),                                      // 516
      6:  getString(emp, M.category),                                    // 444
      7:  getString(emp, M.educationalQualification),                    // 445
      8:  getString(emp, M.trade),                                       // 47
      9:  getString(emp, M.apprenticeshipType),                          // 46
      10: getNumber(emp, M.durationMonths),                              // 446
      11: formatDate(getDate(emp, M.dateOfCommencement)),                // 467
      12: formatDate(getDate(emp, M.dateOfCompletion)),                  // 468
      13: getString(emp, M.aadharNumber),                               // 76
      14: getString(emp, M.guardianName),                               // 73
      15: getString(emp, M.contactNumber),                              // 94
      16: getString(emp, M.address),                                    // 452
      17: getString(emp, M.currentStatus),                              // 463
      18: getString(emp, M.remarks),                                    // 503
    }),
    totalWriter: (_ws, _totalRow, _rows) => {
      // Summary block uses COUNTA formulas in the template — no manual totals needed
    },
  });
}
