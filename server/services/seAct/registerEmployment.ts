/**
 * server/services/seAct/registerEmployment.ts
 *
 * Register of Employment (Form-F / Form B / Form XXII) — all states.
 *
 * COLUMN MAP (template row 7 letter codes → master column numbers):
 *   A   → 1   slNo
 *   I   → 9   employeeCode
 *   T   → 20  regnixId
 *   OK  → 401 employeeName
 *   BU  → 73  fatherOrHusbandName
 *   CI  → 87  dateOfBirth
 *   BV  → 74  age
 *   TX  → 516 gender
 *   CJ  → 88  maritalStatus
 *   CK  → 89  religion
 *   CL  → 90  nationality
 *   CM  → 91  bloodGroup
 *   CN  → 92  differentlyAbled
 *   AU  → 47  designation
 *   AT  → 46  department
 *   QJ  → 452 permanentAddress
 *   QK  → 453 localAddress
 *   CP  → 94  mobileNo
 *   CR  → 96  emailId
 *   JJ  → 270 dateOfJoining
 *   JK  → 271 dateOfTermination
 *   OI  → 399 reasonForTermination
 *   BX  → 76  aadhaarNo
 *   BY  → 77  panNo
 *   M   → 13  uanPf
 *   P   → 16  esicIpNo
 *   IJ  → 244 bankName
 *   JP  → 276 bankAccountNo
 *   JQ  → 277 ifscCode
 *   BW  → 75  identificationMarks
 *   QU  → 463 employeeStatus
 *   MD  → 345 offerLetterIssued
 *   ME  → 346 appointmentLetterIssued
 *   MF  → 347 form11Submitted
 *   MG  → 348 form1Submitted
 *   MH  → 349 nominationFormSubmitted
 *   MO  → 353 complianceOfficer
 *   ML  → 351 lastAuditDate
 *   SI  → 503 remarks
 *   QC  → 445 qualification
 *   QB  → 444 category
 */

import ExcelJS from 'exceljs';
import {
  loadWorkbookFromBuffer,
  workbookToBuffer,
  safeSetCell,
} from '../shared/excelUtils.js';
import { getString, getDate, formatDate } from '../shared/masterReader.js';
import { SE_ACT_COLUMNS as C } from './mapping.js';
import type { MasterRow } from '../shared/masterReader.js';

const DATA_START_ROW = 8;  // Row 7 = mapping row, row 8 = first data row

export async function generateRegisterEmployment(
  templateBuffer: Buffer,
  employees: MasterRow[],
): Promise<Buffer> {
  const wb = await loadWorkbookFromBuffer(templateBuffer);
  const ws = wb.getWorksheet(1) ?? wb.worksheets[0];
  if (!ws) throw new Error('seAct/registerEmployment: no worksheet in template');

  // Insert rows if employees > template rows (template typically has a few rows)
  const templateDataRows = countTemplateDataRows(ws);
  if (employees.length > templateDataRows) {
    ws.spliceRows(DATA_START_ROW + templateDataRows, 0, ...Array(employees.length - templateDataRows).fill([]));
  }

  employees.forEach((emp, idx) => {
    const rowNum = DATA_START_ROW + idx;
    safeSetCell(ws, rowNum, 1,  idx + 1);
    safeSetCell(ws, rowNum, 2,  getString(emp, C.employeeCode));
    safeSetCell(ws, rowNum, 3,  getString(emp, C.regnixId));
    safeSetCell(ws, rowNum, 4,  getString(emp, C.employeeName));
    safeSetCell(ws, rowNum, 5,  getString(emp, C.fatherOrHusbandName));
    safeSetCell(ws, rowNum, 6,  formatDate(getDate(emp, C.dateOfBirth)));
    safeSetCell(ws, rowNum, 7,  getString(emp, C.age));
    safeSetCell(ws, rowNum, 8,  getString(emp, C.gender));
    safeSetCell(ws, rowNum, 9,  getString(emp, C.maritalStatus));
    safeSetCell(ws, rowNum, 10, getString(emp, C.religion));
    safeSetCell(ws, rowNum, 11, getString(emp, C.nationality));
    safeSetCell(ws, rowNum, 12, getString(emp, C.bloodGroup));
    safeSetCell(ws, rowNum, 13, getString(emp, C.differentlyAbled));
    safeSetCell(ws, rowNum, 14, getString(emp, C.designation));
    safeSetCell(ws, rowNum, 15, getString(emp, C.department));
    safeSetCell(ws, rowNum, 16, getString(emp, C.permanentAddress));
    safeSetCell(ws, rowNum, 17, getString(emp, C.localAddress));
    safeSetCell(ws, rowNum, 18, getString(emp, C.mobileNo));
    safeSetCell(ws, rowNum, 19, getString(emp, C.emailId));
    safeSetCell(ws, rowNum, 20, formatDate(getDate(emp, C.dateOfJoining)));
    safeSetCell(ws, rowNum, 21, formatDate(getDate(emp, C.dateOfTermination)));
    safeSetCell(ws, rowNum, 22, getString(emp, C.reasonForTermination));
    safeSetCell(ws, rowNum, 23, getString(emp, C.aadhaarNo));
    safeSetCell(ws, rowNum, 24, getString(emp, C.panNo));
    safeSetCell(ws, rowNum, 25, getString(emp, C.uanPf));
    safeSetCell(ws, rowNum, 26, getString(emp, C.esicIpNo));
    safeSetCell(ws, rowNum, 27, getString(emp, C.bankName));
    safeSetCell(ws, rowNum, 28, getString(emp, C.bankAccountNo));
    safeSetCell(ws, rowNum, 29, getString(emp, C.ifscCode));
    safeSetCell(ws, rowNum, 30, getString(emp, C.identificationMarks));
    safeSetCell(ws, rowNum, 31, getString(emp, C.employeeStatus));
    safeSetCell(ws, rowNum, 32, getString(emp, C.offerLetterIssued));
    safeSetCell(ws, rowNum, 33, getString(emp, C.appointmentLetterIssued));
    safeSetCell(ws, rowNum, 34, getString(emp, C.form11Submitted));
    safeSetCell(ws, rowNum, 35, getString(emp, C.form1Submitted));
    safeSetCell(ws, rowNum, 36, getString(emp, C.nominationFormSubmitted));
    safeSetCell(ws, rowNum, 37, getString(emp, C.complianceOfficer));
    safeSetCell(ws, rowNum, 38, getString(emp, C.lastAuditDate));
    safeSetCell(ws, rowNum, 39, getString(emp, C.remarks));
    safeSetCell(ws, rowNum, 40, getString(emp, C.qualification));
    safeSetCell(ws, rowNum, 41, getString(emp, C.category));
  });

  return workbookToBuffer(wb);
}

function countTemplateDataRows(ws: ExcelJS.Worksheet): number {
  let count = 0;
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const cell = ws.getCell(r, 1);
    if (cell.value !== null && cell.value !== undefined) count++;
    else break;
  }
  return Math.max(count, 1);
}
