/**
 * server/routes/emailRoute.ts
 *
 * Automatic transactional email (Zoho SMTP via lib/mailer).
 *
 *   POST /api/email/approval      super admin only   -> "you are approved"
 *   POST /api/email/rejection     super admin only   -> "not approved"
 *   POST /api/email/kyc-request   super admin only   -> KYC / payment request
 *   POST /api/email/kyc-verified  super admin only   -> KYC verified
 *   POST /api/webhooks/signup     Supabase DB webhook (shared secret) -> "application received"
 *
 * Needs APP_URL (e.g. https://app.regnix.in) to build the KYC upload / login links.
 *
 * Security model:
 *   - Admin routes verify the caller's Supabase access token and call the same
 *     is_super_admin() function the console uses.
 *   - The browser only sends an id. Recipient, name and content are always read
 *     from the database here, so nobody can use these routes to email arbitrary
 *     addresses or text.
 *   - Each route checks the row is in the right state (e.g. approval mail is
 *     only sent for a profile that really is 'approved').
 *   - A failed email never changes database state; it returns an error instead.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { sendMail } from '../lib/mailer.js';
import * as tpl from '../lib/emailTemplates.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function supabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
}
function supabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

let serviceClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials are not configured.');
  serviceClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return serviceClient;
}

// ── Tiny in-memory rate limiter (per IP) ────────────────────────────────

function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ ok: false, error: 'Too many requests.' });
    }
    return next();
  };
}

// ── Super-admin guard ───────────────────────────────────────────────────

async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return res.status(401).json({ ok: false, error: 'Not signed in.' });

    const url = supabaseUrl();
    const anon = supabaseAnonKey();
    if (!url || !anon) return res.status(500).json({ ok: false, error: 'Server is not configured.' });

    const asCaller = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await asCaller.rpc('is_super_admin');
    if (error || data !== true) return res.status(403).json({ ok: false, error: 'Forbidden.' });
    return next();
  } catch {
    return res.status(500).json({ ok: false, error: 'Authorization check failed.' });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  account_type: string | null;
  company_name: string | null;
  firm_name: string | null;
  approval_status: string;
  rejection_reason: string | null;
  selected_plan: string | null;
}

async function loadProfile(id: string): Promise<ProfileRow | null> {
  const { data } = await getServiceClient()
    .from('profiles')
    .select('id, full_name, email, account_type, company_name, firm_name, approval_status, rejection_reason, selected_plan')
    .eq('id', id)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

function readId(body: unknown, field: string): string | null {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

async function deliver(res: Response, to: string | null, email: tpl.Email) {
  if (!to) return res.status(422).json({ ok: false, error: 'User has no email address.' });
  const result = await sendMail({ to, ...email });
  if (!result.ok) return res.status(502).json({ ok: false, error: result.error });
  return res.json({ ok: true });
}

const adminLimiter = rateLimit(60, 60_000);

// ── Admin-triggered emails ──────────────────────────────────────────────

router.post('/email/approval', adminLimiter, requireSuperAdmin, async (req, res) => {
  try {
    const userId = readId(req.body, 'userId');
    if (!userId) return res.status(400).json({ ok: false, error: 'userId is required.' });
    const profile = await loadProfile(userId);
    if (!profile) return res.status(404).json({ ok: false, error: 'User not found.' });
    if (profile.approval_status !== 'approved') {
      return res.status(409).json({ ok: false, error: 'User is not approved.' });
    }
    return await deliver(res, profile.email, tpl.signupApproved(profile.full_name ?? '', tpl.planLine(profile.selected_plan)));
  } catch (err) {
    console.error('[email/approval]', err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: 'Could not send email.' });
  }
});

router.post('/email/rejection', adminLimiter, requireSuperAdmin, async (req, res) => {
  try {
    const userId = readId(req.body, 'userId');
    if (!userId) return res.status(400).json({ ok: false, error: 'userId is required.' });
    const profile = await loadProfile(userId);
    if (!profile) return res.status(404).json({ ok: false, error: 'User not found.' });
    if (profile.approval_status !== 'rejected') {
      return res.status(409).json({ ok: false, error: 'User is not rejected.' });
    }
    return await deliver(res, profile.email, tpl.signupRejected(profile.full_name ?? '', profile.rejection_reason));
  } catch (err) {
    console.error('[email/rejection]', err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: 'Could not send email.' });
  }
});

async function loadKyc(requestId: string) {
  const { data: kyc } = await getServiceClient()
    .from('kyc_requests')
    .select('id, profile_id, documents, amount, currency, due_date, note, status, upload_token')
    .eq('id', requestId)
    .maybeSingle();
  if (!kyc) return null;
  const profile = await loadProfile(kyc.profile_id as string);
  return profile ? { kyc, profile } : null;
}

router.post('/email/kyc-request', adminLimiter, requireSuperAdmin, async (req, res) => {
  try {
    const requestId = readId(req.body, 'requestId');
    if (!requestId) return res.status(400).json({ ok: false, error: 'requestId is required.' });
    const found = await loadKyc(requestId);
    if (!found) return res.status(404).json({ ok: false, error: 'Request not found.' });
    const { kyc, profile } = found;
    if (kyc.status !== 'requested') {
      return res.status(409).json({ ok: false, error: 'This KYC request is not open.' });
    }
    const base = tpl.appUrl();
    const token = kyc.upload_token as string | null;
    if (!base || !token) {
      return res.status(500).json({ ok: false, error: 'APP_URL is not set or the request has no upload token (run signup-kyc-flow.sql).' });
    }
    return await deliver(
      res,
      profile.email,
      tpl.kycRequested({
        uploadUrl: `${base}/kyc-upload/${token}`,
        companyName: profile.company_name || profile.firm_name || '',
        plan: tpl.planLine(profile.selected_plan),
        fullName: profile.full_name ?? '',
        documents: (kyc.documents as string[] | null) ?? [],
        amount: Number(kyc.amount ?? 0),
        currency: (kyc.currency as string) || 'INR',
        dueDate: (kyc.due_date as string | null) ?? null,
        note: (kyc.note as string | null) ?? null,
      }),
    );
  } catch (err) {
    console.error('[email/kyc-request]', err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: 'Could not send email.' });
  }
});

router.post('/email/kyc-verified', adminLimiter, requireSuperAdmin, async (req, res) => {
  try {
    const requestId = readId(req.body, 'requestId');
    if (!requestId) return res.status(400).json({ ok: false, error: 'requestId is required.' });
    const found = await loadKyc(requestId);
    if (!found) return res.status(404).json({ ok: false, error: 'Request not found.' });
    if (found.kyc.status !== 'verified') {
      return res.status(409).json({ ok: false, error: 'This KYC request is not verified.' });
    }
    return await deliver(res, found.profile.email, tpl.kycVerified(found.profile.full_name ?? ''));
  } catch (err) {
    console.error('[email/kyc-verified]', err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: 'Could not send email.' });
  }
});

// ── Signup: Supabase Database Webhook (INSERT on public.profiles) ───────

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

router.post('/webhooks/signup', rateLimit(30, 60_000), async (req, res) => {
  try {
    const expected = process.env.SIGNUP_WEBHOOK_SECRET;
    if (!expected) return res.status(500).json({ ok: false, error: 'Webhook is not configured.' });
    const provided = String(req.headers['x-webhook-secret'] ?? '');
    if (!secretsMatch(provided, expected)) return res.status(401).json({ ok: false, error: 'Unauthorized.' });

    const body = req.body as { type?: string; table?: string; record?: { id?: unknown } };
    if (body?.type !== 'INSERT' || body?.table !== 'profiles') {
      return res.status(200).json({ ok: true, skipped: true });
    }
    const id = typeof body.record?.id === 'string' && UUID_RE.test(body.record.id) ? body.record.id : null;
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid payload.' });

    // Never trust the payload's email/name: re-read the row.
    const profile = await loadProfile(id);
    if (!profile || profile.approval_status !== 'pending') return res.status(200).json({ ok: true, skipped: true });

    const toUser = await sendMail({ to: profile.email ?? '', ...tpl.signupReceived(profile.full_name ?? '', {
      companyName: profile.company_name || profile.firm_name || '',
      plan: tpl.planLine(profile.selected_plan),
    }) });

    const adminTo = process.env.ADMIN_NOTIFY_EMAIL;
    if (adminTo) {
      await sendMail({
        to: adminTo,
        ...tpl.adminNewSignup({
          fullName: profile.full_name ?? '',
          email: profile.email ?? '',
          accountType: profile.account_type ?? '',
          companyName: profile.company_name || profile.firm_name || '',
          plan: tpl.planLine(profile.selected_plan),
        }),
      });
    }

    if (!toUser.ok) return res.status(502).json({ ok: false, error: toUser.error });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[webhooks/signup]', err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: 'Could not process webhook.' });
  }
});

export default router;