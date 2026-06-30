/**
 * ValidationLanding.tsx
 *
 * Entry screen for the 3-level compliance audit workflow.
 * Layout:
 *   - Single horizontal progress bar (L1 → L2 → L3) at top
 *   - Three level rows in a vertical list — each shows status chip, title,
 *     description, and one right-aligned action button
 *   - Overall progress as plain "X/3 levels complete" text
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
    icon:        '📁',
    title:       'Document Upload & Verification',
    description: 'Upload all generated compliance registers. Rename, preview, and mark each document as verified. Apply your digital signature to complete Level 1.',
  },
  {
    icon:        '🔍',
    title:       'Live Register Comparison',
    description: 'View your uploaded documents side-by-side with the Live Register. Cross-verify entries, confirm accuracy, and certify compliance.',
  },
  {
    icon:        '🏛️',
    title:       'Auditor Review',
    description: 'Documents submitted to the assigned auditor. Track review progress in real time. Download the signed audit report once approved.',
  },
] as const;

function statusLabel(state: LevelState): { text: string; cls: string } {
  if (state === 'done')    return { text: '✓ Completed',         cls: s.statusDone    };
  if (state === 'active')  return { text: '● In Progress',       cls: s.statusActive  };
  if (state === 'waiting') return { text: '⏳ Awaiting Auditor', cls: s.statusWaiting };
  return                          { text: '— Not Started',       cls: s.statusPending };
}

export default function ValidationLanding({
  companyName,
  levelStates,
  onStartLevel,
}: ValidationLandingProps) {
  const [termsTarget, setTermsTarget] = useState<1 | 2 | 3 | null>(null);

  const doneCount = levelStates.filter(st => st === 'done').length;

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

  function levelRowClass(state: LevelState, locked: boolean): string {
    const classes = [s.levelRow];
    if (state === 'done')                            classes.push(s.levelRowDone);
    if (state === 'active' || state === 'waiting')   classes.push(s.levelRowActive);
    if (locked)                                      classes.push(s.levelRowLocked);
    return classes.join(' ');
  }

  function numberClass(state: LevelState): string {
    if (state === 'done')   return `${s.levelRowNumber} ${s.levelRowNumberDone}`;
    if (state === 'active' || state === 'waiting') return `${s.levelRowNumber} ${s.levelRowNumberActive}`;
    return s.levelRowNumber;
  }

  function progressDotClass(state: LevelState): string {
    if (state === 'done')   return `${s.progressDot} ${s.progressDotDone}`;
    if (state === 'active' || state === 'waiting') return `${s.progressDot} ${s.progressDotActive}`;
    return s.progressDot;
  }

  function progressLabelClass(state: LevelState): string {
    if (state === 'done')   return `${s.progressStepLabel} ${s.progressStepLabelDone}`;
    if (state === 'active' || state === 'waiting') return `${s.progressStepLabel} ${s.progressStepLabelActive}`;
    return s.progressStepLabel;
  }

  return (
    <div className={s.page}>
      <div className={s.pageInner}>

        {/* ── Progress header ─────────────────────────────────────────────── */}
        <div className={s.progressHeader}>
          <div className={s.progressHeaderLeft}>
            <span className={s.progressTitle}>Compliance Audit — {companyName}</span>

            <div className={s.progressTrack}>
              {([0, 1, 2] as const).map((idx) => (
                <div key={idx} className={s.progressStep}>
                  {idx > 0 && (
                    <div className={
                      levelStates[idx - 1] === 'done'
                        ? `${s.progressConnector} ${s.progressConnectorDone}`
                        : s.progressConnector
                    } />
                  )}
                  <div className={progressDotClass(levelStates[idx])}>
                    {levelStates[idx] === 'done' ? '✓' : idx + 1}
                  </div>
                  <span className={progressLabelClass(levelStates[idx])}>
                    Level {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <span className={s.progressSummary}>
            <span className={s.progressSummaryCount}>{doneCount}/3</span> levels complete
          </span>
        </div>

        {/* ── Level rows ─────────────────────────────────────────────────── */}
        <div className={s.landingGrid}>
          {LEVEL_META.map((meta, idx) => {
            const state  = levelStates[idx];
            const locked = isLocked(idx);
            const { text: statusText, cls: statusCls } = statusLabel(state);
            const level = (idx + 1) as 1 | 2 | 3;

            return (
              <div key={idx} className={levelRowClass(state, locked)}>
                <div className={numberClass(state)}>
                  {state === 'done' ? '✓' : idx + 1}
                </div>

                <span className={s.levelRowIcon}>{meta.icon}</span>

                <div className={s.levelRowContent}>
                  <p className={s.levelRowTitle}>{meta.title}</p>
                  <p className={s.levelRowDesc}>{meta.description}</p>
                </div>

                <div className={s.levelRowRight}>
                  <span className={`${s.levelRowStatus} ${statusCls}`}>
                    {statusText}
                  </span>

                  {!locked && state !== 'done' && state !== 'waiting' && (
                    <button
                      className={s.btnPrimary}
                      onClick={() => setTermsTarget(level)}
                    >
                      {state === 'active' ? 'Continue →' : 'Start →'}
                    </button>
                  )}

                  {locked && (
                    <span className={s.lockedNote}>
                      🔒 Complete Level {idx} first
                    </span>
                  )}

                  {state === 'waiting' && (
                    <span className={s.lockedNote}>⏳ Awaiting response</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── T&C modal ────────────────────────────────────────────────────── */}
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
