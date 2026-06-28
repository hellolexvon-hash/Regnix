/**
 * ValidationLevel1.tsx
 *
 * Level 1 — Document Upload & Verification
 *
 * Flow:
 *  1. Drag-drop / click upload (xlsx, pdf, zip — multiple files)
 *  2. Each file appears in a list:
 *     - View (inline spreadsheet preview for xlsx)
 *     - Rename (inline edit)
 *     - Fix / Mark as Verified (turns row green)
 *  3. Progress: N of M documents fixed
 *  4. Digital Signature canvas (draw → apply → clear)
 *  5. Continue → Level 2 (enabled when all docs fixed AND signature drawn)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import s from './Validation.module.css';
import type { UploadedDoc, SheetPreview } from './validationStore';

interface ValidationLevel1Props {
  onComplete: (docs: UploadedDoc[], signatureDataUrl: string) => void;
  onBack:     () => void;
}

// ── XLSX preview parser ────────────────────────────────────────────────────────
async function parseXlsx(file: File): Promise<SheetPreview[]> {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames.map(name => {
    const ws  = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null });
    return {
      name,
      headers: ((raw[0] ?? []) as any[]).map((c: any) => String(c ?? '')),
      rows:    (raw.slice(1) as (string | number | null)[][]).slice(0, 80),
    };
  });
}

// ── Signature canvas hook ──────────────────────────────────────────────────────
function useSignatureCanvas(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const drawing = useRef(false);
  const [hasSign, setHasSign] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth   = 2.2;
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
      setHasSign(true);
    }
    function end() { drawing.current = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove',  move,  { passive: false });
    canvas.addEventListener('touchend',   end);
    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove',  move);
      canvas.removeEventListener('touchend',   end);
    };
  }, [canvasRef]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSign(false);
  }

  function getDataUrl(): string {
    return canvasRef.current?.toDataURL('image/png') ?? '';
  }

  return { hasSign, clearCanvas, getDataUrl };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ValidationLevel1({ onComplete, onBack }: ValidationLevel1Props) {
  const [docs, setDocs]               = useState<UploadedDoc[]>([]);
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editName, setEditName]       = useState('');
  const [dragging, setDragging]       = useState(false);
  const [sigApplied, setSigApplied]   = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null!);
  const { hasSign, clearCanvas, getDataUrl } = useSignatureCanvas(canvasRef);

  const fixedCount = docs.filter(d => d.fixed).length;
  const allFixed   = docs.length > 0 && fixedCount === docs.length;
  const canContinue = allFixed && sigApplied;

  const selectedDoc = docs.find(d => d.id === activeId);

  // ── File processing ──────────────────────────────────────────────────────
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newDocs: UploadedDoc[] = await Promise.all(
      arr.map(async file => {
        const id     = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const sheets = file.name.match(/\.xlsx?$/i) ? await parseXlsx(file).catch(() => undefined) : undefined;
        return { id, file, name: file.name.replace(/\.[^.]+$/, ''), fixed: false, sheets };
      }),
    );
    setDocs(prev => {
      const merged = [...prev, ...newDocs];
      if (!activeId && merged.length) setActiveId(merged[0].id);
      return merged;
    });
  }, [activeId]);

  function toggleFix(id: string) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, fixed: !d.fixed } : d));
  }

  function removeDoc(id: string) {
    setDocs(prev => {
      const next = prev.filter(d => d.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  function startEdit(doc: UploadedDoc) {
    setEditingId(doc.id);
    setEditName(doc.name);
  }

  function saveEdit(id: string) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, name: editName.trim() || d.name } : d));
    setEditingId(null);
  }

  function applySignature() {
    if (!hasSign) return;
    setSigApplied(true);
  }

  function handleContinue() {
    if (!canContinue) return;
    onComplete(docs, getDataUrl());
  }

  // ── Drop zone ────────────────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

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

      <div className={s.stepCard}>
        <div className={s.stepCardHeader}>
          <div className={s.stepCardIcon}>📁</div>
          <div className={s.stepCardHeaderText}>
            <h2 className={s.stepCardTitle}>Level 1 — Document Upload &amp; Verification</h2>
            <p className={s.stepCardSub}>
              Upload your generated compliance registers. Preview, rename, and mark each as verified. Then apply your digital signature.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {docs.length > 0 && (
          <div className={s.l1Progress}>
            <div className={s.l1ProgressBar}>
              <div
                className={s.l1ProgressFill}
                style={{ width: `${(fixedCount / docs.length) * 100}%` }}
              />
            </div>
            <span className={s.l1ProgressLabel}>
              {fixedCount} / {docs.length} documents verified
            </span>
          </div>
        )}

        {/* Upload zone */}
        <div
          className={`${s.dropzone} ${dragging ? s.dropzoneDrag : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.pdf,.zip"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
          />
          <div className={s.dropzoneIcon}>📂</div>
          <div className={s.dropzoneText}>
            Drop your register files here, or click to browse
          </div>
          <div className={s.dropzoneSub}>.xlsx · .xls · .pdf · .zip — multiple files supported</div>
        </div>

        {/* Document list + preview */}
        {docs.length > 0 && (
          <div className={s.l1Layout}>

            {/* ── Left: doc list ─────────────────────────────────────── */}
            <div className={s.l1DocList}>
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className={`${s.l1DocRow} ${activeId === doc.id ? s.l1DocRowActive : ''} ${doc.fixed ? s.l1DocRowFixed : ''}`}
                  onClick={() => { setActiveId(doc.id); setActiveSheet(0); }}
                >
                  <span className={s.l1DocIcon}>
                    {doc.file.name.match(/\.pdf$/i) ? '📄' : '📊'}
                  </span>

                  {editingId === doc.id ? (
                    <input
                      className={s.l1DocNameEdit}
                      value={editName}
                      autoFocus
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => saveEdit(doc.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(doc.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={s.l1DocName} title={doc.name}>{doc.name}</span>
                  )}

                  <div className={s.l1DocActions}>
                    {!editingId && (
                      <button
                        className={s.l1ActionBtn}
                        title="Rename"
                        onClick={e => { e.stopPropagation(); startEdit(doc); }}
                      >✏️</button>
                    )}
                    <button
                      className={`${s.l1ActionBtn} ${doc.fixed ? s.l1ActionBtnFixed : s.l1ActionBtnFix}`}
                      title={doc.fixed ? 'Unmark as verified' : 'Mark as verified'}
                      onClick={e => { e.stopPropagation(); toggleFix(doc.id); }}
                    >
                      {doc.fixed ? '✓' : 'Fix'}
                    </button>
                    <button
                      className={s.l1ActionBtn}
                      title="Remove"
                      onClick={e => { e.stopPropagation(); removeDoc(doc.id); }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Right: preview ─────────────────────────────────────── */}
            <div className={s.l1Preview}>
              {selectedDoc?.sheets ? (
                <>
                  {/* Sheet tabs */}
                  {selectedDoc.sheets.length > 1 && (
                    <div className={s.sheetTabs}>
                      {selectedDoc.sheets.map((sh, i) => (
                        <button
                          key={i}
                          className={`${s.sheetTab} ${activeSheet === i ? s.sheetTabActive : ''}`}
                          onClick={() => setActiveSheet(i)}
                        >
                          {sh.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={s.previewPane}>
                    <table className={s.sheetTable}>
                      <thead>
                        <tr>
                          {selectedDoc.sheets[activeSheet]?.headers.map((h, i) => (
                            <th key={i}>{h || `Col ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDoc.sheets[activeSheet]?.rows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => <td key={ci}>{cell ?? ''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Fix button */}
                  <div className={s.l1FixBar}>
                    <button
                      className={selectedDoc.fixed ? s.btnSecondary : s.btnGreen}
                      onClick={() => toggleFix(selectedDoc.id)}
                      style={{ flex: 1 }}
                    >
                      {selectedDoc.fixed ? '✓ Verified — click to unmark' : '✓ Mark as Verified'}
                    </button>
                  </div>
                </>
              ) : (
                <div className={s.previewEmpty}>
                  <div className={s.previewEmptyIcon}>
                    {selectedDoc?.file.name.match(/\.pdf$/i) ? '📄' : '📊'}
                  </div>
                  <div className={s.previewEmptyText}>
                    {selectedDoc
                      ? selectedDoc.file.name.match(/\.pdf$/i)
                        ? 'PDF preview not available in browser. Use Fix button to mark as verified.'
                        : 'Select a document to preview'
                      : 'Select a document from the list'}
                  </div>
                  {selectedDoc && !selectedDoc.file.name.match(/\.pdf$/i) && (
                    <div className={s.previewEmptySub}>Only .xlsx / .xls files preview inline</div>
                  )}
                  {selectedDoc && (
                    <button
                      className={selectedDoc.fixed ? s.btnSecondary : s.btnGreen}
                      style={{ marginTop: 12 }}
                      onClick={() => toggleFix(selectedDoc.id)}
                    >
                      {selectedDoc.fixed ? '✓ Verified' : '✓ Mark as Verified'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Digital Signature ──────────────────────────────────────────── */}
        {allFixed && (
          <div className={s.sigSection}>
            <div className={s.sectionDivider}>Digital Signature</div>
            <p className={s.stepCardSub} style={{ marginBottom: 10 }}>
              Draw your signature below to certify Level 1 is complete.
            </p>
            <div className={s.sigWrap}>
              <canvas
                ref={canvasRef}
                className={`${s.sigCanvas} ${sigApplied ? s.sigCanvasApplied : ''}`}
                width={480}
                height={120}
              />
              {sigApplied && (
                <div className={s.sigAppliedBadge}>✓ Signature Applied</div>
              )}
            </div>
            <div className={s.sigActions}>
              <button className={s.btnSecondary} onClick={() => { clearCanvas(); setSigApplied(false); }}>
                Clear
              </button>
              {!sigApplied && (
                <button
                  className={s.btnPrimary}
                  disabled={!hasSign}
                  onClick={applySignature}
                >
                  Apply Signature →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className={s.stepActions}>
          <button className={s.btnSecondary} onClick={onBack}>← Back</button>
          <button
            className={s.btnPrimary}
            disabled={!canContinue}
            onClick={handleContinue}
            title={!canContinue ? 'Verify all documents and apply your signature first' : ''}
          >
            Continue to Level 2 →
          </button>
        </div>

        {!canContinue && docs.length > 0 && (
          <div className={s.validationBanner}>
            <span className={s.validationHint}>
              {!allFixed
                ? `Verify all ${docs.length} documents first (${fixedCount} done)`
                : 'Draw and apply your digital signature to continue'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
