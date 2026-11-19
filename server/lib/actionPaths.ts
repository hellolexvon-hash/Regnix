/**
 * Shared action → internal route table. Used by the Vercel function (api/email-handler.ts) and by the
 * local dev server, which mimics /api/email-handler so both environments behave the same.
 */
export const ACTION_PATHS: Readonly<Record<string, string>> = {
  signup: '/api/webhooks/signup',
  approval: '/api/email/approval',
  rejection: '/api/email/rejection',
  'kyc-request': '/api/email/kyc-request',
  'kyc-verified': '/api/email/kyc-verified',
  'kyc-info': '/api/kyc/info',
  'kyc-file': '/api/kyc/file',
  'kyc-submit': '/api/kyc/submit',
  'val-upload': '/api/kyc/validation-upload',
  'val-submit': '/api/kyc/validation-submit',
  'val-status': '/api/kyc/validation-status',
  'val-cert': '/api/kyc/validation-cert',
  'aud-bootstrap': '/api/kyc/auditor-bootstrap',
  'aud-claim': '/api/kyc/auditor-claim',
  'aud-file': '/api/kyc/auditor-file',
  'aud-decision': '/api/kyc/auditor-decision',
  'aud-cert': '/api/kyc/auditor-cert',
  'cert-verify': '/api/kyc/cert-verify',
  'admin-overview': '/api/kyc/admin-overview',
  'admin-detail': '/api/kyc/admin-detail',
  'admin-file': '/api/kyc/admin-file',
  'admin-action': '/api/kyc/admin-action',
  'cli-notifications': '/api/kyc/cli-notifications',
  'cli-documents': '/api/kyc/cli-documents',
  'cli-doc-file': '/api/kyc/cli-doc-file',
  'cli-planner': '/api/kyc/cli-planner',
  'cli-assistant': '/api/kyc/cli-assistant',
};
