/**
 * certificateEmailService.ts
 *
 * Frontend-side contract for emailing a generated certificate to the
 * company contact. A browser cannot send SMTP mail by itself — this posts
 * the rendered PDF (as base64) to a backend route that your server
 * actually sends through a real mail provider.
 *
 * ── Backend contract you need to implement ─────────────────────────────
 *
 *   POST /api/certificates/send-email
 *   Content-Type: application/json
 *   Body: SendCertificateEmailInput (see below)
 *   Success → 200 { ok: true }
 *   Failure → 4xx/5xx { error: string }
 *
 * ── Minimal Express + Nodemailer example ───────────────────────────────
 *
 *   import nodemailer from 'nodemailer';
 *
 *   const transporter = nodemailer.createTransport({
 *     host: process.env.SMTP_HOST,
 *     port: Number(process.env.SMTP_PORT),
 *     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
 *   });
 *
 *   app.post('/api/certificates/send-email', async (req, res) => {
 *     const { toEmail, toName, companyName, certificateId, fileName, pdfBase64 } = req.body;
 *     try {
 *       await transporter.sendMail({
 *         from: '"Regnix Compliance" <compliance@yourdomain.com>',
 *         to: toEmail,
 *         subject: `Compliance Certificate — ${companyName} (${certificateId})`,
 *         text: `Hi ${toName},\n\nAttached is the Level 3 compliance certificate for ${companyName}, certificate ${certificateId}.\n\n— Regnix Compliance Platform`,
 *         attachments: [{ filename: fileName, content: pdfBase64, encoding: 'base64' }],
 *       });
 *       res.json({ ok: true });
 *     } catch (err) {
 *       res.status(500).json({ error: 'Failed to send email. Please try again.' });
 *     }
 *   });
 *
 * Swap the transporter for SES/SendGrid/Postmark/whatever your infra uses —
 * the frontend contract above doesn't need to change either way.
 */

export interface SendCertificateEmailInput {
  certificateId: string;
  companyName:   string;
  toEmail:       string;
  toName:        string;
  fileName:      string;
  pdfBase64:     string; // no "data:application/pdf;base64," prefix
}

export type SendCertificateEmailResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendCertificateEmail(
  input: SendCertificateEmailInput,
): Promise<SendCertificateEmailResult> {
  try {
    const res = await fetch('/api/certificates/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.error ?? `Server responded with ${res.status}.` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}