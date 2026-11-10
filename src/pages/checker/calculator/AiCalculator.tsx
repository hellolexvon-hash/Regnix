import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import styles from './Calculator.module.css';
import type { Gender, PayrollRules } from './types';
import { parseRegisterFile, type RegisterTable, type Cell } from './engine/parseRegister';
import { analyze, key, type Finding } from './engine/patternEngine';
import LiveRegister from '@/components/dashboard/documentGenerator/LiveRegister';

interface Props { rules: PayrollRules; gender: Gender; month: number; }

const PAGE = 100;
const sigOf = (f: File) => `regnix:calc:marks:${f.name}:${f.size}`;
const loadAccepted = (f: File): string[] => { try { return JSON.parse(localStorage.getItem(sigOf(f)) ?? '[]'); } catch { return []; } };
const saveAccepted = (f: File, a: string[]) => { try { localStorage.setItem(sigOf(f), JSON.stringify(a)); } catch { /* storage unavailable */ } };

export function AiCalculator({ rules, gender, month }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [tables, setTables] = useState<RegisterTable[]>([]);
  const [sheet, setSheet] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tolerance, setTolerance] = useState(1);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [allCols, setAllCols] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [drag, setDrag] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onFile = useCallback(async (f: File) => {
    setBusy(true); setError(''); setEdits({}); setSelected(null); setLimit(PAGE);
    try {
      const t = await parseRegisterFile(f);
      if (!t.length) throw new Error('No rows found in this file.');
      setFile(f); setTables(t); setSheet(0); setAccepted(new Set(loadAccepted(f)));
    } catch (e) { setError(`Could not read the file: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { if (file) saveAccepted(file, [...accepted]); }, [accepted, file]);

  const base = tables[sheet];
  const table = useMemo<RegisterTable | null>(() => {
    if (!base) return null;
    const rows = base.rows.map((r) => [...r]);
    Object.entries(edits).forEach(([k, v]) => { const [r, c] = k.split(':').map(Number); if (rows[r]) rows[r][c] = v; });
    return { ...base, rows };
  }, [base, edits]);

  const analysis = useMemo(() => (table ? analyze(table, { rules, gender, month, tolerance }) : null), [table, rules, gender, month, tolerance]);

  const view = useMemo(() => {
    if (!analysis) return null;
    const byCell = new Map<string, Finding[]>();
    analysis.findings.forEach((f) => { const k = key(f.row, f.col); (byCell.get(k) ?? byCell.set(k, []).get(k)!).push(f); });
    const active = [...byCell.entries()].filter(([k]) => !accepted.has(k));
    const badKeys = new Set(active.map(([k]) => k));
    const badRows = new Set(active.map(([k]) => Number(k.split(':')[0])));
    return { byCell, badKeys, badRows, activeCount: active.length, acceptedCount: [...byCell.keys()].filter((k) => accepted.has(k)).length };
  }, [analysis, accepted]);

  const cols = useMemo(() => {
    if (!table || !analysis) return [];
    if (allCols) return table.headers.map((_, i) => i);
    const keep = new Set<number>();
    Object.values(analysis.roles).forEach((a) => a?.forEach((c) => keep.add(c)));
    analysis.checked.forEach((k) => keep.add(Number(k.split(':')[1])));
    analysis.findings.forEach((f) => keep.add(f.col));
    return table.headers.map((_, i) => i).filter((i) => keep.has(i));
  }, [table, analysis, allCols]);

  if (!file || !table || !analysis || !view) {
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>Upload a payroll / wage register</div>
        <div
          className={`${styles.drop} ${drag ? styles.dropOn : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void onFile(f); }}
          role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') input.current?.click(); }}
        >
          <strong>{busy ? 'Reading register…' : 'Drop your register here, or click to browse'}</strong>
          <span>.xlsx · .xls · .csv — header row is detected automatically. Rows are compared with each other and with {rules.state || 'state'} PF / ESIC / PT rules.</span>
        </div>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
        {error && <div className={styles.err} style={{ marginTop: 12 }}>{error}</div>}
      </div>
    );
  }

  const sel = selected ? view.byCell.get(selected) : undefined;
  const [selR, selC] = selected ? selected.split(':').map(Number) : [-1, -1];
  const shownRows = table.rows.map((_, i) => i).filter((i) => !onlyErrors || view.badRows.has(i));

  const accept = (k: string) => setAccepted((s) => new Set(s).add(k));
  const undo = (k: string) => { setAccepted((s) => { const n = new Set(s); n.delete(k); return n; }); setEdits((e) => { const n = { ...e }; delete n[k]; return n; }); };
  const useSuggested = (k: string, v: number) => setEdits((e) => ({ ...e, [k]: v }));
  const nextBad = () => { const arr = [...view.badKeys]; if (arr.length) setSelected(arr[(Math.max(0, arr.indexOf(selected ?? '')) + (selected ? 1 : 0)) % arr.length]); };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]), 'Corrected register');
    const fr = analysis.findings.map((f) => ({
      Row: f.row + 2, Column: table.headers[f.col], Rule: f.rule, Basis: f.basis, Found: f.actual ?? '', Expected: f.expected ?? '',
      Status: accepted.has(key(f.row, f.col)) ? 'Marked correct by user' : edits[key(f.row, f.col)] != null ? 'Corrected' : 'Open', Message: f.message,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fr), 'Findings');
    XLSX.writeFile(wb, `${file.name.replace(/\.[^.]+$/, '')}_pattern_check.xlsx`);
  };

  const cellClass = (i: number, c: number) => {
    const k = key(i, c);
    if (view.badKeys.has(k)) return styles.cBad;
    if (accepted.has(k) && view.byCell.has(k)) return styles.cAcc;
    if (edits[k] != null) return styles.cFix;
    return analysis.checked.has(k) ? styles.cOk : '';
  };

  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div>
            <strong style={{ fontSize: 14 }}>{file.name}</strong>
            <span className={styles.skip} style={{ marginLeft: 10 }}>{table.rows.length} rows · {table.headers.length} columns</span>
          </div>
          <div className={styles.inline} style={{ flexWrap: 'wrap' }}>
            {tables.length > 1 && (
              <select className={`${styles.select} ${styles.btnSm}`} style={{ width: 'auto' }} value={sheet} onChange={(e) => { setSheet(Number(e.target.value)); setEdits({}); setSelected(null); }}>
                {tables.map((t, i) => <option key={i} value={i}>{t.sheetName}</option>)}
              </select>
            )}
            <select className={`${styles.select} ${styles.btnSm}`} style={{ width: 'auto' }} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} title="Rounding tolerance">
              <option value={0}>Exact match</option><option value={1}>± ₹1</option><option value={5}>± ₹5</option>
            </select>
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setLiveOpen(true)}>Open in Live Register</button>
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={exportXlsx}>Export report</button>
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => { setFile(null); setTables([]); }}>New file</button>
          </div>
        </div>
      </div>

      <div className={styles.sumRow}>
        <div className={`${styles.sum} ${view.activeCount ? styles.sumBad : styles.sumOk}`}><span>Cells needing review</span><strong>{view.activeCount}</strong></div>
        <div className={`${styles.sum} ${styles.sumOk}`}><span>Cells checked OK</span><strong>{[...analysis.checked].filter((k) => !view.badKeys.has(k)).length}</strong></div>
        <div className={styles.sum}><span>Marked correct by you</span><strong>{view.acceptedCount}</strong></div>
        <div className={styles.sum}><span>Rows affected</span><strong>{view.badRows.size}</strong></div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Patterns found in this register</div>
        {analysis.patterns.length ? <div className={styles.pat}>{analysis.patterns.map((p) => <span key={p}>{p}</span>)}</div>
          : <div className={styles.empty}>No columns could be recognised. Check that the header row contains names like Basic, Gross, PF, ESIC, PT, Net Pay.</div>}
        {analysis.skipped.length > 0 && <div className={styles.skip}>Not checked: {analysis.skipped.join(' · ')}</div>}
      </div>

      <div className={styles.workspace}>
        <div className={styles.stack}>
          <div className={styles.toolbar}>
            <div className={styles.legend}>
              <span><i style={{ background: '#FEE2E2', boxShadow: 'inset 0 0 0 1.5px #F87171' }} />Mismatch</span>
              <span><i style={{ background: '#DCFCE7' }} />Matches pattern</span>
              <span><i style={{ background: '#DCFCE7', boxShadow: 'inset 0 0 0 1.5px #34D399' }} />Marked correct</span>
              <span><i style={{ background: '#DBEAFE' }} />Corrected</span>
            </div>
            <div className={styles.inline} style={{ flexWrap: 'wrap' }}>
              <label className={styles.check}><input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />Only rows with mismatches</label>
              <label className={styles.check}><input type="checkbox" checked={allCols} onChange={(e) => setAllCols(e.target.checked)} />All columns</label>
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={!view.badKeys.size} onClick={nextBad}>Next mismatch →</button>
            </div>
          </div>
          <div className={styles.gridWrap}>
            <table className={styles.grid}>
              <thead><tr><th>#</th>{cols.map((c) => <th key={c}>{table.headers[c]}</th>)}</tr></thead>
              <tbody>
                {shownRows.slice(0, limit).map((i) => (
                  <tr key={i}>
                    <td className={styles.rn}>{i + 1}</td>
                    {cols.map((c) => {
                      const k = key(i, c); const cl = cellClass(i, c);
                      const clickable = view.byCell.has(k);
                      return (
                        <td key={c} className={`${cl} ${selected === k ? styles.cSel : ''}`} onClick={clickable ? () => setSelected(k) : undefined} title={clickable ? view.byCell.get(k)![0].message : undefined}>
                          {table.rows[i][c] == null ? '' : String(table.rows[i][c])}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!shownRows.length && <tr><td colSpan={cols.length + 1} className={styles.empty} style={{ padding: 24 }}>No mismatches — every checked cell matches its pattern.</td></tr>}
              </tbody>
            </table>
          </div>
          {shownRows.length > limit && <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, shownRows.length - limit)} more rows</button>}
        </div>

        <aside className={styles.panel} aria-live="polite">
          {sel ? (
            <>
              <h4>{table.headers[selC]} · row {selR + 1}</h4>
              <div className={styles.kv}><span>Value</span><strong>{String(table.rows[selR][selC] ?? '(blank)')}</strong></div>
              {sel.map((f) => (
                <div key={f.id} className={styles.find}><small>{f.basis} · {f.rule}</small>{f.message}</div>
              ))}
              {(() => { const e = sel.find((f) => f.expected != null)?.expected ?? null; return e != null && !accepted.has(selected!) ? (
                <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => useSuggested(selected!, e)}>Use suggested value ({e})</button>) : null; })()}
              {accepted.has(selected!) || edits[selected!] != null
                ? <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => undo(selected!)}>Undo</button>
                : <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => accept(selected!)}>Mark as correct (system is wrong)</button>}
              <div className={styles.empty}>The checker can be wrong — for example a mid-period ESIC exemption or a state-specific slab. “Mark as correct” turns the cell green and remembers it for this file.</div>
            </>
          ) : (
            <>
              <h4>Mismatches ({view.activeCount})</h4>
              {view.activeCount === 0 && <div className={styles.empty}>Everything matches the register's own pattern and the statutory rules. 🎉</div>}
              <div className={styles.list}>
                {[...view.badKeys].slice(0, 40).map((k) => { const [r, c] = k.split(':').map(Number); return (
                  <button key={k} className={styles.listItem} onClick={() => setSelected(k)}><b>Row {r + 1}</b> · {table.headers[c]}<br />{view.byCell.get(k)![0].message}</button>
                ); })}
              </div>
              <div className={styles.empty}>Click any red cell to see why it was flagged and to fix or dismiss it.</div>
            </>
          )}
          {sel && <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setSelected(null)}>← All mismatches</button>}
        </aside>
      </div>

      <LiveRegister open={liveOpen} onClose={() => setLiveOpen(false)} uploadedFile={file} companyName="" />
    </div>
  );
}

export type { Cell };
