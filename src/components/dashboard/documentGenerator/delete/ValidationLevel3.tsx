/**
 * ValidationLevel3.tsx
 *
 * Level 3 — Auditor Review
 *
 * States:
 *   waiting  → Animated progress steps auto-advance via timer
 *   approved → Green hero + Download Audit Report button
 *
 * Production: replace the "Simulate Approval" button with a backend poll.
 */

import { useState, useEffect } from 'react';
import s from './Validation.module.css';

interface ValidationLevel3Props {
  companyName?:      string;
  submittedAt?:      Date;
  isApproved?:       boolean;
  onApprove?:        () => void;   // called when approval is simulated / received
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

function StepBar3({ allDone }: { allDone: boolean }) {
  return (
    <div className={s.stepBar}>
      {(['L1 Upload', 'L2 Compare', 'L3 Audit'] as const).map((label, i) => (
        <div key={label} className={s.stepBarItem}>
          {i > 0 && <div className={`${s.stepLine} ${i <= (allDone ? 3 : 1) ? s.stepLineDone : ''}`} />}
          <div className={`${s.stepDot} ${i < 2 || allDone ? s.stepDotDone : s.stepDotActive}`}>
            {i < 2 || allDone ? '✓' : '3'}
          </div>
          <span className={`${s.stepLabel} ${i === 2 && !allDone ? s.stepLabelActive : ''}`}>{label}</span>
        </div>
      ))}
    </div>
  );
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

  // ── Approved state ──────────────────────────────────────────────────────
  if (approved) {
    return (
      <div className={s.page}>
        <StepBar3 allDone />

        <div className={s.stepCard}>
          <div className={s.approvedHero}>
            <div className={s.approvedOrb}>
              <span style={{ fontSize: 36 }}>✅</span>
            </div>
            <h2 className={s.approvedTitle}>Audit Report Approved!</h2>
            <p className={s.approvedSub}>
              Your compliance audit for <strong>{companyName}</strong> has been reviewed and approved.
              All 3 levels of validation are complete.
            </p>

            <button className={s.downloadReportBtn} onClick={onDownloadReport}>
              <span style={{ fontSize: 18 }}>📋</span>
              Download Audit Report
            </button>

            <div className={s.approvedChecklist}>
              {[
                ['Level 1', 'Documents uploaded & digitally signed'],
                ['Level 2', 'Live register comparison complete'],
                ['Level 3', 'Auditor review approved'],
              ].map(([label, desc]) => (
                <div key={label} className={`${s.auditStep} ${s.done}`}>
                  <div className={`${s.auditStepDot} ${s.dotDone}`}>✓</div>
                  <div className={s.auditStepText}>{label} — {desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting state ───────────────────────────────────────────────────────
  return (
    <div className={s.page}>
      <StepBar3 allDone={false} />

      <div className={s.stepCard}>
        <div className={s.stepCardHeader}>
          <div className={s.stepCardIcon}>🏛️</div>
          <div className={s.stepCardHeaderText}>
            <h2 className={s.stepCardTitle}>Level 3 — Auditor Review</h2>
            <p className={s.stepCardSub}>
              Your documents have been submitted for independent audit review.
              {submittedAt && ` Submitted on ${submittedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`}
            </p>
          </div>
        </div>

        {/* Animated waiting orb */}
        <div className={s.auditWait}>
          <div className={s.auditOrb}>
            <span style={{ fontSize: 30, position: 'relative', zIndex: 1 }}>🏛️</span>
            <div className={s.auditOrbRing} />
            <div className={s.auditOrbRing2} />
          </div>

          <h3 className={s.auditWaitTitle}>Awaiting Auditor Review</h3>
          <p className={s.auditWaitSub}>
            An independent compliance auditor is reviewing your documents.
            You will be notified once the audit report is ready.
            This typically takes 1–3 business days.
          </p>

          {/* Progress steps */}
          <div className={s.auditSteps}>
            {steps.map((step, i) => (
              <div
                key={i}
                className={`${s.auditStep} ${step.state === 'done' ? s.done : step.state === 'active' ? s.active : ''}`}
              >
                <div className={`${s.auditStepDot}
                  ${step.state === 'done'   ? s.dotDone   : ''}
                  ${step.state === 'active' ? s.dotActive : ''}
                  ${step.state === 'pending' ? s.dotPend  : ''}`}>
                  {step.state === 'done' ? '✓' : step.state === 'active' ? '●' : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div className={s.auditStepText}>{step.label}</div>
                  <div className={s.auditStepTime}>{step.sublabel}</div>
                </div>
                {step.state === 'active' && (
                  <div className={s.auditStepInProgress}>In Progress</div>
                )}
              </div>
            ))}
          </div>

          <div className={s.auditElapsed}>
            Time elapsed: {minutes}m {elapsed % 60}s
          </div>
        </div>

        {/* Demo / simulate approval */}
        <div className={s.demoBox}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div className={s.demoText}>
            <strong>Demo mode:</strong> In production, the approval status updates automatically from the backend.
            Click below to simulate auditor approval.
          </div>
          <button
            className={s.btnGreen}
            style={{ fontSize: 11.5, padding: '7px 14px', margin: 0 }}
            onClick={handleApprove}
          >
            Simulate Approval
          </button>
        </div>

        {onBack && (
          <div className={s.stepActions}>
            <button className={s.btnSecondary} onClick={onBack}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
