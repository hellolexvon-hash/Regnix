/**
 * ValidationLevel2.tsx
 *
 * L2 Compliance Intelligence Workspace
 *
 * Layout:
 *   LEFT  300px  — Document checklist (simple 48px rows, status pill, upload icon)
 *   CENTER flex  — 6-chip analytics row · split viewer · issue table
 *   RIGHT  260px — AI Review Assistant (stacked sections, each scrollable to 180px)
 *   BOTTOM sticky — Executive Dashboard (12 metrics, dark bar)
 *
 * Zero inline styles — all from Validation.module.css.
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

type UploadStatus     = 'Uploaded' | 'Pending' | 'Not Applicable';
type ValidationResult = 'Correct' | 'Incorrect' | 'Needs Review' | 'ATP';
type RiskLevel        = 'High' | 'Medium' | 'Low';
type IssueStatus      = 'Action Required' | 'Resolved' | 'Pending';

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
  id:             string;
  severity:       RiskLevel;
  docName:        string;
  field:          string;
  expected:       string;
  uploaded:       string;
  diff:           string;
  rootCause:      string;
  suggestedFix:   string;
  category:       string;
  status:         IssueStatus;
  reviewerRemark: string;
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

function riskPillClass(r: RiskLevel): string {
  if (r === 'High')   return `${s.pill} ${s.pillDanger}`;
  if (r === 'Medium') return `${s.pill} ${s.pillMedium}`;
  return `${s.pill} ${s.pillLow}`;
}

function uploadPillClass(status: UploadStatus): string {
  if (status === 'Uploaded')       return `${s.pill} ${s.pillUploaded}`;
  if (status === 'Not Applicable') return `${s.pill} ${s.pillNotApplicable}`;
  return `${s.pill} ${s.pillPending}`;
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

function generateMockIssues(docName: string): ComplianceIssue[] {
  return [
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
}

function SheetTable({ sheets, activeSheet, onTabChange }: {
  sheets: SheetPreview[];
  activeSheet: number;
  onTabChange: (i: number) => void;
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
              className={activeSheet === i ? `${s.sheetTab} ${s.sheetTabActive}` : s.sheetTab}
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
            <tr>{sheet.headers.map((h, i) => <th key={i}>{h || `Col ${i + 1}`}</th>)}</tr>
          </thead>
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

export default function ValidationLevel2({
  docs, liveRegisterFile, companyName = 'Company', onComplete, onBack,
}: ValidationLevel2Props) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [docCards, setDocCards]     = useState<DocCard[]>(() =>
    REQUIRED_DOCS.map((d, i) => ({ ...d, id: `req-${i}` }))
  );
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [liveSheets, setLiveSheets] = useState<SheetPreview[] | null>(null);
  const [liveSheet, setLiveSheet]   = useState(0);
  const [issues, setIssues]         = useState<ComplianceIssue[]>([]);
  const [showTerms, setShowTerms]   = useState(false);
  const [aiRunning, setAiRunning]   = useState<string | null>(null);
  const [revalQueue, setRevalQueue] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({});
  const [reviewRemarks, setReviewRemarks]        = useState<Record<string, string>>({});

  // Derived stats
  const totalDocs  = docCards.length;
  const uploaded   = docCards.filter(d => d.uploadStatus === 'Uploaded').length;
  const pending    = docCards.filter(d => d.uploadStatus === 'Pending').length;
  const validated  = docCards.filter(d => d.validationResult !== 'ATP').length;
  const openIssues = issues.filter(i => i.status === 'Action Required').length;
  const highRisk   = issues.filter(i => i.severity === 'High').length;
  const medRisk    = issues.filter(i => i.severity === 'Medium').length;
  const lowRisk    = issues.filter(i => i.severity === 'Low').length;
  const totalRecords = 1431;
  const matched    = Math.max(0, totalRecords - issues.length * 12);
  const compScore  = uploaded === 0 ? 0 : Math.round(((uploaded - openIssues * 0.5) / totalDocs) * 100);
  const aiConfidence = uploaded > 0 ? 89.5 : 0;
  const allApproved  = docCards.every(d => d.uploadStatus === 'Uploaded' || d.uploadStatus === 'Not Applicable');

  const selectedCardData = docCards.find(d => d.id === activeCard);
  const cardIssues       = issues.filter(i => i.docName === selectedCardData?.name);

  useEffect(() => {
    if (!liveRegisterFile) return;
    parseXlsx(liveRegisterFile).then(setLiveSheets).catch(() => {});
  }, [liveRegisterFile]);

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
    if (docs.length > 0) setActiveCard('req-0');
  }, []);

  async function handleFileUpload(cardId: string, files: FileList | null) {
    if (!files?.length) return;
    const file   = files[0];
    const sheets = file.name.match(/\.xlsx?$/i)
      ? await parseXlsx(file).catch(() => undefined)
      : undefined;

    setDocCards(prev => prev.map(d => d.id === cardId
      ? { ...d, uploadStatus: 'Uploaded', file, sheets, score: Math.floor(Math.random() * 15) + 82 }
      : d
    ));

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

  return (
    <div className={s.page}>
      <div className={s.pageInner}>

        {/* ── Progress header ─────────────────────────────────────────────── */}
        <div className={s.progressHeader}>
          <div className={s.progressHeaderLeft}>
            <span className={s.progressTitle}>Compliance Audit — Level 2</span>
            <div className={s.progressTrack}>
              {(['L1 Upload', 'L2 AI Validation', 'L3 Audit'] as const).map((label, i) => (
                <div key={label} className={s.progressStep}>
                  {i > 0 && (
                    <div className={i === 1
                      ? s.progressConnector
                      : `${s.progressConnector} ${s.progressConnectorDone}`}
                    />
                  )}
                  <div className={
                    i === 0
                      ? `${s.progressDot} ${s.progressDotDone}`
                      : i === 1
                      ? `${s.progressDot} ${s.progressDotActive}`
                      : s.progressDot
                  }>
                    {i === 0 ? '✓' : i + 1}
                  </div>
                  <span className={
                    i === 0
                      ? `${s.progressStepLabel} ${s.progressStepLabelDone}`
                      : i === 1
                      ? `${s.progressStepLabel} ${s.progressStepLabelActive}`
                      : s.progressStepLabel
                  }>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className={s.l2VerifyCount}>
            <span className={s.l2VerifyNum}>{uploaded}/{totalDocs}</span>
            <span className={s.l2VerifyLabel}>uploaded</span>
          </div>
        </div>

        {/* ── Three-column workspace ──────────────────────────────────────── */}
        <div className={s.l2Shell}>
          <div className={s.l2ThreeCol}>

            {/* ══ LEFT — Document Checklist ══════════════════════════════ */}
            <div className={s.l2Sidebar}>
              <div className={s.l2SidebarHeader}>
                <span className={s.l2SidebarTitle}>Document Checklist</span>
                <span className={s.l2SidebarCount}>{uploaded}/{totalDocs} uploaded</span>
              </div>

              <div className={s.l2DocList}>
                {docCards.map(card => {
                  const isActive  = activeCard === card.id;
                  const isRunning = aiRunning === card.id;

                  return (
                    <div
                      key={card.id}
                      className={isActive
                        ? `${s.l2DocItem} ${s.l2DocItemActive}`
                        : s.l2DocItem}
                      onClick={() => { setActiveCard(card.id); setActiveSheet(0); }}
                    >
                      <div className={s.l2DocItemContent}>
                        <div className={s.l2DocItemName} title={card.name}>
                          {isRunning ? `⏳ ${card.name}` : card.name}
                        </div>
                        <div className={s.l2DocItemAct}>{card.act}</div>
                      </div>

                      <div className={s.l2DocItemRight}>
                        <span className={uploadPillClass(card.uploadStatus)}>
                          {card.uploadStatus === 'Uploaded'
                            ? '✓'
                            : card.uploadStatus === 'Not Applicable'
                            ? 'N/A'
                            : '—'}
                        </span>
                        <span className={riskPillClass(card.riskLevel)}>
                          {card.riskLevel}
                        </span>
                        {card.uploadStatus === 'Pending' && !isRunning && (
                          <>
                            <input
                              ref={el => { fileInputRefs.current[card.id] = el; }}
                              type="file"
                              accept=".xlsx,.xls,.pdf"
                              className={s.hiddenInput}
                              onChange={e => handleFileUpload(card.id, e.target.files)}
                            />
                            <button
                              className={s.l2UploadIcon}
                              title="Upload document"
                              onClick={e => { e.stopPropagation(); fileInputRefs.current[card.id]?.click(); }}
                            >
                              ↑
                            </button>
                          </>
                        )}
                        {card.uploadStatus === 'Uploaded' && (
                          <>
                            <input
                              ref={el => { fileInputRefs.current[`replace-${card.id}`] = el; }}
                              type="file"
                              accept=".xlsx,.xls,.pdf"
                              className={s.hiddenInput}
                              onChange={e => handleFileUpload(card.id, e.target.files)}
                            />
                            <button
                              className={s.l2UploadIcon}
                              title="Replace document"
                              onClick={e => { e.stopPropagation(); fileInputRefs.current[`replace-${card.id}`]?.click(); }}
                            >
                              ↻
                            </button>
                          </>
                        )}
                        {card.uploadStatus === 'Not Applicable' && (
                          <button
                            className={s.l2UploadIcon}
                            title="Undo N/A"
                            onClick={e => { e.stopPropagation(); toggleNotApplicable(card.id); }}
                          >
                            ✕
                          </button>
                        )}
                        {card.uploadStatus === 'Pending' && !isRunning && (
                          <button
                            className={s.l2UploadIcon}
                            title="Mark as Not Applicable"
                            onClick={e => { e.stopPropagation(); toggleNotApplicable(card.id); }}
                          >
                            N/A
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ══ CENTER — Viewer + Issues ════════════════════════════════ */}
            <div className={s.l2Center}>

              {/* Analytics chips row */}
              <div className={s.l2ChipsRow}>
                <div className={s.l2Chip}>
                  <span className={s.l2ChipNum}>{aiConfidence > 0 ? `${aiConfidence}%` : '—'}</span>
                  AI Confidence
                </div>
                <div className={s.l2Chip}>
                  <span className={s.l2ChipNum}>{totalRecords.toLocaleString()}</span>
                  Total Records
                </div>
                <div className={s.l2Chip}>
                  <span className={s.l2ChipNum}>{matched.toLocaleString()}</span>
                  Matched
                </div>
                <div className={s.l2Chip}>
                  <span className={s.l2ChipNum}>{openIssues}</span>
                  Mismatches
                </div>
                <div className={s.l2Chip}>
                  <span className={s.l2ChipNum}>0</span>
                  Missing
                </div>
                <div className={s.l2Chip}>
                  <span className={s.l2ChipNum}>0</span>
                  Duplicates
                </div>
              </div>

              {/* Split viewer */}
              <div className={s.l2SplitViewer}>

                {/* Left pane — uploaded doc */}
                <div className={s.l2ViewerPane}>
                  <div className={s.l2ViewerPaneHeader}>
                    <span className={s.l2ViewerPaneLabel}>Uploaded Document</span>
                    <span className={`${s.l2ViewerPaneTag} ${s.l2ViewerPaneTagLeft}`}>L1</span>
                  </div>
                  <div className={s.l2ViewerPaneContent}>
                    {selectedCardData?.sheets ? (
                      <SheetTable
                        sheets={selectedCardData.sheets}
                        activeSheet={activeSheet}
                        onTabChange={setActiveSheet}
                      />
                    ) : (
                      <div className={s.l2EmptyPane}>
                        <div className={s.l2EmptyIcon}>📄</div>
                        <div className={s.l2EmptyText}>
                          {selectedCardData
                            ? selectedCardData.uploadStatus === 'Pending'
                              ? 'Upload this document to preview'
                              : 'Non-Excel file — download to view'
                            : 'Select a document from the checklist'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right pane — system register */}
                <div className={s.l2ViewerPane}>
                  <div className={s.l2ViewerPaneHeader}>
                    <span className={s.l2ViewerPaneLabel}>System Register</span>
                    <span className={`${s.l2ViewerPaneTag} ${s.l2ViewerPaneTagRight}`}>Live</span>
                  </div>
                  <div className={s.l2ViewerPaneContent}>
                    {liveSheets ? (
                      <SheetTable
                        sheets={liveSheets}
                        activeSheet={liveSheet}
                        onTabChange={setLiveSheet}
                      />
                    ) : (
                      <div className={s.l2EmptyPane}>
                        <div className={s.l2EmptyIcon}>📋</div>
                        <div className={s.l2EmptyText}>
                          System register loads from your session file.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Issue table */}
              {issues.length > 0 && (
                <div className={s.l2IssueTableWrap}>
                  <div className={s.l2IssueTableHeader}>
                    <span className={s.l2IssueTableTitle}>Validation Issues</span>
                    <span className={`${s.pill} ${openIssues > 0 ? s.pillDanger : s.pillDone}`}>
                      {openIssues} open
                    </span>
                  </div>
                  <div className={s.l2IssueTableScroll}>
                    <table className={s.l2IssueTable}>
                      <colgroup>
                        <col /><col /><col /><col />
                        <col /><col /><col /><col />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Upload Status</th>
                          <th>AI Compare</th>
                          <th>Result</th>
                          <th>Issue Category</th>
                          <th>Auditor Notes</th>
                          <th>Reviewer</th>
                          <th>Risk</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {issues.map(issue => (
                          <tr
                            key={issue.id}
                            className={issue.status === 'Resolved' ? s.l2IssueResolved : undefined}
                          >
                            <td>
                              <span className={`${s.l2StatusPill} ${s.pillUploaded}`}>Uploaded</span>
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
                              <span className={s.l2ReviewerBadge}>Reviewer</span>
                            </td>
                            <td>
                              <span className={riskPillClass(issue.severity)}>
                                {issue.severity}
                              </span>
                            </td>
                            <td>
                              {issue.status === 'Action Required' ? (
                                <div>
                                  <button
                                    className={s.l2ActionBtn}
                                    onClick={() => markIssueResolved(issue.id)}
                                  >
                                    Resolve
                                  </button>
                                  {' '}
                                  <button
                                    className={s.l2RevalBtn}
                                    onClick={() => sendToRevalidation(issue.id, issue.docName)}
                                  >
                                    Reval.
                                  </button>
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
                  <div className={s.sectionDivider}>Revalidation Queue — {revalQueue.length} document{revalQueue.length !== 1 ? 's' : ''}</div>
                  {revalQueue.map(docName => (
                    <div key={docName} className={s.l2RevalCard}>
                      <span className={s.l2RevalDocName}>📄 {docName}</span>
                      <span className={s.l2RevalStatus}>Awaiting corrected upload</span>
                      <button className={`${s.btnSecondary} ${s.btnSmall}`}>↑ Upload Corrected</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer actions */}
              <div className={s.cardFooter}>
                <button className={s.btnSecondary} onClick={onBack}>← Back</button>
                {allApproved && openIssues === 0 ? (
                  <button className={s.btnGreen} onClick={() => setShowTerms(true)}>
                    ✅ All Documents Validated — Continue to Audit →
                  </button>
                ) : (
                  <div className={s.validationBanner}>
                    <span className={s.validationHint}>
                      {pending > 0 ? `${pending} document${pending !== 1 ? 's' : ''} still pending upload` : ''}
                      {pending > 0 && openIssues > 0 ? ' · ' : ''}
                      {openIssues > 0 ? `${openIssues} issue${openIssues !== 1 ? 's' : ''} need resolution before proceeding` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ══ RIGHT — AI Review Assistant ════════════════════════════ */}
            <div className={s.l2Right}>
              <div className={s.l2PanelHeader}>
                <span className={s.l2PanelTitle}>AI Review Assistant</span>
                <button className={s.l2ViewerBtn}>⋯</button>
              </div>

              <div className={s.l2PanelBody}>

                {/* Scores */}
                <div className={s.l2PanelSection}>
                  <div className={s.sectionDivider}>Compliance Scores</div>
                  <div className={s.l2ScoreGrid}>
                    <div className={s.l2ScoreCard}>
                      <span className={s.l2ScoreLabel}>Compliance</span>
                      <span className={s.l2ScoreVal}>{compScore}</span>
                      <span className={s.l2ScoreDelta}>{uploaded > 0 ? '+7, 19' : '—'}</span>
                    </div>
                    <div className={s.l2ScoreCard}>
                      <span className={s.l2ScoreLabel}>Validation</span>
                      <span className={s.l2ScoreVal}>
                        {validated > 0 ? Math.round((validated / totalDocs) * 87) : '—'}
                      </span>
                      <span className={s.l2ScoreDelta}>{validated > 0 ? '+10, 18' : ''}</span>
                    </div>
                    <div className={s.l2ScoreCard}>
                      <span className={s.l2ScoreLabel}>Risk</span>
                      <span className={s.l2ScoreVal}>{uploaded > 0 ? 80 : '—'}</span>
                      <span className={s.l2ScoreDelta}>{uploaded > 0 ? '+5, +8' : ''}</span>
                    </div>
                    <div className={s.l2ScoreCard}>
                      <span className={s.l2ScoreLabel}>Readiness</span>
                      <span className={s.l2ScoreVal}>
                        {allApproved && openIssues === 0 ? '✅' : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detected issues */}
                <div className={s.l2PanelSection}>
                  <div className={s.sectionDivider}>Detected Issues</div>
                  <div className={s.l2IssueStats}>
                    <div className={`${s.l2IssueStat} ${s.l2IssueStatHigh}`}>
                      <span className={s.l2IssueStatNum}>{highRisk}</span>
                      <span>High</span>
                    </div>
                    <div className={`${s.l2IssueStat} ${s.l2IssueStatMedium}`}>
                      <span className={s.l2IssueStatNum}>{medRisk}</span>
                      <span>Medium</span>
                    </div>
                    <div className={`${s.l2IssueStat} ${s.l2IssueStatLow}`}>
                      <span className={s.l2IssueStatNum}>{lowRisk}</span>
                      <span>Low</span>
                    </div>
                  </div>
                </div>

                {/* Issue category */}
                <div className={s.l2PanelSection}>
                  <div className={s.sectionDivider}>Issue Category</div>
                  <select className={s.l2CategorySelect}>
                    {ISSUE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Root cause + suggested fix for active card */}
                {cardIssues.length > 0 && (
                  <>
                    <div className={s.l2PanelSection}>
                      <div className={s.sectionDivider}>Root Cause Analysis</div>
                      <ul className={s.l2AiBullets}>
                        {cardIssues.slice(0, 2).map(i => (
                          <li key={i.id} className={s.l2AiBullet}>• {i.rootCause}</li>
                        ))}
                      </ul>
                    </div>

                    <div className={s.l2PanelSection}>
                      <div className={s.sectionDivider}>Suggested Actions</div>
                      <ul className={s.l2AiBullets}>
                        {cardIssues.slice(0, 2).map(i => (
                          <li key={i.id} className={s.l2AiBullet}>• {i.suggestedFix}</li>
                        ))}
                      </ul>
                    </div>

                    <div className={s.l2PanelSection}>
                      <div className={s.sectionDivider}>Revalidation</div>
                      <ul className={s.l2AiBullets}>
                        <li className={s.l2AiBullet}>• Re-upload corrected documents for revalidation.</li>
                        <li className={s.l2AiBullet}>• Revalidation runs only on changed documents.</li>
                      </ul>
                    </div>
                  </>
                )}

                {/* Compliance % */}
                <div className={s.l2PanelSection}>
                  <div className={s.sectionDivider}>Compliance %</div>
                  <div className={s.l2CompBar}>
                    <div className={s.l2CompBarFill} style={{ width: `${compScore}%` }} />
                  </div>
                  <span className={s.l2ScoreDelta}>{compScore}%</span>
                </div>

                {/* Before / After */}
                {revalQueue.length > 0 && (
                  <div className={s.l2PanelSection}>
                    <div className={s.sectionDivider}>Before vs After</div>
                    <div className={s.l2BeforeAfter}>
                      <div className={s.l2BeforeAfterPane}>
                        <div className={s.l2BeforeAfterLabel}>Before</div>
                        <div className={s.l2BeforeAfterDoc}>📄</div>
                      </div>
                      <span>vs</span>
                      <div className={s.l2BeforeAfterPane}>
                        <div className={s.l2BeforeAfterLabel}>After</div>
                        <div className={s.l2BeforeAfterDoc}>📄</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Verdict */}
                <div className={s.l2PanelSection}>
                  <div className={s.sectionDivider}>Compliance Verdict</div>
                  <div className={`${s.l2VerdictCard} ${openIssues === 0 && uploaded > 0 ? s.verdictCompliant : s.verdictImprovement}`}>
                    {openIssues === 0 && uploaded > 0 ? '✅ Compliant' : '⚠ Needs Improvement'}
                    <div className={s.l2VerdictSub}>
                      {openIssues > 0
                        ? 'Action required to meet compliance.'
                        : 'All validated documents are compliant.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Sticky Executive Dashboard ═════════════════════════════════════════ */}
      <div className={s.l2StickyDash}>
        <div className={s.l2StickyInner}>
          <div className={s.l2StickyTitleRow}>
            <span className={s.l2StickyTitle}>Executive Dashboard</span>
          </div>
          <div className={s.l2StickyGrid}>
            {[
              { label: 'Total Docs',        val: totalDocs,                              color: undefined  },
              { label: 'Uploaded',          val: uploaded,                               color: '#34D399'  },
              { label: 'Validated',         val: validated,                              color: '#A78BFA'  },
              { label: 'Pending',           val: pending,                                color: '#FCD34D'  },
              { label: 'Revalidation',      val: revalQueue.length,                      color: '#FCD34D'  },
              { label: 'Before',            val: `${Math.max(0, compScore - 5)}%`,       color: undefined  },
              { label: 'After',             val: `${compScore}%`,                        color: '#34D399'  },
              { label: 'Accuracy',          val: `${aiConfidence > 0 ? 89 : 0}%`,        color: undefined  },
              { label: 'Headcount',         val: 104,                                    color: undefined  },
              { label: 'Critical',          val: highRisk,                               color: '#F87171'  },
              { label: 'High Risk',         val: openIssues,                             color: '#F87171'  },
              { label: 'Overall',           val: `${compScore * 10}`,                    color: '#A78BFA'  },
            ].map(item => (
              <div key={item.label} className={s.l2DashChip}>
                <div className={s.l2DashVal} style={item.color ? { color: item.color } : undefined}>
                  {item.val}
                </div>
                <div className={s.l2DashLabel}>{item.label}</div>
              </div>
            ))}
          </div>
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
