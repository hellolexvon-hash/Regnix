/**
 * ValidationLanding.tsx
 *
 * Entry screen for the 3-level compliance audit workflow.
 * Shows:
 *  - Overall audit progress summary
 *  - Three level cards (L1 Document Upload, L2 Live Comparison, L3 Auditor Review)
 *  - "Start Validation" button → opens T&C + Self Declaration modal
 *
 * Props:
 *  levelStatus  — which levels are done / active / locked
 *  onStartLevel — called with level number (1|2|3) once T&C agreed
 */

import { useState } from 'react';
import s from './Validation.module.css';
import TermsModal from './TermsModal';

export type LevelState = 'pending' | 'active' | 'done' | 'waiting';

interface LevelInfo {
  level: 1 | 2 | 3;
  title: string;
  description: string;
  icon: string;
  state: LevelState;
  completedAt?: string;
}

interface ValidationLandingProps {
  companyName?: string;
  levelStates: [LevelState, LevelState, LevelState];
  onStartLevel: (level: 1 | 2 | 3) => void;
}

const LEVEL_META = [
  {
    title: 'Document Upload & Verification',
    description: 'Upload all generated compliance registers. Name, preview, and mark each document as verified. Apply your digital signature to complete Level 1.',
    icon: '📁',
    badge: 'badge1' as const,
    badgeLabel: 'Level 1',
  },
  {
    title: 'Live Register Comparison',
    description: 'View your uploaded documents side-by-side with the Live Register. Cross-verify entries, confirm accuracy, and certify compliance.',
    icon: '🔍',
    badge: 'badge2' as const,
    badgeLabel: 'Level 2',
  },
  {
    title: 'Auditor Review',
    description: 'Documents submitted to the assigned auditor. Track review progress in real time. Download the signed audit report once approved.',
    icon: '🏛️',
    badge: 'badge3' as const,
    badgeLabel: 'Level 3',
  },
];

function statusLabel(state: LevelState): { text: string; cls: string } {
  if (state === 'done')    return { text: '✓ Completed', cls: s.statusDone };
  if (state === 'active')  return { text: '● In Progress', cls: s.statusActive };
  if (state === 'waiting') return { text: '⏳ Awaiting Auditor', cls: s.statusWaiting };
  return { text: '— Not Started', cls: s.statusPending };
}

export default function ValidationLanding({
  companyName = 'Your Company',
  levelStates,
  onStartLevel,
}: ValidationLandingProps) {
  const [termsTarget, setTermsTarget] = useState<1 | 2 | 3 | null>(null);

  const doneCount = levelStates.filter(s => s === 'done').length;

  function handleStartClick(level: 1 | 2 | 3) {
    // Level 2 and 3 also need fresh T&C agreement
    setTermsTarget(level);
  }

  function handleTermsAgree() {
    if (termsTarget) {
      onStartLevel(termsTarget);
      setTermsTarget(null);
    }
  }

  function isLocked(idx: number): boolean {
    if (idx === 0) return false;
    return levelStates[idx - 1] !== 'done';
  }

  return (
    <div className={s.page}>
      {/* Step bar */}
      <div className={s.stepBar}>
        {([1, 2, 3] as const).map((n, i) => (
          <div key={n} className={s.stepBarItem}>
            {i > 0 && (
              <div className={`${s.stepLine} ${levelStates[i - 1] === 'done' ? s.stepLineDone : ''}`} />
            )}
            <div className={`${s.stepDot} ${levelStates[i] === 'done' ? s.stepDotDone : levelStates[i] === 'active' || levelStates[i] === 'waiting' ? s.stepDotActive : ''}`}>
              {levelStates[i] === 'done' ? '✓' : n}
            </div>
            <span className={`${s.stepLabel} ${levelStates[i] === 'active' || levelStates[i] === 'waiting' ? s.stepLabelActive : ''}`}>
              Level {n}
            </span>
          </div>
        ))}
      </div>

      {/* Header card */}
      <div className={s.stepCard}>
        <div className={s.stepCardHeader}>
          <div className={s.stepCardIcon}>🛡️</div>
          <div>
            <h2 className={s.stepCardTitle}>Compliance Audit — {companyName}</h2>
            <p className={s.stepCardSub}>
              {doneCount === 0
                ? 'Start your 3-level compliance validation to certify your registers.'
                : doneCount < 3
                ? `${doneCount} of 3 levels completed. Continue to the next level.`
                : 'All 3 levels completed. Your audit report is ready.'}
            </p>
          </div>
        </div>

        {/* Level cards */}
        <div className={s.levelGrid}>
          {LEVEL_META.map((meta, idx) => {
            const state    = levelStates[idx];
            const locked   = isLocked(idx);
            const { text: statusText, cls: statusCls } = statusLabel(state);

            return (
              <div
                key={idx}
                className={`${s.levelCard} ${state === 'done' ? s.done : state === 'active' || state === 'waiting' ? s.active : locked ? s.locked : ''}`}
              >
                <span className={`${s.levelBadge} ${state === 'done' ? s.badgeDone : s[meta.badge]}`}>
                  {state === 'done' ? '✓ Done' : meta.badgeLabel}
                </span>
                <div style={{ fontSize: 28 }}>{meta.icon}</div>
                <div className={s.levelTitle}>{meta.title}</div>
                <div className={s.levelDesc}>{meta.description}</div>
                <span className={`${s.levelStatus} ${statusCls}`}>{statusText}</span>

                {!locked && state !== 'done' && state !== 'waiting' && (
                  <button
                    className={s.startBtn}
                    onClick={() => handleStartClick((idx + 1) as 1 | 2 | 3)}
                  >
                    {state === 'active' ? 'Continue →' : 'Start Validation →'}
                  </button>
                )}
                {locked && (
                  <div style={{ fontSize: 11, color: '#B0ABCA', paddingTop: 4 }}>
                    🔒 Complete Level {idx} first
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* T&C + Self-Declaration modal */}
      {termsTarget && (
        <TermsModal
          level={termsTarget}
          onAgree={handleTermsAgree}
          onClose={() => setTermsTarget(null)}
        />
      )}
    </div>
  );
}
