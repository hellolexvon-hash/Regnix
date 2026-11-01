/**
 * populate/engine.ts — the pipeline.
 *
 *   load master → verify schema → merge source files → normalise → sync duplicate columns
 *   → derive (ordered rules) → sync again → validate → write back → statistics
 *
 * Existing non-blank master cells are never overwritten (unless cfg.overwrite); disagreements
 * are logged as conflicts / discrepancies instead.
 */

import ExcelJS from 'exceljs';
import { loadWorkbookFromBuffer, workbookToBuffer } from '../shared/excelUtils.js';
import { F, FIELD_KEYS, KEY_BY_COL, SYNC_GROUPS, verifySchema, type FieldKey } from './fields.js';
import {
  type Val, isBlank, parseDate, parseNum, normAadhaar, normPan, normUan, normIfsc, normMobile,
  normGender, normYesNo, formatDMY, isYes,
} from './normalize.js';
import { DEFAULT_CONFIG, loadTables, type PopulateConfig, type StatutoryTables } from './config.js';
import { ALL_RULES, Blocked, Missing, assertRuleKeysKnown, colLetter, makeCtx, orderRules, type Rule } from './rules.js';
import { cellVal, matchColumns, readSource, type ColumnMatch } from './ingest.js';
import { validateRows, employeeLabel, type Issue, type RowData } from './validate.js';
import { ACTS } from './acts.js';

export const MASTER_SHEET = 'Master Register - Structured';

// ─── Result types ────────────────────────────────────────────────────────────

export interface Change { row: number; employee: string; col: number; field: string; before: Val; after: Val; via: string }
export interface Conflict { row: number; employee: string; col: number; field: string; master: Val; source: Val; origin: string }
export interface Discrepancy { row: number; employee: string; col: number; field: string; entered: Val; computed: Val; rule: string }
export interface GapItem { rule: string; kind: 'missing' | 'blocked'; reason: string; rows: number; sample: string[] }
export interface ColumnStat { col: number; letter: string; section: string; header: string; filledBefore: number; filledAfter: number; blankAfter: number; derivable: boolean }
export interface SourceReport { file: string; sheet: string; rows: number; matched: number; appended: number; unmatched: string[]; duplicates: string[]; mapping: ColumnMatch[] }
export interface ActReadiness { act: string; provisional: boolean; applicableRows: number; readyRows: number; blockers: { requirement: string; blankRows: number }[] }

export interface PopulateInput {
  master: Buffer;
  sources?: { name: string; buffer: Buffer }[];
  /** { "Source header": "AB" | 28 } — overrides automatic header matching. */
  mapping?: Record<string, string | number>;
  config?: Partial<PopulateConfig>;
  tables?: Partial<StatutoryTables>;
}

export interface PopulateOutput {
  masterBuffer: Buffer;
  employees: number;
  layout: { headerRow: number; firstDataRow: number; columns: number };
  changes: Change[];
  conflicts: Conflict[];
  discrepancies: Discrepancy[];
  gaps: GapItem[];
  notApplicable: { rule: string; reason: string; rows: number }[];
  issues: Issue[];
  columns: ColumnStat[];
  sources: SourceReport[];
  acts: ActReadiness[];
  tablesUsedUnverified: string[];
  reconciledOk: number;
  config: PopulateConfig;
}

// ─── Type coercion per target column ─────────────────────────────────────────

function inferType(col: number, header: string): 'text' | 'id' | 'date' | 'num' | 'bool' | 'gender' {
  const key = KEY_BY_COL.get(col);
  if (key) return F[key].t;
  if (/\b(no\.?|number|time|and date|remarks?|status|reason)\b/i.test(header)) return 'text';
  if (/^date\b|\bdate of\b|\bdob\b|\bdate\b/i.test(header) && !/\bfrom\b.*\bto\b/i.test(header)) return 'date';
  return 'text';
}

function coerce(col: number, header: string, v: Val): Val {
  if (isBlank(v)) return null;
  const key = KEY_BY_COL.get(col);
  const type = inferType(col, header);
  if (key === 'monthOf') {
    const d = v instanceof Date ? v : null;
    return d ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]}-${d.getUTCFullYear()}` : String(v).trim();
  }
  switch (type) {
    case 'date': return parseDate(v) ?? v;
    case 'num': { const n = parseNum(v); return n ?? v; }
    case 'gender': return normGender(v).value ?? v;
    case 'bool': { const p = normYesNo(v); return p.valid ? p.value : v; }
    case 'id': {
      let p: { value: string | null } | null = null;
      if (key === 'aadhaarA' || key === 'aadhaarB') p = normAadhaar(v);
      else if (key === 'panA' || key === 'panB') p = normPan(v);
      else if (key === 'uan') p = normUan(v);
      else if (key === 'ifsc') p = normIfsc(v);
      else if (key === 'mobile' || key === 'altMobile') p = normMobile(v);
      if (p?.value) return p.value;
      return typeof v === 'number' ? String(Math.trunc(v)) : String(v).trim();
    }
    default: return typeof v === 'string' ? v.trim() : v;
  }
}

function same(a: Val, b: Val, tol = 0): boolean {
  if (isBlank(a) && isBlank(b)) return true;
  const da = a instanceof Date ? a : null; const db = b instanceof Date ? b : null;
  if (da || db) return !!(da && db && formatDMY(da) === formatDMY(db));
  const na = typeof a === 'number' ? a : null; const nb = typeof b === 'number' ? b : null;
  if (na !== null && nb !== null) return Math.abs(na - nb) <= tol;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function runPopulate(input: PopulateInput): Promise<PopulateOutput> {
  const cfg: PopulateConfig = { ...DEFAULT_CONFIG, ...(input.config ?? {}) };
  const tables = loadTables(input.tables);
  assertRuleKeysKnown();
  const rules = orderRules(ALL_RULES);

  // 1 ── load master & verify the template still matches the registry
  const wb = await loadWorkbookFromBuffer(input.master);
  const ws = wb.getWorksheet(MASTER_SHEET) ?? wb.worksheets[0];
  if (!ws) throw new Error('populate: master workbook has no worksheets.');
  const maxCol = Math.max(ws.columnCount, 560);
  const readHeaders = (row: number): string[] => {
    const out: string[] = [];
    for (let c = 1; c <= maxCol; c += 1) {
      const v = cellVal(ws.getRow(row).getCell(c).value);
      out.push(isBlank(v) ? '' : String(v).replace(/\s+/g, ' ').trim());
    }
    return out;
  };
  // Two layouts exist: template (row 1 = section names, row 2 = headers, data from row 3)
  // and compact (row 1 = headers, data from row 2). Pick whichever row matches the registry.
  const candidates = [2, 1].map((row) => {
    const h = readHeaders(row);
    return { row, headers: h, problems: verifySchema((c) => h[c - 1] ?? '') };
  });
  const best = candidates.reduce((a, b) => (b.problems.length < a.problems.length ? b : a));
  const problems = best.problems;
  const HEADER_ROW = best.row;
  const FIRST_DATA_ROW = HEADER_ROW + 1;
  const headers = best.headers;
  if (problems.length) {
    throw new Error(
      `populate: master columns do not match the expected template (${problems.length} problem(s), header row ${HEADER_ROW}):\n` +
      problems.slice(0, 15).map((p) => `  ${p.key}: column ${colLetter(p.col)} should contain "${p.expected}" but has "${p.actual}"`).join('\n'),
    );
  }
  const sections: string[] = [];
  let cur = '';
  for (let c = 1; c <= maxCol; c += 1) {
    const v = HEADER_ROW === 2 ? cellVal(ws.getRow(1).getCell(c).value) : null;
    if (!isBlank(v)) cur = String(v).trim();
    sections.push(cur);
  }

  // 2 ── read rows (raw, with every blank preserved as absence)
  const rows: RowData[] = [];
  for (let r = FIRST_DATA_ROW; r <= ws.rowCount; r += 1) {
    const data = new Map<number, Val>();
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
      const v = cellVal(cell.value);
      if (!isBlank(v)) data.set(c, v);
    });
    if (data.size) rows.push({ rowNumber: r, data });
  }
  const before = rows.map((r) => new Map(r.data));
  const beforeCount = (col: number) => before.reduce((n, m) => n + (m.has(col) ? 1 : 0), 0);
  const originalRowNumbers = new Set(rows.map((r) => r.rowNumber));
  let nextRow = Math.max(HEADER_ROW, ...rows.map((r) => r.rowNumber)) + 1; // ignore styled-but-empty rows

  const changes: Change[] = [];
  const conflicts: Conflict[] = [];
  const set = (row: RowData, col: number, value: Val, via: string) => {
    const old = row.data.get(col) ?? null;
    if (value === null || value === undefined) return;
    row.data.set(col, value);
    changes.push({ row: row.rowNumber, employee: employeeLabel(row), col, field: `${colLetter(col)} ${headers[col - 1]}`, before: old, after: value, via });
  };

  // 3 ── merge source files
  const sourceReports: SourceReport[] = [];
  const idCols = [F.employeeCode.col, F.uan.col, F.aadhaarB.col, F.aadhaarA.col, F.panB.col, F.panA.col];
  const index = new Map<string, RowData | 'AMBIGUOUS'>();
  const addIndex = (row: RowData) => {
    for (const c of idCols) {
      const v = row.data.get(c); if (isBlank(v)) continue;
      const key = `${c === F.aadhaarA.col ? F.aadhaarB.col : c === F.panA.col ? F.panB.col : c}:${String(coerce(c, headers[c - 1], v as Val)).toUpperCase()}`;
      const prev = index.get(key);
      index.set(key, prev && prev !== row ? 'AMBIGUOUS' : row);
    }
  };
  rows.forEach(addIndex);

  for (const src of input.sources ?? []) {
    for (const table of await readSource(src.buffer, src.name)) {
      const mapping = matchColumns(table.headers, headers, input.mapping, cfg.fuzzyThreshold);
      const used = mapping.filter((m) => m.col !== null);
      const rep: SourceReport = { file: src.name, sheet: table.name, rows: table.rows.length, matched: 0, appended: 0, unmatched: [], duplicates: [], mapping };
      const touched = new Set<RowData>();
      const origin = (h: string) => `source: ${src.name} / ${table.name} / "${h}"`;

      for (const srow of table.rows) {
        const vals = new Map<number, { v: Val; header: string }>();
        for (const m of used) {
          const v = coerce(m.col!, headers[m.col! - 1], srow[m.source] ?? null);
          if (!isBlank(v)) vals.set(m.col!, { v, header: m.source });
        }
        if (!vals.size) continue;

        let target: RowData | null = null;
        let label = '';
        for (const c of [F.employeeCode.col, F.uan.col, F.aadhaarB.col, F.aadhaarA.col, F.panB.col, F.panA.col]) {
          const hit = vals.get(c); if (!hit) continue;
          label = label || String(hit.v);
          const key = `${c === F.aadhaarA.col ? F.aadhaarB.col : c === F.panA.col ? F.panB.col : c}:${String(hit.v).toUpperCase()}`;
          const found = index.get(key);
          if (found === 'AMBIGUOUS') { rep.duplicates.push(`${label} (ambiguous in master)`); target = null; break; }
          if (found) { target = found; break; }
        }
        if (!label) label = String(vals.get(F.fullName.col)?.v ?? vals.get(401)?.v ?? `source row`);
        if (target && touched.has(target)) { rep.duplicates.push(`${label} (repeated in source — first row used)`); continue; }

        if (!target) {
          if (!cfg.appendUnmatched) { rep.unmatched.push(label); continue; }
          target = { rowNumber: nextRow, data: new Map() };
          nextRow += 1;
          rows.push(target); before.push(new Map());
          rep.appended += 1;
        } else rep.matched += 1;
        touched.add(target);

        for (const [col, { v, header }] of vals) {
          const existing = target.data.get(col);
          if (isBlank(existing)) set(target, col, v, origin(header));
          else if (!same(existing as Val, v, 0.005)) {
            if (cfg.overwrite) set(target, col, v, origin(header) + ' (overwrite)');
            else conflicts.push({ row: target.rowNumber, employee: employeeLabel(target), col, field: `${colLetter(col)} ${headers[col - 1]}`, master: existing as Val, source: v, origin: origin(header) });
          }
        }
        addIndex(target);
      }
      sourceReports.push(rep);
    }
  }

  // 4 ── normalise what is already there (formats only; never changes meaning)
  for (const row of rows) {
    for (const [col, v] of [...row.data]) {
      const n = coerce(col, headers[col - 1] ?? '', v);
      const differs = !isBlank(n) && (typeof n !== typeof v || (n instanceof Date ? !(v instanceof Date) || formatDMY(n) !== formatDMY(v) : String(n) !== String(v)));
      if (differs) {
        row.data.set(col, n);
        changes.push({ row: row.rowNumber, employee: employeeLabel(row), col, field: `${colLetter(col)} ${headers[col - 1]}`, before: v, after: n, via: 'normalise: format' });
      }
    }
  }

  // 5 ── duplicate-column synchronisation + running serial numbers
  const sync = (row: RowData) => {
    for (const g of SYNC_GROUPS) {
      const src = g.keys.find((k) => !isBlank(row.data.get(F[k].col)));
      if (!src) continue;
      const v = row.data.get(F[src].col) as Val;
      for (const k of g.keys) if (isBlank(row.data.get(F[k].col))) set(row, F[k].col, v, `sync: ${g.name} (from ${colLetter(F[src].col)})`);
    }
  };
  rows.sort((a, b) => a.rowNumber - b.rowNumber);
  rows.forEach((row, i) => {
    if (SYNC_GROUPS[0].keys.every((k) => isBlank(row.data.get(F[k].col)))) set(row, F.slNo.col, i + 1, 'sequence: Sl.no');
    sync(row);
  });

  // 6 ── derive
  const gapMap = new Map<string, GapItem>();
  const naMap = new Map<string, { rule: string; reason: string; rows: number }>();
  const discrepancies: Discrepancy[] = [];
  const derivable = new Set<number>(rules.flatMap((r) => r.produces.map((k) => F[k].col)));
  const unverifiedUsed = new Set<string>();
  let reconciledOk = 0;

  for (const row of rows) {
    const ctx = makeCtx(row.data, cfg, tables);
    for (const rule of rules) {
      try {
        const out = rule.run(ctx);
        if ('na' in out && typeof out.na === 'string') {
          const k = `${rule.id}|${out.na}`;
          const e = naMap.get(k) ?? { rule: rule.id, reason: out.na, rows: 0 };
          e.rows += 1; naMap.set(k, e);
          continue;
        }
        for (const [key, value] of Object.entries(out) as [FieldKey, Val | undefined][]) {
          if (value === undefined || value === null) continue;
          const col = F[key].col;
          const existing = row.data.get(col);
          if (isBlank(existing)) set(row, col, value, `rule: ${rule.id}`);
          else if (same(existing as Val, value, cfg.tolerance)) reconciledOk += 1;
          else if (cfg.overwrite) set(row, col, value, `rule: ${rule.id} (overwrite)`);
          else discrepancies.push({ row: row.rowNumber, employee: employeeLabel(row), col, field: `${colLetter(col)} ${headers[col - 1]}`, entered: existing as Val, computed: value, rule: rule.id });
        }
        if ((rule.id === 'pt.amount' || rule.id === 'lwf.amount') && cfg.allowUnverifiedTables) {
          const st = ctx.str('state');
          const e = rule.id === 'pt.amount' ? tables.pt[st] : tables.lwf[st];
          if (e && !e.verified) unverifiedUsed.add(`${rule.id === 'pt.amount' ? 'PT' : 'LWF'}: ${st}`);
        }
      } catch (e) {
        if (!(e instanceof Missing) && !(e instanceof Blocked)) throw e;
        // only a gap if something this rule would have produced is still blank
        if (!rule.produces.some((k) => isBlank(row.data.get(F[k].col)))) continue;
        const kind = e instanceof Missing ? 'missing' : 'blocked';
        const reason = e instanceof Missing ? `blank: ${e.items.join('; ')}` : e.reason;
        const key = `${rule.id}|${kind}|${reason}`;
        const g = gapMap.get(key) ?? { rule: rule.id, kind, reason, rows: 0, sample: [] };
        g.rows += 1; if (g.sample.length < 5) g.sample.push(employeeLabel(row));
        gapMap.set(key, g);
      }
    }
    sync(row);
  }

  // 7 ── validate
  const asOf = cfg.asOf ?? makeCtx(rows[0]?.data ?? new Map(), cfg, tables).asOf;
  const issues = validateRows(rows, asOf, headers);

  // 8 ── statistics
  const columns: ColumnStat[] = [];
  for (let c = 1; c <= headers.length; c += 1) {
    const after = rows.reduce((n, r) => n + (isBlank(r.data.get(c)) ? 0 : 1), 0);
    columns.push({
      col: c, letter: colLetter(c), section: sections[c - 1] ?? '', header: headers[c - 1] ?? '(no header)',
      filledBefore: beforeCount(c), filledAfter: after, blankAfter: rows.length - after, derivable: derivable.has(c),
    });
  }
  const acts: ActReadiness[] = ACTS.map((spec) => {
    const scope = spec.act.startsWith('Apprentices') ? rows.filter((r) => isYes(r.data.get(F.isApprentice.col))) : rows;
    const blank = new Map<string, number>();
    let ready = 0;
    for (const r of scope) {
      let ok = true;
      for (const req of spec.requirements) {
        if (req.anyOf.every((c) => isBlank(r.data.get(c)))) { ok = false; blank.set(req.label, (blank.get(req.label) ?? 0) + 1); }
      }
      if (ok) ready += 1;
    }
    return {
      act: spec.act, provisional: spec.provisional, applicableRows: scope.length, readyRows: ready,
      blockers: [...blank].map(([requirement, blankRows]) => ({ requirement, blankRows })).sort((a, b) => b.blankRows - a.blankRows),
    };
  });

  // 9 ── write back (only cells that changed; styles and other sheets untouched)
  const changed = new Map<string, Val>();
  for (const ch of changes) changed.set(`${ch.row}:${ch.col}`, rows.find((r) => r.rowNumber === ch.row)!.data.get(ch.col) ?? null);
  for (const [key, value] of changed) {
    const [r, c] = key.split(':').map(Number);
    const cell = ws.getCell(r, c);
    const type = inferType(c, headers[c - 1] ?? '');
    if (value instanceof Date) { cell.value = value; cell.numFmt = 'dd-mm-yyyy'; }
    else if (type === 'id') { cell.value = String(value); cell.numFmt = '@'; }
    else cell.value = value as ExcelJS.CellValue;
  }
  void originalRowNumbers;
  const masterBuffer = await workbookToBuffer(wb);

  return {
    masterBuffer, employees: rows.length, layout: { headerRow: HEADER_ROW, firstDataRow: FIRST_DATA_ROW, columns: headers.filter(Boolean).length }, changes, conflicts, discrepancies,
    gaps: [...gapMap.values()].sort((a, b) => b.rows - a.rows),
    notApplicable: [...naMap.values()], issues, columns, sources: sourceReports, acts,
    tablesUsedUnverified: [...unverifiedUsed], reconciledOk, config: cfg,
  };
}

export type { Rule };
export { FIELD_KEYS };
