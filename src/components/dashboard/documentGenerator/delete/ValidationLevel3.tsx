/**
 * ValidationLevel3.tsx
 *
 * Level 3 — Auditor Review
 *
 * States:
 *  'waiting'  — Documents submitted, auditor notified. Animated progress steps.
 *  'approved' — Auditor has approved. Download audit report button.
 *  'rejected' — Auditor has returned with comments. (future)
 *
 * In production: poll your backend for status updates.
 * For now, a "Simulate Approval" button lets you demo the approved state.
 */

import { useState, useEffect } from 'react';
import s from './Validation.module.css';

interface ValidationLevel3Props {
  companyName?: string;
  submittedAt?: Date;
  /** Pass true from parent once backend confirms approval */
  isApproved?: boolean;
  /** Called when user downloads the audit report */
  onDownloadReport?: () => void;
  onBack?: () => void;
}

type AuditStep = {
  label: string;
  sublabel: string;
  state: 'done' | 'active' | 'pending';
};

function buildSteps(minutesElapsed: number): AuditStep[] {
  return [
    {
      label: 'Documents submitted',
      sublabel: 'All compliance registers received',
      state: 'done',
    },
    {
      label: 'Auditor assigned',
      sublabel: minutesElapsed >= 2 ? 'Assigned to your compliance auditor' : 'Assigning…',
      state: minutesElapsed >= 2 ? 'done' : minutesElapsed >= 0 ? 'active' : 'pending',
    },
    {
      label: 'Initial review',
      sublabel: minutesElapsed >= 5 ? 'Documents reviewed for completeness' : 'Reviewing document completeness',
      state: minutesElapsed >= 5 ? 'done' : minutesElapsed >= 2 ? 'active' : 'pending',
    },
    {
      label: 'Statutory check',
      sublabel: minutesElapsed >= 15 ? 'Verified against statutory requirements' : 'Cross-checking with statutory requirements',
      state: minutesElapsed >= 15 ? 'done' : minutesElapsed >= 5 ? 'active' : 'pending',
    },
    {
      label: 'Final report',
      sublabel: 'Awaiting auditor sign-off',
      state: 'pending',
    },
  ];
}

export default function ValidationLevel3({
  companyName = 'Your Company',
  submittedAt,
  isApproved = false,
  onDownloadReport,
  onBack,
}: ValidationLevel3Props) {
  const [elapsed, setElapsed]       = useState(0);   // seconds since submission
  const [approved, setApproved]     = useState(isApproved);
  const [demoMode, setDemoMode]     = useState(false);

  // Count up elapsed time for demo animation
  useEffect(() => {
    if (approved) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [approved]);

  useEffect(() => {
    if (isApproved) setApproved(true);
  }, [isApproved]);

  const minutesElapsed = Math.floor(elapsed / 60);
  const steps = buildSteps(minutesElapsed);

  function formatTime(d: Date) {
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  if (approved) {
    return (
      <div className={s.page}>
        <div className={s.stepBar}>
          {(['L1 Upload', 'L2 Compare', 'L3 Audit'] as const).map((label, i) => (
            <div key={label} className={s.stepBarItem}>
              {i > 0 && <div className={`${s.stepLine} ${s.stepLineDone}`} />}
              <div className={`${s.stepDot} ${s.stepDotDone}`}>✓</div>
              <span className={s.stepLabel}>{label}</span>
            </div>
          ))}
        </div>

        <div className={s.stepCard}>
          <div className={s.approvedHero}>
            <div className={s.approvedOrb}>✅</div>
            <h2 className={s.approvedTitle}>Audit Report Approved!</h2>
            <p className={s.approvedSub}>
              Your compliance audit for <strong>{companyName}</strong> has been reviewed and approved by the auditor.
              All 3 levels of validation are now complete.
            </p>

            <button
              className={s.downloadReportBtn}
              onClick={onDownloadReport}
            >
              <span style={{ fontSize: 20 }}>📋</span>
              Download Audit Report
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 420 }}>
              {([
                { icon: '✓', label: 'Level 1', desc: 'Documents uploaded & signed', color: '#059669' },
                { icon: '✓', label: 'Level 2', desc: 'Live register comparison complete', color: '#059669' },
                { icon: '✓', label: 'Level 3', desc: 'Auditor review approved', color: '#059669' },
              ]).map(row => (
                <div key={row.label} className={s.auditStep} style={{ borderColor: '#A7F3D0', background: '#F0FDF4' }}>
                  <div className={`${s.auditStepDot} ${s.dotDone}`}>{row.icon}</div>
                  <div className={s.auditStepText}>{row.label} — {row.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      {/* Step bar */}
      <div className={s.stepBar}>
        {(['L1 Upload', 'L2 Compare', 'L3 Audit'] as const).map((label, i) => (
          <div key={label} className={s.stepBarItem}>
            {i > 0 && <div className={`${s.stepLine} ${i <= 1 ? s.stepLineDone : ''}`} />}
            <div className={`${s.stepDot} ${i < 2 ? s.stepDotDone : s.stepDotActive}`}>
              {i < 2 ? '✓' : '3'}
            </div>
            <span className={`${s.stepLabel} ${i === 2 ? s.stepLabelActive : ''}`}>{label}</span>
          </div>
        ))}
      </div>

      <div className={s.stepCard}>
        <div className={s.stepCardHeader}>
          <div className={s.stepCardIcon}>🏛️</div>
          <div>
            <h2 className={s.stepCardTitle}>Level 3 — Auditor Review</h2>
            <p className={s.stepCardSub}>
              Your documents have been submitted for independent audit review.
              {submittedAt && ` Submitted on ${formatTime(submittedAt)}.`}
            </p>
          </div>
        </div>

        {/* Animated waiting state */}
        <div className={s.auditWait}>
          <div className={s.auditOrb}>
            🏛️
            <div className={s.auditOrbRing} />
            <div className={s.auditOrbRing2} />
          </div>
          <h3 className={s.auditWaitTitle}>Awaiting Auditor Review</h3>
          <p className={s.auditWaitSub}>
            An independent compliance auditor is reviewing your documents.
            You will receive a notification once the audit report is ready.
            This typically takes 1–3 business days.
          </p>

          {/* Progress steps */}
          <div className={s.auditSteps}>
            {steps.map((step, i) => (
              <div key={i} className={`${s.auditStep} ${step.state === 'done' ? s.done : step.state === 'active' ? s.active : ''}`}>
                <div className={`${s.auditStepDot} ${step.state === 'done' ? s.dotDone : step.state === 'active' ? s.dotActive : s.dotPend}`}>
                  {step.state === 'done' ? '✓' : step.state === 'active' ? '●' : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div className={s.auditStepText}>{step.label}</div>
                  <div className={s.auditStepTime}>{step.sublabel}</div>
                </div>
                {step.state === 'active' && (
                  <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600 }}>In Progress</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: '#B0ABCA', marginTop: 8 }}>
            Time elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s
          </div>
        </div>

        {/* Dev / demo controls */}
        <div style={{ padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <div style={{ flex: 1, fontSize: 11.5, color: '#92400E', lineHeight: 1.5 }}>
            <strong>Demo:</strong> In production, the approval status updates automatically.
            Click below to simulate auditor approval.
          </div>
          <button
            className={s.btnGreen}
            style={{ margin: 0, fontSize: 11.5, padding: '7px 14px' }}
            onClick={() => setApproved(true)}
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
