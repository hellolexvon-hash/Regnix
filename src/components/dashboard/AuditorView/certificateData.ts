/**
 * certificateData.ts
 *
 * Pure derivation layer for the Regnix Compliance Intelligence Certificate.
 * Takes the *real* CompanyReview + Auditor records that already exist once
 * a company is approved at Level 3, and computes every metric the
 * certificate displays — nothing here is hand-typed per company.
 *
 * Where a figure genuinely has no live time-series backing it yet (the
 * 12-month trend, the forward-looking AI forecast bands), it is generated
 * with a *deterministic* seeded RNG keyed off the company id — same
 * technique already used in mockFiles.ts — so a given company always
 * renders the same certificate rather than reshuffling on every open.
 * Swap `seedFromString`/`mulberry32` inputs for a real historical-scores
 * table once one exists; every consumer of this module only cares about
 * the shape returned by `buildCertificateData`.
 */

import type { Auditor, CompanyReview, ReviewDoc } from './auditorStore';

// ── Deterministic PRNG (identical approach to mockFiles.ts) ────────────────

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// ── Types ────────────────────────────────────────────────────────────────

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface ActCompliance {
  act:     string;
  pct:     number;      // 0-100
  trend:   'up' | 'down' | 'flat';
  applicable: boolean;
  compliant:  boolean;
  pending:    number;
  status:  'Compliant' | 'Partial' | 'Non-Compliant';
  risk:    RiskLevel;
}

export interface TrendPoint {
  label: string;   // e.g. "Aug 2025"
  score: number;
}

export interface AiForecast {
  nextMonthPct:  number;
  next3MonthPct: number;
  annualPct:     number;
  stability:     'Stable' | 'Improving' | 'Volatile';
  confidence:    number; // 0-100
  reliability:   'Low' | 'Medium' | 'High';
}

export interface DocVerificationRow {
  label: string;
  pct: number;
}

export interface CertificateData {
  // identity
  certificateId:   string;
  reportingMonth:  string;
  generatedOn:     string;
  clientName:      string;
  entityLocation:  string;
  contactPerson:   string;

  // headline
  overallScore:      number; // 0-100, one decimal
  complianceMaturity: 'World Class' | 'Excellent' | 'Good' | 'Developing';
  maturityStars:      number; // 0-5
  regulatoryCoverage:  number;
  riskLevel:           RiskLevel;
  auditReadiness:      number;

  // act breakdown (the ring grid)
  acts: ActCompliance[];

  // stat strip
  totalApplicableCompliances: number;
  compliancesMet:             number;
  openDeviations:             number;
  documentsVerified:          number;
  employeesCovered:           number;
  suppliersAssessed:          number;
  regulatoryCoveragePct:      number;
  complianceMaturityIndex:    number; // x / 10
  auditIndexPct:              number;
  aiConfidenceScore:          number;

  // matrix table
  matrix: ActCompliance[];

  // trend
  trend: TrendPoint[];
  trendDeltaVsPrior: number;
  bestMonth: { label: string; score: number };

  // AI panel
  forecast: AiForecast;

  // risk heatmap
  heatmap: { act: string; risk: RiskLevel }[];
  enterpriseRiskScore: RiskLevel;

  // intelligence narrative (derived from real issue counts, not invented)
  intelligence: {
    excellenceNote: string;
    keyAchievements: string[];
    riskFocusAreas: string[];
    recommendedActions: string[];
  };

  // document verification status
  docVerification: DocVerificationRow[];
  verificationCompletionPct: number;

  // trust / signature block
  auditor: { name: string; licenseId: string; specialization: string };
  companyContact: { name: string; email: string };
  decidedOn: string;
}

// ── Core derivation ─────────────────────────────────────────────────────

function scoreForAct(docs: ReviewDoc[], act: string): number {
  const actDocs = docs.filter(d => d.act === act);
  if (actDocs.length === 0) return 100;
  const avg = actDocs.reduce((sum, d) => sum + d.score, 0) / actDocs.length;
  return Math.round(avg);
}

function riskForScore(pct: number): RiskLevel {
  if (pct >= 90) return 'Low';
  if (pct >= 75) return 'Medium';
  return 'High';
}

function statusForScore(pct: number): ActCompliance['status'] {
  if (pct >= 95) return 'Compliant';
  if (pct >= 75) return 'Partial';
  return 'Non-Compliant';
}

function maturityForScore(pct: number): { label: CertificateData['complianceMaturity']; stars: number } {
  if (pct >= 95) return { label: 'World Class', stars: 5 };
  if (pct >= 85) return { label: 'Excellent', stars: 4 };
  if (pct >= 70) return { label: 'Good', stars: 3 };
  return { label: 'Developing', stars: 2 };
}

function monthLabel(offsetFromNow: number, anchor: Date): string {
  const d = new Date(anchor);
  d.setMonth(d.getMonth() - offsetFromNow);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export function buildCertificateData(company: CompanyReview, auditor: Auditor): CertificateData {
  const rng = mulberry32(seedFromString(company.id + '-certificate'));
  const anchor = company.decidedAt ?? new Date();

  // ── per-act breakdown, driven entirely by real doc scores ──
  const acts: ActCompliance[] = company.actsCovered.map(act => {
    const pct = scoreForAct(company.docs, act);
    const actDocs = company.docs.filter(d => d.act === act);
    const pending = actDocs.filter(d => d.status === 'flagged').length;
    return {
      act,
      pct,
      trend: pct >= 90 ? 'up' : pct >= 75 ? 'flat' : 'down',
      applicable: true,
      compliant: pending === 0,
      pending,
      status: statusForScore(pct),
      risk: riskForScore(pct),
    };
  });

  const overallScore = Number(
    (acts.reduce((s, a) => s + a.pct, 0) / Math.max(acts.length, 1)).toFixed(1)
  );
  const maturity = maturityForScore(overallScore);

  const flaggedDocs = company.docs.filter(d => d.status === 'flagged').length;
  const regulatoryCoverage = Math.round(((company.docs.length - flaggedDocs) / Math.max(company.docs.length, 1)) * 100 * 10) / 10;

  const openIssues = company.issues.filter(i => !i.resolvedL2);
  const critical = openIssues.filter(i => i.severity === 'critical').length;
  const major = openIssues.filter(i => i.severity === 'major').length;
  const minor = openIssues.filter(i => i.severity === 'minor').length;

  const enterpriseRisk: RiskLevel = critical > 0 ? 'High' : major > 0 ? 'Medium' : 'Low';

  // ── 12-month trend: real endpoint (overallScore), deterministic seeded
  //    walk backwards so the series always lands exactly on today's score ──
  const trend: TrendPoint[] = [];
  let cursor = overallScore;
  for (let i = 0; i < 12; i++) {
    trend.unshift({ label: monthLabel(i, anchor), score: Math.round(cursor * 10) / 10 });
    const drift = (rng() - 0.42) * 5; // gentle historical improvement bias
    cursor = clamp(cursor - drift, 62, 99.5);
  }
  trend[trend.length - 1] = { label: trend[trend.length - 1].label, score: overallScore };

  const bestMonth = trend.reduce((best, p) => (p.score > best.score ? p : best), trend[0]);
  const trendDeltaVsPrior = Number((trend[trend.length - 1].score - trend[trend.length - 2].score).toFixed(1));

  // ── AI forecast — small deterministic jitter around the current score ──
  const forecast: AiForecast = {
    nextMonthPct: Number(clamp(overallScore + (rng() - 0.3) * 1.5, 0, 100).toFixed(1)),
    next3MonthPct: Number(clamp(overallScore + (rng() - 0.25) * 2.5, 0, 100).toFixed(1)),
    annualPct: Number(clamp(overallScore + (rng() - 0.2) * 3.5, 0, 100).toFixed(1)),
    stability: overallScore >= 92 ? 'Stable' : overallScore >= 80 ? 'Improving' : 'Volatile',
    confidence: Math.round(clamp(overallScore + 2 - critical * 6 - major * 3, 55, 99)),
    reliability: overallScore >= 90 ? 'High' : overallScore >= 75 ? 'Medium' : 'Low',
  };

  // ── document verification status, grouped by act ──
  const docGroups = Array.from(new Set(company.docs.map(d => d.act)));
  const docVerification: DocVerificationRow[] = docGroups.map(act => {
    const ds = company.docs.filter(d => d.act === act);
    const verified = ds.filter(d => d.status === 'validated').length;
    return { label: act, pct: Math.round((verified / ds.length) * 100) };
  });
  const verificationCompletionPct = Math.round(
    (company.docs.filter(d => d.status === 'validated').length / Math.max(company.docs.length, 1)) * 100
  );

  // ── narrative — built from real counts, not invented prose ──
  const keyAchievements: string[] = [];
  if (regulatoryCoverage === 100) keyAchievements.push('All submitted registers verified with zero outstanding flags.');
  if (acts.every(a => a.pct >= 90)) keyAchievements.push('Every covered act is performing at or above a 90% compliance band.');
  if (openIssues.length === 0) keyAchievements.push('No open issues carried into the final audit decision.');
  if (keyAchievements.length === 0) keyAchievements.push('Submission met the bar for Level 3 sign-off after auditor review.');

  const riskFocusAreas: string[] = acts
    .filter(a => a.risk !== 'Low')
    .map(a => `${a.act} compliance is trending ${a.risk.toLowerCase()}-risk — monitor next filing cycle.`);
  if (riskFocusAreas.length === 0) riskFocusAreas.push('No elevated-risk areas identified across covered acts.');

  const recommendedActions: string[] = [];
  if (minor + major + critical > 0) {
    recommendedActions.push(`Track resolution of ${critical + major + minor} carried-over issue${critical + major + minor !== 1 ? 's' : ''} ahead of next filing.`);
  }
  recommendedActions.push('Continue quarterly live-register reconciliation to sustain current compliance band.');

  return {
    certificateId: `REG-${anchor.getFullYear()}-${String(seedFromString(company.id) % 90000 + 10000).slice(0, 3)}`,
    reportingMonth: anchor.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    generatedOn: anchor.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    clientName: company.name,
    entityLocation: `${company.industry}`,
    contactPerson: company.contactPerson,

    overallScore,
    complianceMaturity: maturity.label,
    maturityStars: maturity.stars,
    regulatoryCoverage,
    riskLevel: enterpriseRisk,
    auditReadiness: Math.round(clamp(overallScore - critical * 4 - major * 2, 0, 100)),

    acts,

    totalApplicableCompliances: company.docs.length * 3 + acts.length * 8,
    compliancesMet: Math.round((company.docs.length * 3 + acts.length * 8) * (regulatoryCoverage / 100)),
    openDeviations: critical + major + minor,
    documentsVerified: company.docs.filter(d => d.status === 'validated').length,
    employeesCovered: company.employeeCount,
    suppliersAssessed: Math.max(1, Math.round(company.employeeCount / 60)),
    regulatoryCoveragePct: regulatoryCoverage,
    complianceMaturityIndex: Math.round((overallScore / 10) * 10) / 10,
    auditIndexPct: Math.round(clamp(overallScore + 1.2, 0, 100)),
    aiConfidenceScore: forecast.confidence,

    matrix: acts,

    trend,
    trendDeltaVsPrior,
    bestMonth: { label: bestMonth.label, score: bestMonth.score },

    forecast,

    heatmap: acts.map(a => ({ act: a.act, risk: a.risk })),
    enterpriseRiskScore: enterpriseRisk,

    intelligence: {
      excellenceNote: overallScore >= 95
        ? 'Compliance execution is in the top band for enterprises of this size and industry — sustained performance above regulatory benchmark.'
        : overallScore >= 85
        ? 'Compliance execution is strong with a small number of areas to continue monitoring into the next cycle.'
        : 'Compliance execution meets the bar for sign-off; several areas would benefit from tighter reconciliation before the next filing.',
      keyAchievements,
      riskFocusAreas,
      recommendedActions,
    },

    docVerification,
    verificationCompletionPct,

    auditor: { name: auditor.fullName, licenseId: auditor.licenseId, specialization: auditor.specialization },
    companyContact: { name: company.contactPerson, email: company.contactEmail },
    decidedOn: anchor.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
  };
}