/**
 * documentGeneratorService.ts
 *
 * Reads the Regnix Enterprise Master Register (uploaded by user),
 * maps selected acts → real Excel template files (from public/templates/),
 * fills each register/form with employee data, and returns a zip buffer.
 *
 * Template folder structure expected under public/templates/:
 *   CLRA_Act_1970/
 *   Factories_Act_1948/
 *   Code_on_Wages/
 *   BOCW_Act_1996/
 *   Maternity_Benefit_Act_1961/
 *   POSH_2013/
 *   Equal_Remuneration_Act_1976/
 *   ISMW_1979/
 *   Apprentices_Act_1961/
 *   SE_Act/<STATE>/
 */

import fsSync from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type Binary = ArrayBuffer | Uint8Array | Buffer;
type MasterRow = Array<string | number | boolean | null | undefined>;

export interface GenerateOptions {
  masterFile: Binary;
  selectedActs: ActId[];
  /** Company state — used to pick correct SE Act templates (e.g. 'Karnataka') */
  state?: string;
  /** Override templates directory */
  templatesDir?: string;
}

export interface GenerateResult {
  zipBuffer: Uint8Array;
  fileNames: string[];
  rowCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACT IDs — must match what the frontend sends
// ─────────────────────────────────────────────────────────────────────────────
export type ActId =
  | 'clra'
  | 'factories'
  | 'code_wages'
  | 'bocw'
  | 'maternity'
  | 'posh'
  | 'equal_remuneration'
  | 'ismw'
  | 'apprentices'
  | 'se_act';

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE MANIFEST
// Maps ActId → list of { templateRelPath, outputFileName, builderKey }
// ─────────────────────────────────────────────────────────────────────────────
interface TemplateEntry {
  /** Path relative to templatesDir */
  relPath: string[];
  /** Output filename in the zip */
  output: string;
  /** Which builder function to use */
  builder: BuilderKey;
}

type BuilderKey =
  | 'clra_workmen'
  | 'clra_muster'
  | 'clra_wages'
  | 'clra_overtime'
  | 'clra_advances'
  | 'clra_fines'
  | 'clra_deductions'
  | 'factories_adult'
  | 'factories_leave'
  | 'factories_overtime'
  | 'code_wages_fines'
  | 'code_wages_deductions'
  | 'code_wages_overtime'
  | 'code_wages_wages'
  | 'code_wages_muster'
  | 'bocw_workers'
  | 'bocw_wages'
  | 'bocw_muster'
  | 'bocw_overtime'
  | 'bocw_advances'
  | 'bocw_deductions'
  | 'maternity_benefit'
  | 'maternity_leave'
  | 'posh_complaint'
  | 'posh_training'
  | 'equal_gender_wage'
  | 'equal_recruitment'
  | 'ismw_worker'
  | 'ismw_journey'
  | 'ismw_displacement'
  | 'ismw_wages'
  | 'apprentices_register'
  | 'apprentices_attendance'
  | 'apprentices_stipend'
  | 'se_employment'
  | 'se_wages'
  | 'se_leave'
  | 'se_overtime'
  | 'se_deductions'
  | 'se_advances'
  | 'se_fines';

const ACT_TEMPLATES: Record<ActId, TemplateEntry[]> = {
  clra: [
    { relPath: ['CLRA_Act_1970', 'CLRA Form I Workmen Register.xlsx'],          output: 'CLRA_Form_I_Workmen_Register.xlsx',           builder: 'clra_workmen' },
    { relPath: ['CLRA_Act_1970', 'CLRA Form XIV-XVI Muster Roll.xlsx'],         output: 'CLRA_Form_XIV_Muster_Roll.xlsx',             builder: 'clra_muster' },
    { relPath: ['CLRA_Act_1970', 'CLRA Form XVII Wages Register.xlsx'],         output: 'CLRA_Form_XVII_Wages_Register.xlsx',         builder: 'clra_wages' },
    { relPath: ['CLRA_Act_1970', 'Form_XXIII_Register_of_Overtime.xlsx'],       output: 'CLRA_Form_XXIII_Overtime_Register.xlsx',     builder: 'clra_overtime' },
    { relPath: ['CLRA_Act_1970', 'Form_XXII_Register_of_Advances.xlsx'],        output: 'CLRA_Form_XXII_Advances_Register.xlsx',      builder: 'clra_advances' },
    { relPath: ['CLRA_Act_1970', 'Form_XXI_Register_of_Fines.xlsx'],            output: 'CLRA_Form_XXI_Fines_Register.xlsx',          builder: 'clra_fines' },
    { relPath: ['CLRA_Act_1970', 'Form_XX_Register_of_Deductions_for_Dam.xlsx'],output: 'CLRA_Form_XX_Deductions_Register.xlsx',      builder: 'clra_deductions' },
  ],
  factories: [
    { relPath: ['Factories_Act_1948', '01_Adult_Worker_Register.xlsx'],         output: 'Factories_Adult_Worker_Register.xlsx',       builder: 'factories_adult' },
    { relPath: ['Factories_Act_1948', '02_Leave_With_Wages_Register.xlsx'],     output: 'Factories_Leave_With_Wages.xlsx',            builder: 'factories_leave' },
    { relPath: ['Factories_Act_1948', '03_Overtime_Register.xlsx'],             output: 'Factories_Overtime_Register.xlsx',           builder: 'factories_overtime' },
  ],
  code_wages: [
    { relPath: ['Code_on_Wages', 'Form I - Register of Fines.xlsx'],            output: 'CW_Form_I_Register_of_Fines.xlsx',           builder: 'code_wages_fines' },
    { relPath: ['Code_on_Wages', 'Form II - Deductions.xlsx'],                  output: 'CW_Form_II_Deductions.xlsx',                 builder: 'code_wages_deductions' },
    { relPath: ['Code_on_Wages', 'Form III - Overtime Register.xlsx'],          output: 'CW_Form_III_Overtime_Register.xlsx',         builder: 'code_wages_overtime' },
    { relPath: ['Code_on_Wages', 'Form IV - Wage Register.xlsx'],               output: 'CW_Form_IV_Wage_Register.xlsx',             builder: 'code_wages_wages' },
    { relPath: ['Code_on_Wages', 'Form VI - Muster Roll.xlsx'],                 output: 'CW_Form_VI_Muster_Roll.xlsx',               builder: 'code_wages_muster' },
  ],
  bocw: [
    { relPath: ['BOCW_Act_1996', 'Form_XV_Register_Workers_Employed.xlsx'],     output: 'BOCW_Form_XV_Workers_Register.xlsx',         builder: 'bocw_workers' },
    { relPath: ['BOCW_Act_1996', 'Form_XVII_Register_of_Wages.xlsx'],           output: 'BOCW_Form_XVII_Wages_Register.xlsx',         builder: 'bocw_wages' },
    { relPath: ['BOCW_Act_1996', 'Form_XVI_Muster_Roll.xlsx'],                  output: 'BOCW_Form_XVI_Muster_Roll.xlsx',             builder: 'bocw_muster' },
    { relPath: ['BOCW_Act_1996', 'Form_XXII_Register_of_Overtime.xlsx'],        output: 'BOCW_Form_XXII_Overtime_Register.xlsx',      builder: 'bocw_overtime' },
    { relPath: ['BOCW_Act_1996', 'Form_XXI_Register_of_Advances.xlsx'],         output: 'BOCW_Form_XXI_Advances_Register.xlsx',       builder: 'bocw_advances' },
    { relPath: ['BOCW_Act_1996', 'Form_XIX_Register_Deductions.xlsx'],          output: 'BOCW_Form_XIX_Deductions_Register.xlsx',     builder: 'bocw_deductions' },
  ],
  maternity: [
    { relPath: ['Maternity_Benefit_Act_1961', 'Maternity_Benefit_Register.xlsx'], output: 'Maternity_Benefit_Register.xlsx',          builder: 'maternity_benefit' },
    { relPath: ['Maternity_Benefit_Act_1961', 'Leave_Register.xlsx'],             output: 'Maternity_Leave_Register.xlsx',            builder: 'maternity_leave' },
  ],
  posh: [
    { relPath: ['POSH_2013', 'POSH 2013 R5-POSH Complaint Register.xlsx'],     output: 'POSH_Complaint_Register.xlsx',               builder: 'posh_complaint' },
    { relPath: ['POSH_2013', 'POSH 2013 R7-POSH Training Register.xlsx'],      output: 'POSH_Training_Register.xlsx',                builder: 'posh_training' },
  ],
  equal_remuneration: [
    { relPath: ['Equal_Remuneration_Act_1976', 'Gender_Wage_Register.xlsx'],   output: 'Equal_Remuneration_Gender_Wage_Register.xlsx', builder: 'equal_gender_wage' },
    { relPath: ['Equal_Remuneration_Act_1976', 'Recruitment_Register.xlsx'],   output: 'Equal_Remuneration_Recruitment_Register.xlsx', builder: 'equal_recruitment' },
  ],
  ismw: [
    { relPath: ['ISMW_1979', 'ISMW 1979 R1-Migrant Worker Register.xlsx'],     output: 'ISMW_Migrant_Worker_Register.xlsx',           builder: 'ismw_worker' },
    { relPath: ['ISMW_1979', 'ISMW 1979 R2-Journey Allowance Register.xlsx'],  output: 'ISMW_Journey_Allowance_Register.xlsx',        builder: 'ismw_journey' },
    { relPath: ['ISMW_1979', 'ISMW 1979 R3-Displacement Allowance.xlsx'],      output: 'ISMW_Displacement_Allowance_Register.xlsx',   builder: 'ismw_displacement' },
    { relPath: ['ISMW_1979', 'ISMW 1979 R4-Wage Register.xlsx'],               output: 'ISMW_Wage_Register.xlsx',                    builder: 'ismw_wages' },
  ],
  apprentices: [
    { relPath: ['Apprentices_Act_1961', 'Apprentice_Register.xlsx'],           output: 'Apprentices_Register.xlsx',                  builder: 'apprentices_register' },
    { relPath: ['Apprentices_Act_1961', 'Attendance_Register.xlsx'],           output: 'Apprentices_Attendance_Register.xlsx',       builder: 'apprentices_attendance' },
    { relPath: ['Apprentices_Act_1961', 'Stipend_Register.xlsx'],              output: 'Apprentices_Stipend_Register.xlsx',          builder: 'apprentices_stipend' },
  ],
  se_act: [
    // STATE is injected at runtime — see resolveSeActPath()
    { relPath: ['SE_Act', '__STATE__', 'Register of Employment.xlsx'],         output: 'SE_Register_of_Employment.xlsx',             builder: 'se_employment' },
    { relPath: ['SE_Act', '__STATE__', 'Register of Wages.xlsx'],              output: 'SE_Register_of_Wages.xlsx',                  builder: 'se_wages' },
    { relPath: ['SE_Act', '__STATE__', 'Register of Leave.xlsx'],              output: 'SE_Register_of_Leave.xlsx',                  builder: 'se_leave' },
    { relPath: ['SE_Act', '__STATE__', 'Overtime Register.xlsx'],              output: 'SE_Overtime_Register.xlsx',                  builder: 'se_overtime' },
    { relPath: ['SE_Act', '__STATE__', 'Register of Deductions.xlsx'],         output: 'SE_Register_of_Deductions.xlsx',             builder: 'se_deductions' },
    { relPath: ['SE_Act', '__STATE__', 'Register of Advances.xlsx'],           output: 'SE_Register_of_Advances.xlsx',               builder: 'se_advances' },
    { relPath: ['SE_Act', '__STATE__', 'Register of Fines.xlsx'],              output: 'SE_Register_of_Fines.xlsx',                  builder: 'se_fines' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function toBuffer(data: Binary): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

function resolveTemplatesDir(override?: string): string {
  const candidates = override
    ? [override]
    : [
        path.join(process.cwd(), 'public', 'templates'),
        path.join(process.cwd(), 'templates'),
      ];
  for (const p of candidates) if (fsSync.existsSync(p)) return p;
  return candidates[0];
}

/** Replace __STATE__ placeholder and try fallback to Karnataka if missing */
function resolveSeActPath(baseDir: string, relPath: string[], state: string): string {
  const filled = relPath.map(s => s === '__STATE__' ? state : s);
  const full = path.join(baseDir, ...filled);
  if (fsSync.existsSync(full)) return full;
  // fallback: Karnataka
  const fallback = relPath.map(s => s === '__STATE__' ? 'Karnataka' : s);
  return path.join(baseDir, ...fallback);
}

function resolveTemplatePath(baseDir: string, relPath: string[], state: string): string {
  if (relPath.includes('__STATE__')) return resolveSeActPath(baseDir, relPath, state);
  // Try exact path, then fuzzy match last segment
  const exact = path.join(baseDir, ...relPath);
  if (fsSync.existsSync(exact)) return exact;
  // Fuzzy: walk baseDir searching for file with matching name
  const fileName = relPath[relPath.length - 1];
  const subDir = path.join(baseDir, relPath[0]);
  if (fsSync.existsSync(subDir)) {
    const found = findFile(subDir, fileName);
    if (found) return found;
  }
  return exact; // let ExcelJS throw a readable error
}

function findFile(dir: string, name: string): string | null {
  if (!fsSync.existsSync(dir)) return null;
  for (const entry of fsSync.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = findFile(full, name);
      if (sub) return sub;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

async function loadTemplate(filePath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb;
}

function getSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
  return wb.worksheets[0]!;
}

function setv(ws: ExcelJS.Worksheet, ref: string, value: unknown): void {
  ws.getCell(ref).value = value as never;
}

function v(row: MasterRow, idx: number): string {
  const x = row[idx - 1];
  return x == null ? '' : String(x).trim();
}

function pick(row: MasterRow, ...idxs: number[]): string {
  for (const idx of idxs) { const t = v(row, idx); if (t) return t; }
  return '';
}

function num(row: MasterRow, ...idxs: number[]): number {
  for (const idx of idxs) {
    const raw = row[idx - 1];
    if (raw == null || raw === '') continue;
    const n = Number(String(raw).replace(/[^\d.-]/g, ''));
    if (!isNaN(n)) return n;
  }
  return 0;
}

function splitName(raw: string) {
  const clean = (raw || '').trim();
  const parts = clean.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
  return { name: parts[0] || clean, father: parts[1] || '' };
}

function parseDate(text: string): Date | null {
  const val = (text || '').trim();
  if (!val) return null;
  const m = val.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]); if (y < 100) y += 2000;
    const dt = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(dt.getTime())) return dt;
  }
  const p = new Date(val);
  return isNaN(p.getTime()) ? null : p;
}

function monthYear(text: string) {
  const dt = parseDate(text);
  if (!dt) return { label: text, dt: null };
  return { label: dt.toLocaleString('en-US', { month: 'long', year: 'numeric' }), dt };
}


function copyRowStyle(ws: ExcelJS.Worksheet, src: number, dst: number): void {
  const s = ws.getRow(src);
  const d = ws.getRow(dst);
  d.height = s.height;
  for (let c = 1; c <= ws.columnCount; c++) {
    d.getCell(c).style = JSON.parse(JSON.stringify(s.getCell(c).style || {}));
  }
}

/** Write company header fields used by most registers */
function writeHeader(
  ws: ExcelJS.Worksheet,
  first: MasterRow,
  refs: { contractor: string; licenseNo: string; principalEst: string; location: string },
): void {
  const contractor  = pick(first, 28, 29, 32);
  const licenseNo   = pick(first, 3);
  const principal   = pick(first, 30);
  const estab       = pick(first, 31).split('\n')[0];
  const principalEst = [principal, estab].filter(Boolean).join('\n');
  const location    = pick(first, 34, 33, 48);

  ws.getCell(refs.contractor).value   = contractor;
  ws.getCell(refs.licenseNo).value    = licenseNo;
  ws.getCell(refs.principalEst).value = principalEst;
  ws.getCell(refs.location).value     = location;
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER READER
// ─────────────────────────────────────────────────────────────────────────────
async function readMasterRows(masterFile: Binary): Promise<MasterRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(toBuffer(masterFile) as any);
  // Use first sheet (Master Register - Structured)
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('Master workbook has no sheets.');
  const rows: MasterRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const vals = (row.values as MasterRow).slice(1);
    if (vals.some(c => String(c ?? '').trim() !== '')) rows.push(vals);
  });
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDERS — one per BuilderKey
// Each builder fills the workbook in-place and returns it.
// Column index mapping is based on Regnix_Enterprise_Master_Register_v2.xlsx
// where column positions are 1-based per the COLUMN_MAP sheet:
//   9=EmpCode, 13=UAN, 16=ESIC IP, 28=ContractorName, 30=PrincipalEmployer,
//   43=DateOfJoining, 47=Designation, 46=Department, 48=WorkLocation,
//   90=WorkerName(CLRA), 92=WorkingDays, 94=BasicSalary, 95=HRA,
//   96=Allowances, 101=NatureOfWork, 103=DatePeriodFrom, 104=DatePeriodTo,
//   105=ReasonForFine, 106=AmountOfFine, 107=AmountOfDeduction,
//   108=NoOfInstalments, 109=AmountRecovered, 110=Balance,
//   117=AdvanceDate, 118=PurposeOfAdvance, 119=AmountOfAdvance,
//   120=Instalment, 121=DateOfInstalment, 122=Remarks,
//   123=OTFromDate, 124=NormalHrs, 125=OTHrs, 126=OTRate, 127=OTAmount,
//   128=Month, 131=DA, 132=OtherAllowances, 133=PF, 135=PT,
//   137=SpecialAllowance, 138=LWF, 139=MedicalAllowance, 140=Conveyance,
//   141=EPFEmployee, 143=EPFEmployer, 144=EPSEmployer, 145=EDLI,
//   146=EPFAccountNo, 149=ESICEmployer, 150=ESICEmployee, 151=TDS,
//   152=BankAccountNo, 153=SalaryMonth, 156=DaysWorked,
//   157=AadhaarNo, 158=PANNo, 163=ProfessionalTax, 166=PaymentDate,
//   185=AmountPaid, 210=ESICRegNo, 215=Bank, 216=Dept, 217=EmpCodeAlt,
//   218=Grade, 230=LeaveBalance, 241=Phone, 244=FatherName,
//   258=OTDays, 265=BankBranch, 266=IFSC, 267=BankName,
//   279=LWFRegNo, 294=EmpCodePayslip, 298=AuthorizedBy, 300=FullName,
//   304=Aadhaar, 305=PAN, 306=ESICNo, 308=PTRegNo, 311=Grade2,
//   313=OldRegime, 332=OtherDeductions, 366=AmountBalance,
//   377=OTCategory, 379=PlaceOfWork
// ─────────────────────────────────────────────────────────────────────────────

// ── CLRA ──────────────────────────────────────────────────────────────────────

function buildClraWorkmen(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'H4', principalEst: 'B5', location: 'H5' });

  rows.slice(0, 50).forEach((row, i) => {
    const r = 8 + i;
    if (r > 8) copyRowStyle(ws, 8, r);
    const { name } = splitName(pick(row, 300, 90, 32));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9, 217));
    setv(ws, `D${r}`, pick(row, 43));
    setv(ws, `E${r}`, pick(row, 42, 47));
    setv(ws, `F${r}`, pick(row, 46));
    setv(ws, `G${r}`, pick(row, 48, 34));
    setv(ws, `H${r}`, pick(row, 16, 21));
    setv(ws, `I${r}`, pick(row, 13));
    setv(ws, `J${r}`, pick(row, 101, 33));
    setv(ws, `K${r}`, pick(row, 35));
    setv(ws, `L${r}`, pick(row, 36));
  });
  return wb;
}

function buildClraMuster(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'H4', principalEst: 'B5', location: 'H5' });
  const { label: monthLabel } = monthYear(pick(first, 153, 128));
  setv(ws, 'B6', monthLabel);

  rows.slice(0, 50).forEach((row, i) => {
    const r = 8 + i;
    if (r > 8) copyRowStyle(ws, 8, r);
    const { name } = splitName(pick(row, 300, 90, 32));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9, 217));
    setv(ws, `D${r}`, pick(row, 42, 47));
    // Days 1-31 are dynamic — leave blank; user fills attendance
    setv(ws, `AJ${r}`, num(row, 92, 156)); // Total present
    setv(ws, `AK${r}`, pick(row, 101, 33)); // Nature of work
  });
  return wb;
}

function buildClraWages(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'I4', principalEst: 'B5', location: 'I5' });
  const { label: monthLabel } = monthYear(pick(first, 153, 128));
  setv(ws, 'B6', monthLabel);

  rows.slice(0, 50).forEach((row, i) => {
    const r = 8 + i;
    if (r > 8) copyRowStyle(ws, 8, r);
    const { name } = splitName(pick(row, 300, 90, 32));
    const gross = num(row, 94) + num(row, 95) + num(row, 96) + num(row, 131) + num(row, 132) + num(row, 137) + num(row, 139) + num(row, 140);
    const deduct = num(row, 141) + num(row, 149) + num(row, 150) + num(row, 151) + num(row, 163);
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9, 217));
    setv(ws, `D${r}`, pick(row, 42, 47));
    setv(ws, `E${r}`, num(row, 92, 156));          // Days worked
    setv(ws, `F${r}`, num(row, 94));               // Basic
    setv(ws, `G${r}`, num(row, 95));               // HRA
    setv(ws, `H${r}`, num(row, 131));              // DA
    setv(ws, `I${r}`, num(row, 137) + num(row, 132)); // Other allowances
    setv(ws, `J${r}`, gross);                      // Gross
    setv(ws, `K${r}`, num(row, 141));              // EPF employee
    setv(ws, `L${r}`, num(row, 150));              // ESIC employee
    setv(ws, `M${r}`, num(row, 163));              // PT
    setv(ws, `N${r}`, num(row, 151));              // TDS
    setv(ws, `O${r}`, deduct);                     // Total deductions
    setv(ws, `P${r}`, gross - deduct);             // Net wages
    setv(ws, `Q${r}`, pick(row, 152));             // Bank A/c
    setv(ws, `R${r}`, pick(row, 166, 153));        // Payment date
  });
  return wb;
}

function buildClraOvertime(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'I4', principalEst: 'B5', location: 'I5' });
  const monthInfo = monthYear(pick(first, 153, 123, 128));
  setv(ws, 'B6', monthInfo.label);
  setv(ws, 'E6', monthInfo.dt?.getFullYear() ?? '');

  rows.slice(0, 30).forEach((row, i) => {
    const r = 8 + i;
    if (r > 8) copyRowStyle(ws, 8, r);
    const { name } = splitName(pick(row, 300, 90, 32));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9, 217));
    setv(ws, `D${r}`, pick(row, 123));
    setv(ws, `E${r}`, num(row, 124));
    setv(ws, `F${r}`, num(row, 125));
    setv(ws, `G${r}`, num(row, 126));
    setv(ws, `H${r}`, num(row, 127));
    setv(ws, `I${r}`, pick(row, 101, 33));
    setv(ws, `J${r}`, pick(row, 101, 38));
    setv(ws, `K${r}`, pick(row, 122, 299));
  });
  return wb;
}

function buildClraAdvances(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'I4', principalEst: 'B5', location: 'I5' });

  rows.slice(0, 25).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90, 32));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9, 217));
    setv(ws, `D${r}`, pick(row, 117));  // Date of advance
    setv(ws, `E${r}`, pick(row, 118));  // Purpose
    setv(ws, `F${r}`, num(row, 119));   // Amount
    setv(ws, `G${r}`, pick(row, 120));  // Instalment
    setv(ws, `H${r}`, num(row, 120));   // Amount per instalment
    setv(ws, `I${r}`, pick(row, 121));  // Date of instalment
    setv(ws, `J${r}`, num(row, 185, 366)); // Amount paid
    setv(ws, `K${r}`, pick(row, 101, 38));
    setv(ws, `L${r}`, pick(row, 122, 299));
  });
  return wb;
}

function buildClraFines(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'H4', principalEst: 'B5', location: 'H5' });

  rows.slice(0, 25).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90, 32));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9, 217));
    setv(ws, `D${r}`, pick(row, 103, 104));  // Period
    setv(ws, `E${r}`, pick(row, 103));
    setv(ws, `F${r}`, pick(row, 105, 106));  // Act / omission
    setv(ws, `G${r}`, pick(row, 106, 113));  // Date of show cause
    setv(ws, `H${r}`, num(row, 107, 113));   // Amount of fine
    setv(ws, `I${r}`, num(row, 109));        // Amount recovered
    setv(ws, `J${r}`, pick(row, 101, 38));
    setv(ws, `K${r}`, pick(row, 122, 299));
  });
  return wb;
}

function buildClraDeductions(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'H4', principalEst: 'B5', location: 'H5' });

  rows.slice(0, 25).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90, 32));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9, 217));
    setv(ws, `D${r}`, pick(row, 103));
    setv(ws, `E${r}`, pick(row, 104));
    setv(ws, `F${r}`, num(row, 107));
    setv(ws, `G${r}`, num(row, 108));
    setv(ws, `H${r}`, num(row, 109));
    setv(ws, `I${r}`, num(row, 110));
    setv(ws, `J${r}`, pick(row, 101, 38));
    setv(ws, `K${r}`, pick(row, 111, 299));
  });
  return wb;
}

// ── Factories Act ─────────────────────────────────────────────────────────────

function buildFactoriesAdult(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'H4', principalEst: 'B5', location: 'H5' });

  rows.slice(0, 50).forEach((row, i) => {
    const r = 8 + i;
    if (r > 8) copyRowStyle(ws, 8, r);
    const { name, father } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, father || pick(row, 244));
    setv(ws, `D${r}`, pick(row, 9));             // Token/badge no.
    setv(ws, `E${r}`, pick(row, 42, 47));        // Nature of employment
    setv(ws, `F${r}`, pick(row, 43));            // Date of joining
    setv(ws, `G${r}`, pick(row, 48));            // Work location
    setv(ws, `H${r}`, pick(row, 49));            // Shift
    setv(ws, `I${r}`, pick(row, 101, 33));       // Nature of work
  });
  return wb;
}

function buildFactoriesLeave(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'H4', principalEst: 'B5', location: 'H5' });

  rows.slice(0, 50).forEach((row, i) => {
    const r = 8 + i;
    if (r > 8) copyRowStyle(ws, 8, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, num(row, 92, 156));  // Days worked previous year
    setv(ws, `E${r}`, '');                  // Leave due (user fills)
    setv(ws, `F${r}`, '');                  // Leave availed
    setv(ws, `G${r}`, num(row, 230));       // Leave balance
    setv(ws, `H${r}`, pick(row, 122, 299));
  });
  return wb;
}

function buildFactoriesOvertime(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraOvertime(wb, rows); // same structure
}

// ── Code on Wages ─────────────────────────────────────────────────────────────

function buildCodeWagesFines(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraFines(wb, rows);
}

function buildCodeWagesDeductions(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraDeductions(wb, rows);
}

function buildCodeWagesOvertime(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraOvertime(wb, rows);
}

function buildCodeWagesWages(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraWages(wb, rows);
}

function buildCodeWagesMuster(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraMuster(wb, rows);
}

// ── BOCW ──────────────────────────────────────────────────────────────────────

function buildBocwWorkers(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B4', licenseNo: 'H4', principalEst: 'B5', location: 'H5' });

  rows.slice(0, 50).forEach((row, i) => {
    const r = 8 + i;
    if (r > 8) copyRowStyle(ws, 8, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, pick(row, 43));
    setv(ws, `E${r}`, pick(row, 42, 47));
    setv(ws, `F${r}`, pick(row, 46));
    setv(ws, `G${r}`, pick(row, 101, 33));
    setv(ws, `H${r}`, pick(row, 35));
    setv(ws, `I${r}`, pick(row, 36));
  });
  return wb;
}

function buildBocwWages(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraWages(wb, rows);
}

function buildBocwMuster(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraMuster(wb, rows);
}

function buildBocwOvertime(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraOvertime(wb, rows);
}

function buildBocwAdvances(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraAdvances(wb, rows);
}

function buildBocwDeductions(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraDeductions(wb, rows);
}

// ── Maternity Benefit ─────────────────────────────────────────────────────────

function buildMaternityBenefit(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B3', licenseNo: 'F3', principalEst: 'B4', location: 'F4' });

  rows.slice(0, 30).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, pick(row, 43));    // Date of joining
    setv(ws, `E${r}`, '');               // Maternity leave from (user fills)
    setv(ws, `F${r}`, '');               // Maternity leave to
    setv(ws, `G${r}`, num(row, 185));    // Wages paid
    setv(ws, `H${r}`, pick(row, 122));
  });
  return wb;
}

function buildMaternityLeave(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildFactoriesLeave(wb, rows);
}

// ── POSH ──────────────────────────────────────────────────────────────────────

function buildPoshComplaint(wb: ExcelJS.Workbook, _rows: MasterRow[]): ExcelJS.Workbook {
  // POSH registers are mostly blank forms — just write company header
  const ws = getSheet(wb);
  const first = _rows[0] ?? [];
  const company = pick(first, 30, 29, 28);
  setv(ws, 'B3', company);
  return wb;
}

function buildPoshTraining(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  setv(ws, 'B3', pick(first, 30, 29, 28));
  rows.slice(0, 30).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, pick(row, 47, 42));
    setv(ws, `E${r}`, pick(row, 46));
  });
  return wb;
}

// ── Equal Remuneration ────────────────────────────────────────────────────────

function buildEqualGenderWage(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B3', licenseNo: 'F3', principalEst: 'B4', location: 'F4' });

  rows.slice(0, 50).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90));
    const gross = num(row, 94) + num(row, 95) + num(row, 131) + num(row, 137);
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, pick(row, 47, 42));  // Designation
    setv(ws, `E${r}`, '');                  // Gender (user fills)
    setv(ws, `F${r}`, gross);              // Wages paid
    setv(ws, `G${r}`, pick(row, 122));
  });
  return wb;
}

function buildEqualRecruitment(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B3', licenseNo: 'F3', principalEst: 'B4', location: 'F4' });

  rows.slice(0, 50).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, pick(row, 43));
    setv(ws, `E${r}`, pick(row, 47, 42));
    setv(ws, `F${r}`, '');  // Gender
    setv(ws, `G${r}`, pick(row, 50));  // Joining source
  });
  return wb;
}

// ── ISMW ──────────────────────────────────────────────────────────────────────

function buildIsmwWorker(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B3', licenseNo: 'F3', principalEst: 'B4', location: 'F4' });

  rows.slice(0, 50).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, pick(row, 43));
    setv(ws, `E${r}`, pick(row, 48));  // Work location
    setv(ws, `F${r}`, pick(row, 244)); // Father / guardian name
    setv(ws, `G${r}`, '');             // Home state (user fills)
    setv(ws, `H${r}`, pick(row, 101, 33));
  });
  return wb;
}

function buildIsmwJourney(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B3', licenseNo: 'F3', principalEst: 'B4', location: 'F4' });

  rows.slice(0, 30).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, '');   // Journey from
    setv(ws, `E${r}`, '');   // Journey to
    setv(ws, `F${r}`, '');   // Amount
  });
  return wb;
}

function buildIsmwDisplacement(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildIsmwJourney(wb, rows);
}

function buildIsmwWages(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraWages(wb, rows);
}

// ── Apprentices ───────────────────────────────────────────────────────────────

function buildApprenticesRegister(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B3', licenseNo: 'F3', principalEst: 'B4', location: 'F4' });

  rows.slice(0, 30).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, pick(row, 19, 23));   // NAPS/NATS Reg No
    setv(ws, `E${r}`, pick(row, 43));       // Date of commencement
    setv(ws, `F${r}`, pick(row, 42, 47));   // Trade / Designation
    setv(ws, `G${r}`, pick(row, 46));       // Department
    setv(ws, `H${r}`, '');                   // Training period
  });
  return wb;
}

function buildApprenticesAttendance(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraMuster(wb, rows);
}

function buildApprenticesStipend(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B3', licenseNo: 'F3', principalEst: 'B4', location: 'F4' });

  rows.slice(0, 30).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, num(row, 94));     // Stipend amount
    setv(ws, `E${r}`, pick(row, 153, 128)); // Month
    setv(ws, `F${r}`, pick(row, 152));   // Bank A/c
    setv(ws, `G${r}`, pick(row, 166));   // Payment date
  });
  return wb;
}

// ── SE Act (state-wise, same structure across states) ─────────────────────────

function buildSeEmployment(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  const ws = getSheet(wb);
  const first = rows[0] ?? [];
  writeHeader(ws, first, { contractor: 'B3', licenseNo: 'F3', principalEst: 'B4', location: 'F4' });

  rows.slice(0, 50).forEach((row, i) => {
    const r = 7 + i;
    if (r > 7) copyRowStyle(ws, 7, r);
    const { name } = splitName(pick(row, 300, 90));
    setv(ws, `A${r}`, i + 1);
    setv(ws, `B${r}`, name);
    setv(ws, `C${r}`, pick(row, 9));
    setv(ws, `D${r}`, pick(row, 244));   // Father/husband
    setv(ws, `E${r}`, pick(row, 43));    // Date of joining
    setv(ws, `F${r}`, pick(row, 47, 42));
    setv(ws, `G${r}`, pick(row, 46));
    setv(ws, `H${r}`, pick(row, 48));
    setv(ws, `I${r}`, pick(row, 49));    // Shift
  });
  return wb;
}

function buildSeWages(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraWages(wb, rows);
}

function buildSeLeave(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildFactoriesLeave(wb, rows);
}

function buildSeOvertime(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraOvertime(wb, rows);
}

function buildSeDeductions(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraDeductions(wb, rows);
}

function buildSeAdvances(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraAdvances(wb, rows);
}

function buildSeFines(wb: ExcelJS.Workbook, rows: MasterRow[]): ExcelJS.Workbook {
  return buildClraFines(wb, rows);
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER DISPATCH TABLE
// ─────────────────────────────────────────────────────────────────────────────
type BuilderFn = (wb: ExcelJS.Workbook, rows: MasterRow[]) => ExcelJS.Workbook;

const BUILDERS: Record<BuilderKey, BuilderFn> = {
  clra_workmen:        buildClraWorkmen,
  clra_muster:         buildClraMuster,
  clra_wages:          buildClraWages,
  clra_overtime:       buildClraOvertime,
  clra_advances:       buildClraAdvances,
  clra_fines:          buildClraFines,
  clra_deductions:     buildClraDeductions,
  factories_adult:     buildFactoriesAdult,
  factories_leave:     buildFactoriesLeave,
  factories_overtime:  buildFactoriesOvertime,
  code_wages_fines:    buildCodeWagesFines,
  code_wages_deductions: buildCodeWagesDeductions,
  code_wages_overtime: buildCodeWagesOvertime,
  code_wages_wages:    buildCodeWagesWages,
  code_wages_muster:   buildCodeWagesMuster,
  bocw_workers:        buildBocwWorkers,
  bocw_wages:          buildBocwWages,
  bocw_muster:         buildBocwMuster,
  bocw_overtime:       buildBocwOvertime,
  bocw_advances:       buildBocwAdvances,
  bocw_deductions:     buildBocwDeductions,
  maternity_benefit:   buildMaternityBenefit,
  maternity_leave:     buildMaternityLeave,
  posh_complaint:      buildPoshComplaint,
  posh_training:       buildPoshTraining,
  equal_gender_wage:   buildEqualGenderWage,
  equal_recruitment:   buildEqualRecruitment,
  ismw_worker:         buildIsmwWorker,
  ismw_journey:        buildIsmwJourney,
  ismw_displacement:   buildIsmwDisplacement,
  ismw_wages:          buildIsmwWages,
  apprentices_register:    buildApprenticesRegister,
  apprentices_attendance:  buildApprenticesAttendance,
  apprentices_stipend:     buildApprenticesStipend,
  se_employment:       buildSeEmployment,
  se_wages:            buildSeWages,
  se_leave:            buildSeLeave,
  se_overtime:         buildSeOvertime,
  se_deductions:       buildSeDeductions,
  se_advances:         buildSeAdvances,
  se_fines:            buildSeFines,
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function generateComplianceDocs(options: GenerateOptions): Promise<GenerateResult> {
  const templatesDir = resolveTemplatesDir(options.templatesDir);
  const state = options.state ?? 'Karnataka';
  const rows = await readMasterRows(options.masterFile);

  const zip = new JSZip();
  const fileNames: string[] = [];

  for (const actId of options.selectedActs) {
    const templates = ACT_TEMPLATES[actId];
    if (!templates) continue;

    // Create a sub-folder in the zip per act
    const actFolder = actId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    for (const tpl of templates) {
      try {
        const filePath = resolveTemplatePath(templatesDir, tpl.relPath, state);
        const wb = await loadTemplate(filePath);
        const builder = BUILDERS[tpl.builder];
        if (!builder) throw new Error(`No builder found for key: ${tpl.builder}`);
        builder(wb, rows);

        const buffer = await wb.xlsx.writeBuffer();
        const zipPath = `${actFolder}/${tpl.output}`;
        zip.file(zipPath, Buffer.from(buffer as ArrayBuffer));
        fileNames.push(zipPath);
      } catch (err) {
        // Don't fail the whole batch — log and skip
        console.error(`[DocumentGenerator] Skipped ${tpl.output}:`, (err as Error).message);
        const errEntry = `${actId}/${tpl.output}.ERROR.txt`;
        zip.file(errEntry, `Could not generate: ${(err as Error).message}`);
        fileNames.push(errEntry);
      }
    }
  }

  zip.file(
    'manifest.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), rowCount: rows.length, fileNames }, null, 2),
  );

  const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { zipBuffer, fileNames, rowCount: rows.length };
}
