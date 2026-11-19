/**
 * server/routes/validationDocsRoute.ts
 *
 * Validation documents → Zoho WorkDrive (+ private Supabase Storage copy),
 * Level-2 submission, auditor claim / review / decision, and certificates.
 *
 * Mounted from kycUploadRoute.ts (`router.use(validationDocsRouter)`), so on Vercel it
 * rides the existing api/email-handler function (no new serverless function).
 * Internal paths live under /kyc/* so they share the KYC route's body-size handling;
 * the public paths (used by the client and by server.ts in dev) are aliases.
 *
 * Company endpoints   : Authorization: Bearer <Supabase access token>
 * Auditor endpoints   : same, and the user must have an active auditor_profiles row
 * Certificate verify  : public
 */
import { getAccessMode } from './adminPortalRoute.js';
import { Router, json, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import * as zoho from '../lib/zohoWorkDrive.js';

const router = Router();
const BUCKET = 'validation-docs';
const SUBFOLDER = 'Company Details';
const MAX_BYTES = 3 * 1024 * 1024;
const TERMS_VERSION = 'auditor-terms-2026-11';
// 'auto' = the auditor's own claim grants access (today). 'admin' = claim only REQUESTS access;
// an admin sets review_cycles.access_status='approved' before documents/data are visible.

const db = () =>
  createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    {
      auth: { persistSession: false, autoRefreshToken: false },
      // Node < 22 has no global WebSocket, and supabase-js throws while constructing its
      // Realtime client. This route never uses Realtime, so give it an inert transport.
      realtime: { transport: class NoRealtime {} as never },
    },
  );

const MIME: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12', xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
};

function sniffOk(ext: string, b: Buffer): boolean {
  if (ext === 'pdf') return b.subarray(0, 4).toString('latin1') === '%PDF';
  if (ext === 'png') return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === 'jpg' || ext === 'jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === 'xlsx' || ext === 'xlsm' || ext === 'docx') return b[0] === 0x50 && b[1] === 0x4b;
  if (ext === 'xls' || ext === 'doc') return b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  if (ext === 'csv') return !b.includes(0);
  return false;
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const safeName = (n: string) => n.replace(/[^\w.\- ()&]/g, '_').slice(0, 120);

// ── auth ─────────────────────────────────────────────────────────────────────
async function userFrom(req: Request) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await db().auth.getUser(token);
  return error || !data.user ? null : data.user;
}

async function auditorFrom(req: Request) {
  const user = await userFrom(req);
  if (!user) return null;
  const supa = db();
  const { data: ap } = await supa.from('auditor_profiles')
    .select('user_id, license_id, specialization, joined_at, is_active').eq('user_id', user.id).maybeSingle();
  if (!ap || !ap.is_active) return null;
  const { data: p } = await supa.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    fullName: (p?.full_name as string) || user.email || 'Auditor',
    email: ((p?.email as string) || user.email || '').toLowerCase(),
    licenseId: (ap.license_id as string) || '',
    specialization: (ap.specialization as string) || '',
    joinedAt: ap.joined_at as string,
  };
}

// ── Zoho + Storage helpers ──────────────────────────────────────────────────
type SubFolderFn = (parentId: string, name: string) => Promise<{ id: string; url?: string }>;

// Creates a sub-folder inside the company's Zoho folder. Uses zohoWorkDrive.createSubFolder
// if your lib has one; otherwise calls the WorkDrive API directly with the same env vars
// (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN, India DC by default).
async function makeSubFolder(parentId: string, name: string): Promise<{ id: string }> {
  const lib = (zoho as unknown as { createSubFolder?: SubFolderFn }).createSubFolder;
  if (typeof lib === 'function') return lib(parentId, name);
  const accounts = process.env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.in';
  const api = process.env.ZOHO_API_URL ?? 'https://www.zohoapis.in';
  const tok = await fetch(`${accounts}/oauth/v2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ZOHO_CLIENT_ID ?? '',
      client_secret: process.env.ZOHO_CLIENT_SECRET ?? '',
      refresh_token: process.env.ZOHO_REFRESH_TOKEN ?? '',
    }),
  }).then((r) => r.json() as Promise<{ access_token?: string }>);
  if (!tok.access_token) throw new Error('zoho token refresh failed');
  const r = await fetch(`${api}/workdrive/api/v1/files`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${tok.access_token}`, 'Content-Type': 'application/vnd.api+json' },
    body: JSON.stringify({ data: { attributes: { name, parent_id: parentId }, type: 'files' } }),
  });
  const j = (await r.json()) as { data?: { id?: string } };
  if (!r.ok || !j.data?.id) throw new Error(`zoho create folder failed (${r.status})`);
  return { id: j.data.id };
}

async function pushToZoho(userId: string, fileName: string, mime: string, bytes: Buffer) {
  const supa = db();
  const { data: profile } = await supa.from('profiles')
    .select('company_name, firm_name, full_name, zoho_folder_id').eq('id', userId).maybeSingle();
  let companyFolder = (profile?.zoho_folder_id as string | null) ?? null;
  if (!companyFolder) {
    const name = (profile?.company_name as string) || (profile?.firm_name as string) || (profile?.full_name as string) || 'Unnamed company';
    const f = await zoho.createCompanyFolder(name);
    companyFolder = f.id;
    await supa.from('profiles').update({ zoho_folder_id: f.id, zoho_folder_url: f.url }).eq('id', userId);
  }
  let target = companyFolder;
  let stored = `${SUBFOLDER} - ${fileName}`;
  try {
    const { data: row } = await supa.from('zoho_company_folders').select('statutory_folder_id').eq('profile_id', userId).maybeSingle();
    let subId = (row?.statutory_folder_id as string | null) ?? null;
    if (!subId) {
      subId = (await makeSubFolder(companyFolder, SUBFOLDER)).id;
      await supa.from('zoho_company_folders').upsert({ profile_id: userId, statutory_folder_id: subId });
    }
    target = subId; stored = fileName;
  } catch (e) {
    console.error('[validation upload] sub-folder failed, using filename prefix', e);
  }
  const zf = await zoho.uploadFile(target, stored, mime, bytes);
  return { id: zf.id as string, url: (zf.url as string | undefined) ?? null, storedName: stored };
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPANY: upload one validation document
// ═════════════════════════════════════════════════════════════════════════════
async function uploadHandler(req: Request, res: Response) {
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Sign in required.' });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const fileName = str(b.fileName, 200);
    if (!fileName || typeof b.dataBase64 !== 'string') return res.status(400).json({ ok: false, message: 'Missing fields.' });
    const ext = (fileName.match(/\.([^./\\]+)$/)?.[1] ?? '').toLowerCase();
    const mime = MIME[ext];
    if (!mime) return res.status(415).json({ ok: false, message: 'Unsupported file type.' });
    const bytes = Buffer.from(b.dataBase64, 'base64');
    if (!bytes.length) return res.status(400).json({ ok: false, message: 'Empty file.' });
    if (bytes.length > MAX_BYTES) return res.status(413).json({ ok: false, message: 'File is larger than 3 MB.' });
    if (!sniffOk(ext, bytes)) return res.status(415).json({ ok: false, message: 'File content does not match its type.' });

    const role = b.role === 'live_register' ? 'live_register' : 'document';
    const docName = str(b.docName, 150) || fileName;
    const sha = createHash('sha256').update(bytes).digest('hex');
    const supa = db();

    const { data: existing } = await supa.from('validation_zoho_files').select('id, zoho_file_id, zoho_url, storage_key')
      .eq('profile_id', user.id).eq('sha256', sha).maybeSingle();

    const storageKey = existing?.storage_key as string | undefined ?? `${user.id}/${sha}.${ext}`;
    if (!existing?.storage_key) {
      const { error } = await supa.storage.from(BUCKET).upload(storageKey, bytes, { contentType: mime, upsert: true });
      if (error) throw error;
    }

    let zohoId = (existing?.zoho_file_id as string | null) ?? null;
    let zohoUrl = (existing?.zoho_url as string | null) ?? null;
    let storedName = fileName;
    let zohoOk = !!zohoId;
    if (!zohoId) {
      try {
        const z = await pushToZoho(user.id, fileName, mime, bytes);
        zohoId = z.id; zohoUrl = z.url; storedName = z.storedName; zohoOk = true;
      } catch (e) {
        console.error('[validation upload] zoho failed, kept in storage', e);
      }
    }

    const meta = { doc_name: docName, doc_role: role, mime_type: mime, storage_key: storageKey, zoho_file_id: zohoId, zoho_url: zohoUrl };
    if (existing) {
      await supa.from('validation_zoho_files').update(meta).eq('id', existing.id);
    } else {
      await supa.from('validation_zoho_files').insert({
        profile_id: user.id, sha256: sha, file_name: storedName, size_bytes: bytes.length, ...meta,
      });
    }
    res.json({ ok: true, zoho: zohoOk, url: zohoUrl, duplicate: !!existing });
  } catch (e) {
    console.error('[validation upload]', e);
    res.status(500).json({ ok: false, message: 'Upload failed.' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPANY: submit Level 2 → creates / refreshes the review cycle for auditors
// ═════════════════════════════════════════════════════════════════════════════
async function submitHandler(req: Request, res: Response) {
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Sign in required.' });
    const b = (req.body ?? {}) as Record<string, any>;
    const supa = db();

    const docs = (Array.isArray(b.docs) ? b.docs : []).slice(0, 80).map((d: any) => ({
      name: str(d?.name, 150), act: str(d?.act, 100) || 'General',
      status: d?.status === 'flagged' ? 'flagged' : 'validated',
      score: Math.max(0, Math.min(100, Math.round(Number(d?.score) || 0))),
    }));
    const issues = (Array.isArray(b.issues) ? b.issues : []).slice(0, 400).map((i: any) => ({
      docName: str(i?.docName, 150),
      severity: ['critical', 'major', 'minor'].includes(String(i?.severity).toLowerCase()) ? String(i.severity).toLowerCase() : 'major',
      rule: str(i?.rule, 300), rootCause: str(i?.rootCause, 400), resolved: !!i?.resolved,
    }));
    const selectedActs: string[] = (Array.isArray(b.selectedActs) ? b.selectedActs : []).map((a: unknown) => str(a, 100)).filter(Boolean);
    const l2Score = Math.max(0, Math.min(100, Number(b.l2Score) || 0));
    const missingFiles: string[] = (Array.isArray(b.missingFiles) ? b.missingFiles : []).map((a: unknown) => str(a, 150)).filter(Boolean);

    const [{ data: profile }, { data: cp }] = await Promise.all([
      supa.from('profiles').select('company_name, full_name, email, industry, gstin').eq('id', user.id).maybeSingle(),
      supa.from('company_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    const orgName = str(b.companyName) || (cp?.name as string) || (profile?.company_name as string) || 'Unnamed company';
    const orgRow = {
      owner_profile_id: user.id, name: orgName,
      industry: (cp?.industry as string) || (profile?.industry as string) || '',
      cin: (cp?.cin as string) || null, gstin: (cp?.gstin as string) || (profile?.gstin as string) || null,
      address: (cp?.address as string) || null, state: (cp?.state as string) || null,
      employee_count: parseInt(String(cp?.headcount ?? '0'), 10) || 0, acts_covered: selectedActs,
    };
    let { data: org } = await supa.from('organizations').select('id').eq('owner_profile_id', user.id).limit(1).maybeSingle();
    if (org) await supa.from('organizations').update(orgRow).eq('id', org.id);
    else {
      const ins = await supa.from('organizations').insert(orgRow).select('id').single();
      if (ins.error) throw ins.error;
      org = ins.data;
    }

    const { data: sess } = await supa.from('validation_sessions').select('id').eq('user_id', user.id)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const now = new Date();
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

    let q = supa.from('review_cycles').select('id, status').eq('organization_id', org!.id);
    q = sess?.id ? q.eq('validation_session_id', sess.id) : q.eq('reporting_month', month);
    const { data: cur } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();

    const snapshot = { docs, issues, selectedActs, missingFiles, liveRegisterFileName: str(b.liveRegisterFileName), submittedAt: now.toISOString() };
    let cycleId = cur?.id as string | undefined;
    if (cur && ['approved', 'in_review'].includes(cur.status as string)) {
      return res.status(409).json({ ok: false, message: cur.status === 'approved' ? 'Already approved.' : 'An auditor is reviewing this submission.' });
    }
    const common = {
      l2_score: l2Score, l2_completed_at: now.toISOString(), l2_snapshot: snapshot, current_level: 'level_3',
      status: 'pending', assigned_auditor_id: null, terms_accepted_at: null, terms_version: null, access_status: 'none',
      decision_remarks: null, decided_at: null,
    };
    if (cycleId) {
      const u = await supa.from('review_cycles').update(common).eq('id', cycleId);
      if (u.error) throw u.error;
    } else {
      const ins = await supa.from('review_cycles').insert({
        organization_id: org!.id, validation_session_id: sess?.id ?? null, reporting_month: month, ...common,
      }).select('id').single();
      if (ins.error) throw ins.error;
      cycleId = ins.data.id as string;
    }
    await supa.from('validation_zoho_files').update({ review_cycle_id: cycleId }).eq('profile_id', user.id);
    try {
      await supa.from('admin_notifications').insert({
        type: 'l3_ready', title: 'Ready for auditor', detail: `${orgName} passed Level 2 and is waiting for an auditor.`,
        entity_type: 'review_cycle', entity_id: cycleId,
      });
    } catch { /* ignore */ }
    res.json({ ok: true, cycleId });
  } catch (e) {
    console.error('[validation submit]', e);
    res.status(500).json({ ok: false, message: 'Could not submit for audit.' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPANY: audit status + certificate download
// ═════════════════════════════════════════════════════════════════════════════
async function latestCycleFor(userId: string) {
  const supa = db();
  const { data: org } = await supa.from('organizations').select('id').eq('owner_profile_id', userId).limit(1).maybeSingle();
  if (!org) return null;
  const { data } = await supa.from('review_cycles')
    .select('id, status, decision_remarks, decided_at, assigned_auditor_id, terms_accepted_at')
    .eq('organization_id', org.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

async function statusHandler(req: Request, res: Response) {
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Sign in required.' });
    const c = await latestCycleFor(user.id);
    if (!c) return res.json({ ok: true, status: 'none' });
    let cert: { certificateNo: string; issuedAt: string; hasPdf: boolean } | null = null;
    if (c.status === 'approved') {
      const { data } = await db().from('certificates').select('certificate_no, issued_at, pdf_storage_key').eq('review_cycle_id', c.id).maybeSingle();
      if (data) cert = { certificateNo: data.certificate_no as string, issuedAt: data.issued_at as string, hasPdf: !!data.pdf_storage_key };
    }
    res.json({
      ok: true, status: c.status, remarks: c.decision_remarks ?? '', decidedAt: c.decided_at,
      assigned: !!c.assigned_auditor_id && !!c.terms_accepted_at, certificate: cert,
    });
  } catch (e) {
    console.error('[validation status]', e);
    res.status(500).json({ ok: false, message: 'Could not load status.' });
  }
}

async function certDownloadHandler(req: Request, res: Response) {
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Sign in required.' });
    const c = await latestCycleFor(user.id);
    if (!c || c.status !== 'approved') return res.status(404).json({ ok: false, message: 'No certificate yet.' });
    const { data: cert } = await db().from('certificates').select('certificate_no, pdf_storage_key').eq('review_cycle_id', c.id).maybeSingle();
    if (!cert?.pdf_storage_key) return res.status(404).json({ ok: false, message: 'Certificate PDF is not ready yet.' });
    const { data, error } = await db().storage.from(BUCKET).download(cert.pdf_storage_key as string);
    if (error || !data) return res.status(404).json({ ok: false, message: 'Certificate PDF is not ready yet.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(String(cert.certificate_no))}.pdf"`);
    res.send(Buffer.from(await data.arrayBuffer()));
  } catch (e) {
    console.error('[validation cert]', e);
    res.status(500).json({ ok: false, message: 'Download failed.' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// AUDITOR: bootstrap — everything the portal renders, from the real tables
// ═════════════════════════════════════════════════════════════════════════════
async function bootstrapHandler(req: Request, res: Response) {
  try {
    const me = await auditorFrom(req);
    if (!me) return res.status(403).json({ ok: false, message: 'Not an authorised auditor.' });
    const supa = db();

    // Round 1: the cycles + auditors (independent). Round 2: everything keyed by cycle / org (parallel).
    // Previously this pulled EVERY file and certificate row in the database and ran 4 sequential rounds.
    const [{ data: cycles }, { data: aps }] = await Promise.all([
      supa.from('review_cycles').select('*').not('l2_completed_at', 'is', null).order('l2_completed_at', { ascending: false }).limit(300),
      supa.from('auditor_profiles').select('user_id, license_id, specialization, joined_at').eq('is_active', true),
    ]);
    const cycleIds = (cycles ?? []).map((c) => c.id as string);
    const orgIds = [...new Set((cycles ?? []).map((c) => c.organization_id as string))];
    const [{ data: orgs }, { data: files }, { data: certs }] = await Promise.all([
      orgIds.length ? supa.from('organizations').select('*').in('id', orgIds) : Promise.resolve({ data: [] as any[] }),
      cycleIds.length ? supa.from('validation_zoho_files').select('id, profile_id, review_cycle_id, doc_name, doc_role, file_name, mime_type, size_bytes, uploaded_at, storage_key').in('review_cycle_id', cycleIds) : Promise.resolve({ data: [] as any[] }),
      cycleIds.length ? supa.from('certificates').select('review_cycle_id, certificate_no, issued_at, pdf_sha256, revoked_at').in('review_cycle_id', cycleIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const ownerIds = [...new Set((orgs ?? []).map((o: any) => o.owner_profile_id as string).filter(Boolean))];
    const apIds = (aps ?? []).map((a) => a.user_id as string);
    const profIds = [...new Set([...ownerIds, ...apIds])];
    const [{ data: profs }, { data: cps }, { data: kycs }] = await Promise.all([
      profIds.length ? supa.from('profiles').select('id, full_name, email').in('id', profIds) : Promise.resolve({ data: [] as any[] }),
      ownerIds.length ? supa.from('company_profiles').select('*').in('user_id', ownerIds) : Promise.resolve({ data: [] as any[] }),
      ownerIds.length ? supa.from('kyc_files').select('profile_id, doc_label, file_name, zoho_url, created_at').in('profile_id', ownerIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const orgById = new Map((orgs ?? []).map((o: any) => [o.id, o]));
    const profById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const cpByUser = new Map((cps ?? []).map((p: any) => [p.user_id, p]));
    const certByCycle = new Map((certs ?? []).map((c) => [c.review_cycle_id as string, c]));
    const filesByCycle = new Map<string, any[]>();
    for (const f of files ?? []) {
      if (!f.review_cycle_id) continue;
      const k = f.review_cycle_id as string;
      filesByCycle.set(k, [...(filesByCycle.get(k) ?? []), f]);
    }

    const companies = (cycles ?? []).map((c) => {
      const org: any = orgById.get(c.organization_id as string) ?? {};
      const cp: any = cpByUser.get(org.owner_profile_id) ?? {};
      const owner: any = profById.get(org.owner_profile_id) ?? {};
      const snap: any = c.l2_snapshot ?? {};
      // Unlocked = assigned to me + access approved. Admin assignment grants access directly; self-claims are gated by access_status.
      const unlocked = c.assigned_auditor_id === me.id && c.access_status === 'approved';
      const cf = filesByCycle.get(c.id as string) ?? [];
      const fileUrl = (id: string) => (unlocked ? `/api/auditor/file?id=${id}` : null);
      const usedFiles = new Set<string>();
      const docs = (snap.docs ?? []).map((d: any, i: number) => {
        const nm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
        const docs0 = cf.filter((x) => x.doc_role === 'document' && !usedFiles.has(x.id));
        // Prefer an exact name that has a stored copy, then a normalised match, then any match.
        const f = docs0.find((x) => x.doc_name === d.name && x.storage_key)
          ?? docs0.find((x) => nm(x.doc_name) === nm(d.name) && x.storage_key)
          ?? docs0.find((x) => nm(x.doc_name) === nm(d.name));
        if (f) usedFiles.add(f.id);
        return {
          id: f?.id ?? `${c.id}-d${i}`, name: d.name, act: d.act, status: d.status, score: d.score,
          fileUrl: f?.storage_key ? fileUrl(f.id) : null, fileName: f?.file_name ?? null, mimeType: f?.mime_type ?? null,
          uploadedAt: f?.uploaded_at ?? null, hasFile: !!f?.storage_key,
        };
      });
      const live = cf.find((x) => x.doc_role === 'live_register' && x.storage_key) ?? cf.find((x) => x.doc_role === 'live_register');
      // Everything the company filed — visible only once access is approved
      const details = unlocked ? {
        company: {
          name: cp.name || org.name || '', cin: cp.cin || org.cin || '', pan: cp.pan || '', gstin: cp.gstin || org.gstin || '',
          address: cp.address || org.address || '', state: cp.state || org.state || '', industry: cp.industry || org.industry || '',
          headcount: cp.headcount || String(org.employee_count ?? ''), incorporationDate: cp.incorporation_date ?? null,
          authorizedPerson: cp.authorized_person || owner.full_name || '', designation: cp.designation || '',
          email: cp.email || owner.email || '', phone: cp.phone || '',
        },
        kycFiles: (kycs ?? []).filter((k: any) => k.profile_id === org.owner_profile_id)
          .map((k: any) => ({ label: k.doc_label, fileName: k.file_name, url: k.zoho_url ?? null, at: k.created_at })),
        files: cf.filter((x: any) => x.storage_key).map((x: any) => ({ id: x.id, docName: x.doc_name, role: x.doc_role, fileName: x.file_name, mimeType: x.mime_type, size: x.size_bytes, at: x.uploaded_at, url: `/api/auditor/file?id=${x.id}` })),
      } : null;
      const cert: any = certByCycle.get(c.id as string);
      return {
        id: c.id, name: org.name ?? 'Unnamed company', industry: org.industry || 'Unspecified', cin: org.cin ?? '',
        contactPerson: cp.authorized_person || owner.full_name || '', contactEmail: cp.email || owner.email || '',
        employeeCount: org.employee_count ?? 0,
        actsCovered: (org.acts_covered?.length ? org.acts_covered : snap.selectedActs) ?? [],
        docs,
        issues: (snap.issues ?? []).map((i: any, n: number) => ({
          id: `${c.id}-i${n}`, docName: i.docName, severity: i.severity, rule: i.rule, rootCause: i.rootCause, resolvedL2: !!i.resolved,
        })),
        missingFiles: snap.missingFiles ?? [],
        l2Score: Number(c.l2_score ?? 0), l2CompletedAt: c.l2_completed_at,
        status: c.status, assignedTo: c.assigned_auditor_id ?? null, termsAcceptedAt: c.terms_accepted_at ?? null,
        decisionRemarks: c.decision_remarks ?? '', decidedAt: c.decided_at ?? null,
        liveRegisterUrl: live?.storage_key ? fileUrl(live.id) : null, liveRegisterFileName: live?.file_name ?? snap.liveRegisterFileName ?? null,
        locked: !unlocked, accessStatus: c.access_status ?? 'none', details,
        certificate: cert ? { certificateNo: cert.certificate_no, issuedAt: cert.issued_at, sha256: cert.pdf_sha256 || null, revoked: !!cert.revoked_at } : null,
      };
    });

    const auditors = (aps ?? []).map((a) => {
      const p: any = profById.get(a.user_id as string) ?? {};
      return { id: a.user_id, fullName: p.full_name || p.email || 'Auditor', email: String(p.email ?? '').toLowerCase(), licenseId: a.license_id, specialization: a.specialization, joinedAt: a.joined_at };
    });
    res.json({ ok: true, auditor: me, auditors, companies, currentAuditorId: me.id });
  } catch (e) {
    console.error('[auditor bootstrap]', e);
    res.status(500).json({ ok: false, message: 'Failed to load the audit queue.' });
  }
}

// AUDITOR: self-assign + accept terms (atomic: only one auditor can win)
async function claimHandler(req: Request, res: Response) {
  try {
    const me = await auditorFrom(req);
    if (!me) return res.status(403).json({ ok: false, message: 'Not an authorised auditor.' });
    const id = str(req.body?.companyId, 60);
    if (!id) return res.status(400).json({ ok: false, message: 'companyId required.' });
    if (req.body?.acceptedTerms !== true) return res.status(400).json({ ok: false, message: 'You must accept the auditor terms.' });
    const mode = await getAccessMode();
    const accessStatus = mode === 'admin' ? 'requested' : 'approved';
    const stamp = { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION };
    // Admin-assigned review: the auditor is already set, they only still have to accept the terms.
    const { data: pre } = await db().from('review_cycles').update({ ...stamp })
      .eq('id', id).eq('status', 'in_review').eq('assigned_auditor_id', me.id).is('terms_accepted_at', null).select('id');
    let data = pre;
    if (!pre?.length) {
      const r = await db().from('review_cycles').update({
        status: 'in_review', assigned_auditor_id: me.id, ...stamp, access_status: accessStatus,
      }).eq('id', id).eq('status', 'pending').is('assigned_auditor_id', null).select('id');
      if (r.error) throw r.error;
      data = r.data;
    }
    if (!data?.length) return res.status(409).json({ ok: false, message: 'This company was already claimed.' });
    // Tell the admins: an auditor is asking for access (shows in the console bell + Access requests tab)
    if (accessStatus === 'requested') {
      try {
        const { data: cy } = await db().from('review_cycles').select('organization_id').eq('id', id).maybeSingle();
        const { data: org } = cy ? await db().from('organizations').select('name').eq('id', cy.organization_id).maybeSingle() : { data: null };
        await db().from('admin_notifications').insert({
          type: 'access_request', title: 'Auditor access request',
          detail: `${me.fullName} requested access to ${(org?.name as string) || 'a company'}.`,
          actor_name: me.fullName, entity_type: 'review_cycle', entity_id: id,
        });
      } catch { /* a notification failure must not block the claim */ }
    }
    await db().from('audit_log').insert({ actor_user_id: me.id, action: 'review.claim', entity_type: 'review_cycle', entity_id: id, metadata: { terms: TERMS_VERSION } });
    res.json({ ok: true, termsAcceptedAt: new Date().toISOString(), accessStatus });
  } catch (e) {
    console.error('[auditor claim]', e);
    res.status(500).json({ ok: false, message: 'Could not claim.' });
  }
}

// AUDITOR: stream a document — only the assigned auditor, only after terms accepted
async function fileHandler(req: Request, res: Response) {
  try {
    const me = await auditorFrom(req);
    if (!me) return res.status(403).json({ ok: false, message: 'Not an authorised auditor.' });
    const id = str(req.query.id, 60);
    const supa = db();
    const { data: f } = await supa.from('validation_zoho_files').select('review_cycle_id, storage_key, file_name, mime_type').eq('id', id).maybeSingle();
    if (!f?.review_cycle_id || !f.storage_key) return res.status(404).json({ ok: false, message: 'File not found.' });
    const { data: c } = await supa.from('review_cycles').select('assigned_auditor_id, terms_accepted_at, access_status').eq('id', f.review_cycle_id).maybeSingle();
    if (!c || c.assigned_auditor_id !== me.id || c.access_status !== 'approved') return res.status(403).json({ ok: false, message: 'Access to this review is not approved yet.' });
    const { data, error } = await supa.storage.from(BUCKET).download(f.storage_key as string);
    if (error || !data) return res.status(404).json({ ok: false, message: 'File not found.' });
    res.setHeader('Content-Type', (f.mime_type as string) || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(await data.arrayBuffer()));
  } catch (e) {
    console.error('[auditor file]', e);
    res.status(500).json({ ok: false, message: 'Could not open the file.' });
  }
}

// AUDITOR: decision (+ certificate number on approval)
async function decisionHandler(req: Request, res: Response) {
  try {
    const me = await auditorFrom(req);
    if (!me) return res.status(403).json({ ok: false, message: 'Not an authorised auditor.' });
    const id = str(req.body?.companyId, 60);
    const decision = str(req.body?.decision, 30);
    const remarks = str(req.body?.remarks, 2000);
    if (!['approved', 'changes_requested', 'rejected'].includes(decision)) return res.status(400).json({ ok: false, message: 'Invalid decision.' });
    if (decision !== 'approved' && !remarks) return res.status(400).json({ ok: false, message: 'Remarks are required.' });
    const supa = db();
    const { data: c } = await supa.from('review_cycles').select('id, status, assigned_auditor_id, terms_accepted_at, access_status').eq('id', id).maybeSingle();
    if (!c || c.assigned_auditor_id !== me.id || c.access_status !== 'approved') return res.status(403).json({ ok: false, message: 'Not assigned to you.' });
    if (c.status !== 'in_review') return res.status(409).json({ ok: false, message: 'Already decided.' });
    const decidedAt = new Date().toISOString();
    const u = await supa.from('review_cycles').update({ status: decision, decision_remarks: remarks, decided_at: decidedAt }).eq('id', id);
    if (u.error) throw u.error;

    let certificate: { certificateNo: string; issuedAt: string } | null = null;
    if (decision === 'approved') {
      for (let i = 0; i < 5 && !certificate; i++) {
        const no = `RGX-${new Date().getFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`;
        const ins = await supa.from('certificates').insert({ review_cycle_id: id, certificate_no: no, issued_by: me.id, issued_at: decidedAt, data_snapshot: {} });
        if (!ins.error) certificate = { certificateNo: no, issuedAt: decidedAt };
        else if (!/duplicate|unique/i.test(ins.error.message)) throw ins.error;
        else { // already issued for this cycle?
          const { data: ex } = await supa.from('certificates').select('certificate_no, issued_at').eq('review_cycle_id', id).maybeSingle();
          if (ex) certificate = { certificateNo: ex.certificate_no as string, issuedAt: ex.issued_at as string };
        }
      }
    }
    await supa.from('audit_log').insert({ actor_user_id: me.id, action: `review.${decision}`, entity_type: 'review_cycle', entity_id: id, metadata: { remarks } });
    res.json({ ok: true, decidedAt, certificate });
  } catch (e) {
    console.error('[auditor decision]', e);
    res.status(500).json({ ok: false, message: 'Could not record the decision.' });
  }
}

// AUDITOR: store the certificate PDF (client portal + Zoho) and optionally email it
async function certHandler(req: Request, res: Response) {
  try {
    const me = await auditorFrom(req);
    if (!me) return res.status(403).json({ ok: false, message: 'Not an authorised auditor.' });
    const id = str(req.body?.companyId, 60);
    const pdfB64 = typeof req.body?.pdfBase64 === 'string' ? req.body.pdfBase64 : '';
    const supa = db();
    const { data: c } = await supa.from('review_cycles').select('id, status, assigned_auditor_id, organization_id').eq('id', id).maybeSingle();
    if (!c || c.assigned_auditor_id !== me.id || c.status !== 'approved') return res.status(403).json({ ok: false, message: 'Certificate not available.' });
    const { data: cert } = await supa.from('certificates').select('certificate_no').eq('review_cycle_id', id).maybeSingle();
    if (!cert) return res.status(404).json({ ok: false, message: 'No certificate issued.' });
    const bytes = Buffer.from(pdfB64, 'base64');
    if (bytes.length < 100 || bytes.subarray(0, 4).toString('latin1') !== '%PDF') return res.status(400).json({ ok: false, message: 'Invalid PDF.' });
    if (bytes.length > 3.2 * 1024 * 1024) return res.status(413).json({ ok: false, message: 'PDF too large.' });

    const { data: org } = await supa.from('organizations').select('name, owner_profile_id').eq('id', c.organization_id).maybeSingle();
    const key = `certificates/${cert.certificate_no}.pdf`;
    const up = await supa.storage.from(BUCKET).upload(key, bytes, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw up.error;
    const sha = createHash('sha256').update(bytes).digest('hex');
    const snapshot = req.body?.snapshot && typeof req.body.snapshot === 'object' ? req.body.snapshot : undefined;
    await supa.from('certificates').update({ pdf_storage_key: key, pdf_sha256: sha, ...(snapshot ? { data_snapshot: snapshot } : {}) }).eq('review_cycle_id', id);

    let zohoOk = false;
    try {
      if (org?.owner_profile_id) { await pushToZoho(org.owner_profile_id as string, `Compliance Certificate - ${cert.certificate_no}.pdf`, 'application/pdf', bytes); zohoOk = true; }
    } catch (e) { console.error('[cert zoho]', e); }

    let emailed: boolean | null = null;
    if (req.body?.sendEmail === true) {
      const { data: cp } = await supa.from('company_profiles').select('email, authorized_person').eq('user_id', org?.owner_profile_id as string).maybeSingle();
      const { data: pr } = await supa.from('profiles').select('email').eq('id', org?.owner_profile_id as string).maybeSingle();
      const to = (cp?.email as string) || (pr?.email as string) || '';
      const from = process.env.CERTIFICATE_FROM_EMAIL?.trim() || process.env.RESEND_FROM_EMAIL?.trim() || '';
      if (!to || !from || !process.env.RESEND_API_KEY) emailed = false;
      else {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from, to: [to], subject: `Compliance Certificate — ${org?.name} (${cert.certificate_no})`,
            text: `Hello,\n\nYour Regnix compliance audit for ${org?.name} has been approved by ${me.fullName} (Licence ${me.licenseId}).\nCertificate ${cert.certificate_no} is attached.\n\n— Regnix Compliance`,
            attachments: [{ filename: `${cert.certificate_no}.pdf`, content: pdfB64 }],
          }),
        });
        emailed = r.ok;
      }
    }
    res.json({ ok: true, stored: true, zoho: zohoOk, emailed, sha256: sha });
  } catch (e) {
    console.error('[auditor cert]', e);
    res.status(500).json({ ok: false, message: 'Could not save the certificate.' });
  }
}

// PUBLIC: certificate verification (QR target)
const vHits = new Map<string, { n: number; t: number }>();
async function verifyHandler(req: Request, res: Response) {
  try {
    const ip = req.ip ?? 'x'; const now = Date.now(); const h = vHits.get(ip);
    if (!h || now - h.t > 60_000) vHits.set(ip, { n: 1, t: now }); else if (++h.n > 30) return res.status(429).json({ ok: false, message: 'Too many requests.' });
    const no = str(req.query.no, 40).toUpperCase();
    if (!/^RGX-\d{4}-[A-F0-9]{10}$/.test(no)) return res.json({ ok: true, valid: false });
    const supa = db();
    const { data: cert } = await supa.from('certificates').select('review_cycle_id, certificate_no, issued_at, pdf_sha256, revoked_at, issued_by, data_snapshot').eq('certificate_no', no).maybeSingle();
    if (!cert) return res.json({ ok: true, valid: false });
    const { data: c } = await supa.from('review_cycles').select('organization_id, l2_score, reporting_month').eq('id', cert.review_cycle_id).maybeSingle();
    const { data: org } = await supa.from('organizations').select('name').eq('id', c?.organization_id as string).maybeSingle();
    const { data: ap } = await supa.from('auditor_profiles').select('license_id').eq('user_id', cert.issued_by as string).maybeSingle();
    const { data: pr } = await supa.from('profiles').select('full_name').eq('id', cert.issued_by as string).maybeSingle();
    const snap: any = cert.data_snapshot ?? {};
    res.json({
      ok: true, valid: !cert.revoked_at, revoked: !!cert.revoked_at, certificateNo: cert.certificate_no, issuedAt: cert.issued_at,
      company: org?.name ?? '', score: snap.overallScore ?? c?.l2_score ?? null, maturity: snap.complianceMaturity ?? null,
      reportingMonth: c?.reporting_month ?? null, auditor: pr?.full_name ?? '', licenseId: ap?.license_id ?? '', sha256: cert.pdf_sha256 || null,
    });
  } catch (e) {
    console.error('[cert verify]', e);
    res.status(500).json({ ok: false, message: 'Verification unavailable.' });
  }
}

// ── routes: internal (/kyc/*) path + public alias ────────────────────────────
router.use(['/kyc', '/validation', '/auditor', '/certificate'], json({ limit: '5mb' }));
const R = (m: 'get' | 'post', internal: string, pub: string, h: (q: Request, r: Response) => unknown) => {
  router[m](`/kyc/${internal}`, h); router[m](pub, h);
};
R('post', 'validation-upload', '/validation/zoho-upload', uploadHandler);
R('post', 'validation-submit', '/validation/l2-submit', submitHandler);
R('get', 'validation-status', '/validation/l3-status', statusHandler);
R('get', 'validation-cert', '/validation/certificate', certDownloadHandler);
R('get', 'auditor-bootstrap', '/auditor/portal/bootstrap', bootstrapHandler);
R('post', 'auditor-claim', '/auditor/reviews/claim', claimHandler);
R('get', 'auditor-file', '/auditor/file', fileHandler);
R('post', 'auditor-decision', '/auditor/reviews/decision', decisionHandler);
R('post', 'auditor-cert', '/auditor/certificate', certHandler);
R('get', 'cert-verify', '/certificate/verify', verifyHandler);

export default router;
