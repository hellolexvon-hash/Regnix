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

import { useState } from 'react';
import s from './Auditor.module.css';
import { authFetch, type Auditor, type CompanyReview, type IssueSeverity, type ReviewDoc } from './auditorStore';
import PdfViewer from '../documentGenerator/PdfViewer';
import LiveRegister from '../documentGenerator/LiveRegister';
import AuditorTermsModal from './AuditorTermsModal';
import { resolveRuleSet } from './ruleLibrary';
import AuditCertificate from './AuditCertificate';
import {
  IconArrowLeft, IconFileText, IconFlag, IconPenLine, IconCheckCircle, IconUndo,
  IconXCircle, IconAlertTriangle, IconTable, IconChevronDown, IconChevronRight,
  IconClock, IconEye, IconShieldCheck, IconListChecks,
} from './icons';

interface AuditorCompanyReviewProps {
  company:  CompanyReview;
  auditor:  Auditor;
  onBack:   () => void;
  onClaim:  (id: string, acceptedTerms: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDecide: (id: string, decision: 'approved' | 'changes_requested' | 'rejected', remarks: string) => Promise<{ ok: true; certificateNo?: string } | { ok: false; error: string }>;
}

type Tab = 'documents' | 'issues' | 'decision';

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

function fmtDate(d: Date): string {
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function toFileFromBlob(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await authFetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

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

  const canWork = company.status === 'in_review' && company.assignedTo === auditor.id && !company.locked;

  async function openLiveRegister() {
    setFileError('');
    if (!company.liveRegisterUrl) { setFileError('The company\'s live register was not stored (missing or over 3 MB).'); return; }
    if (!liveFile) {
      const blob = await fetchBlob(company.liveRegisterUrl);
      if (!blob) { setFileError('Could not load the live register.'); return; }
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
    setFileError('');
    if (!doc.fileUrl) { setFileError(`"${doc.name}" has no stored file — ask the company to re-upload it.`); return; }
    const blob = await fetchBlob(doc.fileUrl);
    if (!blob) { setFileError(`Could not load "${doc.name}".`); return; }
    const isPdf = blob.type === 'application/pdf' || /\.pdf$/i.test(doc.fileName ?? '');
    if (isPdf) setOpenDoc({ doc, blob });
    else setSheetFile(new File([blob], doc.fileName || doc.name, { type: blob.type }));
  }

  function toggleExpand(docId: string) {
    setExpandedDocId(cur => (cur === docId ? null : docId));
    setChecklistDocId(null);
  }

  function toggleChecklist(docId: string) {
    setChecklistDocId(cur => (cur === docId ? null : docId));
  }

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
          {company.status === 'pending' && (
            <button className={s.arClaimBtn} onClick={() => { setClaimError(''); setShowTerms(true); }}>Claim for review</button>
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
            <button className={s.arRegisterBtn} onClick={() => { void openLiveRegister(); }} disabled={company.locked}>
              <IconTable size={14} /> Open live register
            </button>
          </div>

          {company.locked && (
            <div className={s.arLockedNote}>
              <IconShieldCheck size={13} />
              {company.status === 'pending'
                ? 'Claim this review and accept the auditor terms to open the submitted documents and the live register.'
                : 'This review belongs to another auditor — documents are only visible to the assigned auditor.'}
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
                        <button className={s.arOpenDocBtn} disabled={company.locked || !doc.fileUrl} onClick={() => { void handleOpenDocument(doc); }}>
                          <IconFileText size={13} /> Open filed document
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
                ? 'Claim this review (and accept the terms) to record a decision.'
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

              <div className={s.arRemarksField}>
                <label className={s.arLabel}>Auditor remarks</label>
                <textarea
                  className={s.arTextarea}
                  rows={4}
                  placeholder="Summarize your findings — this is shared with the company."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
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

      {/* ── Real document + live register viewers (same tools the company
           used to submit) — this is the actual manual-tally workflow ──── */}
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