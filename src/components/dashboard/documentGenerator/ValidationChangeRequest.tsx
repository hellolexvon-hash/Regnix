/**
 * ValidationChangeRequest.tsx
 *
 * The company's reply page when the auditor sends the submission back (changes requested / rejected).
 *   1. Shows exactly what the auditor asked for, grouped by document (severity, observation, due date).
 *   2. One upload slot per document — each shows Uploading → ✓ Stored / ✗ Failed (retry) so the company knows it went through.
 *   3. "Resubmit for audit" sends the case back to the auditor queue with an optional note.
 *
 * The auditor's findings arrive inside the decision remarks ("1. <document> — <reason> (<Severity>): <observation>") — the
 * format AuditorCompanyReview writes — so no new data is needed; free-text remarks are shown as-is with a general upload slot.
 */
import { useMemo, useRef, useState } from 'react';
import c from './ValidationChangeRequest.module.css';
import { UploadOverlay } from './ValidationUploadUi';
import { uploadValidationDocs, resubmitForAudit } from './validationDocsUpload';

interface Props {
  companyName: string;
  status: 'changes_requested' | 'rejected';
  remarks: string;
  decidedAt?: string | null;
  onBack: () => void;
  /** Called once the case is back with the auditors. */
  onResubmitted: () => void;
}

interface Finding { keyword: string; severity: 'Critical' | 'Major' | 'Minor'; comment: string }
interface Ask { doc: string; findings: Finding[] }

const LINE = /^\s*\d+\.\s+(.+?)\s+[—-]\s+(.+?)\s+\((Critical|Major|Minor)\):\s*([\s\S]*)$/;
const MAX_BYTES = 3 * 1024 * 1024;

export function parseRequest(remarks: string): { asks: Ask[]; notes: string[]; tatDays: number | null } {
  const asks = new Map<string, Ask>();
  const notes: string[] = [];
  let tat: number | null = null;
  for (const raw of remarks.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = LINE.exec(line);
    if (m) {
      const a = asks.get(m[1]) ?? { doc: m[1], findings: [] };
      a.findings.push({ keyword: m[2], severity: m[3] as Finding['severity'], comment: m[4].trim() });
      asks.set(m[1], a);
      continue;
    }
    const t = /within\s+(\d+)\s+working\s+days/i.exec(line);
    if (t) tat = Number(t[1]);
    if (/^L3 review findings:?$/i.test(line)) continue;
    notes.push(line);
  }
  return { asks: [...asks.values()], notes, tatDays: tat };
}

function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from);
  let left = n;
  while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) left--; }
  return d;
}

type Slot = { state: 'idle' | 'uploading' | 'ok' | 'fail'; fileName?: string; msg?: string };
const GENERAL = '__general__';

export default function ValidationChangeRequest({ companyName, status, remarks, decidedAt, onBack, onResubmitted }: Props) {
  const parsed = useMemo(() => parseRequest(remarks), [remarks]);
  const slots0: string[] = parsed.asks.length ? parsed.asks.map((a) => a.doc) : [GENERAL];
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [extraName, setExtraName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const files = useRef<Record<string, File>>({});

  const due = parsed.tatDays && decidedAt ? addWorkingDays(new Date(decidedAt), parsed.tatDays) : null;
  const okDocs = Object.entries(slots).filter(([, s]) => s.state === 'ok').map(([k]) => k);
  const anyUploading = Object.values(slots).some((s) => s.state === 'uploading');
  const required = parsed.asks.length ? parsed.asks.map((a) => a.doc) : [];
  const allDone = required.length ? required.every((d) => slots[d]?.state === 'ok') : okDocs.length > 0;
  const missingNow = required.filter((d) => slots[d]?.state !== 'ok');

  const setSlot = (k: string, s: Slot) => setSlots((m) => ({ ...m, [k]: s }));

  async function upload(slot: string, file: File) {
    const label = slot === GENERAL ? (extraName.trim() || file.name) : slot;
    if (file.size > MAX_BYTES) { setSlot(slot, { state: 'fail', fileName: file.name, msg: 'Larger than 3 MB — compress or split it, then upload again.' }); return; }
    if (file.size === 0) { setSlot(slot, { state: 'fail', fileName: file.name, msg: 'The file is empty.' }); return; }
    files.current[slot] = file;
    setSlot(slot, { state: 'uploading', fileName: file.name });
    const r = await uploadValidationDocs([{ file, name: file.name, docName: label }], companyName).catch(() => null);
    if (r && r.skipped.length === 0) setSlot(slot, { state: 'ok', fileName: file.name });
    else setSlot(slot, { state: 'fail', fileName: file.name, msg: r ? (r.skipped[0]?.reason === 'network' ? 'Network problem — check your connection and retry.' : `Could not store it (${r.skipped[0]?.reason}).`) : 'Upload failed — retry.' });
  }

  async function submit() {
    setBusy(true); setErr('');
    const names = okDocs.map((k) => (k === GENERAL ? (extraName.trim() || files.current[k]?.name || 'Supporting document') : k));
    const r = await resubmitForAudit(note.trim(), names);
    setBusy(false);
    if (!r.ok) { setErr(r.message || 'Could not resubmit.'); return; }
    onResubmitted();
  }

  const sevCls = (s: Finding['severity']) => (s === 'Critical' ? c.sCritical : s === 'Major' ? c.sMajor : c.sMinor);

  return (
    <div className={c.page}>
      <div className={c.inner}>
        <button className={c.back} onClick={onBack}>← Back</button>

        <div className={`${c.banner} ${status === 'rejected' ? c.bannerBad : ''}`}>
          <div className={c.bannerIcon}>{status === 'rejected' ? '⛔' : '↩'}</div>
          <div>
            <h1 className={c.h1}>{status === 'rejected' ? 'Your submission was rejected' : 'The auditor needs changes'}</h1>
            <p className={c.sub}>
              {companyName} · {parsed.asks.length ? `${parsed.asks.length} document${parsed.asks.length !== 1 ? 's' : ''} need attention` : 'See the auditor\'s note below'}
              {due && <> · please reply by <b>{due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</b></>}
              {!due && parsed.tatDays && <> · within <b>{parsed.tatDays} working days</b></>}
            </p>
          </div>
        </div>

        {parsed.notes.length > 0 && (
          <div className={c.note}><p className={c.noteHead}>Auditor's note</p>{parsed.notes.map((n, i) => <p key={i}>{n}</p>)}</div>
        )}

        <div className={c.list}>
          {slots0.map((doc) => {
            const ask = parsed.asks.find((a) => a.doc === doc);
            const s = slots[doc] ?? { state: 'idle' as const };
            return (
              <section key={doc} className={`${c.card} ${s.state === 'ok' ? c.cardOk : ''}`}>
                <div className={c.cardHead}>
                  <h2 className={c.docName}>{doc === GENERAL ? 'Supporting documents' : doc}</h2>
                  <span className={`${c.state} ${s.state === 'ok' ? c.stOk : s.state === 'fail' ? c.stBad : s.state === 'uploading' ? c.stWork : c.stTodo}`}>
                    {s.state === 'ok' ? '✓ Uploaded' : s.state === 'fail' ? '✗ Failed' : s.state === 'uploading' ? 'Uploading…' : 'Waiting for your file'}
                  </span>
                </div>

                {ask && (
                  <ul className={c.finds}>
                    {ask.findings.map((f, i) => (
                      <li key={i}>
                        <span className={`${c.sev} ${sevCls(f.severity)}`}>{f.severity}</span>
                        <div><b>{f.keyword}</b><p>{f.comment}</p></div>
                      </li>
                    ))}
                  </ul>
                )}

                {doc === GENERAL && (
                  <input className={c.input} placeholder="Document name (e.g. PF Challan — March)" value={extraName} onChange={(e) => setExtraName(e.target.value)} maxLength={120} />
                )}

                <label
                  className={`${c.drop} ${s.state === 'uploading' ? c.dropBusy : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && s.state !== 'uploading') void upload(doc, f); }}
                >
                  <input type="file" hidden accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg" disabled={s.state === 'uploading'}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(doc, f); e.target.value = ''; }} />
                  {s.state === 'uploading' ? <><span className={c.spin} /> Uploading {s.fileName}…</>
                    : s.state === 'ok' ? <>✓ {s.fileName} — click to replace</>
                    : <>Drop the corrected file here or <u>browse</u> <small>PDF / Excel / image · max 3 MB</small></>}
                </label>
                {s.state === 'fail' && (
                  <p className={c.fail}>
                    {s.msg}{' '}
                    {files.current[doc] && files.current[doc].size <= MAX_BYTES && <button className={c.retry} onClick={() => void upload(doc, files.current[doc])}>Retry</button>}
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <section className={c.card}>
          <h2 className={c.docName}>Note to the auditor <small>(optional)</small></h2>
          <textarea className={c.textarea} rows={3} maxLength={1000} placeholder="Explain what you changed, or anything the auditor should know." value={note} onChange={(e) => setNote(e.target.value)} />
        </section>

        {err && <p className={c.err}>{err}</p>}

        <div className={c.foot}>
          <span className={c.footMsg}>
            {anyUploading ? 'Waiting for uploads to finish…'
              : allDone ? '✓ Everything the auditor asked for has been uploaded.'
              : required.length ? `Still needed: ${missingNow.join(', ')}` : 'Upload at least one file to resubmit.'}
          </span>
          <button className={c.submit} disabled={!allDone || anyUploading || busy} onClick={() => void submit()}>Resubmit for audit →</button>
        </div>
      </div>

      {busy && <UploadOverlay state="working" title="Sending back to the auditor" detail="Your replacement documents are stored. Resubmitting for audit…" pct={null} />}
    </div>
  );
}
