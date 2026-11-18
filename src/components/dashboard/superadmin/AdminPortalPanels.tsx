/**
 * AdminPortalPanels.tsx — live super-admin panels (Clients, Auditors, Access requests, Activity).
 * Rendered by SuperAdminPage when the console session is a real Supabase super admin.
 * All data comes from useAdminPortal(); every change is written to audit_log server-side.
 */
import { useEffect, useMemo, useState } from 'react';
import s from './AdminPortal.module.css';
import {
  loadPortalDetail, openPortalFile,
  type PortalAuditor, type PortalClient, type PortalDetail, type PortalReview, type useAdminPortal,
} from './superAdminStore';

type Portal = ReturnType<typeof useAdminPortal>;

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const label = (v: string | null | undefined) => (v ? v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—');

function statusCls(v: string | null | undefined) {
  if (v === 'approved') return s.pGood;
  if (v === 'rejected' || v === 'denied') return s.pBad;
  if (v === 'changes_requested' || v === 'requested' || v === 'pending') return s.pWarn;
  if (v === 'in_review') return s.pInfo;
  return '';
}
const Pill = ({ v, text }: { v: string | null | undefined; text?: string }) => <span className={`${s.pill} ${statusCls(v)}`}>{text ?? label(v)}</span>;

function Gate({ portal }: { portal: Portal }) {
  if (portal.error) return <p className={s.notice}>{portal.error} (If this says "run the SQL migration", apply sql/validation_audit_flow.sql.)</p>;
  if (!portal.data) return <p className={s.empty}>{portal.loading ? 'Loading…' : 'No data.'}</p>;
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// Client detail drawer
// ═════════════════════════════════════════════════════════════════════════════
export function AdminClientDrawer({ portal, cycle, profile, onClose }: { portal: Portal; cycle?: string | null; profile?: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<PortalDetail | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState('');

  const load = async () => {
    const r = await loadPortalDetail({ cycle: cycle ?? undefined, profile: profile ?? undefined });
    if (r.ok) { setDetail(r.detail); setErr(''); } else setErr(r.error);
  };
  useEffect(() => {
    setBusy(true);
    void load().finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, profile]);

  const run = async (op: string, body: Record<string, unknown> = {}, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setMsg(''); setErr('');
    const r = await portal.act(op, body);
    if (r.ok) { setMsg('Done.'); await load(); } else setErr(r.message ?? 'Failed.');
    setBusy(false);
  };
  const open = async (id: string) => { const e = await openPortalFile(id); if (e) setErr(e); };

  const rv = detail?.review ?? null;
  const activeAuditors = (portal.data?.auditors ?? []).filter((a) => a.active);
  const p = detail?.profile;
  const c = detail?.company as Record<string, any> | null | undefined;
  const orgRows: Array<[string, unknown]> = detail?.organization
    ? [['Organisation', detail.organization.name], ['Industry', detail.organization.industry], ['CIN', detail.organization.cin], ['GSTIN', detail.organization.gstin], ['State', detail.organization.state], ['Employees', detail.organization.employees]]
    : [];
  const companyRows: Array<[string, unknown]> = c
    ? Object.entries(c).filter(([k, v]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(k) && v != null && typeof v !== 'object' && String(v).trim() !== '').map(([k, v]) => [label(k), v])
    : [];

  return (
    <div className={s.drawerBack} onClick={onClose}>
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label="Client details" onClick={(e) => e.stopPropagation()}>
        <div className={s.drawerHead}>
          <div>
            <h3 className={s.title}>{p?.company || p?.fullName || 'Client'}</h3>
            <p className={s.sub}>{p?.email} · {label(p?.plan) || 'No plan'} · joined {fmt(p?.createdAt)}</p>
          </div>
          <button className={s.close} onClick={onClose} aria-label="Close">×</button>
        </div>
        {busy && !detail && <p className={s.empty}>Loading…</p>}
        {err && <p className={s.err}>{err}</p>}
        {msg && <p className={s.ok}>{msg}</p>}

        {detail && p && (
          <>
            <div className={s.row}>
              <Pill v={p.approval} text={`Signup: ${label(p.approval)}`} />
              <Pill v={p.kycVerified ? 'approved' : 'pending'} text={p.kycVerified ? 'KYC verified' : 'KYC pending'} />
              {rv && <Pill v={rv.status} text={`Review: ${label(rv.status)}`} />}
              {rv && <Pill v={rv.accessStatus} text={`Access: ${label(rv.accessStatus)}`} />}
              {p.zohoFolderUrl && <a className={s.btn} href={p.zohoFolderUrl} target="_blank" rel="noreferrer">Zoho folder ↗</a>}
            </div>

            {rv && (
              <div className={s.section}>
                <p className={s.sectionTitle}>Manage review</p>
                <div className={s.actions}>
                  {rv.accessStatus === 'requested' && <>
                    <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy} onClick={() => run('approve_access', { id: rv.id })}>Approve access</button>
                    <button className={`${s.btn} ${s.btnDanger}`} disabled={busy} onClick={() => run('deny_access', { id: rv.id })}>Deny access</button>
                  </>}
                  {rv.accessStatus === 'denied' && <button className={s.btn} disabled={busy} onClick={() => run('approve_access', { id: rv.id })}>Approve access</button>}
                  {rv.status !== 'approved' && (
                    <>
                      <select className={s.select} value={pick} onChange={(e) => setPick(e.target.value)}>
                        <option value="">Assign to auditor…</option>
                        {activeAuditors.map((a) => <option key={a.id} value={a.id}>{a.fullName || a.email} ({a.inReview} active)</option>)}
                      </select>
                      <button className={s.btn} disabled={busy || !pick} onClick={() => run('assign', { id: rv.id, auditorId: pick }, 'Assign this review? The auditor must still accept the terms.')}>Assign</button>
                      {rv.auditor && <button className={`${s.btn} ${s.btnDanger}`} disabled={busy} onClick={() => run('release', { id: rv.id }, 'Release this review back to the queue?')}>Release to queue</button>}
                    </>
                  )}
                  {rv.certificate && !rv.certificate.revoked && (
                    <button className={`${s.btn} ${s.btnDanger}`} disabled={busy} onClick={() => {
                      const note = window.prompt('Reason for revoking the certificate (shown on the verify page):');
                      if (note) void run('revoke_cert', { id: rv.id, note });
                    }}>Revoke certificate</button>
                  )}
                  {rv.certificate?.revoked && <button className={s.btn} disabled={busy} onClick={() => run('restore_cert', { id: rv.id }, 'Restore this certificate?')}>Restore certificate</button>}
                </div>
              </div>
            )}

            <div className={s.section}>
              <p className={s.sectionTitle}>Audit</p>
              {rv ? (
                <div className={s.grid}>
                  <div className={s.kv}><b>Auditor</b>{rv.auditor ? (rv.auditor.fullName || rv.auditor.email || rv.auditor.id) : 'Unassigned'}</div>
                  <div className={s.kv}><b>L2 score</b>{rv.l2Score}%</div>
                  <div className={s.kv}><b>Terms accepted</b>{fmt(rv.termsAcceptedAt)}{rv.termsVersion ? ` (${rv.termsVersion})` : ''}</div>
                  <div className={s.kv}><b>L2 completed</b>{fmt(rv.l2CompletedAt)}</div>
                  <div className={s.kv}><b>Decision</b>{fmt(rv.decidedAt)}</div>
                  <div className={s.kv}><b>Acts</b>{rv.selectedActs.join(', ') || '—'}</div>
                  {rv.certificate && <div className={s.kv}><b>Certificate</b>{rv.certificate.certificateNo}{rv.certificate.revoked ? ` · REVOKED (${rv.certificate.revokedReason})` : ` · issued ${fmt(rv.certificate.issuedAt)}`}</div>}
                  {rv.remarks && <div className={s.kv}><b>Auditor remarks</b>{rv.remarks}</div>}
                </div>
              ) : <p className={s.empty}>No audit has been submitted yet.</p>}
              {detail.reviews.length > 1 && <p className={s.muted}>{detail.reviews.length} review cycles on record.</p>}
            </div>

            {rv && rv.issues.length > 0 && (
              <div className={s.section}>
                <p className={s.sectionTitle}>Issues ({rv.issues.filter((i: any) => !i.resolved).length} open)</p>
                {rv.issues.map((i: any, n: number) => (
                  <div key={n} className={`${s.issue} ${i.severity === 'critical' ? s.issueCritical : i.severity === 'major' ? s.issueMajor : ''}`}>
                    <b>{i.docName}</b> · {label(i.severity)}{i.resolved ? ' · resolved' : ''}<br />{i.rule}{i.rootCause ? ` — ${i.rootCause}` : ''}
                  </div>
                ))}
              </div>
            )}

            <div className={s.section}>
              <p className={s.sectionTitle}>Documents ({detail.files.length})</p>
              {detail.files.length === 0 && <p className={s.empty}>No validation documents uploaded.</p>}
              {detail.files.map((f) => (
                <div key={f.id} className={s.fileRow}>
                  <div><div className={s.fileName}>{f.fileName}</div><div className={s.muted}>{f.docName} · {bytes(f.size)} · {fmt(f.at)}</div></div>
                  <div className={s.row}>
                    {f.stored && <button className={s.btn} onClick={() => open(f.id)}>Open</button>}
                    {f.zohoUrl && <a className={s.btn} href={f.zohoUrl} target="_blank" rel="noreferrer">Zoho ↗</a>}
                  </div>
                </div>
              ))}
            </div>

            <div className={s.section}>
              <p className={s.sectionTitle}>Company data</p>
              <div className={s.grid}>
                {[...orgRows, ...companyRows].filter(([, v]) => v != null && String(v) !== '').map(([k, v]) => (
                  <div className={s.kv} key={k}><b>{k}</b>{String(v)}</div>
                ))}
                <div className={s.kv}><b>Account</b>{p.fullName} · {label(p.accountType)}</div>
                <div className={s.kv}><b>GSTIN</b>{p.gstin || '—'}</div>
              </div>
            </div>

            <div className={s.section}>
              <p className={s.sectionTitle}>KYC &amp; payments ({detail.kyc.length})</p>
              {detail.kyc.length === 0 && <p className={s.empty}>No KYC requests.</p>}
              {detail.kyc.map((k) => (
                <div key={k.id} className={s.issue}>
                  <b>{label(k.status)}</b> · {k.currency} {k.amount} · requested {fmt(k.created_at)}
                  {k.submitted_at && <> · submitted {fmt(k.submitted_at)}</>}
                  {k.payment_reference && <> · ref {k.payment_reference}</>}
                  {k.files?.map((f: any) => <div key={f.id} className={s.muted}>{f.doc_label}: {f.zoho_url ? <a href={f.zoho_url} target="_blank" rel="noreferrer">{f.file_name} ↗</a> : f.file_name}</div>)}
                </div>
              ))}
            </div>

            <div className={s.section}>
              <p className={s.sectionTitle}>Timeline</p>
              <ul className={s.timeline}>
                {detail.activity.length === 0 && <li className={s.muted}>No activity recorded.</li>}
                {detail.activity.map((a) => <li key={a.id}><b>{a.action}</b> {a.detail && `— ${a.detail}`} <span className={s.muted}>· {fmt(a.createdAt)}</span></li>)}
              </ul>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Clients
// ═════════════════════════════════════════════════════════════════════════════
export function AdminClientsPanel({ portal }: { portal: Portal }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState<PortalClient | null>(null);
  const gate = Gate({ portal });
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (portal.data?.clients ?? []).filter((c) => {
      if (filter === 'review' && !c.reviewId) return false;
      if (filter === 'noreview' && c.reviewId) return false;
      if (filter === 'certified' && !(c.certificate && !c.certificate.revoked)) return false;
      return !t || [c.company, c.fullName, c.email, c.industry].some((v) => (v ?? '').toLowerCase().includes(t));
    });
  }, [portal.data, q, filter]);
  return (
    <div className={s.panel}>
      <div className={s.head}>
        <div><h3 className={s.title}>All clients</h3><p className={s.sub}>Click a row to see everything about the client — data, documents, issues, KYC, audit and timeline.</p></div>
        <div className={s.row}>
          <input className={s.search} placeholder="Search name, email, company…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={s.select} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option><option value="review">Submitted for audit</option><option value="noreview">Not submitted</option><option value="certified">Certified</option>
          </select>
          <button className={s.btn} onClick={() => void portal.refresh()}>Refresh</button>
        </div>
      </div>
      {gate}
      {portal.data && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Company</th><th>Contact</th><th>Plan</th><th>Signup</th><th>KYC</th><th>Docs</th><th>Audit</th><th>L2</th><th>Issues</th><th>Certificate</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={s.click} onClick={() => setSel(c)}>
                  <td className={s.strong}>{c.company || c.fullName}<div className={s.muted}>{c.industry}</div></td>
                  <td>{c.fullName}<div className={s.muted}>{c.email}</div></td>
                  <td>{label(c.plan)}</td>
                  <td><Pill v={c.approval} /></td>
                  <td><Pill v={c.kycVerified ? 'approved' : 'pending'} text={c.kycVerified ? 'Verified' : 'Pending'} /></td>
                  <td>{c.files}</td>
                  <td>{c.reviewStatus ? <Pill v={c.reviewStatus} /> : <span className={s.muted}>—</span>}</td>
                  <td>{c.l2Score ?? '—'}</td>
                  <td>{c.openIssues || '—'}</td>
                  <td>{c.certificate ? <Pill v={c.certificate.revoked ? 'rejected' : 'approved'} text={c.certificate.revoked ? 'Revoked' : c.certificate.certificateNo} /> : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} className={s.empty}>No clients match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {sel && <AdminClientDrawer portal={portal} cycle={sel.reviewId} profile={sel.id} onClose={() => setSel(null)} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Auditors — add / edit / (de)activate + workload
// ═════════════════════════════════════════════════════════════════════════════
const SPECS = ['General Compliance', 'Labour Law', 'Payroll & PF/ESI', 'Factory & Safety', 'Contract Labour', 'Statutory Returns'];

function AuditorModal({ portal, auditor, onClose }: { portal: Portal; auditor: PortalAuditor | null; onClose: () => void }) {
  const edit = !!auditor;
  const [fullName, setFullName] = useState(auditor?.fullName ?? '');
  const [email, setEmail] = useState(auditor?.email ?? '');
  const [licenseId, setLicenseId] = useState(auditor?.licenseId ?? '');
  const [spec, setSpec] = useState(auditor?.specialization ?? SPECS[0]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [temp, setTemp] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const save = async () => {
    setBusy(true); setErr('');
    const r = edit
      ? await portal.act('auditor_update', { id: auditor!.id, fullName, licenseId, specialization: spec })
      : await portal.act('auditor_create', { fullName, email, licenseId, specialization: spec, password: password || undefined });
    setBusy(false);
    if (!r.ok) { setErr(r.message ?? 'Failed.'); return; }
    if (!edit) { setCreated(true); setTemp(r.tempPassword ?? null); } else onClose();
  };

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {created ? (
          <>
            <h3 className={s.modalTitle}>Auditor created</h3>
            {temp ? (<>
              <p className={s.sub}>Share these sign-in details securely. The password is shown only once.</p>
              <p className={s.secret}>{email}<br />{temp}</p>
            </>) : <p className={s.sub}>An existing account was promoted to auditor — they sign in with their current password.</p>}
            <div className={s.footer}><button className={`${s.btn} ${s.btnPrimary}`} onClick={onClose}>Done</button></div>
          </>
        ) : (
          <>
            <h3 className={s.modalTitle}>{edit ? 'Edit auditor' : 'Add auditor'}</h3>
            <label className={s.field}><span>Full name</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
            <label className={s.field}><span>Email</span><input type="email" value={email} disabled={edit} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className={s.field}><span>Licence / membership ID</span><input value={licenseId} onChange={(e) => setLicenseId(e.target.value)} /></label>
            <label className={s.field}><span>Specialisation</span>
              <select value={spec} onChange={(e) => setSpec(e.target.value)}>
                {[...new Set([spec, ...SPECS])].map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            {!edit && <label className={s.field}><span>Temporary password (optional — generated if empty)</span><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 10 characters" /></label>}
            {err && <p className={s.err}>{err}</p>}
            <div className={s.footer}>
              <button className={s.btn} onClick={onClose}>Cancel</button>
              <button className={`${s.btn} ${s.btnPrimary}`} disabled={busy || !fullName || !licenseId || (!edit && !email)} onClick={save}>{busy ? 'Saving…' : edit ? 'Save' : 'Create auditor'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminAuditorsPanel({ portal }: { portal: Portal }) {
  const [modal, setModal] = useState<{ a: PortalAuditor | null } | null>(null);
  const [err, setErr] = useState('');
  const gate = Gate({ portal });
  const list = portal.data?.auditors ?? [];
  const toggle = async (a: PortalAuditor) => {
    if (a.active && !window.confirm(`Deactivate ${a.fullName || a.email}? Their in-review companies go back to the queue.`)) return;
    const r = await portal.act('auditor_update', { id: a.id, active: !a.active });
    setErr(r.ok ? '' : r.message ?? 'Failed.');
  };
  return (
    <div className={s.panel}>
      <div className={s.head}>
        <div><h3 className={s.title}>Auditors</h3><p className={s.sub}>Create, customise and deactivate auditors; see each one's workload.</p></div>
        <div className={s.row}>
          <button className={s.btn} onClick={() => void portal.refresh()}>Refresh</button>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => setModal({ a: null })}>+ Add auditor</button>
        </div>
      </div>
      {gate}
      {err && <p className={s.err}>{err}</p>}
      {portal.data && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Auditor</th><th>Specialisation</th><th>Licence</th><th>Status</th><th>In review</th><th>Awaiting access</th><th>Approved</th><th>Changes</th><th>Rejected</th><th>Avg. days</th><th /></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td className={s.strong}>{a.fullName || '—'}<div className={s.muted}>{a.email}</div></td>
                  <td>{a.specialization}</td><td>{a.licenseId}</td>
                  <td><Pill v={a.active ? 'approved' : 'rejected'} text={a.active ? 'Active' : 'Inactive'} /></td>
                  <td>{a.inReview}</td><td>{a.awaitingAccess || '—'}</td><td>{a.approved}</td><td>{a.changesRequested}</td><td>{a.rejected}</td>
                  <td>{a.avgTurnaroundDays ?? '—'}</td>
                  <td><div className={s.row}>
                    <button className={s.btn} onClick={() => setModal({ a })}>Edit</button>
                    <button className={`${s.btn} ${a.active ? s.btnDanger : ''}`} onClick={() => toggle(a)}>{a.active ? 'Deactivate' : 'Activate'}</button>
                  </div></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={11} className={s.empty}>No auditors yet — add the first one.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal && <AuditorModal portal={portal} auditor={modal.a} onClose={() => setModal(null)} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Access requests + mode switch
// ═════════════════════════════════════════════════════════════════════════════
export function AdminAccessPanel({ portal }: { portal: Portal }) {
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<PortalReview | null>(null);
  const gate = Gate({ portal });
  const d = portal.data;
  const run = async (op: string, id: string) => { const r = await portal.act(op, { id }); setErr(r.ok ? '' : r.message ?? 'Failed.'); };
  const setMode = async (mode: 'auto' | 'admin') => { const r = await portal.act('set_access_mode', { mode }); setErr(r.ok ? '' : r.message ?? 'Failed.'); };
  return (
    <div className={s.panel}>
      <div className={s.head}>
        <div><h3 className={s.title}>Auditor access requests</h3><p className={s.sub}>An auditor sees a client's documents and data only after access is approved.</p></div>
        {d && (
          <div className={s.row}>
            <span className={s.muted}>Approval mode</span>
            <select className={s.select} value={d.accessMode} onChange={(e) => setMode(e.target.value as 'auto' | 'admin')}>
              <option value="auto">Automatic (self-approved)</option>
              <option value="admin">Admin approves each request</option>
            </select>
          </div>
        )}
      </div>
      {gate}
      {err && <p className={s.err}>{err}</p>}
      {d && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Company</th><th>Auditor</th><th>Terms accepted</th><th>Docs</th><th>L2</th><th /></tr></thead>
            <tbody>
              {d.accessRequests.map((r) => (
                <tr key={r.id}>
                  <td className={s.strong}>{r.company}<div className={s.muted}>{r.industry}</div></td>
                  <td>{r.auditorName || '—'}</td><td>{fmt(r.termsAcceptedAt)}</td><td>{r.files}</td><td>{r.l2Score}</td>
                  <td><div className={s.row}>
                    <button className={s.btn} onClick={() => setSel(r)}>View</button>
                    <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => run('approve_access', r.id)}>Approve</button>
                    <button className={`${s.btn} ${s.btnDanger}`} onClick={() => run('deny_access', r.id)}>Deny</button>
                  </div></td>
                </tr>
              ))}
              {d.accessRequests.length === 0 && <tr><td colSpan={6} className={s.empty}>No pending access requests.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {sel && <AdminClientDrawer portal={portal} cycle={sel.id} profile={sel.profileId} onClose={() => setSel(null)} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Activity — live audit_log feed
// ═════════════════════════════════════════════════════════════════════════════
export function AdminActivityPanel({ portal }: { portal: Portal }) {
  const [role, setRole] = useState('all');
  const gate = Gate({ portal });
  const rows = (portal.data?.activity ?? []).filter((a) => role === 'all' || a.actorRole === role);
  return (
    <div className={s.panel}>
      <div className={s.head}>
        <div><h3 className={s.title}>Audit trail</h3><p className={s.sub}>Latest 200 events across auditors, admins and the system.</p></div>
        <div className={s.row}>
          <select className={s.select} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">Everyone</option><option value="auditor">Auditors</option><option value="super_admin">Admins</option><option value="system">System</option>
          </select>
          <button className={s.btn} onClick={() => void portal.refresh()}>Refresh</button>
        </div>
      </div>
      {gate}
      {portal.data && (
        <ul className={s.timeline}>
          {rows.map((a) => <li key={a.id}><b>{a.actor}</b> <span className={s.pill}>{a.actorRole}</span> {a.action} {a.detail && <span className={s.muted}>— {a.detail}</span>} <span className={s.muted}>· {fmt(a.createdAt)}</span></li>)}
          {rows.length === 0 && <li className={s.empty}>No events.</li>}
        </ul>
      )}
    </div>
  );
}
