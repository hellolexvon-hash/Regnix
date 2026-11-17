/**
 * validationDocsUpload.ts
 *
 * Client side of the validation → Zoho WorkDrive → auditor flow.
 *  - uploadValidationDocs : one file per request (Vercel body cap → 3 MB per file)
 *  - submitLevel2         : hands the Level 2 result to the auditor queue
 *  - fetchL3Status        : audit status for the Level 3 screen
 *  - downloadCertificate  : the approved certificate PDF
 * Public URLs are rewritten to api/email-handler (see vercel.json).
 */
import { supabase } from '@/lib/supabaseClient';

const MAX_BYTES = 3 * 1024 * 1024;
const _sent = new Set<string>();

export interface UploadItem { file: File; name?: string; docName?: string; role?: 'document' | 'live_register' }
export interface UploadResult {
  uploaded: string[];
  skipped:  { name: string; reason: string }[];
}

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function uploadValidationDocs(items: UploadItem[], _companyName = ''): Promise<UploadResult> {
  const result: UploadResult = { uploaded: [], skipped: [] };
  const t = await token().catch(() => null);
  if (!t) { items.forEach(i => result.skipped.push({ name: i.name || i.file.name, reason: 'not signed in' })); return result; }

  for (const it of items) {
    const label = it.docName || it.name || it.file.name;
    const sig = `${it.file.name}|${it.file.size}|${it.file.lastModified}|${label}|${it.role ?? 'document'}`;
    if (_sent.has(sig)) { result.uploaded.push(label); continue; }
    if (it.file.size === 0) { result.skipped.push({ name: label, reason: 'empty file' }); continue; }
    if (it.file.size > MAX_BYTES) { result.skipped.push({ name: label, reason: 'over 3 MB' }); continue; }
    try {
      const res = await fetch('/api/validation/zoho-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ fileName: it.file.name, docName: label, role: it.role ?? 'document', dataBase64: await toBase64(it.file) }),
      });
      if (res.ok) { _sent.add(sig); result.uploaded.push(label); }
      else result.skipped.push({ name: label, reason: `server ${res.status}` });
    } catch {
      result.skipped.push({ name: label, reason: 'network' });
    }
  }
  if (result.skipped.length) console.warn('[validation upload] not stored:', result.skipped);
  return result;
}

export interface Level2Payload {
  companyName: string;
  l2Score: number;
  selectedActs: string[];
  liveRegisterFileName: string;
  missingFiles: string[];
  docs:   { name: string; act: string; status: 'validated' | 'flagged'; score: number }[];
  issues: { docName: string; severity: string; rule: string; rootCause: string; resolved: boolean }[];
}

export async function submitLevel2(p: Level2Payload): Promise<{ ok: boolean; message?: string }> {
  try {
    const t = await token();
    if (!t) return { ok: false, message: 'Please sign in again.' };
    const res = await fetch('/api/validation/l2-submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(p),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, message: body?.message ?? `Server ${res.status}` };
  } catch { return { ok: false, message: 'Could not reach the server.' }; }
}

export interface L3Status {
  status: 'none' | 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected';
  remarks?: string; assigned?: boolean;
  certificate?: { certificateNo: string; issuedAt: string; hasPdf: boolean } | null;
}

export async function fetchL3Status(): Promise<L3Status | null> {
  try {
    const t = await token();
    if (!t) return null;
    const res = await fetch('/api/validation/l3-status', { headers: { Authorization: `Bearer ${t}` } });
    return res.ok ? ((await res.json()) as L3Status) : null;
  } catch { return null; }
}

export async function downloadCertificate(fileName: string): Promise<boolean> {
  try {
    const t = await token();
    if (!t) return false;
    const res = await fetch('/api/validation/certificate', { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch { return false; }
}
