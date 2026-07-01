/**
 * AuditorPage.tsx
 *
 * Top-level orchestrator for the Auditor Portal. Mount this anywhere in the
 * host app, e.g.:
 *
 *   <Route path="/auditor/*" element={<AuditorPage />} />
 *
 * Behaviour:
 *   - Not signed in  → renders AuditorAuth (sign in / sign up)
 *   - Signed in      → renders the shell (topbar + sidebar) with either the
 *                       queue/dashboard list view or a single company's
 *                       AuditorCompanyReview, based on internal state.
 *
 * This component manages its own view state rather than depending on
 * react-router, so it can be dropped into any route. If you want deep-linkable
 * URLs (e.g. /auditor/company/c3), swap the useState<View> below for
 * useNavigate/useParams the same way ValidationPage.tsx does — the render
 * branches are already structured to make that a drop-in change.
 */

import { useMemo, useState } from 'react';
import s from './Auditor.module.css';
import AuditorAuth from './AuditorAuth';
import AuditorDashboard from './AuditorDashboard';
import AuditorCompanyReview from './AuditorCompanyReview';
import { useAuditorStore, type ReviewStatus } from './auditorStore';
import {
  IconScale, IconHome, IconInbox, IconEye, IconCheckCircle, IconUndo,
  IconXCircle, IconFolder, IconShieldCheck, IconBell, IconChevronDown, IconLogOut,
} from './icons';

type NavKey = 'overview' | 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected' | 'all';

const NAV_ITEMS: { key: NavKey; label: string; icon: JSX.Element }[] = [
  { key: 'overview',           label: 'Overview',          icon: <IconHome size={15} /> },
  { key: 'pending',            label: 'Review Queue',      icon: <IconInbox size={15} /> },
  { key: 'in_review',          label: 'In Review',         icon: <IconEye size={15} /> },
  { key: 'approved',           label: 'Approved',          icon: <IconCheckCircle size={15} /> },
  { key: 'changes_requested',  label: 'Changes Requested', icon: <IconUndo size={15} /> },
  { key: 'rejected',           label: 'Rejected',          icon: <IconXCircle size={15} /> },
  { key: 'all',                label: 'All Companies',     icon: <IconFolder size={15} /> },
];

const VIEW_COPY: Record<NavKey, { title: string; sub: string }> = {
  overview:          { title: 'Overview',          sub: 'Everything on your desk, at a glance.' },
  pending:           { title: 'Review Queue',       sub: 'Companies that passed Level 2 and are waiting to be claimed.' },
  in_review:         { title: 'In Review',          sub: 'Companies you are currently reviewing.' },
  approved:          { title: 'Approved',           sub: 'Companies you have signed off on.' },
  changes_requested: { title: 'Changes Requested',  sub: 'Sent back to the company for corrections.' },
  rejected:          { title: 'Rejected',           sub: 'Submissions that did not pass audit review.' },
  all:               { title: 'All Companies',      sub: 'Every company that has reached Level 3, regardless of status.' },
};

function filterByNav(companies: ReturnType<typeof useAuditorStore>['companies'], nav: NavKey, auditorId: string) {
  if (nav === 'overview') {
    return companies.filter(c => c.status === 'pending' || (c.status === 'in_review' && c.assignedTo === auditorId));
  }
  if (nav === 'all') return companies;
  return companies.filter(c => c.status === (nav as ReviewStatus));
}

export default function AuditorPage() {
  const store = useAuditorStore();
  const [nav, setNav]         = useState<NavKey>('overview');
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const auditor = store.currentAuditor;

  const navCounts = useMemo(() => {
    const c = store.companies;
    return {
      overview:           c.filter(x => x.status === 'pending' || (x.status === 'in_review' && x.assignedTo === auditor?.id)).length,
      pending:            c.filter(x => x.status === 'pending').length,
      in_review:          c.filter(x => x.status === 'in_review').length,
      approved:           c.filter(x => x.status === 'approved').length,
      changes_requested:  c.filter(x => x.status === 'changes_requested').length,
      rejected:           c.filter(x => x.status === 'rejected').length,
      all:                c.length,
    } as Record<NavKey, number>;
  }, [store.companies, auditor?.id]);

  if (!auditor) {
    return <AuditorAuth onAuthenticated={() => setNav('overview')} />;
  }

  const openCompany = openCompanyId ? store.companies.find(c => c.id === openCompanyId) ?? null : null;
  const listForView = filterByNav(store.companies, nav, auditor.id);
  const copy = VIEW_COPY[nav];

  function goToNav(key: NavKey) {
    setNav(key);
    setOpenCompanyId(null);
  }

  function handleSignOut() {
    store.signOut();
    setOpenCompanyId(null);
    setNav('overview');
  }

  return (
    <div className={s.shell}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={s.sidebar}>
        <div className={s.sidebarBrand}>
          <span className={s.sidebarBrandMark}><IconScale size={15} /></span>
          <span className={s.sidebarBrandText}>Regnix <strong>Audit</strong></span>
        </div>

        <nav className={s.sidebarNav}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={nav === item.key && !openCompany ? `${s.sidebarNavItem} ${s.sidebarNavItemActive}` : s.sidebarNavItem}
              onClick={() => goToNav(item.key)}
            >
              <span className={s.sidebarNavIcon}>{item.icon}</span>
              <span className={s.sidebarNavLabel}>{item.label}</span>
              {navCounts[item.key] > 0 && (
                <span className={s.sidebarNavBadge}>{navCounts[item.key]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={s.sidebarFoot}>
          <div className={s.sidebarFootCard}>
            <span className={s.sidebarFootIcon}><IconShieldCheck size={16} /></span>
            <div>
              <p className={s.sidebarFootTitle}>Independent review</p>
              <p className={s.sidebarFootSub}>Decisions here are final and cannot be edited by the company.</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className={s.mainCol}>

        {/* Topbar */}
        <header className={s.topbar}>
          <span className={s.topbarTitle}>
            {openCompany ? 'Company Review' : copy.title}
          </span>

          <div className={s.topbarRight}>
            <button className={s.topbarIconBtn} title="Notifications"><IconBell size={15} /></button>

            <div className={s.topbarProfile}>
              <button className={s.topbarProfileBtn} onClick={() => setMenuOpen(o => !o)}>
                <span className={s.topbarAvatar}>{auditor.fullName.charAt(0)}</span>
                <span className={s.topbarProfileText}>
                  <span className={s.topbarProfileName}>{auditor.fullName}</span>
                  <span className={s.topbarProfileSpec}>{auditor.specialization}</span>
                </span>
                <span className={s.topbarCaret}><IconChevronDown size={12} /></span>
              </button>

              {menuOpen && (
                <div className={s.topbarMenu}>
                  <div className={s.topbarMenuHead}>
                    <span className={s.topbarMenuName}>{auditor.fullName}</span>
                    <span className={s.topbarMenuEmail}>{auditor.email}</span>
                    <span className={s.topbarMenuLicense}>Licence {auditor.licenseId}</span>
                  </div>
                  <button className={s.topbarMenuItem} onClick={handleSignOut}>
                    <IconLogOut size={13} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={s.contentArea}>
          {openCompany ? (
            <AuditorCompanyReview
              company={openCompany}
              auditor={auditor}
              onBack={() => setOpenCompanyId(null)}
              onClaim={id => store.claimCompany(id)}
              onDecide={(id, decision, remarks) => store.decide(id, decision, remarks)}
            />
          ) : (
            <AuditorDashboard
              viewTitle={copy.title}
              viewSub={copy.sub}
              companies={listForView}
              allCompanies={store.companies}
              onOpen={id => setOpenCompanyId(id)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
