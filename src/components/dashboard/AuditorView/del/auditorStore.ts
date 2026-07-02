/**
 * auditorStore.ts
 *
 * In-memory singleton store for the Auditor Portal — mirrors the pattern used
 * by validationStore.ts (no Redux/Zustand needed; state lives outside React
 * so it survives re-mounts as the auditor navigates between screens).
 *
 * Covers:
 *   - Auditor identity: sign up, sign in, sign out, session persistence (in-memory)
 *   - Review queue: companies that have completed Level 2 (Live Register
 *     Comparison) and are now awaiting Level 3 (Auditor Review)
 *   - Per-company decision: approve / request changes / reject, with remarks
 *
 * In production, replace the mock company seed + auth map with real API
 * calls (e.g. GET /api/auditor/queue, POST /api/auditor/login) — the shape
 * of the hook consumers use (`useAuditorStore()`) would not need to change.
 */

import { useState, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type Specialization =
  | 'PF & ESIC'
  | 'Labour Law'
  | 'Tax & Wages'
  | 'General Compliance';

export interface Auditor {
  id:             string;
  fullName:       string;
  email:          string;
  licenseId:      string;
  specialization: Specialization;
  joinedAt:       Date;
}

export type ReviewStatus =
  | 'pending'          // passed L2, not yet opened by any auditor
  | 'in_review'         // an auditor has opened it, decision not yet made
  | 'approved'
  | 'changes_requested'
  | 'rejected';

export type IssueSeverity = 'critical' | 'major' | 'minor';

export interface CarriedIssue {
  id:         string;
  docName:    string;
  severity:   IssueSeverity;
  rule:       string;
  rootCause:  string;
  resolvedL2: boolean;
}

export interface ReviewDoc {
  id:        string;
  name:      string;
  act:       string;
  status:    'validated' | 'flagged';
  score:     number; // 0-100
}

export interface CompanyReview {
  id:              string;
  name:            string;
  industry:        string;
  cin:             string;
  contactPerson:   string;
  contactEmail:    string;
  employeeCount:   number;
  actsCovered:     string[];
  docs:            ReviewDoc[];
  issues:          CarriedIssue[];
  l2Score:         number; // 0-100
  l2CompletedAt:   Date;
  status:          ReviewStatus;
  assignedTo:      string | null; // auditor id
  decisionRemarks: string;
  decidedAt:       Date | null;
}

// ── Mock seed data ───────────────────────────────────────────────────────────

function daysAgo(n: number, h = 10, m = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
}

function mkDocs(names: [string, string][], flaggedIdx: number[] = []): ReviewDoc[] {
  return names.map(([name, act], i) => ({
    id:     `d${i}`,
    name,
    act,
    status: flaggedIdx.includes(i) ? 'flagged' : 'validated',
    score:  flaggedIdx.includes(i) ? 62 + (i % 3) * 4 : 92 + (i % 3) * 2,
  }));
}

const SEED_COMPANIES: CompanyReview[] = [
  {
    id: 'c1', name: 'Vertex Precision Engineering Pvt Ltd', industry: 'Manufacturing',
    cin: 'U29100MH2014PTC256781', contactPerson: 'R. Deshmukh', contactEmail: 'r.deshmukh@vertexpe.in',
    employeeCount: 214, actsCovered: ['PF', 'ESIC', 'Wages', 'Labour'],
    docs: mkDocs([
      ['PF ECR', 'PF'], ['PF Consolidated Statement', 'PF'], ['ESIC Challan', 'ESIC'],
      ['ESIC ECR', 'ESIC'], ['Wage Slip Register', 'Wages'], ['Bank Advisory Slip', 'Wages'],
      ['PF Form 5A', 'PF'], ['Employee Compensation Policy', 'Labour'],
    ], [3]),
    issues: [
      { id: 'i1', docName: 'ESIC ECR', severity: 'major', rule: 'IP number sequence validation', rootCause: 'Two IP numbers in the ECR file do not match the ESIC portal master; likely a mid-month joinee not yet mapped.', resolvedL2: false },
    ],
    l2Score: 91, l2CompletedAt: daysAgo(1, 14, 20), status: 'pending', assignedTo: null,
    decisionRemarks: '', decidedAt: null,
  },
  {
    id: 'c2', name: 'Lumen Retail Solutions LLP', industry: 'Retail',
    cin: 'AAG-4471', contactPerson: 'S. Nair', contactEmail: 's.nair@lumenretail.com',
    employeeCount: 88, actsCovered: ['PF', 'Wages', 'Shops & Establishments'],
    docs: mkDocs([
      ['PF ECR', 'PF'], ['PF Payment Challan', 'PF'], ['Wage Slip Register', 'Wages'],
      ['Bank Advisory Slip', 'Wages'], ['Shops & Est. Registration', 'Shops & Establishments'],
    ]),
    issues: [],
    l2Score: 98, l2CompletedAt: daysAgo(2, 11, 5), status: 'pending', assignedTo: null,
    decisionRemarks: '', decidedAt: null,
  },
  {
    id: 'c3', name: 'Northgate Facility Services', industry: 'Facility Management',
    cin: 'U74999DL2011PTC219044', contactPerson: 'A. Bhatia', contactEmail: 'a.bhatia@northgatefm.in',
    employeeCount: 512, actsCovered: ['PF', 'ESIC', 'Wages', 'Labour', 'Contract Labour'],
    docs: mkDocs([
      ['PF ECR', 'PF'], ['PF Consolidated Statement', 'PF'], ['PF Form 5A', 'PF'],
      ['ESIC Registration Certificate', 'ESIC'], ['ESIC Challan', 'ESIC'], ['ESIC ECR', 'ESIC'],
      ['Wage Slip Register', 'Wages'], ['Bank Advisory Slip', 'Wages'],
      ['Contract Labour Licence', 'Contract Labour'], ['Employee Compensation Policy', 'Labour'],
    ], [1, 8]),
    issues: [
      { id: 'i2', docName: 'PF Consolidated Statement', severity: 'critical', rule: 'Contribution amount reconciliation', rootCause: 'Employer contribution total is ₹18,400 short of the payroll-derived figure for March.', resolvedL2: false },
      { id: 'i3', docName: 'Contract Labour Licence', severity: 'major', rule: 'Licence validity window', rootCause: 'Licence expired 11 days before the audit period end date; renewal appears to be in process.', resolvedL2: false },
    ],
    l2Score: 79, l2CompletedAt: daysAgo(3, 9, 40), status: 'in_review', assignedTo: 'demo-auditor', decisionRemarks: '', decidedAt: null,
  },
  {
    id: 'c4', name: 'Kestrel Analytics India', industry: 'IT / ITES',
    cin: 'U72200KA2016PTC091223', contactPerson: 'M. Iyer', contactEmail: 'm.iyer@kestrelanalytics.io',
    employeeCount: 146, actsCovered: ['PF', 'ESIC', 'Wages'],
    docs: mkDocs([
      ['PF ECR', 'PF'], ['ESIC ECR', 'ESIC'], ['ESIC Challan', 'ESIC'],
      ['Wage Slip Register', 'Wages'], ['Bank Advisory Slip', 'Wages'], ['PF Form 5A', 'PF'],
    ]),
    issues: [],
    l2Score: 100, l2CompletedAt: daysAgo(5, 16, 10), status: 'approved', assignedTo: 'demo-auditor',
    decisionRemarks: 'Clean submission — all registers reconcile against payroll with zero variance. Approved without conditions.',
    decidedAt: daysAgo(4, 12, 0),
  },
  {
    id: 'c5', name: 'Solaris Textile Mills', industry: 'Textiles',
    cin: 'U17119GJ2009PLC056781', contactPerson: 'P. Trivedi', contactEmail: 'p.trivedi@solaristextiles.in',
    employeeCount: 640, actsCovered: ['PF', 'ESIC', 'Wages', 'Labour', 'Insurance'],
    docs: mkDocs([
      ['PF ECR', 'PF'], ['PF Consolidated Statement', 'PF'], ['ESIC ECR', 'ESIC'],
      ['ESIC Challan', 'ESIC'], ['Wage Slip Register', 'Wages'], ['Bank Advisory Slip', 'Wages'],
      ['Employee Compensation Policy', 'Insurance'], ['PF Form 5A', 'PF'],
    ], [6]),
    issues: [
      { id: 'i4', docName: 'Employee Compensation Policy', severity: 'minor', rule: 'Policy renewal date check', rootCause: 'Policy document on file shows last year\'s renewal; current-year certificate not yet uploaded.', resolvedL2: false },
    ],
    l2Score: 88, l2CompletedAt: daysAgo(7, 10, 30), status: 'changes_requested', assignedTo: 'demo-auditor',
    decisionRemarks: 'Please upload the current-year Employee Compensation policy certificate and resubmit for final sign-off.',
    decidedAt: daysAgo(6, 15, 0),
  },
  {
    id: 'c6', name: 'Brightline Logistics Pvt Ltd', industry: 'Logistics',
    cin: 'U63090TN2013PTC091887', contactPerson: 'K. Suresh', contactEmail: 'k.suresh@brightlinelog.in',
    employeeCount: 305, actsCovered: ['PF', 'ESIC', 'Wages', 'Labour'],
    docs: mkDocs([
      ['PF ECR', 'PF'], ['PF Payment Challan', 'PF'], ['ESIC ECR', 'ESIC'],
      ['ESIC Registration Certificate', 'ESIC'], ['Wage Slip Register', 'Wages'],
      ['Bank Advisory Slip', 'Wages'], ['PF Form 5A', 'PF'],
    ]),
    issues: [],
    l2Score: 95, l2CompletedAt: daysAgo(0, 8, 15), status: 'pending', assignedTo: null,
    decisionRemarks: '', decidedAt: null,
  },
  {
    id: 'c7', name: 'Ferrowave Metals & Alloys', industry: 'Manufacturing',
    cin: 'U27310OR2010PLC012456', contactPerson: 'J. Panda', contactEmail: 'j.panda@ferrowave.in',
    employeeCount: 421, actsCovered: ['PF', 'ESIC', 'Wages', 'Labour', 'Contract Labour'],
    docs: mkDocs([
      ['PF ECR', 'PF'], ['PF Consolidated Statement', 'PF'], ['ESIC Challan', 'ESIC'],
      ['ESIC ECR', 'ESIC'], ['Wage Slip Register', 'Wages'], ['Contract Labour Licence', 'Contract Labour'],
    ], [1, 5]),
    issues: [
      { id: 'i5', docName: 'PF Consolidated Statement', severity: 'major', rule: 'Headcount reconciliation', rootCause: 'Consolidated statement lists 421 members; live payroll register shows 417 active employees for the period.', resolvedL2: false },
      { id: 'i6', docName: 'Contract Labour Licence', severity: 'minor', rule: 'Signatory seal check', rootCause: 'Licensing officer seal is present but faint/partially illegible on the scanned copy.', resolvedL2: true },
    ],
    l2Score: 84, l2CompletedAt: daysAgo(2, 17, 0), status: 'pending', assignedTo: null,
    decisionRemarks: '', decidedAt: null,
  },
  {
    id: 'c8', name: 'Ashford & Rowe Consulting', industry: 'Professional Services',
    cin: 'U74140MH2018PTC308812', contactPerson: 'N. Kapoor', contactEmail: 'n.kapoor@ashfordrowe.com',
    employeeCount: 62, actsCovered: ['PF', 'Wages'],
    docs: mkDocs([
      ['PF ECR', 'PF'], ['PF Form 5A', 'PF'], ['Wage Slip Register', 'Wages'], ['Bank Advisory Slip', 'Wages'],
    ]),
    issues: [],
    l2Score: 100, l2CompletedAt: daysAgo(9, 13, 45), status: 'rejected', assignedTo: 'demo-auditor',
    decisionRemarks: 'Digital signature on the PF Form 5A does not match the authorised signatory on record. Please have the correct signatory re-sign and resubmit as a fresh audit.',
    decidedAt: daysAgo(8, 11, 20),
  },
];

// ── Singleton store ───────────────────────────────────────────────────────────

interface Store {
  auditors:        Auditor[];
  credentials:      Record<string, string>; // email -> password (demo only, never do this in prod)
  currentAuditorId: string | null;
  companies:        CompanyReview[];
}

const DEMO_AUDITOR: Auditor = {
  id: 'demo-auditor', fullName: 'Ananya Rao', email: 'ananya.rao@regnix-audit.in',
  licenseId: 'RGX-AUD-2291', specialization: 'PF & ESIC', joinedAt: daysAgo(340),
};

let _store: Store = {
  auditors:         [DEMO_AUDITOR],
  credentials:      { [DEMO_AUDITOR.email]: 'demo1234' },
  currentAuditorId: null,
  companies:        SEED_COMPANIES,
};

type Listener = () => void;
const _listeners = new Set<Listener>();
function notify() { _listeners.forEach(fn => fn()); }
function setField<K extends keyof Store>(key: K, value: Store[K]) {
  _store = { ..._store, [key]: value };
  notify();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuditorStore() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener: Listener = () => forceRender(n => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const currentAuditor = _store.auditors.find(a => a.id === _store.currentAuditorId) ?? null;

  return {
    auditors:  _store.auditors,
    companies: _store.companies,
    currentAuditor,
    isAuthenticated: currentAuditor !== null,

    signUp(input: {
      fullName: string; email: string; password: string;
      licenseId: string; specialization: Specialization;
    }): { ok: true } | { ok: false; error: string } {
      const email = input.email.trim().toLowerCase();
      if (_store.credentials[email]) {
        return { ok: false, error: 'An auditor account with this email already exists. Try signing in instead.' };
      }
      const auditor: Auditor = {
        id: `a-${Date.now()}`, fullName: input.fullName.trim(), email,
        licenseId: input.licenseId.trim(), specialization: input.specialization,
        joinedAt: new Date(),
      };
      _store = {
        ..._store,
        auditors:         [..._store.auditors, auditor],
        credentials:       { ..._store.credentials, [email]: input.password },
        currentAuditorId: auditor.id,
      };
      notify();
      return { ok: true };
    },

    signIn(email: string, password: string): { ok: true } | { ok: false; error: string } {
      const key = email.trim().toLowerCase();
      if (!_store.credentials[key]) {
        return { ok: false, error: 'No auditor account found with this email.' };
      }
      if (_store.credentials[key] !== password) {
        return { ok: false, error: 'Incorrect password. Please try again.' };
      }
      const auditor = _store.auditors.find(a => a.email === key)!;
      setField('currentAuditorId', auditor.id);
      return { ok: true };
    },

    signOut() {
      setField('currentAuditorId', null);
    },

    claimCompany(companyId: string) {
      if (!_store.currentAuditorId) return;
      const companies = _store.companies.map(c =>
        c.id === companyId && c.status === 'pending'
          ? { ...c, status: 'in_review' as ReviewStatus, assignedTo: _store.currentAuditorId }
          : c
      );
      setField('companies', companies);
    },

    decide(companyId: string, decision: 'approved' | 'changes_requested' | 'rejected', remarks: string) {
      const companies = _store.companies.map(c =>
        c.id === companyId
          ? { ...c, status: decision, decisionRemarks: remarks, decidedAt: new Date(), assignedTo: c.assignedTo ?? _store.currentAuditorId }
          : c
      );
      setField('companies', companies);
    },
  };
}
