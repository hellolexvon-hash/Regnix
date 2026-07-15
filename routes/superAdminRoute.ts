import { Router, type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const router = Router();

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables for superAdminRoute.');
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(asString(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function normalizeReviewStatus(value: unknown): 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected' {
  const v = asString(value).toLowerCase();
  if (v === 'in_review' || v === 'approved' || v === 'changes_requested' || v === 'rejected') return v;
  return 'pending';
}

function normalizeSpecialization(value: unknown): 'PF & ESIC' | 'Labour Law' | 'Tax & Wages' | 'General Compliance' {
  const v = asString(value).toLowerCase();
  if (v.includes('pf') || v.includes('esic')) return 'PF & ESIC';
  if (v.includes('tax')) return 'Tax & Wages';
  if (v.includes('labour')) return 'Labour Law';
  return 'General Compliance';
}

function requireAdminToken(req: Request, res: Response): boolean {
  const expected = process.env.ADMIN_API_TOKEN?.trim();
  if (!expected) return true;

  const provided =
    asString(req.headers.authorization).replace(/^Bearer\s+/i, '') ||
    asString(req.headers['x-admin-token']);

  if (provided === expected) return true;

  res.status(401).json({ ok: false, message: 'Unauthorized admin request.' });
  return false;
}

interface ProfileRow {
  id: string;
  account_type?: string | null;
  full_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  industry?: string | null;
  gstin?: string | null;
  firm_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AuditorProfileRow {
  user_id: string;
  license_id?: string | null;
  specialization?: string | null;
  joined_at?: string | null;
  is_active?: boolean | null;
}

interface ReviewCycleRow {
  id: string;
  organization_id: string;
  status?: string | null;
  l2_score?: number | null;
  l2_completed_at?: string | null;
  assigned_auditor_id?: string | null;
  decided_at?: string | null;
  decision_remarks?: string | null;
  created_at?: string | null;
}

interface IssueRow {
  id: string;
  review_cycle_id?: string | null;
  severity?: string | null;
  resolved_l2?: boolean | null;
}

interface CertificateRow {
  id: string;
  review_cycle_id?: string | null;
  issued_at?: string | null;
}

interface AuditLogRow {
  id: string | number;
  actor_user_id?: string | null;
  action?: string | null;
  entity_type?: string | null;
  metadata?: unknown;
  created_at?: string | null;
}

async function safeSelect<T>(
  supabase: SupabaseClient,
  table: string,
  columns = '*',
  queryFn?: (qb: any) => any,
): Promise<T[]> {
  let qb: any = supabase.from(table).select(columns);
  if (queryFn) qb = queryFn(qb);
  const { data, error } = await qb;
  if (error) throw error;
  return (data ?? []) as T[];
}

async function safeInsert<T extends Record<string, unknown>>(supabase: SupabaseClient, table: string, row: T): Promise<void> {
  const { error } = await supabase.from(table).insert(row);
  if (error) throw error;
}

async function buildSnapshot() {
  const supabase = getSupabaseAdmin();

  const [
    profiles,
    auditorProfiles,
    reviewCycles,
    issues,
    certificates,
    auditRows,
  ] = await Promise.all([
    safeSelect<ProfileRow>(supabase, 'profiles', '*'),
    safeSelect<AuditorProfileRow>(supabase, 'auditor_profiles', '*'),
    safeSelect<ReviewCycleRow>(supabase, 'review_cycles', '*'),
    safeSelect<IssueRow>(supabase, 'issues', '*'),
    safeSelect<CertificateRow>(supabase, 'certificates', '*'),
    safeSelect<AuditLogRow>(supabase, 'audit_log', '*'),
  ]);

  const clients = profiles.filter((row) => {
    const accountType = asString(row.account_type).toLowerCase();
    return accountType === 'company' || accountType === 'client';
  });

  const totalCriticalIssues = issues.filter((issue) => !asBool(issue.resolved_l2, false) && asString(issue.severity).toLowerCase() === 'critical').length;
  const totalOpenIssues = issues.filter((issue) => !asBool(issue.resolved_l2, false)).length;

  const byStatus = {
    pending: 0,
    in_review: 0,
    approved: 0,
    changes_requested: 0,
    rejected: 0,
  } as Record<'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected', number>;

  for (const cycle of reviewCycles) {
    byStatus[normalizeReviewStatus(cycle.status)] += 1;
  }

  const totalCertificatesIssued = certificates.length;
  const avgL2Score = reviewCycles.length
    ? Math.round((reviewCycles.reduce((sum, cycle) => sum + asNumber(cycle.l2_score, 0), 0) / reviewCycles.length) * 10) / 10
    : 0;

  const totalAuditors = auditorProfiles.filter((row) => asBool(row.is_active, true)).length;
  const activeAuditors = new Set(
    auditRows
      .filter((row) => asString((row.metadata as any)?.actorRole ?? (row.metadata as any)?.['actorRole'] ?? '').toLowerCase() === 'auditor')
      .map((row) => asString(row.actor_user_id))
      .filter(Boolean),
  ).size;

  const workload = auditorProfiles.map((auditor) => {
    const assigned = reviewCycles.filter((cycle) => cycle.assigned_auditor_id === auditor.user_id);
    const decided = assigned.filter((cycle) => cycle.decided_at);
    const turnarounds = decided
      .map((cycle) => {
        const start = asDate(cycle.l2_completed_at)?.getTime() ?? asDate(cycle.created_at)?.getTime() ?? 0;
        const end = asDate(cycle.decided_at)?.getTime() ?? 0;
        if (!start || !end) return null;
        return Math.round((end - start) / 86400000);
      })
      .filter((value): value is number => value !== null);

    const profile = profiles.find((p) => p.id === auditor.user_id);
    return {
      auditor: {
        id: auditor.user_id,
        fullName: asString(profile?.full_name, 'Auditor'),
        email: asString(profile?.email).toLowerCase(),
        licenseId: asString(auditor.license_id, '—'),
        specialization: normalizeSpecialization(auditor.specialization),
        joinedAt: asDate(auditor.joined_at)?.toISOString() ?? new Date().toISOString(),
      },
      assigned: assigned.filter((c) => normalizeReviewStatus(c.status) === 'in_review').length,
      approved: assigned.filter((c) => normalizeReviewStatus(c.status) === 'approved').length,
      rejected: assigned.filter((c) => normalizeReviewStatus(c.status) === 'rejected').length,
      changesRequested: assigned.filter((c) => normalizeReviewStatus(c.status) === 'changes_requested').length,
      avgTurnaroundDays: turnarounds.length ? Math.round((turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) * 10) / 10 : null,
    };
  });

  const recentActivity = auditRows
    .map((row) => ({
      id: asString(row.id),
      actor: asString((row.metadata as any)?.actor ?? row.actor_user_id, 'System'),
      actorRole: asString((row.metadata as any)?.actorRole).toLowerCase() === 'auditor' ? 'auditor' : 'system',
      action: asString(row.action, 'unknown.action'),
      detail: asString((row.metadata as any)?.detail ?? ''),
      createdAt: asDate(row.created_at)?.toISOString() ?? new Date().toISOString(),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    dashboard: {
      totalClients: clients.length,
      totalAuditors,
      pendingValidations: byStatus.pending,
      pendingAudits: byStatus.in_review,
      approved: byStatus.approved,
      rejected: byStatus.rejected,
      activeAuditors,
      totalCertificatesIssued,
      totalOpenIssues,
      totalCriticalIssues,
      avgL2Score,
    },
    clients: clients.map((row) => ({
      id: row.id,
      accountType: asString(row.account_type),
      fullName: asString(row.full_name),
      email: asString(row.email).toLowerCase(),
      companyName: asString(row.company_name),
      industry: asString(row.industry),
      gstin: asString(row.gstin),
      firmName: asString(row.firm_name),
      createdAt: asDate(row.created_at)?.toISOString() ?? null,
      updatedAt: asDate(row.updated_at)?.toISOString() ?? null,
    })),
    auditors: auditorProfiles.map((row) => ({
      id: row.user_id,
      fullName: asString(profiles.find((p) => p.id === row.user_id)?.full_name, 'Auditor'),
      email: asString(profiles.find((p) => p.id === row.user_id)?.email).toLowerCase(),
      licenseId: asString(row.license_id, '—'),
      specialization: normalizeSpecialization(row.specialization),
      joinedAt: asDate(row.joined_at)?.toISOString() ?? null,
      activityCount: auditRows.filter((a) => asString(a.actor_user_id) === row.user_id).length,
    })),
    activity: recentActivity,
    workload,
  };
}

router.get('/admin/bootstrap', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;
  try {
    const snapshot = await buildSnapshot();
    res.json({ ok: true, ...snapshot, hydratedAt: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load admin bootstrap data.',
    });
  }
});

router.get('/admin/dashboard', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;
  try {
    const snapshot = await buildSnapshot();
    res.json({ ok: true, dashboard: snapshot.dashboard });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load admin dashboard.',
    });
  }
});

router.get('/admin/clients', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;
  try {
    const snapshot = await buildSnapshot();
    res.json({ ok: true, clients: snapshot.clients });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load clients.',
    });
  }
});

router.get('/admin/auditors', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;
  try {
    const snapshot = await buildSnapshot();
    res.json({ ok: true, auditors: snapshot.auditors });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load auditors.',
    });
  }
});

router.get('/admin/activity', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;
  try {
    const snapshot = await buildSnapshot();
    res.json({ ok: true, activity: snapshot.activity });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load activity.',
    });
  }
});

router.post('/admin/activity', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;
  try {
    const supabase = getSupabaseAdmin();
    await safeInsert(supabase, 'audit_log', {
      actor_user_id: null,
      action: asString(req.body?.action, 'admin.activity'),
      entity_type: asString(req.body?.entityType, 'system'),
      entity_id: req.body?.entityId ?? null,
      metadata: {
        actor: asString(req.body?.actor, 'System'),
        actorRole: 'system',
        detail: asString(req.body?.detail, ''),
      },
      created_at: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to record activity.',
    });
  }
});

export default router;