/**
 * ValidationLevel2.tsx
 *
 * Level 2 — Live Register Comparison
 *
 * Split pane:
 *   LEFT  — uploaded docs list + inline XLSX viewer
 *   RIGHT — master/live register viewer
 *
 * All docs must be individually marked "Verified" before the
 * "Agree & Continue to Level 3" action appears.
 */

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import s from './Validation.module.css';
import TermsModal from './TermsModal';
import type { UploadedDoc, SheetPreview } from './validationStore';

interface ValidationLevel2Props {
  docs:             UploadedDoc[];
  liveRegisterFile: File | null;
  companyName?:     string;
  onComplete:       () => void;
  onBack:           () => void;
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
      rows:    (raw.slice(1) as (string | number | null)[][]).slice(0, 100),
    };
  });
}

function SheetTable({ sheets, activeSheet, onTabChange }: {
  sheets:        SheetPreview[];
  activeSheet:   number;
  onTabChange:   (i: number) => void;
}) {
  const sheet = sheets[activeSheet];
  if (!sheet) return null;
  return (
    <>
      {sheets.length > 1 && (
        <div className={s.sheetTabs}>
          {sheets.map((sh, i) => (
            <button
              key={i}
              className={`${s.sheetTab} ${activeSheet === i ? s.sheetTabActive : ''}`}
              onClick={() => onTabChange(i)}
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
              {sheet.headers.map((h, i) => <th key={i}>{h || `Col ${i + 1}`}</th>)}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => <td key={ci}>{cell ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function ValidationLevel2({
  docs,
  liveRegisterFile,
  companyName = 'Company',
  onComplete,
  onBack,
}: ValidationLevel2Props) {
  const [verified,    setVerified]    = useState<Set<string>>(new Set());
  const [activeDoc,   setActiveDoc]   = useState<string | null>(docs[0]?.id ?? null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [liveSheets,  setLiveSheets]  = useState<SheetPreview[] | null>(null);
  const [liveSheet,   setLiveSheet]   = useState(0);
  const [loadingLive, setLoadingLive] = useState(false);
  const [showTerms,   setShowTerms]   = useState(false);

  const allVerified  = docs.length > 0 && verified.size === docs.length;
  const selectedDoc  = docs.find(d => d.id === activeDoc);

  // Auto-load live register on mount
  useEffect(() => {
    if (!liveRegisterFile || liveSheets) return;
    setLoadingLive(true);
    parseXlsx(liveRegisterFile)
      .then(sheets => setLiveSheets(sheets))
      .catch(() => {})
      .finally(() => setLoadingLive(false));
  }, [liveRegisterFile]);

  function toggleVerify(id: string) {
    setVerified(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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

      <div className={s.stepCard}>
        <div className={s.stepCardHeader}>
          <div className={s.stepCardIcon}>🔍</div>
          <div className={s.stepCardHeaderText}>
            <h2 className={s.stepCardTitle}>Level 2 — Live Register Comparison</h2>
            <p className={s.stepCardSub}>
              Review each document against the Live Register. Verify accuracy side-by-side and mark each document as confirmed.
            </p>
          </div>
          <div className={s.l2VerifyCount}>
            <span className={s.l2VerifyNum}>{verified.size}/{docs.length}</span>
            <span className={s.l2VerifyLabel}>verified</span>
          </div>
        </div>

        {/* All verified banner */}
        {allVerified && (
          <div className={s.verifyBanner}>
            <span className={s.verifyBannerText}>
              ✅ All {docs.length} documents verified.
            </span>
            <button className={s.btnGreen} onClick={() => setShowTerms(true)}>
              Agree &amp; Continue to Level 3 →
            </button>
          </div>
        )}

        {/* Split pane */}
        <div className={s.splitLayout}>

          {/* ── LEFT: doc list + viewer ──────────────────────────────── */}
          <div className={s.splitPane}>
            <div className={s.splitPaneHeader}>
              <span className={s.splitPaneTitle}>Your Documents</span>
              <span className={s.splitPaneBadge}>{verified.size}/{docs.length} verified</span>
            </div>

            {/* Doc thumbnails */}
            <div className={s.l2DocList}>
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
                    {verified.has(doc.id) ? '✓' : '○'}
                  </span>
                </div>
              ))}
            </div>

            {/* Viewer */}
            {selectedDoc?.sheets ? (
              <>
                <SheetTable
                  sheets={selectedDoc.sheets}
                  activeSheet={activeSheet}
                  onTabChange={setActiveSheet}
                />
                <div className={s.l1FixBar}>
                  <button
                    className={verified.has(selectedDoc.id) ? s.btnSecondary : s.btnGreen}
                    onClick={() => toggleVerify(selectedDoc.id)}
                    style={{ flex: 1 }}
                  >
                    {verified.has(selectedDoc.id) ? '✓ Verified — click to unmark' : '✓ Mark as Verified'}
                  </button>
                </div>
              </>
            ) : (
              <div className={s.previewEmpty}>
                <div className={s.previewEmptyIcon}>📂</div>
                <div className={s.previewEmptyText}>Select a document to preview</div>
                {selectedDoc && (
                  <button
                    className={verified.has(selectedDoc.id) ? s.btnSecondary : s.btnGreen}
                    style={{ marginTop: 12 }}
                    onClick={() => toggleVerify(selectedDoc.id)}
                  >
                    {verified.has(selectedDoc.id) ? '✓ Verified' : '✓ Mark as Verified'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: live register ─────────────────────────────────── */}
          <div className={s.splitPane}>
            <div className={s.splitPaneHeader}>
              <span className={s.splitPaneTitle}>Live Register</span>
              <span className={s.splitPaneBadge} style={{ background: '#D1FAE5', color: '#065F46' }}>
                Master Data
              </span>
            </div>

            {liveSheets ? (
              <SheetTable
                sheets={liveSheets}
                activeSheet={liveSheet}
                onTabChange={setLiveSheet}
              />
            ) : loadingLive ? (
              <div className={s.previewEmpty}>
                <div className={s.previewEmptyIcon}>⏳</div>
                <div className={s.previewEmptyText}>Loading Live Register…</div>
              </div>
            ) : (
              <div className={s.previewEmpty}>
                <div className={s.previewEmptyIcon}>📋</div>
                <div className={s.previewEmptyText}>No master file available</div>
                <div className={s.previewEmptySub}>
                  The master .xlsx used during generation loads here automatically from your session.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={s.stepActions}>
          <button className={s.btnSecondary} onClick={onBack}>← Back</button>
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
