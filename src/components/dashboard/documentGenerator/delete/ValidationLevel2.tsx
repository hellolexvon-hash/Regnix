/**
 * ValidationLevel2.tsx
 *
 * L2 Compliance Intelligence Workspace
 * Matches the reference UI exactly:
 *   LEFT   — Document Checklist (cards with upload status, risk badge)
 *   CENTER — Uploaded Doc viewer + System Register viewer (split) + Issue table
 *   RIGHT  — AI Review Assistant (scores, issues, root cause, revalidation)
 *   BOTTOM — Sticky Executive Dashboard KPIs
 */

import { useState, useEffect, useRef } from 'react';
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

// ── Types ─────────────────────────────────────────────────────────────────────

type UploadStatus   = 'Uploaded' | 'Pending' | 'Not Applicable';
type ValidationResult = 'Correct' | 'Incorrect' | 'Needs Review' | 'ATP';
type RiskLevel      = 'High' | 'Medium' | 'Low';
type IssueStatus    = 'Action Required' | 'Resolved' | 'Pending';

interface DocCard {
  id:               string;
  name:             string;
  act:              string;
  uploadStatus:     UploadStatus;
  validationResult: ValidationResult;
  riskLevel:        RiskLevel;
  score:            number;
  file?:            File;
  sheets?:          SheetPreview[];
}

interface ComplianceIssue {
  id:            string;
  severity:      RiskLevel;
  docName:       string;
  field:         string;
  expected:      string;
  uploaded:      string;
  diff:          string;
  rootCause:     string;
  suggestedFix:  string;
  category:      string;
  status:        IssueStatus;
  reviewerRemark: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function riskColor(r: RiskLevel) {
  if (r === 'High')   return { bg: '#FEE2E2', color: '#B91C1C' };
  if (r === 'Medium') return { bg: '#FEF3C7', color: '#92400E' };
  return                     { bg: '#D1FAE5', color: '#065F46' };
}

const ISSUE_CATEGORIES = [
  'Delay Payment', 'Incorrect Amount', 'UAN Mismatch', 'Wrong Employee',
  'Duplicate Employee', 'Calculation Error', 'Wrong Registration Number',
  'Missing Employee', 'Document Missing', 'Wrong Period', 'Invalid Document',
  'Incorrect Headcount', 'Others',
];

const REQUIRED_DOCS: Omit<DocCard, 'id' | 'file' | 'sheets'>[] = [
  { name: 'PF Payment Confirmation Challan', act: 'PF Act',  uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'High',   score: 0   },
  { name: 'PF Combined Challan',             act: 'PF Act',  uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'High',   score: 0   },
  { name: 'PF ECR',                          act: 'PF Act',  uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'High',   score: 0   },
  { name: 'ESIC Challan',                    act: 'ESIC Act',uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'High',   score: 0   },
  { name: 'ESIC ECR',                        act: 'ESIC Act',uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'High',   score: 0   },
  { name: 'Bank Advice',                     act: 'Wages',   uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'Medium', score: 0   },
  { name: 'Wage Slip',                       act: 'Wages',   uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'Medium', score: 0   },
  { name: 'CLRA Registration/Licence',       act: 'CLRA',    uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'High',   score: 0   },
  { name: 'Shops & Establishments Licence',  act: 'S&E',     uploadStatus: 'Not Applicable', validationResult: 'ATP', riskLevel: 'Low', score: 100 },
  { name: 'BOCW Registration/Licence',       act: 'BOCW',    uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'High',   score: 0   },
  { name: 'GSTIN',                           act: 'GST',     uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'Medium', score: 0   },
  { name: 'LWF Payment Paid Receipt',        act: 'LWF',     uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'Low',    score: 0   },
  { name: 'PT Receipt',                      act: 'PT',      uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'Low',    score: 0   },
  { name: 'Declaration Documents',           act: 'General', uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'Low',    score: 0   },
  { name: 'Other Statutory Documents',       act: 'General', uploadStatus: 'Pending', validationResult: 'ATP', riskLevel: 'Medium', score: 0   },
];

// ── Mock AI issues generator (runs after upload) ──────────────────────────────
function generateMockIssues(docName: string): ComplianceIssue[] {
  const mockData: ComplianceIssue[] = [
    {
      id: `${docName}-1`, severity: 'High', docName, field: 'UAN Number',
      expected: 'UAN-100123456789', uploaded: 'UAN-100987654321',
      diff: 'Last 6 digits mismatch',
      rootCause: 'Employee UAN seeded incorrectly in master register.',
      suggestedFix: 'Cross-verify UAN with EPFO member portal and update master.',
      category: 'UAN Mismatch', status: 'Action Required', reviewerRemark: '',
    },
    {
      id: `${docName}-2`, severity: 'High', docName, field: 'Gross Wages',
      expected: '₹28,500', uploaded: '₹26,000',
      diff: '₹2,500 short',
      rootCause: 'Overtime allowance not included in wage calculation.',
      suggestedFix: 'Recalculate wages including OT and reissue payment advice.',
      category: 'Incorrect Amount', status: 'Action Required', reviewerRemark: '',
    },
    {
      id: `${docName}-3`, severity: 'Medium', docName, field: 'Payment Date',
      expected: '31 May 2024', uploaded: '5 Jun 2024',
      diff: '5 days late',
      rootCause: 'Payment processing delay due to bank holiday.',
      suggestedFix: 'Ensure wages are paid by 30th/last working day as per law.',
      category: 'Delay Payment', status: 'Action Required', reviewerRemark: '',
    },
  ];
  return mockData;
}

// ── SheetTable ────────────────────────────────────────────────────────────────
function SheetTable({ sheets, activeSheet, onTabChange }: {
  sheets: SheetPreview[]; activeSheet: number; onTabChange: (i: number) => void;
}) {
  const sheet = sheets[activeSheet];
  if (!sheet) return null;
  return (
    <>
      {sheets.length > 1 && (
        <div className={s.sheetTabs}>
          {sheets.map((sh, i) => (
            <button key={i} className={`${s.sheetTab} ${activeSheet === i ? s.sheetTabActive : ''}`}
              onClick={() => onTabChange(i)}>{sh.name}</button>
          ))}
        </div>
      )}
      <div className={s.previewPane}>
        <table className={s.sheetTable}>
          <thead><tr>{sheet.headers.map((h, i) => <th key={i}>{h || `Col ${i + 1}`}</th>)}</tr></thead>
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell ?? ''}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ValidationLevel2({
  docs, liveRegisterFile, companyName = 'Company', onComplete, onBack,
}: ValidationLevel2Props) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [docCards, setDocCards]       = useState<DocCard[]>(() =>
    REQUIRED_DOCS.map((d, i) => ({ ...d, id: `req-${i}` }))
  );
  const [activeCard, setActiveCard]   = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [liveSheets, setLiveSheets]   = useState<SheetPreview[] | null>(null);
  const [liveSheet, setLiveSheet]     = useState(0);
  const [issues, setIssues]           = useState<ComplianceIssue[]>([]);
  const [showTerms, setShowTerms]     = useState(false);
  const [aiRunning, setAiRunning]     = useState<string | null>(null);
  const [revalQueue, setRevalQueue]   = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({});
  const [reviewRemarks, setReviewRemarks]        = useState<Record<string, string>>({});

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalDocs    = docCards.length;
  const uploaded     = docCards.filter(d => d.uploadStatus === 'Uploaded').length;
  const pending      = docCards.filter(d => d.uploadStatus === 'Pending').length;
  const notAppl      = docCards.filter(d => d.uploadStatus === 'Not Applicable').length;
  const validated    = docCards.filter(d => d.validationResult !== 'ATP').length;
  const openIssues   = issues.filter(i => i.status === 'Action Required').length;
  const highRisk     = issues.filter(i => i.severity === 'High').length;
  const medRisk      = issues.filter(i => i.severity === 'Medium').length;
  const lowRisk      = issues.filter(i => i.severity === 'Low').length;
  const totalRecords = 1431;
  const matched      = Math.max(0, totalRecords - issues.length * 12);
  const compScore    = uploaded === 0 ? 0 : Math.round(((uploaded - openIssues * 0.5) / totalDocs) * 100);
  const aiConfidence = uploaded > 0 ? 89.5 : 0;
  const allApproved  = docCards.every(d => d.uploadStatus === 'Uploaded' || d.uploadStatus === 'Not Applicable');

  const selectedCardData = docCards.find(d => d.id === activeCard);

  // Load live register
  useEffect(() => {
    if (!liveRegisterFile) return;
    parseXlsx(liveRegisterFile).then(setLiveSheets).catch(() => {});
  }, [liveRegisterFile]);

  // Pre-map uploaded docs from L1
  useEffect(() => {
    if (!docs.length) return;
    setDocCards(prev => {
      const updated = [...prev];
      docs.forEach((ud, i) => {
        if (i < updated.length) {
          updated[i] = {
            ...updated[i],
            uploadStatus: 'Uploaded',
            file: ud.file,
            sheets: ud.sheets,
            score: Math.floor(Math.random() * 15) + 85,
          };
        }
      });
      return updated;
    });
    // Set first as active
    if (docs.length > 0) setActiveCard('req-0');
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleFileUpload(cardId: string, files: FileList | null) {
    if (!files?.length) return;
    const file   = files[0];
    const sheets = file.name.match(/\.xlsx?$/i) ? await parseXlsx(file).catch(() => undefined) : undefined;

    setDocCards(prev => prev.map(d => d.id === cardId
      ? { ...d, uploadStatus: 'Uploaded', file, sheets, score: Math.floor(Math.random() * 15) + 82 }
      : d
    ));

    // Simulate AI processing
    setAiRunning(cardId);
    setTimeout(() => {
      setAiRunning(null);
      const card = docCards.find(d => d.id === cardId);
      if (card) {
        const newIssues = generateMockIssues(card.name);
        setIssues(prev => [...prev.filter(i => i.docName !== card.name), ...newIssues]);
        setDocCards(prev => prev.map(d => d.id === cardId
          ? { ...d, validationResult: newIssues.length > 0 ? 'Needs Review' : 'Correct' }
          : d
        ));
      }
    }, 1800);

    setActiveCard(cardId);
  }

  function toggleNotApplicable(cardId: string) {
    setDocCards(prev => prev.map(d => d.id === cardId
      ? { ...d, uploadStatus: d.uploadStatus === 'Not Applicable' ? 'Pending' : 'Not Applicable', validationResult: 'ATP' }
      : d
    ));
  }

  function markIssueResolved(issueId: string) {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: 'Resolved' } : i));
  }

  function sendToRevalidation(issueId: string, docName: string) {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: 'Pending' } : i));
    if (!revalQueue.includes(docName)) setRevalQueue(prev => [...prev, docName]);
  }

  function updateCategory(issueId: string, cat: string) {
    setSelectedCategory(prev => ({ ...prev, [issueId]: cat }));
  }

  function updateRemark(issueId: string, remark: string) {
    setReviewRemarks(prev => ({ ...prev, [issueId]: remark }));
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, reviewerRemark: remark } : i));
  }

  const cardIssues = issues.filter(i => i.docName === selectedCardData?.name);

  return (
    <div className={s.page}>
      {/* Step bar */}
      <div className={s.stepBar}>
        {(['L1 Upload & Sign', 'L2 AI Validation', 'L3 Audit'] as const).map((label, i) => (
          <div key={label} className={s.stepBarItem}>
            {i > 0 && <div className={`${s.stepLine} ${i === 1 ? '' : s.stepLineDone}`} />}
            <div className={`${s.stepDot} ${i === 0 ? s.stepDotDone : i === 1 ? s.stepDotActive : ''}`}>
              {i === 0 ? '✓' : i + 1}
            </div>
            <span className={`${s.stepLabel} ${i === 1 ? s.stepLabelActive : ''}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Breadcrumb nav ────────────────────────────────────────────────── */}
      <div className={s.l2Breadcrumb}>
        <span className={s.l2BreadcrumbActive}>Upload</span>
        <span className={s.l2BreadcrumbSep}>→</span>
        <span className={s.l2BreadcrumbActive}>Validation</span>
        <span className={s.l2BreadcrumbSep}>→</span>
        <span>Revalidation</span>
        <span className={s.l2BreadcrumbSep}>→</span>
        <span>Approval</span>
        <span className={s.l2BreadcrumbSep}>→</span>
        <span>Completed</span>
      </div>

      {/* ── Main 3-column layout ─────────────────────────────────────────── */}
      <div className={s.l2MainLayout}>

        {/* ══ LEFT — Document Checklist ══════════════════════════════════ */}
        <div className={s.l2Left}>
          <div className={s.l2PanelHeader}>
            <span className={s.l2PanelTitle}>Compliance Document Checklist</span>
            <span className={s.l2PanelBadge}>{totalDocs}</span>
          </div>

          <div className={s.l2DocGrid}>
            {docCards.map(card => {
              const rc = riskColor(card.riskLevel);
              const isActive = activeCard === card.id;
              const isRunning = aiRunning === card.id;
              return (
                <div
                  key={card.id}
                  className={`${s.l2DocCard} ${isActive ? s.l2DocCardActive : ''} ${card.uploadStatus === 'Uploaded' ? s.l2DocCardUploaded : ''}`}
                  onClick={() => { setActiveCard(card.id); setActiveSheet(0); }}
                >
                  <div className={s.l2DocCardTop}>
                    <span className={s.l2DocCardIcon}>📄</span>
                    <span className={s.l2DocCardName}>{card.name}</span>
                    <button className={s.l2DocCardMenu} onClick={e => e.stopPropagation()}>⋯</button>
                  </div>

                  {/* Upload progress bar */}
                  <div className={s.l2DocCardBar}>
                    <div className={s.l2DocCardBarFill}
                      style={{ width: card.uploadStatus === 'Uploaded' ? '100%' : card.uploadStatus === 'Not Applicable' ? '100%' : '0%',
                        background: card.uploadStatus === 'Not Applicable' ? '#E5E2F0' : '#7C3AED' }} />
                  </div>

                  <div className={s.l2DocCardFooter}>
                    <span className={`${s.l2DocCardStatus}
                      ${card.uploadStatus === 'Uploaded' ? s.statusUploaded : ''}
                      ${card.uploadStatus === 'Pending'  ? s.statusPending2 : ''}
                      ${card.uploadStatus === 'Not Applicable' ? s.statusNA : ''}`}>
                      {isRunning ? '⏳ AI Processing…' : card.uploadStatus}
                    </span>
                    <span className={s.l2RiskBadge} style={{ background: rc.bg, color: rc.color }}>
                      {card.riskLevel}
                    </span>
                  </div>

                  {/* Upload button */}
                  {card.uploadStatus === 'Pending' && !isRunning && (
                    <div className={s.l2DocCardActions} onClick={e => e.stopPropagation()}>
                      <input
                        ref={el => { fileInputRefs.current[card.id] = el; }}
                        type="file" accept=".xlsx,.xls,.pdf"
                        style={{ display: 'none' }}
                        onChange={e => handleFileUpload(card.id, e.target.files)}
                      />
                      <button className={s.l2UploadBtn}
                        onClick={() => fileInputRefs.current[card.id]?.click()}>
                        ↑ Upload
                      </button>
                      <button className={s.l2NABtn} onClick={() => toggleNotApplicable(card.id)}>
                        N/A
                      </button>
                    </div>
                  )}
                  {card.uploadStatus === 'Not Applicable' && (
                    <div className={s.l2DocCardActions} onClick={e => e.stopPropagation()}>
                      <button className={s.l2NABtn} onClick={() => toggleNotApplicable(card.id)}>
                        Undo N/A
                      </button>
                    </div>
                  )}
                  {card.uploadStatus === 'Uploaded' && (
                    <div className={s.l2DocCardActions} onClick={e => e.stopPropagation()}>
                      <input
                        ref={el => { fileInputRefs.current[`replace-${card.id}`] = el; }}
                        type="file" accept=".xlsx,.xls,.pdf"
                        style={{ display: 'none' }}
                        onChange={e => handleFileUpload(card.id, e.target.files)}
                      />
                      <button className={s.l2ReplaceBtn}
                        onClick={() => fileInputRefs.current[`replace-${card.id}`]?.click()}>
                        ↻ Replace
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ══ CENTER — Viewer + Issue Table ══════════════════════════════ */}
        <div className={s.l2Center}>

          {/* Analytics bar */}
          <div className={s.l2Analytics}>
            <div className={s.l2StatChip}>
              <span className={s.l2StatLabel}>AI Confidence</span>
              <span className={s.l2StatVal} style={{ color: '#059669' }}>{aiConfidence > 0 ? `${aiConfidence}%` : '—'}</span>
            </div>
            <div className={s.l2StatChip}>
              <span className={s.l2StatLabel}>Total Records</span>
              <span className={s.l2StatVal}>{totalRecords.toLocaleString()}</span>
            </div>
            <div className={s.l2StatChip}>
              <span className={s.l2StatLabel}>Matched Records</span>
              <span className={s.l2StatVal} style={{ color: '#059669' }}>{matched.toLocaleString()}</span>
            </div>
            <div className={s.l2StatChip}>
              <span className={s.l2StatLabel}>Mismatches</span>
              <span className={s.l2StatVal} style={{ color: '#DC2626' }}>{openIssues}</span>
            </div>
            <div className={s.l2StatChip}>
              <span className={s.l2StatLabel}>Missing Records</span>
              <span className={s.l2StatVal}>0</span>
            </div>
            <div className={s.l2StatChip}>
              <span className={s.l2StatLabel}>Duplicate Records</span>
              <span className={s.l2StatVal}>0</span>
            </div>
          </div>

          {/* Split viewer */}
          <div className={s.l2SplitViewer}>
            {/* Left viewer: uploaded doc */}
            <div className={s.l2ViewerPane}>
              <div className={s.l2ViewerHeader}>
                <span className={s.l2ViewerTitle}>Uploaded Document</span>
                <div className={s.l2ViewerActions}>
                  <button className={s.l2ViewerBtn} title="Copy">⧉</button>
                  <button className={s.l2ViewerBtn} title="Download">⬇</button>
                  <button className={s.l2ViewerBtn} title="Fullscreen">⛶</button>
                </div>
              </div>
              {selectedCardData?.sheets ? (
                <SheetTable sheets={selectedCardData.sheets} activeSheet={activeSheet} onTabChange={setActiveSheet} />
              ) : (
                <div className={s.previewEmpty} style={{ minHeight: 200 }}>
                  <div className={s.previewEmptyIcon}>📄</div>
                  <div className={s.previewEmptyText}>
                    {selectedCardData
                      ? selectedCardData.uploadStatus === 'Pending'
                        ? 'Upload this document to preview'
                        : 'Non-Excel file — download to view'
                      : 'Select a document from the checklist'}
                  </div>
                </div>
              )}
            </div>

            {/* Right viewer: system register */}
            <div className={s.l2ViewerPane}>
              <div className={s.l2ViewerHeader}>
                <span className={s.l2ViewerTitle}>System Generated Register</span>
                <div className={s.l2ViewerActions}>
                  <button className={s.l2ViewerBtn}>⧉</button>
                  <button className={s.l2ViewerBtn}>⬇</button>
                  <button className={s.l2ViewerBtn}>⛶</button>
                </div>
              </div>
              {liveSheets ? (
                <SheetTable sheets={liveSheets} activeSheet={liveSheet} onTabChange={setLiveSheet} />
              ) : (
                <div className={s.previewEmpty} style={{ minHeight: 200 }}>
                  <div className={s.previewEmptyIcon}>📋</div>
                  <div className={s.previewEmptyText}>System register loads from your session</div>
                  <div className={s.previewEmptySub}>The master .xlsx used during generation appears here</div>
                </div>
              )}
            </div>
          </div>

          {/* Issue table */}
          {issues.length > 0 && (
            <div className={s.l2IssueSection}>
              <div className={s.l2IssueHeader}>
                <span className={s.l2PanelTitle}>Validation Issues</span>
                <span className={s.l2IssueBadge}>{openIssues} open</span>
              </div>
              <div className={s.l2IssueTableWrap}>
                <table className={s.l2IssueTable}>
                  <thead>
                    <tr>
                      <th>Upload Status</th>
                      <th>AI Comparison</th>
                      <th>Validation Result</th>
                      <th>Issue Category</th>
                      <th>Auditor Notes</th>
                      <th>Final Verdict</th>
                      <th>Risk Level</th>
                      <th>Action Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map(issue => (
                      <tr key={issue.id} className={issue.status === 'Resolved' ? s.l2IssueResolved : ''}>
                        <td>
                          <span className={`${s.l2StatusPill} ${s.statusUploaded}`}>Uploaded</span>
                        </td>
                        <td>
                          <span className={s.l2AtpBadge}>ATP</span>
                          <span className={s.l2AtpArrow}>▾</span>
                        </td>
                        <td>
                          <span className={`${s.l2ValidationPill} ${issue.status === 'Resolved' ? s.pillCorrect : s.pillValidated}`}>
                            ✔ Validated
                          </span>
                        </td>
                        <td>
                          <select
                            className={s.l2CategorySelect}
                            value={selectedCategory[issue.id] || issue.category}
                            onChange={e => updateCategory(issue.id, e.target.value)}
                          >
                            {ISSUE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            className={s.l2RemarkInput}
                            placeholder="Add remark…"
                            value={reviewRemarks[issue.id] || issue.reviewerRemark}
                            onChange={e => updateRemark(issue.id, e.target.value)}
                          />
                        </td>
                        <td>
                          <span className={s.l2ReviewerBadge}>Reber</span>
                        </td>
                        <td>
                          <span className={s.l2RiskBadge}
                            style={{ background: riskColor(issue.severity).bg, color: riskColor(issue.severity).color }}>
                            {issue.severity}
                          </span>
                        </td>
                        <td>
                          {issue.status === 'Action Required' ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <button className={s.l2ActionBtn}
                                onClick={() => markIssueResolved(issue.id)}>Resolve</button>
                              <button className={s.l2RevalBtn}
                                onClick={() => sendToRevalidation(issue.id, issue.docName)}>Reval.</button>
                            </div>
                          ) : (
                            <span className={s.l2ResolvedPill}>
                              {issue.status === 'Resolved' ? '✓ Resolved' : '⏳ Pending'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Revalidation queue */}
          {revalQueue.length > 0 && (
            <div className={s.l2RevalSection}>
              <div className={s.l2IssueHeader}>
                <span className={s.l2PanelTitle}>🔄 Revalidation Queue</span>
                <span className={s.l2IssueBadge} style={{ background: '#FEF3C7', color: '#92400E' }}>{revalQueue.length}</span>
              </div>
              {revalQueue.map(docName => (
                <div key={docName} className={s.l2RevalCard}>
                  <span className={s.l2RevalDocName}>📄 {docName}</span>
                  <span className={s.l2RevalStatus}>Awaiting corrected upload</span>
                  <button className={s.l2UploadBtn}>↑ Upload Corrected</button>
                </div>
              ))}
            </div>
          )}

          {/* Continue action */}
          <div className={s.stepActions} style={{ marginTop: 12 }}>
            <button className={s.btnSecondary} onClick={onBack}>← Back</button>
            {allApproved && openIssues === 0 && (
              <button className={s.btnGreen} onClick={() => setShowTerms(true)}>
                ✅ All Documents Validated — Continue to Audit →
              </button>
            )}
            {(!allApproved || openIssues > 0) && (
              <div className={s.validationBanner} style={{ flex: 1 }}>
                <span className={s.validationHint}>
                  {pending > 0 ? `${pending} documents still pending upload · ` : ''}
                  {openIssues > 0 ? `${openIssues} issues need resolution before proceeding` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT — AI Review Assistant ════════════════════════════════ */}
        <div className={s.l2Right}>
          <div className={s.l2PanelHeader}>
            <span className={s.l2PanelTitle}>AI Review Assistant</span>
            <button className={s.l2ViewerBtn}>⋯</button>
          </div>

          {/* Scores */}
          <div className={s.l2ScoreGrid}>
            <div className={s.l2ScoreCard}>
              <span className={s.l2ScoreLabel}>Compliance Score</span>
              <span className={s.l2ScoreVal} style={{ color: compScore >= 80 ? '#059669' : compScore >= 60 ? '#D97706' : '#DC2626' }}>
                {compScore}
              </span>
              <span className={s.l2ScoreDelta}>{uploaded > 0 ? '+7, 19' : '—'}</span>
            </div>
            <div className={s.l2ScoreCard}>
              <span className={s.l2ScoreLabel}>Validation Score</span>
              <span className={s.l2ScoreVal} style={{ color: '#7C3AED' }}>
                {validated > 0 ? Math.round((validated / totalDocs) * 87) : '—'}
              </span>
              <span className={s.l2ScoreDelta}>{validated > 0 ? '+10, 18' : ''}</span>
            </div>
            <div className={s.l2ScoreCard}>
              <span className={s.l2ScoreLabel}>Risk Score</span>
              <span className={s.l2ScoreVal} style={{ color: '#D97706' }}>
                {uploaded > 0 ? 80 : '—'}
              </span>
              <span className={s.l2ScoreDelta}>{uploaded > 0 ? '+5, +8' : ''}</span>
            </div>
            <div className={s.l2ScoreCard}>
              <span className={s.l2ScoreLabel}>Audit Readiness</span>
              <span className={s.l2ScoreVal} style={{ color: '#4A4468' }}>
                {allApproved && openIssues === 0 ? '✅' : '—'}
              </span>
            </div>
          </div>

          {/* Detected issues */}
          <div className={s.l2AiSection}>
            <div className={s.sectionDivider}>Detected Issues</div>
            <div className={s.l2IssueStats}>
              <div className={s.l2IssueStat} style={{ color: '#DC2626' }}>
                <span className={s.l2IssueStatNum}>{highRisk}</span>
                <span>High</span>
              </div>
              <div className={s.l2IssueStat} style={{ color: '#D97706' }}>
                <span className={s.l2IssueStatNum}>{medRisk}</span>
                <span>Medium</span>
              </div>
              <div className={s.l2IssueStat} style={{ color: '#059669' }}>
                <span className={s.l2IssueStatNum}>{lowRisk}</span>
                <span>Low</span>
              </div>
            </div>
          </div>

          {/* Issue category dropdown */}
          <div className={s.l2AiSection}>
            <div className={s.sectionDivider}>Issue Category</div>
            <select className={s.l2CategorySelect} style={{ width: '100%', marginTop: 6 }}>
              {ISSUE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Root cause + suggested fix for selected card */}
          {cardIssues.length > 0 && (
            <>
              <div className={s.l2AiSection}>
                <div className={s.sectionDivider}>Root Cause Analysis</div>
                <ul className={s.l2AiBullets}>
                  {cardIssues.slice(0, 2).map(i => (
                    <li key={i.id} className={s.l2AiBullet}>• {i.rootCause}</li>
                  ))}
                </ul>
              </div>

              <div className={s.l2AiSection}>
                <div className={s.sectionDivider}>Suggested Corrective Actions</div>
                <ul className={s.l2AiBullets}>
                  {cardIssues.slice(0, 2).map(i => (
                    <li key={i.id} className={s.l2AiBullet}>• {i.suggestedFix}</li>
                  ))}
                </ul>
              </div>

              <div className={s.l2AiSection}>
                <div className={s.sectionDivider}>Revalidation Requirements</div>
                <ul className={s.l2AiBullets}>
                  <li className={s.l2AiBullet}>• Re-upload corrected documents for revalidation.</li>
                  <li className={s.l2AiBullet}>• Revalidation runs only on changed documents.</li>
                </ul>
              </div>
            </>
          )}

          {/* Compliance % with bar */}
          <div className={s.l2AiSection}>
            <div className={s.sectionDivider}>Compliance %</div>
            <div className={s.l2CompBar}>
              <div className={s.l2CompBarFill} style={{ width: `${compScore}%` }} />
            </div>
            <div style={{ fontSize: 11, color: '#8B85A8', marginTop: 4 }}>{compScore}%</div>
          </div>

          {/* Before / After */}
          {revalQueue.length > 0 && (
            <div className={s.l2AiSection}>
              <div className={s.sectionDivider}>Before vs After</div>
              <div className={s.l2BeforeAfter}>
                <div className={s.l2BeforeAfterPane}>
                  <div className={s.l2BeforeAfterLabel}>Before</div>
                  <div className={s.l2BeforeAfterDoc}>📄</div>
                </div>
                <span style={{ color: '#8B85A8', fontSize: 14 }}>vs</span>
                <div className={s.l2BeforeAfterPane}>
                  <div className={s.l2BeforeAfterLabel}>After</div>
                  <div className={s.l2BeforeAfterDoc}>📄</div>
                </div>
              </div>
            </div>
          )}

          {/* Compliance verdict */}
          <div className={s.l2AiSection}>
            <div className={s.sectionDivider}>Compliance Verdict</div>
            <div className={`${s.l2VerdictCard} ${openIssues === 0 && uploaded > 0 ? s.verdictCompliant : s.verdictImprovement}`}>
              {openIssues === 0 && uploaded > 0 ? '✅ Compliant' : '⚠ Needs Improvement'}
              <div className={s.l2VerdictSub}>
                {openIssues > 0 ? 'Action required to meet compliance percentage.' : 'All validated documents are compliant.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Sticky Executive Dashboard ═════════════════════════════════════ */}
      <div className={s.l2StickyDash}>
        <div className={s.l2StickyTitle}>
          Sticky Executive Dashboard
          <button className={s.l2ViewerBtn} style={{ marginLeft: 'auto' }}>Sort dashboard</button>
        </div>
        <div className={s.l2StickyGrid}>
          {[
            { label: 'Total Documents',       val: totalDocs,              sub: 'Documents' },
            { label: 'Uploaded',              val: uploaded,               sub: 'Uploaded',  color: '#059669' },
            { label: 'Validated',             val: validated,              sub: 'Validated', color: '#7C3AED' },
            { label: 'Pending',               val: pending,                sub: 'Pending',   color: '#D97706' },
            { label: 'Sent for Revalidation', val: revalQueue.length,      sub: 'Reuploaded',color: '#D97706' },
            { label: 'Compliance Before',     val: `${Math.max(0, compScore - 5)}%`, sub: 'Before' },
            { label: 'Compliance After',      val: `${compScore}%`,        sub: 'After lation', color: '#059669' },
            { label: 'Validation Accuracy',   val: `${aiConfidence > 0 ? 89 : 0}%`, sub: 'Accuracy' },
            { label: 'Headcount',             val: 104,                    sub: 'Headcount' },
            { label: 'Critical Findings',     val: highRisk,               sub: 'Critical finding', color: '#DC2626' },
            { label: 'High-risk Issues',      val: openIssues,             sub: 'High risk', color: '#DC2626' },
            { label: 'Overall Compliance',    val: `${compScore * 10}`,    sub: 'Compliance', color: '#7C3AED' },
          ].map(item => (
            <div key={item.label} className={s.l2DashChip}>
              <div className={s.l2DashVal} style={{ color: item.color }}>{item.val}</div>
              <div className={s.l2DashLabel}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {showTerms && (
        <TermsModal level={2} onAgree={() => { setShowTerms(false); onComplete(); }} onClose={() => setShowTerms(false)} />
      )}
    </div>
  );
}
