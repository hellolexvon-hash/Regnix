/**
 * TermsModal.tsx
 *
 * Two-step agreement modal shown before entering each validation level.
 * 1. T&C scroll box — checkbox disabled until user scrolls to bottom.
 * 2. Self Declaration checkbox.
 * Both required before "I Agree & Continue" enables.
 */

import { useState, useRef, useEffect } from 'react';
import s from './Validation.module.css';

interface TermsModalProps {
  level:   1 | 2 | 3;
  onAgree: () => void;
  onClose: () => void;
}

const LEVEL_CONTEXT: Record<1 | 2 | 3, { title: string; icon: string; declaration: string }> = {
  1: {
    title:       'Level 1 — Document Upload',
    icon:        '📁',
    declaration: 'I declare that all documents being uploaded are authentic, accurate, and have been prepared in accordance with the applicable laws and regulations. I take full responsibility for the accuracy of the information submitted.',
  },
  2: {
    title:       'Level 2 — Live Register Comparison',
    icon:        '🔍',
    declaration: 'I declare that I have personally reviewed all uploaded documents against the Live Register and that the data is consistent, accurate, and compliant with all applicable statutory requirements.',
  },
  3: {
    title:       'Level 3 — Auditor Submission',
    icon:        '🏛️',
    declaration: 'I declare that all documents submitted for auditor review are final, complete, and accurately represent the compliance status of the organisation. I understand that any misrepresentation is subject to legal consequences.',
  },
};

export default function TermsModal({ level, onAgree, onClose }: TermsModalProps) {
  const [tcScrolled, setTcScrolled] = useState(false);
  const [tcChecked,  setTcChecked]  = useState(false);
  const [decChecked, setDecChecked] = useState(false);
  const tcRef = useRef<HTMLDivElement>(null);
  const ctx   = LEVEL_CONTEXT[level];

  function handleTcScroll() {
    const el = tcRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setTcScrolled(true);
  }

  // Auto-mark scrolled if the content fits without scrolling
  useEffect(() => {
    const el = tcRef.current;
    if (el && el.scrollHeight <= el.clientHeight) setTcScrolled(true);
  }, []);

  const canAgree = tcChecked && decChecked;

  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>

        {/* Header */}
        <div className={s.modalHeader}>
          <div className={s.modalIcon}>{ctx.icon}</div>
          <div>
            <p className={s.modalTitle}>Terms &amp; Self Declaration</p>
            <p className={s.modalSub}>{ctx.title} — Please read and agree before proceeding</p>
          </div>
        </div>

        <div className={s.modalBody}>

          {/* T&C */}
          <div className={s.sectionDivider}>Terms &amp; Conditions</div>
          <div className={s.tcBox} ref={tcRef} onScroll={handleTcScroll}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, color: '#0F0A1E' }}>
              Regnix Compliance Validation — Terms of Use
            </h4>
            <p style={{ margin: '0 0 8px', fontSize: 11.5, color: '#4A4468', lineHeight: 1.6 }}>
              By proceeding with the compliance validation workflow, you agree to the following terms:
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: '#4A4468', lineHeight: 1.7 }}>
              <li><strong>Accuracy of Records:</strong> All documents uploaded must be original, accurate, and created in compliance with Indian labour laws including the Factories Act 1948, Contract Labour (R&A) Act 1970, Code on Wages 2019, and applicable state S&E Acts.</li>
              <li><strong>Digital Signature:</strong> The digital signature applied during Level 1 constitutes legal acceptance of the authenticity of all submitted documents. Misuse of digital signatures is a criminal offence under the IT Act 2000.</li>
              <li><strong>Data Confidentiality:</strong> All data submitted is stored securely and will not be shared with third parties except the assigned auditor and regulatory authorities as required by law.</li>
              <li><strong>Auditor Independence:</strong> The Level 3 auditor review is conducted by an independent third-party auditor. Regnix does not influence audit outcomes.</li>
              <li><strong>Legal Compliance:</strong> It is the sole responsibility of the company and its authorised representative to ensure all registers comply with applicable statutory requirements.</li>
              <li><strong>Retention:</strong> All uploaded documents and audit reports will be retained for a minimum of 5 years as required under applicable labour laws.</li>
              <li><strong>Liability:</strong> Regnix shall not be held liable for any penalties or legal actions arising from inaccurate documents submitted through this platform.</li>
              <li><strong>Amendments:</strong> These terms may be updated without prior notice. Continued use constitutes acceptance of revised terms.</li>
            </ul>
            {!tcScrolled && (
              <p style={{ color: '#D97706', fontSize: 11, fontWeight: 600, textAlign: 'center', marginTop: 10 }}>
                ↓ Scroll to read all terms before agreeing
              </p>
            )}
          </div>

          <label className={s.checkRow}>
            <input
              type="checkbox"
              checked={tcChecked}
              disabled={!tcScrolled}
              onChange={e => setTcChecked(e.target.checked)}
            />
            <span className={s.checkLabel}>
              I have read and agree to the Regnix Terms &amp; Conditions for compliance validation.
            </span>
          </label>

          {/* Self Declaration */}
          <div className={s.sectionDivider} style={{ marginTop: 12 }}>Self Declaration</div>
          <div className={s.tcBox} style={{ maxHeight: 90, background: '#FFFBEB', borderColor: '#FDE68A' }}>
            <p style={{ margin: 0, fontSize: 11.5, color: '#78350F', lineHeight: 1.7 }}>
              {ctx.declaration}
            </p>
          </div>

          <label className={s.checkRow}>
            <input
              type="checkbox"
              checked={decChecked}
              onChange={e => setDecChecked(e.target.checked)}
            />
            <span className={s.checkLabel}>
              I hereby make this self-declaration and understand that any false statement is subject to action under applicable law.
            </span>
          </label>
        </div>

        <div className={s.modalFooter}>
          <button className={s.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={s.btnPrimary} disabled={!canAgree} onClick={onAgree}>
            I Agree &amp; Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
