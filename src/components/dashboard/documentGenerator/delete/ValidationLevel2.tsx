/**
 * ValidationLevel2.tsx
 *
 * Level 2 — Live Register Comparison
 *
 * Layout: Split pane
 *   LEFT  — list of uploaded docs + inline spreadsheet viewer
 *   RIGHT — LiveRegister component (the full floating spreadsheet viewer
 *           from your existing codebase, rendered inline here)
 *
 * Flow:
 *  1. User picks a document from the left panel
 *  2. Document data renders in left pane as a table
 *  3. LiveRegister loads the master / live data on the right
 *  4. User compares, then clicks "Verified ✓" on each doc
 *  5. Once all verified → "Agree & Continue to Level 3" banner appears
 *  6. Clicking that opens TermsModal (level 2), then calls onComplete
 */

import { useState } from 'react';
import * as XLSX from 'xlsx';
import s from './Validation.module.css';
import TermsModal from './TermsModal';
import type { UploadedDoc } from './ValidationLevel1';

interface ValidationLevel2Props {
  docs: UploadedDoc[];
  liveRegisterFile: File | null;  // the master .xlsx used for generation
  companyName?: string;
  onComplete: () => void;
  onBack: () => void;
}

interface SheetPreview {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

async function parseXlsx(file: File): Promise<SheetPreview[]> {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames.map(name => {
    const ws  = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null });
    return {
      name,
      headers: (raw[0] ?? []).map(c => String(c ?? '')),
      rows: (raw.slice(1) as (string | number | null)[][]).slice(0, 100),
    };
  });
}

export default function ValidationLevel2({
  docs,
  liveRegisterFile,
  companyName = 'Company',
  onComplete,
  onBack,
}: ValidationLevel2Props) {
  const [verified, setVerified]   = useState<Set<string>>(new Set());
  const [activeDoc, setActiveDoc] = useState<string | null>(docs[0]?.id ?? null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [liveSheets, setLiveSheets]   = useState<SheetPreview[] | null>(null);
  const [liveSheet, setLiveSheet]     = useState(0);
  const [loadingLive, setLoadingLive] = useState(false);
  const [showTerms, setShowTerms]     = useState(false);

  const allVerified = docs.length > 0 && verified.size === docs.length;
  const selectedDoc = docs.find(d => d.id === activeDoc);

  function toggleVerify(id: string) {
    setVerified(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function loadLiveRegister() {
    if (!liveRegisterFile || liveSheets) return;
    setLoadingLive(true);
    try {
      const sheets = await parseXlsx(liveRegisterFile);
      setLiveSheets(sheets);
    } catch {
      // ignore
    } finally {
      setLoadingLive(false);
    }
  }

  // Auto-load live register when component mounts
  useState(() => { loadLiveRegister(); });

  return (
    <div className={s.page}>
      {/* Step bar */}
      <div className={s.stepBar}>
        {(['L1 Upload', 'L2 Compare', 'L3 Audit'] as const).map((label, i) => (
          <div key={label} className={s.stepBarItem}>
            {i > 0 && <div className={`${s.stepLine} ${i <= 1 ? s.stepLineDone : ''}`} />}
            <div className={`${s.stepDot} ${i === 0 ? s.stepDotDone : i === 1 ? s.stepDotActive : ''}`}>
              {i === 0 ? '✓' : i + 1}
            </div>
            <span className={`${s.stepLabel} ${i === 1 ? s.stepLabelActive : ''}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className={s.stepCard}>
        <div className={s.stepCardHeader}>
          <div className={s.stepCardIcon}>🔍</div>
          <div>
            <h2 className={s.stepCardTitle}>Level 2 — Live Register Comparison</h2>
            <p className={s.stepCardSub}>
              Review each document against the Live Register. Verify accuracy side-by-side and mark each document as confirmed.
            </p>
          </div>
        </div>

        {/* Verify banner */}
        {allVerified && (
          <div className={s.verifyBanner}>
            <div className={s.verifyBannerText}>
              ✅ All {docs.length} documents verified. Click below to agree and proceed to the auditor review.
            </div>
            <button className={s.btnGreen} onClick={() => setShowTerms(true)}>
              Agree &amp; Continue to Level 3 →
            </button>
          </div>
        )}

        {/* Split layout */}
        <div className={s.splitLayout}>

          {/* LEFT — Document list + viewer */}
          <div className={s.splitPane}>
            <div className={s.splitPaneHeader}>
              <span className={s.splitPaneTitle}>Your Documents</span>
              <span className={s.splitPaneBadge}>{verified.size}/{docs.length} verified</span>
            </div>

            {/* Doc thumbnails */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #E5E2F0' }}>
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className={`${s.docThumb} ${activeDoc === doc.id ? s.docThumbActive : ''} ${verified.has(doc.id) ? s.docThumbFixed : ''}`}
                  onClick={() => { setActiveDoc(doc.id); setActiveSheet(0); }}
                >
                  <span className={s.docThumbIcon}>
                    {doc.file.name.match(/\.pdf$/i) ? '📄' : '📊'}
                  </span>
                  <span className={s.docThumbName}>{doc.name}</span>
                  <span className={`${s.docThumbStatus} ${verified.has(doc.id) ? s.thumbStatusOk : s.thumbStatusPend}`}>
                    {verified.has(doc.id) ? '✓ Verified' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>

            {/* Document viewer */}
            {selectedDoc?.sheets ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                <div className={s.previewPane}>
                  <table className={s.sheetTable}>
                    <thead>
                      <tr>{selectedDoc.sheets[activeSheet]?.headers.map((h, i) => <th key={i}>{h || `Col ${i + 1}`}</th>)}</tr>
                    </thead>
                    <tbody>
                      {selectedDoc.sheets[activeSheet]?.rows.map((row, ri) => (
                        <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell ?? ''}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Verify button */}
                <div style={{ padding: '10px 12px', borderTop: '1px solid #E5E2F0', display: 'flex', gap: 8 }}>
                  <button
                    className={verified.has(selectedDoc.id) ? s.btnSecondary : s.btnGreen}
                    onClick={() => toggleVerify(selectedDoc.id)}
                    style={{ flex: 1 }}
                  >
                    {verified.has(selectedDoc.id) ? '✓ Verified — Click to unmark' : '✓ Mark as Verified'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={s.previewEmpty}>
                <div className={s.previewEmptyIcon}>📂</div>
                <div className={s.previewEmptyText}>Select a document to preview</div>
                <div className={s.previewEmptySub}>Click any document above</div>
              </div>
            )}
          </div>

          {/* RIGHT — Live Register */}
          <div className={s.splitPane}>
            <div className={s.splitPaneHeader}>
              <span className={s.splitPaneTitle}>Live Register</span>
              <span className={s.splitPaneBadge} style={{ background: '#D1FAE5', color: '#065F46' }}>Master Data</span>
            </div>

            {liveSheets ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className={s.sheetTabs}>
                  {liveSheets.map((sh, i) => (
                    <button
                      key={i}
                      className={`${s.sheetTab} ${liveSheet === i ? s.sheetTabActive : ''}`}
                      onClick={() => setLiveSheet(i)}
                    >
                      {sh.name}
                    </button>
                  ))}
                </div>
                <div className={s.previewPane}>
                  <table className={s.sheetTable}>
                    <thead>
                      <tr>{liveSheets[liveSheet]?.headers.map((h, i) => <th key={i}>{h || `Col ${i + 1}`}</th>)}</tr>
                    </thead>
                    <tbody>
                      {liveSheets[liveSheet]?.rows.map((row, ri) => (
                        <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell ?? ''}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : loadingLive ? (
              <div className={s.previewEmpty}>
                <div className={s.previewEmptyIcon}>⏳</div>
                <div className={s.previewEmptyText}>Loading Live Register…</div>
              </div>
            ) : (
              <div className={s.previewEmpty}>
                <div className={s.previewEmptyIcon}>📋</div>
                <div className={s.previewEmptyText}>No master file loaded</div>
                <div className={s.previewEmptySub}>
                  The master .xlsx used during generation will appear here.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={s.stepActions}>
          <button className={s.btnSecondary} onClick={onBack}>← Back to Level 1</button>
          {allVerified && (
            <button className={s.btnGreen} onClick={() => setShowTerms(true)}>
              Agree &amp; Continue to Level 3 →
            </button>
          )}
        </div>
      </div>

      {showTerms && (
        <TermsModal
          level={2}
          onAgree={() => { setShowTerms(false); onComplete(); }}
          onClose={() => setShowTerms(false)}
        />
      )}
    </div>
  );
}
