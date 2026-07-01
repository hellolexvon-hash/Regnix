/**
 * AuditorDashboard.tsx
 *
 * The content pane rendered inside the AuditorPage shell for every list-style
 * view: Overview, Review Queue, Approved, Changes Requested, Rejected, All
 * Companies. Filtering by status/view happens in the parent (AuditorPage);
 * this component renders stat cards + a searchable, sortable company grid.
 *
 * Zero inline styles — all from Auditor.module.css (.ad* classes).
 */

import { useMemo, useState } from 'react';
import s from './Auditor.module.css';
import type { CompanyReview, ReviewStatus } from './auditorStore';
import {
  IconInbox, IconEye, IconCheckCircle, IconFlag, IconSearch,
  IconClock, IconUndo, IconXCircle, IconEmptyBox,
} from './icons';

interface AuditorDashboardProps {
  viewTitle:    string;
  viewSub:      string;
  companies:    CompanyReview[];       // already filtered to this view
  allCompanies: CompanyReview[];       // full set, for the stat cards
  onOpen:       (id: string) => void;
}

type SortKey = 'recent' | 'score_asc' | 'score_desc' | 'name';

const STATUS_META: Record<ReviewStatus, { label: string; cls: string; icon: JSX.Element }> = {
  pending:            { label: 'Awaiting Review',   cls: 'adPillPending',  icon: <IconClock size={11} /> },
  in_review:          { label: 'In Review',          cls: 'adPillReview',   icon: <IconEye size={11} /> },
  approved:           { label: 'Approved',           cls: 'adPillApproved', icon: <IconCheckCircle size={11} /> },
  changes_requested:  { label: 'Changes Requested',  cls: 'adPillChanges',  icon: <IconUndo size={11} /> },
  rejected:           { label: 'Rejected',           cls: 'adPillRejected', icon: <IconXCircle size={11} /> },
};

function scoreClass(score: number): string {
  if (score >= 90) return 'adScoreHigh';
  if (score >= 75) return 'adScoreMid';
  return 'adScoreLow';
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) {
    const hrs = Math.floor(ms / 3600000);
    return hrs <= 0 ? 'just now' : `${hrs}h ago`;
  }
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export default function AuditorDashboard({
  viewTitle, viewSub, companies, allCompanies, onOpen,
}: AuditorDashboardProps) {
  const [query, setQuery]   = useState('');
  const [sort, setSort]     = useState<SortKey>('recent');

  const stats = useMemo(() => ({
    pending:  allCompanies.filter(c => c.status === 'pending').length,
    inReview: allCompanies.filter(c => c.status === 'in_review').length,
    approved: allCompanies.filter(c => c.status === 'approved').length,
    flagged:  allCompanies.filter(c => c.issues.some(i => !i.resolvedL2)).length,
  }), [allCompanies]);

  const filtered = useMemo(() => {
    let list = companies;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.actsCovered.some(a => a.toLowerCase().includes(q))
      );
    }
    const sorted = [...list];
    if (sort === 'recent')      sorted.sort((a, b) => b.l2CompletedAt.getTime() - a.l2CompletedAt.getTime());
    if (sort === 'score_desc')  sorted.sort((a, b) => b.l2Score - a.l2Score);
    if (sort === 'score_asc')   sorted.sort((a, b) => a.l2Score - b.l2Score);
    if (sort === 'name')        sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [companies, query, sort]);

  return (
    <div className={s.adPage}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className={s.adHeader}>
        <div>
          <h1 className={s.adTitle}>{viewTitle}</h1>
          <p className={s.adSub}>{viewSub}</p>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className={s.adStatRow}>
        <div className={s.adStatCard}>
          <span className={s.adStatIcon}><IconInbox size={17} /></span>
          <div>
            <span className={s.adStatNum}>{stats.pending}</span>
            <span className={s.adStatLabel}>Awaiting review</span>
          </div>
        </div>
        <div className={s.adStatCard}>
          <span className={s.adStatIcon}><IconEye size={17} /></span>
          <div>
            <span className={s.adStatNum}>{stats.inReview}</span>
            <span className={s.adStatLabel}>In review</span>
          </div>
        </div>
        <div className={s.adStatCard}>
          <span className={s.adStatIcon}><IconCheckCircle size={17} /></span>
          <div>
            <span className={s.adStatNum}>{stats.approved}</span>
            <span className={s.adStatLabel}>Approved</span>
          </div>
        </div>
        <div className={s.adStatCard}>
          <span className={s.adStatIcon}><IconFlag size={17} /></span>
          <div>
            <span className={s.adStatNum}>{stats.flagged}</span>
            <span className={s.adStatLabel}>With open issues</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className={s.adToolbar}>
        <div className={s.adSearch}>
          <IconSearch size={14} />
          <input
            placeholder="Search by company, industry, or act…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <select className={s.adSortSelect} value={sort} onChange={e => setSort(e.target.value as SortKey)}>
          <option value="recent">Sort: Most recent</option>
          <option value="score_desc">Sort: Score (high to low)</option>
          <option value="score_asc">Sort: Score (low to high)</option>
          <option value="name">Sort: Company name</option>
        </select>
        <span className={s.adCount}>{filtered.length} {filtered.length === 1 ? 'company' : 'companies'}</span>
      </div>

      {/* ── Company grid ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className={s.adEmpty}>
          <span className={s.adEmptyIcon}><IconEmptyBox size={30} /></span>
          <p className={s.adEmptyTitle}>Nothing here right now</p>
          <p className={s.adEmptySub}>
            {query ? 'No companies match your search.' : 'No companies fall into this view yet.'}
          </p>
        </div>
      ) : (
        <div className={s.adGrid}>
          {filtered.map(c => {
            const meta = STATUS_META[c.status];
            const openIssues = c.issues.filter(i => !i.resolvedL2).length;
            return (
              <button key={c.id} className={s.adCard} onClick={() => onOpen(c.id)}>
                <div className={s.adCardTop}>
                  <div className={s.adCardMark}>{c.name.charAt(0)}</div>
                  <div className={s.adCardHeadText}>
                    <span className={s.adCardName}>{c.name}</span>
                    <span className={s.adCardIndustry}>{c.industry} &middot; {c.employeeCount} employees</span>
                  </div>
                  <span className={`${s.adPill} ${s[meta.cls]}`}>{meta.icon} {meta.label}</span>
                </div>

                <div className={s.adCardActs}>
                  {c.actsCovered.map(act => (
                    <span key={act} className={s.adActChip}>{act}</span>
                  ))}
                </div>

                <div className={s.adCardMetrics}>
                  <div className={s.adMetric}>
                    <span className={`${s.adScoreRing} ${s[scoreClass(c.l2Score)]}`}>{c.l2Score}</span>
                    <span className={s.adMetricLabel}>L2 score</span>
                  </div>
                  <div className={s.adMetric}>
                    <span className={s.adMetricNum}>{c.docs.length}</span>
                    <span className={s.adMetricLabel}>Documents</span>
                  </div>
                  <div className={s.adMetric}>
                    <span className={openIssues > 0 ? `${s.adMetricNum} ${s.adMetricWarn}` : s.adMetricNum}>
                      {openIssues}
                    </span>
                    <span className={s.adMetricLabel}>Open issues</span>
                  </div>
                </div>

                <div className={s.adCardFoot}>
                  <span className={s.adCardTime}>Passed L2 {timeAgo(c.l2CompletedAt)}</span>
                  <span className={s.adCardCta}>
                    {c.status === 'approved' || c.status === 'rejected' || c.status === 'changes_requested'
                      ? 'View decision' : 'Review'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
