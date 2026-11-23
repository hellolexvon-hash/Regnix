/**
 * AuditorCompanyReview.tsx
 *
 * Detail view for a single company that has passed Level 2. Three tabs:
 *   Documents — every register submitted; open the actual filed document
 *               (PdfViewer) and the master payroll register (LiveRegister)
 *               side by side, and tally each field the way a manual auditor
 *               would — plus a computed reconciliation table as a fast-path.
 *   Issues    — carried-over issues from Level 2 that the auditor should weigh
 *   Decision  — auditor remarks + Approve / Request Changes / Reject
 *
 * If the company already has a decision (approved/changes_requested/rejected)
 * the Decision tab renders as a read-only record instead of an action form.
 *
 * Zero inline styles — all from Auditor.module.css (.ar* classes).
 */

import { useEffect, useMemo, useState } from 'react';
import s from './Auditor.module.css';
import o from './AuditorOpening.module.css';
import { authFetch, type Auditor, type CompanyReview, type IssueSeverity, type ReviewDoc } from './auditorStore';
import PdfViewer from '../documentGenerator/PdfViewer';
import LiveRegister from '../documentGenerator/LiveRegister';
import AuditorTermsModal from './AuditorTermsModal';
import { resolveRuleSet } from './ruleLibrary';
import AuditCertificate from './AuditCertificate';
import AuditorWorkspace, { type DocReview, type Finding, type ReviewMap, type Verdict } from './AuditorWorkspace';
import w from './AuditorWorkspace.module.css';
import { SEVERITY_LABEL, SEVERITY_RANK, TAT_BY_SEVERITY } from './l3Flags';
import {
  IconArrowLeft, IconFileText, IconFlag, IconPenLine, IconCheckCircle, IconUndo,
  IconXCircle, IconAlertTriangle, IconTable, IconChevronDown, IconChevronRight,
  IconClock, IconEye, IconShieldCheck, IconListChecks, IconFolder, IconSpinner,
} from './icons';

interface AuditorCompanyReviewProps {
  company:  CompanyReview;
  auditor:  Auditor;
  onBack:   () => void;
  onClaim:  (id: string, acceptedTerms: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDecide: (id: string, decision: 'approved' | 'changes_requested' | 'rejected', remarks: string) => Promise<{ ok: true; certificateNo?: string } | { ok: false; error: string }>;
}

type Tab = 'documents' | 'company' | 'issues' | 'decision';

const SEVERITY_META: Record<IssueSeverity, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'arSevCritical' },
  major:    { label: 'Major',    cls: 'arSevMajor' },
  minor:    { label: 'Minor',    cls: 'arSevMinor' },
};

const STATUS_ICON: Record<CompanyReview['status'], JSX.Element> = {
  pending:            <IconClock size={13} />,
  in_review:          <IconEye size={13} />,
  approved:           <IconCheckCircle size={13} />,
  changes_requested:  <IconUndo size={13} />,
  rejected:           <IconXCircle size={13} />,
};

const STATUS_TEXT: Record<CompanyReview['status'], string> = {
  pending:            'Awaiting Review',
  in_review:          'In Review',
  approved:           'Approved',
  changes_requested:  'Changes Requested',
  rejected:           'Rejected',
};

function lockedText(c: CompanyReview): string {
  if (c.status === 'pending') return 'Request access to this review (and accept the auditor terms) to see every document and all the data this company submitted.';
  if (c.accessStatus === 'denied') return 'Regnix did not approve access to this review. Contact an administrator if you think this is a mistake.';
  if (c.accessStatus === 'requested') return 'Access requested — waiting for Regnix to approve. Documents and company data unlock as soon as it is approved.';
  if (c.status === 'in_review' && !c.termsAcceptedAt) return 'Regnix assigned this review to you. Accept the auditor terms to unlock the documents and company data.';
  if (c.accessStatus === 'requested') return 'Access requested — waiting for Regnix to approve. Documents and company data unlock as soon as it is approved.';
  if (c.accessStatus === 'denied') return 'Access to this review was not approved.';
  return 'This review belongs to another auditor — documents and data are only visible to the assigned auditor.';
}

function fmtDate(d: Date): string {
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function toFileFromBlob(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
}

// ── File loading: cached, de-duplicated, with download progress ─────────────────────────────
// Opened/prefetched files are kept for the session (small LRU) so reopening is instant, and two
// requests for the same file share one download.
const BLOB_CACHE = new Map<string, Blob>();
const CACHE_MAX = 24;
const INFLIGHT = new Map<string, Promise<{ blob: Blob | null; error: string }>>();
const LISTENERS = new Map<string, Set<(loaded: number, total: number) => void>>();
let lastFetchError = '';

function cachePut(url: string, blob: Blob) {
  BLOB_CACHE.delete(url); BLOB_CACHE.set(url, blob);
  while (BLOB_CACHE.size > CACHE_MAX) BLOB_CACHE.delete(BLOB_CACHE.keys().next().value as string);
}

async function download(url: string): Promise<{ blob: Blob | null; error: string }> {
  try {
    const res = await authFetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { blob: null, error: body?.message ?? `Server responded ${res.status}.` };
    }
    const type = res.headers.get('content-type') || '';
    if (type.includes('text/html')) return { blob: null, error: 'The file route is not deployed (got a web page instead of the file).' };
    const total = Number(res.headers.get('content-length')) || 0;
    let blob: Blob;
    if (res.body && total) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) { chunks.push(value); loaded += value.length; LISTENERS.get(url)?.forEach((fn) => fn(loaded, total)); }
      }
      blob = new Blob(chunks, { type });
    } else {
      blob = await res.blob();
    }
    cachePut(url, blob);
    return { blob, error: '' };
  } catch {
    return { blob: null, error: 'Could not reach the server.' };
  }
}

async function fetchBlob(url: string, onProgress?: (loaded: number, total: number) => void): Promise<Blob | null> {
  lastFetchError = '';
  const hit = BLOB_CACHE.get(url);
  if (hit) { cachePut(url, hit); onProgress?.(1, 1); return hit; }
  if (onProgress) { const set = LISTENERS.get(url) ?? new Set(); set.add(onProgress); LISTENERS.set(url, set); }
  let p = INFLIGHT.get(url);
  if (!p) { p = download(url).finally(() => { INFLIGHT.delete(url); LISTENERS.delete(url); }); INFLIGHT.set(url, p); }
  const r = await p;
  lastFetchError = r.error;
  return r.blob;
}

/** Warm the cache in the background (no UI, errors ignored). */
function prefetch(url?: string | null) { if (url && !BLOB_CACHE.has(url) && !INFLIGHT.has(url)) void fetchBlob(url); }

export default function AuditorCompanyReview({
  company, auditor, onBack, onClaim, onDecide,
}: AuditorCompanyReviewProps) {
  const [tab, setTab]         = useState<Tab>('documents');
  const [remarks, setRemarks] = useState(company.decisionRemarks);
  const [pendingDecision, setPendingDecision] =
    useState<'approved' | 'changes_requested' | 'rejected' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [checklistDocId, setChecklistDocId] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<{ doc: ReviewDoc; blob: Blob } | null>(null);
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [liveRegisterOpen, setLiveRegisterOpen] = useState(false);
  const [liveFile, setLiveFile] = useState<File | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [actionError, setActionError] = useState('');
  const [fileError, setFileError] = useState('');
  const [showCertificate, setShowCertificate] = useState(false);
  const [opening, setOpening] = useState<{ label: string; pct: number | null } | null>(null);
  const busyOpening = opening !== null;

  // ── L3 findings (per document), kept in the browser so a refresh never loses them ──
  const REVIEW_KEY = `regnix.l3.review.${company.id}`;
  const [reviews, setReviews] = useState<ReviewMap>(() => {
    try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}') as ReviewMap; } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews)); } catch { /* ignore */ } }, [reviews, REVIEW_KEY]);
  const [workspace, setWorkspace] = useState<{ doc: ReviewDoc; blob: Blob | null; kind: 'pdf' | 'sheet' | 'none' } | null>(null);
  const reviewOf = (id: string): DocReview => reviews[id] ?? { findings: [] };
  const patchReview = (id: string, fn: (r: DocReview) => DocReview) => setReviews((m) => ({ ...m, [id]: fn(m[id] ?? { findings: [] }) }));
  function setVerdict(id: string, v: Verdict) { patchReview(id, (r) => ({ ...r, verdict: v })); }
  function addFlag(id: string, f: Omit<Finding, 'id' | 'at'>) {
    patchReview(id, (r) => ({ verdict: 'flag', findings: [...r.findings, { ...f, id: `${Date.now()}-${r.findings.length}`, at: new Date().toISOString() }] }));
  }
  function removeFlag(id: string, fid: string) {
    patchReview(id, (r) => { const findings = r.findings.filter((x) => x.id !== fid); return { verdict: findings.length ? 'flag' : undefined, findings }; });
  }

  const canWork = company.status === 'in_review' && company.assignedTo === auditor.id && !company.locked;

  /** Load a file with a visible loader (label + progress) and a clear failure message. */
  async function load(url: string, label: string): Promise<Blob | null> {
    setOpening({ label, pct: null });
    const blob = await fetchBlob(url, (l, t) => setOpening((o) => (o && o.label === label ? { ...o, pct: t ? Math.min(100, Math.round((l / t) * 100)) : null } : o)));
    setOpening(null);
    return blob;
  }

  async function openLiveRegister() {
    if (busyOpening) return;
    setFileError('');
    if (!company.liveRegisterUrl) { setFileError('The company\'s live register was not stored (missing or over 3 MB).'); return; }
    if (!liveFile) {
      const blob = await load(company.liveRegisterUrl, 'live register');
      if (!blob) { setFileError(`Could not load the live register. ${lastFetchError}`); return; }
      setLiveFile(new File([blob], company.liveRegisterFileName || 'Live Register.xlsx', { type: blob.type }));
    }
    setLiveRegisterOpen(true);
  }

  const isDecided   = company.status === 'approved' || company.status === 'changes_requested' || company.status === 'rejected';
  const openIssues  = company.issues.filter(i => !i.resolvedL2);
  const flaggedDocs = company.docs.filter(d => d.status === 'flagged').length;

  async function acceptAndClaim() {
    setClaiming(true); setClaimError('');
    const r = await onClaim(company.id, true);
    setClaiming(false);
    if (r.ok) setShowTerms(false); else setClaimError(r.error);
  }

  async function confirmDecision() {
    if (!pendingDecision) return;
    if (pendingDecision !== 'approved' && !remarks.trim()) return;
    setSubmitting(true); setActionError('');
    const r = await onDecide(company.id, pendingDecision, remarks.trim());
    setSubmitting(false);
    if (r.ok) { setPendingDecision(null); if (pendingDecision === 'approved') setShowCertificate(true); }
    else setActionError(r.error);
  }

  async function handleOpenDocument(doc: ReviewDoc) {
    if (busyOpening) return;
    setFileError('');
    if (!doc.fileUrl) {
      if (workspace) { setWorkspace({ doc, blob: null, kind: 'none' }); return; }
      setFileError(`"${doc.name}" has no stored file — ask the company to re-upload it.`); return;
    }
    const blob = await load(doc.fileUrl, doc.name);
    if (!blob) { setFileError(`Could not load "${doc.name}". ${lastFetchError}`); return; }
    const isPdf = blob.type === 'application/pdf' || /\.pdf$/i.test(doc.fileName ?? '') || doc.mimeType === 'application/pdf';
    // Split view: document on the left, checks + flag suggestions on the right.
    setWorkspace({ doc, blob, kind: isPdf ? 'pdf' : 'sheet' });
    // Warm the next document so "Next ›" is instant.
    const i = company.docs.findIndex((x) => x.id === doc.id);
    prefetch(company.docs[i + 1]?.fileUrl);
  }

  async function openStoredFile(url: string, name: string, mime: string | null) {
    if (busyOpening) return;
    setFileError('');
    const blob = await load(url, name);
    if (!blob) { setFileError(`Could not load "${name}". ${lastFetchError}`); return; }
    const isPdf = (mime ?? blob.type) === 'application/pdf' || /\.pdf$/i.test(name);
    if (isPdf) setOpenDoc({ doc: { id: url, name, act: '', status: 'validated', score: 0, fileName: name }, blob });
    else setSheetFile(new File([blob], name, { type: blob.type }));
  }

  function toggleExpand(docId: string) {
    setExpandedDocId(cur => (cur === docId ? null : docId));
    setChecklistDocId(null);
    // Start downloading the file as soon as the row opens, so "Open filed document" is instant.
    const d = company.docs.find(x => x.id === docId);
    if (d && !company.locked) prefetch(d.fileUrl);
  }

  function toggleChecklist(docId: string) {
    setChecklistDocId(cur => (cur === docId ? null : docId));
  }

  // Everything the auditor flagged, folded into text for the existing `remarks` field (max 2000 chars).
  const summary = useMemo(() => {
    const flags = company.docs.flatMap((d) => (reviews[d.id]?.findings ?? []).map((f) => ({ ...f, docName: d.name })))
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    const count = { critical: 0, major: 0, minor: 0 };
    flags.forEach((f) => { count[f.severity] += 1; });
    const reviewed = company.docs.filter((d) => reviews[d.id]?.verdict || (reviews[d.id]?.findings.length ?? 0) > 0).length;
    const worst = count.critical ? 'critical' : count.major ? 'major' : count.minor ? 'minor' : null;
    const lines = flags.map((f, i) => `${i + 1}. ${f.docName} — ${f.keyword} (${SEVERITY_LABEL[f.severity]}): ${f.comment}`);
    let remarks = flags.length ? `L3 review findings:\n${lines.join('\n')}\nPlease rectify within ${worst ? TAT_BY_SEVERITY[worst] : 5} working days.` : '';
    if (remarks.length > 2000) remarks = `${remarks.slice(0, 1990)}…`;
    const recommend = flags.length === 0
      ? (reviewed === company.docs.length && company.docs.length > 0 ? 'Every document is marked correct. You can approve.' : 'No flags recorded. Review the remaining documents, then approve if all is in order.')
      : worst === 'critical' ? 'Critical flags found. Request changes (supplier has 2 working days) or reject if the problem cannot be corrected.'
      : 'Flags found. Request changes so the supplier can rectify and resubmit.';
    return { flags, count, reviewed, remarks, recommend };
  }, [company.docs, reviews]);

  return (
    <div className={s.arPage}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <button className={s.arBack} onClick={onBack}>
        <IconArrowLeft size={13} /> Back to queue
      </button>

      <div className={s.arHeader}>
        <div className={s.arHeaderMark}>{company.name.charAt(0)}</div>
        <div className={s.arHeaderText}>
          <h1 className={s.arHeaderTitle}>{company.name}</h1>
          <p className={s.arHeaderSub}>
            {company.industry} &middot; {company.employeeCount} employees &middot; CIN/Reg. {company.cin}
          </p>
        </div>
        <div className={s.arHeaderRight}>
          <span className={s.arHeaderStatus} data-status={company.status}>
            {STATUS_ICON[company.status]} {STATUS_TEXT[company.status]}
          </span>
          {(company.status === 'pending' || (company.status === 'in_review' && company.assignedTo === auditor.id && !company.termsAcceptedAt)) && (
            <button className={s.arClaimBtn} onClick={() => { setClaimError(''); setShowTerms(true); }}>
              {company.status === 'pending' ? 'Request access & review' : 'Accept terms & start review'}
            </button>
          )}
          {company.status === 'approved' && company.certificate && (
            <button className={s.arClaimBtn} onClick={() => setShowCertificate(true)}>
              <IconFileText size={13} /> View certificate
            </button>
          )}
        </div>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      <div className={s.arSummaryRow}>
        <div className={s.arSummaryItem}>
          <span className={s.arSummaryNum}>{company.l2Score}</span>
          <span className={s.arSummaryLabel}>Level 2 score</span>
        </div>
        <div className={s.arSummaryItem}>
          <span className={s.arSummaryNum}>{company.docs.length}</span>
          <span className={s.arSummaryLabel}>Documents</span>
        </div>
        <div className={s.arSummaryItem}>
          <span className={openIssues.length > 0 ? `${s.arSummaryNum} ${s.arSummaryWarn}` : s.arSummaryNum}>
            {openIssues.length}
          </span>
          <span className={s.arSummaryLabel}>Open issues</span>
        </div>
        <div className={s.arSummaryItem}>
          <span className={s.arSummaryNum}>{company.actsCovered.length}</span>
          <span className={s.arSummaryLabel}>Acts covered</span>
        </div>
        <div className={s.arSummaryItem}>
          <span className={s.arSummaryTextSm}>{fmtDate(company.l2CompletedAt)}</span>
          <span className={s.arSummaryLabel}>Passed Level 2</span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className={s.arTabs}>
        <button className={tab === 'documents' ? `${s.arTab} ${s.arTabActive}` : s.arTab} onClick={() => setTab('documents')}>
          <IconFileText size={14} /> Documents <span className={s.arTabCount}>{company.docs.length}</span>
        </button>
        <button className={tab === 'company' ? `${s.arTab} ${s.arTabActive}` : s.arTab} onClick={() => setTab('company')}>
          <IconFolder size={14} /> Company data
        </button>
        <button className={tab === 'issues' ? `${s.arTab} ${s.arTabActive}` : s.arTab} onClick={() => setTab('issues')}>
          <IconFlag size={14} /> Issues <span className={s.arTabCount}>{openIssues.length}</span>
        </button>
        <button className={tab === 'decision' ? `${s.arTab} ${s.arTabActive}` : s.arTab} onClick={() => setTab('decision')}>
          <IconPenLine size={14} /> Decision
        </button>
      </div>

      {/* ── Documents tab ────────────────────────────────────────────────── */}
      {tab === 'documents' && (
        <div className={s.arCard}>
          <div className={s.arDocsToolbar}>
            <div className={s.arCardHead}>
              <p className={s.arCardTitle}>Submitted registers</p>
              <p className={s.arCardSub}>
                {flaggedDocs > 0
                  ? `${flaggedDocs} document${flaggedDocs !== 1 ? 's' : ''} flagged during Level 2 automated and manual checks.`
                  : 'All documents passed Level 2 checks with no flags.'}
              </p>
            </div>
            <button className={s.arRegisterBtn} onClick={() => { void openLiveRegister(); }} onMouseEnter={() => { if (!company.locked) prefetch(company.liveRegisterUrl); }} disabled={company.locked || busyOpening}>
              {opening?.label === 'live register' ? <IconSpinner size={14} /> : <IconTable size={14} />} {opening?.label === 'live register' ? 'Opening…' : 'Open live register'}
            </button>
          </div>

          {company.locked && (
            <div className={s.arLockedNote}>
              <IconShieldCheck size={13} />
              {lockedText(company)}
            </div>
          )}
          {(company.missingFiles?.length ?? 0) > 0 && (
            <div className={s.arMissingNote}>
              Files the company could not store (over 3 MB or upload error): {company.missingFiles!.join(', ')}.
            </div>
          )}
          {fileError && <p className={s.arActionError}>{fileError}</p>}

          <div className={s.arDocList}>
            {company.docs.map(doc => {
              const expanded = expandedDocId === doc.id;
              const fields = expanded ? (doc.tallyRows ?? []) : [];
              const docIssues = expanded ? company.issues.filter(i => i.docName === doc.name) : [];
              const mismatchCount = fields.filter(f => !f.match).length;
              const ruleSet = expanded ? resolveRuleSet(doc.name) : null;
              const flaggedRules = expanded
                ? new Set(company.issues.filter(i => i.docName === doc.name).map(i => i.rule))
                : null;
              const checklistOpen = checklistDocId === doc.id;
              return (
                <div key={doc.id} className={s.arDocBlock}>
                  <button className={s.arDocRow} onClick={() => toggleExpand(doc.id)}>
                    <span className={doc.status === 'flagged' ? `${s.arDocIcon} ${s.arDocIconFlag}` : s.arDocIcon}>
                      {doc.status === 'flagged' ? <IconAlertTriangle size={13} /> : <IconCheckCircle size={13} />}
                    </span>
                    <div className={s.arDocInfo}>
                      <span className={s.arDocName}>{doc.name}</span>
                      <span className={s.arDocAct}>{doc.act}{doc.hasFile === false && <> &middot; <span className={s.arNoFile}>no file stored</span></>}</span>
                    </div>
                    {(() => {
                      const r = reviews[doc.id];
                      const n = r?.findings.length ?? 0;
                      return <span className={`${w.rowBadge} ${n ? w.rbBad : r?.verdict === 'pass' ? w.rbOk : w.rbTodo}`}>{n ? `${n} flag${n !== 1 ? 's' : ''}` : r?.verdict === 'pass' ? 'Correct' : 'Not reviewed'}</span>;
                    })()}
                    <span className={doc.status === 'flagged' ? `${s.arDocScore} ${s.arDocScoreLow}` : s.arDocScore}>
                      {doc.score}
                    </span>
                    <span className={s.arDocChevron}>
                      {expanded ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
                    </span>
                  </button>

                  {expanded && (
                    <div className={s.arTallyPanel}>
                      <div className={s.arTallyPanelHead}>
                        <span className={s.arTallyPanelTitle}>{fields.length ? 'Field-level tally' : 'Level 2 result'}</span>
                        {fields.length === 0 ? (
                          <span className={docIssues.length ? s.arTallyMismatchBadge : s.arTallyMatchBadge}>
                            {docIssues.length ? <><IconAlertTriangle size={11} /> {docIssues.length} issue{docIssues.length !== 1 ? 's' : ''}</> : <><IconCheckCircle size={11} /> No issues</>}
                          </span>
                        ) : mismatchCount > 0 ? (
                          <span className={s.arTallyMismatchBadge}>
                            <IconAlertTriangle size={11} /> {mismatchCount} mismatch{mismatchCount !== 1 ? 'es' : ''}
                          </span>
                        ) : (
                          <span className={s.arTallyMatchBadge}>
                            <IconCheckCircle size={11} /> All fields tally
                          </span>
                        )}
                        <button className={s.arOpenDocBtn} disabled={company.locked || !doc.fileUrl || busyOpening} onMouseEnter={() => prefetch(doc.fileUrl)} onClick={() => { void handleOpenDocument(doc); }}>
                          {opening?.label === doc.name ? <IconSpinner size={13} /> : <IconFileText size={13} />} {opening?.label === doc.name ? 'Opening…' : 'Open filed document'}
                        </button>
                      </div>

                      {fields.length === 0 && docIssues.length > 0 && (
                        <div className={s.arDocIssues}>
                          {docIssues.map(i => (
                            <div key={i.id} className={s.arIssueRow}>
                              <span className={`${s.arSevBadge} ${s[SEVERITY_META[i.severity].cls]}`}>{SEVERITY_META[i.severity].label}</span>
                              <div className={s.arIssueBody}><p className={s.arIssueDoc}>{i.rule}</p><p className={s.arIssueCause}>{i.rootCause}</p></div>
                              <span className={i.resolvedL2 ? `${s.arIssueState} ${s.arIssueResolved}` : `${s.arIssueState} ${s.arIssueOpen}`}>{i.resolvedL2 ? 'Resolved in L2' : 'Still open'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {fields.length > 0 && <table className={s.arTallyTable}>
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>As filed</th>
                            <th>Live register</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((f, i) => (
                            <tr key={i} className={f.match ? undefined : s.arTallyRowMismatch}>
                              <td>{f.label}</td>
                              <td>{f.docValue}</td>
                              <td>{f.regValue}</td>
                              <td className={s.arTallyStatusCell}>
                                {f.match
                                  ? <span className={s.arTallyOk}><IconCheckCircle size={13} /></span>
                                  : <span className={s.arTallyBad}><IconXCircle size={13} /></span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>}

                      {ruleSet && (
                        <div className={s.arChecklistSection}>
                          <button className={s.arChecklistToggle} onClick={() => toggleChecklist(doc.id)}>
                            <IconListChecks size={13} />
                            <span>
                              {checklistOpen ? 'Hide' : 'View'} full audit checklist — {ruleSet.category}
                              <span className={s.arChecklistCount}>{ruleSet.rules.length} checks</span>
                            </span>
                            {checklistOpen ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
                          </button>

                          {checklistOpen && (
                            <div className={s.arChecklistBox}>
                              {ruleSet.rules.map((rule, i) => {
                                const flagged = flaggedRules?.has(rule) ?? false;
                                return (
                                  <div
                                    key={i}
                                    className={flagged ? `${s.arChecklistRow} ${s.arChecklistRowFlagged}` : s.arChecklistRow}
                                  >
                                    <span className={flagged ? s.arChecklistIconFlag : s.arChecklistIconOk}>
                                      {flagged ? <IconAlertTriangle size={12} /> : <IconCheckCircle size={12} />}
                                    </span>
                                    <span className={s.arChecklistText}>{rule}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Company data tab (everything the company filed) ─────────────── */}
      {tab === 'company' && (
        <div className={s.arCard}>
          {!company.details ? (
            <div className={s.arLockedNote}><IconShieldCheck size={13} /> {lockedText(company)}</div>
          ) : (
            <>
              <div className={s.arCardHead}>
                <p className={s.arCardTitle}>Company details</p>
                <p className={s.arCardSub}>As entered by the company. Read-only.</p>
              </div>
              <dl className={s.arDetailGrid}>
                {([
                  ['Legal name', company.details.company.name], ['CIN', company.details.company.cin], ['PAN', company.details.company.pan],
                  ['GSTIN', company.details.company.gstin], ['Industry', company.details.company.industry], ['Headcount', company.details.company.headcount],
                  ['State', company.details.company.state], ['Address', company.details.company.address],
                  ['Incorporated', company.details.company.incorporationDate ?? ''],
                  ['Authorised person', company.details.company.authorizedPerson], ['Designation', company.details.company.designation],
                  ['Email', company.details.company.email], ['Phone', company.details.company.phone],
                  ['Acts covered', company.actsCovered.join(', ')],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className={s.arDetailItem}><dt>{k}</dt><dd>{v || '—'}</dd></div>
                ))}
              </dl>

              <div className={s.arCardHead}>
                <p className={s.arCardTitle}>All submitted files ({company.details.files.length})</p>
                <p className={s.arCardSub}>Every document and the live register uploaded for this review.</p>
              </div>
              {fileError && <p className={s.arActionError}>{fileError}</p>}
              {company.details.files.length === 0 ? <p className={s.arCardSub}>No files were stored.</p> : (
                <div className={s.arFileList}>
                  {company.details.files.map(f => (
                    <div key={f.id} className={s.arFileRow}>
                      <span className={s.arFileName}>{f.docName || f.fileName}{f.role === 'live_register' ? ' (live register)' : ''}</span>
                      <span className={s.arFileMeta}>{f.fileName} · {(f.size / 1024).toFixed(0)} KB · {fmtDate(new Date(f.at))}</span>
                      <button className={s.arOpenDocBtn} disabled={busyOpening} onMouseEnter={() => prefetch(f.url)} onClick={() => { void openStoredFile(f.url, f.fileName, f.mimeType); }}>
                        {opening?.label === f.fileName ? <IconSpinner size={13} /> : <IconFileText size={13} />} {opening?.label === f.fileName ? 'Opening…' : 'Open'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {company.details.kycFiles.length > 0 && (
                <>
                  <div className={s.arCardHead}>
                    <p className={s.arCardTitle}>KYC documents ({company.details.kycFiles.length})</p>
                    <p className={s.arCardSub}>Filed at onboarding (held in Zoho WorkDrive).</p>
                  </div>
                  <div className={s.arFileList}>
                    {company.details.kycFiles.map((k, i) => (
                      <div key={i} className={s.arFileRow}>
                        <span className={s.arFileName}>{k.label}</span>
                        <span className={s.arFileMeta}>{k.fileName} · {fmtDate(new Date(k.at))}</span>
                        {k.url && <a className={s.arOpenDocBtn} href={k.url} target="_blank" rel="noreferrer">Open in Zoho</a>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Issues tab ───────────────────────────────────────────────────── */}
      {tab === 'issues' && (
        <div className={s.arCard}>
          <div className={s.arCardHead}>
            <p className={s.arCardTitle}>Issues carried from Level 2</p>
            <p className={s.arCardSub}>
              Flagged by the automated and manual reviewer during Live Register Comparison. Weigh these before making a decision.
            </p>
          </div>
          {company.issues.length === 0 ? (
            <div className={s.arNoIssues}>
              <IconShieldCheck size={15} /> No issues were raised during Level 2 — this submission is clean.
            </div>
          ) : (
            <div className={s.arIssueList}>
              {company.issues.map(issue => {
                const sev = SEVERITY_META[issue.severity];
                return (
                  <div key={issue.id} className={s.arIssueRow}>
                    <span className={`${s.arSevBadge} ${s[sev.cls]}`}>{sev.label}</span>
                    <div className={s.arIssueBody}>
                      <p className={s.arIssueDoc}>{issue.docName} — {issue.rule}</p>
                      <p className={s.arIssueCause}>{issue.rootCause}</p>
                    </div>
                    <span className={issue.resolvedL2 ? `${s.arIssueState} ${s.arIssueResolved}` : `${s.arIssueState} ${s.arIssueOpen}`}>
                      {issue.resolvedL2 ? 'Resolved in L2' : 'Still open'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Decision tab ─────────────────────────────────────────────────── */}
      {tab === 'decision' && (
        <div className={s.arCard}>
          {isDecided ? (
            <div className={s.arDecisionRecord} data-decision={company.status}>
              <div className={s.arDecisionRecordIcon}>
                {company.status === 'approved' && <IconCheckCircle size={30} />}
                {company.status === 'changes_requested' && <IconUndo size={30} />}
                {company.status === 'rejected' && <IconXCircle size={30} />}
              </div>
              <p className={s.arDecisionRecordTitle}>{STATUS_TEXT[company.status]}</p>
              <p className={s.arDecisionRecordMeta}>
                {company.decidedAt && fmtDate(company.decidedAt)} &middot; Reviewed by {auditor.fullName}
              </p>
              <div className={s.arDecisionRecordRemarks}>
                “{company.decisionRemarks}”
              </div>
              {company.status === 'approved' && company.certificate && (
                <div className={s.arCertRow}>
                  <button className={s.arClaimBtn} onClick={() => setShowCertificate(true)}>
                    <IconFileText size={13} /> View compliance certificate
                  </button>
                </div>
              )}
            </div>
          ) : !canWork ? (
            <div className={s.arLockedNote}>
              <IconShieldCheck size={13} />
              {company.status === 'pending'
                ? 'Request access (and accept the terms) to record a decision.'
                : company.accessStatus === 'requested' ? 'Waiting for access approval before you can record a decision.'
                : 'Only the assigned auditor can record a decision for this company.'}
            </div>
          ) : (
            <>
              <div className={s.arCardHead}>
                <p className={s.arCardTitle}>Auditor decision</p>
                <p className={s.arCardSub}>
                  This will generate the Level 3 outcome and notify the company. Remarks are required for
                  Request Changes and Reject.
                </p>
              </div>

              <div className={w.sumBox}>
                <p className={w.sumTitle}>Review summary</p>
                <div className={w.progress}>
                  <span className={w.progressTrack}><span className={w.progressFill} ref={el => { if (el) el.style.width = `${company.docs.length ? Math.round((summary.reviewed / company.docs.length) * 100) : 0}%`; }} /></span>
                  {summary.reviewed} of {company.docs.length} documents reviewed
                </div>
                <div className={w.sumRow}>
                  <span className={w.sumChip}>{summary.flags.length} flag{summary.flags.length !== 1 ? 's' : ''}</span>
                  {(['critical', 'major', 'minor'] as const).map(k => summary.count[k] > 0 && <span key={k} className={`${w.sumChip} ${k === 'critical' ? w.bCritical : k === 'major' ? w.bMajor : w.bMinor}`}>{summary.count[k]} {SEVERITY_LABEL[k]}</span>)}
                </div>
                {summary.flags.length > 0 && (
                  <div className={w.sumList}>
                    {summary.flags.map(f => (
                      <div key={f.id} className={w.flagText}><b>{f.docName}</b> — {f.keyword} ({SEVERITY_LABEL[f.severity]}): {f.comment}</div>
                    ))}
                  </div>
                )}
                <div className={w.recommend}>{summary.recommend}</div>
                <button className={w.sumBtn} disabled={summary.flags.length === 0} onClick={() => setRemarks(summary.remarks)}>Use my findings as remarks</button>
              </div>

              <div className={s.arRemarksField}>
                <label className={s.arLabel}>Auditor remarks</label>
                <textarea
                  className={s.arTextarea}
                  rows={4}
                  placeholder="Summarize your findings — this is shared with the company."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  maxLength={2000}
                />
                <span className={remarks.length > 1900 ? `${w.counter} ${w.counterOver}` : w.counter}>{remarks.length} / 2000</span>
              </div>

              <div className={s.arDecisionBtns}>
                <button
                  className={`${s.arDecisionBtn} ${s.arDecisionBtnApprove}`}
                  onClick={() => setPendingDecision('approved')}
                >
                  <IconCheckCircle size={15} /> Approve
                </button>
                <button
                  className={`${s.arDecisionBtn} ${s.arDecisionBtnChanges}`}
                  onClick={() => setPendingDecision('changes_requested')}
                >
                  <IconUndo size={15} /> Request Changes
                </button>
                <button
                  className={`${s.arDecisionBtn} ${s.arDecisionBtnReject}`}
                  onClick={() => setPendingDecision('rejected')}
                >
                  <IconXCircle size={15} /> Reject
                </button>
              </div>

              {pendingDecision && (
                <div className={s.arConfirmBox} data-decision={pendingDecision}>
                  <p className={s.arConfirmText}>
                    {pendingDecision === 'approved' &&
                      `Confirm approval of ${company.name}? This issues the final Level 3 sign-off.`}
                    {pendingDecision === 'changes_requested' &&
                      `Confirm sending ${company.name} back for changes? They will see your remarks above.`}
                    {pendingDecision === 'rejected' &&
                      `Confirm rejecting ${company.name}'s submission? This ends the current audit cycle.`}
                  </p>
                  {pendingDecision !== 'approved' && !remarks.trim() && (
                    <p className={s.arConfirmWarn}><IconAlertTriangle size={12} /> Please add remarks above before confirming.</p>
                  )}
                  {actionError && <p className={s.arActionError}>{actionError}</p>}
                  <div className={s.arConfirmActions}>
                    <button className={s.arCancelBtn} onClick={() => setPendingDecision(null)}>Cancel</button>
                    <button
                      className={s.arConfirmBtn}
                      disabled={submitting || (pendingDecision !== 'approved' && !remarks.trim())}
                      onClick={() => { void confirmDecision(); }}
                    >
                      {submitting ? 'Submitting…' : 'Confirm decision'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Opening loader: always visible while a file downloads ───────── */}
      {opening && (
        <div className={o.opening} role="status" aria-live="polite">
          <span className={o.openingSpin}><IconSpinner size={18} /></span>
          <div className={o.openingBody}>
            <span className={o.openingTitle}>Opening {opening.label}…</span>
            <span className={o.openingTrack}>
              <span className={opening.pct == null ? `${o.openingBar} ${o.openingBarIndet}` : o.openingBar} data-pct={opening.pct ?? undefined} ref={el => { if (el && opening.pct != null) el.style.width = `${opening.pct}%`; }} />
            </span>
            <span className={o.openingSub}>{opening.pct == null ? 'Fetching from secure storage' : `${opening.pct}%`}</span>
          </div>
        </div>
      )}

      {/* ── Real document + live register viewers (same tools the company
           used to submit) — this is the actual manual-tally workflow ──── */}
      {workspace && (
        <AuditorWorkspace
          doc={workspace.doc}
          company={company}
          blob={workspace.blob}
          kind={workspace.kind}
          review={reviewOf(workspace.doc.id)}
          reviews={reviews}
          auditorName={auditor.fullName}
          readOnly={!canWork}
          suspended={openDoc !== null || sheetFile !== null}
          loadingNext={busyOpening}
          onVerdict={(v) => setVerdict(workspace.doc.id, v)}
          onAddFlag={(f) => addFlag(workspace.doc.id, f)}
          onRemoveFlag={(fid) => removeFlag(workspace.doc.id, fid)}
          onOpenDoc={(d) => { void handleOpenDocument(d); }}
          onFullscreen={() => { if (workspace.blob) setOpenDoc({ doc: workspace.doc, blob: workspace.blob }); }}
          onOpenSheet={() => { if (workspace.blob) setSheetFile(new File([workspace.blob], workspace.doc.fileName || workspace.doc.name, { type: workspace.blob.type })); }}
          onClose={() => setWorkspace(null)}
        />
      )}

      <PdfViewer
        open={openDoc !== null}
        onClose={() => setOpenDoc(null)}
        file={openDoc?.blob ?? null}
        fileName={openDoc ? `${openDoc.doc.name}.pdf` : undefined}
        companyName={company.name}
      />

      <LiveRegister
        open={sheetFile !== null}
        onClose={() => setSheetFile(null)}
        uploadedFile={sheetFile}
        selectedActs={company.actsCovered}
        companyName={company.name}
      />

      <LiveRegister
        open={liveRegisterOpen}
        onClose={() => setLiveRegisterOpen(false)}
        uploadedFile={liveFile}
        selectedActs={company.actsCovered}
        companyName={company.name}
      />

      {/* ── Compliance certificate — available once Level 3 is approved ─── */}
      {showTerms && (
        <AuditorTermsModal
          companyName={company.name}
          busy={claiming}
          error={claimError}
          onAccept={() => { void acceptAndClaim(); }}
          onClose={() => setShowTerms(false)}
        />
      )}

      {company.status === 'approved' && company.certificate && (
        <AuditCertificate
          open={showCertificate}
          onClose={() => setShowCertificate(false)}
          company={company}
          auditor={auditor}
        />
      )}
    </div>
  );
}