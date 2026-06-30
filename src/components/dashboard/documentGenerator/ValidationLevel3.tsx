/**
 * ValidationLevel3.tsx
 *
 * Level 3 — Auditor Review
 *
 * Layout: single centered column, max 600px.
 * Waiting state: animated orb + vertical status timeline.
 * Approved state: full-width success banner + summary checklist.
 *
 * Zero inline styles — all from Validation.module.css.
 */

import { useState, useEffect } from 'react';
import s from './Validation.module.css';

interface ValidationLevel3Props {
  companyName?:      string;
  submittedAt?:      Date;
  isApproved?:       boolean;
  onApprove?:        () => void;
  onDownloadReport?: () => void;
  onBack?:           () => void;
}

type StepState = 'done' | 'active' | 'pending';

interface AuditStep {
  label:    string;
  sublabel: string;
  state:    StepState;
}

function buildSteps(minutes: number): AuditStep[] {
  return [
    {
      label:    'Documents submitted',
      sublabel: 'All compliance registers received',
      state:    'done',
    },
    {
      label:    'Auditor assigned',
      sublabel: minutes >= 2 ? 'Assigned to your compliance auditor' : 'Assigning auditor…',
      state:    minutes >= 2 ? 'done' : 'active',
    },
    {
      label:    'Initial review',
      sublabel: minutes >= 5 ? 'Documents reviewed for completeness' : 'Reviewing document completeness',
      state:    minutes >= 5 ? 'done' : minutes >= 2 ? 'active' : 'pending',
    },
    {
      label:    'Statutory check',
      sublabel: minutes >= 15 ? 'Verified against statutory requirements' : 'Cross-checking statutory requirements',
      state:    minutes >= 15 ? 'done' : minutes >= 5 ? 'active' : 'pending',
    },
    {
      label:    'Final report',
      sublabel: 'Awaiting auditor sign-off',
      state:    'pending',
    },
  ];
}

function dotClass(state: StepState): string {
  if (state === 'done')    return `${s.l3TimelineDot} ${s.l3DotDone}`;
  if (state === 'active')  return `${s.l3TimelineDot} ${s.l3DotActive}`;
  return `${s.l3TimelineDot} ${s.l3DotPending}`;
}

function connectorClass(prevState: StepState): string {
  return prevState === 'done'
    ? `${s.l3TimelineConnector} ${s.l3TimelineConnectorDone}`
    : s.l3TimelineConnector;
}

export default function ValidationLevel3({
  companyName      = 'Your Company',
  submittedAt,
  isApproved       = false,
  onApprove,
  onDownloadReport,
  onBack,
}: ValidationLevel3Props) {
  const [elapsed,  setElapsed]  = useState(0);
  const [approved, setApproved] = useState(isApproved);

  useEffect(() => {
    if (approved) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [approved]);

  useEffect(() => {
    if (isApproved) setApproved(true);
  }, [isApproved]);

  function handleApprove() {
    setApproved(true);
    onApprove?.();
  }

  const minutes = Math.floor(elapsed / 60);
  const steps   = buildSteps(minutes);

  // ── Approved ──────────────────────────────────────────────────────────────
  if (approved) {
    return (
      <div className={s.page}>
        <div className={s.pageInner}>

          {/* Progress header */}
          <div className={s.progressHeader}>
            <div className={s.progressHeaderLeft}>
              <span className={s.progressTitle}>Compliance Audit — Complete</span>
              <div className={s.progressTrack}>
                {(['L1 Upload', 'L2 Compare', 'L3 Audit'] as const).map((label, i) => (
                  <div key={label} className={s.progressStep}>
                    {i > 0 && (
                      <div className={`${s.progressConnector} ${s.progressConnectorDone}`} />
                    )}
                    <div className={`${s.progressDot} ${s.progressDotDone}`}>✓</div>
                    <span className={`${s.progressStepLabel} ${s.progressStepLabelDone}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <span className={s.progressSummary}>
              <span className={s.progressSummaryCount}>3/3</span> levels complete
            </span>
          </div>

          <div className={s.l3Column}>

            {/* Success banner */}
            <div className={s.approvedBanner}>
              <div className={s.approvedOrb}>✅</div>
              <h2 className={s.approvedTitle}>Audit Report Approved!</h2>
              <p className={s.approvedSub}>
                Your compliance audit for <strong>{companyName}</strong> has been reviewed and approved by an independent auditor. All 3 levels of validation are complete.
              </p>
              <button className={s.downloadReportBtn} onClick={onDownloadReport}>
                <span>📋</span>
                Download Audit Report
              </button>
            </div>

            {/* Summary checklist */}
            <div className={s.card}>
              <div className={s.cardHeader}>
                <div className={s.cardHeaderIcon}>✅</div>
                <div className={s.cardHeaderText}>
                  <h2 className={s.cardTitle}>Audit Summary</h2>
                  <p className={s.cardSub}>All three validation levels completed successfully.</p>
                </div>
              </div>
              <div className={s.cardBody}>
                <div className={s.approvedChecklist}>
                  {[
                    ['Level 1', 'Documents uploaded & digitally signed'],
                    ['Level 2', 'Live register comparison complete'],
                    ['Level 3', 'Auditor review approved'],
                  ].map(([label, desc]) => (
                    <div key={label} className={s.approvedCheckRow}>
                      <div className={s.approvedCheckDot}>✓</div>
                      <span className={s.approvedCheckText}>
                        <strong>{label}</strong> — {desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting ───────────────────────────────────────────────────────────────
  return (
    <div className={s.page}>
      <div className={s.pageInner}>

        {/* Progress header */}
        <div className={s.progressHeader}>
          <div className={s.progressHeaderLeft}>
            <span className={s.progressTitle}>Compliance Audit — Level 3</span>
            <div className={s.progressTrack}>
              {(['L1 Upload', 'L2 Compare', 'L3 Audit'] as const).map((label, i) => (
                <div key={label} className={s.progressStep}>
                  {i > 0 && (
                    <div className={
                      i <= 1
                        ? `${s.progressConnector} ${s.progressConnectorDone}`
                        : s.progressConnector
                    } />
                  )}
                  <div className={
                    i < 2
                      ? `${s.progressDot} ${s.progressDotDone}`
                      : `${s.progressDot} ${s.progressDotActive}`
                  }>
                    {i < 2 ? '✓' : '3'}
                  </div>
                  <span className={
                    i < 2
                      ? `${s.progressStepLabel} ${s.progressStepLabelDone}`
                      : `${s.progressStepLabel} ${s.progressStepLabelActive}`
                  }>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <span className={s.progressSummary}>
            <span className={s.progressSummaryCount}>2/3</span> levels complete
          </span>
        </div>

        <div className={s.l3Column}>

          {/* Main card */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <div className={s.cardHeaderIcon}>🏛️</div>
              <div className={s.cardHeaderText}>
                <h2 className={s.cardTitle}>Level 3 — Auditor Review</h2>
                <p className={s.cardSub}>
                  Your documents have been submitted for independent audit review.
                  {submittedAt && ` Submitted on ${submittedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`}
                </p>
              </div>
            </div>

            <div className={s.cardBody}>

              {/* Animated orb */}
              <div className={s.auditWait}>
                <div className={s.auditOrb}>
                  <span>🏛️</span>
                  <div className={s.auditOrbRing} />
                  <div className={s.auditOrbRing2} />
                </div>

                <h3 className={s.auditWaitTitle}>Awaiting Auditor Review</h3>
                <p className={s.auditWaitSub}>
                  An independent compliance auditor is reviewing your documents. You will be notified once the audit report is ready. This typically takes 1–3 business days.
                </p>

                {/* Vertical timeline */}
                <div className={s.l3Timeline}>
                  {steps.map((step, i) => (
                    <div key={i} className={s.l3TimelineItem}>
                      <div className={s.l3TimelineLeft}>
                        <div className={dotClass(step.state)}>
                          {step.state === 'done' ? '✓' : step.state === 'active' ? '●' : i + 1}
                        </div>
                        {i < steps.length - 1 && (
                          <div className={connectorClass(step.state)} />
                        )}
                      </div>
                      <div className={s.l3TimelineContent}>
                        <p className={s.l3TimelineLabel}>{step.label}</p>
                        <p className={s.l3TimelineSublabel}>{step.sublabel}</p>
                        {step.state === 'active' && (
                          <span className={s.l3InProgressBadge}>● In Progress</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <span className={s.auditElapsed}>
                  Time elapsed: {minutes}m {elapsed % 60}s
                </span>
              </div>

              {/* Demo simulate box */}
              <div className={s.demoBox}>
                <span>💡</span>
                <div className={s.demoText}>
                  <strong>Demo mode:</strong> In production, approval status updates automatically from the backend. Click below to simulate auditor approval.
                </div>
                <button className={`${s.btnGreen} ${s.btnSmall}`} onClick={handleApprove}>
                  Simulate Approval
                </button>
              </div>
            </div>

            {onBack && (
              <div className={s.cardFooter}>
                <button className={s.btnSecondary} onClick={onBack}>← Back</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
