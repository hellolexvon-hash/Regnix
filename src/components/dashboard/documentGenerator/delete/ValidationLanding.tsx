/**
 * ValidationLanding.tsx
 *
 * Entry screen for the 3-level compliance audit workflow.
 * Shows overall audit progress + three level cards.
 * "Start Validation" → T&C + Self-Declaration modal → onStartLevel callback.
 */

import { useState } from 'react';
import s from './Validation.module.css';
import TermsModal from './TermsModal';
import type { LevelState } from './validationStore';

interface ValidationLandingProps {
  companyName:  string;
  levelStates:  [LevelState, LevelState, LevelState];
  onStartLevel: (level: 1 | 2 | 3) => void;
}

const LEVEL_META = [
  {
    title:       'Document Upload & Verification',
    description: 'Upload all generated compliance registers. Rename, preview, and mark each document as verified. Apply your digital signature to complete Level 1.',
    icon:        '📁',
    badgeLabel:  'Level 1',
  },
  {
    title:       'Live Register Comparison',
    description: 'View your uploaded documents side-by-side with the Live Register. Cross-verify entries, confirm accuracy, and certify compliance.',
    icon:        '🔍',
    badgeLabel:  'Level 2',
  },
  {
    title:       'Auditor Review',
    description: 'Documents submitted to the assigned auditor. Track review progress in real time. Download the signed audit report once approved.',
    icon:        '🏛️',
    badgeLabel:  'Level 3',
  },
] as const;

function statusLabel(state: LevelState): { text: string; cls: string } {
  if (state === 'done')    return { text: '✓ Completed',         cls: s.statusDone    };
  if (state === 'active')  return { text: '● In Progress',       cls: s.statusActive  };
  if (state === 'waiting') return { text: '⏳ Awaiting Auditor', cls: s.statusWaiting };
  return                          { text: '— Not Started',        cls: s.statusPending };
}

export default function ValidationLanding({
  companyName,
  levelStates,
  onStartLevel,
}: ValidationLandingProps) {
  const [termsTarget, setTermsTarget] = useState<1 | 2 | 3 | null>(null);

  const doneCount = levelStates.filter(s => s === 'done').length;

  function isLocked(idx: number): boolean {
    if (idx === 0) return false;
    return levelStates[idx - 1] !== 'done';
  }

  function handleAgree() {
    if (termsTarget) {
      onStartLevel(termsTarget);
      setTermsTarget(null);
    }
  }

  return (
    <div className={s.page}>

      {/* ── Validation step bar ─────────────────────────────────────────── */}
      <div className={s.stepBar}>
        {([1, 2, 3] as const).map((n, i) => (
          <div key={n} className={s.stepBarItem}>
            {i > 0 && (
              <div className={`${s.stepLine} ${levelStates[i - 1] === 'done' ? s.stepLineDone : ''}`} />
            )}
            <div className={`${s.stepDot}
              ${levelStates[i] === 'done'                                     ? s.stepDotDone   : ''}
              ${levelStates[i] === 'active' || levelStates[i] === 'waiting'   ? s.stepDotActive : ''}`}>
              {levelStates[i] === 'done' ? '✓' : n}
            </div>
            <span className={`${s.stepLabel} ${levelStates[i] === 'active' || levelStates[i] === 'waiting' ? s.stepLabelActive : ''}`}>
              Level {n}
            </span>
          </div>
        ))}
      </div>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className={s.stepCard}>
        <div className={s.stepCardHeader}>
          <div className={s.stepCardIcon}>🛡️</div>
          <div className={s.stepCardHeaderText}>
            <h2 className={s.stepCardTitle}>Compliance Audit — {companyName}</h2>
            <p className={s.stepCardSub}>
              {doneCount === 0
                ? 'Start your 3-level compliance validation to certify your registers.'
                : doneCount < 3
                ? `${doneCount} of 3 levels completed. Continue to the next level.`
                : 'All 3 levels completed. Your audit report is ready to download.'}
            </p>
          </div>

          {/* Overall progress ring */}
          <div className={s.progressRing}>
            <svg width="54" height="54" viewBox="0 0 54 54">
              <circle cx="27" cy="27" r="22" fill="none" stroke="#E5E2F0" strokeWidth="5" />
              <circle
                cx="27" cy="27" r="22" fill="none"
                stroke="#7C3AED" strokeWidth="5"
                strokeDasharray={`${(doneCount / 3) * 138.2} 138.2`}
                strokeLinecap="round"
                transform="rotate(-90 27 27)"
                style={{ transition: 'stroke-dasharray 600ms ease' }}
              />
              <text x="27" y="32" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F0A1E">
                {doneCount}/3
              </text>
            </svg>
          </div>
        </div>

        {/* ── Level cards ─────────────────────────────────────────────── */}
        <div className={s.levelGrid}>
          {LEVEL_META.map((meta, idx) => {
            const state  = levelStates[idx];
            const locked = isLocked(idx);
            const { text: statusText, cls: statusCls } = statusLabel(state);

            return (
              <div
                key={idx}
                className={`${s.levelCard}
                  ${state === 'done'                                   ? s.levelDone    : ''}
                  ${state === 'active' || state === 'waiting'          ? s.levelActive  : ''}
                  ${locked                                             ? s.levelLocked  : ''}`}
              >
                {/* Badge */}
                <span className={`${s.levelBadge} ${state === 'done' ? s.badgeDone : ''}`}>
                  {state === 'done' ? '✓ Done' : meta.badgeLabel}
                </span>

                <div className={s.levelIcon}>{meta.icon}</div>
                <div className={s.levelTitle}>{meta.title}</div>
                <div className={s.levelDesc}>{meta.description}</div>

                <span className={`${s.levelStatus} ${statusCls}`}>{statusText}</span>

                {!locked && state !== 'done' && state !== 'waiting' && (
                  <button
                    className={s.startBtn}
                    onClick={() => setTermsTarget((idx + 1) as 1 | 2 | 3)}
                  >
                    {state === 'active' ? 'Continue →' : 'Start Validation →'}
                  </button>
                )}

                {locked && (
                  <div className={s.lockedHint}>
                    🔒 Complete Level {idx} first
                  </div>
                )}

                {state === 'waiting' && (
                  <div className={s.waitingHint}>
                    ⏳ Awaiting auditor response
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── T&C modal ───────────────────────────────────────────────────── */}
      {termsTarget && (
        <TermsModal
          level={termsTarget}
          onAgree={handleAgree}
          onClose={() => setTermsTarget(null)}
        />
      )}
    </div>
  );
}
