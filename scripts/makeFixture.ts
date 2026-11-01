/** Builds a SYNTHETIC master + source pair for testing. Names/IDs are invented. */
import ExcelJS from 'exceljs';
import fs from 'fs';
import { F, dayCol } from '../server/services/populate/fields.js';
import { verhoeffCheckDigit } from '../server/services/populate/normalize.js';

const aadhaar = (base11: string) => base11 + verhoeffCheckDigit(base11);
export const AADHAAR = { E001: aadhaar('23456789012'), E002: aadhaar('34567890123'), E003: aadhaar('45678901234'), E004: aadhaar('56789012345') };
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** Oct-2026: 31 days. Sundays = 4,11,18,25. */
function attendance(plan: Record<string, number>): string[] {
  const list: string[] = [];
  for (const [code, n] of Object.entries(plan)) for (let i = 0; i < n; i += 1) list.push(code);
  return list;
}

export async function buildFixture(): Promise<{ master: Buffer; source: Buffer }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('public/templates/Regnix_Enterprise_Master_Register_v2.xlsx');
  const ws = wb.getWorksheet('Master Register - Structured')!;

  type E = Record<string, any> & { att?: string[] };
  const full = attendance({ P: 22, WO: 4, H: 1, A: 2, L: 1, LWP: 1 });
  const emps: E[] = [
    { code: 'E001', name: 'Test Worker One', dob: '15/06/1990', doj: utc(2019, 4, 1), gender: 'M', state: 'Maharashtra', att: full, ot: [4, 2, 0, 0], desig: 'Operator' },
    { code: 'E002', name: 'Test Worker Two', dob: utc(1992, 3, 9), doj: utc(2022, 1, 10), gender: 'Female', state: 'maharashtra', att: attendance({ P: 26, WO: 4, H: 1 }), desig: 'Clerk' },
    { code: 'E003', name: 'Test Apprentice', dob: utc(2004, 8, 20), doj: utc(2026, 2, 1), gender: 'F', state: 'Maharashtra', att: attendance({ P: 24, WO: 4, A: 3 }), app: 'Yes', stipend: 9000 },
    { code: 'E004', name: 'Test Worker Four', dob: utc(1966, 5, 10), doj: utc(2010, 7, 1), gender: 'Male', state: 'Karnataka', att: attendance({ P: 26, WO: 4, H: 1 }), desig: 'Supervisor' },
    { code: 'E005', name: 'Test Worker Five', dob: utc(1999, 12, 1), doj: utc(2025, 5, 5), gender: 'Male', state: 'Delhi', att: attendance({ P: 26, WO: 4, H: 1 }), desig: 'Helper' },
    { code: 'E006', name: 'Test Worker Six', dob: utc(2015, 1, 1), doj: utc(2026, 1, 1), gender: 'M', state: 'Goa', att: attendance({ P: 10 }), epfEntered: 999 },
    { code: 'E007', name: 'Test Worker Seven', dob: utc(1995, 1, 1), doj: utc(2024, 1, 1), gender: 'Male', state: 'Gujarat', att: [...attendance({ P: 30 }), 'XX'] },
  ];
  emps.forEach((e, i) => {
    const r = 3 + i;
    const put = (col: number, v: unknown) => { if (v !== undefined) ws.getCell(r, col).value = v as ExcelJS.CellValue; };
    put(F.employeeCode.col, e.code); put(101, e.name); put(F.dobB.col, e.dob); put(F.dojC.col, e.doj);
    put(F.genderB.col, e.gender); put(F.state.col, e.state); put(F.monthOf.col, 'Oct-2026');
    put(F.designation.col, e.desig); put(F.isApprentice.col, e.app); put(F.stipend.col, e.stipend);
    put(F.epfContri.col, e.epfEntered);
    (e.att ?? []).forEach((c, d) => put(dayCol(d + 1), c));
    (e.ot ?? []).forEach((h: number, w: number) => put(F.otWeek1.col + w, h));
  });
  const master = Buffer.from(await wb.xlsx.writeBuffer());

  const sw = new ExcelJS.Workbook();
  const s = sw.addWorksheet('Payroll Oct-2026');
  s.addRow(['Payroll export — synthetic']);           // junk title row above the header
  s.addRow(['Emp Code', 'Employee Name', 'Basic Pay', 'DA', 'HRA', 'UAN No', 'Aadhaar No', 'PAN', 'IFSC Code', 'A/c No', 'Bank', 'Weird Internal Flag']);
  s.addRow(['e001', 'Test Worker One', 12000, 2000, 3000, '100200300401', AADHAAR.E001.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3'), 'abcde1234f', 'hdfc0001234', '001234567890', 'HDFC Bank', 'x']);
  s.addRow(['E002', 'Test Worker Two', 18000, 0, 4000, '100200300402', AADHAAR.E002, 'ABCDE1235G', 'SBIN0000456', '55501234', 'SBI', 'x']);
  s.addRow(['E003', 'Test Apprentice (renamed)', null, null, null, null, AADHAAR.E003, 'ABCDE1236H', 'ICIC0000789', '9988776655', 'ICICI', 'x']);
  s.addRow(['E004', 'Test Worker Four', 25000, 0, 5000, '100200300404', AADHAAR.E004, 'ABCDE1237J', 'HDFC0001234', '1122334455', 'HDFC Bank', 'x']);
  s.addRow(['E005', 'Test Worker Five', 4400, 0, 0, '100200300405', '', '', '', '', '', 'x']);
  s.addRow(['E006', 'Test Worker Six', 10000, 0, 0, '12345', '1234 5678 9012', 'BADPAN', 'XX', '1', '', 'x']);
  s.addRow(['E007', 'Test Worker Seven', 15000, 0, 0, '', '', '', '', '', '', 'x']);
  s.addRow(['E008', 'New Joiner From Source', 9000, 0, 0, '', '', '', '', '', '', 'x']);
  s.addRow(['E005', 'Test Worker Five', 4400, 0, 0, '', '', '', '', '', '', 'dup']);
  const source = Buffer.from(await sw.xlsx.writeBuffer());
  return { master, source };
}

if (process.argv[1]?.endsWith('makeFixture.ts')) {
  const { master, source } = await buildFixture();
  fs.mkdirSync('out/fixture', { recursive: true });
  fs.writeFileSync('out/fixture/SYNTHETIC_master_input.xlsx', master);
  fs.writeFileSync('out/fixture/SYNTHETIC_payroll_source.xlsx', source);
  console.log('fixture written to out/fixture');
}
