/**
 * AuditorTermsModal.tsx
 *
 * Pop-up shown when an auditor asks for access to a company. Terms must be read to the end and both
 * boxes ticked before "Accept & request access" unlocks. Acceptance is recorded server-side
 * (review_cycles.terms_accepted_at / terms_version) and gates access to the documents.
 *
 * Self-contained: styled by AuditorTerms.module.css (no need to append CSS to Auditor.module.css) and rendered
 * through a portal on <body>, so it always floats above the page as a centred dialog.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import t from './AuditorTerms.module.css';

interface Props {
  companyName: string;
  busy?: boolean;
  error?: string;
  onAccept: () => void;
  onClose: () => void;
}

const TERMS: [string, string][] = [
  ['Independence', 'I have no financial, family or employment relationship with this company, its directors or its group entities, and I have not advised it on the matters under audit in the last 24 months.'],
  ['Confidentiality', 'Documents shown to me (registers, challans, licences, payroll data) contain personal and statutory information. I will use them only for this audit, will not copy, download or share them outside Regnix, and will keep them confidential after the audit ends.'],
  ['Data protection', 'I will handle employee personal data in line with the Digital Personal Data Protection Act, 2023 and will not retain any of it once the review is closed.'],
  ['Professional standard', 'I will examine every submitted document against the Regnix audit checklist and the live register, and record issues truthfully. I will not approve a submission that I know contains material non-compliance.'],
  ['Accuracy of the certificate', 'A compliance certificate issued on my decision carries my name and licence number and can be verified publicly. I accept responsibility for the decision recorded against this certificate.'],
  ['Exclusivity', 'By claiming this company I take sole ownership of the review. Other auditors will not be able to open its documents until I submit a decision.'],
  ['Audit trail', 'My claim, document views and decision are logged with my identity and time, and may be produced to the company, to Regnix and to regulators.'],
];

export default function AuditorTermsModal({ companyName, busy, error, onAccept, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [read, setRead] = useState(false);
  const [pct, setPct] = useState(0);
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) { setRead(true); setPct(100); }
  }, []);

  // Lock page scroll behind the pop-up and let Esc close it (unless a request is in flight).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', esc); };
  }, [busy, onClose]);

  function onScroll() {
    const el = box.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setPct(max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100)));
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setRead(true);
  }

  const ready = read && a && b && !busy;

  const modal = (
    <div className={t.overlay} role="dialog" aria-modal="true" aria-labelledby="at-title" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={t.modal}>
        <div className={t.head}>
          <span className={t.badge} aria-hidden="true">⚖</span>
          <div>
            <h2 id="at-title" className={t.title}>Auditor terms &amp; conditions</h2>
            <p className={t.sub}>You are about to request access to the audit of <strong>{companyName}</strong>. Please read and accept to continue.</p>
          </div>
          <button className={t.x} onClick={onClose} disabled={busy} aria-label="Close">×</button>
        </div>

        <div className={t.progress} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>

        <div className={t.body} ref={box} onScroll={onScroll} tabIndex={0}>
          {TERMS.map(([h, txt], i) => (
            <div key={h} className={t.clause}>
              <p className={t.clauseHead}><span>{i + 1}</span>{h}</p>
              <p className={t.clauseText}>{txt}</p>
            </div>
          ))}
        </div>
        <p className={read ? t.hintOk : t.hint}>{read ? '✓ You have read the full terms.' : 'Scroll to the end of the terms to continue.'}</p>

        <label className={t.check}>
          <input type="checkbox" disabled={!read} checked={a} onChange={(e) => setA(e.target.checked)} />
          <span>I have read and accept these terms.</span>
        </label>
        <label className={t.check}>
          <input type="checkbox" disabled={!read} checked={b} onChange={(e) => setB(e.target.checked)} />
          <span>I confirm I am independent of this company and fit to audit it.</span>
        </label>

        {error && <p className={t.error}>{error}</p>}

        <div className={t.actions}>
          <button className={t.cancel} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={t.accept} onClick={onAccept} disabled={!ready}>
            {busy ? 'Requesting…' : 'Accept & request access'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
