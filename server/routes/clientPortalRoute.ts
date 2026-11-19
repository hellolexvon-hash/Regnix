/**
 * server/routes/clientPortalRoute.ts
 *
 * Client dashboard back-end (rides the existing api/email-handler function):
 *   cli-notifications  GET   role-aware activity feed (client / auditor / admin)
 *   cli-documents      GET   every document the company uploaded (Zoho WorkDrive + private copy)
 *   cli-doc-file       GET   ?id=  stream the private copy of one of the caller's own files
 *   cli-planner        GET   audit planner: review cycles, statutory calendar, next actions
 *   cli-assistant      POST  AI compliance agent (Anthropic via ANTHROPIC_API_KEY, offline fallback)
 *
 * Internal path /kyc/<name>; public alias /client/<...>. Auth: Supabase Bearer token.
 */
import { Router, json, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const BUCKET = 'validation-docs';

const db = () =>
  createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: class NoRealtime {} as never } },
  );

async function userFrom(req: Request) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await db().auth.getUser(token);
  return error || !data.user ? null : data.user;
}

const safeName = (n: string) => n.replace(/[^\w.\- ()&]/g, '_').slice(0, 120);
type Note = { id: string; kind: 'success' | 'warning' | 'info' | 'danger'; title: string; detail: string; at: string; link?: string };

async function roleOf(id: string): Promise<'admin' | 'auditor' | 'client'> {
  const supa = db();
  const [{ data: sa }, { data: ap }] = await Promise.all([
    supa.from('super_admin_profiles').select('user_id').eq('user_id', id).maybeSingle(),
    supa.from('auditor_profiles').select('user_id, is_active').eq('user_id', id).maybeSingle(),
  ]);
  if (sa) return 'admin';
  if (ap?.is_active) return 'auditor';
  return 'client';
}

async function orgIdsOf(userId: string): Promise<string[]> {
  const supa = db();
  const [{ data: owned }, { data: member }] = await Promise.all([
    supa.from('organizations').select('id').eq('owner_profile_id', userId),
    supa.from('organization_members').select('organization_id').eq('user_id', userId),
  ]);
  return [...new Set([...(owned ?? []).map((o) => o.id as string), ...(member ?? []).map((m) => m.organization_id as string)])];
}

// ═════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS — derived from review_cycles + audit_log, so nothing extra to maintain
// ═════════════════════════════════════════════════════════════════════════════
async function notificationsHandler(req: Request, res: Response) {
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Sign in required.' });
    const supa = db();
    const role = await roleOf(user.id);
    const notes: Note[] = [];

    if (role === 'client') {
      const orgIds = await orgIdsOf(user.id);
      const { data: cycles } = orgIds.length
        ? await supa.from('review_cycles').select('id, status, access_status, assigned_auditor_id, l2_completed_at, decided_at, decision_remarks, reporting_month, created_at').in('organization_id', orgIds).order('created_at', { ascending: false }).limit(10)
        : { data: [] as any[] };
      const audIds = [...new Set((cycles ?? []).map((c) => c.assigned_auditor_id as string).filter(Boolean))];
      const { data: auds } = audIds.length ? await supa.from('profiles').select('id, full_name').in('id', audIds) : { data: [] as any[] };
      const nm = (id: string) => (auds ?? []).find((a: any) => a.id === id)?.full_name || 'An auditor';
      for (const c of cycles ?? []) {
        const month = c.reporting_month ? String(c.reporting_month).slice(0, 7) : '';
        if (c.l2_completed_at) notes.push({ id: `${c.id}-sub`, kind: 'info', title: 'Submitted for audit', detail: `Your ${month} validation is in the audit queue.`, at: c.l2_completed_at, link: '/dashboard/planner' });
        if (c.assigned_auditor_id) notes.push({ id: `${c.id}-asg`, kind: 'info', title: 'Auditor assigned', detail: `${nm(c.assigned_auditor_id)} is now reviewing your submission.`, at: c.decided_at ?? c.l2_completed_at ?? c.created_at, link: '/dashboard/planner' });
        if (c.status === 'approved') notes.push({ id: `${c.id}-ok`, kind: 'success', title: 'Audit approved', detail: 'Your audit certificate is ready to download.', at: c.decided_at ?? c.created_at, link: '/dashboard/planner' });
        if (c.status === 'changes_requested') notes.push({ id: `${c.id}-chg`, kind: 'warning', title: 'Auditor requested changes', detail: c.decision_remarks || 'Please review the auditor remarks and re-submit.', at: c.decided_at ?? c.created_at, link: '/dashboard/validation' });
        if (c.status === 'rejected') notes.push({ id: `${c.id}-rej`, kind: 'danger', title: 'Audit rejected', detail: c.decision_remarks || 'See the auditor remarks for details.', at: c.decided_at ?? c.created_at, link: '/dashboard/validation' });
      }
    } else if (role === 'auditor') {
      const { data: cycles } = await supa.from('review_cycles').select('id, status, access_status, assigned_auditor_id, l2_completed_at, organization_id')
        .not('l2_completed_at', 'is', null).order('l2_completed_at', { ascending: false }).limit(40);
      const orgIds = [...new Set((cycles ?? []).map((c) => c.organization_id as string))];
      const { data: orgs } = orgIds.length ? await supa.from('organizations').select('id, name').in('id', orgIds) : { data: [] as any[] };
      const on = (id: string) => (orgs ?? []).find((o: any) => o.id === id)?.name || 'A company';
      for (const c of cycles ?? []) {
        if (c.assigned_auditor_id === user.id && c.access_status === 'requested') notes.push({ id: `${c.id}-wait`, kind: 'info', title: 'Access requested', detail: `Waiting for Regnix to approve your access to ${on(c.organization_id)}.`, at: c.l2_completed_at });
        else if (c.assigned_auditor_id === user.id && c.access_status === 'denied') notes.push({ id: `${c.id}-deny`, kind: 'danger', title: 'Access denied', detail: `Regnix did not approve your access to ${on(c.organization_id)}.`, at: c.l2_completed_at });
        else if (c.assigned_auditor_id === user.id && c.status === 'in_review') notes.push({ id: `${c.id}-mine`, kind: 'warning', title: 'Access approved — review ready', detail: `${on(c.organization_id)} is open for your audit.`, at: c.l2_completed_at });
        else if (c.status === 'pending' && !c.assigned_auditor_id) notes.push({ id: `${c.id}-new`, kind: 'info', title: 'New submission', detail: `${on(c.organization_id)} submitted for audit.`, at: c.l2_completed_at });
      }
    } else {
      const [{ data: reqs }, { data: fresh }] = await Promise.all([
        supa.from('review_cycles').select('id, organization_id, l2_completed_at, assigned_auditor_id').eq('access_status', 'requested').order('l2_completed_at', { ascending: false }).limit(20),
        supa.from('review_cycles').select('id, organization_id, l2_completed_at').eq('status', 'pending').is('assigned_auditor_id', null).not('l2_completed_at', 'is', null).order('l2_completed_at', { ascending: false }).limit(20),
      ]);
      const orgIds = [...new Set([...(reqs ?? []), ...(fresh ?? [])].map((c: any) => c.organization_id as string))];
      const { data: orgs } = orgIds.length ? await supa.from('organizations').select('id, name').in('id', orgIds) : { data: [] as any[] };
      const on = (id: string) => (orgs ?? []).find((o: any) => o.id === id)?.name || 'A company';
      for (const c of reqs ?? []) notes.push({ id: `${c.id}-req`, kind: 'warning', title: 'Auditor access request', detail: `An auditor is asking for access to ${on(c.organization_id)}.`, at: c.l2_completed_at ?? new Date().toISOString() });
      for (const c of fresh ?? []) notes.push({ id: `${c.id}-unassigned`, kind: 'info', title: 'Submission needs an auditor', detail: `${on(c.organization_id)} is waiting to be assigned.`, at: c.l2_completed_at });
    }

    notes.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    res.json({ ok: true, role, notifications: notes.slice(0, 30) });
  } catch (e) {
    console.error('[client notifications]', e);
    res.status(500).json({ ok: false, message: 'Could not load notifications.' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENTS — everything the company has uploaded to Zoho WorkDrive
// ═════════════════════════════════════════════════════════════════════════════
async function documentsHandler(req: Request, res: Response) {
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Sign in required.' });
    const supa = db();
    const [{ data: val }, { data: kyc }, { data: prof }, { data: folder }] = await Promise.all([
      supa.from('validation_zoho_files').select('id, doc_name, doc_role, file_name, mime_type, size_bytes, zoho_file_id, zoho_url, storage_key, uploaded_at, review_cycle_id').eq('profile_id', user.id).order('uploaded_at', { ascending: false }).limit(500),
      supa.from('kyc_files').select('id, doc_label, file_name, mime_type, size_bytes, zoho_file_id, zoho_url, created_at').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(200),
      supa.from('profiles').select('zoho_folder_url').eq('id', user.id).maybeSingle(),
      supa.from('zoho_company_folders').select('*').eq('profile_id', user.id).maybeSingle(),
    ]);
    const documents = [
      ...(val ?? []).map((f: any) => ({
        id: f.id, source: 'validation' as const, category: f.doc_role === 'live_register' ? 'Live register' : 'Validation document',
        name: f.doc_name || f.file_name, fileName: f.file_name, mimeType: f.mime_type, size: Number(f.size_bytes) || 0,
        at: f.uploaded_at, zohoUrl: f.zoho_url ?? null, inZoho: !!f.zoho_file_id || !!f.zoho_url, canPreview: !!f.storage_key, reviewCycleId: f.review_cycle_id,
      })),
      ...(kyc ?? []).map((f: any) => ({
        id: f.id, source: 'kyc' as const, category: 'KYC', name: f.doc_label || f.file_name, fileName: f.file_name, mimeType: f.mime_type,
        size: Number(f.size_bytes) || 0, at: f.created_at, zohoUrl: f.zoho_url ?? null, inZoho: !!f.zoho_file_id || !!f.zoho_url, canPreview: false, reviewCycleId: null,
      })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    res.json({ ok: true, documents, folderUrl: prof?.zoho_folder_url ?? (folder as any)?.folder_url ?? null });
  } catch (e) {
    console.error('[client documents]', e);
    res.status(500).json({ ok: false, message: 'Could not load documents.' });
  }
}

async function docFileHandler(req: Request, res: Response) {
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Sign in required.' });
    const id = String(req.query.id ?? '');
    const { data: f } = await db().from('validation_zoho_files').select('profile_id, file_name, mime_type, storage_key').eq('id', id).maybeSingle();
    if (!f || f.profile_id !== user.id || !f.storage_key) return res.status(404).json({ ok: false, message: 'File not found.' });
    const { data, error } = await db().storage.from(BUCKET).download(f.storage_key as string);
    if (error || !data) return res.status(404).json({ ok: false, message: 'File not available.' });
    res.setHeader('Content-Type', (f.mime_type as string) || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeName(String(f.file_name))}"`);
    res.send(Buffer.from(await data.arrayBuffer()));
  } catch (e) {
    console.error('[client doc file]', e);
    res.status(500).json({ ok: false, message: 'Download failed.' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// AUDIT PLANNER — review cycles + a rolling statutory calendar
// ═════════════════════════════════════════════════════════════════════════════
const STAGES = ['Documents uploaded', 'Level 2 validation', 'Auditor assigned', 'Audit decision', 'Certificate'];

async function plannerHandler(req: Request, res: Response) {
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Sign in required.' });
    const supa = db();
    const orgIds = await orgIdsOf(user.id);
    const { data: cycles } = orgIds.length
      ? await supa.from('review_cycles').select('id, status, reporting_month, l2_score, l2_completed_at, assigned_auditor_id, decided_at, decision_remarks, access_status, created_at, l2_snapshot').in('organization_id', orgIds).order('reporting_month', { ascending: false }).limit(24)
      : { data: [] as any[] };
    const ids = (cycles ?? []).map((c) => c.id as string);
    const audIds = [...new Set((cycles ?? []).map((c) => c.assigned_auditor_id as string).filter(Boolean))];
    const [{ data: certs }, { data: auds }, { data: files }] = await Promise.all([
      ids.length ? supa.from('certificates').select('review_cycle_id, certificate_no, issued_at, revoked_at').in('review_cycle_id', ids) : Promise.resolve({ data: [] as any[] }),
      audIds.length ? supa.from('profiles').select('id, full_name').in('id', audIds) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supa.from('validation_zoho_files').select('review_cycle_id').in('review_cycle_id', ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const reviews = (cycles ?? []).map((c: any) => {
      const cert = (certs ?? []).find((x: any) => x.review_cycle_id === c.id);
      const stage = c.status === 'approved' ? (cert ? 5 : 4) : c.status === 'in_review' ? 3 : c.l2_completed_at ? 2 : 1;
      const snap = c.l2_snapshot ?? {};
      return {
        id: c.id, month: c.reporting_month, status: c.status, stage, stages: STAGES,
        score: c.l2_score != null ? Number(c.l2_score) : null, submittedAt: c.l2_completed_at, decidedAt: c.decided_at,
        remarks: c.decision_remarks ?? '', auditor: (auds ?? []).find((a: any) => a.id === c.assigned_auditor_id)?.full_name ?? null,
        openIssues: (snap.issues ?? []).filter((i: any) => !i.resolved).length, files: (files ?? []).filter((f: any) => f.review_cycle_id === c.id).length,
        certificate: cert ? { no: cert.certificate_no, issuedAt: cert.issued_at, revoked: !!cert.revoked_at } : null,
      };
    });

    // Rolling statutory calendar (standard Indian due dates) — next 3 months
    const now = new Date();
    const calendar: { date: string; title: string; act: string; type: 'monthly' | 'quarterly' | 'annual' }[] = [];
    for (let m = 0; m < 3; m++) {
      const d = (day: number) => new Date(now.getFullYear(), now.getMonth() + m, day).toISOString().slice(0, 10);
      calendar.push({ date: d(7), title: 'TDS deposit', act: 'Income Tax Act', type: 'monthly' });
      calendar.push({ date: d(15), title: 'EPF ECR & contribution', act: 'EPF & MP Act', type: 'monthly' });
      calendar.push({ date: d(15), title: 'ESIC contribution', act: 'ESI Act', type: 'monthly' });
      calendar.push({ date: d(20), title: 'GSTR-3B', act: 'GST', type: 'monthly' });
    }
    for (const [mo, day, title, act] of [[3, 15, 'Q1 TDS return (24Q)', 'Income Tax Act'], [6, 15, 'Q2 TDS return (24Q)', 'Income Tax Act'], [9, 31, 'Annual return — Form 5 (CLRA)', 'CLRA'], [0, 30, 'Half-yearly return — Factories Act', 'Factories Act']] as [number, number, string, string][]) {
      const y = new Date(now.getFullYear(), mo, day) < now ? now.getFullYear() + 1 : now.getFullYear();
      calendar.push({ date: new Date(y, mo, day).toISOString().slice(0, 10), title, act, type: mo === 9 || mo === 0 ? 'annual' : 'quarterly' });
    }
    const today = now.toISOString().slice(0, 10);
    const horizon = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString().slice(0, 10);
    const upcoming = calendar.filter((c) => c.date >= today && c.date <= horizon).sort((a, b) => a.date.localeCompare(b.date));

    const current = reviews[0];
    const actions: { title: string; detail: string; tone: 'danger' | 'warning' | 'info'; link: string }[] = [];
    if (!current) actions.push({ title: 'Start your first validation', detail: 'Upload your registers to begin Level 1 validation.', tone: 'info', link: '/dashboard/validation' });
    else if (current.status === 'changes_requested') actions.push({ title: 'Address auditor remarks', detail: current.remarks || 'Open the validation and resolve the flagged items.', tone: 'danger', link: '/dashboard/validation' });
    else if (current.openIssues > 0 && current.status !== 'approved') actions.push({ title: `Resolve ${current.openIssues} open issue(s)`, detail: 'Open issues lower your audit score.', tone: 'warning', link: '/dashboard/validation' });
    res.json({ ok: true, reviews, upcoming, actions });
  } catch (e) {
    console.error('[client planner]', e);
    res.status(500).json({ ok: false, message: 'Could not load the planner.' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// AI COMPLIANCE AGENT — server-side so the API key never reaches the browser
// ═════════════════════════════════════════════════════════════════════════════
const SYSTEM = `You are Regnix AI, an Indian labour-law and statutory compliance assistant on the Regnix platform (by Lexvon).
Cover EPF, ESIC, Professional Tax, Minimum Wages, Code on Wages, CLRA, Factories Act, Shops & Establishments, POSH, bonus, gratuity, registers, forms, due dates and audit readiness.
Be accurate and concise (under 180 words), use short bullet points, name the Act/section/form when you can, and say when a rule varies by state. You are not a lawyer — recommend confirming critical decisions with a professional.
You are given the user's live platform context; use it to personalise the answer.`;

const FALLBACK: [RegExp, string][] = [
  [/\bepf|provident/i, '• Employee: 12% of Basic+DA (wage ceiling ₹15,000 for mandatory cover).\n• Employer: 12% total — 8.33% EPS (capped on ₹15,000 wage) + 3.67% EPF, plus 0.5% EDLI and admin charges.\n• ECR and payment are due by the 15th of the following month.'],
  [/\besi|esic/i, '• Employee 0.75% and employer 3.25% of gross wages (cover up to ₹21,000/month).\n• Monthly contribution is due by the 15th of the next month.'],
  [/posh/i, '• POSH Act: an Internal Committee is required for 10+ employees.\n• Maintain the complaints register and file the annual report with the District Officer.'],
  [/due|file|filing|deadline/i, '• TDS: 7th · EPF/ESIC: 15th · GSTR-3B: 20th of each month.\n• Check the Audit Planner for the live calendar.'],
  [/register|form/i, '• Core registers: wages, attendance, overtime, fines/deductions, advances, leave.\n• Use Document Generator to produce them state-wise.'],
];

async function assistantHandler(req: Request, res: Response) {
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Sign in required.' });
    const msgs = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
    const clean = msgs.map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '').slice(0, 2000) })).filter((m: any) => m.content);
    if (!clean.length || clean[clean.length - 1].role !== 'user') return res.status(400).json({ ok: false, message: 'A user message is required.' });
    const view = String(req.body?.view ?? '').slice(0, 40);

    const key = process.env.ANTHROPIC_API_KEY;
    if (key) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5', max_tokens: 700, system: `${SYSTEM}\nUser is currently on the "${view || 'dashboard'}" page.`, messages: clean }),
      });
      if (r.ok) {
        const j = (await r.json()) as { content?: { type: string; text?: string }[] };
        const text = j.content?.find((b) => b.type === 'text')?.text;
        if (text) return res.json({ ok: true, reply: text, live: true });
      } else console.error('[assistant] upstream', r.status);
    }
    const q = clean[clean.length - 1].content as string;
    const hit = FALLBACK.find(([re]) => re.test(q));
    res.json({ ok: true, live: false, reply: hit ? hit[1] : 'I can help with EPF, ESIC, PT, minimum wages, registers, filing dates and audit readiness. (Live AI answers need ANTHROPIC_API_KEY on the server.)' });
  } catch (e) {
    console.error('[assistant]', e);
    res.status(500).json({ ok: false, message: 'Assistant unavailable.' });
  }
}

// ── routes ───────────────────────────────────────────────────────────────────
router.use(['/kyc', '/client'], json({ limit: '1mb' }));
const R = (m: 'get' | 'post', internal: string, pub: string, h: (q: Request, r: Response) => unknown) => {
  router[m](`/kyc/${internal}`, h); router[m](pub, h);
};
R('get', 'cli-notifications', '/client/notifications', notificationsHandler);
R('get', 'cli-documents', '/client/documents', documentsHandler);
R('get', 'cli-doc-file', '/client/document-file', docFileHandler);
R('get', 'cli-planner', '/client/planner', plannerHandler);
R('post', 'cli-assistant', '/client/assistant', assistantHandler);

export default router;
