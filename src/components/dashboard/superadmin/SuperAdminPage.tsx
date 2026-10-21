/**
 * SuperAdminPage.tsx
 *
 * Top-level Super Admin console. Mount at e.g. <Route path="/admin/*" element={<SuperAdminPage />} />
 *
 * Not signed in → SuperAdminAuth. Signed in → four tabs, all reading from
 * useSystemOverview() (which itself composes on top of useAuditorStore()):
 *
 *   Overview  — platform-wide stat cards + status funnel + critical-issue callout
 *   Clients   — every company across every status, not just approved ones
 *   Auditors  — roster with live workload + approval/rejection counts + turnaround
 *   Activity  — the audit_log feed (sign-ins, claims, decisions)
 *
 * This intentionally reuses useAuditorStore() rather than standing up a
 * parallel data source — a super admin's "all companies" view and an
 * auditor's "my queue" view must never be able to drift out of sync, since
 * they're read access levels over the same underlying facts, not separate
 * facts.
 */

import { useMemo, useState } from 'react';
import s from './SuperAdmin.module.css';
import SuperAdminAuth from './SuperAdminAuth';
import {
  useSuperAdminAuth, useSystemOverview, useSignupApprovals, useAdminNotifications, useAuthorizedUsers,
  type AuthorizedUser,
} from './superAdminStore';
import { getPlan, formatINR, headcountLabel } from '@/lib/plans';
import { useAuditorStore, type CompanyReview } from '../AuditorView/auditorStore';
import {
  IconShieldCheck, IconBuilding, IconUsers, IconAlertTriangle, IconCheckCircle,
  IconClock, IconEye, IconUndo, IconXCircle, IconLogOut, IconSearch, IconFlag,
} from '../AuditorView/icons';

type Tab = 'overview' | 'approvals' | 'authorized' | 'kyc' | 'clients' | 'auditors' | 'activity';

/** Standard company-KYC checklist offered when requesting documents. */
const KYC_DOCUMENTS = [
  'Certificate of Incorporation',
  'Company PAN card',
  'GST registration certificate',
  'Registered address proof',
  'MOA and AOA',
  'Board resolution / authorisation letter',
  'Director ID proof (PAN / Aadhaar)',
];

function kycPill(u: AuthorizedUser): { label: string; cls: string } | null {
  if (!u.kyc) return null;
  if (u.kyc.status === 'verified')  return { label: 'KYC verified', cls: 'saPillApproved' };
  if (u.kyc.status === 'cancelled') return { label: 'Request cancelled', cls: 'saPillRejected' };
  if (u.kyc.submittedAt) return { label: 'Submitted · needs review', cls: 'saPillChanges' };
  return u.kyc.docsReceived || u.kyc.paymentReceived
    ? { label: 'In progress', cls: 'saPillReview' }
    : { label: 'Requested', cls: 'saPillPending' };
}

const STATUS_META: Record<CompanyReview['status'], { label: string; icon: JSX.Element; cls: string }> = {
  pending:            { label: 'Awaiting Review',  icon: <IconClock size={12} />,         cls: 'saPillPending' },
  in_review:          { label: 'In Review',       icon: <IconEye size={12} />,           cls: 'saPillReview' },
  approved:           { label: 'Approved',        icon: <IconCheckCircle size={12} />,    cls: 'saPillApproved' },
  changes_requested:  { label: 'Changes Requested', icon: <IconUndo size={12} />,         cls: 'saPillChanges' },
  rejected:           { label: 'Rejected',        icon: <IconXCircle size={12} />,        cls: 'saPillRejected' },
};

function PlanChip({ id }: { id: string | null }) {
  const plan = getPlan(id);
  if (!plan) return <span className={s.saDimText}>—</span>;
  return (
    <span className={s.saPlanChip} title={headcountLabel(plan)}>
      <strong>{plan.name}</strong>
      <span>{formatINR(plan.monthlyPrice)}/mo</span>
    </span>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function timeAgo(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return fmtDate(d);
}

const LIVE_NOTICE =
  'Demo session: it has no database access, so live notifications and signups cannot load. ' +
  'Sign out and sign in with your real super admin account.';

function liveNotice(reason: string): string {
  return reason ? `${LIVE_NOTICE} Reason: ${reason}` : LIVE_NOTICE;
}

export default function SuperAdminPage() {
  const admin = useSuperAdminAuth();
  const overview = useSystemOverview();
  const { companies } = useAuditorStore();
  const approvals = useSignupApprovals(admin.isAuthenticated);
  const notifications = useAdminNotifications(admin.isAuthenticated);
  const authorized = useAuthorizedUsers(admin.isLive, admin.currentAdmin?.id ?? null);
  const [bellOpen, setBellOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');

  // KYC request form (modal)
  const [kycTarget, setKycTarget] = useState<AuthorizedUser | null>(null);
  const [kycDocs, setKycDocs] = useState<string[]>(KYC_DOCUMENTS.slice(0, 3));
  const [kycOther, setKycOther] = useState('');
  const [kycAmount, setKycAmount] = useState('');
  const [kycDue, setKycDue] = useState('');
  const [kycNote, setKycNote] = useState('');
  const [kycFormError, setKycFormError] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);

  function openKycForm(u: AuthorizedUser) {
    setKycTarget(u);
    setKycDocs(KYC_DOCUMENTS.slice(0, 3));
    // price comes from the plan the user picked on the pricing page
    const plan = getPlan(u.plan);
    setKycOther(''); setKycAmount(plan ? String(plan.monthlyPrice) : ''); setKycDue(''); setKycNote(''); setKycFormError('');
  }

  async function submitKycForm() {
    if (!kycTarget) return;
    const documents = [...kycDocs, ...(kycOther.trim() ? [kycOther.trim()] : [])];
    const amount = kycAmount.trim() === '' ? 0 : Number(kycAmount);
    if (!Number.isFinite(amount) || amount < 0) { setKycFormError('Enter a valid payment amount.'); return; }
    if (documents.length === 0 && amount === 0) {
      setKycFormError('Select at least one document or enter a payment amount.');
      return;
    }
    const ok = await authorized.requestKyc(kycTarget.id, {
      documents, amount, currency: 'INR', dueDate: kycDue, note: kycNote.trim(),
    });
    if (ok) setKycTarget(null);
  }

  const reviewUser = reviewId ? authorized.users.find((u) => u.id === reviewId) ?? null : null;
  const submittedUsers = useMemo(
    () => authorized.users.filter((u) => u.kyc && u.kyc.status === 'requested' && u.kyc.submittedAt),
    [authorized.users],
  );

  const [authQuery, setAuthQuery] = useState('');
  const filteredAuthorized = useMemo(() => {
    const q = authQuery.trim().toLowerCase();
    if (!q) return authorized.users;
    return authorized.users.filter((u) =>
      u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) ||
      u.companyName.toLowerCase().includes(q));
  }, [authorized.users, authQuery]);

  const filteredCompanies = useMemo(() => {
    if (!query.trim()) return companies;
    const q = query.trim().toLowerCase();
    return companies.filter(
      (c) => c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q),
    );
  }, [companies, query]);

  if (!admin.isAuthenticated) {
    return <SuperAdminAuth onAuthenticated={() => setTab('overview')} />;
  }

  return (
    <div className={s.saShell}>
      <header className={s.saTopbar}>
        <div className={s.saBrand}>
          <span className={s.saBrandMark}><IconShieldCheck size={16} /></span>
          <span className={s.saBrandText}>Regnix <strong>Super Admin</strong></span>
        </div>
        <div className={s.saTopbarRight}>
          <div className={s.saBellWrap}>
            <button
              className={s.saBellBtn}
              aria-label="Notifications"
              onClick={() => setBellOpen((o) => !o)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {notifications.unread > 0 && (
                <span className={s.saBellBadge}>{notifications.unread > 99 ? '99+' : notifications.unread}</span>
              )}
            </button>
            {bellOpen && (
              <div className={s.saBellPanel}>
                <div className={s.saBellHead}>
                  <strong>Notifications</strong>
                  <button className={s.saDemoLink} onClick={() => { void notifications.markAllRead(); }}>
                    Mark all read
                  </button>
                </div>
                {!admin.isLive && <p className={s.saNotice}>{liveNotice(admin.remoteError)}</p>}
                {admin.isLive && notifications.error && <p className={s.saEmptyNote}>{notifications.error}</p>}
                {admin.isLive && !notifications.error && notifications.items.length === 0 && (
                  <p className={s.saEmptyNote}>No activity yet.</p>
                )}
                <div className={s.saBellList}>
                  {notifications.items.map((n) => (
                    <button
                      key={n.id}
                      className={n.isRead ? s.saBellItem : `${s.saBellItem} ${s.saBellItemUnread}`}
                      onClick={() => {
                        void notifications.markRead(n.id);
                        if (n.type === 'new_signup') { setTab('approvals'); setBellOpen(false); }
                        if (n.type === 'kyc_submitted') { setTab('kyc'); setBellOpen(false); }
                      }}
                    >
                      <span className={s.saBellTitle}>
                        {!n.isRead && <span className={s.saBellDot} aria-label="Unread" />}
                        {n.title}
                      </span>
                      <span className={s.saBellDetail}>{n.detail}</span>
                      <span className={s.saActivityTime}>{timeAgo(n.createdAt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className={s.saAdminName}>{admin.currentAdmin?.fullName ?? 'Super Admin'}</span>
          <button className={s.saSignOutBtn} onClick={() => admin.signOut()}>
            <IconLogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <div className={s.saTabs}>
        <button className={tab === 'overview' ? `${s.saTab} ${s.saTabActive}` : s.saTab} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={tab === 'approvals' ? `${s.saTab} ${s.saTabActive}` : s.saTab} onClick={() => setTab('approvals')}>
          Approvals <span className={s.saTabCount}>{approvals.pending.length}</span>
        </button>
        <button className={tab === 'authorized' ? `${s.saTab} ${s.saTabActive}` : s.saTab} onClick={() => setTab('authorized')}>
          Authorized users <span className={s.saTabCount}>{authorized.users.length}</span>
        </button>
        <button className={tab === 'kyc' ? `${s.saTab} ${s.saTabActive}` : s.saTab} onClick={() => setTab('kyc')}>
          KYC review <span className={s.saTabCount}>{submittedUsers.length}</span>
        </button>
        <button className={tab === 'clients' ? `${s.saTab} ${s.saTabActive}` : s.saTab} onClick={() => setTab('clients')}>
          Clients <span className={s.saTabCount}>{overview.totalCompanies}</span>
        </button>
        <button className={tab === 'auditors' ? `${s.saTab} ${s.saTabActive}` : s.saTab} onClick={() => setTab('auditors')}>
          Auditors <span className={s.saTabCount}>{overview.totalAuditors}</span>
        </button>
        <button className={tab === 'activity' ? `${s.saTab} ${s.saTabActive}` : s.saTab} onClick={() => setTab('activity')}>
          Activity
        </button>
      </div>

      <main className={s.saContent}>
        {tab === 'overview' && (
          <>
            <div className={s.saStatGrid}>
              <div className={s.saStatCard}>
                <span className={s.saStatIcon}><IconBuilding size={17} /></span>
                <div><span className={s.saStatNum}>{overview.totalCompanies}</span><span className={s.saStatLabel}>Total clients</span></div>
              </div>
              <div className={s.saStatCard}>
                <span className={s.saStatIcon}><IconUsers size={17} /></span>
                <div><span className={s.saStatNum}>{overview.totalAuditors}</span><span className={s.saStatLabel}>Active auditors</span></div>
              </div>
              <div className={s.saStatCard}>
                <span className={s.saStatIcon}><IconCheckCircle size={17} /></span>
                <div><span className={s.saStatNum}>{overview.totalCertificatesIssued}</span><span className={s.saStatLabel}>Certificates issued</span></div>
              </div>
              <div className={s.saStatCard} data-warn={overview.totalCriticalIssues > 0}>
                <span className={s.saStatIcon}><IconAlertTriangle size={17} /></span>
                <div><span className={s.saStatNum}>{overview.totalCriticalIssues}</span><span className={s.saStatLabel}>Critical open issues</span></div>
              </div>
              <div className={s.saStatCard}>
                <span className={s.saStatIcon}><IconFlag size={17} /></span>
                <div><span className={s.saStatNum}>{overview.totalOpenIssues}</span><span className={s.saStatLabel}>Total open issues</span></div>
              </div>
              <div className={s.saStatCard}>
                <span className={s.saStatIcon}><IconEye size={17} /></span>
                <div><span className={s.saStatNum}>{overview.avgL2Score}</span><span className={s.saStatLabel}>Avg. L2 score</span></div>
              </div>
            </div>

            <div className={s.saPanel}>
              <p className={s.saPanelTitle}>Review funnel</p>
              <div className={s.saFunnel}>
                {(Object.keys(overview.byStatus) as CompanyReview['status'][]).map((status) => (
                  <div key={status} className={s.saFunnelRow}>
                    <span className={`${s.saPill} ${s[STATUS_META[status].cls]}`}>
                      {STATUS_META[status].icon} {STATUS_META[status].label}
                    </span>
                    <div className={s.saFunnelBarTrack}>
                      <div
                        className={s.saFunnelBarFill}
                        style={{ width: `${overview.totalCompanies ? (overview.byStatus[status] / overview.totalCompanies) * 100 : 0}%` }}
                      />
                    </div>
                    <span className={s.saFunnelCount}>{overview.byStatus[status]}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'approvals' && (
          <div className={s.saPanel}>
            <p className={s.saPanelTitle}>Pending applications</p>
            {!admin.isLive && <p className={s.saNotice}>{liveNotice(admin.remoteError)}</p>}
            {admin.isLive && approvals.error && <p className={s.saEmptyNote}>{approvals.error}</p>}
            {admin.isLive && !approvals.error && approvals.pending.length === 0 && (
              <p className={s.saEmptyNote}>No signups are waiting for approval.</p>
            )}
            {approvals.pending.length > 0 && (
              <table className={s.saTable}>
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Type</th><th>Company</th>
                    <th>Industry</th><th>Plan</th><th>Signed up</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.pending.map((p) => (
                    <tr key={p.id}>
                      <td className={s.saTableStrong}>
                        {p.fullName}{' '}
                        {p.isNew && <span className={`${s.saPill} ${s.saPillReview}`}>New</span>}
                      </td>
                      <td>{p.email}</td>
                      <td>{p.accountType}</td>
                      <td>{p.companyName}</td>
                      <td>{p.industry}</td>
                      <td><PlanChip id={p.plan} /></td>
                      <td>{fmtDate(p.createdAt)}</td>
                      <td>
                        <button
                          className={s.saSignOutBtn}
                          disabled={approvals.busyId === p.id}
                          onClick={() => { void approvals.approve(p.id); }}
                        >
                          <IconCheckCircle size={13} /> Approve
                        </button>{' '}
                        <button
                          className={s.saSignOutBtn}
                          disabled={approvals.busyId === p.id}
                          onClick={() => {
                            const reason = window.prompt('Reason for rejecting (optional):') ?? undefined;
                            void approvals.reject(p.id, reason || undefined);
                          }}
                        >
                          <IconXCircle size={13} /> Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'authorized' && (
          <div className={s.saPanel}>
            <div className={s.saPanelHead}>
              <p className={s.saPanelTitle}>Authorized users</p>
              <div className={s.saSearch}>
                <IconSearch size={13} />
                <input
                  placeholder="Search by name, email or company…"
                  value={authQuery}
                  onChange={(e) => setAuthQuery(e.target.value)}
                />
              </div>
            </div>
            {!admin.isLive && <p className={s.saNotice}>{liveNotice(admin.remoteError)}</p>}
            {admin.isLive && authorized.error && <p className={s.saNotice}>{authorized.error}</p>}
            {admin.isLive && authorized.notice && <p className={s.saNoticeOk}>{authorized.notice}</p>}
            {admin.isLive && !authorized.error && filteredAuthorized.length === 0 && (
              <p className={s.saEmptyNote}>No approved users yet. Approve a signup and they will appear here.</p>
            )}
            {filteredAuthorized.length > 0 && (
              <table className={s.saTable}>
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Type</th><th>Company</th>
                    <th>Plan</th><th>Approved</th><th>KYC &amp; payment</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuthorized.map((u) => {
                    const pill = kycPill(u);
                    const k = u.kyc;
                    const open = k?.status === 'requested';
                    const busy = authorized.busyId === u.id;
                    return (
                      <tr key={u.id}>
                        <td className={s.saTableStrong}>{u.fullName}</td>
                        <td>{u.email}</td>
                        <td>{u.accountType}</td>
                        <td>{u.companyName}</td>
                        <td><PlanChip id={u.plan} /></td>
                        <td>{fmtDate(u.approvedAt ?? u.createdAt)}</td>
                        <td>
                          {pill
                            ? <span className={`${s.saPill} ${s[pill.cls]}`}>{pill.label}</span>
                            : <span className={s.saDimText}>Not requested</span>}
                          {k && (
                            <div className={s.saKycMeta}>
                              {k.documents.length} document{k.documents.length === 1 ? '' : 's'}
                              {k.amount > 0 ? ` · ${k.currency} ${k.amount.toLocaleString('en-IN')}` : ''}
                              {k.dueDate ? ` · due ${k.dueDate}` : ''}
                              <br />
                              Docs {k.docsReceived ? '✓' : '✗'}
                              {k.amount > 0 ? ` · Payment ${k.paymentReceived ? '✓' : '✗'}` : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className={s.saRowActions}>
                            {open && k ? (
                              <>
                                {k.submittedAt && (
                                  <button className={`${s.saSignOutBtn} ${s.saBtnAccent}`} onClick={() => setReviewId(u.id)}>
                                    Review submission
                                  </button>
                                )}
                                {!k.submittedAt && (
                                  <span className={s.saDimText}>Waiting for the user to upload…</span>
                                )}
                                <button
                                  className={s.saSignOutBtn}
                                  disabled={busy}
                                  onClick={() => {
                                    if (window.confirm('Cancel this KYC request?')) {
                                      void authorized.updateRequest(u.id, k.id, { status: 'cancelled' });
                                    }
                                  }}
                                >
                                  <IconXCircle size={13} /> Cancel
                                </button>
                              </>
                            ) : (
                              <button className={s.saSignOutBtn} disabled={busy} onClick={() => openKycForm(u)}>
                                {k ? 'Request again' : 'Request KYC & payment'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'kyc' && (
          <div className={s.saPanel}>
            <p className={s.saPanelTitle}>KYC submissions awaiting review</p>
            {!admin.isLive && <p className={s.saNotice}>{liveNotice(admin.remoteError)}</p>}
            {admin.isLive && submittedUsers.length === 0 && (
              <p className={s.saEmptyNote}>Nothing to review. Submissions appear here after a user uploads documents and payment details.</p>
            )}
            {submittedUsers.length > 0 && (
              <table className={s.saTable}>
                <thead>
                  <tr><th>Company</th><th>Contact</th><th>Plan</th><th>Documents</th><th>Payment</th><th>Submitted</th><th></th></tr>
                </thead>
                <tbody>
                  {submittedUsers.map((u) => {
                    const k = u.kyc!;
                    return (
                      <tr key={u.id}>
                        <td className={s.saTableStrong}>{u.companyName}</td>
                        <td>{u.fullName}<div className={s.saKycMeta}>{u.email}</div></td>
                        <td><PlanChip id={u.plan} /></td>
                        <td>{k.files.length}/{k.documents.length}</td>
                        <td>
                          {k.amount > 0 ? formatINR(k.amount) : '—'}
                          {k.payment.reference && <div className={s.saKycMeta}>{k.payment.method} · {k.payment.reference}</div>}
                        </td>
                        <td>{fmtDate(k.submittedAt)}</td>
                        <td><button className={`${s.saSignOutBtn} ${s.saBtnAccent}`} onClick={() => setReviewId(u.id)}>Review</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'clients' && (
          <div className={s.saPanel}>
            <div className={s.saPanelHead}>
              <p className={s.saPanelTitle}>All clients</p>
              <div className={s.saSearch}>
                <IconSearch size={13} />
                <input
                  placeholder="Search by name or industry…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <table className={s.saTable}>
              <thead>
                <tr>
                  <th>Company</th><th>Industry</th><th>Employees</th><th>L2 Score</th>
                  <th>Status</th><th>Open Issues</th><th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c) => {
                  const meta = STATUS_META[c.status];
                  const openIssues = c.issues.filter((i) => !i.resolvedL2).length;
                  return (
                    <tr key={c.id}>
                      <td className={s.saTableStrong}>{c.name}</td>
                      <td>{c.industry}</td>
                      <td>{c.employeeCount}</td>
                      <td>{c.l2Score}</td>
                      <td><span className={`${s.saPill} ${s[meta.cls]}`}>{meta.icon} {meta.label}</span></td>
                      <td className={openIssues > 0 ? s.saWarnCell : undefined}>{openIssues}</td>
                      <td>{fmtDate(c.decidedAt ?? c.l2CompletedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'auditors' && (
          <div className={s.saPanel}>
            <p className={s.saPanelTitle}>Auditor roster &amp; workload</p>
            <table className={s.saTable}>
              <thead>
                <tr>
                  <th>Auditor</th><th>Specialization</th><th>Licence</th>
                  <th>In Review</th><th>Approved</th><th>Changes Req.</th><th>Rejected</th><th>Avg. Turnaround</th>
                </tr>
              </thead>
              <tbody>
                {overview.workload.map((w) => (
                  <tr key={w.auditor.id}>
                    <td className={s.saTableStrong}>{w.auditor.fullName}</td>
                    <td>{w.auditor.specialization}</td>
                    <td>{w.auditor.licenseId}</td>
                    <td>{w.assigned}</td>
                    <td>{w.approved}</td>
                    <td>{w.changesRequested}</td>
                    <td>{w.rejected}</td>
                    <td>{w.avgTurnaroundDays == null ? '—' : `${w.avgTurnaroundDays} days`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'activity' && (
          <div className={s.saPanel}>
            <p className={s.saPanelTitle}>Platform activity</p>
            <div className={s.saActivityList}>
              {admin.isLive && notifications.items.map((n) => (
                <div key={`live-${n.id}`} className={s.saActivityRow}>
                  <div className={s.saActivityMain}><strong>{n.title}</strong></div>
                  <div className={s.saActivityDetail}>{n.detail}</div>
                  <div className={s.saActivityTime}>{fmtDate(n.createdAt)}</div>
                </div>
              ))}
              {overview.recentActivity.map((entry) => (
                <div key={entry.id} className={s.saActivityRow}>
                  <div className={s.saActivityMain}>
                    <strong>{entry.actor}</strong>
                    <span className={s.saActivityRole}>{entry.actorRole}</span>
                    <span className={s.saActivityAction}>{entry.action}</span>
                  </div>
                  <div className={s.saActivityDetail}>{entry.detail}</div>
                  <div className={s.saActivityTime}>{fmtDate(entry.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── KYC requests tab ─────────────────────────────────────────── */}
      {/* (rendered above in <main>; see tab === 'kyc') */}

      {kycTarget && (() => {
        const plan = getPlan(kycTarget.plan);
        const amountNum = kycAmount.trim() === '' ? 0 : Number(kycAmount);
        return (
          <div className={s.saModalBackdrop} onClick={() => setKycTarget(null)}>
            <div className={`${s.saModal} ${s.saModalWide}`} role="dialog" aria-modal="true" aria-label="Request KYC and payment" onClick={(e) => e.stopPropagation()}>
              <div className={s.saModalHero}>
                <span className={s.saHeroIcon}><IconShieldCheck size={20} /></span>
                <div>
                  <h2 className={s.saHeroTitle}>Request KYC &amp; payment</h2>
                  <p className={s.saHeroSub}>{kycTarget.companyName} · {kycTarget.fullName} · {kycTarget.email}</p>
                </div>
                <button className={s.saHeroClose} onClick={() => setKycTarget(null)} aria-label="Close">×</button>
              </div>

              <div className={s.saModalBody}>
                {/* Plan the applicant chose */}
                <div className={s.saPlanCard}>
                  <div>
                    <span className={s.saMicro}>Selected plan</span>
                    <strong className={s.saPlanCardName}>{plan ? plan.name : 'No plan selected'}</strong>
                    {plan && <span className={s.saPlanCardMeta}>{headcountLabel(plan)}</span>}
                  </div>
                  <div className={s.saPlanCardPrice}>
                    {plan ? formatINR(plan.monthlyPrice) : '—'}<small>{plan ? '/month' : ''}</small>
                  </div>
                </div>

                {/* Documents as toggle chips */}
                <div className={s.saField}>
                  <div className={s.saFieldHead}>
                    <span className={s.saLabel}>Documents required</span>
                    <span className={s.saMicro}>{kycDocs.length} selected</span>
                  </div>
                  <div className={s.saChipGrid}>
                    {KYC_DOCUMENTS.map((d) => {
                      const on = kycDocs.includes(d);
                      return (
                        <button
                          key={d} type="button" aria-pressed={on}
                          className={on ? `${s.saChip} ${s.saChipOn}` : s.saChip}
                          onClick={() => setKycDocs((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}
                        >
                          <span className={s.saChipTick}>{on ? '✓' : '+'}</span>{d}
                        </button>
                      );
                    })}
                  </div>
                  <input className={s.saInput} placeholder="Add another document (optional)" value={kycOther} onChange={(e) => setKycOther(e.target.value)} />
                </div>

                <div className={s.saModalRow}>
                  <div className={s.saField}>
                    <label className={s.saLabel}>Payment amount (INR)</label>
                    <div className={s.saAmountWrap}>
                      <span>₹</span>
                      <input type="number" min="0" step="0.01" placeholder="0 = no payment" value={kycAmount} onChange={(e) => setKycAmount(e.target.value)} />
                    </div>
                    {plan && (
                      <div className={s.saQuickRow}>
                        <button type="button" className={s.saQuick} onClick={() => setKycAmount(String(plan.monthlyPrice))}>1 month · {formatINR(plan.monthlyPrice)}</button>
                        <button type="button" className={s.saQuick} onClick={() => setKycAmount(String(plan.monthlyPrice * 3))}>3 months · {formatINR(plan.monthlyPrice * 3)}</button>
                        <button type="button" className={s.saQuick} onClick={() => setKycAmount('')}>No payment</button>
                      </div>
                    )}
                  </div>
                  <div className={s.saField}>
                    <label className={s.saLabel}>Due date</label>
                    <input className={s.saInput} type="date" value={kycDue} onChange={(e) => setKycDue(e.target.value)} />
                  </div>
                </div>

                <div className={s.saField}>
                  <label className={s.saLabel}>Note to the user (optional)</label>
                  <textarea className={s.saInput} rows={2} value={kycNote} onChange={(e) => setKycNote(e.target.value)} placeholder="Shown in the email and on the upload page" />
                </div>

                <div className={s.saSummary}>
                  <span>The user will receive an email with a secure upload link for <strong>{kycDocs.length + (kycOther.trim() ? 1 : 0)}</strong> document(s)
                    {amountNum > 0 ? <> and a payment of <strong>{formatINR(amountNum)}</strong></> : null}.</span>
                </div>

                {(kycFormError || authorized.error) && <p className={s.saModalError}>{kycFormError || authorized.error}</p>}
              </div>

              <div className={s.saModalFooter}>
                <button className={s.saSignOutBtn} onClick={() => setKycTarget(null)}>Cancel</button>
                <button className={`${s.saSubmit} ${s.saSubmitWide}`} disabled={authorized.busyId === kycTarget.id} onClick={() => { void submitKycForm(); }}>
                  {authorized.busyId === kycTarget.id ? 'Sending…' : 'Send KYC request →'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── KYC review: everything the user submitted ─────────────────── */}
      {reviewUser && reviewUser.kyc && (() => {
        const k = reviewUser.kyc;
        const plan = getPlan(reviewUser.plan);
        const busy = authorized.busyId === reviewUser.id;
        const payOk = k.amount === 0 || k.paymentReceived;
        const canApprove = k.status === 'requested' && k.docsReceived && payOk;
        const missing = k.documents.filter((d) => !k.files.some((f) => f.label === d));
        return (
          <div className={s.saModalBackdrop} onClick={() => setReviewId(null)}>
            <div className={`${s.saModal} ${s.saModalXL}`} role="dialog" aria-modal="true" aria-label="Review KYC submission" onClick={(e) => e.stopPropagation()}>
              <div className={s.saModalHero}>
                <span className={s.saHeroIcon}><IconEye size={20} /></span>
                <div>
                  <h2 className={s.saHeroTitle}>KYC review · {reviewUser.companyName}</h2>
                  <p className={s.saHeroSub}>Submitted {fmtDate(k.submittedAt)} by {reviewUser.fullName} · {reviewUser.email}</p>
                </div>
                <button className={s.saHeroClose} onClick={() => setReviewId(null)} aria-label="Close">×</button>
              </div>

              <div className={s.saModalBody}>
                <div className={s.saReviewGrid}>
                  <div className={s.saReviewBox}>
                    <span className={s.saMicro}>Company</span>
                    <dl className={s.saDl}>
                      <dt>Company</dt><dd>{reviewUser.companyName}</dd>
                      <dt>Contact</dt><dd>{reviewUser.fullName}</dd>
                      <dt>Email</dt><dd>{reviewUser.email}</dd>
                      <dt>Industry</dt><dd>{reviewUser.industry}</dd>
                      <dt>GSTIN</dt><dd>{reviewUser.gstin || '—'}</dd>
                      <dt>Account type</dt><dd>{reviewUser.accountType}</dd>
                    </dl>
                  </div>
                  <div className={s.saReviewBox}>
                    <span className={s.saMicro}>Plan &amp; payment</span>
                    <dl className={s.saDl}>
                      <dt>Plan</dt><dd>{plan ? `${plan.name} · ${headcountLabel(plan)}` : '—'}</dd>
                      <dt>Plan price</dt><dd>{plan ? `${formatINR(plan.monthlyPrice)}/month` : '—'}</dd>
                      <dt>Amount requested</dt><dd>{k.amount > 0 ? formatINR(k.amount) : 'No payment'}</dd>
                      <dt>Method</dt><dd>{k.payment.method || '—'}</dd>
                      <dt>Reference / UTR</dt><dd className={s.saMono}>{k.payment.reference || '—'}</dd>
                      <dt>Paid on</dt><dd>{k.payment.paidOn ?? '—'}</dd>
                    </dl>
                    {k.payment.note && <p className={s.saReviewNote}>“{k.payment.note}”</p>}
                  </div>
                </div>

                <div className={s.saField}>
                  <div className={s.saFieldHead}>
                    <span className={s.saLabel}>Submitted documents ({k.files.length}/{k.documents.length})</span>
                    {reviewUser.zohoFolderUrl && (
                      <a className={s.saLinkBtn} href={reviewUser.zohoFolderUrl} target="_blank" rel="noreferrer">Open WorkDrive folder ↗</a>
                    )}
                  </div>
                  <ul className={s.saFileList}>
                    {k.documents.map((d) => {
                      const f = k.files.find((x) => x.label === d);
                      return (
                        <li key={d} className={f ? s.saFileRow : `${s.saFileRow} ${s.saFileMissing}`}>
                          <span className={s.saFileDot}>{f ? '✓' : '!'}</span>
                          <div className={s.saFileMain}>
                            <strong>{d}</strong>
                            <span>{f ? `${f.fileName} · ${fmtBytes(f.size)}` : 'Not uploaded'}</span>
                          </div>
                          {f?.url && <a className={s.saLinkBtn} href={f.url} target="_blank" rel="noreferrer">View ↗</a>}
                        </li>
                      );
                    })}
                  </ul>
                  {missing.length > 0 && <p className={s.saModalError}>Missing: {missing.join(', ')}</p>}
                </div>

                <div className={s.saVerifyRow}>
                  <label className={s.saCheckItem}>
                    <input
                      type="checkbox" checked={k.paymentReceived} disabled={busy || k.amount === 0}
                      onChange={() => { void authorized.updateRequest(reviewUser.id, k.id, { paymentReceived: !k.paymentReceived }); }}
                    />
                    {k.amount === 0 ? 'No payment required' : `I have confirmed the payment of ${formatINR(k.amount)} in the bank / UPI statement`}
                  </label>
                </div>
                {authorized.error && <p className={s.saModalError}>{authorized.error}</p>}
              </div>

              <div className={s.saModalFooter}>
                <button
                  className={s.saSignOutBtn} disabled={busy}
                  onClick={() => {
                    if (window.confirm('Reject this submission? The request is cancelled and you can request KYC again.')) {
                      void authorized.updateRequest(reviewUser.id, k.id, { status: 'cancelled' }).then((ok) => { if (ok) setReviewId(null); });
                    }
                  }}
                >
                  <IconXCircle size={13} /> Reject
                </button>
                <button
                  className={`${s.saSubmit} ${s.saSubmitWide}`}
                  disabled={busy || !canApprove}
                  title={canApprove ? 'Approve KYC and let the user sign in' : 'Confirm the payment first'}
                  onClick={() => {
                    void authorized.updateRequest(reviewUser.id, k.id, { status: 'verified' }).then((ok) => { if (ok) setReviewId(null); });
                  }}
                >
                  {busy ? 'Working…' : 'Approve KYC & activate →'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}