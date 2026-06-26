/**
 * clraAct/workmenRegister.ts
 *
 * Generates FORM I — Register of Workmen
 * Contract Labour (Regulation & Abolition) Act, 1970
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CLRA_ACT_COLUMNS)
 *
 *  C1  → Sl. No.                     (generated)
 *  C2  → employeeCode                9
 *  C3  → regnixId                    20
 *  C4  → employeeName                101
 *  C5  → guardianName                73
 *  C6  → dateOfBirth                 87
 *  C7  → age                         74
 *  C8  → gender                      516
 *  C9  → maritalStatus               88
 *  C10 → religion                    89
 *  C11 → nationality                 90
 *  C12 → bloodGroup                  91
 *  C13 → differentlyAbled            92
 *  C14 → designation                 47
 *  C15 → department                  46
 *  C16 → permanentAddress            452
 *  C17 → localAddress                453
 *  C18 → mobileNumber                94
 *  C19 → emailId                     96
 *  C20 → dateOfJoining               270
 *  C21 → dateOfTermination           271
 *  C22 → reasonForTermination        399
 *  C23 → aadhaarNumber               76
 *  C24 → panNumber                   77
 *  C25 → uanNumber                   13
 *  C26 → esicIpNumber                16
 *  C27 → bankName                    244
 *  C28 → bankAccountNumber           276
 *  C29 → ifscCode                    277
 *  C30 → identificationMarks         75
 *  C31 → employeeStatus              463
 *  C32 → offerLetterIssued           345
 *  C33 → appointmentLetterIssued     346
 *  C34 → form11Submitted             347
 *  C35 → form1Submitted              348
 *  C36 → nominationFormSubmitted     349
 *  C37 → complianceOfficer           353
 *  C38 → lastAuditDate               351
 *  C39 → remarks                     503
 *
 * TO CHANGE A COLUMN: edit clraAct/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getDate, formatDate } from '../../shared/masterReader.js';
import { CLRA_ACT_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister } from './registerEngine.js';
import { fillCellAddress } from '../../shared/templateFiller.js';

const SHEET_TITLE    = 'Form I Workmen Register';
const DATA_START_ROW = 6;
const DATA_END_ROW   = 15;
const TOTAL_ROW      = 16;
const USED_COLUMNS   = 39;

function writeCompanyMeta(
  ws: ExcelJS.Worksheet,
  companyInfo: MasterData['companyInfo'],
): void {
  // Row 3: "Principal Employer: AD" | "Contractor: AF"
  // We write establishment name as principal employer, registration as CL reg no
  fillCellAddress(ws, 'A3', `Principal Employer: ${getString(companyInfo, M.establishmentName)}`);
  fillCellAddress(ws, 'K3', `Contractor: ${getString(companyInfo, M.establishmentName)}`);
}

export async function generateWorkmenRegister(
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
      3:  getString(emp, M.regnixId),
      4:  getString(emp, M.employeeName),
      5:  getString(emp, M.guardianName),
      6:  formatDate(getDate(emp, M.dateOfBirth)),
      7:  getString(emp, M.age),
      8:  getString(emp, M.gender),
      9:  getString(emp, M.maritalStatus),
      10: getString(emp, M.religion),
      11: getString(emp, M.nationality),
      12: getString(emp, M.bloodGroup),
      13: getString(emp, M.differentlyAbled),
      14: getString(emp, M.designation),
      15: getString(emp, M.department),
      16: getString(emp, M.permanentAddress),
      17: getString(emp, M.localAddress),
      18: getString(emp, M.mobileNumber),
      19: getString(emp, M.emailId),
      20: formatDate(getDate(emp, M.dateOfJoining)),
      21: formatDate(getDate(emp, M.dateOfTermination)),
      22: getString(emp, M.reasonForTermination),
      23: getString(emp, M.aadhaarNumber),
      24: getString(emp, M.panNumber),
      25: getString(emp, M.uanNumber),
      26: getString(emp, M.esicIpNumber),
      27: getString(emp, M.bankName),
      28: getString(emp, M.bankAccountNumber),
      29: getString(emp, M.ifscCode),
      30: getString(emp, M.identificationMarks),
      31: getString(emp, M.employeeStatus),
      32: getString(emp, M.offerLetterIssued),
      33: getString(emp, M.appointmentLetterIssued),
      34: getString(emp, M.form11Submitted),
      35: getString(emp, M.form1Submitted),
      36: getString(emp, M.nominationFormSubmitted),
      37: getString(emp, M.complianceOfficer),
      38: formatDate(getDate(emp, M.lastAuditDate)),
      39: getString(emp, M.remarks),
    }),
    totalWriter: (_ws, _totalRow, _rows) => { /* no totals */ },
  });
}
