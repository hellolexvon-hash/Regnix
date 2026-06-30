/**
 * ValidationLevel1.tsx
 * Level 1 — Document Upload & Verification
 * Signature: type full name + agree self-declaration (no canvas)
 */

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import s from './Validation.module.css';
import type { UploadedDoc, SheetPreview } from './validationStore';

interface ValidationLevel1Props {
  onComplete: (docs: UploadedDoc[], signatureDataUrl: string) => void;
  onBack:     () => void;
}

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

export default function ValidationLevel1({ onComplete, onBack }: ValidationLevel1Props) {
  const [docs, setDocs]               = useState<UploadedDoc[]>([]);
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editName, setEditName]       = useState('');
  const [dragging, setDragging]       = useState(false);

  // Signature state
  const [sigName, setSigName]         = useState('');
  const [sigDecl, setSigDecl]         = useState(false);
  const [sigApplied, setSigApplied]   = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fixedCount  = docs.filter(d => d.fixed).length;
  const allFixed    = docs.length > 0 && fixedCount === docs.length;
  const sigValid    = sigName.trim().length >= 3 && sigDecl;
  const canContinue = allFixed && sigApplied;
  const selectedDoc = docs.find(d => d.id === activeId);

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
  function startEdit(doc: UploadedDoc) { setEditingId(doc.id); setEditName(doc.name); }
  function saveEdit(id: string) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, name: editName.trim() || d.name } : d));
    setEditingId(null);
  }
  function applySignature() {
    if (!sigValid) return;
    setSigApplied(true);
  }
  function handleContinue() {
    if (!canContinue) return;
    onComplete(docs, `typed:${sigName.trim()}`);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div className={s.page}>

      {/* Step bar */}
      <div className={s.stepBar}>
        {(['L1 Upload & Sign', 'L2 AI Validation', 'L3 Audit'] as const).map((label, i) => (
          <div key={label} className={s.stepBarItem}>
            {i > 0 && <div className={s.stepLine} />}
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
              Upload all statutory registers. Preview, rename, and mark each as verified before signing.
            </p>
          </div>
          {docs.length > 0 && (
            <div className={s.l2VerifyCount}>
              <span className={s.l2VerifyNum}>{fixedCount}/{docs.length}</span>
              <span className={s.l2VerifyLabel}>verified</span>
            </div>
          )}
        </div>

        {/* Progress */}
        {docs.length > 0 && (
          <div className={s.l1Progress}>
            <div className={s.l1ProgressBar}>
              <div className={s.l1ProgressFill} style={{ width: `${(fixedCount / docs.length) * 100}%` }} />
            </div>
            <span className={s.l1ProgressLabel}>{fixedCount} / {docs.length} verified</span>
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
          <input ref={fileInputRef} type="file" multiple accept=".xlsx,.xls,.pdf,.zip"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
          />
          <div className={s.dropzoneIcon}>📂</div>
          <div className={s.dropzoneText}>Drop register files here, or click to browse</div>
          <div className={s.dropzoneSub}>.xlsx · .xls · .pdf · .zip — multiple files supported</div>
        </div>

        {/* Doc list + preview */}
        {docs.length > 0 && (
          <div className={s.l1Layout}>
            {/* Left */}
            <div className={s.l1DocList}>
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className={`${s.l1DocRow} ${activeId === doc.id ? s.l1DocRowActive : ''} ${doc.fixed ? s.l1DocRowFixed : ''}`}
                  onClick={() => { setActiveId(doc.id); setActiveSheet(0); }}
                >
                  <span className={s.l1DocIcon}>{doc.file.name.match(/\.pdf$/i) ? '📄' : '📊'}</span>
                  {editingId === doc.id ? (
                    <input className={s.l1DocNameEdit} value={editName} autoFocus
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => saveEdit(doc.id)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(doc.id); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={s.l1DocName} title={doc.name}>{doc.name}</span>
                  )}
                  <div className={s.l1DocActions}>
                    {!editingId && (
                      <button className={s.l1ActionBtn} title="Rename"
                        onClick={e => { e.stopPropagation(); startEdit(doc); }}>✏️</button>
                    )}
                    <button
                      className={`${s.l1ActionBtn} ${doc.fixed ? s.l1ActionBtnFixed : s.l1ActionBtnFix}`}
                      onClick={e => { e.stopPropagation(); toggleFix(doc.id); }}
                    >{doc.fixed ? '✓' : 'Fix'}</button>
                    <button className={s.l1ActionBtn}
                      onClick={e => { e.stopPropagation(); removeDoc(doc.id); }}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: preview */}
            <div className={s.l1Preview}>
              {selectedDoc?.sheets ? (
                <>
                  {selectedDoc.sheets.length > 1 && (
                    <div className={s.sheetTabs}>
                      {selectedDoc.sheets.map((sh, i) => (
                        <button key={i}
                          className={`${s.sheetTab} ${activeSheet === i ? s.sheetTabActive : ''}`}
                          onClick={() => setActiveSheet(i)}>{sh.name}</button>
                      ))}
                    </div>
                  )}
                  <div className={s.previewPane}>
                    <table className={s.sheetTable}>
                      <thead><tr>
                        {selectedDoc.sheets[activeSheet]?.headers.map((h, i) => <th key={i}>{h || `Col ${i + 1}`}</th>)}
                      </tr></thead>
                      <tbody>
                        {selectedDoc.sheets[activeSheet]?.rows.map((row, ri) => (
                          <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell ?? ''}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={s.l1FixBar}>
                    <button className={selectedDoc.fixed ? s.btnSecondary : s.btnGreen}
                      onClick={() => toggleFix(selectedDoc.id)} style={{ flex: 1 }}>
                      {selectedDoc.fixed ? '✓ Verified — click to unmark' : '✓ Mark as Verified'}
                    </button>
                  </div>
                </>
              ) : (
                <div className={s.previewEmpty}>
                  <div className={s.previewEmptyIcon}>{selectedDoc?.file.name.match(/\.pdf$/i) ? '📄' : '📊'}</div>
                  <div className={s.previewEmptyText}>
                    {selectedDoc ? 'PDF preview not available. Mark as verified below.' : 'Select a document to preview'}
                  </div>
                  {selectedDoc && (
                    <button className={selectedDoc.fixed ? s.btnSecondary : s.btnGreen}
                      style={{ marginTop: 12 }} onClick={() => toggleFix(selectedDoc.id)}>
                      {selectedDoc.fixed ? '✓ Verified' : '✓ Mark as Verified'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Digital Signature — type name + declaration ─────────────────── */}
        {allFixed && (
          <div className={s.sigSection}>
            <div className={s.sectionDivider}>Digital Signature &amp; Declaration</div>

            {!sigApplied ? (
              <>
                <p className={s.stepCardSub} style={{ marginBottom: 14 }}>
                  Type your full name as it appears in official records. This constitutes your digital signature under the IT Act 2000.
                </p>

                {/* Name input */}
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
                    <div className={s.sigNamePreview} style={{ fontFamily: 'Georgia, serif' }}>
                      {sigName}
                    </div>
                  )}
                </div>

                {/* Declaration checkbox */}
                <label className={s.sigDeclRow}>
                  <input type="checkbox" checked={sigDecl} onChange={e => setSigDecl(e.target.checked)} />
                  <span className={s.sigDeclText}>
                    I, <strong>{sigName.trim() || '[ your name ]'}</strong>, hereby declare that all documents uploaded are authentic, accurate, and created in compliance with applicable Indian labour laws. I understand that this typed name constitutes my legal digital signature and that any misrepresentation is subject to action under the IT Act 2000 and applicable labour legislation.
                  </span>
                </label>

                <div className={s.sigActions}>
                  <button className={s.btnPrimary} disabled={!sigValid} onClick={applySignature}>
                    ✍ Apply Digital Signature →
                  </button>
                </div>
              </>
            ) : (
              <div className={s.sigAppliedCard}>
                <div className={s.sigAppliedIcon}>✅</div>
                <div>
                  <div className={s.sigAppliedName} style={{ fontFamily: 'Georgia, serif' }}>{sigName}</div>
                  <div className={s.sigAppliedMeta}>
                    Digitally signed on {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · IT Act 2000
                  </div>
                </div>
                <button className={s.sigResetBtn} onClick={() => { setSigApplied(false); setSigDecl(false); }}>
                  Change
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className={s.stepActions}>
          <button className={s.btnSecondary} onClick={onBack}>← Back</button>
          <button className={s.btnPrimary} disabled={!canContinue} onClick={handleContinue}
            title={!canContinue ? (docs.length === 0 ? 'Upload documents first' : !allFixed ? 'Verify all documents' : 'Apply digital signature') : ''}>
            Continue to Level 2 →
          </button>
        </div>

        {!canContinue && docs.length > 0 && (
          <div className={s.validationBanner}>
            <span className={s.validationHint}>
              {!allFixed
                ? `Verify all ${docs.length} documents (${fixedCount} done)`
                : !sigApplied ? 'Apply your digital signature to continue' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
