/**
 * LiveRegister.tsx
 *
 * A standalone spreadsheet viewer / audit tool for Regnix.
 * Mounts via React Portal on document.body so it floats above everything.
 *
 * Features:
 *  — macOS window animations (spring open, shrink-to-dock close, minimize-to-dock)
 *  — Import: session file, local upload, or fetch from URL
 *  — Column chooser (show/hide any column)
 *  — Global search + per-column filter
 *  — Text highlight (yellow marker)
 *  — Click-to-sort any column (asc/desc)
 *  — Freeze N left columns (sticky)
 *  — Audit panel: blank-cell map, duplicate detector, numeric summary stats
 *  — Export filtered + visible columns to .xlsx
 *  — Multi-sheet tab bar
 *  — Status bar with live row/col counts
 */

import {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import { createPortal } from 'react-dom';
// Using standard xlsx library for spreadsheet operations
import * as XLSX from 'xlsx';
import lr from './LiveRegister.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SheetData {
  name:    string;
  headers: string[];
  rows:    (string | number | null)[][];
}

export interface LiveRegisterProps {
  open:          boolean;
  onClose:       () => void;
  uploadedFile:  File | null;
  selectedActs?: string[];
  companyName?:  string;
}

type WindowState = 'open' | 'closing' | 'minimizing' | 'closed';
type PanelTab    = 'filter' | 'audit' | 'columns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isGroupHeaderRow(row: (string | null)[]): boolean {
  // A "group header" row has most cells empty (due to merged cells) and the
  // non-empty ones are ALL-CAPS section titles like "PRIMARY IDENTIFICATION",
  // "EMPLOYMENT INFORMATION", etc. — not individual column names.
  const nonEmpty = row.filter(h => h != null && String(h).trim() !== '');
  if (!nonEmpty.length) return true;
  const total = row.length;
  // If >60% of cells are empty, it's likely a merged/group row
  const emptyRatio = 1 - nonEmpty.length / total;
  if (emptyRatio > 0.6) return true;
  // If ALL non-empty cells are fully uppercased phrases (section titles)
  const allCaps = nonEmpty.every(h => {
    const s = String(h).trim();
    return s === s.toUpperCase() && s.length > 2;
  });
  if (allCaps) return true;
  return false;
}

function isGenericHeaderRow(row: (string | null)[]): boolean {
  // Detect rows where most columns are like "COL 1", "COL_1", "COL1", "Column 1", "#"
  const nonEmpty = row.filter(h => h != null && String(h).trim() !== '');
  if (!nonEmpty.length) return true;
  const genericPattern = /^(col[\s_]?\d+|column[\s_]?\d+|#)$/i;
  const genericCount = nonEmpty.filter(h => genericPattern.test(String(h).trim())).length;
  return genericCount / nonEmpty.length > 0.5;
}

function parseFile(file: File): Promise<SheetData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(e.target!.result, { type: 'array', cellDates: true });
        const out = wb.SheetNames.map(name => {
          const ws  = wb.Sheets[name];
          const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
          if (!raw.length) return { name, headers: [], rows: [] };

          // Scan first 6 rows to find the real header row:
          // skip group-header rows (merged section titles) and generic COL_N rows
          let headerRowIdx = 0;
          for (let i = 0; i < Math.min(raw.length, 6); i++) {
            const row = (raw[i] as any[]).map((h: any) => (h == null ? null : String(h)));
            if (isGroupHeaderRow(row) || isGenericHeaderRow(row)) {
              headerRowIdx = i + 1; // this row is a section title / generic — keep going
            } else {
              headerRowIdx = i;
              break;
            }
          }
          if (headerRowIdx >= raw.length) headerRowIdx = 0;

          const rawHeaders = (raw[headerRowIdx] as any[]).map((h: any) => (h == null ? '' : String(h)));

          // Deduplicate headers that appear multiple times (keep first, suffix others)
          const seen = new Map<string, number>();
          const headers = rawHeaders.map(h => {
            const base = h.trim() || '';
            if (!base) return base;
            const count = seen.get(base) ?? 0;
            seen.set(base, count + 1);
            return count === 0 ? base : `${base} (${count + 1})`;
          });

          const rows = raw.slice(headerRowIdx + 1).map((r: any[]) =>
            headers.map((_, i) => {
              const v = (r as any[])[i];
              if (v == null)         return null;
              if (v instanceof Date) return v.toLocaleDateString('en-IN');
              return typeof v === 'number' ? v : String(v);
            }),
          ).filter(row => row.some(c => c != null && c !== '')); // skip fully empty rows

          return { name, headers, rows };
        });
        resolve(out);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(file);
  });
}

function hl(text: string | number | null, q: string): React.ReactNode {
  const s   = text == null ? '' : String(text);
  const low = s.toLowerCase();
  const qlc = q.toLowerCase();
  if (!qlc || !low.includes(qlc)) return s || null;
  const i   = low.indexOf(qlc);
  return (
    <>
      {s.slice(0, i)}
      <mark className={lr.mark}>{s.slice(i, i + qlc.length)}</mark>
      {s.slice(i + qlc.length)}
    </>
  );
}

// ─── Minimized dock bubble ────────────────────────────────────────────────────

function MiniBubble({ onClick }: { onClick: () => void }) {
  return (
    <div className={lr.miniBubble} onClick={onClick} title="Restore Live Register">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      <span>Live Register</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LiveRegister({
  open,
  onClose,
  uploadedFile,
  selectedActs = [],
  companyName  = '',
}: LiveRegisterProps) {

  // ── Window state ────────────────────────────────────────────────────────────
  const [winState,    setWinState]    = useState<WindowState>('closed');
  const [minimized,   setMinimized]   = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [sheets,      setSheets]      = useState<SheetData[]>([]);
  const [activeIdx,   setActiveIdx]   = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [loadErr,     setLoadErr]     = useState('');

  // ── Import modal ────────────────────────────────────────────────────────────
  const [importOpen,  setImportOpen]  = useState(false);
  const [fetchUrl,    setFetchUrl]    = useState('');
  const [fetchLoading,setFetchLoad]   = useState(false);
  const [fetchErr,    setFetchErr]    = useState('');
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // ── Toolbar ─────────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [hlQuery,     setHlQuery]     = useState('');
  const [filterCol,   setFilterCol]   = useState<number | null>(null);
  const [filterVal,   setFilterVal]   = useState('');
  const [sortCol,     setSortCol]     = useState<number | null>(null);
  const [sortDir,     setSortDir]     = useState<'asc'|'desc'>('asc');
  const [frozenCols,  setFrozenCols]  = useState(2);
  const [panelTab,    setPanelTab]    = useState<PanelTab>('filter');
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [searchMode,  setSearchMode]  = useState<'table'|'card'>('table');

  // ── Column chooser ──────────────────────────────────────────────────────────
  const [visColSet,   setVisColSet]   = useState<Set<number>>(new Set());

  // ── Audit ───────────────────────────────────────────────────────────────────
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const tableWrapRef = useRef<HTMLDivElement>(null);

  // ── Window open / close animation ──────────────────────────────────────────
  useEffect(() => {
    if (open && !minimized) {
      setWinState('open');
    } else if (!open && winState !== 'closed') {
      setWinState('closing');
      const t = setTimeout(() => setWinState('closed'), 380);
      return () => clearTimeout(t);
    }
  }, [open, minimized]);

  // ── Auto-load uploaded file ─────────────────────────────────────────────────
  useEffect(() => {
    if (uploadedFile && open) load(uploadedFile);
  }, [uploadedFile, open]);

  // ── Reset visible cols when sheet changes ───────────────────────────────────
  const sheet = sheets[activeIdx];
  useEffect(() => {
    if (sheet) setVisColSet(new Set(sheet.headers.map((_, i) => i)));
  }, [activeIdx, sheets]);

  // ── Load file ───────────────────────────────────────────────────────────────
  const load = useCallback(async (file: File) => {
    setLoading(true);
    setLoadErr('');
    setImportOpen(false);
    try {
      const parsed = await parseFile(file);
      setSheets(parsed);
      setActiveIdx(0);
      setSearch(''); setFilterCol(null); setFilterVal('');
      setSortCol(null); setSelectedRows(new Set());
    } catch (e: any) {
      setLoadErr('Could not parse file: ' + (e?.message ?? 'unknown'));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch from URL ──────────────────────────────────────────────────────────
  const fetchFromUrl = async () => {
    const url = fetchUrl.trim();
    if (!url) return;
    setFetchLoad(true);
    setFetchErr('');
    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ab   = await res.arrayBuffer();
      const ext  = url.split('?')[0].split('.').pop()?.toLowerCase() ?? 'xlsx';
      const file = new File([ab], `fetched.${ext}`, { type: 'application/octet-stream' });
      await load(file);
      setFetchUrl('');
    } catch (e: any) {
      setFetchErr(e?.message ?? 'Network error');
    } finally {
      setFetchLoad(false);
    }
  };

  // ── Visible rows ────────────────────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    if (!sheet) return [];
    let rows = sheet.rows;
    const q  = search.trim().toLowerCase();
    if (q) {
      // Split on whitespace — all terms must match somewhere in the row
      const terms = q.split(/\s+/).filter(Boolean);
      rows = rows.filter(r => {
        const rowText = r.map(c => (c == null ? '' : String(c).toLowerCase())).join(' ');
        return terms.every(t => rowText.includes(t));
      });
    }
    if (filterCol != null && filterVal.trim()) {
      const fv = filterVal.trim().toLowerCase();
      rows = rows.filter(r => String(r[filterCol] ?? '').toLowerCase().includes(fv));
    }
    if (sortCol != null) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
        const n  = typeof av === 'number' && typeof bv === 'number'
          ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? n : -n;
      });
    }
    return rows;
  }, [sheet, search, filterCol, filterVal, sortCol, sortDir]);

  // ── Column indices to show ───────────────────────────────────────────────────
  const shownCols = useMemo(
    () => sheet ? sheet.headers.map((_, i) => i).filter(i => visColSet.has(i)) : [],
    [sheet, visColSet],
  );

  // ── Audit computations ───────────────────────────────────────────────────────
  const auditData = useMemo(() => {
    if (!sheet || !visibleRows.length) return null;

    // Blank cells per column
    const blanks = shownCols.map(ci => ({
      col:   sheet.headers[ci] || `Col ${ci + 1}`,
      count: visibleRows.filter(r => r[ci] == null || r[ci] === '').length,
    })).filter(x => x.count > 0).sort((a, b) => b.count - a.count);

    // Duplicates on first visible col
    const firstCi = shownCols[0] ?? 0;
    const dupMap  = new Map<string, number>();
    visibleRows.forEach(r => {
      const v = String(r[firstCi] ?? '');
      dupMap.set(v, (dupMap.get(v) ?? 0) + 1);
    });
    const duplicates = [...dupMap.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Numeric summary per shown col
    const numericSummary = shownCols.map(ci => {
      const vals = visibleRows.map(r => r[ci]).filter(v => typeof v === 'number') as number[];
      if (!vals.length) return null;
      const sum  = vals.reduce((a, b) => a + b, 0);
      const min  = Math.min(...vals);
      const max  = Math.max(...vals);
      const avg  = sum / vals.length;
      return { col: sheet.headers[ci] || `Col ${ci + 1}`, sum, min, max, avg, count: vals.length };
    }).filter(Boolean) as { col: string; sum: number; min: number; max: number; avg: number; count: number }[];

    return { blanks, duplicates, numericSummary };
  }, [sheet, visibleRows, shownCols]);

  // ── Sort toggle ──────────────────────────────────────────────────────────────
  const toggleSort = (ci: number) => {
    if (sortCol === ci) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(ci); setSortDir('asc'); }
  };

  // ── Export — fully styled Regnix-branded xlsx (browser-only, xlsx-js-style) ──
  const exportData = () => {
    if (!sheet) return;
    const exportRows = selectedRows.size > 0
      ? visibleRows.filter((_, i) => selectedRows.has(i))
      : visibleRows;

    const headers  = shownCols.map(i => sheet.headers[i] || `Col ${i + 1}`);
    const dataRows = exportRows.map(r => shownCols.map(i => r[i] ?? ''));
    const stamp    = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const company  = companyName || 'Regnix';
    const filename = `${company.replace(/\s+/g, '_')}_${sheet.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // ── Style helpers ──────────────────────────────────────────────────────────
    const S = {
      // Brand bar: deep purple bg, white bold 13pt
      brand: {
        font:      { name: 'Calibri', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { patternType: 'solid', fgColor: { rgb: '5B21B6' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border:    {},
      },
      // Column header: medium purple bg, white bold 9pt, wrap, centre
      colHeader: {
        font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { patternType: 'solid', fgColor: { rgb: '7C3AED' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top:    { style: 'thin', color: { rgb: 'A78BFA' } },
          bottom: { style: 'medium', color: { rgb: 'A78BFA' } },
          left:   { style: 'thin', color: { rgb: 'A78BFA' } },
          right:  { style: 'thin', color: { rgb: 'A78BFA' } },
        },
      },
      // Alternating data row fills
      dataEven: (isNum: boolean) => ({
        font:      { name: 'Calibri', sz: 9, color: { rgb: '0F0A1E' } },
        fill:      { patternType: 'solid', fgColor: { rgb: 'F5F3FF' } },
        alignment: { horizontal: isNum ? 'right' : 'left', vertical: 'center' },
        border: {
          bottom: { style: 'thin', color: { rgb: 'E5E2F0' } },
          right:  { style: 'thin', color: { rgb: 'E5E2F0' } },
        },
      }),
      dataOdd: (isNum: boolean) => ({
        font:      { name: 'Calibri', sz: 9, color: { rgb: '0F0A1E' } },
        fill:      { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        alignment: { horizontal: isNum ? 'right' : 'left', vertical: 'center' },
        border: {
          bottom: { style: 'thin', color: { rgb: 'E5E2F0' } },
          right:  { style: 'thin', color: { rgb: 'E5E2F0' } },
        },
      }),
      // Meta sheet styles
      metaTitle: {
        font:      { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { patternType: 'solid', fgColor: { rgb: '5B21B6' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border:    {},
      },
      metaKey: {
        font:      { name: 'Calibri', sz: 10, bold: true, color: { rgb: '4A4468' } },
        fill:      { patternType: 'solid', fgColor: { rgb: 'F5F3FF' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border:    { bottom: { style: 'thin', color: { rgb: 'E5E2F0' } } },
      },
      metaVal: {
        font:      { name: 'Calibri', sz: 10, color: { rgb: '0F0A1E' } },
        fill:      { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border:    { bottom: { style: 'thin', color: { rgb: 'E5E2F0' } } },
      },
    };

    // ── Build worksheet as array-of-arrays, then apply styles cell-by-cell ──
    const numCols = headers.length;

    // We'll build the ws manually for full style control
    const ws: any = {};
    let maxRow = 0;

    const setCell = (r: number, c: number, value: any, style: any, type?: string) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const t = type ?? (typeof value === 'number' ? 'n' : 's');
      ws[addr] = { v: value ?? '', t, s: style };
      if (r > maxRow) maxRow = r;
    };

    // ── Row 0: Brand bar ──────────────────────────────────────────────────────
    const brandText = `${company}  ·  ${sheet.name}  ·  Exported ${stamp}  ·  ${dataRows.length} records  ·  ${headers.length} columns`;
    for (let c = 0; c < numCols; c++) {
      setCell(0, c, c === 0 ? brandText : '', S.brand, 's');
    }

    // ── Row 1: Column headers ─────────────────────────────────────────────────
    for (let c = 0; c < numCols; c++) {
      setCell(1, c, headers[c], S.colHeader, 's');
    }

    // ── Rows 2+: Data ─────────────────────────────────────────────────────────
    for (let ri = 0; ri < dataRows.length; ri++) {
      const rowData = dataRows[ri];
      const styleFn = ri % 2 === 0 ? S.dataEven : S.dataOdd;
      for (let c = 0; c < numCols; c++) {
        const raw   = rowData[c];
        const isNum = typeof raw === 'number';
        const val   = raw === null || raw === undefined ? '' : raw;
        setCell(ri + 2, c, val, styleFn(isNum), isNum ? 'n' : 's');
      }
    }

    // ── Worksheet metadata ────────────────────────────────────────────────────
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: numCols - 1 } });

    // Merge brand row across all columns
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }];

    // Column widths — auto-fit based on header + first 100 rows
    ws['!cols'] = headers.map((h, ci) => {
      const maxLen = Math.max(
        String(h).length,
        ...dataRows.slice(0, 100).map(r => String(r[ci] ?? '').length),
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });

    // Row heights
    ws['!rows'] = [
      { hpt: 30 },  // brand bar
      { hpt: 45 },  // col headers (tall for wrap)
      ...dataRows.map(() => ({ hpt: 18 })),
    ];

    // Freeze top 2 rows (brand + headers stay fixed while scrolling)
    ws['!freeze'] = { xSplit: 0, ySplit: 2 };

    // Auto-filter on header row
    ws['!autofilter'] = { ref: `A2:${XLSX.utils.encode_col(numCols - 1)}2` };

    // ── Build Export Info sheet ───────────────────────────────────────────────
    const wsInfo: any = {};
    const metaData = [
      ['Regnix Export Info', ''],
      ['Company',       company],
      ['Register',      sheet.name],
      ['Exported On',   stamp],
      ['Total Records', dataRows.length],
      ['Columns',       headers.length],
      ['Filter',        search ? `Search: "${search}"` : filterCol != null ? `Column filter active` : 'None'],
      ['Selected Only', selectedRows.size > 0 ? `Yes (${selectedRows.size} rows)` : 'No — all visible rows'],
    ];
    metaData.forEach(([k, v], ri) => {
      const sKey = ri === 0 ? S.metaTitle : S.metaKey;
      const sVal = ri === 0 ? S.metaTitle : S.metaVal;
      wsInfo[XLSX.utils.encode_cell({ r: ri, c: 0 })] = { v: k, t: 's', s: sKey };
      wsInfo[XLSX.utils.encode_cell({ r: ri, c: 1 })] = { v: typeof v === 'number' ? v : String(v), t: typeof v === 'number' ? 'n' : 's', s: sVal };
    });
    wsInfo['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: metaData.length - 1, c: 1 } });
    wsInfo['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    wsInfo['!cols']   = [{ wch: 22 }, { wch: 44 }];
    wsInfo['!rows']   = [{ hpt: 28 }, ...metaData.slice(1).map(() => ({ hpt: 20 }))];

    // ── Assemble workbook ─────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Export Info');
    XLSX.writeFile(wb, filename);
  };

  // ── Row select ───────────────────────────────────────────────────────────────
  const toggleRow = (i: number) => {
    setSelectedRows(prev => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };
  const selectAll = () => {
    if (selectedRows.size === visibleRows.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(visibleRows.map((_, i) => i)));
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    setWinState('closing');
    setTimeout(onClose, 360);
  };

  const handleMinimize = () => {
    setWinState('minimizing');
    setTimeout(() => { setMinimized(true); setWinState('closed'); }, 340);
  };

  const handleRestore = () => {
    setMinimized(false);
    setWinState('open');
  };

  // ── Render guards ────────────────────────────────────────────────────────────
  if (typeof document === 'undefined') return null;
  if (winState === 'closed' && !minimized) return null;

  const num = (n: number) =>
    n >= 1_00_000
      ? (n / 1_00_000).toFixed(1) + ' L'
      : n >= 1000
        ? (n / 1000).toFixed(1) + 'K'
        : String(Math.round(n * 100) / 100);

  const windowClass = [
    lr.window,
    winState === 'open'      ? lr.windowOpen      : '',
    winState === 'closing'   ? lr.windowClosing   : '',
    winState === 'minimizing'? lr.windowMinimizing: '',
  ].filter(Boolean).join(' ');

  return createPortal(
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      {winState !== 'closed' && (
        <div
          className={`${lr.backdrop} ${winState === 'open' ? lr.backdropIn : lr.backdropOut}`}
          onClick={handleClose}
        />
      )}

      {/* ── Main window ──────────────────────────────────────────────────── */}
      {winState !== 'closed' && (
        <div className={windowClass}>

          {/* ── Title bar ─────────────────────────────────────────────── */}
          <div className={lr.titleBar}>
            <div className={lr.trafficLights}>
              <button className={`${lr.tl} ${lr.tlClose}`}  onClick={handleClose}    aria-label="Close" />
              <button className={`${lr.tl} ${lr.tlMin}`}    onClick={handleMinimize} aria-label="Minimise" />
              <button className={`${lr.tl} ${lr.tlMax}`}    aria-label="Zoom" />
            </div>

            <div className={lr.titleCenter}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="2.2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
              <span className={lr.titleText}>Live Register</span>
              {companyName && <span className={lr.titleCompany}>{companyName}</span>}
              {sheet && <span className={lr.titleSheet}>{sheet.name}</span>}
            </div>

            <div className={lr.titleActions}>
              {sheets.length > 0 && (
                <>
                  {selectedRows.size > 0 && (
                    <span className={lr.selBadge}>{selectedRows.size} selected</span>
                  )}
                  <button className={lr.tbBtn} onClick={() => { setPanelTab('columns'); setPanelOpen(v => !v); }} title="Columns">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                    Cols
                  </button>
                  <button className={lr.tbBtn} onClick={() => { setPanelTab('audit'); setPanelOpen(v => !v); }} title="Audit panel">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                    </svg>
                    Audit
                  </button>
                  <button className={lr.tbBtn} onClick={exportData} title="Export to Excel">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Export
                  </button>
                </>
              )}
              <button className={`${lr.tbBtn} ${lr.tbBtnAccent}`} onClick={() => setImportOpen(true)} title="Import data">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Import
              </button>
              <input
                ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) load(e.target.files[0]); e.target.value = ''; }}
              />
            </div>
          </div>

          {/* ── Search + filter toolbar ────────────────────────────────── */}
          <div className={lr.toolbar}>
            {/* Search */}
            <div className={lr.searchBox}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6880" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className={lr.searchInput} placeholder="Search… (use spaces for multiple terms)"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <>
                  <span className={lr.searchCount}>{visibleRows.length} result{visibleRows.length !== 1 ? 's' : ''}</span>
                  <button className={lr.clearBtn} onClick={() => setSearch('')}>✕</button>
                </>
              )}
            </div>

            {/* View mode toggle — only when searching */}
            {search && (
              <div className={lr.viewToggle}>
                <button
                  className={`${lr.viewToggleBtn} ${searchMode === 'table' ? lr.viewToggleBtnActive : ''}`}
                  onClick={() => setSearchMode('table')} title="Table view">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
                  </svg>
                </button>
                <button
                  className={`${lr.viewToggleBtn} ${searchMode === 'card' ? lr.viewToggleBtnActive : ''}`}
                  onClick={() => setSearchMode('card')} title="Card view — easier to verify details">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
                    <rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Highlight */}
            <div className={lr.searchBox}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <input className={lr.searchInput} placeholder="Highlight…"
                value={hlQuery} onChange={e => setHlQuery(e.target.value)} />
              {hlQuery && <button className={lr.clearBtn} onClick={() => setHlQuery('')}>✕</button>}
            </div>

            {/* Column filter */}
            {sheet && (
              <div className={lr.filterGroup}>
                <select className={lr.filterSel}
                  value={filterCol ?? ''}
                  onChange={e => setFilterCol(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">Filter col…</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Col ${i + 1}`}</option>
                  ))}
                </select>
                <input className={lr.filterInput} placeholder="= value"
                  disabled={filterCol == null}
                  value={filterVal} onChange={e => setFilterVal(e.target.value)} />
                {(filterCol != null || filterVal) && (
                  <button className={lr.clearBtn} onClick={() => { setFilterCol(null); setFilterVal(''); }}>✕</button>
                )}
              </div>
            )}

            {/* Freeze */}
            <div className={lr.freezeGroup}>
              <span className={lr.freezeLabel}>Freeze</span>
              <button className={lr.freezeBtn} onClick={() => setFrozenCols(f => Math.max(0, f - 1))}>−</button>
              <span className={lr.freezeVal}>{frozenCols}</span>
              <button className={lr.freezeBtn} onClick={() => setFrozenCols(f => Math.min(shownCols.length, f + 1))}>+</button>
            </div>

            {/* Active sort chip */}
            {sortCol != null && sheet && (
              <div className={lr.sortChip}>
                {sortDir === 'asc' ? '↑' : '↓'} {sheet.headers[sortCol] || `Col ${sortCol + 1}`}
                <button className={lr.clearBtn} onClick={() => setSortCol(null)}>✕</button>
              </div>
            )}

            {/* Stats */}
            <div className={lr.statsRow}>
              <span className={lr.statPill}>{visibleRows.length}/{sheet?.rows.length ?? 0} rows</span>
              <span className={lr.statPill}>{shownCols.length}/{sheet?.headers.length ?? 0} cols</span>
              {auditData && auditData.blanks.length > 0 && (
                <span className={`${lr.statPill} ${lr.statWarn}`}>
                  ⚠ {auditData.blanks.reduce((n, b) => n + b.count, 0)} blanks
                </span>
              )}
            </div>
          </div>

          {/* ── Side panel (Columns / Audit / Filter) ─────────────────── */}
          <div className={`${lr.main} ${panelOpen ? lr.mainWithPanel : ''}`}>

            {/* ── TABLE AREA ──────────────────────────────────────────── */}
            <div className={lr.tableArea}>

              {/* Sheet tabs */}
              {sheets.length > 1 && (
                <div className={lr.sheetTabs}>
                  {sheets.map((s, i) => (
                    <button key={i}
                      className={`${lr.sheetTab} ${i === activeIdx ? lr.sheetTabActive : ''}`}
                      onClick={() => { setActiveIdx(i); setSearch(''); setFilterCol(null); setFilterVal(''); setSortCol(null); setSelectedRows(new Set()); }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                      </svg>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className={lr.loadingState}>
                  <div className={lr.spinner} />
                  <span>Parsing workbook…</span>
                </div>
              )}

              {/* Empty state */}
              {!loading && sheets.length === 0 && (
                <div className={lr.emptyState}>
                  <div className={lr.emptyIcon}>
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#3D3A52" strokeWidth="1.2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M3 9h18M9 21V9"/>
                    </svg>
                  </div>
                  <h3 className={lr.emptyTitle}>No data loaded</h3>
                  <p className={lr.emptySub}>
                    {selectedActs.length > 0
                      ? `You selected ${selectedActs.length} act${selectedActs.length !== 1 ? 's' : ''}. Upload your Master Register in Step 4 — it loads here automatically.`
                      : 'Import an .xlsx, .xls, or .csv file to start auditing.'}
                  </p>
                  {loadErr && <p className={lr.emptyErr}>{loadErr}</p>}
                  <button className={lr.emptyImportBtn} onClick={() => setImportOpen(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      <path d="M5 17H19"/>
                    </svg>
                    Import Register
                  </button>
                </div>
              )}

              {/* Table */}
              {!loading && sheet && searchMode === 'table' && (
                <div className={lr.tableWrap} ref={tableWrapRef}>
                  <table className={lr.table}>
                    <thead>
                      <tr>
                        {/* Row num / select-all */}
                        <th className={`${lr.th} ${lr.thRow}`} onClick={selectAll}
                          title="Click to select all">
                          {selectedRows.size === visibleRows.length && visibleRows.length > 0 ? '☑' : '#'}
                        </th>
                        {shownCols.map((ci, di) => (
                          <th key={ci}
                            className={`${lr.th} ${di < frozenCols ? lr.thFrozen : ''}`}
                            style={di < frozenCols ? { left: 44 + di * 130 } : undefined}
                            onClick={() => toggleSort(ci)}>
                            <span className={lr.thInner}>
                              <span className={lr.thLabel}>{sheet.headers[ci] || <em className={lr.thEmpty}>Col {ci + 1}</em>}</span>
                              <span className={lr.sortIcon}>
                                {sortCol === ci ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                              </span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.length === 0 ? (
                        <tr>
                          <td colSpan={shownCols.length + 1} className={lr.noRows}>
                            No rows match your search / filter
                          </td>
                        </tr>
                      ) : (
                        visibleRows.map((row, ri) => {
                          const isSel = selectedRows.has(ri);
                          return (
                            <tr key={ri}
                              className={`${ri % 2 ? lr.rowOdd : lr.rowEven} ${isSel ? lr.rowSelected : ''}`}
                              onClick={() => toggleRow(ri)}>
                              <td className={`${lr.td} ${lr.tdRow}`}>{ri + 1}</td>
                              {shownCols.map((ci, di) => {
                                const cell = row[ci];
                                const blank = cell == null || cell === '';
                                return (
                                  <td key={ci}
                                    className={`${lr.td} ${di < frozenCols ? lr.tdFrozen : ''} ${blank ? lr.tdBlank : ''}`}
                                    style={di < frozenCols ? { left: 44 + di * 130 } : undefined}
                                    title={blank ? '(empty)' : String(cell)}>
                                    {hlQuery ? hl(cell, hlQuery) : (blank ? null : String(cell))}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Card view — for easy person/record verification */}
              {!loading && sheet && searchMode === 'card' && (
                <div className={lr.cardGrid}>
                  {visibleRows.length === 0 ? (
                    <div className={lr.noRows} style={{ gridColumn: '1/-1', textAlign:'center', padding:40 }}>
                      No rows match your search
                    </div>
                  ) : visibleRows.map((row, ri) => {
                    const isSel = selectedRows.has(ri);
                    // Pick a display name from common identifier columns
                    const nameIdx  = shownCols.find(ci => /name|employee|worker|person/i.test(sheet.headers[ci] ?? '')) ?? shownCols[1] ?? shownCols[0];
                    const idIdx    = shownCols.find(ci => /\bno\.?\b|id\b|sl\.?\s*no|serial|reg/i.test(sheet.headers[ci] ?? '')) ?? shownCols[0];
                    const dispName = row[nameIdx] ?? row[idIdx] ?? `Record ${ri + 1}`;
                    const dispId   = nameIdx !== idIdx ? row[idIdx] : null;
                    const terms    = search.trim().toLowerCase().split(/\s+/).filter(Boolean);

                    return (
                      <div key={ri}
                        className={`${lr.personCard} ${isSel ? lr.personCardSel : ''}`}
                        onClick={() => toggleRow(ri)}>
                        {/* Card header */}
                        <div className={lr.personCardHead}>
                          <div className={lr.personAvatar}>
                            {String(dispName).charAt(0).toUpperCase() || '#'}
                          </div>
                          <div className={lr.personCardMeta}>
                            <div className={lr.personName}>{hl(dispName, search)}</div>
                            {dispId != null && <div className={lr.personId}>{String(dispId)}</div>}
                          </div>
                          <div className={lr.personCardRow}>#{ri + 1}</div>
                          {isSel && <div className={lr.personCheckBadge}>✓</div>}
                        </div>
                        {/* Card fields — show all non-empty shown cols */}
                        <div className={lr.personFields}>
                          {shownCols
                            .filter(ci => ci !== nameIdx && ci !== idIdx)
                            .map(ci => {
                              const val = row[ci];
                              if (val == null || val === '') return null;
                              const header = sheet.headers[ci] || `Col ${ci + 1}`;
                              const isMatch = terms.some(t => String(val).toLowerCase().includes(t));
                              return (
                                <div key={ci} className={`${lr.personField} ${isMatch ? lr.personFieldMatch : ''}`}>
                                  <span className={lr.personFieldLabel}>{header}</span>
                                  <span className={lr.personFieldVal}>{hl(val, search)}</span>
                                </div>
                              );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── SIDE PANEL ──────────────────────────────────────────── */}
            {panelOpen && (
              <div className={lr.sidePanel}>
                {/* Panel tab bar */}
                <div className={lr.panelTabs}>
                  {(['filter', 'columns', 'audit'] as PanelTab[]).map(t => (
                    <button key={t}
                      className={`${lr.panelTab} ${panelTab === t ? lr.panelTabActive : ''}`}
                      onClick={() => setPanelTab(t)}>
                      {t === 'filter'  ? '🔽 Filter'  : ''}
                      {t === 'columns' ? '⊞ Columns' : ''}
                      {t === 'audit'   ? '🔍 Audit'  : ''}
                    </button>
                  ))}
                  <button className={lr.panelClose} onClick={() => setPanelOpen(false)}>✕</button>
                </div>

                {/* ─ Filter tab ─ */}
                {panelTab === 'filter' && sheet && (
                  <div className={lr.panelBody}>
                    <div className={lr.panelSection}>Filter by Column</div>
                    {sheet.headers.map((h, ci) => {
                      const unique = [...new Set(sheet.rows.map(r => String(r[ci] ?? '')))].filter(Boolean).sort().slice(0, 60);
                      return (
                        <div key={ci} className={lr.panelFilterCol}>
                          <div className={lr.panelFilterLabel}>{h || `Col ${ci + 1}`}</div>
                          <select className={lr.panelFilterSel}
                            value={filterCol === ci ? filterVal : ''}
                            onChange={e => {
                              setFilterCol(ci);
                              setFilterVal(e.target.value);
                            }}>
                            <option value="">All</option>
                            {unique.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ─ Columns tab ─ */}
                {panelTab === 'columns' && sheet && (
                  <div className={lr.panelBody}>
                    <div className={lr.panelSection}>
                      Show / Hide Columns
                      <div style={{ display:'flex', gap:6 }}>
                        <button className={lr.colAllBtn}
                          onClick={() => setVisColSet(new Set(sheet.headers.map((_, i) => i)))}>All</button>
                        <button className={lr.colAllBtn}
                          onClick={() => setVisColSet(new Set())}>None</button>
                      </div>
                    </div>
                    {sheet.headers.map((h, ci) => (
                      <label key={ci} className={lr.colRow}>
                        <input type="checkbox" className={lr.colCheck}
                          checked={visColSet.has(ci)}
                          onChange={() => setVisColSet(prev => {
                            const n = new Set(prev);
                            n.has(ci) ? n.delete(ci) : n.add(ci);
                            return n;
                          })} />
                        <span className={lr.colName}>{h || <em>Col {ci + 1}</em>}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* ─ Audit tab ─ */}
                {panelTab === 'audit' && (
                  <div className={lr.panelBody}>
                    {!auditData ? (
                      <div className={lr.panelEmpty}>Load data to run audit</div>
                    ) : (
                      <>
                        {/* Blank cells */}
                        <div className={lr.panelSection}>Blank Cells by Column</div>
                        {auditData.blanks.length === 0 ? (
                          <div className={lr.auditOk}>✓ No blank cells found</div>
                        ) : auditData.blanks.map((b, i) => (
                          <div key={i} className={lr.auditRow}>
                            <span className={lr.auditCol}>{b.col}</span>
                            <div className={lr.auditBar}>
                              <div className={lr.auditBarFill}
                                style={{ width: `${Math.min(100, b.count / visibleRows.length * 100)}%` }} />
                            </div>
                            <span className={lr.auditCount}>{b.count}</span>
                          </div>
                        ))}

                        {/* Duplicates */}
                        {auditData.duplicates.length > 0 && (
                          <>
                            <div className={lr.panelSection} style={{ marginTop:14 }}>
                              Duplicate Values ({sheet?.headers[shownCols[0]] || 'Col 1'})
                            </div>
                            {auditData.duplicates.map(([val, cnt], i) => (
                              <div key={i} className={lr.auditRow}>
                                <span className={lr.auditCol} title={val}>{val || '(empty)'}</span>
                                <span className={`${lr.auditCount} ${lr.auditDup}`}>×{cnt}</span>
                              </div>
                            ))}
                          </>
                        )}

                        {/* Numeric summary */}
                        {auditData.numericSummary.length > 0 && (
                          <>
                            <div className={lr.panelSection} style={{ marginTop:14 }}>Numeric Summary</div>
                            {auditData.numericSummary.map((s, i) => (
                              <div key={i} className={lr.auditNumBlock}>
                                <div className={lr.auditNumCol}>{s.col}</div>
                                <div className={lr.auditNumGrid}>
                                  <div className={lr.auditNumStat}><span>SUM</span><strong>{num(s.sum)}</strong></div>
                                  <div className={lr.auditNumStat}><span>AVG</span><strong>{num(s.avg)}</strong></div>
                                  <div className={lr.auditNumStat}><span>MIN</span><strong>{num(s.min)}</strong></div>
                                  <div className={lr.auditNumStat}><span>MAX</span><strong>{num(s.max)}</strong></div>
                                  <div className={lr.auditNumStat}><span>COUNT</span><strong>{s.count}</strong></div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Status bar ────────────────────────────────────────────── */}
          <div className={lr.statusBar}>
            <span>{sheet?.name ?? 'No sheet'}</span>
            <span className={lr.statusSep}>·</span>
            <span>{visibleRows.length} / {sheet?.rows.length ?? 0} rows</span>
            <span className={lr.statusSep}>·</span>
            <span>{shownCols.length} / {sheet?.headers.length ?? 0} cols</span>
            {selectedRows.size > 0 && (
              <><span className={lr.statusSep}>·</span>
              <span className={lr.statusSel}>{selectedRows.size} rows selected</span></>
            )}
            {sortCol != null && sheet && (
              <><span className={lr.statusSep}>·</span>
              <span>Sorted: {sheet.headers[sortCol] || `Col ${sortCol + 1}`} {sortDir === 'asc' ? '↑' : '↓'}</span></>
            )}
            {search && (
              <><span className={lr.statusSep}>·</span>
              <span>🔍 "{search}"</span></>
            )}
            <span className={lr.statusRight}>Regnix Audit · Live Register</span>
          </div>
        </div>
      )}

      {/* ── Import modal ──────────────────────────────────────────────────── */}
      {importOpen && (
        <div className={lr.importBackdrop} onClick={() => { setImportOpen(false); setFetchErr(''); }}>
          <div className={lr.importModal} onClick={e => e.stopPropagation()}>
            <div className={lr.importHead}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Import Data</span>
            </div>
            <p className={lr.importSub}>Choose a source to load your register</p>

            <div className={lr.importCards}>
              {/* Card 1: session file */}
              <button className={`${lr.importCard} ${!uploadedFile ? lr.importCardDisabled : ''}`}
                onClick={() => uploadedFile && load(uploadedFile)} disabled={!uploadedFile}>
                <div className={lr.importCardIcon} style={{ background: uploadedFile ? '#EDE9FE' : '#2A2840' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke={uploadedFile ? '#7C3AED' : '#4A4468'} strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                  </svg>
                </div>
                <div className={lr.importCardInfo}>
                  <span className={lr.importCardTitle}>From Current Session</span>
                  <span className={lr.importCardSub}>
                    {uploadedFile ? uploadedFile.name : 'Upload your master in Step 4 first'}
                  </span>
                </div>
                <span className={lr.importCardBadge}
                  style={uploadedFile
                    ? { background:'#EDE9FE', color:'#7C3AED' }
                    : { background:'#2A2840', color:'#6B6880' }}>
                  {uploadedFile ? 'Use' : 'N/A'}
                </span>
              </button>

              {/* Card 2: local file */}
              <button className={lr.importCard}
                onClick={() => { setImportOpen(false); fileInputRef.current?.click(); }}>
                <div className={lr.importCardIcon} style={{ background: '#ECFDF5' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div className={lr.importCardInfo}>
                  <span className={lr.importCardTitle}>Upload from Computer</span>
                  <span className={lr.importCardSub}>.xlsx · .xls · .csv</span>
                </div>
                <span className={lr.importCardBadge} style={{ background:'#ECFDF5', color:'#065F46' }}>Browse</span>
              </button>

              {/* Card 3: URL fetch */}
              <div className={lr.importCard} style={{ flexDirection:'column', alignItems:'stretch', cursor:'default' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div className={lr.importCardIcon} style={{ background:'#EFF6FF' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
                    </svg>
                  </div>
                  <div className={lr.importCardInfo}>
                    <span className={lr.importCardTitle}>Fetch from URL</span>
                    <span className={lr.importCardSub}>Paste a direct link to an .xlsx or .csv file</span>
                  </div>
                </div>
                <div className={lr.fetchRow}>
                  <input className={lr.fetchInput} placeholder="https://…"
                    value={fetchUrl}
                    onChange={e => setFetchUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchFromUrl()} />
                  <button className={lr.fetchBtn}
                    onClick={fetchFromUrl}
                    disabled={fetchLoading || !fetchUrl.trim()}>
                    {fetchLoading
                      ? <span className={lr.fetchSpinner} />
                      : 'Fetch'}
                  </button>
                </div>
                {fetchErr && <span className={lr.fetchErr}>{fetchErr}</span>}
              </div>
            </div>

            <button className={lr.importCancel} onClick={() => { setImportOpen(false); setFetchErr(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Minimized dock bubble ─────────────────────────────────────────── */}
      {minimized && <MiniBubble onClick={handleRestore} />}
    </>,
    document.body,
  );
}