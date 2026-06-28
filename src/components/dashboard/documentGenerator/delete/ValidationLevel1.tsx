/**
 * ValidationLevel1.tsx
 *
 * Level 1 — Document Upload & Verification
 *
 * Flow:
 *  1. Drag-drop / click upload area — accepts multiple files (xlsx, pdf, zip)
 *  2. Each file appears in a list with:
 *     - View (inline spreadsheet preview)
 *     - Edit / Rename
 *     - Fix / Mark as Verified (turns the row green)
 *  3. Progress bar: N of M documents fixed
 *  4. Digital Signature canvas — draw signature, or clear & redo
 *  5. Continue → Level 2 (enabled once all docs fixed AND signature drawn)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import s from './Validation.module.css';

export interface UploadedDoc {
  id: string;
  file: File;
  name: string;     // display name (editable)
  fixed: boolean;   // verified / approved
  sheets?: SheetPreview[];
}

interface SheetPreview {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

interface ValidationLevel1Props {
  onComplete: (docs: UploadedDoc[], signatureDataUrl: string) => void;
  onBack: () => void;
}

// ── XLSX preview parser ────────────────────────────────────────────────────────
async function parseXlsx(file: File): Promise<SheetPreview[]> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames.map(name => {
    const ws      = wb.Sheets[name];
    const raw     = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null });
    const headers = (raw[0] ?? []).map(c => String(c ?? ''));
    const rows    = (raw.slice(1) as (string | number | null)[][]).slice(0, 80);
    return { name, headers, rows };
  });
}

// ── Signature canvas hook ──────────────────────────────────────────────────────
function useSignatureCanvas(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const drawing    = useRef(false);
  const hasMark    = useRef(false);
  const [hasSign, setHasSign] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth   = 2;
    ctx.strokeStyle = '#1E1040';
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    function getPos(e: MouseEvent | TouchEvent) {
      const rect = canvas.getBoundingClientRect();
      const src  = 'touches' in e ? e.touches[0] : e;
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    }
    function start(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      drawing.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath(); ctx.moveTo(x, y);
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawing.current) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y); ctx.stroke();
      hasMark.current = true;
      setHasSign(true);
    }
    function end() { drawing.current = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [canvasRef]);

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    hasMark.current = false;
    setHasSign(false);
  }

  return { hasSign, clear };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ValidationLevel1({ onComplete, onBack }: ValidationLevel1Props) {
  const [docs, setDocs]             = useState<UploadedDoc[]>([]);
  const [dragging, setDragging]     = useState(false);
  const [previewId, setPreviewId]   = useState<string | null>(null);
  const [renameId, setRenameId]     = useState<string | null>(null);
  const [renameTmp, setRenameTmp]   = useState('');
  const [activeSheet, setActiveSheet] = useState(0);
  const [sigDone, setSigDone]       = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { hasSign, clear: clearSig } = useSignatureCanvas(canvasRef);

  const fixedCount = docs.filter(d => d.fixed).length;
  const allFixed   = docs.length > 0 && fixedCount === docs.length;
  const canContinue = allFixed && sigDone;

  // ── File ingestion ───────────────────────────────────────────────────────────
  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const newDocs: UploadedDoc[] = await Promise.all(
      arr.map(async file => {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let sheets: SheetPreview[] | undefined;
        if (file.name.match(/\.(xlsx|xls)$/i)) {
          try { sheets = await parseXlsx(file); } catch { /* ignore */ }
        }
        return { id, file, name: file.name.replace(/\.[^.]+$/, ''), fixed: false, sheets };
      }),
    );
    setDocs(prev => [...prev, ...newDocs]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function toggleFix(id: string) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, fixed: !d.fixed } : d));
  }
  function removeDoc(id: string) {
    setDocs(prev => prev.filter(d => d.id !== id));
    if (previewId === id) setPreviewId(null);
  }
  function startRename(doc: UploadedDoc) {
    setRenameId(doc.id); setRenameTmp(doc.name);
  }
  function commitRename() {
    if (!renameId) return;
    setDocs(prev => prev.map(d => d.id === renameId ? { ...d, name: renameTmp.trim() || d.name } : d));
    setRenameId(null);
  }
  function confirmSignature() {
    if (!hasSign) return;
    setSigDone(true);
  }
  function resetSignature() {
    clearSig(); setSigDone(false);
  }

  function handleContinue() {
    const dataUrl = canvasRef.current?.toDataURL() ?? '';
    onComplete(docs, dataUrl);
  }

  const previewDoc = docs.find(d => d.id === previewId);

  return (
    <div className={s.page}>
      {/* Step bar */}
      <div className={s.stepBar}>
        {(['L1 Upload', 'L2 Compare', 'L3 Audit'] as const).map((label, i) => (
          <div key={label} className={s.stepBarItem}>
            {i > 0 && <div className={`${s.stepLine} ${i === 0 ? s.stepLineDone : ''}`} />}
            <div className={`${s.stepDot} ${i === 0 ? s.stepDotActive : ''}`}>{i + 1}</div>
            <span className={`${s.stepLabel} ${i === 0 ? s.stepLabelActive : ''}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className={s.stepCard}>
        <div className={s.stepCardHeader}>
          <div className={s.stepCardIcon}>📁</div>
          <div>
            <h2 className={s.stepCardTitle}>Level 1 — Document Upload & Verification</h2>
            <p className={s.stepCardSub}>
              Upload your compliance registers, preview each file, rename if needed, and mark as verified. Sign digitally to complete Level 1.
            </p>
          </div>
        </div>

        {/* Progress */}
        {docs.length > 0 && (
          <div className={s.uploadProgress}>
            <span className={s.uploadProgressText}>
              {fixedCount} of {docs.length} document{docs.length !== 1 ? 's' : ''} verified
            </span>
            <span className={s.uploadProgressSub}>
              {allFixed ? '✓ All verified — sign below to continue' : 'Mark each document as verified after reviewing'}
            </span>
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`${s.dropzone} ${dragging ? s.dropzoneDrag : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className={s.dropzoneIcon}>📂</div>
          <div className={s.dropzoneText}>Drop registers here or click to browse</div>
          <div className={s.dropzoneSub}>Accepts .xlsx, .xls, .pdf, .zip</div>
          <input
            ref={fileRef} type="file" multiple hidden
            accept=".xlsx,.xls,.pdf,.zip"
            onChange={e => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* Document list */}
        {docs.length > 0 && (
          <div className={s.docList}>
            <div className={s.sectionDivider}>Uploaded Documents ({docs.length})</div>
            {docs.map(doc => (
              <div key={doc.id} className={`${s.docRow} ${doc.fixed ? s.fixed : ''}`}>
                <div className={s.docRowIcon}>
                  {doc.file.name.match(/\.pdf$/i) ? '📄' : doc.sheets ? '📊' : '🗂️'}
                </div>
                <div className={s.docRowBody}>
                  {renameId === doc.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className={s.renameInput}
                        value={renameTmp}
                        onChange={e => setRenameTmp(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && commitRename()}
                        autoFocus
                      />
                      <button className={`${s.iconBtn} ${s.iconBtnGreen}`} onClick={commitRename}>✓</button>
                    </div>
                  ) : (
                    <>
                      <div className={s.docRowName}>{doc.name}</div>
                      <div className={s.docRowMeta}>
                        {(doc.file.size / 1024).toFixed(1)} KB
                        {doc.sheets && ` · ${doc.sheets.length} sheet${doc.sheets.length !== 1 ? 's' : ''}`}
                      </div>
                    </>
                  )}
                </div>

                <div className={s.docRowActions}>
                  {/* View */}
                  {doc.sheets && (
                    <button
                      className={s.iconBtn}
                      title="Preview"
                      onClick={() => { setPreviewId(previewId === doc.id ? null : doc.id); setActiveSheet(0); }}
                    >
                      👁
                    </button>
                  )}
                  {/* Rename */}
                  <button
                    className={s.iconBtn} title="Rename"
                    onClick={() => startRename(doc)}
                  >
                    ✏️
                  </button>
                  {/* Fix / Verify */}
                  <button
                    className={`${s.iconBtn} ${doc.fixed ? s.iconBtnGreen : ''}`}
                    title={doc.fixed ? 'Unmark as verified' : 'Mark as verified'}
                    onClick={() => toggleFix(doc.id)}
                  >
                    {doc.fixed ? '✅' : '☑️'}
                  </button>
                  {/* Remove */}
                  <button
                    className={`${s.iconBtn} ${s.iconBtnRed}`} title="Remove"
                    onClick={() => removeDoc(doc.id)}
                  >
                    🗑
                  </button>
                </div>

                {doc.fixed && <span className={s.fixedBadge}>✓ Verified</span>}
              </div>
            ))}
          </div>
        )}

        {/* Inline preview */}
        {previewDoc?.sheets && (
          <div className={s.splitPane} style={{ maxHeight: 320 }}>
            <div className={s.splitPaneHeader}>
              <span className={s.splitPaneTitle}>{previewDoc.name}</span>
              <span className={s.splitPaneBadge}>Preview</span>
              <button
                className={s.iconBtn} style={{ marginLeft: 'auto' }}
                onClick={() => setPreviewId(null)}
              >✕</button>
            </div>
            <div className={s.sheetTabs}>
              {previewDoc.sheets.map((sh, i) => (
                <button
                  key={i}
                  className={`${s.sheetTab} ${activeSheet === i ? s.sheetTabActive : ''}`}
                  onClick={() => setActiveSheet(i)}
                >
                  {sh.name}
                </button>
              ))}
            </div>
            <div className={s.previewPane}>
              <table className={s.sheetTable}>
                <thead>
                  <tr>{previewDoc.sheets[activeSheet]?.headers.map((h, i) => <th key={i}>{h || `Col ${i + 1}`}</th>)}</tr>
                </thead>
                <tbody>
                  {previewDoc.sheets[activeSheet]?.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => <td key={ci}>{cell ?? ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Digital Signature */}
        {allFixed && (
          <div>
            <div className={s.sectionDivider}>Digital Signature</div>
            {sigDone ? (
              <div className={s.sigDone}>
                <span style={{ fontSize: 24 }}>✍️</span>
                <div>
                  <div className={s.sigDoneText}>Signature applied</div>
                  <div style={{ fontSize: 11, color: '#047857' }}>Your digital signature has been recorded.</div>
                </div>
                <button className={s.btnSecondary} style={{ marginLeft: 'auto' }} onClick={resetSignature}>
                  Redo
                </button>
              </div>
            ) : (
              <div className={s.sigArea}>
                <div className={s.sigLabel}>Draw your signature below</div>
                <canvas
                  ref={canvasRef}
                  className={s.sigCanvas}
                  width={480}
                  height={120}
                />
                <div className={s.sigSub}>Use mouse or touch to sign</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={s.btnSecondary} onClick={clearSig}>Clear</button>
                  <button className={s.btnGreen} disabled={!hasSign} onClick={confirmSignature}>
                    Apply Signature →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={s.stepActions}>
          <button className={s.btnSecondary} onClick={onBack}>← Back</button>
          <button
            className={s.btnPrimary}
            disabled={!canContinue}
            onClick={handleContinue}
            title={!canContinue ? 'Verify all documents and apply signature first' : undefined}
          >
            Continue to Level 2 →
          </button>
        </div>
      </div>
    </div>
  );
}
