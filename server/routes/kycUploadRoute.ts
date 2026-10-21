/**
 * server/routes/kycUploadRoute.ts
 *
 * Public, token-protected endpoints behind the emailed KYC upload link
 * (the token is kyc_requests.upload_token — 64 hex chars, unguessable, only valid
 * while the request status is 'requested').
 *
 *   GET  /api/kyc/info?token=...   what to upload + plan + amount
 *   POST /api/kyc/file             one document  { token, label, fileName, mimeType, dataBase64 }
 *   POST /api/kyc/submit           payment details; marks the request as submitted
 *
 * Files go to Zoho WorkDrive (folder named after the company, created on first upload).
 * Only metadata + the WorkDrive link are stored in Supabase (kyc_files).
 *
 * Vercel caps a request body at ~4.5 MB; base64 adds 33%, so each file is limited to 3 MB.
 *
 * Env: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY + the ZOHO_* vars.
 */

import { Router, json, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { createCompanyFolder, uploadFile } from '../lib/zohoWorkDrive.js';

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 25;

const db = () =>
  createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false } },
  );

// ── tiny in-memory rate limit (per IP; best effort on serverless) ────────
const hits = new Map<string, { n: number; t: number }>();
function limited(req: Request): boolean {
  const ip = req.ip ?? 'x';
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  h.n += 1;
  return h.n > 60;
}

/** Content sniffing (SECURITY.md §4): never trust the declared type. */
function sniff(b: Buffer): string | null {
  if (b.length > 4 && b.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}
const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

interface OpenRequest {
  id: string; profile_id: string; documents: string[]; amount: number; currency: string;
  due_date: string | null; note: string | null; submitted_at: string | null;
}

async function openRequest(token: unknown): Promise<OpenRequest | null> {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await db()
    .from('kyc_requests')
    .select('id, profile_id, documents, amount, currency, due_date, note, submitted_at')
    .eq('upload_token', token)
    .eq('status', 'requested')
    .maybeSingle();
  return (data as OpenRequest | null) ?? null;
}

const router = Router();
// Larger body limit than the global 100kb, only for this router
router.use('/kyc', json({ limit: '5mb' }));

router.get('/kyc/info', async (req: Request, res: Response) => {
  if (limited(req)) return res.status(429).json({ ok: false, error: 'Too many requests.' });
  const k = await openRequest(req.query.token);
  if (!k) return res.status(404).json({ ok: false, error: 'This link is invalid or has expired.' });

  const [{ data: profile }, { data: files }] = await Promise.all([
    db().from('profiles').select('full_name, email, company_name, firm_name, selected_plan').eq('id', k.profile_id).maybeSingle(),
    db().from('kyc_files').select('doc_label, file_name').eq('request_id', k.id),
  ]);
  res.json({
    ok: true,
    company: (profile?.company_name as string) || (profile?.firm_name as string) || '',
    name: (profile?.full_name as string) ?? '',
    plan: (profile?.selected_plan as string | null) ?? null,
    documents: k.documents,
    amount: Number(k.amount ?? 0),
    currency: k.currency,
    dueDate: k.due_date,
    note: k.note ?? '',
    submitted: !!k.submitted_at,
    uploaded: files ?? [],
  });
});

router.post('/kyc/file', async (req: Request, res: Response) => {
  try {
    if (limited(req)) return res.status(429).json({ ok: false, error: 'Too many requests.' });
    const { token, label, fileName, dataBase64 } = (req.body ?? {}) as Record<string, unknown>;
    const k = await openRequest(token);
    if (!k) return res.status(404).json({ ok: false, error: 'This link is invalid or has expired.' });
    if (typeof label !== 'string' || !label || typeof fileName !== 'string' || typeof dataBase64 !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing fields.' });
    }
    if (!k.documents.includes(label)) return res.status(400).json({ ok: false, error: 'Unknown document type.' });

    const bytes = Buffer.from(dataBase64, 'base64');
    if (bytes.length === 0) return res.status(400).json({ ok: false, error: 'Empty file.' });
    if (bytes.length > MAX_BYTES) return res.status(413).json({ ok: false, error: 'File is larger than 3 MB.' });
    const mime = sniff(bytes);
    if (!mime) return res.status(415).json({ ok: false, error: 'Only PDF, JPG or PNG files are accepted.' });

    const supa = db();
    const { count } = await supa.from('kyc_files').select('id', { count: 'exact', head: true }).eq('request_id', k.id);
    if ((count ?? 0) >= MAX_FILES_PER_REQUEST) return res.status(400).json({ ok: false, error: 'Too many files.' });

    const { data: profile } = await supa
      .from('profiles')
      .select('company_name, firm_name, full_name, zoho_folder_id, zoho_folder_url')
      .eq('id', k.profile_id)
      .maybeSingle();

    // Folder named after the company the user entered at signup
    let folderId = (profile?.zoho_folder_id as string | null) ?? null;
    if (!folderId) {
      const name = (profile?.company_name as string) || (profile?.firm_name as string) || (profile?.full_name as string) || 'Unnamed company';
      const folder = await createCompanyFolder(name);
      folderId = folder.id;
      // service role => auth.uid() is null, so the protect_profile_flow_columns trigger lets this through
      await supa.from('profiles').update({ zoho_folder_id: folder.id, zoho_folder_url: folder.url }).eq('id', k.profile_id);
    }

    const base = String(fileName).replace(/\.[^.]*$/, '');
    const stored = `${label} - ${base}.${EXT[mime]}`;
    const zf = await uploadFile(folderId, stored, mime, bytes);

    await supa.from('kyc_files').insert({
      request_id: k.id, profile_id: k.profile_id, doc_label: label, file_name: stored,
      mime_type: mime, size_bytes: bytes.length, zoho_file_id: zf.id, zoho_url: zf.url,
    });
    res.json({ ok: true, fileName: stored });
  } catch (e) {
    console.error('[kyc/file]', e);
    res.status(500).json({ ok: false, error: 'Upload failed. Please try again.' });
  }
});

router.post('/kyc/submit', async (req: Request, res: Response) => {
  try {
    if (limited(req)) return res.status(429).json({ ok: false, error: 'Too many requests.' });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const k = await openRequest(b.token);
    if (!k) return res.status(404).json({ ok: false, error: 'This link is invalid or has expired.' });

    const supa = db();
    const { data: files } = await supa.from('kyc_files').select('doc_label').eq('request_id', k.id);
    const have = new Set((files ?? []).map((f) => f.doc_label as string));
    const missing = k.documents.filter((d) => !have.has(d));
    if (missing.length) return res.status(400).json({ ok: false, error: `Please upload: ${missing.join(', ')}` });

    const needsPayment = Number(k.amount ?? 0) > 0;
    const reference = typeof b.paymentReference === 'string' ? b.paymentReference.trim().slice(0, 80) : '';
    if (needsPayment && !reference) {
      return res.status(400).json({ ok: false, error: 'Enter the payment reference / UTR number.' });
    }
    const paidOn = typeof b.paidOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.paidOn) ? b.paidOn : null;

    const { error } = await supa.from('kyc_requests').update({
      submitted_at: new Date().toISOString(),
      docs_received: true,
      payment_method: typeof b.paymentMethod === 'string' ? b.paymentMethod.slice(0, 30) : null,
      payment_reference: reference || null,
      payment_amount: needsPayment ? Number(k.amount) : null,
      payment_paid_on: paidOn,
      payment_note: typeof b.note === 'string' ? b.note.slice(0, 500) : null,
    }).eq('id', k.id);
    if (error) throw error;

    // Ping the admin bell (best effort; a schema mismatch must not fail the submission)
    try {
      const { data: p } = await supa.from('profiles').select('company_name, firm_name, full_name').eq('id', k.profile_id).maybeSingle();
      await supa.from('admin_notifications').insert({
        type: 'kyc_submitted',
        title: 'KYC submitted',
        detail: `${(p?.company_name as string) || (p?.firm_name as string) || (p?.full_name as string) || 'A user'} uploaded documents and payment details.`,
        entity_type: 'kyc_request',
        entity_id: k.id,
      });
    } catch { /* ignore */ }

    res.json({ ok: true });
  } catch (e) {
    console.error('[kyc/submit]', e);
    res.status(500).json({ ok: false, error: 'Could not submit. Please try again.' });
  }
});

export default router;
