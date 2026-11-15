/**
 * validationDocsUpload.ts
 *
 * Sends validation documents to the company's Zoho WorkDrive folder
 * (Statutory / Company Related Docs) through POST /api/validation/zoho-upload —
 * the same WorkDrive account the KYC documents go to.
 *
 * - One request per file (Vercel caps a body at ~4.5 MB → 3 MB per file).
 * - Files already sent in this browser session are skipped (name|size|lastModified).
 * - Never throws: validation must keep working even if WorkDrive is unreachable.
 */

import { supabase } from '@/lib/supabaseClient';

const MAX_BYTES = 3 * 1024 * 1024;
const _sent = new Set<string>();

export interface ZohoUploadResult {
  uploaded: string[];
  skipped:  { name: string; reason: string }[];
}

function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function uploadValidationDocs(
  items: { file: File; name?: string }[],
  companyName = '',
): Promise<ZohoUploadResult> {
  const result: ZohoUploadResult = { uploaded: [], skipped: [] };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return result;

    for (const { file, name } of items) {
      const label = name || file.name;
      const sig = `${file.name}|${file.size}|${file.lastModified}`;
      if (_sent.has(sig)) continue;
      if (file.size === 0)        { result.skipped.push({ name: label, reason: 'empty' });   continue; }
      if (file.size > MAX_BYTES)  { result.skipped.push({ name: label, reason: 'over 3 MB' }); continue; }
      try {
        const res = await fetch('/api/validation/zoho-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName: file.name, companyName, dataBase64: await toBase64(file) }),
        });
        if (res.ok) { _sent.add(sig); result.uploaded.push(label); }
        else        { result.skipped.push({ name: label, reason: `HTTP ${res.status}` }); }
      } catch {
        result.skipped.push({ name: label, reason: 'network' });
      }
    }
  } catch { /* ignore */ }
  if (result.skipped.length) console.warn('[zoho-upload] skipped:', result.skipped);
  return result;
}
