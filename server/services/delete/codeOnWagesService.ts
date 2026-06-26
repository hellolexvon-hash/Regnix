/**
 * codeOnWagesService.ts
 *
 * Dedicated generator for the Code on Wages act.
 * It reads the uploaded master workbook, extracts employee data,
 * and fills the Form IV — Wage Register template.
 *
 * Output:
 *   One .xlsx workbook containing one sheet per page (8 employees per sheet).
 */

import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

type CellValue = string | number | Date | boolean | null;

export interface EmployeeSourceRow {
  [key: string]: CellValue;
}

export interface WageRegisterRow {
  slNo: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  daysWorked: number | null;
  daysAbsent: number | null;
  basicWage: number | null;
  da: number | null;
  hra: number | null;
  conveyanceAllowance: number | null;
  specialAllowance: number | null;
  otAmount: number | null;
  grossWage: number | null;
  pfDedn: number | null;
  esiDedn: number | null;
  ptDedn: number | null;
  advanceDedn: number | null;
  otherDedn: number | null;
  totalDedn: number | null;
  netPayable: number | null;
  paymentDate: string;
  receiptRef: string;
  employeeSignature: string;
  remarks: string;
}

interface CompanyProfile {
  establishmentName: string;
  establishmentRegNo: string;
  address: string;
  natureOfIndustry: string;
  wagePeriod: string;
  year: string;
}

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'public',
  'templates',
  'Code_on_Wages',
  'Form IV - Wage Register.xlsx',
);

const SHEET_TITLE = 'Form IV - Wage Register';
const ROWS_PER_SHEET = 8;

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cleanHeader(value: unknown): string {
  return normalizeText(value).replace(/[^\w₹%./()-]+/g, '');
}

function asText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value);
  return String(value).trim();
}

function asNumber(value: CellValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;

  const raw = String(value).replace(/,/g, '').trim();
  if (!raw) return null;

  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function asDate(value: CellValue): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : asDate(value as CellValue);
  if (!date) return String(value).trim();

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function roundMoney(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.round(Number(value) * 100) / 100;
}

function addMoney(...values: Array<number | null | undefined>): number {
  return values.reduce<number>((sum, value) => sum + (Number(value) || 0), 0);
}

function cloneStyle<T>(style: T): T {
  return style ? JSON.parse(JSON.stringify(style)) : style;
}

function copyWorksheet(templateWs: ExcelJS.Worksheet, targetWs: ExcelJS.Worksheet): void {
  targetWs.properties = cloneStyle(templateWs.properties);
  targetWs.pageSetup = cloneStyle(templateWs.pageSetup);
  targetWs.views = cloneStyle(templateWs.views);
  targetWs.autoFilter = templateWs.autoFilter ? cloneStyle(templateWs.autoFilter) : undefined;

  templateWs.columns.forEach((col, index) => {
    const targetCol = targetWs.getColumn(index + 1);

    if (typeof col.width === 'number') {
      targetCol.width = col.width;
    }

    if (typeof col.hidden === 'boolean') {
      targetCol.hidden = col.hidden;
    }

    if (typeof col.outlineLevel === 'number') {
      targetCol.outlineLevel = col.outlineLevel;
    }

    if (col.style) {
      targetCol.style = cloneStyle(col.style);
    }
  });

  templateWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = targetWs.getRow(rowNumber);

    if (typeof row.height === 'number') {
      targetRow.height = row.height;
    }

    if (typeof row.hidden === 'boolean') {
      targetRow.hidden = row.hidden;
    }

    if (typeof row.outlineLevel === 'number') {
      targetRow.outlineLevel = row.outlineLevel;
    }

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = cell.value as never;
      targetCell.style = cloneStyle(cell.style);
      if (cell.numFmt) targetCell.numFmt = cell.numFmt;
      if (cell.font) targetCell.font = cloneStyle(cell.font);
      if (cell.fill) targetCell.fill = cloneStyle(cell.fill);
      if (cell.border) targetCell.border = cloneStyle(cell.border);
      if (cell.alignment) targetCell.alignment = cloneStyle(cell.alignment);
      if (cell.protection) targetCell.protection = cloneStyle(cell.protection);
    });
  });

  const merges = templateWs.model.merges ?? [];
  for (const merge of merges) {
    targetWs.mergeCells(merge);
  }
}

function parseMasterRows(masterWs: ExcelJS.Worksheet): EmployeeSourceRow[] {
  const headerRow = masterWs.getRow(1);
  const headers: string[] = [];

  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    headers.push(asText(cell.value as CellValue));
  });

  const rows: EmployeeSourceRow[] = [];

  for (let rowNumber = 2; rowNumber <= masterWs.rowCount; rowNumber += 1) {
    const row = masterWs.getRow(rowNumber);

    const hasAnyValue = row.values
      ? (row.values as CellValue[]).some((v) => v !== null && v !== undefined && v !== '')
      : false;

    if (!hasAnyValue) continue;

    const obj: EmployeeSourceRow = {};
    headers.forEach((header, i) => {
      const raw = row.getCell(i + 1).value as CellValue;
      obj[header] = raw instanceof Date ? raw : raw ?? null;
    });

    rows.push(obj);
  }

  return rows;
}

function findMasterSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  for (const ws of workbook.worksheets) {
    const firstRow = ws.getRow(1);
    const headers: string[] = [];

    firstRow.eachCell({ includeEmpty: false }, (cell) => {
      headers.push(asText(cell.value as CellValue));
    });

    const hasEmployeeCode = headers.some((h) => cleanHeader(h) === cleanHeader('Employee code'));
    const hasFullName = headers.some((h) => cleanHeader(h) === cleanHeader('Employee Full Name'));
    const hasGross = headers.some((h) => cleanHeader(h) === cleanHeader('Gross Salary (Monthly)'));

    if (hasEmployeeCode && hasFullName && hasGross) return ws;
  }

  return null;
}

function deriveCompanyProfile(rows: EmployeeSourceRow[]): CompanyProfile {
  const first = rows[0] ?? {};

  const establishmentName =
    asText(
      first['Name of Occupier'] ??
      first['Name of the principal employer'] ??
      first['Name and address of the principal employer'] ??
      first['Name and Address of Contractor / Postal address '] ??
      first['Name and address of contractor'] ??
      first['Name and address of contractor'],
    ) || 'Regnix Enterprises Pvt. Ltd.';

  const establishmentRegNo =
    asText(
      first['Registration No. and date'] ??
      first['Number and date of Certificate of Registration'] ??
      first['Employer  PF Registration'] ??
      first['Employer PF Registration'] ??
      first['Establishment ID:-'] ??
      first['TRRN No.'],
    ) || '';

  const address =
    asText(
      first['Name and Address of Contractor / Postal address '] ??
      first['Name and address of contractor'] ??
      first['Address'] ??
      first['Work Location'] ??
      first['Location / Unit'],
    ) || '';

  const natureOfIndustry =
    asText(first['Type of business trade, industry, manufacture or occupation, which is carried on in the establishment']) ||
    asText(first['Nature of Work of Contract employee']) ||
    asText(first['Type of Establishment (Factory/Shop/Est.) / Contractor or Supplier']) ||
    'Monthly Wage Register';

  const wagePeriod = asText(first['Wage Period']) || 'Monthly';

  const paymentDate =
    asDate(first['Date of Remittance (Salary transfer date)']) ??
    asDate(first['PT payment date']) ??
    new Date();

  return {
    establishmentName,
    establishmentRegNo,
    address,
    natureOfIndustry,
    wagePeriod,
    year: String(paymentDate.getFullYear()),
  };
}

function buildWageRows(rows: EmployeeSourceRow[]): WageRegisterRow[] {
  return rows.map((row, index) => {
    const empCode = asText(row['Employee code'] ?? row['Regnix Employee ID'] ?? row['Employee ID']) || `EMP-${index + 1}`;
    const employeeName =
      asText(row['Employee Full Name'] ?? row['Employee Name'] ?? row['Full name of the employee']) || '';
    const department = asText(row['Department'] ?? row['Location / Unit'] ?? row['Work Location']) || '';
    const designation =
      asText(
        row['Designation'] ??
        row['Nature of Employment /designation'] ??
        row['Nature of employment/designation'] ??
        row['Nature of Work of Contract employee'],
      ) || '';

    const daysWorked =
      asNumber(row['No.of days worked']) ??
      asNumber(row['Total days worked']) ??
      asNumber(row['Total days Present']);

    const daysAbsent = asNumber(row['Total days Absent']) ?? null;

    const basicWage = asNumber(row['Basic Wage']) ?? asNumber(row['Basic wages']);
    const da = asNumber(row['D.A (DA)']) ?? asNumber(row['V.D.A (VDA)']);
    const hra = asNumber(row['HRA']);
    const conveyanceAllowance = asNumber(row['Conveyance Allowance']);
    const specialAllowance = asNumber(row['Special / Other Allowance']) ?? asNumber(row['Additional Salary Component, If any']);
    const otAmount = asNumber(row['Overtime Amount']) ?? asNumber(row['Total Overtime earning']);
    const grossWage =
      asNumber(row['Gross Salary (Monthly)']) ??
      addMoney(basicWage, da, hra, conveyanceAllowance, specialAllowance, otAmount);

    const netPayable = asNumber(row['Net Salary (Monthly)']) ?? asNumber(row['Net payments/ Amount paid']);

    const pfDedn =
      asNumber(row['Employee PF']) ??
      asNumber(row['EPF Contri remitted (12% of EPF wages)']) ??
      asNumber(row['Employer PF']) ??
      asNumber(row['Employer PF Registration']);

    const esiDedn = asNumber(row['ESIC Employee 0.75% (₹)']) ?? 0;
    const ptDedn = asNumber(row['PT amount']) ?? 0;
    const advanceDedn = asNumber(row['Advance']) ?? 0;

    const otherDedn =
      asNumber(row['Employee LWF']) ??
      asNumber(row['Total Deduction from salary']) ??
      null;

    const totalDednFromMaster =
      asNumber(row['Total Deduction from salary']) ??
      (grossWage !== null && netPayable !== null ? Math.max(0, grossWage - netPayable) : null);

    let resolvedOther = otherDedn;
    if (resolvedOther === null) {
      const known = addMoney(pfDedn, esiDedn, ptDedn, advanceDedn);
      resolvedOther = totalDednFromMaster !== null ? Math.max(0, totalDednFromMaster - known) : 0;
    }

    const totalDedn = totalDednFromMaster ?? addMoney(pfDedn, esiDedn, ptDedn, advanceDedn, resolvedOther);
    const finalNet = netPayable ?? (grossWage !== null ? Math.max(0, grossWage - totalDedn) : null);

    const paymentDate =
      asDate(row['Date of Remittance (Salary transfer date)']) ??
      asDate(row['PT payment date']) ??
      new Date();

    const receiptRef =
      asText(row['Bank Account Number']) ||
      asText(row['PF Member ID']) ||
      asText(row['Bank Name']) ||
      'Bank transfer';

    const masterNet = asNumber(row['Net Salary (Monthly)']);
    const variance =
      grossWage !== null && masterNet !== null
        ? Math.round((grossWage - masterNet - addMoney(pfDedn, esiDedn, ptDedn, advanceDedn, resolvedOther)) * 100) / 100
        : 0;

    const remarksParts: string[] = [];
    if (variance !== 0) {
      remarksParts.push(`Master variance: ${variance.toFixed(2)}`);
    }
    if (!grossWage) remarksParts.push('Gross wage missing in master');
    if (!pfDedn) remarksParts.push('PF deduction missing');
    if (!netPayable) remarksParts.push('Net salary missing in master');

    return {
      slNo: index + 1,
      employeeCode: empCode,
      employeeName,
      department,
      designation,
      daysWorked,
      daysAbsent,
      basicWage: roundMoney(basicWage),
      da: roundMoney(da),
      hra: roundMoney(hra),
      conveyanceAllowance: roundMoney(conveyanceAllowance),
      specialAllowance: roundMoney(specialAllowance),
      otAmount: roundMoney(otAmount),
      grossWage: roundMoney(grossWage),
      pfDedn: roundMoney(pfDedn),
      esiDedn: roundMoney(esiDedn),
      ptDedn: roundMoney(ptDedn),
      advanceDedn: roundMoney(advanceDedn),
      otherDedn: roundMoney(resolvedOther),
      totalDedn: roundMoney(totalDedn),
      netPayable: roundMoney(finalNet),
      paymentDate: formatDate(paymentDate),
      receiptRef,
      employeeSignature: '',
      remarks: remarksParts.join(' | '),
    };
  });
}

function fillMetaFields(ws: ExcelJS.Worksheet, profile: CompanyProfile): void {
  const establishmentBlock = profile.address
    ? `${profile.establishmentName}\n${profile.address}`
    : profile.establishmentName;

  ws.getCell('C4').value = establishmentBlock;
  ws.getCell('J4').value = profile.establishmentRegNo || '—';
  ws.getCell('J5').value = profile.year;
  ws.getCell('C6').value = profile.natureOfIndustry;
  ws.getCell('C7').value = profile.wagePeriod;
}

function fillSheetRows(ws: ExcelJS.Worksheet, rows: WageRegisterRow[]): void {
  for (let r = 11; r <= 18; r += 1) {
    for (let c = 1; c <= 25; c += 1) {
      ws.getCell(r, c).value = null;
    }
  }

  rows.forEach((row, idx) => {
    const excelRow = 11 + idx;

    ws.getCell(`A${excelRow}`).value = row.slNo;
    ws.getCell(`B${excelRow}`).value = row.employeeCode;
    ws.getCell(`C${excelRow}`).value = row.employeeName;
    ws.getCell(`D${excelRow}`).value = row.department;
    ws.getCell(`E${excelRow}`).value = row.designation;
    ws.getCell(`F${excelRow}`).value = row.daysWorked;
    ws.getCell(`G${excelRow}`).value = row.daysAbsent;
    ws.getCell(`H${excelRow}`).value = row.basicWage;
    ws.getCell(`I${excelRow}`).value = row.da;
    ws.getCell(`J${excelRow}`).value = row.hra;
    ws.getCell(`K${excelRow}`).value = row.conveyanceAllowance;
    ws.getCell(`L${excelRow}`).value = row.specialAllowance;
    ws.getCell(`M${excelRow}`).value = row.otAmount;
    ws.getCell(`N${excelRow}`).value = row.grossWage;
    ws.getCell(`O${excelRow}`).value = row.pfDedn;
    ws.getCell(`P${excelRow}`).value = row.esiDedn;
    ws.getCell(`Q${excelRow}`).value = row.ptDedn;
    ws.getCell(`R${excelRow}`).value = row.advanceDedn;
    ws.getCell(`S${excelRow}`).value = row.otherDedn;
    ws.getCell(`T${excelRow}`).value = row.totalDedn;
    ws.getCell(`U${excelRow}`).value = row.netPayable;
    ws.getCell(`V${excelRow}`).value = row.paymentDate;
    ws.getCell(`W${excelRow}`).value = row.receiptRef;
    ws.getCell(`X${excelRow}`).value = row.employeeSignature;
    ws.getCell(`Y${excelRow}`).value = row.remarks;
  });
}

function splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function loadTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `Form IV template not found at: ${TEMPLATE_PATH}. ` +
      `Place "Form IV - Wage Register.xlsx" under public/templates/Code_on_Wages/.`,
    );
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  return wb;
}

function toLoadableWorkbookInput(masterBuffer: Buffer | Uint8Array | ArrayBuffer): ArrayBuffer {
  if (masterBuffer instanceof Buffer) {
    return masterBuffer.buffer.slice(
      masterBuffer.byteOffset,
      masterBuffer.byteOffset + masterBuffer.byteLength,
    ) as ArrayBuffer;
  }

  if (masterBuffer instanceof Uint8Array) {
    return masterBuffer.buffer.slice(
      masterBuffer.byteOffset,
      masterBuffer.byteOffset + masterBuffer.byteLength,
    ) as ArrayBuffer;
  }

  return masterBuffer as ArrayBuffer;
}

export async function generateCodeOnWagesWorkbook(
  masterBuffer: Buffer | Uint8Array | ArrayBuffer,
): Promise<Buffer> {
  const masterWb = new ExcelJS.Workbook();
  await masterWb.xlsx.load(toLoadableWorkbookInput(masterBuffer));

  const masterWs = findMasterSheet(masterWb);
  if (!masterWs) {
    throw new Error(
      'Could not find a master sheet with Employee code, Employee Full Name, and Gross Salary (Monthly).',
    );
  }

  const sourceRows = parseMasterRows(masterWs);
  if (sourceRows.length === 0) {
    throw new Error('No employee rows were found in the uploaded master workbook.');
  }

  const profile = deriveCompanyProfile(sourceRows);
  const wageRows = buildWageRows(sourceRows);
  const batches = splitIntoChunks(wageRows, ROWS_PER_SHEET);

  const templateWb = await loadTemplateWorkbook();
  const templateWs = templateWb.getWorksheet(1);
  if (!templateWs) {
    throw new Error('Could not read the Form IV template worksheet.');
  }

  const outWb = new ExcelJS.Workbook();
  outWb.creator = 'Regnix';
  outWb.created = new Date();
  outWb.modified = new Date();

  batches.forEach((batch, index) => {
    const sheetName = index === 0 ? SHEET_TITLE : `${SHEET_TITLE} ${index + 1}`;
    const outWs = outWb.addWorksheet(sheetName);

    copyWorksheet(templateWs, outWs);
    fillMetaFields(outWs, profile);
    fillSheetRows(outWs, batch);
  });

  const buffer = await outWb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}