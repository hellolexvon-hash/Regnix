/**
 * AuditorCommandCenter.tsx
 *
 * "Command Center" nav item — a single-screen executive view of the entire
 * L3 audit portfolio, sitting alongside (not replacing) the existing list
 * views in AuditorPage.tsx. Everything here is derived from the same
 * CompanyReview[] / Auditor[] the rest of the portal already uses — no new
 * fields on the store, no new mock endpoints.
 *
 * Covers four of the "Audit Intelligence Command Center" building blocks:
 *   1. Executive health cards   — portfolio-wide counts, color-coded
 *   2. Executive risk matrix    — risk level × industry heatmap, click a
 *                                 cell to drill into the companies inside it,
 *                                 then straight into the full review
 *   3. Compliance funnel        — L2 pass → claimed → decided → approved →
 *                                 audit-ready, with drop-off at each stage
 *   4. Monthly trend            — a lightweight trend line for average score
 *                                 and open issues over the last 6 months
 *
 * The monthly trend has no real historical rows to read from (this build has
 * a single snapshot per company, not a time series), so it is reconstructed
 * deterministically — seeded off portfolio state so it's stable across
 * re-renders — and converges on today's real numbers at the last point. Swap
 * useMonthlyTrend() for a real `GET /api/auditor/history` call once monthly
 * snapshots exist server-side; every value it returns is already the shape
 * the chart expects.
 *
 * Zero inline styles — all from Auditor.module.css (.cc* classes).
 */

import { useMemo, useState } from 'react';
import s from './Auditor.module.css';
import type { Auditor, CompanyReview } from './auditorStore';
import {
  IconFolder, IconInbox, IconEye, IconCheckCircle, IconUndo, IconXCircle,
  IconAlertTriangle, IconFlag, IconShieldCheck, IconUsers, IconListChecks,
  IconFileText, IconChevronRight, IconEmptyBox,
} from './icons';

interface AuditorCommandCenterProps {
  companies: CompanyReview[];
  auditors:  Auditor[];
  onOpenCompany: (id: string) => void;
}

// ── Risk model ───────────────────────────────────────────────────────────────
// Derived from the same score + issue data every other screen already shows;
// no new fields required on CompanyReview.

type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

const RISK_ORDER: RiskLevel[] = ['critical', 'high', 'medium', 'low'];

const RISK_META: Record<RiskLevel, { label: string; cellCls: string; badgeCls: string }> = {
  critical: { label: 'Critical', cellCls: 'ccCellCritical', badgeCls: 'ccBadgeCritical' },
  high:     { label: 'High',     cellCls: 'ccCellHigh',     badgeCls: 'ccBadgeHigh' },
  medium:   { label: 'Medium',   cellCls: 'ccCellMedium',   badgeCls: 'ccBadgeMedium' },
  low:      { label: 'Low',      cellCls: 'ccCellLow',      badgeCls: 'ccBadgeLow' },
};

function getRiskLevel(c: CompanyReview): RiskLevel {
  const openCritical = c.issues.some(i => i.severity === 'critical' && !i.resolvedL2);
  const openMajor = c.issues.some(i => i.severity === 'major' && !i.resolvedL2);
  if (openCritical) return 'critical';
  if (openMajor || c.l2Score < 85) return 'high';
  if (c.l2Score < 95) return 'medium';
  return 'low';
}

// ── Small deterministic PRNG (mirrors the one in mockFiles.ts) for the
//    synthetic monthly trend — seeded, not random, so it's stable per render.
function seedFromString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function last6MonthLabels(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(MONTH_NAMES[d.getMonth()]);
  }
  return out;
}

interface TrendPoint { month: string; score: number; issues: number; }

function useMonthlyTrend(companies: CompanyReview[], avgScore: number, openIssues: number): TrendPoint[] {
  return useMemo(() => {
    const rng = mulberry32(seedFromString(companies.map(c => c.id).join('|') + avgScore));
    const months = last6MonthLabels();
    let score = Math.max(55, avgScore - 10 - rng() * 6);
    let issues = openIssues + 6 + Math.floor(rng() * 5);
    return months.map((month, i) => {
      const isLast = i === months.length - 1;
      if (isLast) {
        score = avgScore;
        issues = openIssues;
      } else {
        score = Math.min(avgScore, score + rng() * 3.2);
        issues = Math.max(openIssues, issues - Math.floor(rng() * 2));
      }
      return { month, score: Math.round(score), issues: Math.round(issues) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.length, avgScore, openIssues]);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AuditorCommandCenter({ companies, auditors, onOpenCompany }: AuditorCommandCenterProps) {
  const [selectedCell, setSelectedCell] = useState<{ risk: RiskLevel; industry: string } | null>(null);

  const auditorName = (id: string | null) =>
    id ? (auditors.find(a => a.id === id)?.fullName ?? 'Unknown auditor') : 'Unclaimed';

  // ── Health card metrics ─────────────────────────────────────────────────
  const m = useMemo(() => {
    const total = companies.length;
    const pending = companies.filter(c => c.status === 'pending').length;
    const inReview = companies.filter(c => c.status === 'in_review').length;
    const approved = companies.filter(c => c.status === 'approved').length;
    const changesRequested = companies.filter(c => c.status === 'changes_requested').length;
    const rejected = companies.filter(c => c.status === 'rejected').length;
    const decided = approved + changesRequested + rejected;
    const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : 0;
    const avgScore = total > 0 ? Math.round(companies.reduce((a, c) => a + c.l2Score, 0) / total) : 0;
    const criticalCompanies = companies.filter(c => getRiskLevel(c) === 'critical').length;
    const highRiskCompanies = companies.filter(c => getRiskLevel(c) === 'high').length;
    const totalEmployees = companies.reduce((a, c) => a + c.employeeCount, 0);
    const openIssues = companies.reduce((a, c) => a + c.issues.filter(i => !i.resolvedL2).length, 0);
    const totalDocs = companies.reduce((a, c) => a + c.docs.length, 0);
    const flaggedDocs = companies.reduce((a, c) => a + c.docs.filter(d => d.status === 'flagged').length, 0);
    const auditReady = companies.filter(c => c.status === 'approved' && c.issues.every(i => i.resolvedL2)).length;
    return {
      total, pending, inReview, approved, changesRequested, rejected, decided,
      approvalRate, avgScore, criticalCompanies, highRiskCompanies, totalEmployees,
      openIssues, totalDocs, flaggedDocs, auditReady,
    };
  }, [companies]);

  type Tone = 'green' | 'amber' | 'red' | 'neutral';
  const cards: { label: string; value: string; tone: Tone; icon: JSX.Element }[] = [
    { label: 'Companies in L3 queue',   value: String(m.total),                  tone: 'neutral', icon: <IconFolder size={17} /> },
    { label: 'Awaiting review',         value: String(m.pending),                tone: m.pending > 0 ? 'amber' : 'green', icon: <IconInbox size={17} /> },
    { label: 'In review',               value: String(m.inReview),               tone: 'neutral', icon: <IconEye size={17} /> },
    { label: 'Audit ready',             value: String(m.auditReady),             tone: 'green',    icon: <IconShieldCheck size={17} /> },
    { label: 'Changes requested',       value: String(m.changesRequested),       tone: m.changesRequested > 0 ? 'amber' : 'green', icon: <IconUndo size={17} /> },
    { label: 'Rejected',                value: String(m.rejected),               tone: m.rejected > 0 ? 'red' : 'green', icon: <IconXCircle size={17} /> },
    { label: 'Critical companies',      value: String(m.criticalCompanies),      tone: m.criticalCompanies > 0 ? 'red' : 'green', icon: <IconAlertTriangle size={17} /> },
    { label: 'High risk companies',     value: String(m.highRiskCompanies),      tone: m.highRiskCompanies > 0 ? 'amber' : 'green', icon: <IconFlag size={17} /> },
    { label: 'Avg. L2 score',           value: String(m.avgScore),               tone: m.avgScore >= 90 ? 'green' : m.avgScore >= 80 ? 'amber' : 'red', icon: <IconCheckCircle size={17} /> },
    { label: 'Approval rate',           value: `${m.approvalRate}%`,             tone: m.approvalRate >= 90 ? 'green' : m.approvalRate >= 70 ? 'amber' : 'red', icon: <IconListChecks size={17} /> },
    { label: 'Employees covered',       value: m.totalEmployees.toLocaleString('en-IN'), tone: 'neutral', icon: <IconUsers size={17} /> },
    { label: 'Open issues',             value: String(m.openIssues),             tone: m.openIssues > 0 ? 'red' : 'green', icon: <IconAlertTriangle size={17} /> },
  ];

  // ── Risk × industry matrix ──────────────────────────────────────────────
  const industries = useMemo(
    () => Array.from(new Set(companies.map(c => c.industry))).sort(),
    [companies],
  );

  const matrix = useMemo(() => {
    const grid = new Map<string, CompanyReview[]>();
    for (const c of companies) {
      const key = `${getRiskLevel(c)}::${c.industry}`;
      const arr = grid.get(key) ?? [];
      arr.push(c);
      grid.set(key, arr);
    }
    return grid;
  }, [companies]);

  const maxCellCount = useMemo(() => {
    let max = 1;
    matrix.forEach(arr => { if (arr.length > max) max = arr.length; });
    return max;
  }, [matrix]);

  function cellIntensityCls(count: number): string {
    if (count === 0) return 'ccCellEmpty';
    const ratio = count / maxCellCount;
    if (ratio > 0.66) return 'ccCellStrong';
    if (ratio > 0.33) return 'ccCellMid';
    return 'ccCellSoft';
  }

  const drillCompanies = selectedCell
    ? matrix.get(`${selectedCell.risk}::${selectedCell.industry}`) ?? []
    : [];

  // ── Compliance funnel ────────────────────────────────────────────────────
  const funnelStages = [
    { label: 'Passed Level 2',              value: m.total },
    { label: 'Claimed by an auditor',       value: m.total - m.pending },
    { label: 'Decision made',               value: m.decided },
    { label: 'Approved',                    value: m.approved },
    { label: 'Audit ready (no open issues)',value: m.auditReady },
  ];
  const funnelBase = funnelStages[0].value || 1;

  // ── Monthly trend ────────────────────────────────────────────────────────
  const trend = useMonthlyTrend(companies, m.avgScore, m.openIssues);
  const trendMinScore = Math.min(...trend.map(t => t.score)) - 4;
  const trendMaxScore = Math.max(...trend.map(t => t.score)) + 4;
  const trendMaxIssues = Math.max(...trend.map(t => t.issues), 1);

  const chartW = 640, chartH = 150, chartPad = 24;
  const stepX = (chartW - chartPad * 2) / (trend.length - 1);
  const scoreY = (score: number) =>
    chartH - chartPad - ((score - trendMinScore) / (trendMaxScore - trendMinScore || 1)) * (chartH - chartPad * 2);
  const linePoints = trend.map((t, i) => `${chartPad + i * stepX},${scoreY(t.score)}`).join(' ');

  return (
    <div className={s.ccPage}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={s.adHeader}>
        <div>
          <h1 className={s.adTitle}>Command Center</h1>
          <p className={s.adSub}>One screen. Portfolio health, risk, funnel, and trend — no navigation required.</p>
        </div>
      </div>

      {/* ── 1. Executive health cards ─────────────────────────────────── */}
      <div className={s.ccCardGrid}>
        {cards.map(card => (
          <div key={card.label} className={`${s.ccCard} ${s[`ccTone${capitalize(card.tone)}`]}`}>
            <span className={s.ccCardIcon}>{card.icon}</span>
            <div>
              <span className={s.ccCardNum}>{card.value}</span>
              <span className={s.ccCardLabel}>{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={s.ccRow2}>

        {/* ── 2. Executive risk matrix ────────────────────────────────── */}
        <div className={s.ccPanel}>
          <div className={s.ccPanelHead}>
            <h2 className={s.ccPanelTitle}>Executive Risk Matrix</h2>
            <p className={s.ccPanelSub}>Risk level by industry. Click a cell to see the companies inside it.</p>
          </div>

          {companies.length === 0 ? (
            <div className={s.adEmpty}>
              <span className={s.adEmptyIcon}><IconEmptyBox size={26} /></span>
              <p className={s.adEmptyTitle}>No companies in the portfolio yet</p>
            </div>
          ) : (
            <div className={s.ccMatrixScroll}>
              <table className={s.ccMatrixTable}>
                <thead>
                  <tr>
                    <th className={s.ccMatrixCorner}></th>
                    {industries.map(ind => (
                      <th key={ind} className={s.ccMatrixColHead}>{ind}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RISK_ORDER.map(risk => (
                    <tr key={risk}>
                      <th className={s.ccMatrixRowHead}>
                        <span className={`${s.ccBadge} ${s[RISK_META[risk].badgeCls]}`}>{RISK_META[risk].label}</span>
                      </th>
                      {industries.map(ind => {
                        const count = matrix.get(`${risk}::${ind}`)?.length ?? 0;
                        const isSelected = selectedCell?.risk === risk && selectedCell?.industry === ind;
                        return (
                          <td key={ind} className={s.ccMatrixCellWrap}>
                            <button
                              className={[
                                s.ccMatrixCell,
                                s[cellIntensityCls(count)],
                                isSelected ? s.ccMatrixCellSelected : '',
                              ].join(' ')}
                              disabled={count === 0}
                              onClick={() => setSelectedCell(isSelected ? null : { risk, industry: ind })}
                            >
                              {count > 0 ? count : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Drill-down: cell → companies → issue / document / owner */}
          {selectedCell && (
            <div className={s.ccDrill}>
              <div className={s.ccDrillHead}>
                <span className={`${s.ccBadge} ${s[RISK_META[selectedCell.risk].badgeCls]}`}>
                  {RISK_META[selectedCell.risk].label}
                </span>
                <span className={s.ccDrillHeadText}>{selectedCell.industry} &middot; {drillCompanies.length} {drillCompanies.length === 1 ? 'company' : 'companies'}</span>
                <button className={s.ccDrillClose} onClick={() => setSelectedCell(null)}>Close</button>
              </div>

              <div className={s.ccDrillList}>
                {drillCompanies.map(c => {
                  const openIssues = c.issues.filter(i => !i.resolvedL2);
                  return (
                    <button key={c.id} className={s.ccDrillCard} onClick={() => onOpenCompany(c.id)}>
                      <div className={s.ccDrillCardTop}>
                        <span className={s.ccDrillName}>{c.name}</span>
                        <span className={s.ccDrillOwner}>Owner: {auditorName(c.assignedTo)}</span>
                      </div>
                      <div className={s.ccDrillMeta}>
                        {c.employeeCount} employees &middot; L2 score {c.l2Score} &middot; {c.docs.length} documents
                      </div>
                      {openIssues.length > 0 ? (
                        <div className={s.ccDrillIssues}>
                          {openIssues.map(issue => (
                            <span key={issue.id} className={s.ccDrillIssueChip}>
                              <IconFileText size={11} /> {issue.docName} — {issue.rule}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className={s.ccDrillNoIssues}>No open issues.</div>
                      )}
                      <span className={s.ccDrillCta}>Open full review <IconChevronRight size={12} /></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Compliance funnel ────────────────────────────────────── */}
        <div className={s.ccPanel}>
          <div className={s.ccPanelHead}>
            <h2 className={s.ccPanelTitle}>Compliance Funnel</h2>
            <p className={s.ccPanelSub}>Where the portfolio drops off between L2 and audit-ready.</p>
          </div>

          <div className={s.ccFunnel}>
            {funnelStages.map((stage, i) => {
              const pct = funnelBase > 0 ? Math.round((stage.value / funnelBase) * 100) : 0;
              const prev = i > 0 ? funnelStages[i - 1].value : stage.value;
              const drop = prev - stage.value;
              return (
                <div key={stage.label} className={s.ccFunnelStage}>
                  <div className={s.ccFunnelBarTrack}>
                    {/* Width is per-render data (funnel stage %), not a style choice — same
                        pattern as icons.tsx's spinner animation, the codebase's one other
                        deliberate use of an inline style for a genuinely dynamic value. */}
                    <div className={s.ccFunnelBarFill} style={{ width: `${Math.max(pct, 4)}%` }}>
                      <span className={s.ccFunnelCount}>{stage.value}</span>
                    </div>
                  </div>
                  <div className={s.ccFunnelMeta}>
                    <span className={s.ccFunnelLabel}>{stage.label}</span>
                    <span className={s.ccFunnelPct}>
                      {pct}%{i > 0 && drop > 0 ? ` · −${drop} from prior stage` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4. Monthly trend ────────────────────────────────────────────── */}
      <div className={s.ccPanel}>
        <div className={s.ccPanelHead}>
          <h2 className={s.ccPanelTitle}>Monthly Compliance Trend</h2>
          <p className={s.ccPanelSub}>
            Average L2 score and open issues across the portfolio. Earlier months are reconstructed for
            trend context — this build has one live snapshot per company, not month-over-month history yet.
          </p>
        </div>

        <div className={s.ccTimelineWrap}>
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className={s.ccTimelineSvg} preserveAspectRatio="none">
            {/* baseline */}
            <line x1={chartPad} y1={chartH - chartPad} x2={chartW - chartPad} y2={chartH - chartPad} className={s.ccTimelineAxis} />
            {/* issue bars */}
            {trend.map((t, i) => {
              const barH = (t.issues / trendMaxIssues) * (chartH - chartPad * 2) * 0.5;
              return (
                <rect
                  key={`bar-${t.month}-${i}`}
                  x={chartPad + i * stepX - 9}
                  y={chartH - chartPad - barH}
                  width={18}
                  height={barH}
                  rx={3}
                  className={s.ccTimelineBar}
                />
              );
            })}
            {/* score line */}
            <polyline points={linePoints} className={s.ccTimelineLine} fill="none" />
            {trend.map((t, i) => (
              <circle key={`pt-${t.month}-${i}`} cx={chartPad + i * stepX} cy={scoreY(t.score)} r={3.5} className={s.ccTimelineDot} />
            ))}
          </svg>
          <div className={s.ccTimelineXAxis}>
            {trend.map((t, i) => (
              <span key={`lbl-${t.month}-${i}`} className={s.ccTimelineXLabel}>{t.month}</span>
            ))}
          </div>
        </div>

        <div className={s.ccTimelineLegend}>
          <span className={s.ccLegendItem}><span className={`${s.ccLegendDot} ${s.ccLegendDotScore}`} /> Avg. L2 score</span>
          <span className={s.ccLegendItem}><span className={`${s.ccLegendDot} ${s.ccLegendDotIssues}`} /> Open issues</span>
        </div>
      </div>
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}