/**
 * server/routes/adminPortalRoute.ts
 *
 * Super-admin back office for the audit flow. Everything is authorised server-side:
 * Bearer <Supabase access token> of a user with an ACTIVE super_admin_profiles row.
 *
 *   GET  admin-overview  /admin/portal/overview   auditors, clients, reviews, access requests, activity, settings
 *   GET  admin-detail    /admin/portal/review     one client in full (?profile=<id> and/or ?cycle=<id>)
 *   GET  admin-file      /admin/portal/file       stream any stored document (?id=<file id>)
 *   POST admin-action    /admin/portal/action     every mutation, selected by `op`
 *
 * Mounted from kycUploadRoute.ts so on Vercel it rides api/email-handler (no new function).
 * Internal paths are /kyc/admin-*; the public paths are aliases (see vercel.json).
 */
import { Router, json, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const router = Router();
const BUCKET = 'validation-docs';

const db = () =>
  createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    {
      auth: { persistSession: false, autoRefreshToken: false },
      // Node < 22 has no global WebSocket; this route never uses Realtime.
      realtime: { transport: class NoRealtime {} as never },
    },
  );

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const safeName = (n: string) => n.replace(/[^\w.\- ()&]/g, '_').slice(0, 120);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── auth ─────────────────────────────────────────────────────────────────────
async function adminFrom(req: Request) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const supa = db();
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: sa } = await supa.from('super_admin_profiles').select('user_id, is_active').eq('user_id', data.user.id).maybeSingle();
  if (!sa || !sa.is_active) return null;
  return data.user;
}

async function log(actor: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await db().from('audit_log').insert({
    actor_user_id: actor, action, entity_type: entityType, entity_id: entityId && UUID.test(entityId) ? entityId : null,
    metadata: { actorRole: 'super_admin', ...metadata },
  });
}

export async function getAccessMode(): Promise<'auto' | 'admin'> {
  try {
    const { data } = await db().from('platform_settings').select('value').eq('key', 'auditor_access_mode').maybeSingle();
    const v = String((data?.value as unknown) ?? '').replace(/"/g, '').toLowerCase();
    if (v === 'admin' || v === 'auto') return v;
  } catch { /* table missing → fall back to env */ }
  return (process.env.AUDITOR_ACCESS_MODE ?? 'admin').toLowerCase() === 'auto' ? 'auto' : 'admin';
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═════════════════════════════════════════════════════════════════════════════
async function overviewHandler(req: Request, res: Response) {
  try {
    const admin = await adminFrom(req);
    if (!admin) return res.status(403).json({ ok: false, message: 'Super admin access required.' });
    const supa = db();

    const [cycles, aps, certs, files, profs, logs, orgs] = await Promise.all([
      supa.from('review_cycles').select('*').order('created_at', { ascending: false }).limit(1000),
      supa.from('auditor_profiles').select('*'),
      supa.from('certificates').select('review_cycle_id, certificate_no, issued_at, revoked_at, revoked_reason'),
      supa.from('validation_zoho_files').select('id, review_cycle_id, profile_id, size_bytes'),
      supa.from('profiles').select('id, full_name, email, account_type, company_name, firm_name, industry, gstin, selected_plan, approval_status, approved_at, kyc_verified, zoho_folder_url, created_at').limit(3000),
      supa.from('audit_log').select('id, actor_user_id, action, entity_type, entity_id, metadata, created_at').order('created_at', { ascending: false }).limit(200),
      supa.from('organizations').select('id, owner_profile_id, name, industry, employee_count, acts_covered, state').limit(3000),
    ]);

    const profById = new Map((profs.data ?? []).map((p: any) => [p.id, p]));
    const orgById = new Map((orgs.data ?? []).map((o: any) => [o.id, o]));
    const certByCycle = new Map((certs.data ?? []).map((c: any) => [c.review_cycle_id, c]));
    const auditorIds = new Set((aps.data ?? []).map((a: any) => a.user_id));
    const filesByCycle = new Map<string, number>();
    const filesByProfile = new Map<string, number>();
    for (const f of files.data ?? []) {
      if (f.review_cycle_id) filesByCycle.set(f.review_cycle_id, (filesByCycle.get(f.review_cycle_id) ?? 0) + 1);
      filesByProfile.set(f.profile_id, (filesByProfile.get(f.profile_id) ?? 0) + 1);
    }

    const reviews = (cycles.data ?? []).map((c: any) => {
      const org: any = orgById.get(c.organization_id) ?? {};
      const owner: any = profById.get(org.owner_profile_id) ?? {};
      const aud: any = profById.get(c.assigned_auditor_id) ?? {};
      const snap: any = c.l2_snapshot ?? {};
      const issues: any[] = snap.issues ?? [];
      const cert: any = certByCycle.get(c.id);
      return {
        id: c.id, profileId: org.owner_profile_id ?? null, company: org.name || owner.company_name || owner.full_name || 'Unnamed',
        industry: org.industry ?? '', employees: org.employee_count ?? 0, status: c.status, accessStatus: c.access_status ?? 'none',
        l2Score: Number(c.l2_score ?? 0), l2CompletedAt: c.l2_completed_at, decidedAt: c.decided_at, createdAt: c.created_at,
        auditorId: c.assigned_auditor_id ?? null, auditorName: aud.full_name || aud.email || '',
        termsAcceptedAt: c.terms_accepted_at ?? null, files: filesByCycle.get(c.id) ?? 0,
        docs: (snap.docs ?? []).length, openIssues: issues.filter((i) => !i.resolved).length,
        criticalIssues: issues.filter((i) => !i.resolved && i.severity === 'critical').length,
        certificate: cert ? { certificateNo: cert.certificate_no, issuedAt: cert.issued_at, revoked: !!cert.revoked_at, revokedReason: cert.revoked_reason ?? '' } : null,
      };
    });
    const latestByProfile = new Map<string, any>();
    for (const r of reviews) if (r.profileId && !latestByProfile.has(r.profileId)) latestByProfile.set(r.profileId, r);

    const clients = (profs.data ?? []).filter((p: any) => !auditorIds.has(p.id)).map((p: any) => {
      const r = latestByProfile.get(p.id);
      return {
        id: p.id, fullName: p.full_name, email: p.email, accountType: p.account_type, company: p.company_name || p.firm_name || '',
        industry: p.industry ?? '', plan: p.selected_plan, approval: p.approval_status, kycVerified: !!p.kyc_verified,
        zohoFolderUrl: p.zoho_folder_url ?? null, createdAt: p.created_at, files: filesByProfile.get(p.id) ?? 0,
        reviewId: r?.id ?? null, reviewStatus: r?.status ?? null, l2Score: r?.l2Score ?? null, openIssues: r?.openIssues ?? 0,
        certificate: r?.certificate ?? null,
      };
    });

    const auditors = (aps.data ?? []).map((a: any) => {
      const p: any = profById.get(a.user_id) ?? {};
      const mine = reviews.filter((r) => r.auditorId === a.user_id);
      const decided = mine.filter((r) => r.decidedAt && r.l2CompletedAt);
      const days = decided.map((r) => Math.round((+new Date(r.decidedAt) - +new Date(r.l2CompletedAt)) / 86400000));
      return {
        id: a.user_id, fullName: p.full_name || '', email: String(p.email ?? '').toLowerCase(), licenseId: a.license_id,
        specialization: a.specialization, joinedAt: a.joined_at, active: !!a.is_active,
        inReview: mine.filter((r) => r.status === 'in_review').length, approved: mine.filter((r) => r.status === 'approved').length,
        changesRequested: mine.filter((r) => r.status === 'changes_requested').length, rejected: mine.filter((r) => r.status === 'rejected').length,
        awaitingAccess: mine.filter((r) => r.accessStatus === 'requested').length,
        avgTurnaroundDays: days.length ? Math.round((days.reduce((s, n) => s + n, 0) / days.length) * 10) / 10 : null,
      };
    });

    const activity = (logs.data ?? []).map((l: any) => {
      const p: any = profById.get(l.actor_user_id) ?? {};
      const m: any = l.metadata ?? {};
      return {
        id: String(l.id), actor: p.full_name || m.actor || (l.actor_user_id ? 'User' : 'System'),
        actorRole: m.actorRole || (auditorIds.has(l.actor_user_id) ? 'auditor' : 'system'),
        action: l.action, detail: m.detail || '', entityType: l.entity_type, entityId: l.entity_id, createdAt: l.created_at,
      };
    });

    res.json({
      ok: true, accessMode: await getAccessMode(), auditors, clients, reviews,
      accessRequests: reviews.filter((r) => r.accessStatus === 'requested'), activity,
    });
  } catch (e) {
    console.error('[admin overview]', e);
    res.status(500).json({ ok: false, message: 'Could not load the admin overview.' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// DETAIL — one client, everything
// ═════════════════════════════════════════════════════════════════════════════
async function detailHandler(req: Request, res: Response) {
  try {
    const admin = await adminFrom(req);
    if (!admin) return res.status(403).json({ ok: false, message: 'Super admin access required.' });
    const supa = db();
    let cycleId = str(req.query.cycle, 60);
    let profileId = str(req.query.profile, 60);
    if (cycleId && !UUID.test(cycleId)) return res.status(400).json({ ok: false, message: 'Bad id.' });
    if (profileId && !UUID.test(profileId)) return res.status(400).json({ ok: false, message: 'Bad id.' });

    let org: any = null;
    if (cycleId) {
      const { data: c } = await supa.from('review_cycles').select('organization_id').eq('id', cycleId).maybeSingle();
      if (!c) return res.status(404).json({ ok: false, message: 'Review not found.' });
      const { data: o } = await supa.from('organizations').select('*').eq('id', c.organization_id).maybeSingle();
      org = o; profileId = profileId || (o?.owner_profile_id as string) || '';
    }
    if (!profileId) return res.status(400).json({ ok: false, message: 'profile or cycle required.' });
    if (!org) { const { data: o } = await supa.from('organizations').select('*').eq('owner_profile_id', profileId).limit(1).maybeSingle(); org = o; }

    const [{ data: profile }, { data: cp }, { data: kycReqs }, { data: kycFiles }, { data: vfiles }] = await Promise.all([
      supa.from('profiles').select('*').eq('id', profileId).maybeSingle(),
      supa.from('company_profiles').select('*').eq('user_id', profileId).maybeSingle(),
      supa.from('kyc_requests').select('id, documents, amount, currency, due_date, note, docs_received, payment_received, status, created_at, submitted_at, payment_method, payment_reference, payment_paid_on').eq('profile_id', profileId).order('created_at', { ascending: false }),
      supa.from('kyc_files').select('id, request_id, doc_label, file_name, mime_type, size_bytes, zoho_url, created_at').eq('profile_id', profileId),
      supa.from('validation_zoho_files').select('id, review_cycle_id, doc_name, doc_role, file_name, mime_type, size_bytes, zoho_url, uploaded_at, storage_key').eq('profile_id', profileId).order('uploaded_at', { ascending: false }),
    ]);
    if (!profile) return res.status(404).json({ ok: false, message: 'Client not found.' });

    const { data: cycles } = org
      ? await supa.from('review_cycles').select('*').eq('organization_id', org.id).order('created_at', { ascending: false })
      : { data: [] as any[] };
    const cur: any = (cycleId ? (cycles ?? []).find((c: any) => c.id === cycleId) : (cycles ?? [])[0]) ?? null;
    cycleId = cur?.id ?? '';

    const { data: cert } = cycleId ? await supa.from('certificates').select('certificate_no, issued_at, revoked_at, revoked_reason, issued_by, pdf_sha256').eq('review_cycle_id', cycleId).maybeSingle() : { data: null as any };
    const actorIds = [cur?.assigned_auditor_id, cert?.issued_by].filter(Boolean) as string[];
    const { data: actors } = actorIds.length ? await supa.from('profiles').select('id, full_name, email').in('id', actorIds) : { data: [] as any[] };
    const { data: logs } = cycleId
      ? await supa.from('audit_log').select('id, actor_user_id, action, metadata, created_at').or(`entity_id.eq.${cycleId},actor_user_id.eq.${profileId}`).order('created_at', { ascending: false }).limit(60)
      : { data: [] as any[] };
    const nameOf = (id: string) => (actors ?? []).find((a: any) => a.id === id);
    const snap: any = cur?.l2_snapshot ?? {};

    res.json({
      ok: true,
      profile: { id: profile.id, fullName: profile.full_name, email: profile.email, accountType: profile.account_type, company: profile.company_name || profile.firm_name || '',
        industry: profile.industry, gstin: profile.gstin, plan: profile.selected_plan, approval: profile.approval_status, approvedAt: profile.approved_at,
        kycVerified: !!profile.kyc_verified, zohoFolderUrl: profile.zoho_folder_url, createdAt: profile.created_at },
      company: cp ?? null,
      organization: org ? { id: org.id, name: org.name, industry: org.industry, cin: org.cin, gstin: org.gstin, address: org.address, state: org.state, employees: org.employee_count, acts: org.acts_covered } : null,
      kyc: (kycReqs ?? []).map((k: any) => ({ ...k, files: (kycFiles ?? []).filter((f: any) => f.request_id === k.id) })),
      files: (vfiles ?? []).map((f: any) => ({ id: f.id, reviewId: f.review_cycle_id, docName: f.doc_name, role: f.doc_role, fileName: f.file_name, mimeType: f.mime_type,
        size: f.size_bytes, zohoUrl: f.zoho_url, at: f.uploaded_at, stored: !!f.storage_key })),
      reviews: (cycles ?? []).map((c: any) => ({ id: c.id, status: c.status, accessStatus: c.access_status, l2Score: c.l2_score, createdAt: c.created_at, decidedAt: c.decided_at })),
      review: cur ? {
        id: cur.id, status: cur.status, accessStatus: cur.access_status ?? 'none', l2Score: Number(cur.l2_score ?? 0), l2CompletedAt: cur.l2_completed_at,
        decidedAt: cur.decided_at, remarks: cur.decision_remarks ?? '', termsAcceptedAt: cur.terms_accepted_at, termsVersion: cur.terms_version,
        auditor: cur.assigned_auditor_id ? { id: cur.assigned_auditor_id, ...(nameOf(cur.assigned_auditor_id) ? { fullName: nameOf(cur.assigned_auditor_id).full_name, email: nameOf(cur.assigned_auditor_id).email } : {}) } : null,
        docs: snap.docs ?? [], issues: snap.issues ?? [], selectedActs: snap.selectedActs ?? [], missingFiles: snap.missingFiles ?? [],
        certificate: cert ? { certificateNo: cert.certificate_no, issuedAt: cert.issued_at, revoked: !!cert.revoked_at, revokedReason: cert.revoked_reason ?? '', issuedBy: nameOf(cert.issued_by)?.full_name ?? '', sha256: cert.pdf_sha256 } : null,
      } : null,
      activity: (logs ?? []).map((l: any) => ({ id: String(l.id), action: l.action, detail: l.metadata?.detail ?? '', actorRole: l.metadata?.actorRole ?? '', createdAt: l.created_at })),
    });
  } catch (e) {
    console.error('[admin detail]', e);
    res.status(500).json({ ok: false, message: 'Could not load the client.' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE — stream any stored document to the admin
// ═════════════════════════════════════════════════════════════════════════════
async function fileHandler(req: Request, res: Response) {
  try {
    const admin = await adminFrom(req);
    if (!admin) return res.status(403).json({ ok: false, message: 'Super admin access required.' });
    const id = str(req.query.id, 60);
    if (!UUID.test(id)) return res.status(400).json({ ok: false, message: 'Bad id.' });
    const supa = db();
    const { data: f } = await supa.from('validation_zoho_files').select('storage_key, file_name, mime_type, review_cycle_id').eq('id', id).maybeSingle();
    if (!f?.storage_key) return res.status(404).json({ ok: false, message: 'File not stored.' });
    const { data, error } = await supa.storage.from(BUCKET).download(f.storage_key as string);
    if (error || !data) return res.status(404).json({ ok: false, message: 'File not found.' });
    await log(admin.id, 'admin.file_view', 'review_cycle', (f.review_cycle_id as string) ?? null, { detail: `Opened ${f.file_name}` });
    res.setHeader('Content-Type', (f.mime_type as string) || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeName(String(f.file_name))}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(Buffer.from(await data.arrayBuffer()));
  } catch (e) {
    console.error('[admin file]', e);
    res.status(500).json({ ok: false, message: 'Could not open the file.' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═════════════════════════════════════════════════════════════════════════════
async function actionHandler(req: Request, res: Response) {
  try {
    const admin = await adminFrom(req);
    if (!admin) return res.status(403).json({ ok: false, message: 'Super admin access required.' });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const op = str(b.op, 40);
    const supa = db();
    const now = new Date().toISOString();

    // ── auditors ──────────────────────────────────────────────────────────────
    if (op === 'auditor_create') {
      const email = str(b.email, 200).toLowerCase();
      const fullName = str(b.fullName, 120);
      const licenseId = str(b.licenseId, 60);
      const specialization = str(b.specialization, 80) || 'General Compliance';
      if (!EMAIL.test(email) || !fullName || !licenseId) return res.status(400).json({ ok: false, message: 'Name, a valid email and a licence ID are required.' });
      const { data: dupLic } = await supa.from('auditor_profiles').select('user_id').eq('license_id', licenseId).maybeSingle();
      if (dupLic) return res.status(409).json({ ok: false, message: 'That licence ID is already in use.' });

      let userId = '';
      let tempPassword: string | null = null;
      const { data: existing } = await supa.from('profiles').select('id, account_type, company_name').eq('email', email).maybeSingle();
      if (existing) {
        if (existing.account_type === 'company' || existing.company_name) return res.status(409).json({ ok: false, message: 'That email belongs to a company account. Use a separate email for the auditor.' });
        userId = existing.id as string;
      } else {
        const pw = str(b.password, 100) || randomBytes(9).toString('base64url');
        tempPassword = pw;
        if (pw.length < 10) return res.status(400).json({ ok: false, message: 'Password must be at least 10 characters.' });
        const { data: created, error } = await supa.auth.admin.createUser({
          email, password: pw, email_confirm: true, user_metadata: { full_name: fullName, account_type: 'client' },
        });
        if (error || !created.user) return res.status(400).json({ ok: false, message: error?.message || 'Could not create the login.' });
        userId = created.user.id;
      }
      const { error: pErr } = await supa.from('profiles').upsert({
        id: userId, account_type: 'client', full_name: fullName, email, approval_status: 'approved', approved_at: now, approved_by: admin.id,
      }, { onConflict: 'id' });
      if (pErr) return res.status(400).json({ ok: false, message: `Profile could not be saved: ${pErr.message}` });
      const { error: aErr } = await supa.from('auditor_profiles').upsert({ user_id: userId, license_id: licenseId, specialization, is_active: true }, { onConflict: 'user_id' });
      if (aErr) return res.status(400).json({ ok: false, message: `Auditor profile could not be saved: ${aErr.message}` });
      await log(admin.id, 'admin.auditor_create', 'auditor', userId, { detail: `Created auditor ${fullName} (${email}), licence ${licenseId}` });
      return res.json({ ok: true, userId, tempPassword });
    }

    if (op === 'auditor_update') {
      const id = str(b.id, 60);
      if (!UUID.test(id)) return res.status(400).json({ ok: false, message: 'Bad id.' });
      const patch: Record<string, unknown> = {};
      if (typeof b.licenseId === 'string' && b.licenseId.trim()) {
        const lic = str(b.licenseId, 60);
        const { data: dup } = await supa.from('auditor_profiles').select('user_id').eq('license_id', lic).neq('user_id', id).maybeSingle();
        if (dup) return res.status(409).json({ ok: false, message: 'That licence ID is already in use.' });
        patch.license_id = lic;
      }
      if (typeof b.specialization === 'string') patch.specialization = str(b.specialization, 80);
      if (typeof b.active === 'boolean') {
        patch.is_active = b.active;
        if (!b.active) {
          // a deactivated auditor must not keep holding reviews: send them back to the queue
          await supa.from('review_cycles').update({ status: 'pending', assigned_auditor_id: null, terms_accepted_at: null, terms_version: null, access_status: 'none' })
            .eq('assigned_auditor_id', id).eq('status', 'in_review');
        }
      }
      if (typeof b.fullName === 'string' && b.fullName.trim()) await supa.from('profiles').update({ full_name: str(b.fullName, 120), updated_at: now }).eq('id', id);
      if (Object.keys(patch).length) {
        const { error } = await supa.from('auditor_profiles').update(patch).eq('user_id', id);
        if (error) throw error;
      }
      await log(admin.id, 'admin.auditor_update', 'auditor', id, { detail: `Updated auditor: ${Object.keys({ ...patch, ...(b.fullName ? { name: 1 } : {}) }).join(', ')}` });
      return res.json({ ok: true });
    }

    // ── reviews ───────────────────────────────────────────────────────────────
    if (['approve_access', 'deny_access', 'release', 'assign', 'revoke_cert', 'restore_cert'].includes(op)) {
      const id = str(b.id, 60);
      if (!UUID.test(id)) return res.status(400).json({ ok: false, message: 'Bad id.' });
      const note = str(b.note, 400);
      const { data: c } = await supa.from('review_cycles').select('id, status, assigned_auditor_id, access_status').eq('id', id).maybeSingle();
      if (!c) return res.status(404).json({ ok: false, message: 'Review not found.' });

      if (op === 'approve_access') {
        if (!c.assigned_auditor_id) return res.status(409).json({ ok: false, message: 'No auditor is assigned to this review.' });
        await supa.from('review_cycles').update({ access_status: 'approved' }).eq('id', id);
      } else if (op === 'deny_access') {
        await supa.from('review_cycles').update({ access_status: 'denied' }).eq('id', id);
      } else if (op === 'release') {
        if (c.status === 'approved') return res.status(409).json({ ok: false, message: 'An approved review cannot be released.' });
        await supa.from('review_cycles').update({ status: 'pending', assigned_auditor_id: null, terms_accepted_at: null, terms_version: null, access_status: 'none' }).eq('id', id);
      } else if (op === 'assign') {
        const auditorId = str(b.auditorId, 60);
        const { data: ap } = await supa.from('auditor_profiles').select('is_active').eq('user_id', auditorId).maybeSingle();
        if (!ap?.is_active) return res.status(400).json({ ok: false, message: 'Pick an active auditor.' });
        if (c.status === 'approved') return res.status(409).json({ ok: false, message: 'An approved review cannot be reassigned.' });
        // The auditor still has to accept the terms before documents unlock (see auditor claim).
        await supa.from('review_cycles').update({ status: 'in_review', assigned_auditor_id: auditorId, terms_accepted_at: null, terms_version: null, access_status: 'approved' }).eq('id', id);
      } else if (op === 'revoke_cert' || op === 'restore_cert') {
        const revoke = op === 'revoke_cert';
        if (revoke && !note) return res.status(400).json({ ok: false, message: 'A reason is required to revoke a certificate.' });
        const { error } = await supa.from('certificates').update(revoke ? { revoked_at: now, revoked_reason: note } : { revoked_at: null, revoked_reason: null }).eq('review_cycle_id', id);
        if (error) throw error;
      }
      await log(admin.id, `admin.${op}`, 'review_cycle', id, { detail: `${op.replace('_', ' ')}${note ? ` — ${note}` : ''}` });
      return res.json({ ok: true });
    }

    // ── settings ──────────────────────────────────────────────────────────────
    if (op === 'set_access_mode') {
      const mode = b.mode === 'auto' ? 'auto' : 'admin';
      const { error } = await supa.from('platform_settings').upsert({ key: 'auditor_access_mode', value: mode, updated_at: now, updated_by: admin.id }, { onConflict: 'key' });
      if (error) return res.status(400).json({ ok: false, message: `Setting could not be saved (run the SQL migration): ${error.message}` });
      await log(admin.id, 'admin.set_access_mode', 'settings', null, { detail: `Auditor access mode set to ${mode}` });
      return res.json({ ok: true, mode });
    }

    return res.status(400).json({ ok: false, message: 'Unknown action.' });
  } catch (e) {
    console.error('[admin action]', e);
    res.status(500).json({ ok: false, message: 'The action failed.' });
  }
}

// ── routes ───────────────────────────────────────────────────────────────────
router.use(['/kyc', '/admin/portal'], json({ limit: '1mb' }));
const R = (m: 'get' | 'post', internal: string, pub: string, h: (q: Request, r: Response) => unknown) => {
  router[m](`/kyc/${internal}`, h); router[m](pub, h);
};
R('get', 'admin-overview', '/admin/portal/overview', overviewHandler);
R('get', 'admin-detail', '/admin/portal/review', detailHandler);
R('get', 'admin-file', '/admin/portal/file', fileHandler);
R('post', 'admin-action', '/admin/portal/action', actionHandler);

export default router;
