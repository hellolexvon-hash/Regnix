/**
 * certificateApi.ts — stores the issued certificate PDF (client portal + Zoho WorkDrive)
 * and optionally emails it to the company. Replaces the old certificateEmailService,
 * whose URL (/api/certificates/send-email) matched no server route.
 */
import { authFetch } from './auditorStore';

export interface SaveCertificateResult { ok: boolean; zoho?: boolean; emailed?: boolean | null; error?: string }

export async function saveCertificate(input: {
  companyId: string; pdfBase64: string; sendEmail: boolean; snapshot?: Record<string, unknown>;
}): Promise<SaveCertificateResult> {
  try {
    const res = await authFetch('/api/auditor/certificate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body?.message ?? `Server responded with ${res.status}.` };
    return { ok: true, zoho: !!body.zoho, emailed: body.emailed ?? null };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}
