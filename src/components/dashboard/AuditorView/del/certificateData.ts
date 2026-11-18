/**
 * certificateData.ts
 *
 * Pure derivation of everything the Regnix Compliance Certificate shows, from the
 * real CompanyReview + Auditor records. Every figure is computed from the audited
 * documents, issues and decision — nothing is simulated (the earlier build's
 * 12-month trend, AI forecast and invented "suppliers assessed" figures are gone: a
 * verifiable credential must not carry numbers that are not backed by data).
 */
import type { Auditor, CompanyReview } from './auditorStore';

export type RiskLevel = 'Low' | 'Medium' | 'High';
export type Maturity = 'World Class' | 'Excellent' | 'Good' | 'Developing';

export interface ActRow {
  act: string; pct: number; documents: number; flagged: number; openIssues: number;
  status: 'Compliant' | 'Partial' | 'Non-Compliant'; risk: RiskLevel;
}
export interface DocRow { name: string; act: string; score: number; status: 'validated' | 'flagged'; openIssues: number }

export interface CertificateData {
  certificateNo: string;
  verifyUrl: string;
  issuedOn: string;
  reportingMonth: string;
  reauditBy: string;

  clientName: string;
  industry: string;
  cin: string;
  employees: number;
  contactPerson: string;

  overallScore: number;
  complianceMaturity: Maturity;
  maturityStars: number;
  regulatoryCoverage: number;
  riskLevel: RiskLevel;
  auditReadiness: number;

  acts: ActRow[];
  docs: DocRow[];

  documentsReviewed: number;
  documentsVerified: number;
  issues: { critical: number; major: number; minor: number; open: number; resolved: number; total: number };
  l2Score: number;

  narrative: { summary: string; achievements: string[]; focusAreas: string[]; actions: string[] };

  auditor: { name: string; licenseId: string; specialization: string };
  remarks: string;
}

const risk = (p: number): RiskLevel => (p >= 90 ? 'Low' : p >= 75 ? 'Medium' : 'High');
const status = (p: number): ActRow['status'] => (p >= 95 ? 'Compliant' : p >= 75 ? 'Partial' : 'Non-Compliant');
const maturity = (p: number): { label: Maturity; stars: number } =>
  p >= 95 ? { label: 'World Class', stars: 5 } : p >= 85 ? { label: 'Excellent', stars: 4 } : p >= 70 ? { label: 'Good', stars: 3 } : { label: 'Developing', stars: 2 };

export function buildCertificateData(company: CompanyReview, auditor: Auditor): CertificateData {
  const issuedAt = company.certificate?.issuedAt ?? company.decidedAt ?? new Date();
  const certificateNo = company.certificate?.certificateNo ?? 'PENDING';
  const open = company.issues.filter(i => !i.resolvedL2);
  const count = (sev: string) => open.filter(i => i.severity === sev).length;
  const critical = count('critical'), major = count('major'), minor = count('minor');

  const docs: DocRow[] = company.docs.map(d => ({
    name: d.name, act: d.act, score: d.score, status: d.status,
    openIssues: open.filter(i => i.docName === d.name).length,
  }));

  const acts: ActRow[] = Array.from(new Set(docs.map(d => d.act))).map(act => {
    const ds = docs.filter(d => d.act === act);
    const pct = Math.round(ds.reduce((s, d) => s + d.score, 0) / Math.max(ds.length, 1));
    return {
      act, pct, documents: ds.length, flagged: ds.filter(d => d.status === 'flagged').length,
      openIssues: ds.reduce((s, d) => s + d.openIssues, 0), status: status(pct), risk: risk(pct),
    };
  });

  const overallScore = Number((acts.reduce((s, a) => s + a.pct, 0) / Math.max(acts.length, 1)).toFixed(1));
  const flagged = docs.filter(d => d.status === 'flagged').length;
  const coverage = Number((((docs.length - flagged) / Math.max(docs.length, 1)) * 100).toFixed(1));
  const m = maturity(overallScore);
  const enterprise: RiskLevel = critical > 0 ? 'High' : major > 0 ? 'Medium' : 'Low';

  const achievements: string[] = [];
  if (flagged === 0 && docs.length) achievements.push(`All ${docs.length} submitted documents verified with no flags.`);
  if (acts.length && acts.every(a => a.pct >= 90)) achievements.push('Every covered act scores 90% or above.');
  if (open.length === 0) achievements.push('No open issues carried into the final decision.');
  if (!achievements.length) achievements.push('Submission met the bar for Level 3 sign-off after independent review.');

  const focusAreas = acts.filter(a => a.risk !== 'Low').map(a => `${a.act}: ${a.pct}% (${a.openIssues} open issue${a.openIssues !== 1 ? 's' : ''}) — monitor next filing cycle.`);
  if (!focusAreas.length) focusAreas.push('No elevated-risk areas across the covered acts.');

  const actions: string[] = [];
  if (open.length) actions.push(`Close the ${open.length} carried-over issue${open.length !== 1 ? 's' : ''} before the next filing.`);
  actions.push('Re-run live-register reconciliation each month to hold the current compliance band.');

  const reaudit = new Date(issuedAt); reaudit.setFullYear(reaudit.getFullYear() + 1);

  return {
    certificateNo,
    verifyUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/verify/${certificateNo}`,
    issuedOn: issuedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
    reportingMonth: issuedAt.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    reauditBy: reaudit.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    clientName: company.name, industry: company.industry, cin: company.cin, employees: company.employeeCount, contactPerson: company.contactPerson,
    overallScore, complianceMaturity: m.label, maturityStars: m.stars, regulatoryCoverage: coverage, riskLevel: enterprise,
    auditReadiness: Math.max(0, Math.min(100, Math.round(overallScore - critical * 4 - major * 2))),
    acts, docs,
    documentsReviewed: docs.length, documentsVerified: docs.length - flagged,
    issues: { critical, major, minor, open: open.length, resolved: company.issues.length - open.length, total: company.issues.length },
    l2Score: company.l2Score,
    narrative: {
      summary: overallScore >= 95
        ? 'Compliance execution is in the top band — documents and registers reconcile with the live register.'
        : overallScore >= 85
          ? 'Compliance execution is strong, with a small number of areas to keep monitoring.'
          : 'Compliance execution meets the bar for sign-off; several areas need tighter reconciliation before the next filing.',
      achievements, focusAreas, actions,
    },
    auditor: { name: auditor.fullName, licenseId: auditor.licenseId, specialization: auditor.specialization },
    remarks: company.decisionRemarks,
  };
}
