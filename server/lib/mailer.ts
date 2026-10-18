/**
 * server/lib/mailer.ts
 *
 * Single place that talks to Zoho SMTP. Credentials come from server-side
 * environment variables only (never VITE_*, which would ship to the browser).
 *
 * Required env:
 *   MAIL_HOST   smtppro.zoho.in            (match your Zoho data centre)
 *   MAIL_PORT   465                        (465 = SSL, 587 = STARTTLS)
 *   MAIL_USER   hello@thelexvon.com
 *   MAIL_PASS   <Zoho app password>
 * Optional:
 *   MAIL_FROM   "Regnix <hello@thelexvon.com>"   (must be the mailbox or an alias of it)
 */

import nodemailer, { type Transporter } from 'nodemailer';

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailResult = { ok: true; messageId: string } | { ok: false; error: string };

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  if (!host || !user || !pass) {
    throw new Error('Mail is not configured: set MAIL_HOST, MAIL_USER and MAIL_PASS.');
  }

  const port = Number(process.env.MAIL_PORT) || 465;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Sends one email. Never throws: callers decide what a failed send means. */
export async function sendMail(input: MailInput): Promise<MailResult> {
  const to = input.to.trim();
  // Single recipient only: blocks header-injection / multi-recipient abuse.
  if (!EMAIL_RE.test(to)) return { ok: false, error: 'Invalid recipient address.' };

  try {
    const info = await getTransporter().sendMail({
      from: process.env.MAIL_FROM || `Regnix <${process.env.MAIL_USER}>`,
      to,
      subject: input.subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
      html: input.html,
      text: input.text,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown mail error';
    // Log the failure without the full recipient address or any credentials.
    console.error(`[mailer] send to ${maskEmail(to)} failed: ${message}`);
    return { ok: false, error: 'The email could not be sent.' };
  }
}