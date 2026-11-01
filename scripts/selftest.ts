import assert from 'node:assert/strict';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { buildFixture } from './makeFixture.js';
import { populateMaster } from '../server/services/populate/index.js';
import { runPopulate } from '../server/services/populate/engine.js';
import { F, verifySchema } from '../server/services/populate/fields.js';
import { orderRules, assertRuleKeysKnown } from '../server/services/populate/rules.js';
import { verhoeffCheckDigit, verhoeffValid, parseDate, parseMonth, ceilRupee } from '../server/services/populate/normalize.js';
import { readMasterWorkbook, getString, getDate, getNumber } from '../server/services/shared/masterReader.js';

let n = 0; const ok = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => { n += 1; console.log('  ✓', name); });

const TABLES = {
  lwf: {
    Maharashtra: { verified: true, frequency: 'Half-yearly', months: [6, 12], employee: 0, employer: 0 },
    Karnataka: { verified: true, frequency: 'Annual', months: [1], employee: 0, employer: 0 },
    Gujarat: { verified: true, frequency: 'Half-yearly', months: [6, 12], employee: 0, employer: 0 },
  },
  noLwf: ['Delhi'],
};

console.log('unit');
await ok('registry keys valid and rules acyclic', () => { assertRuleKeysKnown(); assert.ok(orderRules().length >= 16); });
await ok('Verhoeff / dates / rounding', () => {
  const good = '234567890123' .slice(0, 11) + verhoeffCheckDigit('23456789012');
  assert.ok(verhoeffValid(good)); assert.ok(!verhoeffValid(good.slice(0, 11) + String((Number(good[11]) + 1) % 10)));
  assert.equal(parseDate('31/12/2025')!.toISOString().slice(0, 10), '2025-12-31');
  assert.equal(parseDate('2025-02-30'), null);
  assert.equal(parseMonth('Oct-2026')!.days, 31);
  assert.equal(parseMonth('February 2028')!.days, 29);
  assert.equal(ceilRupee(0.0075 * 14800), 111);   // float-noise guard (111.00000000000001)
  assert.equal(ceilRupee(0.0075 * 15000), 113);
});
await ok('registry matches the real template headers', async () => {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile('public/templates/Regnix_Enterprise_Master_Register_v2.xlsx');
  const ws = wb.getWorksheet('Master Register - Structured')!;
  assert.deepEqual(verifySchema((c) => String(ws.getCell(2, c).value ?? '')), []);
});

console.log('end-to-end (synthetic fixture)');
const { master, source } = await buildFixture();
const cfg = { allowUnverifiedTables: true, appendUnmatched: true };
const res = await populateMaster({ master, sources: [{ name: 'payroll.xlsx', buffer: source }], config: cfg, tables: TABLES });
const out = res.raw;
fs.mkdirSync('out/fixture', { recursive: true });
for (const f of res.files) fs.writeFileSync(`out/fixture/${f.name}`, f.buffer);

const md = await readMasterWorkbook(res.files[0].buffer);
const byCode = (c: string) => md.employees.find((e) => getString(e, F.employeeCode.col) === c)!;
const v = (c: string, k: keyof typeof F) => getNumber(byCode(c), F[k].col);

await ok('source rows matched case-insensitively, new joiner appended, duplicate skipped', () => {
  const s = out.sources[0];
  assert.equal(s.matched, 7); assert.equal(s.appended, 1); assert.equal(s.duplicates.length, 1);
  assert.equal(md.employees.length, 8);
});
await ok('header matching: alias + junk title row + unmapped column left alone', () => {
  const m = out.sources[0].mapping;
  assert.equal(m.find((x) => x.source === 'Basic Pay')!.col, F.basic.col);
  assert.equal(m.find((x) => x.source === 'A/c No')!.col, F.bankAccount.col);
  assert.equal(m.find((x) => x.source === 'Weird Internal Flag')!.col, null);
});
await ok('E001 attendance', () => {
  assert.equal(v('E001', 'presentDays'), 22); assert.equal(v('E001', 'absentDays'), 2);
  assert.equal(v('E001', 'woHolidayDays'), 5); assert.equal(v('E001', 'lwpDays'), 1); assert.equal(v('E001', 'ncpDays'), 3);
  assert.equal(v('E001', 'totalDaysWorked'), 22); // synced from group
});
await ok('E001 wages, OT, PF, ESIC, PT, net', () => {
  assert.equal(v('E001', 'gross'), 17000);
  assert.equal(v('E001', 'otRate'), 134.62); assert.equal(v('E001', 'otAmount'), 807.72);
  assert.equal(v('E001', 'epfContri'), 1440); assert.equal(v('E001', 'epsContri'), 1000); assert.equal(v('E001', 'epfEpsDiff'), 440);
  assert.equal(v('E001', 'pfAdmin'), 60); assert.equal(v('E001', 'totalEmployer'), 1560);
  assert.equal(v('E001', 'esicEmployer'), 553); assert.equal(v('E001', 'esicEmployee'), 128);
  assert.equal(v('E001', 'ptAmount'), 200);
  assert.equal(v('E001', 'totalDeduction'), 1768); assert.equal(v('E001', 'net'), 15232); assert.equal(v('E001', 'netPaid'), 16039.72);
});
await ok('E001 bonus, gratuity, CTC', () => {
  assert.equal(v('E001', 'bonusCalc'), 583.1); assert.equal(getString(byCode('E001'), F.bonusEligB.col), 'Yes');
  assert.equal(v('E001', 'gratuityCalc'), 673.08); assert.equal(v('E001', 'gratuityPayable'), 64615.38);
  assert.equal(getString(byCode('E001'), F.gratuityElig.col), 'Yes');
  assert.equal(getString(byCode('E001'), F.gratuityDateB.col), '01-04-2024');
  assert.equal(v('E001', 'ctcAnnual'), 244430.16);
});
await ok('E002 above ESIC ceiling, PF capped, woman PT exempt', () => {
  assert.equal(v('E002', 'esicEmployee'), 0); assert.equal(v('E002', 'esicEmployer'), 0);
  assert.equal(v('E002', 'epfContri'), 1800); assert.equal(v('E002', 'epsContri'), 1250); assert.equal(v('E002', 'epfEpsDiff'), 550);
  assert.equal(v('E002', 'ptAmount'), 0); assert.equal(v('E002', 'net'), 20200);
});
await ok('E003 apprentice: stipend path only, no PF/ESIC/gross', () => {
  assert.equal(v('E003', 'appDeductions'), 870.97); assert.equal(v('E003', 'appNetStipend'), 8129.03);
  assert.equal(v('E003', 'epfContri'), null); assert.equal(v('E003', 'gross'), null);
});
await ok('E004 age ≥ 58 → EPS nil, KA PT', () => {
  assert.equal(v('E004', 'age'), 60); assert.equal(v('E004', 'epsContri'), 0); assert.equal(v('E004', 'epfEpsDiff'), 1800);
  assert.equal(v('E004', 'ptAmount'), 200);
});
await ok('E005 daily wage ≤ ₹176 → no employee ESIC; Delhi no PT', () => {
  assert.equal(v('E005', 'esicEmployer'), 143); assert.equal(v('E005', 'esicEmployee'), 0); assert.equal(v('E005', 'ptAmount'), 0);
});
await ok('formats: ids stored as text, dates as dates, gender normalised', () => {
  assert.equal(getString(byCode('E001'), F.aadhaarB.col).length, 12);
  assert.equal(getString(byCode('E001'), F.panB.col), 'ABCDE1234F');
  assert.equal(getString(byCode('E001'), F.bankAccount.col), '001234567890'); // leading zeros kept
  assert.equal(getString(byCode('E001'), F.genderB.col), 'Male'); assert.equal(getString(byCode('E001'), F.genderA.col), 'Male');
  assert.equal(getDate(byCode('E001'), F.dobB.col)!.toISOString().slice(0, 10), '1990-06-15');
});
await ok('duplicate-column sync (DOJ, designation, Aadhaar, UAN→ESIC groups)', () => {
  assert.equal(getString(byCode('E001'), F.dojA.col), getString(byCode('E001'), F.dojC.col));
  assert.equal(getString(byCode('E001'), F.natureEmpA.col), 'Operator');
  assert.equal(getString(byCode('E002'), F.aadhaarA.col), getString(byCode('E002'), F.aadhaarB.col));
});
await ok('conflict logged, master value kept', () => {
  assert.ok(out.conflicts.some((c) => c.employee === 'E003' && c.field.includes('Employee Full Name')));
  assert.equal(getString(byCode('E003'), 101), 'Test Apprentice');
});
await ok('discrepancy: entered EPF 999 vs computed 1200 not overwritten', () => {
  const d = out.discrepancies.find((x) => x.employee === 'E006' && x.rule === 'epf.contributions');
  assert.ok(d && d.entered === 999 && d.computed === 1200); assert.equal(v('E006', 'epfContri'), 999);
});
await ok('gaps: partial attendance, unknown code, unknown state are reported — never guessed', () => {
  const reasons = out.gaps.map((g) => g.reason).join('\n');
  assert.match(reasons, /only 10 of 31 days/); assert.match(reasons, /unrecognised attendance code "XX"/);
  assert.match(reasons, /no Professional Tax table for state "Goa"/);
  assert.equal(v('E006', 'presentDays'), null); assert.equal(v('E007', 'presentDays'), null); assert.equal(v('E006', 'totalDeduction'), null);
});
await ok('validation catches bad IDs, child labour, bad checksum', () => {
  const codes = out.issues.map((i) => `${i.employee}:${i.code}`);
  for (const c of ['E006:CHILD_LABOUR', 'E006:AADHAAR_INVALID', 'E006:PAN_INVALID', 'E006:UAN_INVALID', 'E006:IFSC_INVALID']) assert.ok(codes.includes(c), c);
  assert.ok(!out.issues.some((i) => i.employee === 'E001' && i.severity === 'error'));
});
await ok('unverified tables flagged when used', () => assert.ok(out.tablesUsedUnverified.some((t) => t.startsWith('PT: Maharashtra'))));
await ok('default config refuses unverified PT tables (E001 PT/net stay blank)', async () => {
  const strict = await runPopulate({ master, sources: [{ name: 'p.xlsx', buffer: source }], tables: TABLES });
  const m = await readMasterWorkbook(strict.masterBuffer);
  const e1 = m.employees.find((e) => getString(e, F.employeeCode.col) === 'E001')!;
  assert.equal(getNumber(e1, F.ptAmount.col), null); assert.equal(getNumber(e1, F.net.col), null);
  assert.equal(getNumber(e1, F.epfContri.col), 1440);
  assert.ok(strict.gaps.some((g) => g.kind === 'blocked' && /not marked verified/.test(g.reason)));
});
await ok('idempotent: re-running on its own output changes nothing', async () => {
  const again = await runPopulate({ master: res.files[0].buffer, config: cfg, tables: TABLES });
  assert.equal(again.changes.length, 0, JSON.stringify(again.changes.slice(0, 3)));
  assert.equal(again.discrepancies.filter((d) => d.employee !== 'E006').length, 0);
});
await ok('blank template runs cleanly (0 employees)', async () => {
  const blank = await runPopulate({ master: fs.readFileSync('public/templates/Regnix_Enterprise_Master_Register_v2.xlsx') });
  assert.equal(blank.employees, 0);
});
console.log(`\n${n} checks passed`);
