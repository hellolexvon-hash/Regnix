/**
 * TermsModal.tsx
 *
 * Professional two-step agreement modal before each validation level.
 *
 * Design:
 *   - Dark header bar with level icon, title, step indicators
 *   - Tab navigation: "Terms & Conditions" → "Self Declaration"
 *   - T&C: scrollable legal text, scroll-progress indicator,
 *     checkbox unlocks only after full scroll
 *   - Declaration: italic declaration card + confirmation checkbox
 *   - Footer: progress bar, Cancel, I Agree & Continue (disabled until both checked)
 *
 * Zero inline styles — all from Validation.module.css (.tm* classes).
 */

import { useState, useRef, useEffect } from 'react';
import s from './Validation.module.css';

interface TermsModalProps {
  level:   1 | 2 | 3;
  onAgree: () => void;
  onClose: () => void;
}

const LEVEL_CONTEXT: Record<1 | 2 | 3, {
  title:       string;
  icon:        string;
  tag:         string;
  declaration: string;
}> = {
  1: {
    title:       'Level 1 — Document Upload & Verification',
    icon:        '📁',
    tag:         'L1',
    declaration: 'I declare that all documents being uploaded are authentic, accurate, and have been prepared in accordance with the applicable laws and regulations. I take full responsibility for the accuracy of the information submitted and acknowledge that any misrepresentation may lead to legal consequences under applicable Indian labour and IT laws.',
  },
  2: {
    title:       'Level 2 — Live Register Comparison',
    icon:        '🔍',
    tag:         'L2',
    declaration: 'I declare that I have personally reviewed all uploaded documents against the Live Register and that the data is consistent, accurate, and compliant with all applicable statutory requirements. I confirm that the comparison results reflect the true compliance status of the organisation.',
  },
  3: {
    title:       'Level 3 — Auditor Review & Submission',
    icon:        '🏛️',
    tag:         'L3',
    declaration: 'I declare that all documents submitted for auditor review are final, complete, and accurately represent the compliance status of the organisation. I understand that any misrepresentation is subject to legal consequences under applicable laws, and that the submitted audit report will be treated as an official compliance record.',
  },
};

type Tab = 'tc' | 'declaration';

export default function TermsModal({ level, onAgree, onClose }: TermsModalProps) {
  const [activeTab,  setActiveTab]  = useState<Tab>('tc');
  const [tcScrolled, setTcScrolled] = useState(false);
  const [tcChecked,  setTcChecked]  = useState(false);
  const [decChecked, setDecChecked] = useState(false);
  const tcRef = useRef<HTMLDivElement>(null);
  const ctx   = LEVEL_CONTEXT[level];

  const canAgree  = tcChecked && decChecked;
  const progress  = tcChecked && decChecked ? 100 : tcChecked ? 50 : 0;

  function handleScroll() {
    const el = tcRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setTcScrolled(true);
    }
  }

  useEffect(() => {
    const el = tcRef.current;
    if (el && el.scrollHeight <= el.clientHeight) setTcScrolled(true);
  }, []);

  // When TC is checked, auto-advance to declaration tab
  function handleTcCheck(checked: boolean) {
    setTcChecked(checked);
    if (checked) setTimeout(() => setActiveTab('declaration'), 300);
  }

  return (
    <div className={s.tmOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.tmModal}>

        {/* ── Dark header ─────────────────────────────────────────────────── */}
        <div className={s.tmHeader}>
          <div className={s.tmHeaderBadge}>
            <div className={s.tmLevelCircle}>{ctx.icon}</div>
            <span className={s.tmLevelTag}>{ctx.tag}</span>
          </div>

          <div className={s.tmHeaderContent}>
            <p className={s.tmHeaderTitle}>Terms &amp; Declaration</p>
            <p className={s.tmHeaderSub}>{ctx.title}</p>

            {/* Step indicators */}
            <div className={s.tmSteps}>
              {/* Step 1: T&C */}
              <div className={s.tmStep}>
                <div className={
                  tcChecked
                    ? `${s.tmStepDot} ${s.tmStepDotDone}`
                    : activeTab === 'tc'
                    ? `${s.tmStepDot} ${s.tmStepDotActive}`
                    : s.tmStepDot
                }>
                  {tcChecked ? '✓' : '1'}
                </div>
                <span className={
                  activeTab === 'tc' && !tcChecked
                    ? `${s.tmStepLabel} ${s.tmStepLabelActive}`
                    : s.tmStepLabel
                }>
                  Terms
                </span>
              </div>

              <div className={tcChecked ? `${s.tmStepLine} ${s.tmStepLineDone}` : s.tmStepLine} />

              {/* Step 2: Declaration */}
              <div className={s.tmStep}>
                <div className={
                  decChecked
                    ? `${s.tmStepDot} ${s.tmStepDotDone}`
                    : activeTab === 'declaration'
                    ? `${s.tmStepDot} ${s.tmStepDotActive}`
                    : s.tmStepDot
                }>
                  {decChecked ? '✓' : '2'}
                </div>
                <span className={
                  activeTab === 'declaration' && !decChecked
                    ? `${s.tmStepLabel} ${s.tmStepLabelActive}`
                    : s.tmStepLabel
                }>
                  Declaration
                </span>
              </div>
            </div>
          </div>

          <button className={s.tmHeaderClose} onClick={onClose}>✕</button>
        </div>

        {/* ── Section tabs ─────────────────────────────────────────────────── */}
        <div className={s.tmSectionNav}>
          <button
            className={[
              s.tmSectionTab,
              activeTab === 'tc' ? s.tmSectionTabActive : '',
              tcChecked && activeTab !== 'tc' ? s.tmSectionTabDone : '',
            ].join(' ')}
            onClick={() => setActiveTab('tc')}
          >
            <div className={
              tcChecked
                ? `${s.tmTabDot} ${s.tmTabDotDone}`
                : activeTab === 'tc'
                ? `${s.tmTabDot} ${s.tmTabDotActive}`
                : s.tmTabDot
            }>
              {tcChecked ? '✓' : '1'}
            </div>
            Terms &amp; Conditions
          </button>

          <button
            className={[
              s.tmSectionTab,
              activeTab === 'declaration' ? s.tmSectionTabActive : '',
              decChecked && activeTab !== 'declaration' ? s.tmSectionTabDone : '',
            ].join(' ')}
            onClick={() => setActiveTab('declaration')}
          >
            <div className={
              decChecked
                ? `${s.tmTabDot} ${s.tmTabDotDone}`
                : activeTab === 'declaration'
                ? `${s.tmTabDot} ${s.tmTabDotActive}`
                : s.tmTabDot
            }>
              {decChecked ? '✓' : '2'}
            </div>
            Self Declaration
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className={s.tmBody}>

          {/* ─ Tab 1: Terms & Conditions ─ */}
          {activeTab === 'tc' && (
            <div className={s.tmSection}>
              <p className={s.tmSectionTitle}>
                <span className={s.tmSectionTitleIcon}>📋</span>
                Regnix Compliance Validation — Terms of Use
              </p>

              <div className={s.tmScrollBox}>
                <div className={s.tmScrollInner} ref={tcRef} onScroll={handleScroll}>
                  <p>By proceeding with the compliance validation workflow, you agree to the following terms and conditions in full:</p>
                  <ul>
                    <li>
                      <strong>Accuracy of Records:</strong> All documents uploaded must be original, accurate, and created in compliance with Indian labour laws including the Factories Act 1948, Contract Labour (R&A) Act 1970, Code on Wages 2019, and applicable state Shops &amp; Establishments Acts.
                    </li>
                    <li>
                      <strong>Digital Signature:</strong> The digital signature applied during Level 1 constitutes legal acceptance of the authenticity of all submitted documents. Misuse of digital signatures is a criminal offence under Section 66 of the Information Technology Act 2000.
                    </li>
                    <li>
                      <strong>Data Confidentiality:</strong> All data submitted through this platform is stored securely using industry-standard encryption. Your data will not be shared with third parties except the assigned auditor and regulatory authorities as required by applicable law.
                    </li>
                    <li>
                      <strong>Auditor Independence:</strong> The Level 3 auditor review is conducted by an independent third-party compliance auditor. Regnix does not influence, direct, or interfere with audit outcomes in any manner.
                    </li>
                    <li>
                      <strong>Legal Compliance:</strong> It is the sole responsibility of the company and its authorised representative to ensure all registers comply with applicable statutory requirements. Regnix provides a platform for submission and does not verify legal compliance independently.
                    </li>
                    <li>
                      <strong>Document Retention:</strong> All uploaded documents, audit logs, and audit reports will be retained for a minimum of 5 years in accordance with applicable Indian labour law requirements.
                    </li>
                    <li>
                      <strong>Limitation of Liability:</strong> Regnix shall not be held liable for any penalties, legal actions, or regulatory proceedings arising from inaccurate, incomplete, or fraudulent documents submitted through this platform.
                    </li>
                    <li>
                      <strong>Platform Availability:</strong> Regnix does not guarantee uninterrupted access to the platform and shall not be liable for any delays or data loss arising from technical interruptions.
                    </li>
                    <li>
                      <strong>Amendments:</strong> These terms may be updated by Regnix at any time without prior notice. Continued use of the platform after any amendment constitutes your acceptance of the revised terms.
                    </li>
                  </ul>
                  <p>
                    If you do not agree with any of the above terms, please click "Cancel" and do not proceed with the validation workflow. For queries, contact compliance@regnix.in.
                  </p>
                </div>

                {/* Scroll progress indicator */}
                <div className={s.tmScrollProgress}>
                  {tcScrolled ? (
                    <span className={s.tmScrollDone}>✓ All terms read</span>
                  ) : (
                    <span className={s.tmScrollHint}>↓ Scroll to read all terms</span>
                  )}
                </div>
              </div>

              {/* TC Checkbox */}
              <label className={[
                s.tmCheckCard,
                !tcScrolled ? s.tmCheckCardDisabled : '',
              ].join(' ')}>
                <input
                  type="checkbox"
                  className={s.tmCheckCardInput}
                  checked={tcChecked}
                  disabled={!tcScrolled}
                  onChange={e => handleTcCheck(e.target.checked)}
                />
                <span className={s.tmCheckCardLabel}>
                  I have carefully read and I agree to the Regnix Terms &amp; Conditions for compliance validation. I understand my obligations and accept full responsibility for the accuracy of all submitted documents.
                </span>
              </label>
            </div>
          )}

          {/* ─ Tab 2: Self Declaration ─ */}
          {activeTab === 'declaration' && (
            <div className={s.tmSection}>
              <p className={s.tmSectionTitle}>
                <span className={s.tmSectionTitleIcon}>✍</span>
                Self Declaration — {ctx.title}
              </p>

              <div className={s.tmDeclBox}>
                "{ctx.declaration}"
              </div>

              <label className={s.tmCheckCard}>
                <input
                  type="checkbox"
                  className={s.tmCheckCardInput}
                  checked={decChecked}
                  onChange={e => setDecChecked(e.target.checked)}
                />
                <span className={s.tmCheckCardLabel}>
                  I, the authorised signatory, hereby make the above self-declaration. I understand that any false, misleading, or inaccurate statement in this declaration is subject to action under applicable Indian law, including but not limited to the IT Act 2000 and relevant labour legislation.
                </span>
              </label>

              {!tcChecked && (
                <div className={s.validationBanner}>
                  <span className={s.validationHint}>
                    ← Please complete the Terms &amp; Conditions tab first before making your declaration.
                  </span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className={s.tmFooter}>
          <div className={s.tmFooterLeft}>
            <div className={s.tmProgress}>
              <div className={s.tmProgressBar}>
                <div className={[
                  s.tmProgressFill,
                  progress === 0   ? s.tmProgressFill0   : '',
                  progress === 50  ? s.tmProgressFill50  : '',
                  progress === 100 ? s.tmProgressFill100 : '',
                ].join(' ')} />
              </div>
              <span>{progress}% complete</span>
            </div>
          </div>

          <div className={s.tmFooterActions}>
            <button className={s.btnSecondary} onClick={onClose}>Cancel</button>
            <button
              className={s.btnPrimary}
              disabled={!canAgree}
              onClick={onAgree}
            >
              I Agree &amp; Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}