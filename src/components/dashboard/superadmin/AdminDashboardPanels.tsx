/**
 * AdminDashboardPanels.tsx — Command Centre + Reviews board for the live super-admin console.
 *
 * Command Centre: KPIs, "needs your attention" queue (approve / deny auditor access and assign
 * unassigned submissions inline), auditor workload, review funnel and the latest activity.
 * Reviews board: every review cycle with search, filters, sorting, inline actions and CSV export.
 * All data comes from useAdminPortal(); every change is audited server-side.
 */
import { useMemo, useState } from 'react';
import s from './AdminDashboard.module.css';
import { AdminClientDrawer } from './AdminPortalPanels';
import { downloadCsv, type PortalReview, type useAdminPortal } from './superAdminStore';

type Portal = ReturnType<typeof useAdminPortal>;
type Tab = 'overview' | 'approvals' | 'authorized' | 'kyc' | 'access' | 'reviews' | 'clients' | 'auditors' | 'activity';

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const label = (v?: string | null) => (v ? v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—');
const ageDays = (v?: string | null) => (v ? Math.floor((Date.now() - +new Date(v)) / 86400000) : 0);
const ago = (v: string) => {
  const m = Math.max(0, Math.round((Date.now() - +new Date(v)) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

const STATUS_CLS: Record<string, string> = { approved: s.pGood, rejected: s.pBad, denied: s.pBad, changes_requested: s.pViolet, requested: s.pWarn, pending: s.pWarn, in_review: s.pInfo };
const Pill = ({ v, text }: { v?: string | null; text?: string }) => <span className={`${s.pill} ${STATUS_CLS[v ?? ''] ?? ''}`}>{text ?? label(v)}</span>;

function useAct(portal: Portal) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const run = async (key: string, op: string, body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key); setErr('');
    const r = await portal.act(op, body);
    setBusy(null);
    if (!r.ok) setErr(r.message ?? 'Failed.');
  };
  return { busy, err, run };
}

// ═════════════════════════════════════════════════════════════════════════════
// Command Centre
// ═════════════════════════════════════════════════════════════════════════════
export function AdminCommandCenter({ portal, goTab }: { portal: Portal; goTab: (t: Tab) => void }) {
  const { busy, err, run } = useAct(portal);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState<PortalReview | null>(null);
  const d = portal.data;

  const m = useMemo(() => {
    const reviews = d?.reviews ?? [];
    const by = (st: string) => reviews.filter((r) => r.status === st).length;
    const scored = reviews.filter((r) => r.l2Score != null);
    return {
      reviews,
      unassigned: reviews.filter((r) => r.status === 'pending' && !r.auditorId),
      stale: reviews.filter((r) => r.status === 'in_review' && ageDays(r.l2CompletedAt) >= 7),
      counts: { pending: by('pending'), in_review: by('in_review'), changes_requested: by('changes_requested'), approved: by('approved'), rejected: by('rejected') },
      avg: scored.length ? Math.round(scored.reduce((a, r) => a + Number(r.l2Score), 0) / scored.length) : 0,
      critical: reviews.reduce((a, r) => a + (r.criticalIssues || 0), 0),
      certified: reviews.filter((r) => r.certificate && !r.certificate.revoked).length,
    };
  }, [d]);

  if (portal.error) return <p className={s.err}>{portal.error} (If this says "run the SQL migration", apply sql/validation_audit_flow.sql.)</p>;
  if (!d) return <p className={s.empty}>{portal.loading ? 'Loading the command centre…' : 'No data.'}</p>;

  const activeAuditors = d.auditors.filter((a) => a.active);
  const reqs = d.accessRequests;
  const total = Math.max(1, m.reviews.length);
  const stat = (n: number | string, l: string, opts: { hot?: boolean; hint?: string; to?: Tab } = {}) => (
    <button type="button" className={`${s.stat} ${opts.to ? s.statBtn : ''} ${opts.hot ? s.statHot : ''}`} onClick={() => opts.to && goTab(opts.to)}>
      <span className={s.statN}>{n}</span><span className={s.statL}>{l}</span>{opts.hint && <span className={s.statHint}>{opts.hint}</span>}
    </button>
  );

  return (
    <div className={s.wrap}>
      <div className={s.hero}>
        <div>
          <h2 className={s.heroTitle}>Command centre</h2>
          <p className={s.heroSub}>Everything that needs a decision today — access requests, unassigned audits and stalled reviews.</p>
        </div>
        <div className={s.heroRight}>
          <span className={s.live}>LIVE · refreshes every 30s</span>
          <select className={s.modeSel} value={d.accessMode} aria-label="Auditor access mode"
            onChange={(e) => { void run('mode', 'set_access_mode', { mode: e.target.value }); }}>
            <option value="auto">Access: automatic</option>
            <option value="admin">Access: admin approves</option>
          </select>
          <button className={s.ghost} onClick={() => { void portal.refresh(); }}>Refresh</button>
        </div>
      </div>

      <div className={s.stats}>
        {stat(reqs.length, 'Access requests', { hot: reqs.length > 0, hint: reqs.length ? 'Needs approval' : undefined, to: 'access' })}
        {stat(m.unassigned.length, 'Unassigned audits', { hot: m.unassigned.length > 0, hint: m.unassigned.length ? 'Assign an auditor' : undefined, to: 'reviews' })}
        {stat(m.counts.in_review, 'In review', { to: 'reviews' })}
        {stat(m.certified, 'Certified', { to: 'reviews' })}
        {stat(d.clients.length, 'Clients', { to: 'clients' })}
        {stat(activeAuditors.length, 'Active auditors', { to: 'auditors' })}
        {stat(`${m.avg}%`, 'Avg. L2 score')}
        {stat(m.critical, 'Critical issues', { hot: m.critical > 0 })}
      </div>

      <div className={s.cols}>
        <div className={s.col}>
          <div className={s.card}>
            <div className={s.cardHead}>
              <h3 className={s.cardTitle}>Auditor access requests <span className={`${s.count} ${reqs.length ? s.countHot : ''}`}>{reqs.length}</span></h3>
              <button className={s.btn} onClick={() => goTab('access')}>Open</button>
            </div>
            {err && <p className={s.err}>{err}</p>}
            {reqs.length === 0 && <div className={s.empty}>No pending requests. Auditors asking for access will appear here instantly.</div>}
            {reqs.slice(0, 6).map((r) => (
              <div key={r.id} className={s.task}>
                <div className={s.taskMain}>
                  <div className={s.taskTitle}>{r.auditorName || 'An auditor'} → {r.company}</div>
                  <div className={s.taskSub}>{r.industry || '—'} · L2 {r.l2Score}% · {r.files} file(s) · terms {r.termsAcceptedAt ? 'accepted' : 'pending'}</div>
                </div>
                <div className={s.taskAct}>
                  <button className={s.btn} onClick={() => setDrawer(r)}>Review</button>
                  <button className={`${s.btn} ${s.ok}`} disabled={busy === `a${r.id}`} onClick={() => { void run(`a${r.id}`, 'approve_access', { id: r.id }); }}>Approve</button>
                  <button className={`${s.btn} ${s.no}`} disabled={busy === `d${r.id}`} onClick={() => { void run(`d${r.id}`, 'deny_access', { id: r.id }, `Deny ${r.auditorName || 'the auditor'}'s access to ${r.company}?`); }}>Deny</button>
                </div>
              </div>
            ))}
          </div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <h3 className={s.cardTitle}>Submitted — waiting for an auditor <span className={`${s.count} ${m.unassigned.length ? s.countHot : ''}`}>{m.unassigned.length}</span></h3>
              <button className={s.btn} onClick={() => goTab('reviews')}>All reviews</button>
            </div>
            {m.unassigned.length === 0 && <div className={s.empty}>Nothing waiting. Every submission has an auditor.</div>}
            {m.unassigned.slice(0, 6).map((r) => (
              <div key={r.id} className={s.task}>
                <div className={s.taskMain}>
                  <div className={s.taskTitle}>{r.company}</div>
                  <div className={s.taskSub}>Submitted {ago(r.l2CompletedAt ?? r.createdAt)} · L2 {r.l2Score}% · {r.openIssues} open issue(s)</div>
                </div>
                <div className={s.taskAct}>
                  <select className={s.sel} value={pick[r.id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [r.id]: e.target.value }))} aria-label="Choose auditor">
                    <option value="">Assign to…</option>
                    {activeAuditors.map((a) => <option key={a.id} value={a.id}>{a.fullName || a.email} ({a.inReview})</option>)}
                  </select>
                  <button className={`${s.btn} ${s.ok}`} disabled={!pick[r.id] || busy === `s${r.id}`}
                    onClick={() => { void run(`s${r.id}`, 'assign', { id: r.id, auditorId: pick[r.id] }); }}>Assign</button>
                  <button className={s.btn} onClick={() => setDrawer(r)}>View</button>
                </div>
              </div>
            ))}
          </div>

          {m.stale.length > 0 && (
            <div className={s.card}>
              <div className={s.cardHead}><h3 className={s.cardTitle}>Stalled in review (7+ days) <span className={`${s.count} ${s.countHot}`}>{m.stale.length}</span></h3></div>
              {m.stale.slice(0, 5).map((r) => (
                <div key={r.id} className={s.task}>
                  <div className={s.taskMain}>
                    <div className={s.taskTitle}>{r.company}</div>
                    <div className={s.taskSub}>With {r.auditorName || 'an auditor'} for {ageDays(r.l2CompletedAt)} days</div>
                  </div>
                  <div className={s.taskAct}>
                    <button className={s.btn} onClick={() => setDrawer(r)}>View</button>
                    <button className={`${s.btn} ${s.no}`} disabled={busy === `r${r.id}`} onClick={() => { void run(`r${r.id}`, 'release', { id: r.id }, `Release ${r.company} back to the queue?`); }}>Release</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={s.col}>
          <div className={s.card}>
            <div className={s.cardHead}><h3 className={s.cardTitle}>Review funnel</h3></div>
            <div className={s.funnel}>
              {([['pending', 'Awaiting auditor'], ['in_review', 'In review'], ['changes_requested', 'Changes requested'], ['approved', 'Approved'], ['rejected', 'Rejected']] as const).map(([k, l]) => (
                <div key={k} className={s.fRow}><span>{l}</span><div className={s.fTrack}><div className={s.fFill} style={{ width: `${(m.counts[k] / total) * 100}%` }} /></div><span className={s.fN}>{m.counts[k]}</span></div>
              ))}
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}><h3 className={s.cardTitle}>Auditor workload</h3><button className={s.btn} onClick={() => goTab('auditors')}>Manage</button></div>
            {d.auditors.length === 0 && <div className={s.empty}>No auditors yet.</div>}
            {d.auditors.map((a) => {
              const t = Math.max(1, a.inReview + a.approved + a.changesRequested + a.rejected);
              return (
                <div key={a.id} className={s.bar} style={a.active ? undefined : { opacity: .55 }}>
                  <div className={s.barTop}><span className={s.barName}>{a.fullName || a.email}{!a.active && ' (inactive)'}</span><span className={s.barMeta}>{a.inReview} active · {a.avgTurnaroundDays ?? '—'}d avg</span></div>
                  <div className={s.track}>
                    <div className={`${s.seg} ${s.sInRev}`} style={{ width: `${(a.inReview / t) * 100}%` }} />
                    <div className={`${s.seg} ${s.sAppr}`} style={{ width: `${(a.approved / t) * 100}%` }} />
                    <div className={`${s.seg} ${s.sChg}`} style={{ width: `${(a.changesRequested / t) * 100}%` }} />
                    <div className={`${s.seg} ${s.sRej}`} style={{ width: `${(a.rejected / t) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            <div className={s.legend}><span><i className={s.sInRev} />In review</span><span><i className={s.sAppr} />Approved</span><span><i className={s.sChg} />Changes</span><span><i className={s.sRej} />Rejected</span></div>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}><h3 className={s.cardTitle}>Latest activity</h3><button className={s.btn} onClick={() => goTab('activity')}>All</button></div>
            <ul className={s.feed}>
              {d.activity.slice(0, 8).map((a) => (
                <li key={a.id}><b>{a.actor}</b> {a.action}{a.detail ? <span className={s.feedMeta}> — {a.detail}</span> : null}<div className={s.feedMeta}>{ago(a.createdAt)}</div></li>
              ))}
              {d.activity.length === 0 && <li className={s.feedMeta}>No events yet.</li>}
            </ul>
          </div>
        </div>
      </div>

      {drawer && <AdminClientDrawer portal={portal} cycle={drawer.id} profile={drawer.profileId} onClose={() => setDrawer(null)} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Reviews board
// ═════════════════════════════════════════════════════════════════════════════
type SortKey = 'company' | 'status' | 'l2Score' | 'age' | 'issues';

export function AdminReviewsPanel({ portal }: { portal: Portal }) {
  const { busy, err, run } = useAct(portal);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [access, setAccess] = useState('all');
  const [auditor, setAuditor] = useState('all');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'age', dir: -1 });
  const [pick, setPick] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState<PortalReview | null>(null);
  const d = portal.data;

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const val = (r: PortalReview): string | number =>
      sort.k === 'company' ? r.company.toLowerCase() : sort.k === 'status' ? r.status : sort.k === 'l2Score' ? Number(r.l2Score) : sort.k === 'issues' ? r.openIssues : ageDays(r.l2CompletedAt ?? r.createdAt);
    return (d?.reviews ?? [])
      .filter((r) => (status === 'all' || r.status === status) && (access === 'all' || r.accessStatus === access)
        && (auditor === 'all' || (auditor === 'none' ? !r.auditorId : r.auditorId === auditor))
        && (!t || [r.company, r.industry, r.auditorName].some((v) => (v ?? '').toLowerCase().includes(t))))
      .sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [d, q, status, access, auditor, sort]);

  if (portal.error) return <p className={s.err}>{portal.error}</p>;
  if (!d) return <p className={s.empty}>{portal.loading ? 'Loading…' : 'No data.'}</p>;
  const active = d.auditors.filter((a) => a.active);
  const th = (k: SortKey, text: string) => (
    <th onClick={() => setSort((p) => ({ k, dir: p.k === k ? (p.dir === 1 ? -1 : 1) : -1 }))}>{text}{sort.k === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</th>
  );
  const exportCsv = () => downloadCsv(`regnix-reviews-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((r) => ({
    Company: r.company, Industry: r.industry, Employees: r.employees, Status: label(r.status), Access: label(r.accessStatus), Auditor: r.auditorName,
    'L2 score': r.l2Score, 'Open issues': r.openIssues, 'Critical issues': r.criticalIssues, Files: r.files,
    Submitted: r.l2CompletedAt ?? '', Decided: r.decidedAt ?? '', Certificate: r.certificate ? `${r.certificate.certificateNo}${r.certificate.revoked ? ' (revoked)' : ''}` : '',
  })));

  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <h3 className={s.cardTitle}>All review cycles <span className={s.count}>{rows.length}</span></h3>
        <div className={s.taskAct}>
          <button className={s.btn} onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
          <button className={s.btn} onClick={() => { void portal.refresh(); }}>Refresh</button>
        </div>
      </div>
      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search company, industry or auditor…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s.sel} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">All statuses</option><option value="pending">Awaiting auditor</option><option value="in_review">In review</option>
          <option value="changes_requested">Changes requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        <select className={s.sel} value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Access">
          <option value="all">Any access</option><option value="requested">Requested</option><option value="approved">Approved</option><option value="denied">Denied</option><option value="none">None</option>
        </select>
        <select className={s.sel} value={auditor} onChange={(e) => setAuditor(e.target.value)} aria-label="Auditor">
          <option value="all">All auditors</option><option value="none">Unassigned</option>
          {d.auditors.map((a) => <option key={a.id} value={a.id}>{a.fullName || a.email}</option>)}
        </select>
      </div>
      {err && <p className={s.err}>{err}</p>}
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr>{th('company', 'Company')}{th('status', 'Status')}<th>Access</th><th>Auditor</th>{th('l2Score', 'L2')}{th('issues', 'Issues')}{th('age', 'Age')}<th>Certificate</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const days = ageDays(r.l2CompletedAt ?? r.createdAt);
              const open = r.status !== 'approved' && r.status !== 'rejected';
              return (
                <tr key={r.id} onClick={() => setDrawer(r)}>
                  <td className={s.strong}>{r.company}<div className={s.muted}>{r.industry} · {r.employees} emp.</div></td>
                  <td><Pill v={r.status} /></td>
                  <td><Pill v={r.accessStatus} /></td>
                  <td>{r.auditorName || <span className={s.muted}>Unassigned</span>}</td>
                  <td>{r.l2Score}%</td>
                  <td>{r.openIssues ? <span className={r.criticalIssues ? s.ageOld : ''}>{r.openIssues}{r.criticalIssues ? ` (${r.criticalIssues} critical)` : ''}</span> : '—'}</td>
                  <td className={`${s.age} ${open && days >= 7 ? s.ageOld : ''}`}>{days}d</td>
                  <td>{r.certificate ? <Pill v={r.certificate.revoked ? 'rejected' : 'approved'} text={r.certificate.revoked ? 'Revoked' : r.certificate.certificateNo} /> : '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className={s.taskAct}>
                      {r.accessStatus === 'requested' && <>
                        <button className={`${s.btn} ${s.ok}`} disabled={busy === `a${r.id}`} onClick={() => { void run(`a${r.id}`, 'approve_access', { id: r.id }); }}>Approve</button>
                        <button className={`${s.btn} ${s.no}`} disabled={busy === `d${r.id}`} onClick={() => { void run(`d${r.id}`, 'deny_access', { id: r.id }); }}>Deny</button>
                      </>}
                      {open && r.accessStatus !== 'requested' && (
                        <>
                          <select className={s.sel} value={pick[r.id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [r.id]: e.target.value }))} aria-label="Assign to auditor">
                            <option value="">{r.auditorId ? 'Reassign…' : 'Assign…'}</option>
                            {active.filter((a) => a.id !== r.auditorId).map((a) => <option key={a.id} value={a.id}>{a.fullName || a.email}</option>)}
                          </select>
                          <button className={s.btn} disabled={!pick[r.id] || busy === `s${r.id}`} onClick={() => { void run(`s${r.id}`, 'assign', { id: r.id, auditorId: pick[r.id] }, r.auditorId ? `Reassign ${r.company}?` : undefined); }}>Go</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={9} className={s.empty}>No reviews match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className={s.legend}><span>Fmt: {fmt(new Date().toISOString())}</span><span>Click a row for the full client file, documents, issues and timeline.</span></div>
      {drawer && <AdminClientDrawer portal={portal} cycle={drawer.id} profile={drawer.profileId} onClose={() => setDrawer(null)} />}
    </div>
  );
}
