/**
 * codeOnWages/musterRollCumWageRegister.ts
 *
 * Generates Form II — Muster Roll cum Wage Register [See Rule 27(1)]
 *
 * ⚠ FIXED: this generator's column layout (85 columns, UAN/PF at C5/C6, day
 * columns at C20-C50, wage block at C51-C85) only matches the LARGER 85-column
 * template. The file that was actually wired up in
 * public/templates/Code_on_Wages/Form II Muster Roll cum Wage Register.xlsx
 * was a different, older 64-column template (no UAN/PF/PT/ESI/LWF/tax/govt
 * breakdown) — every column from C5 onward landed on the wrong field. Replace
 * that template file with the 85-column version (the one that was supplied
 * separately as "Form_II_Muster_Roll_cum_Wage_Register_1_.xlsx") before this
 * code will produce correct output. Row layout also differs: the correct
 * template's data rows run 12–29 (18-row capacity) with the total written
 * into the first blank row after the data (row 30), not rows 12–19/20 as
 * previously assumed.
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
 *  C7  → baseWorkLocation           48   ← RE-CORRECTED (was 526, "Address of Employer")
 *  C8  → baseWorkLocation           48   (same — Deputed)
 *  C9  → workingAreaProject         400
 *  C10 → projectName                (no matching master column found)
 *  C11 → employeeName               401  (duplicate — full name)
 *  C12 → endClientName              392  ← RE-CORRECTED (was 525, the contractor's own name)
 *  C13 → ageAndSexGender            74
 *  C14 → employeeAge                239
 *  C15 → designation                47
 *  C16 → skillCategory              64
 *  C17 → dateOfEntryIntoService     66   ← RE-CORRECTED (was 270, "EPF Date of Joining")
 *  C18 → workingHoursFromTo         415
 *  C19 → restMealIntervals          416
 *  C20–C50 → day1–day31             144–174
 *  C51 → totalDaysWorked            246
 *  C52 → lopLoss                    275  ← RE-CORRECTED (was 312, a ₹ figure; template col is "Loss of pay (LOP)" days)
 *  C53 → basicWage                  284  ← RE-CORRECTED (was minWageBasic 52; template col is "Basic rates of wages payable")
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
 *  C64 → additionalComponent        236  ← RE-CORRECTED (was 336, "Society Deduction")
 *  C65 → grossSalary                273
 *  C66 → employeePf                 262
 *  C67 → esicEmployee               243
 *  C68 → insuranceEE                337
 *  C69 → ptAmount                   251
 *  C70 → employeeLwf                248
 *  C71 → incomeTax                  356  ← RE-CORRECTED (was 339, "Subsistance allowance")
 *  C72 → otherDeduction/misc        310  ← RE-CORRECTED (was 335, duplicate of otherAllowances)
 *  C73 → totalDeduction             292
 *  C74 → totalDeduction             292  (Advances/Fines/Damages bucket)
 *  C75-C80 → govt* comparison       561-566 (not present in this master layout; left blank)
 *  C81 → dateOfPayment              311
 *  C82 → bankName                   244
 *  C83 → bankAccountNumber          276
 *  C84 → signature                  398
 *  C85 → remarks                    503
 *
 * NEW: C50 (Minimum rates of wages payable) was never populated — added below.
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
const DATA_END_ROW   = 29;  // RE-CORRECTED (was 19): the 85-col template's
                             // pre-built data rows actually run 12-29 (18 rows)
const TOTAL_ROW       = 30; // RE-CORRECTED (was 20): first blank row after the
                             // data block, before the signature line at row 33
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
  // FIXED: in the correct 85-column template the value placeholders sit at
  // columns M/V (13/22), not K/T (11/20) — those were the 64-column
  // template's positions. "Establishment Name" and "Address" also share one
  // merged value cell (M4:Q5), so both lines go into the single M4 anchor.
  const establishment = getString(companyInfo, M.establishmentName);
  const address = getString(companyInfo, M.address);
  fillCellAddress(ws, 'M4', address ? `${establishment}\n${address}` : establishment);
  fillCellAddress(ws, 'V4', getString(companyInfo, M.registrationNumber));
  const payDate = employees.map((r) => getDate(r, M.dateOfPayment)).find((v): v is Date => v instanceof Date);
  fillCellAddress(ws, 'V5', String((payDate ?? new Date()).getFullYear()));
  fillCellAddress(ws, 'M6', getString(companyInfo, M.natureOfIndustry)); // 38 ← CORRECTED
  fillCellAddress(ws, 'M7', monthYearLabel(employees));
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
      row[52] = getNumber(emp, M.lopLoss);                // 275 ← RE-CORRECTED
      row[50] = getString(emp, M.minWageBasic);           // 52  ← NEW: was never written before
      row[53] = basic;                                    // 284 ← RE-CORRECTED (was minWageBasic)
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
      row[72] = misc;                                     // 310 (misc deductions) — comment corrected, code was already right
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
      fillCellAddress(ws, `BM${totalRow}`, sumColumn(rows, 65)); // gross ← FIXED (was BC, which is column 55 not 65)
      fillCellAddress(ws, `BV${totalRow}`, sumColumn(rows, 74)); // total deductions
    },
  });
}
