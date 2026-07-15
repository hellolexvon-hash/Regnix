import { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { asString, asStringArray, safeInsert } from '../lib/portalHelpers.js';

const router = Router();

type CertificateEmailPayload = {
  toEmail?: string;
  to?: string;
  companyName?: string;
  auditorName?: string;
  subject?: string;
  text?: string;
  html?: string;
  pdfBase64?: string;
  pdfName?: string;
  cc?: string[] | string;
  bcc?: string[] | string;
};

async function sendWithResend(payload: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: string }>;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

router.post('/certificate/email', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as CertificateEmailPayload;
    const toEmail = asString(body.toEmail ?? body.to).toLowerCase();
    const companyName = asString(body.companyName, 'Company');
    const auditorName = asString(body.auditorName, 'Auditor');
    const subject = asString(body.subject, `Compliance Certificate for ${companyName}`);
    const text = asString(
      body.text,
      `Hello ${companyName},\n\nPlease find attached the compliance certificate issued by ${auditorName}.\n`,
    );
    const pdfBase64 = asString(body.pdfBase64);
    const pdfName = asString(body.pdfName, `${companyName.replace(/\s+/g, '_')}_Certificate.pdf`);

    if (!toEmail) {
      return res.status(400).json({ ok: false, message: 'toEmail is required.' });
    }

    const from = process.env.CERTIFICATE_FROM_EMAIL?.trim() || process.env.RESEND_FROM_EMAIL?.trim() || '';
    const cc = asStringArray(body.cc);
    const bcc = asStringArray(body.bcc);

    const resendResult = from && process.env.RESEND_API_KEY
      ? await sendWithResend({
          from,
          to: [toEmail],
          subject,
          text,
          html: body.html,
          attachments: pdfBase64 ? [{ filename: pdfName, content: pdfBase64 }] : [],
        })
      : null;

    if (resendResult?.ok) {
      const supabase = getSupabaseAdmin();
      await safeInsert(supabase, 'certificate_email_queue', {
        to_email: toEmail,
        company_name: companyName,
        auditor_name: auditorName,
        subject,
        provider: 'resend',
        provider_message_id: asString((resendResult.body as any)?.id),
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      return res.json({
        ok: true,
        provider: 'resend',
        messageId: asString((resendResult.body as any)?.id),
      });
    }

    const supabase = getSupabaseAdmin();
    await safeInsert(supabase, 'certificate_email_queue', {
      to_email: toEmail,
      company_name: companyName,
      auditor_name: auditorName,
      subject,
      cc: JSON.stringify(cc),
      bcc: JSON.stringify(bcc),
      pdf_name: pdfName,
      pdf_base64: pdfBase64,
      status: 'queued',
      queued_at: new Date().toISOString(),
    });

    await safeInsert(supabase, 'audit_log', {
      actor: auditorName || 'System',
      actor_role: 'system',
      action: 'certificate.email_queued',
      detail: `Queued certificate email for ${companyName} (${toEmail}).`,
      created_at: new Date().toISOString(),
    });

    res.json({
      ok: true,
      provider: 'queue',
      message: 'Certificate email queued. Connect RESEND_API_KEY to send immediately.',
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to process certificate email.',
    });
  }
});

router.post('/certificate/issue', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const payload = {
      company_review_id: asString(req.body?.companyReviewId ?? req.body?.companyId),
      auditor_id: asString(req.body?.auditorId),
      certificate_id: asString(req.body?.certificateId),
      status: 'issued',
      issued_at: new Date().toISOString(),
      pdf_url: asString(req.body?.pdfUrl),
      pdf_name: asString(req.body?.pdfName),
    };

    const saved = await safeInsert(supabase, 'certificates', payload);
    res.json({ ok: true, certificate: saved ?? [] });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to issue certificate.',
    });
  }
});

export default router;
