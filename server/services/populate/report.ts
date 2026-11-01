/** populate/report.ts — builds the review workbook (Populate_Report.xlsx) and the JSON summary. */
import ExcelJS from 'exceljs';
import { formatDMY, type Val } from './normalize.js';
import type { PopulateOutput } from './engine.js';

const show = (v: Val | undefined): string | number =>
  v === null || v === undefined ? '' : v instanceof Date ? formatDMY(v) : typeof v === 'boolean' ? String(v) : v;

function sheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number)[][], widths?: number[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(headers).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
  const cap = 200_000;
  rows.slice(0, cap).forEach((r) => ws.addRow(r));
  if (rows.length > cap) ws.addRow([`… ${rows.length - cap} more rows truncated`]);
  (widths ?? headers.map(() => 22)).forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  return ws;
}

export function summarise(o: PopulateOutput) {
  const by = (via: string) => o.changes.filter((c) => c.via.startsWith(via)).length;
  const sev = (s: string) => o.issues.filter((i) => i.severity === s).length;
  return {
    employees: o.employees,
    cellsWritten: o.changes.length,
    fromSource: by('source'), derivedByRule: by('rule'), syncedDuplicateColumns: by('sync'),
    formatNormalised: by('normalise'), serialNumbers: by('sequence'),
    reconciledMatchingValues: o.reconciledOk,
    sourceConflicts: o.conflicts.length, ruleDiscrepancies: o.discrepancies.length,
    dataGaps: o.gaps.reduce((n, g) => n + g.rows, 0),
    validation: { errors: sev('error'), warnings: sev('warn'), info: sev('info') },
    tablesUsedUnverified: o.tablesUsedUnverified,
    acts: o.acts.map((a) => ({ act: a.act, provisional: a.provisional, ready: `${a.readyRows}/${a.applicableRows}` })),
  };
}

export async function buildReport(o: PopulateOutput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const s = summarise(o);

  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 44 }, { width: 70 }];
  const line = (a: string, b: string | number = '') => sum.addRow([a, b]);
  line('Regnix Master Populate — run summary').font = { bold: true, size: 14 };
  line('Employees in master', s.employees);
  line('Layout detected', `header row ${o.layout.headerRow}, data from row ${o.layout.firstDataRow}, ${o.layout.columns} columns`);
  line('Cells written', s.cellsWritten);
  line('  from source files', s.fromSource);
  line('  derived by rules', s.derivedByRule);
  line('  copied between duplicate columns', s.syncedDuplicateColumns);
  line('  format-normalised', s.formatNormalised);
  line('Existing values that matched the rules', s.reconciledMatchingValues);
  line('Source vs master conflicts (not applied)', s.sourceConflicts);
  line('Entered value ≠ computed value (not applied)', s.ruleDiscrepancies);
  line('Employee-rows with an unfilled derivation', s.dataGaps);
  line('Validation errors / warnings', `${s.validation.errors} / ${s.validation.warnings}`);
  if (s.tablesUsedUnverified.length) {
    line('⚠ UNVERIFIED statutory tables were used', s.tablesUsedUnverified.join(', ')).font = { bold: true, color: { argb: 'FFB00020' } };
  }
  line('');
  line('Act readiness (all required columns filled)').font = { bold: true };
  for (const a of o.acts) line(`${a.act}${a.provisional ? ' (provisional requirement list)' : ''}`, `${a.readyRows} of ${a.applicableRows} rows ready`);

  sheet(wb, 'Gaps', ['Rule', 'Kind', 'Reason', 'Employee rows', 'Sample employees'],
    o.gaps.map((g) => [g.rule, g.kind, g.reason, g.rows, g.sample.join(', ')]), [24, 10, 90, 14, 40]);
  sheet(wb, 'Act readiness', ['Act', 'Provisional', 'Requirement', 'Rows blank', 'Rows in scope'],
    o.acts.flatMap((a) => a.blockers.length
      ? a.blockers.map((b) => [a.act, a.provisional ? 'yes' : 'no', b.requirement, b.blankRows, a.applicableRows])
      : [[a.act, a.provisional ? 'yes' : 'no', '(all requirements met)', 0, a.applicableRows]]), [26, 12, 36, 12, 14]);
  sheet(wb, 'Validation', ['Severity', 'Code', 'Row', 'Employee', 'Field', 'Message'],
    o.issues.map((i) => [i.severity, i.code, i.row ?? '', i.employee, i.field, i.message]), [10, 22, 7, 16, 40, 90]);
  sheet(wb, 'Discrepancies', ['Row', 'Employee', 'Field', 'Entered', 'Computed', 'Rule'],
    o.discrepancies.map((d) => [d.row, d.employee, d.field, show(d.entered), show(d.computed), d.rule]), [7, 16, 46, 14, 14, 24]);
  sheet(wb, 'Source conflicts', ['Row', 'Employee', 'Field', 'Master value', 'Source value', 'Origin'],
    o.conflicts.map((c) => [c.row, c.employee, c.field, show(c.master), show(c.source), c.origin]), [7, 16, 46, 18, 18, 70]);
  sheet(wb, 'Source mapping', ['File', 'Sheet', 'Source header', 'Master column', 'Master header', 'Method', 'Confidence', 'Suggestion (needs review)'],
    o.sources.flatMap((r) => r.mapping.map((m) => [
      r.file, r.sheet, m.source, m.col ? colName(m.col) : '— not mapped —', m.col ? o.columns[m.col - 1].header : '',
      m.method, m.confidence, m.suggestion ? `${colName(m.suggestion.col)} ${m.suggestion.header} (${m.suggestion.confidence})` : '',
    ])), [24, 16, 30, 14, 44, 10, 11, 60]);
  sheet(wb, 'Source rows', ['File', 'Sheet', 'Rows', 'Matched', 'Appended', 'Unmatched', 'Duplicates'],
    o.sources.map((r) => [r.file, r.sheet, r.rows, r.matched, r.appended, r.unmatched.join(', '), r.duplicates.join(', ')]), [24, 16, 8, 9, 9, 40, 50]);
  sheet(wb, 'Column coverage', ['#', 'Col', 'Section', 'Header', 'Filled before', 'Filled after', 'Blank after', 'Auto-derivable'],
    o.columns.map((c) => [c.col, c.letter, c.section, c.header, c.filledBefore, c.filledAfter, c.blankAfter, c.derivable ? 'yes' : '']), [6, 6, 30, 60, 12, 12, 12, 14]);
  sheet(wb, 'Change log', ['Row', 'Employee', 'Field', 'Before', 'After', 'Via'],
    o.changes.map((c) => [c.row, c.employee, c.field, show(c.before), show(c.after), c.via]), [7, 16, 46, 16, 16, 60]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const colName = (n: number): string => {
  let s = ''; let x = n;
  while (x > 0) { s = String.fromCharCode(65 + ((x - 1) % 26)) + s; x = Math.floor((x - 1) / 26); }
  return `${s} (${n})`;
};
