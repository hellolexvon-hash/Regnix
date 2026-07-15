import { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import {
  asString, asNumber, asDate, normalizeReviewStatus,
  normalizeSpecialization, safeSelect, safeInsert,
} from '../lib/portalHelpers.js';

const router = Router();

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

router.get('/admin/dashboard', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;
  try {
    const supabase = getSupabaseAdmin();

    const [
      profileRows,
      auditorRows,
      validationRows,
      activityRows,
    ] = await Promise.all([
      safeSelect<any>(supabase, 'profiles', '*'),
      safeSelect<any>(supabase, 'profiles', '*', (qb: any) => qb.eq('account_type', 'auditor')),
      safeSelect<any>(supabase, 'validation_requests', '*'),
      safeSelect<any>(supabase, 'audit_log', '*'),
    ]);

    const clients = profileRows.filter((row) => {
      const accountType = asString(row.account_type).toLowerCase();
      return ['company', 'client'].includes(accountType);
    });

    const pendingValidations = validationRows.filter((row) => normalizeReviewStatus(row.status) === 'pending').length;
    const pendingAudits = validationRows.filter((row) => normalizeReviewStatus(row.status) === 'in_review').length;
    const approved = validationRows.filter((row) => normalizeReviewStatus(row.status) === 'approved').length;
    const rejected = validationRows.filter((row) => normalizeReviewStatus(row.status) === 'rejected').length;

    const activeAuditors = new Set(
      activityRows
        .filter((row) => asString(row.actor_role ?? row.actorRole).toLowerCase() === 'auditor')
        .map((row) => asString(row.actor).toLowerCase())
        .filter(Boolean),
    ).size;

    res.json({
      ok: true,
      dashboard: {
        totalClients: clients.length,
        totalAuditors: auditorRows.length,
        pendingValidations,
        pendingAudits,
        approved,
        rejected,
        activeAuditors,
      },
    });
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
    const supabase = getSupabaseAdmin();
    const rows = await safeSelect<any>(supabase, 'profiles', '*', (qb: any) =>
      qb.in('account_type', ['company', 'client']).order('created_at', { ascending: false }),
    );

    const clients = rows.map((row) => ({
      id: asString(row.id),
      accountType: asString(row.account_type),
      fullName: asString(row.full_name),
      email: asString(row.email).toLowerCase(),
      companyName: asString(row.company_name),
      industry: asString(row.industry),
      gstin: asString(row.gstin),
      firmName: asString(row.firm_name),
      createdAt: asDate(row.created_at)?.toISOString() ?? null,
      updatedAt: asDate(row.updated_at)?.toISOString() ?? null,
    }));

    res.json({ ok: true, clients });
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
    const supabase = getSupabaseAdmin();
    const rows = await safeSelect<any>(supabase, 'profiles', '*', (qb: any) =>
      qb.eq('account_type', 'auditor').order('created_at', { ascending: false }),
    );

    const activityRows = await safeSelect<any>(supabase, 'audit_log', '*');

    const auditors = rows.map((row) => {
      const email = asString(row.email).toLowerCase();
      const activityCount = activityRows.filter((activity) => asString(activity.actor).toLowerCase() === email).length;

      return {
        id: asString(row.id),
        fullName: asString(row.full_name),
        email,
        licenseId: asString(row.license_id ?? row.licenseId),
        specialization: normalizeSpecialization(row.specialization),
        joinedAt: asDate(row.created_at)?.toISOString() ?? null,
        activityCount,
      };
    });

    res.json({ ok: true, auditors });
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
    const supabase = getSupabaseAdmin();
    const rows = await safeSelect<any>(supabase, 'audit_log', '*', (qb: any) =>
      qb.order('created_at', { ascending: false }).limit(500),
    );

    const activity = rows.map((row) => ({
      id: asString(row.id),
      actor: asString(row.actor),
      actorRole: asString(row.actor_role ?? row.actorRole).toLowerCase() === 'auditor' ? 'auditor' : 'system',
      action: asString(row.action),
      detail: asString(row.detail ?? row.message),
      createdAt: asDate(row.created_at ?? row.createdAt)?.toISOString() ?? null,
    }));

    res.json({ ok: true, activity });
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
    const saved = await safeInsert(supabase, 'audit_log', {
      actor: asString(req.body?.actor, 'System'),
      actor_role: asString(req.body?.actorRole).toLowerCase() === 'auditor' ? 'auditor' : 'system',
      action: asString(req.body?.action, 'admin.event'),
      detail: asString(req.body?.detail, ''),
      created_at: new Date().toISOString(),
    });
    res.json({ ok: true, saved: saved ?? [] });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to record activity.',
    });
  }
});

export default router;
