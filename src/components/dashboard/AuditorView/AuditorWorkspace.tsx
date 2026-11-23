/**
 * AuditorWorkspace.tsx  (v3 — dark three-pane "Compliance Engine" layout)
 *
 *   header   : TOTAL FILES / PASSED / PENDING / REJECTED counters + Back, Prev / Next
 *   left     : Files list with a status icon per document (passed / pending / rejected)
 *   centre   : the filed document + "where to look first" (Level 2 issues, tally mismatches)
 *   right    : Automated Rule Checks — rejection reason dropdown (per-document list from
 *              Regnix_L3_Validation_Matrix.xlsx), auditing comments, REJECT / PASS buttons
 *   bottom   : audit trail strip — TIME / USER / ACTION / IMMUTABLE HASH (SHA-256, chained)
 *
 * Frontend only. Findings stay in the browser and are folded into the existing `remarks` text
 * by AuditorCompanyReview when the auditor decides — no endpoint or table changes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import s from './AuditorWorkspace.module.css';
import type { CompanyReview, ReviewDoc } from './auditorStore';
import { flagsForDoc, SEVERITY_LABEL, TAT_BY_SEVERITY, type FlagOption, type FlagSeverity } from './l3Flags';
import { IconAlertTriangle, IconCheckCircle, IconSpinner } from './icons';

export type Verdict = 'pass' | 'flag';
export interface Finding { id: string; keyword: string; severity: FlagSeverity; comment: string; tatDays: number; at: string }
export interface DocReview { verdict?: Verdict; findings: Finding[] }
export type ReviewMap = Record<string, DocReview>;

interface TrailEntry { t: string; user: string; action: string; hash: string }

interface Props {
  doc: ReviewDoc;
  company: CompanyReview;
  blob: Blob | null;
  kind: 'pdf' | 'sheet' | 'none';
  review: DocReview;
  reviews?: ReviewMap;
  auditorName?: string;
  readOnly: boolean;
  suspended: boolean;
  loadingNext: boolean;
  onVerdict: (v: Verdict) => void;
  onAddFlag: (f: Omit<Finding, 'id' | 'at'>) => void;
  onRemoveFlag: (id: string) => void;
  onOpenDoc: (d: ReviewDoc) => void;
  onFullscreen: () => void;
  onOpenSheet: () => void;
  onClose: () => void;
}

const SEV_CLS: Record<FlagSeverity, { badge: string; flag: string }> = {
  critical: { badge: s.bCritical, flag: s.fCritical },
  major: { badge: s.bMajor, flag: s.fMajor },
  minor: { badge: s.bMinor, flag: s.fMinor },
};

type DocState = 'pass' | 'reject' | 'pending';
const stateOf = (r?: DocReview): DocState => (r && r.findings.length > 0 ? 'reject' : r?.verdict === 'pass' ? 'pass' : 'pending');

async function sha256(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // crypto.subtle needs https; fall back to a simple (non-cryptographic) fingerprint so the strip still works.
    let h = 5381; for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, '0').repeat(8);
  }
}

export default function AuditorWorkspace(p: Props) {
  const { doc, company, review } = p;
  const reviews = p.reviews ?? {};
  const [url, setUrl] = useState<string | null>(null);
  const [picked, setPicked] = useState<FlagOption | null>(null);
  const [comment, setComment] = useState('');
  const [menu, setMenu] = useState(false);

  const set = useMemo(() => flagsForDoc(doc.name), [doc.name]);
  const docIssues = company.issues.filter((i) => i.docName === doc.name);
  const mismatches = (doc.tallyRows ?? []).filter((r) => !r.match);
  const idx = company.docs.findIndex((d) => d.id === doc.id);
  const prev = idx > 0 ? company.docs[idx - 1] : null;
  const next = idx >= 0 && idx < company.docs.length - 1 ? company.docs[idx + 1] : null;
  const user = p.auditorName || 'Auditor';

  const counts = useMemo(() => {
    let pass = 0, reject = 0;
    company.docs.forEach((d) => { const st = stateOf(reviews[d.id]); if (st === 'pass') pass++; else if (st === 'reject') reject++; });
    return { total: company.docs.length, pass, reject, pending: company.docs.length - pass - reject };
  }, [company.docs, reviews]);

  // ── Audit trail (hash-chained, kept in the browser next to the findings) ──────────────────────
  const TRAIL_KEY = `regnix.l3.trail.${company.id}`;
  const [trail, setTrail] = useState<TrailEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(TRAIL_KEY) || '[]') as TrailEntry[]; } catch { return []; }
  });
  const trailRef = useRef(trail);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const log = (action: string) => {
    chain.current = chain.current.then(async () => {
      const t = new Date().toISOString();
      const prevHash = trailRef.current[0]?.hash ?? 'GENESIS';
      const hash = await sha256(`${prevHash}|${t}|${user}|${action}`);
      const nextTrail = [{ t, user, action, hash }, ...trailRef.current].slice(0, 200);
      trailRef.current = nextTrail;
      setTrail(nextTrail);
      try { localStorage.setItem(TRAIL_KEY, JSON.stringify(nextTrail)); } catch { /* ignore */ }
    });
  };

  useEffect(() => {
    if (p.kind !== 'pdf' || !p.blob) { setUrl(null); return; }
    const u = URL.createObjectURL(p.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [p.blob, p.kind]);

  // New document → clear the form and note that it was opened.
  useEffect(() => { setPicked(null); setComment(''); setMenu(false); if (!p.readOnly) log(`Opened ${doc.name}`); /* eslint-disable-next-line */ }, [doc.id]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !p.suspended) { if (menu) setMenu(false); else p.onClose(); } };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  });

  const choose = (o: FlagOption) => { setPicked(o); setComment(o.text); setMenu(false); };
  const hasFlags = review.findings.length > 0;
  const canReject = !!picked && comment.trim().length > 0 && !p.readOnly;
  const canPass = !p.readOnly && !picked && !hasFlags;

  const reject = () => {
    if (!picked || !canReject) return;
    p.onAddFlag({ keyword: picked.keyword, severity: picked.severity, comment: comment.trim(), tatDays: picked.tatDays });
    log(`REJECT ${doc.name} — ${picked.keyword} (${SEVERITY_LABEL[picked.severity]})`);
    setPicked(null); setComment('');
  };
  const pass = () => {
    if (!canPass) return;
    p.onVerdict('pass');
    log(`PASS ${doc.name}`);
  };
  const removeFlag = (f: Finding) => { p.onRemoveFlag(f.id); log(`Removed flag "${f.keyword}" on ${doc.name}`); };

  const fmtTime = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleTimeString('en-GB', { hour12: false }); };
  const stateIcon = (st: DocState) => st === 'pass'
    ? <span className={`${s.st} ${s.stOk}`} title="Passed">✓</span>
    : st === 'reject'
      ? <span className={`${s.st} ${s.stBad}`} title="Rejected">⚑</span>
      : <span className={`${s.st} ${s.stTodo}`} title="Pending" />;

  return (
    <div className={`${s.ws} ${p.suspended ? s.wsHidden : ''}`} role="dialog" aria-modal="true" aria-label={`Review ${doc.name}`}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className={s.top}>
        <button className={s.topBack} onClick={p.onClose}>← Back</button>
        <div className={s.topTitle}>
          <span className={s.topName}>Regnix Compliance Engine</span>
          <span className={s.topSub}>{company.name} · {doc.name} · L2 score {doc.score}</span>
        </div>
        <div className={s.counters}>
          <div className={s.tile}><span>TOTAL FILES</span><b>{counts.total}</b></div>
          <div className={s.tile}><span>PASSED</span><b className={s.cOk}>{counts.pass}</b></div>
          <div className={s.tile}><span>PENDING</span><b className={s.cWarn}>{counts.pending}</b></div>
          <div className={s.tile}><span>REJECTED</span><b className={s.cBad}>{counts.reject}</b></div>
        </div>
      </div>

      <div className={s.body}>
        {/* ── Files ──────────────────────────────────────────────────── */}
        <aside className={s.files}>
          <p className={s.paneHead}>Files</p>
          <div className={s.fileList}>
            {company.docs.map((d) => (
              <button key={d.id} className={`${s.file} ${d.id === doc.id ? s.fileOn : ''}`} disabled={p.loadingNext} onClick={() => d.id !== doc.id && p.onOpenDoc(d)}>
                {stateIcon(stateOf(reviews[d.id]))}
                <span className={s.fileName}>{d.name}</span>
              </button>
            ))}
          </div>
          <div className={s.fileNav}>
            <button className={s.navBtn} disabled={!prev || p.loadingNext} onClick={() => prev && p.onOpenDoc(prev)}>‹ Prev</button>
            <span className={s.navCount}>{p.loadingNext ? <IconSpinner size={13} /> : `${idx + 1} / ${company.docs.length}`}</span>
            <button className={s.navBtn} disabled={!next || p.loadingNext} onClick={() => next && p.onOpenDoc(next)}>Next ›</button>
          </div>
        </aside>

        {/* ── Document ───────────────────────────────────────────────── */}
        <section className={s.viewer}>
          <div className={s.viewerBar}>
            <strong>{doc.fileName || doc.name}</strong>
            <span className={s.viewerSpacer} />
            {p.kind === 'pdf' && <button className={s.linkBtn} onClick={p.onFullscreen}>Zoom &amp; annotate</button>}
          </div>
          {docIssues.length + mismatches.length > 0 && (
            <div className={s.lookStrip}>
              <span className={s.lookTitle}>Where to look first</span>
              {docIssues.map((i) => (
                <span key={i.id} className={s.lookItem}><IconAlertTriangle size={12} /> <b>{i.rule}</b> — {i.rootCause} {i.resolvedL2 ? '(resolved in L2)' : '(still open)'}</span>
              ))}
              {mismatches.map((m, i) => (
                <span key={i} className={s.lookItem}><IconAlertTriangle size={12} /> <b>{m.label}</b>: filed “{m.docValue}” vs register “{m.regValue}”</span>
              ))}
            </div>
          )}
          {p.kind === 'pdf' && url ? (
            <iframe className={s.frame} src={url} title={doc.name} />
          ) : p.kind === 'none' ? (
            <div className={s.sheetBox}>
              <p>No file is stored for this document, so there is nothing to open. If the company never uploaded it, reject it with <b>Document missing</b>.</p>
            </div>
          ) : (
            <div className={s.sheetBox}>
              <p>This document is a spreadsheet. Open it in the register viewer to scroll and tally it; you will come back here to record your decision.</p>
              <button className={s.openBtn} onClick={p.onOpenSheet}>Open register viewer</button>
            </div>
          )}
        </section>

        {/* ── Automated rule checks ─────────────────────────────────── */}
        <aside className={s.panel}>
          <div className={s.panelScroll}>
            <p className={s.paneHead}>Automated Rule Checks</p>
            {p.readOnly && <div className={s.readonly}>Read-only — decisions can only be recorded by the assigned auditor while the review is open.</div>}

            <div className={s.field}>
              <label className={s.label}>SELECT REJECTION REASON <span>{set.exact ? set.source : 'General checklist'}</span></label>
              <div className={s.dd}>
                <button className={s.ddBtn} disabled={p.readOnly} onClick={() => setMenu((m) => !m)} aria-haspopup="listbox" aria-expanded={menu}>
                  {picked ? <><span className={`${s.optSev} ${SEV_CLS[picked.severity].badge}`}>{SEVERITY_LABEL[picked.severity]}</span><span className={s.ddText}>{picked.keyword}</span></> : <span className={s.ddPlaceholder}>Choose a reason…</span>}
                  <span className={s.ddCaret}>▾</span>
                </button>
                {menu && (
                  <div className={s.ddMenu} role="listbox">
                    {set.options.map((o) => (
                      <button key={o.keyword} role="option" aria-selected={picked?.keyword === o.keyword} className={`${s.ddItem} ${picked?.keyword === o.keyword ? s.ddSel : ''}`} onClick={() => choose(o)}>
                        <span className={s.ddText}>{o.keyword}</span>
                        <span className={`${s.optSev} ${SEV_CLS[o.severity].badge}`}>{SEVERITY_LABEL[o.severity]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={s.field}>
              <label className={s.label}>Additional Auditing Comments {picked && <span>Supplier fixes within {picked.tatDays} working days</span>}</label>
              <textarea className={s.textarea} rows={5} value={comment} disabled={p.readOnly} placeholder="Pick a reason and the observation fills in here — edit it as needed." onChange={(e) => setComment(e.target.value)} />
              {picked && !comment.trim() && <p className={s.warn}>A comment is required — it cannot be saved empty.</p>}
            </div>

            <div className={s.actions}>
              <button className={s.rejectBtn} disabled={!canReject} onClick={reject}>REJECT &amp; STATE CHANGE</button>
              <button className={s.passBtn} disabled={!canPass} onClick={pass} title={hasFlags ? 'Remove the flags below to pass this document' : picked ? 'Clear the rejection reason to pass' : undefined}>
                <IconCheckCircle size={14} /> PASS &amp; VALIDATE
              </button>
            </div>
            {review.verdict === 'pass' && !hasFlags && <p className={s.passed}>Passed — recorded for your decision remarks.</p>}

            <p className={s.paneHead}>Flags on this document <em>{review.findings.length}</em></p>
            {review.findings.length === 0 ? <p className={s.hint}>None yet.</p> : (
              <div className={s.flags}>
                {review.findings.map((f) => (
                  <div key={f.id} className={`${s.flag} ${SEV_CLS[f.severity].flag}`}>
                    <div className={s.flagBody}>
                      <span className={s.flagTitle}>{f.keyword} <span className={`${s.optSev} ${SEV_CLS[f.severity].badge}`}>{SEVERITY_LABEL[f.severity]}</span></span>
                      <span className={s.flagText}>{f.comment}</span>
                      <span className={s.flagMeta}>Supplier TAT {f.tatDays} working days</span>
                    </div>
                    {!p.readOnly && <button className={s.rm} aria-label="Remove flag" onClick={() => removeFlag(f)}>×</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={s.foot}>
            <span className={s.footNote}>Findings feed your remarks in the Decision tab.</span>
            <button className={s.navBtn} disabled={!next || p.loadingNext} onClick={() => next && p.onOpenDoc(next)}>Next document ›</button>
          </div>
        </aside>
      </div>

      {/* ── Audit trail ──────────────────────────────────────────────── */}
      <div className={s.trail}>
        <div className={s.trailHead}><span>TIME</span><span>USER</span><span>ACTION</span><span>IMMUTABLE HASH</span></div>
        <div className={s.trailBody}>
          {trail.length === 0 ? <div className={s.trailEmpty}>No actions recorded yet.</div> : trail.slice(0, 20).map((e) => (
            <div key={e.hash} className={s.trailRow}>
              <span>{fmtTime(e.t)}</span><span>{e.user}</span><span className={s.trailAct}>{e.action}</span><code title={e.hash}>#{e.hash.slice(0, 10)}…</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { TAT_BY_SEVERITY };
