/**
 * server/lib/emailTemplates.ts
 *
 * All email wording lives here. Every piece of user-supplied data (names,
 * notes, document names, rejection reasons) is HTML-escaped before it is put
 * into a template.
 */

export interface Email {
  subject: string;
  html: string;
  text: string;
}

const BRAND = '#7C3AED';

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appUrl(): string {
  return (process.env.APP_URL || 'https://thelexvon.com').replace(/\/+$/, '');
}

function firstName(fullName: string): string {
  return (fullName || '').trim().split(/\s+/)[0] || 'there';
}

function layout(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<p style="margin:24px 0 8px"><a href="${esc(cta.url)}" style="background:${BRAND};color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block">${esc(cta.label)}</a></p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;background:#f5f5f7;font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb">
      <tr><td style="padding:22px 28px;border-bottom:1px solid #e5e7eb;font-size:17px;font-weight:800;color:${BRAND}">Regnix <span style="color:#9ca3af;font-weight:400;font-size:12px">by Lexvon</span></td></tr>
      <tr><td style="padding:28px;font-size:14.5px;line-height:1.65">
        <h1 style="margin:0 0 14px;font-size:20px;color:#111827">${esc(heading)}</h1>
        ${bodyHtml}
        ${button}
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
        You received this email because of activity on your Regnix account. Questions? Reply to this email.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// ── Signup ──────────────────────────────────────────────────────────────

export function signupReceived(fullName: string): Email {
  const name = firstName(fullName);
  return {
    subject: 'We received your Regnix application',
    html: layout(
      'Your application is in review',
      `<p>Hi ${esc(name)},</p>
       <p>Thanks for signing up for Regnix. Our team is reviewing your application and we will email you as soon as a decision is made.</p>
       <p>You will be able to sign in once your account is approved.</p>`,
    ),
    text: `Hi ${name},\n\nThanks for signing up for Regnix. Our team is reviewing your application and we will email you as soon as a decision is made.\nYou will be able to sign in once your account is approved.\n`,
  };
}

export function signupApproved(fullName: string): Email {
  const name = firstName(fullName);
  const url = `${appUrl()}/login`;
  return {
    subject: 'Your Regnix account is approved',
    html: layout(
      'You are approved',
      `<p>Hi ${esc(name)},</p>
       <p>Good news: your Regnix account has been approved. You can sign in now.</p>`,
      { label: 'Sign in to Regnix', url },
    ),
    text: `Hi ${name},\n\nYour Regnix account has been approved. You can sign in now: ${url}\n`,
  };
}

export function signupRejected(fullName: string, reason?: string | null): Email {
  const name = firstName(fullName);
  const reasonHtml = reason ? `<p><strong>Reason:</strong> ${esc(reason)}</p>` : '';
  const reasonText = reason ? `Reason: ${reason}\n` : '';
  return {
    subject: 'Update on your Regnix application',
    html: layout(
      'Your application was not approved',
      `<p>Hi ${esc(name)},</p>
       <p>Thank you for your interest in Regnix. Unfortunately we could not approve your application at this time.</p>
       ${reasonHtml}
       <p>If you think this is a mistake, reply to this email and we will look into it.</p>`,
    ),
    text: `Hi ${name},\n\nThank you for your interest in Regnix. Unfortunately we could not approve your application at this time.\n${reasonText}If you think this is a mistake, reply to this email.\n`,
  };
}

export function adminNewSignup(p: {
  fullName: string; email: string; accountType: string; companyName: string;
}): Email {
  const url = `${appUrl()}/admin`;
  return {
    subject: `New Regnix signup: ${p.fullName}`.replace(/[\r\n]+/g, ' '),
    html: layout(
      'New signup waiting for approval',
      `<p><strong>${esc(p.fullName)}</strong> (${esc(p.email)}) signed up as <strong>${esc(p.accountType)}</strong>${p.companyName ? ` for <strong>${esc(p.companyName)}</strong>` : ''}.</p>`,
      { label: 'Open Super Admin', url },
    ),
    text: `${p.fullName} (${p.email}) signed up as ${p.accountType}${p.companyName ? ` for ${p.companyName}` : ''}.\nReview: ${url}\n`,
  };
}

// ── KYC ─────────────────────────────────────────────────────────────────

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`;
  }
}

export function kycRequested(p: {
  fullName: string;
  documents: string[];
  amount: number;
  currency: string;
  dueDate: string | null;
  note: string | null;
}): Email {
  const name = firstName(p.fullName);
  const url = `${appUrl()}/login`;
  const docsHtml = p.documents.length
    ? `<p style="margin-bottom:4px"><strong>Documents required</strong></p><ul style="margin-top:0;padding-left:20px">${p.documents.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
    : '';
  const payHtml = p.amount > 0 ? `<p><strong>Payment due:</strong> ${esc(formatMoney(p.amount, p.currency))}</p>` : '';
  const dueHtml = p.dueDate ? `<p><strong>Due date:</strong> ${esc(p.dueDate)}</p>` : '';
  const noteHtml = p.note ? `<p><strong>Note from our team:</strong><br>${esc(p.note)}</p>` : '';

  const textParts = [
    `Hi ${name},`,
    '',
    'To complete your Regnix onboarding we need the following.',
    p.documents.length ? `\nDocuments required:\n${p.documents.map((d) => `- ${d}`).join('\n')}` : '',
    p.amount > 0 ? `\nPayment due: ${formatMoney(p.amount, p.currency)}` : '',
    p.dueDate ? `Due date: ${p.dueDate}` : '',
    p.note ? `\nNote from our team: ${p.note}` : '',
    `\nReply to this email with the documents, or contact us if you have questions. ${url}`,
  ];

  return {
    subject: 'Action needed: complete your Regnix KYC',
    html: layout(
      'Complete your KYC',
      `<p>Hi ${esc(name)},</p>
       <p>To complete your Regnix onboarding we need the following.</p>
       ${docsHtml}${payHtml}${dueHtml}${noteHtml}
       <p>Reply to this email with the documents, or contact us if you have any questions.</p>`,
    ),
    text: textParts.filter((l) => l !== '').join('\n') + '\n',
  };
}

export function kycVerified(fullName: string): Email {
  const name = firstName(fullName);
  const url = `${appUrl()}/login`;
  return {
    subject: 'Your Regnix KYC is verified',
    html: layout(
      'KYC verified',
      `<p>Hi ${esc(name)},</p><p>We have received your documents and your KYC is now verified. Thank you.</p>`,
      { label: 'Go to Regnix', url },
    ),
    text: `Hi ${name},\n\nWe have received your documents and your KYC is now verified. Thank you.\n${url}\n`,
  };
}