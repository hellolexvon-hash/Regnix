/**
 * codeOnWages/musterRollCumWageRegister.ts
 *
 * Generates Form II — Muster Roll cum Wage Register [See Rule 27(1)]
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CODE_ON_WAGES_COLUMNS)
 *
 * REBUILT from the actual template's own embedded legend row (row 11 of the
 * generated .xlsx), not the old assumed 85-column scheme. The old scheme
 * had 85 columns with dedicated UAN/PF-ID columns and days starting at C20;
 * the real template has only 64 columns, no dedicated UAN/PF-ID columns,
 * and days start at C18. That mismatch was the root cause of every field
 * appearing under the wrong header in generated output.
 *
 *  C1  → Sl No                      (generated)       1
 *  C2  → employeeCode               9
 *  C3  → employeeName               401 (fallback 101 — 401 often blank)
 *  C4  → establishmentName          391
 *  C5  → baseWorkLocation           526  (FLAGGED — template legend has no annotation for this col; using existing baseWorkLocation field as best fit for "Base working location")
 *  C6  → depute working location    UNRESOLVED — template legend has no annotation and no master field name fits "Depute working location". Left blank rather than guess. Please confirm intended source.
 *  C7  → principalEmployerNatureOfWorkDone  400  (template legend: OJ — this is a DIFFERENT field from workingAreaProject; template wants OJ here specifically)
 *  C8  → projectName                44   (template legend: AR)
 *  C9  → employeeName               401 (fallback 101 — duplicate full name; template legend: OK)
 *  C10 → endClientName              525  (FLAGGED — template legend has no annotation; using existing endClientName field as best fit)
 *  C11 → ageAndSexGender            74   (template legend: BV — header says "Age" but source is the combined age/gender field)
 *  C12 → employeeAge                239  (template legend: IE — header says "Gender" but source is the numeric age field; this mismatch exists in the template's own header/legend pairing, not something we introduced)
 *  C13 → designation                47   (template legend: AU)
 *  C14 → skillCategory              64   (template legend: BL)
 *  C15 → dateOfEntryIntoService     270  (template legend: JJ)
 *  C16 → workingHoursFromTo         415  (template legend: OY)
 *  C17 → restMealIntervals          416  (template legend: OZ)
 *  C18–C48 → day1–day31             144–174  (template legend: EN–FR)
 *  C49 → totalDaysWorked            246  (template legend: IL)
 *  C50 → minWageBasic               52   (template legend: AZ)
 *  C51 → actualRateOfWages          197  (template legend: GO)
 *  C52 → totalOtHours               440  (template legend: PX — matches the masterColumns.ts fix made earlier)
 *  C53 → basicWage                  284  (template legend: JX)
 *  C54 → da                         229  (template legend says JY/285, which DOES NOT EXIST in the master — using the verified real DA field, 229/HU, instead)
 *  C55 → hra                        230  (template legend: HV)
 *  C56 → otAmount                   207  (template legend: GY)
 *  C57 → grossSalary                273  (template legend: JM)
 *  C58 → totalDeduction             292  (template legend: KF — single combined deduction total; this template does NOT itemize PF/ESIC/PT/LWF/tax/misc separately)
 *  C59 → netPaymentsAmountPaid      208  (template legend: GZ — distinct field from netSalary/274; added to masterColumns.ts)
 *  C60 → dateOfPayment              311  (template legend: KY)
 *  C61 → bankName                   244  (template legend: IJ)
 *  C62 → bankAccountNumber          276  (template legend: JP)
 *  C63 → signatureOrThumbImpressionOfWorkmen  398  (template legend: OH)
 *  C64 → remarks                    503  (template legend: SI)
 *
 * Columns 65+ do not exist in this template (no header, no legend) — the old
 * scheme's employeePf/esicEmployee/insuranceEE/ptAmount/employeeLwf/incomeTax/
 * otherDeduction/govt* fields have no home here; they roll up into the single
 * C58 totalDeduction cell instead. If a future template version itemizes
 * these, extend USED_COLUMNS and this map accordingly.
 *
 * TO CHANGE A COLUMN: edit codeOnWages/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, getEmployeeName, formatDate, round2 } from '../shared/masterReader.js';
import { CODE_ON_WAGES_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'FormII-MusterCumWage';   // ≤31 chars
const DATA_START_ROW = 12;
const DATA_END_ROW   = 19;
const TOTAL_ROW      = 20;
const USED_COLUMNS   = 64; // FIXED — was 85; the real template has 64 columns, confirmed against its own header/legend rows
const DAY_START_COL  = 18; // FIXED — was 20; template col 18 = Day 1, col 48 = Day 31

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
  fillCellAddress(ws, 'K4', getString(companyInfo, M.establishmentName));
  fillCellAddress(ws, 'T4', getString(companyInfo, M.registrationNumber));
  fillCellAddress(ws, 'K5', getString(companyInfo, M.address));
  fillCellAddress(ws, 'K6', getString(companyInfo, M.natureOfIndustry)); // 38 ← CORRECTED
  fillCellAddress(ws, 'K7', monthYearLabel(employees));
}

export async function generateMusterRollCumWageRegister(
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
      const row: Record<number, ExcelJS.CellValue | null> = {
        1:  oneIndex,
        2:  getString(emp, M.employeeCode),                        // 9
        3:  getEmployeeName(emp),                                  // 401 (fallback 101)
        4:  getString(emp, M.establishmentName),                   // 391
        5:  getString(emp, M.baseWorkLocation),                    // 526 (flagged, template legend blank)
        6:  null,                                                  // UNRESOLVED — "Depute working location", no master field identified
        7:  getString(emp, M.principalEmployerNatureOfWorkDone),   // 400 (template legend OJ)
        8:  getString(emp, M.projectName),                         // 44
        9:  getEmployeeName(emp),                                  // 401 (fallback 101, full name duplicate)
        10: getString(emp, M.endClientName),                       // 525 (flagged, template legend blank)
        11: getString(emp, M.ageAndSexGender),                     // 74
        12: getNumber(emp, M.employeeAge),                         // 239
        13: getString(emp, M.designation),                         // 47
        14: getString(emp, M.skillCategory),                       // 64
        15: formatDate(getDate(emp, M.dateOfEntryIntoService)),    // 270
        16: getString(emp, M.workingHoursFromTo),                  // 415
        17: getString(emp, M.restMealIntervals),                   // 416
      };

      // Daily attendance: template cols 18–48 → master cols 144–174
      M.dayColumns.forEach((masterCol, dayIdx) => {
        row[DAY_START_COL + dayIdx] = getString(emp, masterCol) || null;
      });

      row[49] = getNumber(emp, M.totalDaysWorked);                 // 246
      row[50] = getString(emp, M.minWageBasic);                    // 52
      row[51] = getString(emp, M.actualRateOfWages);               // 197
      row[52] = round2(getNumber(emp, M.totalOtHours));            // 440
      row[53] = round2(getNumber(emp, M.basicWage));               // 284
      row[54] = round2(getNumber(emp, M.da));                      // 229 (template legend's JY/285 doesn't exist — using verified real field)
      row[55] = round2(getNumber(emp, M.hra));                     // 230
      row[56] = round2(getNumber(emp, M.otAmount));                // 207

      const gross = round2(getNumber(emp, M.grossSalary));         // 273
      row[57] = gross;

      const totalDedn = round2(getNumber(emp, M.totalDeduction));  // 292
      row[58] = totalDedn;

      const netPaid = round2(getNumber(emp, M.netPaymentsAmountPaid)) ?? round2(
        (gross ?? 0) - (totalDedn ?? 0),
      );
      row[59] = netPaid;                                           // 208

      row[60] = formatDate(getDate(emp, M.dateOfPayment));         // 311
      row[61] = getString(emp, M.bankName);                        // 244
      row[62] = getString(emp, M.bankAccountNumber);               // 276
      row[63] = getString(emp, M.signatureOrThumbImpressionOfWorkmen) || null; // 398
      row[64] = getString(emp, M.remarks);                         // 503

      return row;
    },
    totalWriter: (ws, totalRow, rows) => {
      fillCellAddress(ws, `A${totalRow}`, 'Total');
      fillCellAddress(ws, `BE${totalRow}`, sumColumn(rows, 57)); // gross (col 57 = BE)
      fillCellAddress(ws, `BF${totalRow}`, sumColumn(rows, 58)); // total deductions (col 58 = BF)
    },
  });
}