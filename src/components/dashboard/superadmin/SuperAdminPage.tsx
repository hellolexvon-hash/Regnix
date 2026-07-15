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
import { useSuperAdminAuth, useSystemOverview } from './superAdminStore';
import { useAuditorStore, type CompanyReview } from '../AuditorView/auditorStore';
import {
  IconShieldCheck, IconBuilding, IconUsers, IconAlertTriangle, IconCheckCircle,
  IconClock, IconEye, IconUndo, IconXCircle, IconLogOut, IconSearch, IconFlag,
} from '../AuditorView/icons';

type Tab = 'overview' | 'clients' | 'auditors' | 'activity';

const STATUS_META: Record<CompanyReview['status'], { label: string; icon: JSX.Element; cls: string }> = {
  pending:            { label: 'Awaiting Review',  icon: <IconClock size={12} />,         cls: 'saPillPending' },
  in_review:          { label: 'In Review',       icon: <IconEye size={12} />,           cls: 'saPillReview' },
  approved:           { label: 'Approved',        icon: <IconCheckCircle size={12} />,    cls: 'saPillApproved' },
  changes_requested:  { label: 'Changes Requested', icon: <IconUndo size={12} />,         cls: 'saPillChanges' },
  rejected:           { label: 'Rejected',        icon: <IconXCircle size={12} />,        cls: 'saPillRejected' },
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SuperAdminPage() {
  const admin = useSuperAdminAuth();
  const overview = useSystemOverview();
  const { companies } = useAuditorStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');

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
    </div>
  );
}