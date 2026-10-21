/**
 * server/lib/emailTemplates.ts
 *
 * Redesigned transactional emails for the whole onboarding flow. One shared,
 * table-based layout (renders in Gmail / Outlook / Apple Mail), inline styles only.
 *
 *   signupReceivedEmail  – to the applicant right after signup (shows their plan)
 *   approvalEmail        – admin approved the signup: "get ready for KYC"
 *   kycRequestEmail      – admin asked for KYC: documents, amount, due date, upload button
 *   kycVerifiedEmail     – KYC verified: "you can sign in now"
 *   rejectionEmail       – application not approved
 *   adminNewSignupEmail  – to the admin: new application incl. selected plan
 *
 * Each returns { subject, html, text } — pass them to your existing mailer.
 */

export interface Mail { subject: string; html: string; text: string }

const BRAND = '#6D28D9';
const BRAND_2 = '#C026D3';

export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
export const inr = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

interface PlanLine { name: string; headcount: string; price: number }

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr><td style="border-radius:10px;background:${BRAND};background-image:linear-gradient(135deg,${BRAND},${BRAND_2})">
    <a href="${esc(href)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${esc(label)}</a>
  </td></tr></table>`;
}

function panel(rows: [string, string][], accent = false): string {
  const body = rows.map(([k, v], i) => `<tr>
      <td style="padding:10px 0;${i ? 'border-top:1px solid #ECE9F5;' : ''}font-size:13px;color:#6B6880">${esc(k)}</td>
      <td align="right" style="padding:10px 0;${i ? 'border-top:1px solid #ECE9F5;' : ''}font-size:14px;font-weight:700;color:#1B1830">${v}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:14px;background:${accent ? '#F5F0FF' : '#FAF9FD'};border:1px solid ${accent ? '#DDD2FB' : '#ECE9F5'}"><tr><td style="padding:6px 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table></td></tr></table>`;
}

function planPanel(p?: PlanLine | null): string {
  if (!p) return '';
  return panel([['Plan', esc(p.name)], ['Team size', esc(p.headcount)], ['Monthly price', inr(p.price)]], true);
}

function steps(current: 1 | 2 | 3 | 4): string {
  const items = ['Signup', 'Approval', 'KYC & payment', 'Access'];
  const cells = items.map((t, i) => {
    const n = i + 1;
    const done = n < current, on = n === current;
    const bg = done ? '#059669' : on ? BRAND : '#E7E3F3';
    const fg = done || on ? '#fff' : '#8C88A3';
    return `<td align="center" style="width:25%"><div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:${bg};color:${fg};font-size:12px;font-weight:800;margin:0 auto">${done ? '✓' : n}</div>
      <div style="margin-top:6px;font-size:11px;color:${on ? '#1B1830' : '#8C88A3'};font-weight:${on ? 700 : 500}">${t}</div></td>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px"><tr>${cells}</tr></table>`;
}

function layout(o: { preheader: string; title: string; eyebrow: string; body: string; current?: 1 | 2 | 3 | 4 }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#F1EFF8;font-family:'Segoe UI',-apple-system,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EFF8"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
    <tr><td style="border-radius:20px 20px 0 0;background:${BRAND};background-image:linear-gradient(135deg,#5B21B6,${BRAND} 55%,${BRAND_2});padding:30px 36px">
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#fff">Regnix <span style="font-weight:400;opacity:.7;font-size:13px">by Lexvon</span></div>
      <div style="margin-top:18px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.72)">${esc(o.eyebrow)}</div>
      <div style="margin-top:6px;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.03em;color:#fff">${esc(o.title)}</div>
    </td></tr>
    <tr><td style="background:#ffffff;padding:32px 36px 30px;border-radius:0 0 20px 20px;box-shadow:0 8px 30px rgba(40,20,90,.08)">
      ${o.current ? steps(o.current) : ''}
      <div style="font-size:15px;line-height:1.7;color:#3B3852">${o.body}</div>
    </td></tr>
    <tr><td align="center" style="padding:22px 20px;font-size:12px;line-height:1.6;color:#8C88A3">
      Regnix · Compliance, audit, legal &amp; HR in one workspace<br>
      Need help? Reply to this email or write to <a href="mailto:support@regnix.io" style="color:${BRAND}">support@regnix.io</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 14px">${t}</p>`;
const first = (name: string) => esc((name || 'there').trim().split(' ')[0]);

// ───────────────────────────────────────────────────────────────────────────

export function signupReceivedEmail(a: { name: string; company?: string; plan?: PlanLine | null }): Mail {
  return {
    subject: 'We received your Regnix application',
    html: layout({
      preheader: 'Your application is in review.', title: 'Application received', eyebrow: 'Step 1 of 4', current: 1,
      body: p(`Hi ${first(a.name)},`) +
        p(`Thanks for signing up${a.company ? ` for <strong>${esc(a.company)}</strong>` : ''}. Our team is reviewing your application. You can't sign in until it is approved &mdash; we'll email you the moment that happens.`) +
        planPanel(a.plan) +
        p('<span style="color:#6B6880;font-size:13px">What happens next: approval → KYC &amp; payment → workspace access.</span>'),
    }),
    text: `Hi ${a.name},\n\nWe received your application${a.plan ? ` for the ${a.plan.name} plan (${inr(a.plan.price)}/month)` : ''}. It is in review; you can sign in once an admin approves it.\n\n— Regnix`,
  };
}

export function approvalEmail(a: { name: string; plan?: PlanLine | null }): Mail {
  return {
    subject: 'Your signup is approved — get ready for KYC',
    html: layout({
      preheader: 'Approved! Next: a quick KYC.', title: 'Your signup process is complete', eyebrow: 'Step 2 of 4 · Approved', current: 3,
      body: p(`Hi ${first(a.name)},`) +
        p('Great news &mdash; your application has been <strong>approved</strong>. The last thing before you can use Regnix is a short KYC check.') +
        planPanel(a.plan) +
        p('<strong>Be ready with:</strong> your company registration documents, PAN and GST certificates. You will receive a separate email with a secure upload link and the exact list of documents.') +
        '<p style="margin:0;color:#6B6880;font-size:13px">You can sign in to see your status, but the workspace opens only after KYC is verified.</p>',
    }),
    text: `Hi ${a.name},\n\nYour application is approved. Get ready for KYC: you will receive an email with a secure upload link and the list of documents. The workspace opens after KYC is verified.\n\n— Regnix`,
  };
}

export function kycRequestEmail(a: {
  name: string; company?: string; documents: string[]; amount: number; dueDate?: string | null; note?: string | null;
  uploadUrl: string; plan?: PlanLine | null;
}): Mail {
  const docs = a.documents.map((d) => `<tr><td style="padding:7px 0;font-size:14px;color:#1B1830"><span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:10px;background:#EDE7FE;color:${BRAND};font-size:11px;font-weight:800;margin-right:10px">✓</span>${esc(d)}</td></tr>`).join('');
  const rows: [string, string][] = [];
  if (a.amount > 0) rows.push(['Amount to pay', inr(a.amount)]);
  if (a.dueDate) rows.push(['Due by', esc(a.dueDate)]);
  return {
    subject: 'Action needed: complete your KYC',
    html: layout({
      preheader: 'Upload your documents and complete the payment.', title: 'Complete your KYC', eyebrow: 'Step 3 of 4 · Action needed', current: 3,
      body: p(`Hi ${first(a.name)},`) +
        p(`To activate ${a.company ? `<strong>${esc(a.company)}</strong>` : 'your account'}, please upload the documents below and complete the payment. Both are done on one secure page.`) +
        (docs ? `<div style="margin:18px 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B6880">Documents required</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${docs}</table>` : '') +
        (rows.length ? panel(rows, true) : '') +
        (a.note ? `<div style="margin:16px 0;padding:14px 16px;border-left:3px solid ${BRAND};background:#FAF9FD;border-radius:0 10px 10px 0;font-size:14px;color:#3B3852"><strong>Note from our team:</strong><br>${esc(a.note)}</div>` : '') +
        button('Upload documents & pay →', a.uploadUrl) +
        `<p style="margin:18px 0 0;font-size:12.5px;color:#8C88A3;word-break:break-all">Button not working? Paste this link in your browser:<br>${esc(a.uploadUrl)}</p>` +
        '<p style="margin:14px 0 0;font-size:12.5px;color:#8C88A3">This link is personal to you — please don\'t forward it. Accepted files: PDF, JPG or PNG up to 3 MB each.</p>',
    }),
    text: `Hi ${a.name},\n\nPlease complete your KYC.\nDocuments: ${a.documents.join(', ')}\n${a.amount > 0 ? `Amount: ${inr(a.amount)}\n` : ''}${a.dueDate ? `Due: ${a.dueDate}\n` : ''}\nUpload here: ${a.uploadUrl}\n\n— Regnix`,
  };
}

export function kycVerifiedEmail(a: { name: string; loginUrl: string }): Mail {
  return {
    subject: 'KYC complete — you can sign in now',
    html: layout({
      preheader: 'Your workspace is ready.', title: 'Your KYC is complete', eyebrow: 'Step 4 of 4 · All set', current: 4,
      body: p(`Hi ${first(a.name)},`) +
        p('Your documents and payment have been verified. Your Regnix workspace is now <strong>active</strong> &mdash; you can sign in with the email and password you chose at signup.') +
        button('Sign in to Regnix →', a.loginUrl),
    }),
    text: `Hi ${a.name},\n\nYour KYC is complete. You can now sign in: ${a.loginUrl}\n\n— Regnix`,
  };
}

export function rejectionEmail(a: { name: string; reason?: string | null }): Mail {
  return {
    subject: 'Update on your Regnix application',
    html: layout({
      preheader: 'About your application.', title: 'Application not approved', eyebrow: 'Application update',
      body: p(`Hi ${first(a.name)},`) +
        p('Thank you for your interest in Regnix. Unfortunately we were not able to approve your application at this time.') +
        (a.reason ? `<div style="margin:16px 0;padding:14px 16px;border-left:3px solid #DC2626;background:#FEF2F2;border-radius:0 10px 10px 0;font-size:14px">${esc(a.reason)}</div>` : '') +
        p('If you think this is a mistake, reply to this email and we will take another look.'),
    }),
    text: `Hi ${a.name},\n\nWe could not approve your application.${a.reason ? ` Reason: ${a.reason}` : ''}\n\n— Regnix`,
  };
}

export function adminNewSignupEmail(a: {
  name: string; email: string; company?: string; industry?: string; accountType?: string; plan?: PlanLine | null; reviewUrl: string;
}): Mail {
  return {
    subject: `New signup: ${a.company || a.name}${a.plan ? ` · ${a.plan.name}` : ''}`,
    html: layout({
      preheader: 'A new application is waiting for approval.', title: 'New application', eyebrow: 'Super admin',
      body: panel([
        ['Name', esc(a.name)], ['Email', esc(a.email)], ['Company', esc(a.company || '—')],
        ['Industry', esc(a.industry || '—')], ['Type', esc(a.accountType || '—')],
        ...(a.plan ? ([['Selected plan', `${esc(a.plan.name)} · ${esc(a.plan.headcount)}`], ['Monthly price', inr(a.plan.price)]] as [string, string][]) : []),
      ]) + button('Review application →', a.reviewUrl),
    }),
    text: `New signup: ${a.name} <${a.email}> ${a.company ?? ''}${a.plan ? ` — plan ${a.plan.name} (${inr(a.plan.price)}/mo)` : ''}\nReview: ${a.reviewUrl}`,
  };
}
