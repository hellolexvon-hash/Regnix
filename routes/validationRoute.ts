import { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../src/lib/supabaseAdmin.js';
import {
  asString, asDate, asBoolean, asStringArray,
  safeInsert, safeSelect, safeUpsert,
} from '../src/lib/portalHelpers.js';

const router = Router();

type ValidationStatePayload = {
  requestId?: string;
  userId?: string;
  companyName?: string;
  levelStates?: Array<'pending' | 'active' | 'done' | 'waiting'>;
  uploadedDocs?: unknown[];
  signatureUrl?: string;
  submittedAt?: string | Date | null;
  isApproved?: boolean;
};

router.get('/validation/state', async (req: Request, res: Response) => {
  try {
    const requestId = asString(req.query.requestId ?? req.query.id);
    const userId = asString(req.query.userId);

    const supabase = getSupabaseAdmin();
    const rows = await safeSelect<any>(
      supabase,
      'validation_states',
      '*',
      (qb: any) => {
        let q = qb;
        if (requestId) q = q.eq('request_id', requestId);
        else if (userId) q = q.eq('user_id', userId);
        return q.limit(1);
      },
    );

    const row = rows[0] ?? null;
    if (!row) {
      return res.json({
        ok: true,
        state: null,
      });
    }

    res.json({
      ok: true,
      state: {
        requestId: asString(row.request_id ?? row.id),
        userId: asString(row.user_id),
        companyName: asString(row.company_name),
        levelStates: asStringArray(row.level_states),
        uploadedDocs: row.uploaded_docs ?? [],
        signatureUrl: row.signature_url ?? null,
        submittedAt: asDate(row.submitted_at)?.toISOString() ?? null,
        isApproved: asBoolean(row.is_approved, false),
      },
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load validation state.',
    });
  }
});

router.post('/validation/state', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as ValidationStatePayload;
    const supabase = getSupabaseAdmin();

    const row = {
      request_id: asString(body.requestId),
      user_id: asString(body.userId),
      company_name: asString(body.companyName),
      level_states: JSON.stringify(body.levelStates ?? []),
      uploaded_docs: JSON.stringify(body.uploadedDocs ?? []),
      signature_url: asString(body.signatureUrl),
      submitted_at: body.submittedAt ? new Date(body.submittedAt).toISOString() : null,
      is_approved: asBoolean(body.isApproved, false),
      updated_at: new Date().toISOString(),
    };

    const saved = await safeUpsert(supabase, 'validation_states', row, '*', {
      onConflict: 'request_id',
    });

    await safeInsert(supabase, 'audit_log', {
      actor: row.user_id || row.company_name || 'System',
      actor_role: 'system',
      action: 'validation.state_saved',
      detail: `Stored validation state for ${row.company_name || row.request_id || 'unknown request'}.`,
      created_at: new Date().toISOString(),
    });

    res.json({ ok: true, state: saved ?? [] });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to save validation state.',
    });
  }
});

router.post('/validation/submit', async (req: Request, res: Response) => {
  try {
    const requestId = asString(req.body?.requestId ?? req.body?.id);
    const userId = asString(req.body?.userId);
    const companyName = asString(req.body?.companyName);

    if (!requestId && !userId && !companyName) {
      return res.status(400).json({ ok: false, message: 'requestId, userId, or companyName is required.' });
    }

    const supabase = getSupabaseAdmin();
    const updates = {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (requestId) {
      await safeUpsert(supabase, 'validation_requests', { id: requestId, ...updates }, '*', { onConflict: 'id' });
    }

    if (userId) {
      await safeInsert(supabase, 'validation_submissions', {
        user_id: userId,
        request_id: requestId || null,
        company_name: companyName || null,
        status: 'submitted',
        created_at: new Date().toISOString(),
      });
    }

    await safeInsert(supabase, 'audit_log', {
      actor: userId || companyName || 'System',
      actor_role: 'system',
      action: 'validation.submitted',
      detail: `Validation submitted for ${companyName || requestId || 'unknown request'}.`,
      created_at: new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to submit validation.',
    });
  }
});

export default router;
