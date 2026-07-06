/**
 * codeOnWages/musterRollCumWageRegister.ts
 *
 * Generates Form II — Muster Roll cum Wage Register [See Rule 27(1)]
 *
 * ════════════════════════════════════════════════════════════════════════
 * COLUMN MAP  (template col → master col via CODE_ON_WAGES_COLUMNS)
 *
 *  C1  → Sl No                      (generated)       1
 *  C2  → employeeCode               9
 *  C3  → employeeName               401
 *  C4  → establishmentName          391
 *  C5  → uanNumber                  13
 *  C6  → pfMemberId                 237
 *  C7  → baseWorkLocation           526
 *  C8  → baseWorkLocation           526  (same — Deputed)
 *  C9  → workingAreaProject         400
 *  C10 → projectName                44
 *  C11 → employeeName               401  (duplicate — full name)
 *  C12 → endClientName              525
 *  C13 → ageAndSexGender            74
 *  C14 → employeeAge                239
 *  C15 → designation                47
 *  C16 → skillCategory              64
 *  C17 → dateOfEntryIntoService     270
 *  C18 → workingHoursFromTo         415
 *  C19 → restMealIntervals          416
 *  C20–C50 → day1–day31             144–174
 *  C51 → totalDaysWorked            246
 *  C52 → lopLoss                    312
 *  C53 → minWageBasic               52
 *  C54 → actualRateOfWages          197
 *  C55 → da                         229
 *  C56 → hra                        230
 *  C57 → medicalAllowance           231
 *  C58 → leaveEncashment            232
 *  C59 → nfh                        414
 *  C60 → conveyanceAllowance        233
 *  C61 → statutoryBonus             234
 *  C62 → otAmount                   207
 *  C63 → otherAllowances            335
 *  C64 → additionalComponent        336
 *  C65 → grossSalary                273
 *  C66 → employeePf                 262
 *  C67 → esicEmployee               243
 *  C68 → insuranceEE                337
 *  C69 → ptAmount                   251
 *  C70 → employeeLwf                248
 *  C71 → incomeTax                  339
 *  C72 → otherDeduction/misc        335
 *  C73 → totalDeduction             292
 *  C74 → totalDeduction             292  (Advances/Fines/Damages bucket)
 *  C75 → govtBasicWage              561
 *  C76 → govtDA                     562
 *  C77 → govtHRA                    563
 *  C78 → govtOther                  564
 *  C79 → govtTotal                  565
 *  C80 → diffActualGovt             566
 *  C81 → dateOfPayment              311
 *  C82 → bankName                   244
 *  C83 → bankAccountNumber          276
 *  C84 → signature                  398
 *  C85 → remarks                    503
 *
 * TO CHANGE A COLUMN: edit codeOnWages/mapping.ts
 * ════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { MasterData, getString, getNumber, getDate, formatDate, round2 } from '../shared/masterReader.js';
import { CODE_ON_WAGES_COLUMNS as M } from './mapping.js';
import { generateSingleSheetRegister, sumColumn } from './registerEngine.js';
import { fillCellAddress } from '../shared/templateFiller.js';

const SHEET_TITLE    = 'FormII-MusterCumWage';   // ≤31 chars
const DATA_START_ROW = 12;
const DATA_END_ROW   = 19;
const TOTAL_ROW      = 20;
const USED_COLUMNS   = 85;
const DAY_START_COL  = 20; // template col 20 = Day 1, col 50 = Day 31

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
        2:  getString(emp, M.employeeCode),           // 9
        3:  getString(emp, M.employeeName),           // 401
        4:  getString(emp, M.establishmentName),      // 391
        5:  getString(emp, M.uanNumber),              // 13
        6:  getString(emp, M.pfMemberId),             // 237
        7:  getString(emp, M.baseWorkLocation),       // 526
        8:  getString(emp, M.baseWorkLocation),       // 526 (Deputed — same col)
        9:  getString(emp, M.workingAreaProject),     // 400
        10: getString(emp, M.projectName),            // 44
        11: getString(emp, M.employeeName),           // 401 (full name duplicate)
        12: getString(emp, M.endClientName),          // 525
        13: getString(emp, M.ageAndSexGender),        // 74
        14: getNumber(emp, M.employeeAge),            // 239
        15: getString(emp, M.designation),            // 47
        16: getString(emp, M.skillCategory),          // 64
        17: formatDate(getDate(emp, M.dateOfEntryIntoService)), // 270
        18: getString(emp, M.workingHoursFromTo),     // 415
        19: getString(emp, M.restMealIntervals),      // 416
      };

      // Daily attendance: template cols 20–50 → master cols 144–174
      M.dayColumns.forEach((masterCol, dayIdx) => {
        row[DAY_START_COL + dayIdx] = getString(emp, masterCol) || null;
      });

      // Wage / payroll
      const basic   = round2(getNumber(emp, M.basicWage));
      const da      = round2(getNumber(emp, M.da));
      const hra     = round2(getNumber(emp, M.hra));
      const med     = round2(getNumber(emp, M.medicalAllowance));
      const leave   = round2(getNumber(emp, M.leaveEncashment));
      const conv    = round2(getNumber(emp, M.conveyanceAllowance));
      const bonus   = round2(getNumber(emp, M.statutoryBonus));
      const otAmt   = round2(getNumber(emp, M.otAmount));
      const other   = round2(getNumber(emp, M.otherAllowances));
      const addComp = round2(getNumber(emp, M.additionalComponent));

      const gross = round2(getNumber(emp, M.grossSalary)) ?? round2(
        (basic ?? 0) + (da ?? 0) + (hra ?? 0) + (med ?? 0) + (leave ?? 0) +
        (conv ?? 0) + (bonus ?? 0) + (otAmt ?? 0) + (other ?? 0) + (addComp ?? 0),
      );

      const pf       = round2(getNumber(emp, M.employeePf));
      const esi      = round2(getNumber(emp, M.esicEmployee));
      const ins      = round2(getNumber(emp, M.insuranceEE));
      const pt       = round2(getNumber(emp, M.ptAmount));
      const lwf      = round2(getNumber(emp, M.employeeLwf));
      const tax      = round2(getNumber(emp, M.incomeTax));
      const misc     = round2(getNumber(emp, M.otherDeduction));

      const totalDedn = round2(getNumber(emp, M.totalDeduction)) ?? round2(
        (pf ?? 0) + (esi ?? 0) + (ins ?? 0) + (pt ?? 0) + (lwf ?? 0) + (tax ?? 0) + (misc ?? 0),
      );

      row[51] = getNumber(emp, M.totalDaysWorked);        // 246
      row[52] = getNumber(emp, M.lopLoss);                // 312
      row[53] = getString(emp, M.minWageBasic);           // 52
      row[54] = getString(emp, M.actualRateOfWages);      // 197
      row[55] = da;                                       // 229
      row[56] = hra;                                      // 230
      row[57] = med;                                      // 231
      row[58] = leave;                                    // 232
      row[59] = round2(getNumber(emp, M.nfh));            // 414
      row[60] = conv;                                     // 233
      row[61] = bonus;                                    // 234
      row[62] = otAmt;                                    // 207
      row[63] = other;                                    // 335
      row[64] = addComp;                                  // 336
      row[65] = gross;                                    // 273
      row[66] = pf;                                       // 262
      row[67] = esi;                                      // 243
      row[68] = ins;                                      // 337
      row[69] = pt;                                       // 251
      row[70] = lwf;                                      // 248
      row[71] = tax;                                      // 339
      row[72] = misc;                                     // 335 (misc deductions)
      row[73] = totalDedn;                                // 292 (Advances/Fines/Damages)
      row[74] = totalDedn;                                // 292 Total Deductions
      row[75] = round2(getNumber(emp, M.govtBasicWage));  // 561
      row[76] = round2(getNumber(emp, M.govtDA));         // 562
      row[77] = round2(getNumber(emp, M.govtHRA));        // 563
      row[78] = round2(getNumber(emp, M.govtOther));      // 564
      row[79] = round2(getNumber(emp, M.govtTotal));      // 565
      row[80] = round2(getNumber(emp, M.diffActualGovt)); // 566
      row[81] = formatDate(getDate(emp, M.dateOfPayment)); // 311
      row[82] = getString(emp, M.bankName);               // 244
      row[83] = getString(emp, M.bankAccountNumber);      // 276
      row[84] = getString(emp, M.signatureOrThumbImpressionOfWorkmen) || null; // 398
      row[85] = getString(emp, M.remarks);                // 503

      return row;
    },
    totalWriter: (ws, totalRow, rows) => {
      fillCellAddress(ws, `A${totalRow}`, 'Total');
      fillCellAddress(ws, `BC${totalRow}`, sumColumn(rows, 65)); // gross
      fillCellAddress(ws, `BV${totalRow}`, sumColumn(rows, 74)); // total deductions
    },
  });
}
