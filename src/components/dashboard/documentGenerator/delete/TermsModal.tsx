/**
 * TermsModal.tsx
 *
 * Two-step agreement modal shown before entering each validation level:
 *  1. Terms & Conditions scroll box (must scroll to bottom before enabling)
 *  2. Self Declaration checkbox
 *
 * Both must be checked before "I Agree & Continue" is enabled.
 */

import { useState, useRef, useEffect } from 'react';
import s from './Validation.module.css';

interface TermsModalProps {
  level: 1 | 2 | 3;
  onAgree: () => void;
  onClose: () => void;
}

const LEVEL_CONTEXT: Record<1 | 2 | 3, { title: string; icon: string; declaration: string }> = {
  1: {
    title: 'Level 1 — Document Upload',
    icon: '📁',
    declaration:
      'I declare that all documents being uploaded are authentic, accurate, and have been prepared in accordance with the applicable laws and regulations. I take full responsibility for the accuracy of the information submitted.',
  },
  2: {
    title: 'Level 2 — Live Register Comparison',
    icon: '🔍',
    declaration:
      'I declare that I have personally reviewed all uploaded documents against the Live Register and that the data is consistent, accurate, and compliant with all applicable statutory requirements.',
  },
  3: {
    title: 'Level 3 — Auditor Submission',
    icon: '🏛️',
    declaration:
      'I declare that all documents submitted for auditor review are final, complete, and accurately represent the compliance status of the organisation. I understand that any misrepresentation is subject to legal consequences.',
  },
};

export default function TermsModal({ level, onAgree, onClose }: TermsModalProps) {
  const [tcScrolled, setTcScrolled] = useState(false);
  const [tcChecked, setTcChecked]   = useState(false);
  const [decChecked, setDecChecked] = useState(false);
  const tcRef = useRef<HTMLDivElement>(null);
  const ctx = LEVEL_CONTEXT[level];

  // Mark as scrolled once user reaches bottom of T&C box
  function handleTcScroll() {
    const el = tcRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setTcScrolled(true);
  }

  // Auto-mark scrolled if content fits without scrolling
  useEffect(() => {
    const el = tcRef.current;
    if (el && el.scrollHeight <= el.clientHeight) setTcScrolled(true);
  }, []);

  const canAgree = tcChecked && decChecked;

  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>
        <div className={s.modalHeader}>
          <div className={s.modalIcon}>{ctx.icon}</div>
          <div>
            <p className={s.modalTitle}>Terms & Self Declaration</p>
            <p className={s.modalSub}>{ctx.title} — Please read and agree before proceeding</p>
          </div>
        </div>

        <div className={s.modalBody}>
          {/* T&C Section */}
          <div className={s.sectionDivider}>Terms & Conditions</div>
          <div
            className={s.tcBox}
            ref={tcRef}
            onScroll={handleTcScroll}
          >
            <h4>Regnix Compliance Validation — Terms of Use</h4>
            <p>By proceeding with the compliance validation workflow, you agree to the following terms and conditions set forth by Regnix:</p>
            <ul>
              <li><strong>Accuracy of Records:</strong> All documents uploaded must be original, accurate, and created in compliance with Indian labour laws including but not limited to the Factories Act 1948, Contract Labour (R&A) Act 1970, Code on Wages 2019, and applicable state S&E Acts.</li>
              <li><strong>Digital Signature:</strong> The digital signature applied during Level 1 constitutes your legal acceptance of the authenticity of all submitted documents. Misuse of digital signatures is a criminal offence under the Information Technology Act 2000.</li>
              <li><strong>Data Confidentiality:</strong> All data submitted through this platform is stored securely and will not be shared with third parties except the assigned auditor and regulatory authorities as required by law.</li>
              <li><strong>Auditor Independence:</strong> The Level 3 auditor review is conducted by an independent third-party auditor. Regnix does not influence audit outcomes.</li>
              <li><strong>Legal Compliance:</strong> It is the sole responsibility of the company and its authorised representative to ensure all registers and documents comply with applicable statutory requirements.</li>
              <li><strong>Retention:</strong> All uploaded documents and audit reports will be retained for a minimum period of 5 years as required under applicable labour laws.</li>
              <li><strong>Liability:</strong> Regnix shall not be held liable for any penalties, fines, or legal actions arising from inaccurate or incomplete compliance documents submitted through this platform.</li>
              <li><strong>Amendments:</strong> These terms may be updated without prior notice. Continued use constitutes acceptance of revised terms.</li>
            </ul>
            <p>If you do not agree to these terms, please close this dialog and do not proceed with the validation.</p>
            {!tcScrolled && (
              <p style={{ color: '#D97706', fontSize: 11, fontWeight: 600, textAlign: 'center', marginTop: 8 }}>
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
              I have read and agree to the Regnix Terms & Conditions for compliance validation.
            </span>
          </label>

          {/* Self Declaration */}
          <div className={s.sectionDivider}>Self Declaration</div>
          <div className={s.tcBox} style={{ maxHeight: 100, fontSize: 12, background: '#FFFBEB', borderColor: '#FDE68A' }}>
            <p style={{ margin: 0, color: '#78350F', lineHeight: 1.7 }}>{ctx.declaration}</p>
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
          <button
            className={s.btnPrimary}
            disabled={!canAgree}
            onClick={onAgree}
            style={{ marginLeft: 'auto' }}
          >
            I Agree &amp; Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
