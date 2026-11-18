/**
 * VerifyCertificate.tsx — public page behind the certificate QR code.
 * Route (App.tsx):  <Route path="/verify/:no" element={<VerifyCertificate />} />
 * No sign-in needed; calls GET /api/certificate/verify?no=…
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import s from './VerifyCertificate.module.css';

interface Result {
  valid: boolean; revoked?: boolean; certificateNo?: string; issuedAt?: string; company?: string;
  score?: number | null; maturity?: string | null; auditor?: string; licenseId?: string; sha256?: string | null;
}

export default function VerifyCertificate() {
  const { no = '' } = useParams<{ no: string }>();
  const [r, setR] = useState<Result | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch(`/api/certificate/verify?no=${encodeURIComponent(no)}`)
      .then(x => x.json()).then(setR).catch(() => setErr(true));
  }, [no]);

  return (
    <div className={s.page}>
      <div className={s.card}>
        <p className={s.brand}>REGNIX · Certificate verification</p>
        {err && <p className={s.bad}>Verification is unavailable right now. Please try again.</p>}
        {!err && !r && <p className={s.muted}>Checking…</p>}
        {r && !r.valid && !r.revoked && (
          <><h1 className={s.bad}>Not found</h1><p className={s.muted}>No certificate <strong>{no}</strong> exists in the Regnix registry. Treat any document carrying this number as invalid.</p></>
        )}
        {r && r.revoked && (
          <><h1 className={s.bad}>Revoked</h1><p className={s.muted}>Certificate <strong>{r.certificateNo}</strong> was issued to {r.company} but has since been revoked.</p></>
        )}
        {r && r.valid && (
          <>
            <h1 className={s.ok}>✓ Valid certificate</h1>
            <dl className={s.list}>
              <dt>Certificate no.</dt><dd>{r.certificateNo}</dd>
              <dt>Company</dt><dd>{r.company}</dd>
              <dt>Issued</dt><dd>{r.issuedAt ? new Date(r.issuedAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—'}</dd>
              {r.score != null && <><dt>Compliance score</dt><dd>{r.score}%{r.maturity ? ` · ${r.maturity}` : ''}</dd></>}
              <dt>Audited by</dt><dd>{r.auditor}{r.licenseId ? ` (Licence ${r.licenseId})` : ''}</dd>
              {r.sha256 && <><dt>PDF fingerprint</dt><dd className={s.hash}>{r.sha256}</dd></>}
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
