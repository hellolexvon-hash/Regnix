/**
 * ValidationLevel1.tsx
 * Level 1 — Document Upload & Verification
 *
 * True file-manager with real ZIP extraction (JSZip):
 *   • Upload any files — .xlsx, .pdf, .zip, or any other format
 *   • ZIP files are FULLY extracted: every file and every nested folder
 *     inside the ZIP becomes a real FmEntry, preserving directory structure
 *   • Navigate into folders exactly like Google Drive / Windows Explorer
 *   • Breadcrumb path — click any crumb to jump back up
 *   • Table: ☐ · Icon · Name · Type · Size · Modified · Status · Actions
 *   • Per-row actions: 👁 Preview, ✅ Verify toggle, ··· dropdown
 *   • Dropdown: Preview / Open Folder / Rename / Mark Verified / Move to / Delete
 *   • The 👁 "see" button launches a FULL-SCREEN professional viewer:
 *       — .xlsx / .xls  → LiveRegister  (full audit/search/filter spreadsheet workspace)
 *       — .pdf          → PdfViewer     (self-hosted pdf.js renderer, zero external services)
 *       — other types   → lightweight slide-in side panel (unchanged)
 *   • New Folder — inline creation in table
 *   • Bulk select → sticky dark bar (Mark Verified, Delete, Deselect)
 *   • Drag-and-drop onto the shell (files or folders via drag)
 *   • Signature section appears below manager only after all files are verified
 *   • Zero inline styles — all from Validation.module.css
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import s from './Validation.module.css';
import type { UploadedDoc, SheetPreview } from './validationStore';
import LiveRegister from './LiveRegister';
import PdfViewer from './PdfViewer';

interface ValidationLevel1Props {
  onComplete: (docs: UploadedDoc[], signatureDataUrl: string) => void;
  onBack:     () => void;
}

/* ════════════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════════════ */

type FileType = 'xlsx' | 'xls' | 'pdf' | 'zip' | 'folder' | 'img' | 'doc' | 'other';

interface FmEntry {
  id:         string;
  kind:       'file' | 'folder';
  name:       string;
  ext:        string;           // original extension e.g. ".pdf"
  fileType:   FileType;
  size:       number;           // bytes; 0 for folders
  modifiedAt: Date;
  fixed:      boolean;          // verified
  file?:      File;             // only for real uploaded files
  blob?:      Blob;             // for files extracted from ZIP
  sheets?:    SheetPreview[];
  parentId:   string | null;    // null = root
  zipPath?:   string;           // original path inside the ZIP
}

type SortCol = 'name' | 'modifiedAt' | 'size' | 'type';

/* ════════════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getExt(filename: string): string {
  const m = filename.match(/(\.[^./\\]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function detectType(filename: string): FileType {
  const ext = getExt(filename);
  if (['.xlsx', '.xlsm', '.xltx'].includes(ext)) return 'xlsx';
  if (['.xls'].includes(ext))                      return 'xls';
  if (ext === '.pdf')                              return 'pdf';
  if (ext === '.zip')                              return 'zip';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'img';
  if (['.doc', '.docx', '.odt', '.txt', '.csv'].includes(ext))          return 'doc';
  return 'other';
}

function fileTypeIcon(t: FileType | 'folder'): { emoji: string; bgCls: string } {
  switch (t) {
    case 'xlsx':  return { emoji: '📊', bgCls: s.fmFileIconXlsx   };
    case 'xls':   return { emoji: '📊', bgCls: s.fmFileIconXlsx   };
    case 'pdf':   return { emoji: '📄', bgCls: s.fmFileIconPdf    };
    case 'zip':   return { emoji: '🗜',  bgCls: s.fmFileIconZip    };
    case 'folder':return { emoji: '📁', bgCls: s.fmFileIconFolder };
    case 'img':   return { emoji: '🖼',  bgCls: s.fmFileIconImg    };
    case 'doc':   return { emoji: '📝', bgCls: s.fmFileIconDoc    };
    default:      return { emoji: '📎', bgCls: s.fmFileIconGeneric };
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024)            return `${bytes} B`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)       return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(d: Date): string {
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/* ── Parse Excel blob/file into SheetPreview[] ─────────────────────────── */
async function parseXlsxBlob(source: File | Blob): Promise<SheetPreview[]> {
  const buf = await source.arrayBuffer();
  const wb  = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames.map(name => {
    const ws  = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(
      ws, { header: 1, defval: null },
    );
    return {
      name,
      headers: ((raw[0] ?? []) as any[]).map((c: any) => String(c ?? '')),
      rows:    (raw.slice(1) as (string | number | null)[][]).slice(0, 200),
    };
  });
}

/* ── Recursively delete a folder and ALL its descendants ──────────────── */
function deleteEntryAndDescendants(
  entries: FmEntry[],
  targetId: string,
): FmEntry[] {
  const folderIds = new Set<string>([targetId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of entries) {
      if (e.parentId !== null && folderIds.has(e.parentId) && !folderIds.has(e.id)) {
        folderIds.add(e.id);
        changed = true;
      }
    }
  }
  return entries.filter(e => !folderIds.has(e.id));
}

/* ════════════════════════════════════════════════════════════════════════════
   ZIP EXTRACTION
   Mirrors exactly what you see in Google Drive / Windows Explorer:
     - Every path segment in the ZIP becomes a folder FmEntry
     - Every file in the ZIP becomes a file FmEntry with the real Blob
     - Nested structure is fully preserved
     - Excel files inside the ZIP are parsed for preview
   ════════════════════════════════════════════════════════════════════════════ */

async function extractZip(
  zipFile: File,
  parentId: string | null,
): Promise<FmEntry[]> {
  const zip     = await JSZip.loadAsync(zipFile);
  const entries: FmEntry[] = [];

  // folderPath → folderId. folderPath always ends with "/" e.g. "reports/2024/"
  // '' (empty string) maps to the caller's parentId (the folder we extracted into).
  const folderIdMap = new Map<string, string | null>();
  folderIdMap.set('', parentId);

  function ensureFolder(folderPath: string, modifiedAt: Date): string | null {
    if (folderIdMap.has(folderPath)) return folderIdMap.get(folderPath)!;

    const segments = folderPath.replace(/\/$/, '').split('/');
    let builtPath = '';

    for (const seg of segments) {
      const prevPath = builtPath;
      builtPath = `${builtPath}${seg}/`;

      if (folderIdMap.has(builtPath)) continue;

      const pid = folderIdMap.get(prevPath) ?? parentId;
      const fid = newId();
      folderIdMap.set(builtPath, fid);

      entries.push({
        id:         fid,
        kind:       'folder',
        name:       seg,
        ext:        '',
        fileType:   'folder',
        size:       0,
        modifiedAt,
        fixed:      false,
        parentId:   pid,
        zipPath:    builtPath,
      });
    }

    return folderIdMap.get(folderPath)!;
  }

  // ── Pass 1 (synchronous): create every folder first ──────────────────────
  // This must run to completion before any file processing starts, otherwise
  // two files landing in the same not-yet-created folder would race and each
  // create a duplicate folder entry.
  const fileZipEntries: Array<{ path: string; entry: JSZip.JSZipObject }> = [];

  zip.forEach((relativePath, zipEntry) => {
    if (relativePath.startsWith('__MACOSX') || relativePath.includes('/.DS_Store')) return;

    if (zipEntry.dir) {
      const mod = zipEntry.date ?? new Date();
      ensureFolder(relativePath, mod);
    } else {
      fileZipEntries.push({ path: relativePath, entry: zipEntry });
    }
  });

  // Also make sure every file's ancestor chain exists, even for ZIPs that
  // don't emit explicit directory entries (some zip tools omit them).
  for (const { path } of fileZipEntries) {
    const parts  = path.split('/');
    const dir    = parts.slice(0, -1).join('/');
    const dirKey = dir ? `${dir}/` : '';
    if (dirKey) ensureFolder(dirKey, new Date());
  }

  // ── Pass 2 (parallel): read file contents now that all folders exist ─────
  await Promise.all(fileZipEntries.map(async ({ path, entry: zipEntry }) => {
    const pathParts = path.split('/');
    const filename   = pathParts[pathParts.length - 1];
    if (!filename) return; // trailing-slash edge case

    const dirPath = pathParts.slice(0, -1).join('/');
    const dirKey  = dirPath ? `${dirPath}/` : '';
    const mod     = zipEntry.date ?? new Date();
    const pid     = dirKey ? folderIdMap.get(dirKey) ?? parentId : parentId;

    const blob     = await zipEntry.async('blob');
    const ft       = detectType(filename);
    const ext      = getExt(filename);
    const baseName = filename.replace(/\.[^.]+$/, '');

    let sheets: SheetPreview[] | undefined;
    if (ft === 'xlsx' || ft === 'xls') {
      sheets = await parseXlsxBlob(blob).catch(() => undefined);
    }

    entries.push({
      id:         newId(),
      kind:       'file',
      name:       baseName || filename,
      ext,
      fileType:   ft,
      size:       blob.size,
      modifiedAt: mod,
      fixed:      false,
      blob,
      sheets,
      parentId:   pid,
      zipPath:    path,
    });
  }));

  return entries;
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */

export default function ValidationLevel1({ onComplete, onBack }: ValidationLevel1Props) {

  /* ── State ────────────────────────────────────────────────────────────── */
  const [entries,        setEntries]        = useState<FmEntry[]>([]);
  const [currentFolder,  setCurrentFolder]  = useState<string | null>(null);
  const [selected,       setSelected]       = useState<Set<string>>(new Set());
  const [previewId,      setPreviewId]      = useState<string | null>(null);
  const [activeSheet,    setActiveSheet]    = useState(0);
  const [openMenuId,     setOpenMenuId]     = useState<string | null>(null);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [editName,       setEditName]       = useState('');
  const [dragging,       setDragging]       = useState(false);
  const [searchQ,        setSearchQ]        = useState('');
  const [sortCol,        setSortCol]        = useState<SortCol>('modifiedAt');
  const [sortDir,        setSortDir]        = useState<'asc' | 'desc'>('desc');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName,  setNewFolderName]  = useState('');
  const [extracting,     setExtracting]     = useState<string | null>(null); // zip name being extracted

  /* Full-screen viewer launch — set when the 👁 button opens a register or PDF */
  const [registerViewerId, setRegisterViewerId] = useState<string | null>(null);
  const [pdfViewerId,      setPdfViewerId]       = useState<string | null>(null);

  /* Signature */
  const [sigName,    setSigName]    = useState('');
  const [sigDecl,    setSigDecl]    = useState(false);
  const [sigApplied, setSigApplied] = useState(false);

  const fileInputRef      = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef       = useRef<HTMLDivElement>(null);

  /* ── Derived values ───────────────────────────────────────────────────── */

  const visibleEntries = entries
    .filter(e => e.parentId === currentFolder)
    .filter(e => {
      if (!searchQ) return true;
      return e.name.toLowerCase().includes(searchQ.toLowerCase());
    })
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      let cmp = 0;
      if (sortCol === 'name')       cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (sortCol === 'modifiedAt') cmp = a.modifiedAt.getTime() - b.modifiedAt.getTime();
      if (sortCol === 'size')       cmp = a.size - b.size;
      if (sortCol === 'type')       cmp = a.fileType.localeCompare(b.fileType);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  // All files anywhere in the tree (for signature gating)
  const allFiles      = entries.filter(e => e.kind === 'file');
  const verifiedCount = allFiles.filter(e => e.fixed).length;
  const allFixed      = allFiles.length > 0 && verifiedCount === allFiles.length;
  const sigValid      = sigName.trim().length >= 3 && sigDecl;
  const canContinue   = allFixed && sigApplied;
  const previewEntry  = entries.find(e => e.id === previewId);

  /* Resolve the entry + a real File object for the full-screen viewers.
     Entries extracted from a ZIP only have a Blob, not a File, so we wrap
     the Blob in a File for components that expect the File interface
     (LiveRegister / PdfViewer both just need a Blob-like with arrayBuffer(),
     but typing them as File keeps the prop contracts simple and consistent
     with files uploaded directly, not via ZIP). */
  const registerEntry = entries.find(e => e.id === registerViewerId);
  const registerFile  = registerEntry
    ? (registerEntry.file ?? new File([registerEntry.blob!], `${registerEntry.name}${registerEntry.ext}`))
    : null;

  const pdfEntry = entries.find(e => e.id === pdfViewerId);
  const pdfFile  = pdfEntry
    ? (pdfEntry.file ?? new File([pdfEntry.blob!], `${pdfEntry.name}${pdfEntry.ext}`, { type: 'application/pdf' }))
    : null;

  /* Breadcrumb chain from root to currentFolder */
  const breadcrumb: FmEntry[] = [];
  {
    let cur = currentFolder;
    while (cur !== null) {
      const f = entries.find(e => e.id === cur);
      if (!f) break;
      breadcrumb.unshift(f);
      cur = f.parentId;
    }
  }

  /* Folder child counts (for display) */
  const childCounts = new Map<string, number>();
  for (const e of entries) {
    if (e.parentId !== null) {
      childCounts.set(e.parentId, (childCounts.get(e.parentId) ?? 0) + 1);
    }
  }

  /* ── Effects ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (creatingFolder) newFolderInputRef.current?.focus();
  }, [creatingFolder]);

  /* ── Upload handler ───────────────────────────────────────────────────── */

  const processFiles = useCallback(async (rawFiles: FileList | File[]) => {
    const arr = Array.from(rawFiles);
    const results: FmEntry[] = [];

    for (const file of arr) {
      const ft  = detectType(file.name);
      const ext = getExt(file.name);

      if (ft === 'zip') {
        /* ── Real ZIP extraction ── */
        setExtracting(file.name);
        try {
          const extracted = await extractZip(file, currentFolder);
          results.push(...extracted);
        } catch (err) {
          console.error('ZIP extraction failed:', err);
          // Fallback: add as plain file
          results.push({
            id:         newId(),
            kind:       'file',
            name:       file.name.replace(/\.[^.]+$/, ''),
            ext,
            fileType:   'zip',
            size:       file.size,
            modifiedAt: new Date(),
            fixed:      false,
            file,
            parentId:   currentFolder,
          });
        }
        setExtracting(null);
      } else {
        /* ── Regular file ── */
        let sheets: SheetPreview[] | undefined;
        if (ft === 'xlsx' || ft === 'xls') {
          sheets = await parseXlsxBlob(file).catch(() => undefined);
        }
        results.push({
          id:         newId(),
          kind:       'file',
          name:       file.name.replace(/\.[^.]+$/, ''),
          ext,
          fileType:   ft,
          size:       file.size,
          modifiedAt: new Date(),
          fixed:      false,
          file,
          sheets,
          parentId:   currentFolder,
        });
      }
    }

    setEntries(prev => [...prev, ...results]);
  }, [currentFolder]);

  /* ── Actions ──────────────────────────────────────────────────────────── */

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }

  function navigateInto(id: string) {
    setCurrentFolder(id);
    setSelected(new Set());
    setPreviewId(null);
    setSearchQ('');
  }

  function navigateTo(id: string | null) {
    setCurrentFolder(id);
    setSelected(new Set());
    setPreviewId(null);
    setSearchQ('');
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === visibleEntries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleEntries.map(e => e.id)));
    }
  }

  /**
   * The 👁 "see" action. Routes by file type:
   *   — Excel (.xlsx/.xls) → full-screen LiveRegister (audit/search/filter workspace)
   *   — PDF                → full-screen PdfViewer (self-hosted pdf.js renderer)
   *   — everything else    → lightweight inline slide-in side panel (unchanged)
   */
  function openPreview(id: string) {
    const entry = entries.find(e => e.id === id);
    if (!entry || entry.kind === 'folder') return;

    if (entry.fileType === 'xlsx' || entry.fileType === 'xls') {
      setRegisterViewerId(id);
      setOpenMenuId(null);
      return;
    }
    if (entry.fileType === 'pdf') {
      setPdfViewerId(id);
      setOpenMenuId(null);
      return;
    }

    // Fallback: inline side panel for images / docs / unknown types
    setPreviewId(prev => prev === id ? null : id);
    setActiveSheet(0);
    setOpenMenuId(null);
  }

  function toggleVerify(id: string) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, fixed: !e.fixed } : e));
    setOpenMenuId(null);
  }

  function removeEntry(id: string) {
    setEntries(prev => deleteEntryAndDescendants(prev, id));
    if (previewId === id) setPreviewId(null);
    if (registerViewerId === id) setRegisterViewerId(null);
    if (pdfViewerId === id) setPdfViewerId(null);
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    setOpenMenuId(null);
  }

  function removeSelected() {
    const ids = Array.from(selected);
    setEntries(prev => {
      let result = prev;
      for (const id of ids) result = deleteEntryAndDescendants(result, id);
      return result;
    });
    if (previewId && selected.has(previewId)) setPreviewId(null);
    setSelected(new Set());
  }

  function verifySelected() {
    const ids = new Set(selected);
    setEntries(prev => prev.map(e => ids.has(e.id) ? { ...e, fixed: true } : e));
    setSelected(new Set());
  }

  function startRename(entry: FmEntry) {
    setEditingId(entry.id);
    setEditName(entry.name);
    setOpenMenuId(null);
  }

  function saveRename(id: string) {
    if (editName.trim()) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, name: editName.trim() } : e));
    }
    setEditingId(null);
  }

  function createFolder() {
    const name = newFolderName.trim();
    if (!name) { setCreatingFolder(false); return; }
    const entry: FmEntry = {
      id:         newId(),
      kind:       'folder',
      name,
      ext:        '',
      fileType:   'folder',
      size:       0,
      modifiedAt: new Date(),
      fixed:      false,
      parentId:   currentFolder,
    };
    setEntries(prev => [...prev, entry]);
    setCreatingFolder(false);
    setNewFolderName('');
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function applySignature() {
    if (sigValid) setSigApplied(true);
  }

  function handleContinue() {
    if (!canContinue) return;
    const docs: UploadedDoc[] = allFiles
      .filter(e => e.file || e.blob)
      .map(e => ({
        id:     e.id,
        file:   e.file ?? new File([e.blob!], `${e.name}${e.ext}`),
        name:   e.name,
        fixed:  e.fixed,
        sheets: e.sheets,
      }));
    onComplete(docs, `typed:${sigName.trim()}`);
  }

  /* ── Sort indicator ───────────────────────────────────────────────────── */
  function si(col: SortCol) {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  /* ── Selection state ──────────────────────────────────────────────────── */
  const allChecked  = visibleEntries.length > 0 && selected.size === visibleEntries.length;
  const someChecked = selected.size > 0 && !allChecked;

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════════ */

  return (
    <div className={s.page}>
      <div className={s.pageInner}>

        {/* ── Progress header ──────────────────────────────────────────── */}
        <div className={s.progressHeader}>
          <div className={s.progressHeaderLeft}>
            <span className={s.progressTitle}>Compliance Audit — Level 1</span>
            <div className={s.progressTrack}>
              {(['L1 Upload & Sign', 'L2 AI Validation', 'L3 Audit'] as const).map((label, i) => (
                <div key={label} className={s.progressStep}>
                  {i > 0 && <div className={s.progressConnector} />}
                  <div className={i === 0 ? `${s.progressDot} ${s.progressDotActive}` : s.progressDot}>
                    {i + 1}
                  </div>
                  <span className={i === 0 ? `${s.progressStepLabel} ${s.progressStepLabelActive}` : s.progressStepLabel}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {allFiles.length > 0 && (
            <div className={s.l2VerifyCount}>
              <span className={s.l2VerifyNum}>{verifiedCount}/{allFiles.length}</span>
              <span className={s.l2VerifyLabel}>verified</span>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            FILE MANAGER SHELL
            ════════════════════════════════════════════════════════════════ */}
        <div
          className={s.fmShell}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={handleDrop}
        >

          {/* ── Drag overlay ─────────────────────────────────────────── */}
          {dragging && (
            <div className={s.fmDragOverlay}>
              <div className={s.fmDragOverlayInner}>
                <div className={s.fmDragIcon}>↑</div>
                <div className={s.fmDragText}>Drop files or ZIP archives here</div>
                <div className={s.fmDragSub}>ZIP files will be automatically extracted</div>
              </div>
            </div>
          )}

          {/* ── Toolbar ──────────────────────────────────────────────── */}
          <div className={s.fmToolbar}>
            <div className={s.fmToolbarLeft}>

              <button
                className={`${s.fmBtn} ${s.fmBtnPrimary}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className={s.fmBtnIcon}>↑</span> Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className={s.hiddenInput}
                onChange={e => {
                  if (e.target.files?.length) processFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              <button
                className={s.fmBtn}
                onClick={() => { setCreatingFolder(true); setNewFolderName('New Folder'); }}
              >
                <span className={s.fmBtnIcon}>📁</span> New Folder
              </button>

              <div className={s.fmDivider} />

              {/* Breadcrumb inside toolbar on wide screens */}
              <div className={s.fmBreadcrumb}>
                <span
                  className={currentFolder === null ? s.fmBreadcrumbCurrent : s.fmBreadcrumbItem}
                  onClick={() => navigateTo(null)}
                >
                  🏠 Root
                </span>
                {breadcrumb.map((f, i) => (
                  <span key={f.id} className={s.fmBreadcrumbSegment}>
                    <span className={s.fmBreadcrumbSep}>›</span>
                    <span
                      className={i === breadcrumb.length - 1 ? s.fmBreadcrumbCurrent : s.fmBreadcrumbItem}
                      onClick={() => i < breadcrumb.length - 1 && navigateTo(f.id)}
                    >
                      {f.name}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className={s.fmToolbarRight}>
              <div className={s.fmSearch}>
                <span className={s.fmSearchIcon}>🔍</span>
                <input
                  className={s.fmSearchInput}
                  placeholder="Search files & folders…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
                {searchQ && (
                  <button className={s.fmSearchClear} onClick={() => setSearchQ('')}>✕</button>
                )}
              </div>

              <div className={s.fmViewToggle}>
                <button className={`${s.fmViewBtn} ${s.fmViewBtnActive}`} title="List view">☰</button>
                <button className={s.fmViewBtn} title="Grid view">⊞</button>
              </div>
            </div>
          </div>

          {/* ── Stats bar ────────────────────────────────────────────── */}
          <div className={s.fmStatsBar}>
            <span className={s.fmStat}>
              <span className={s.fmStatNum}>{visibleEntries.length}</span> items
            </span>
            <span className={s.fmStatSep}>·</span>
            <span className={s.fmStat}>
              <span className={s.fmStatNum}>{visibleEntries.filter(e => e.kind === 'folder').length}</span> folders
            </span>
            <span className={s.fmStatSep}>·</span>
            <span className={s.fmStat}>
              <span className={s.fmStatNum}>{visibleEntries.filter(e => e.kind === 'file').length}</span> files
            </span>
            {allFiles.length > 0 && (
              <>
                <span className={s.fmStatSep}>·</span>
                <span className={s.fmStat}>
                  <span className={s.fmStatNum}>{verifiedCount}</span>/{allFiles.length} verified (all folders)
                </span>
              </>
            )}
            {extracting && (
              <>
                <span className={s.fmStatSep}>·</span>
                <span className={s.fmStatExtracting}>
                  <span className={s.fmExtractSpinner}>⏳</span>
                  Extracting {extracting}…
                </span>
              </>
            )}
            {selected.size > 0 && (
              <>
                <span className={s.fmStatSep}>·</span>
                <span className={s.fmStatSelected}>{selected.size} selected</span>
              </>
            )}
          </div>

          {/* ── Body: table + preview ─────────────────────────────────── */}
          <div className={s.fmBody}>

            {/* TABLE PANE */}
            <div className={s.fmTablePane}>

              {/* Empty state */}
              {visibleEntries.length === 0 && !creatingFolder ? (
                <div className={s.fmEmpty}>
                  <div className={s.fmEmptyIllustration}>
                    {searchQ ? '🔍' : currentFolder ? '📂' : '☁'}
                  </div>
                  <p className={s.fmEmptyTitle}>
                    {searchQ
                      ? `No results for "${searchQ}"`
                      : currentFolder
                      ? 'This folder is empty'
                      : 'No files uploaded yet'}
                  </p>
                  <p className={s.fmEmptyDesc}>
                    {searchQ
                      ? 'Try a different search term or clear the search.'
                      : 'Upload statutory register files (.xlsx, .pdf, .zip) or create a folder to organise your documents. ZIP files are fully extracted with their original folder structure.'}
                  </p>
                  {!searchQ && (
                    <div className={s.fmEmptyActions}>
                      <button
                        className={`${s.fmBtn} ${s.fmBtnPrimary}`}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        ↑ Upload Files
                      </button>
                      <button
                        className={s.fmBtn}
                        onClick={() => { setCreatingFolder(true); setNewFolderName('New Folder'); }}
                      >
                        📁 New Folder
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <table className={s.fmTable}>
                  <thead>
                    <tr>
                      <th className={s.fmThCheck}>
                        <input
                          type="checkbox"
                          className={s.fmCheckbox}
                          checked={allChecked}
                          ref={el => { if (el) el.indeterminate = someChecked; }}
                          onChange={selectAll}
                        />
                      </th>
                      <th className={s.fmThName} onClick={() => toggleSort('name')}>
                        Name{si('name')}
                      </th>
                      <th onClick={() => toggleSort('type')}>Type{si('type')}</th>
                      <th onClick={() => toggleSort('size')}>Size{si('size')}</th>
                      <th onClick={() => toggleSort('modifiedAt')}>Modified{si('modifiedAt')}</th>
                      <th>Status</th>
                      <th className={s.fmThActions}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>

                    {/* ── New folder inline row ── */}
                    {creatingFolder && (
                      <tr className={s.fmNewFolderRow}>
                        <td><input type="checkbox" className={s.fmCheckbox} disabled /></td>
                        <td colSpan={5}>
                          <div className={s.fmFileIconCell}>
                            <div className={`${s.fmFileIcon} ${s.fmFileIconFolder}`}>📁</div>
                            <input
                              ref={newFolderInputRef}
                              className={s.fmNewFolderInput}
                              value={newFolderName}
                              onChange={e => setNewFolderName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  createFolder();
                                if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
                              }}
                              onBlur={createFolder}
                            />
                          </div>
                        </td>
                        <td>
                          <div className={s.fmActionsCell}>
                            <button className={s.fmActionIconBtn} onClick={createFolder}>✓</button>
                            <button className={s.fmActionIconBtn} onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* ── File / folder rows ── */}
                    {visibleEntries.map(entry => {
                      const { emoji, bgCls } = fileTypeIcon(entry.kind === 'folder' ? 'folder' : entry.fileType);
                      const isSelected = selected.has(entry.id);
                      const isEditing  = editingId === entry.id;
                      const isMenuOpen = openMenuId === entry.id;
                      const isFolder   = entry.kind === 'folder';
                      const childCount = childCounts.get(entry.id) ?? 0;

                      return (
                        <tr
                          key={entry.id}
                          className={[
                            isSelected ? s.fmRowSelected : '',
                            isFolder   ? s.fmFolderRow   : '',
                            previewId === entry.id ? s.fmRowPreviewing : '',
                          ].filter(Boolean).join(' ')}
                          onDoubleClick={() => isFolder && navigateInto(entry.id)}
                        >
                          {/* Checkbox */}
                          <td onClick={e => toggleSelect(entry.id, e)}>
                            <input
                              type="checkbox"
                              className={s.fmCheckbox}
                              checked={isSelected}
                              onChange={() => {}}
                              onClick={e => e.stopPropagation()}
                            />
                          </td>

                          {/* Name */}
                          <td>
                            <div className={s.fmFileIconCell}>
                              <div className={`${s.fmFileIcon} ${bgCls}`}>{emoji}</div>

                              {isEditing ? (
                                <input
                                  className={s.fmFileNameInput}
                                  value={editName}
                                  autoFocus
                                  onChange={e => setEditName(e.target.value)}
                                  onBlur={() => saveRename(entry.id)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter')  saveRename(entry.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  onClick={e => e.stopPropagation()}
                                />
                              ) : (
                                <div className={s.fmFileNameWrap}>
                                  <span
                                    className={isFolder ? `${s.fmFileName} ${s.fmFolderName}` : s.fmFileName}
                                    title={`${entry.name}${entry.ext}`}
                                    onClick={() => isFolder ? navigateInto(entry.id) : openPreview(entry.id)}
                                  >
                                    {entry.name}
                                    {!isFolder && entry.ext && (
                                      <span className={s.fmFileExt}>{entry.ext}</span>
                                    )}
                                  </span>
                                  {isFolder && childCount > 0 && (
                                    <span className={s.fmFolderCount}>{childCount} items</span>
                                  )}
                                  {entry.zipPath && (
                                    <span className={s.fmZipBadge}>from ZIP</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Type */}
                          <td>
                            <span className={s.fmTypeLabel}>
                              {isFolder ? 'Folder' : (entry.ext || entry.fileType).replace('.', '').toUpperCase()}
                            </span>
                          </td>

                          {/* Size */}
                          <td className={s.fmTdMeta}>{formatSize(entry.size)}</td>

                          {/* Modified */}
                          <td className={s.fmTdDate}>{formatDate(entry.modifiedAt)}</td>

                          {/* Status */}
                          <td>
                            {isFolder ? (
                              <span className={`${s.fmStatusBadge} ${s.fmStatusFolder}`}>
                                {childCount} item{childCount !== 1 ? 's' : ''}
                              </span>
                            ) : entry.fixed ? (
                              <span className={`${s.fmStatusBadge} ${s.fmStatusVerified}`}>✓ Verified</span>
                            ) : (
                              <span className={`${s.fmStatusBadge} ${s.fmStatusPending}`}>Pending</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td>
                            <div className={s.fmActionsCell}>

                              {/* Open folder */}
                              {isFolder && (
                                <button
                                  className={`${s.fmActionIconBtn} ${s.fmActionIconBtnPrimary}`}
                                  title="Open folder"
                                  onClick={() => navigateInto(entry.id)}
                                >
                                  →
                                </button>
                              )}

                              {/* Preview — opens full screen for Excel/PDF, inline panel otherwise */}
                              {!isFolder && (
                                <button
                                  className={`${s.fmActionIconBtn} ${s.fmActionIconBtnPrimary}`}
                                  title={
                                    entry.fileType === 'xlsx' || entry.fileType === 'xls'
                                      ? 'Open in full-screen Live Register'
                                      : entry.fileType === 'pdf'
                                      ? 'Open in full-screen PDF viewer'
                                      : 'Preview'
                                  }
                                  onClick={() => openPreview(entry.id)}
                                >
                                  👁
                                </button>
                              )}

                              {/* Verify toggle (files only) */}
                              {!isFolder && (
                                <button
                                  className={entry.fixed
                                    ? `${s.fmActionIconBtn} ${s.fmActionIconBtnGreen}`
                                    : s.fmActionIconBtn}
                                  title={entry.fixed ? 'Unmark verified' : 'Mark as verified'}
                                  onClick={() => toggleVerify(entry.id)}
                                >
                                  {entry.fixed ? '✓' : '☐'}
                                </button>
                              )}

                              {/* More (···) */}
                              <div
                                className={s.fmDropdownWrap}
                                ref={isMenuOpen ? dropdownRef : undefined}
                              >
                                <button
                                  className={s.fmActionIconBtn}
                                  title="More options"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setOpenMenuId(isMenuOpen ? null : entry.id);
                                  }}
                                >
                                  ···
                                </button>

                                {isMenuOpen && (
                                  <div className={s.fmDropdown}>

                                    {isFolder && (
                                      <button className={s.fmDropdownItem}
                                        onClick={() => { navigateInto(entry.id); setOpenMenuId(null); }}>
                                        <span className={s.fmDropdownItemIcon}>📂</span>
                                        Open Folder
                                      </button>
                                    )}

                                    {!isFolder && (
                                      <button className={s.fmDropdownItem}
                                        onClick={() => openPreview(entry.id)}>
                                        <span className={s.fmDropdownItemIcon}>👁</span>
                                        {entry.fileType === 'xlsx' || entry.fileType === 'xls'
                                          ? 'Open Full Screen'
                                          : entry.fileType === 'pdf'
                                          ? 'Open Full Screen'
                                          : 'Preview'}
                                      </button>
                                    )}

                                    <button className={s.fmDropdownItem}
                                      onClick={() => startRename(entry)}>
                                      <span className={s.fmDropdownItemIcon}>✏</span>
                                      Rename
                                    </button>

                                    {!isFolder && (
                                      <button className={s.fmDropdownItem}
                                        onClick={() => toggleVerify(entry.id)}>
                                        <span className={s.fmDropdownItemIcon}>{entry.fixed ? '↩' : '✅'}</span>
                                        {entry.fixed ? 'Remove Verified' : 'Mark as Verified'}
                                      </button>
                                    )}

                                    <div className={s.fmDropdownDivider} />

                                    <button
                                      className={`${s.fmDropdownItem} ${s.fmDropdownItemDanger}`}
                                      onClick={() => removeEntry(entry.id)}
                                    >
                                      <span className={s.fmDropdownItemIcon}>🗑</span>
                                      Delete {isFolder ? 'Folder & Contents' : 'File'}
                                    </button>
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── PREVIEW PANE ─────────────────────────────────────────── */}
            <div className={previewEntry ? s.fmPreviewPane : s.fmPreviewPaneCollapsed}>
              {previewEntry && (
                <>
                  <div className={s.fmPreviewHeader}>
                    <div className={s.fmPreviewHeaderLeft}>
                      <div className={`${s.fmFileIcon} ${fileTypeIcon(previewEntry.fileType).bgCls}`}>
                        {fileTypeIcon(previewEntry.fileType).emoji}
                      </div>
                      <span className={s.fmPreviewTitle} title={previewEntry.name + previewEntry.ext}>
                        {previewEntry.name}{previewEntry.ext}
                      </span>
                    </div>
                    <button className={s.fmPreviewClose} onClick={() => setPreviewId(null)}>✕</button>
                  </div>

                  {/* Meta strip */}
                  <div className={s.fmPreviewMeta}>
                    <div className={s.fmPreviewMetaItem}>
                      <span className={s.fmPreviewMetaLabel}>Type</span>
                      <span className={s.fmPreviewMetaValue}>
                        {previewEntry.ext ? previewEntry.ext.replace('.', '').toUpperCase() : previewEntry.fileType.toUpperCase()}
                      </span>
                    </div>
                    <div className={s.fmPreviewMetaItem}>
                      <span className={s.fmPreviewMetaLabel}>Size</span>
                      <span className={s.fmPreviewMetaValue}>{formatSize(previewEntry.size)}</span>
                    </div>
                    <div className={s.fmPreviewMetaItem}>
                      <span className={s.fmPreviewMetaLabel}>Modified</span>
                      <span className={s.fmPreviewMetaValue}>{formatDate(previewEntry.modifiedAt)}</span>
                    </div>
                    <div className={s.fmPreviewMetaItem}>
                      <span className={s.fmPreviewMetaLabel}>Status</span>
                      <span className={`${s.fmStatusBadge} ${previewEntry.fixed ? s.fmStatusVerified : s.fmStatusPending}`}>
                        {previewEntry.fixed ? '✓ Verified' : 'Pending'}
                      </span>
                    </div>
                    {previewEntry.zipPath && (
                      <div className={s.fmPreviewMetaItem}>
                        <span className={s.fmPreviewMetaLabel}>ZIP Path</span>
                        <span className={s.fmPreviewMetaValue} title={previewEntry.zipPath}>
                          {previewEntry.zipPath.length > 28
                            ? `…${previewEntry.zipPath.slice(-26)}`
                            : previewEntry.zipPath}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className={s.fmPreviewBody}>

                    {/* Excel preview */}
                    {previewEntry.sheets && previewEntry.sheets.length > 0 ? (
                      <>
                        {previewEntry.sheets.length > 1 && (
                          <div className={s.fmPreviewSheetTabs}>
                            {previewEntry.sheets.map((sh, i) => (
                              <button
                                key={i}
                                className={activeSheet === i
                                  ? `${s.sheetTab} ${s.sheetTabActive}`
                                  : s.sheetTab}
                                onClick={() => setActiveSheet(i)}
                              >
                                {sh.name}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className={s.fmPreviewTableWrap}>
                          <table className={s.sheetTable}>
                            <thead>
                              <tr>
                                {previewEntry.sheets[activeSheet]?.headers.map((h, i) => (
                                  <th key={i}>{h || `Col ${i + 1}`}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewEntry.sheets[activeSheet]?.rows.map((row, ri) => (
                                <tr key={ri}>
                                  {row.map((cell, ci) => <td key={ci}>{cell ?? ''}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : previewEntry.fileType === 'pdf' ? (
                      /* PDF — this inline panel is only a fallback; openPreview()
                         normally routes PDFs straight to the full-screen PdfViewer.
                         Offer a one-click way to open that proper viewer here too. */
                      <div className={s.fmPreviewPdfPlaceholder}>
                        <div className={s.fmPreviewPdfDoc}>
                          <div className={s.fmPreviewPdfDocHeader} />
                          <div className={s.fmPreviewPdfDocLine} />
                          <div className={s.fmPreviewPdfDocLine} />
                          <div className={s.fmPreviewPdfDocLineShort} />
                          <div className={s.fmPreviewPdfDocGap} />
                          <div className={s.fmPreviewPdfDocLine} />
                          <div className={s.fmPreviewPdfDocLine} />
                          <div className={s.fmPreviewPdfDocLineShort} />
                        </div>
                        <div className={s.fmPreviewPdfLabel}>📄</div>
                        <div className={s.fmPreviewPdfName}>{previewEntry.name}{previewEntry.ext}</div>
                        <div className={s.fmPreviewPdfDesc}>
                          Open this document in the full-screen PDF workspace for page navigation, zoom, search, and printing.
                        </div>
                        <button
                          className={`${s.btnPrimary} ${s.btnSmall}`}
                          onClick={() => { setPreviewId(null); setPdfViewerId(previewEntry.id); }}
                        >
                          🖥 Open Full Screen
                        </button>
                      </div>
                    ) : previewEntry.fileType === 'img' ? (
                      /* Image */
                      <div className={s.fmPreviewImgWrap}>
                        <div className={s.fmPreviewImgPlaceholder}>🖼</div>
                        <div className={s.fmPreviewPdfName}>{previewEntry.name}{previewEntry.ext}</div>
                        <div className={s.fmPreviewPdfDesc}>Image preview not available inline.</div>
                      </div>
                    ) : (
                      /* Generic */
                      <div className={s.fmPreviewPdfPlaceholder}>
                        <div className={s.fmPreviewPdfLabel}>📎</div>
                        <div className={s.fmPreviewPdfName}>{previewEntry.name}{previewEntry.ext}</div>
                        <div className={s.fmPreviewPdfDesc}>
                          This file type cannot be previewed. Download to view.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview footer actions */}
                  <div className={s.fmPreviewActions}>
                    <button
                      className={previewEntry.fixed ? `${s.btnSecondary} ${s.btnSmall}` : `${s.btnGreen} ${s.btnSmall}`}
                      onClick={() => toggleVerify(previewEntry.id)}
                    >
                      {previewEntry.fixed ? '↩ Unmark Verified' : '✅ Mark as Verified'}
                    </button>
                    <button
                      className={`${s.btnSecondary} ${s.btnSmall}`}
                      onClick={() => startRename(previewEntry)}
                    >
                      ✏ Rename
                    </button>
                    <button
                      className={`${s.btnSecondary} ${s.btnSmall}`}
                      onClick={() => removeEntry(previewEntry.id)}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>{/* /fmBody */}

          {/* ── Bulk action bar ──────────────────────────────────────── */}
          {selected.size > 0 && (
            <div className={s.fmBulkBar}>
              <span className={s.fmBulkCount}>{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
              <span className={s.fmBulkSep}>|</span>
              <button className={s.fmBulkBtnWhite} onClick={verifySelected}>
                ✅ Mark All Verified
              </button>
              <button className={s.fmBulkBtnDanger} onClick={removeSelected}>
                🗑 Delete Selected
              </button>
              <button className={s.fmBulkBtnWhite} onClick={() => setSelected(new Set())}>
                ✕ Deselect All
              </button>
            </div>
          )}

        </div>{/* /fmShell */}

        {/* ════════════════════════════════════════════════════════════════
            SIGNATURE SECTION — only shown when all files are verified
            ════════════════════════════════════════════════════════════════ */}
        {allFixed && (
          <div className={s.sigSection}>
            <div className={s.sectionDivider}>Digital Signature &amp; Declaration</div>

            {!sigApplied ? (
              <>
                <p className={s.cardSub}>
                  Type your full name as it appears in official records. This constitutes your digital signature under the IT Act 2000.
                </p>

                <div className={s.sigNameWrap}>
                  <label className={s.sigNameLabel}>Full Name (Authorised Signatory)</label>
                  <input
                    className={s.sigNameInput}
                    type="text"
                    placeholder="e.g. Amit Kumar"
                    value={sigName}
                    onChange={e => setSigName(e.target.value)}
                    maxLength={80}
                  />
                  {sigName.trim().length > 0 && (
                    <div className={s.sigNamePreview}>{sigName}</div>
                  )}
                </div>

                <label className={s.sigDeclRow}>
                  <input
                    type="checkbox"
                    checked={sigDecl}
                    onChange={e => setSigDecl(e.target.checked)}
                  />
                  <span className={s.sigDeclText}>
                    I, <strong>{sigName.trim() || '[ your name ]'}</strong>, hereby declare that all documents uploaded are authentic, accurate, and created in compliance with applicable Indian labour laws. I understand that this typed name constitutes my legal digital signature and that any misrepresentation is subject to action under the IT Act 2000.
                  </span>
                </label>

                <div className={s.sigActions}>
                  <button
                    className={s.btnPrimary}
                    disabled={!sigValid}
                    onClick={applySignature}
                  >
                    ✍ Apply Digital Signature →
                  </button>
                </div>
              </>
            ) : (
              <div className={s.sigAppliedCard}>
                <div className={s.sigAppliedIcon}>✅</div>
                <div>
                  <div className={s.sigAppliedName}>{sigName}</div>
                  <div className={s.sigAppliedMeta}>
                    Digitally signed on {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · IT Act 2000
                  </div>
                </div>
                <button
                  className={s.sigResetBtn}
                  onClick={() => { setSigApplied(false); setSigDecl(false); }}
                >
                  Change
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className={s.cardFooter}>
          <button className={s.btnSecondary} onClick={onBack}>← Back</button>
          <button
            className={s.btnPrimary}
            disabled={!canContinue}
            onClick={handleContinue}
            title={
              !canContinue
                ? allFiles.length === 0
                  ? 'Upload documents first'
                  : !allFixed
                  ? 'Verify all documents'
                  : 'Apply digital signature'
                : ''
            }
          >
            Continue to Level 2 →
          </button>
        </div>

        {!canContinue && allFiles.length > 0 && (
          <div className={s.validationBanner}>
            <span className={s.validationHint}>
              {!allFixed
                ? `${allFiles.length - verifiedCount} file${allFiles.length - verifiedCount !== 1 ? 's' : ''} still pending verification — use the ☐ button or 👁 preview panel`
                : !sigApplied
                ? 'Apply your digital signature above to continue'
                : ''}
            </span>
          </div>
        )}

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          FULL-SCREEN VIEWERS — launched by the 👁 "see" action
          Both render via React Portal onto document.body and take over the
          entire viewport (full screen by default; the green traffic light
          toggles a windowed mode for users who prefer it).
          ════════════════════════════════════════════════════════════════════ */}

      {/* Excel / Live Register full-screen audit workspace */}
      <LiveRegister
        open={registerViewerId !== null}
        onClose={() => setRegisterViewerId(null)}
        uploadedFile={registerFile}
      />

      {/* PDF full-screen self-hosted renderer */}
      <PdfViewer
        open={pdfViewerId !== null}
        onClose={() => setPdfViewerId(null)}
        file={pdfFile}
        fileName={pdfEntry ? `${pdfEntry.name}${pdfEntry.ext}` : 'Document.pdf'}
      />
    </div>
  );
}