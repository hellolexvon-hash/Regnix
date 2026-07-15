/**
 * superAdminStore.ts
 *
 * Deliberately a SEPARATE credential store from auditorStore.ts's auditor
 * accounts — a super admin is a distinct role with distinct, higher-blast-
 * radius permissions (visibility into every client and every auditor), so
 * it gets its own sign-in rather than being "just another auditor flag."
 * In the real backend (see database-schema.sql) both map to the same
 * `users` table differentiated by `role`, but the frontend session
 * boundary is kept separate on purpose — a super-admin session should
 * never silently inherit auditor-portal UI state or vice versa.
 *
 * All system-wide numbers here are DERIVED from useAuditorStore()'s live
 * companies/auditors/auditLog — nothing is hardcoded, same principle as
 * certificateData.ts.
 */

import { useState, useEffect } from 'react';
import { useAuditorStore, type CompanyReview, type Auditor, type AuditLogEntry } from '../AuditorView/auditorStore';

export interface SuperAdmin {
  id:        string;
  fullName:  string;
  email:     string;
  title:     string;
}

interface AdminStoreState {
  admins:            SuperAdmin[];
  credentials:       Record<string, string>;
  currentAdminId:    string | null;
}

const DEMO_ADMIN: SuperAdmin = {
  id: 'admin-1', fullName: 'Karan Mehta', email: 'karan.mehta@regnix.io', title: 'Platform Operations',
};

let _admin: AdminStoreState = {
  admins:         [DEMO_ADMIN],
  credentials:    { [DEMO_ADMIN.email]: 'admin1234' },
  currentAdminId: null,
};

type Listener = () => void;
const _listeners = new Set<Listener>();
function notify() { _listeners.forEach(fn => fn()); }

export function useSuperAdminAuth() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener: Listener = () => forceRender(n => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const currentAdmin = _admin.admins.find(a => a.id === _admin.currentAdminId) ?? null;

  return {
    currentAdmin,
    isAuthenticated: currentAdmin !== null,

    signIn(email: string, password: string): { ok: true } | { ok: false; error: string } {
      const key = email.trim().toLowerCase();
      const match = _admin.admins.find(a => a.email.toLowerCase() === key);
      if (!match || _admin.credentials[match.email] !== password) {
        return { ok: false, error: 'Incorrect email or password.' };
      }
      _admin = { ..._admin, currentAdminId: match.id };
      notify();
      return { ok: true };
    },

    signOut() {
      _admin = { ..._admin, currentAdminId: null };
      notify();
    },
  };
}

// ── Derived system-wide analytics ───────────────────────────────────────

export interface AuditorWorkload {
  auditor:   Auditor;
  assigned:  number;
  approved:  number;
  rejected:  number;
  changesRequested: number;
  avgTurnaroundDays: number | null;
}

export interface SystemOverview {
  totalCompanies:      number;
  byStatus:            Record<CompanyReview['status'], number>;
  totalAuditors:       number;
  totalCertificatesIssued: number;
  totalOpenIssues:     number;
  totalCriticalIssues: number;
  avgL2Score:          number;
  workload:            AuditorWorkload[];
  recentActivity:      AuditLogEntry[];
}

function turnaroundDays(c: CompanyReview): number | null {
  if (!c.decidedAt) return null;
  return Math.round((c.decidedAt.getTime() - c.l2CompletedAt.getTime()) / 86400000);
}

/** Call from inside a component — composes on top of useAuditorStore(), never duplicates its state. */
export function useSystemOverview(): SystemOverview {
  const { companies, auditors, auditLog } = useAuditorStore();

  const byStatus = {
    pending: 0, in_review: 0, approved: 0, changes_requested: 0, rejected: 0,
  } as Record<CompanyReview['status'], number>;
  for (const c of companies) byStatus[c.status]++;

  const totalOpenIssues = companies.reduce((sum, c) => sum + c.issues.filter(i => !i.resolvedL2).length, 0);
  const totalCriticalIssues = companies.reduce(
    (sum, c) => sum + c.issues.filter(i => !i.resolvedL2 && i.severity === 'critical').length, 0,
  );
  const avgL2Score = companies.length
    ? Math.round((companies.reduce((s, c) => s + c.l2Score, 0) / companies.length) * 10) / 10
    : 0;

  const workload: AuditorWorkload[] = auditors.map(auditor => {
    const owned = companies.filter(c => c.assignedTo === auditor.id);
    const decided = owned.filter(c => c.decidedAt);
    const turnarounds = decided.map(turnaroundDays).filter((n): n is number => n !== null);
    return {
      auditor,
      assigned: owned.filter(c => c.status === 'in_review').length,
      approved: owned.filter(c => c.status === 'approved').length,
      rejected: owned.filter(c => c.status === 'rejected').length,
      changesRequested: owned.filter(c => c.status === 'changes_requested').length,
      avgTurnaroundDays: turnarounds.length
        ? Math.round((turnarounds.reduce((s, n) => s + n, 0) / turnarounds.length) * 10) / 10
        : null,
    };
  });

  return {
    totalCompanies: companies.length,
    byStatus,
    totalAuditors: auditors.length,
    totalCertificatesIssued: byStatus.approved,
    totalOpenIssues,
    totalCriticalIssues,
    avgL2Score,
    workload,
    recentActivity: auditLog.slice(0, 30),
  };
}
