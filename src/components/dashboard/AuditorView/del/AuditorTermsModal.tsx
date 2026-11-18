/**
 * AuditorTermsModal.tsx
 *
 * Shown when an auditor self-assigns a company. The terms must be read to the end and
 * both boxes ticked before "Accept & claim" unlocks. Acceptance is recorded server-side
 * (review_cycles.terms_accepted_at / terms_version) and gates access to the documents.
 */
import { useEffect, useRef, useState } from 'react';
import s from './Auditor.module.css';

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
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setRead(true);
  }, []);

  function onScroll() {
    const el = box.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setRead(true);
  }

  const ready = read && a && b && !busy;

  return (
    <div className={s.atOverlay} role="dialog" aria-modal="true">
      <div className={s.atModal}>
        <div className={s.atHead}>
          <h2 className={s.atTitle}>Auditor terms &amp; conditions</h2>
          <p className={s.atSub}>You are about to take ownership of the audit for <strong>{companyName}</strong>.</p>
        </div>

        <div className={s.atBody} ref={box} onScroll={onScroll}>
          {TERMS.map(([h, t], i) => (
            <div key={h} className={s.atClause}>
              <p className={s.atClauseHead}>{i + 1}. {h}</p>
              <p className={s.atClauseText}>{t}</p>
            </div>
          ))}
        </div>
        {!read && <p className={s.atHint}>Scroll to the end to continue.</p>}

        <label className={s.atCheck}>
          <input type="checkbox" disabled={!read} checked={a} onChange={e => setA(e.target.checked)} />
          <span>I have read and accept these terms.</span>
        </label>
        <label className={s.atCheck}>
          <input type="checkbox" disabled={!read} checked={b} onChange={e => setB(e.target.checked)} />
          <span>I confirm I am independent of this company and fit to audit it.</span>
        </label>

        {error && <p className={s.atError}>{error}</p>}

        <div className={s.atActions}>
          <button className={s.arCancelBtn} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={s.arClaimBtn} onClick={onAccept} disabled={!ready}>
            {busy ? 'Requesting…' : 'Accept & request access'}
          </button>
        </div>
      </div>
    </div>
  );
}
