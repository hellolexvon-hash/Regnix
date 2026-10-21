/**
 * src/pages/kyc/KycUploadPage.tsx   (route: /kyc-upload/:token)
 *
 * Opened from the KYC email. The token in the URL is the only credential, so the
 * page works with or without a login session. Three parts on one screen:
 *   1. upload every required document   (stored in Zoho WorkDrive by the backend)
 *   2. pay — the QR is hidden until the user clicks "Show payment QR"
 *   3. submit payment details (method, UTR / reference, date) for admin review
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlan, formatINR, headcountLabel } from '@/lib/plans';
import styles from './KycUploadPage.module.css';

const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
/** Replace with your real UPI id / QR image. */
const UPI_ID = 'regnix@upi';
const REAL_QR_IMAGE: string | null = null; // e.g. '/payment-qr.png' once you have the real one
const MAX_BYTES = 3 * 1024 * 1024;

interface Info {
  company: string; name: string; plan: string | null; documents: string[];
  amount: number; currency: string; dueDate: string | null; note: string;
  submitted: boolean; uploaded: { doc_label: string; file_name: string }[];
}

type DocState = { status: 'idle' | 'uploading' | 'done' | 'error'; fileName?: string; error?: string };

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
}

/** Decorative demo QR (deterministic pattern with the three finder squares). Not scannable. */
function DemoQr({ seed }: { seed: string }) {
  const N = 29;
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
    const out: boolean[][] = [];
    for (let y = 0; y < N; y++) {
      out.push([]);
      for (let x = 0; x < N; x++) out[y].push(rnd() > 0.52);
    }
    const finder = (ox: number, oy: number) => {
      for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
        const gx = ox + x, gy = oy + y;
        if (gx < 0 || gy < 0 || gx >= N || gy >= N) continue;
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        out[gy][gx] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (edge || core);
      }
    };
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    return out;
  }, [seed]);
  return (
    <svg viewBox={`0 0 ${N} ${N}`} className={styles.qrSvg} shapeRendering="crispEdges" role="img" aria-label="Demo payment QR code">
      <rect width={N} height={N} fill="#fff" />
      {cells.map((row, y) => row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#1B1830" /> : null))}
    </svg>
  );
}

export default function KycUploadPage() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [docs, setDocs] = useState<Record<string, DocState>>({});
  const [qrOpen, setQrOpen] = useState(false);
  const [method, setMethod] = useState('UPI');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/kyc/info?token=${encodeURIComponent(token)}`);
        const j = await res.json();
        if (!res.ok || !j.ok) { setLoadErr(j.error ?? 'This link is invalid or has expired.'); return; }
        setInfo(j as Info);
        const seeded: Record<string, DocState> = {};
        for (const u of (j as Info).uploaded) seeded[u.doc_label] = { status: 'done', fileName: u.file_name };
        setDocs(seeded);
        if ((j as Info).submitted) setDone(true);
      } catch {
        setLoadErr('Could not reach the server. Please try again.');
      }
    })();
  }, [token]);

  const upload = useCallback(async (label: string, file: File) => {
    if (file.size > MAX_BYTES) { setDocs((d) => ({ ...d, [label]: { status: 'error', error: 'File is larger than 3 MB.' } })); return; }
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) { setDocs((d) => ({ ...d, [label]: { status: 'error', error: 'Use a PDF, JPG or PNG file.' } })); return; }
    setDocs((d) => ({ ...d, [label]: { status: 'uploading', fileName: file.name } }));
    try {
      const dataBase64 = await toBase64(file);
      const res = await fetch(`${API_BASE}/api/kyc/file`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, label, fileName: file.name, mimeType: file.type, dataBase64 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error ?? 'Upload failed.');
      setDocs((d) => ({ ...d, [label]: { status: 'done', fileName: j.fileName ?? file.name } }));
    } catch (e) {
      setDocs((d) => ({ ...d, [label]: { status: 'error', error: e instanceof Error ? e.message : 'Upload failed.' } }));
    }
  }, [token]);

  const plan = getPlan(info?.plan);
  const allUploaded = !!info && info.documents.every((d) => docs[d]?.status === 'done');
  const needsPayment = (info?.amount ?? 0) > 0;
  const doneCount = info ? info.documents.filter((d) => docs[d]?.status === 'done').length : 0;

  async function submit() {
    setError('');
    if (!allUploaded) { setError('Please upload all required documents first.'); return; }
    if (needsPayment && !reference.trim()) { setError('Enter the payment reference / UTR number.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/kyc/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, paymentMethod: method, paymentReference: reference.trim(), paidOn, note: note.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error ?? 'Could not submit.');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit.');
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link to="/" className={styles.logo}><img src="/regnix-markw.png" alt="" /><span>Regnix</span></Link>
        <span className={styles.secure}>🔒 Secure KYC upload</span>
      </header>
      {children}
    </div>
  );

  if (loadErr) return shell(<main className={styles.narrow}><div className={styles.card}><h1 className={styles.h1}>Link unavailable</h1><p className={styles.muted}>{loadErr}</p><Link to="/login" className={styles.linkBtn}>Go to sign in</Link></div></main>);
  if (!info) return shell(<main className={styles.narrow}><p className={styles.muted}>Loading…</p></main>);

  if (done) {
    return shell(
      <main className={styles.narrow}>
        <div className={styles.card} style={{ textAlign: 'center' }}>
          <div className={styles.bigTick}>✓</div>
          <h1 className={styles.h1}>Submitted for verification</h1>
          <p className={styles.muted}>
            Thanks{info.name ? `, ${info.name.split(' ')[0]}` : ''}. Our team will verify your documents and payment and email you as soon as your workspace is ready. You can close this page.
          </p>
          <Link to="/login" className={styles.linkBtn}>Go to sign in</Link>
        </div>
      </main>,
    );
  }

  return shell(
    <main className={styles.main}>
      <div className={styles.head}>
        <h1 className={styles.h1}>Complete your KYC{info.company ? ` — ${info.company}` : ''}</h1>
        <p className={styles.muted}>Upload the documents below and complete the payment. {info.dueDate ? <>Due by <strong>{info.dueDate}</strong>.</> : null}</p>
        {info.note && <div className={styles.note}><strong>Note from our team:</strong> {info.note}</div>}
      </div>

      <div className={styles.layout}>
        <section className={styles.col}>
          {/* 1 — documents */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.h2}><span className={styles.num}>1</span> Documents</h2>
              <span className={styles.counter}>{doneCount}/{info.documents.length} uploaded</span>
            </div>
            <div className={styles.bar}><span style={{ width: `${info.documents.length ? (doneCount / info.documents.length) * 100 : 0}%` }} /></div>

            {info.documents.length === 0 && <p className={styles.muted}>No documents required for this request.</p>}
            <ul className={styles.docList}>
              {info.documents.map((label) => {
                const st = docs[label] ?? { status: 'idle' as const };
                return (
                  <li key={label} className={styles.doc} data-state={st.status}>
                    <div className={styles.docMain}>
                      <span className={styles.docIcon}>{st.status === 'done' ? '✓' : st.status === 'error' ? '!' : '📄'}</span>
                      <div>
                        <div className={styles.docLabel}>{label}</div>
                        <div className={styles.docMeta}>
                          {st.status === 'idle' && 'PDF, JPG or PNG · max 3 MB'}
                          {st.status === 'uploading' && `Uploading ${st.fileName}…`}
                          {st.status === 'done' && st.fileName}
                          {st.status === 'error' && <span className={styles.err}>{st.error}</span>}
                        </div>
                      </div>
                    </div>
                    <input
                      ref={(el) => { fileInputs.current[label] = el; }}
                      type="file" hidden accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(label, f); e.target.value = ''; }}
                    />
                    <button className={styles.ghost} disabled={st.status === 'uploading'} onClick={() => fileInputs.current[label]?.click()}>
                      {st.status === 'done' ? 'Replace' : st.status === 'uploading' ? '…' : 'Choose file'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 2 — payment */}
          {needsPayment && (
            <div className={styles.card}>
              <h2 className={styles.h2}><span className={styles.num}>2</span> Payment</h2>
              <p className={styles.muted}>Pay <strong>{formatINR(info.amount)}</strong> and enter the reference below so we can match it.</p>

              {!qrOpen ? (
                <button className={styles.qrCover} onClick={() => setQrOpen(true)}>
                  <span className={styles.qrBlur} aria-hidden />
                  <span className={styles.qrCoverText}><strong>Show payment QR</strong><small>Click to reveal</small></span>
                </button>
              ) : (
                <div className={styles.qrBox}>
                  {REAL_QR_IMAGE ? <img src={REAL_QR_IMAGE} alt="Payment QR" className={styles.qrSvg} /> : <DemoQr seed={token} />}
                  <div className={styles.qrInfo}>
                    <div className={styles.qrAmount}>{formatINR(info.amount)}</div>
                    <div className={styles.muted}>Scan with any UPI app</div>
                    <div className={styles.upi}>{UPI_ID}</div>
                    {!REAL_QR_IMAGE && <div className={styles.demoTag}>Demo QR — not scannable</div>}
                    <button className={styles.ghost} onClick={() => setQrOpen(false)}>Hide QR</button>
                  </div>
                </div>
              )}

              <div className={styles.grid2}>
                <label className={styles.field}><span>Payment method</span>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option>UPI</option><option>NEFT / IMPS</option><option>Bank transfer</option><option>Card</option>
                  </select>
                </label>
                <label className={styles.field}><span>Paid on</span>
                  <input type="date" value={paidOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidOn(e.target.value)} />
                </label>
              </div>
              <label className={styles.field}><span>Transaction reference / UTR</span>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 412345678901" />
              </label>
              <label className={styles.field}><span>Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know" />
              </label>
            </div>
          )}

          {error && <p className={styles.errorBox} role="alert">{error}</p>}
          <button className={styles.submit} disabled={busy} onClick={() => { void submit(); }}>
            {busy ? 'Submitting…' : 'Submit for verification'}
          </button>
        </section>

        <aside className={styles.side}>
          <div className={styles.card}>
            <h3 className={styles.h3}>Order summary</h3>
            {plan && (
              <>
                <div className={styles.sumRow}><span>Plan</span><strong>{plan.name}</strong></div>
                <div className={styles.sumRow}><span>Team size</span><strong>{headcountLabel(plan)}</strong></div>
                <div className={styles.sumRow}><span>Monthly price</span><strong>{formatINR(plan.monthlyPrice)}</strong></div>
              </>
            )}
            <div className={`${styles.sumRow} ${styles.sumTotal}`}><span>Due now</span><strong>{needsPayment ? formatINR(info.amount) : 'Nothing'}</strong></div>
          </div>
          <div className={styles.card}>
            <h3 className={styles.h3}>Checklist</h3>
            <ul className={styles.check}>
              <li data-ok={allUploaded}>All documents uploaded</li>
              {needsPayment && <li data-ok={!!reference.trim()}>Payment reference entered</li>}
            </ul>
          </div>
        </aside>
      </div>
    </main>,
  );
}
