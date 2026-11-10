import * as XLSX from 'xlsx';

export type Cell = string | number | null;
export interface RegisterTable {
  sheetName: string;
  headers: string[];
  rows: Cell[][];
}

const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '' && Number.isNaN(Number(v));

/** Pick the header row: the first of the top 12 rows with the most distinct text cells. */
export function detectHeaderRow(raw: Cell[][]): number {
  let best = 0, bestScore = -1;
  for (let i = 0; i < Math.min(raw.length, 12); i += 1) {
    const row = raw[i] ?? [];
    const texts = row.filter(isText) as string[];
    const distinct = new Set(texts.map((t) => t.trim().toLowerCase())).size;
    const nonEmpty = row.filter((c) => c != null && c !== '').length;
    if (nonEmpty < 4) continue;
    const score = distinct - (nonEmpty - texts.length) * 0.5; // penalise rows that are mostly numbers
    if (score > bestScore + 1e-9) { best = i; bestScore = score; }
  }
  return best;
}

export function tableFromAoa(sheetName: string, raw: Cell[][]): RegisterTable {
  const h = detectHeaderRow(raw);
  const width = Math.max(...raw.slice(h).map((r) => r.length), 0);
  const seen = new Map<string, number>();
  const headers = Array.from({ length: width }, (_, i) => {
    const base = String(raw[h]?.[i] ?? '').replace(/\s+/g, ' ').trim() || `Col ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
  const rows = raw.slice(h + 1)
    .map((r) => headers.map((_, i) => (r[i] === undefined ? null : r[i])))
    .filter((r) => r.some((c) => c != null && String(c).trim() !== ''));
  // drop a trailing "Total" row
  while (rows.length && rows[rows.length - 1].some((c) => typeof c === 'string' && /^\s*(grand\s*)?total/i.test(c))) rows.pop();
  return { sheetName, headers, rows };
}

export async function parseRegisterFile(file: File): Promise<RegisterTable[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  return wb.SheetNames.map((name) => {
    const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, defval: null, raw: true });
    const norm: Cell[][] = aoa.map((r) => r.map((v) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'number' ? v : String(v))));
    return tableFromAoa(name, norm);
  }).filter((t) => t.rows.length > 0);
}
