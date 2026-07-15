import { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import {
  asString, asNumber, asDate, asStringArray, groupBy,
  normalizeReviewStatus, normalizeIssueSeverity, normalizeSpecialization,
  safeInsert, safeSelect, safeUpdate,
  safeUpsert,
} from '../lib/portalHelpers.js';

const router = Router();

type AuditorRow = {
  id?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  work_email?: string | null;
  license_id?: string | null;
  licenseId?: string | null;
  registration_no?: string | null;
  specialization?: string | null;
  joined_at?: string | null;
  joinedAt?: string | null;
};

type ValidationRow = {
  id?: string | null;
  request_id?: string | null;
  company_id?: string | null;
  user_id?: string | null;
  company_name?: string | null;
  name?: string | null;
  industry?: string | null;
  cin?: string | null;
  contact_person?: string | null;
  contactPerson?: string | null;
  contact_email?: string | null;
  contactEmail?: string | null;
  employee_count?: number | string | null;
  head_count?: number | string | null;
  acts_covered?: string[] | string | null;
  actsCovered?: string[] | string | null;
  l2_score?: number | string | null;
  l2Score?: number | string | null;
  l2_completed_at?: string | null;
  l2CompletedAt?: string | null;
  status?: string | null;
  assigned_to?: string | null;
  assignedTo?: string | null;
  decision_remarks?: string | null;
  decisionRemarks?: string | null;
  decided_at?: string | null;
  decidedAt?: string | null;
  live_register_url?: string | null;
  liveRegisterUrl?: string | null;
  live_register_file_url?: string | null;
  submitted_by_user_id?: string | null;
  submittedByUserId?: string | null;
};

type ValidationDocRow = {
  id?: string | null;
  request_id?: string | null;
  company_review_id?: string | null;
  company_id?: string | null;
  review_id?: string | null;
  name?: string | null;
  act?: string | null;
  status?: string | null;
  score?: number | string | null;
  file_url?: string | null;
  fileUrl?: string | null;
  file_name?: string | null;
  fileName?: string | null;
  mime_type?: string | null;
  mimeType?: string | null;
  storage_path?: string | null;
  storagePath?: string | null;
  uploaded_at?: string | null;
  uploadedAt?: string | null;
  tally_rows?: unknown;
  tallyRows?: unknown;
};

type ValidationIssueRow = {
  id?: string | null;
  request_id?: string | null;
  company_review_id?: string | null;
  company_id?: string | null;
  review_id?: string | null;
  doc_name?: string | null;
  docName?: string | null;
  severity?: string | null;
  rule?: string | null;
  root_cause?: string | null;
  rootCause?: string | null;
  resolved_l2?: boolean | string | null;
  resolvedL2?: boolean | string | null;
};

type AuditLogRow = {
  id?: string | null;
  actor?: string | null;
  actor_role?: string | null;
  actorRole?: string | null;
  action?: string | null;
  detail?: string | null;
  message?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
};

function toReqKey(row: ValidationRow | ValidationDocRow | ValidationIssueRow): string {
  return asString(
    (row as ValidationRow).request_id ??
      (row as ValidationRow).company_id ??
      (row as ValidationRow).id ??
      (row as ValidationDocRow).review_id ??
      (row as ValidationDocRow).company_review_id ??
      (row as ValidationIssueRow).review_id ??
      (row as ValidationIssueRow).company_review_id ??
      (row as ValidationIssueRow).request_id ??
      (row as ValidationIssueRow).company_id,
  );
}

function toAuditor(row: AuditorRow) {
  const email = asString(row.email ?? row.work_email).toLowerCase();
  return {
    id: asString(row.id, email || `auditor-${Date.now()}`),
    fullName: asString(row.full_name ?? row.fullName ?? row.name, 'Auditor'),
    email,
    licenseId: asString(row.license_id ?? row.licenseId ?? row.registration_no),
    specialization: normalizeSpecialization(row.specialization),
    joinedAt: asDate(row.joined_at ?? row.joinedAt) ?? new Date(),
  };
}

function toDoc(row: ValidationDocRow) {
  return {
    id: asString(row.id, `doc-${Date.now()}`),
    name: asString(row.name, 'Document'),
    act: asString(row.act, 'General'),
    status: asString(row.status).toLowerCase() === 'flagged' ? 'flagged' as const : 'validated' as const,
    score: asNumber(row.score, 100),
    fileUrl: row.file_url ?? row.fileUrl ?? null,
    fileName: row.file_name ?? row.fileName ?? null,
    mimeType: row.mime_type ?? row.mimeType ?? null,
    storagePath: row.storage_path ?? row.storagePath ?? null,
    uploadedAt: asDate(row.uploaded_at ?? row.uploadedAt),
    blob: null,
    tallyRows: (() => {
      const raw = row.tally_rows ?? row.tallyRows;
      if (!raw) return null;
      if (Array.isArray(raw)) return raw as any[];
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    })(),
  };
}

function toIssue(row: ValidationIssueRow) {
  return {
    id: asString(row.id, `issue-${Date.now()}`),
    docName: asString(row.doc_name ?? row.docName, 'Document'),
    severity: normalizeIssueSeverity(row.severity),
    rule: asString(row.rule, 'Compliance rule'),
    rootCause: asString(row.root_cause ?? row.rootCause, ''),
    resolvedL2: typeof row.resolved_l2 === 'string'
      ? ['true', '1', 'yes'].includes(row.resolved_l2.toLowerCase())
      : Boolean(row.resolvedL2 ?? row.resolved_l2),
  };
}

function toCompany(row: ValidationRow, docs: ReturnType<typeof toDoc>[], issues: ReturnType<typeof toIssue>[]) {
  return {
    id: asString(row.request_id ?? row.company_id ?? row.id, `review-${Date.now()}`),
    name: asString(row.company_name ?? row.name, 'Unnamed Company'),
    industry: asString(row.industry, 'Unspecified'),
    cin: asString(row.cin),
    contactPerson: asString(row.contact_person ?? row.contactPerson),
    contactEmail: asString(row.contact_email ?? row.contactEmail),
    employeeCount: asNumber(row.employee_count ?? row.head_count, 0),
    actsCovered: asStringArray(row.acts_covered ?? row.actsCovered),
    docs,
    issues,
    l2Score: asNumber(row.l2_score ?? row.l2Score, 0),
    l2CompletedAt: asDate(row.l2_completed_at ?? row.l2CompletedAt) ?? new Date(),
    status: normalizeReviewStatus(row.status),
    assignedTo: asString(row.assigned_to ?? row.assignedTo) || null,
    decisionRemarks: asString(row.decision_remarks ?? row.decisionRemarks),
    decidedAt: asDate(row.decided_at ?? row.decidedAt),
    liveRegisterUrl: row.live_register_url ?? row.liveRegisterUrl ?? null,
    liveRegisterFile: null,
    requestId: asString(row.request_id ?? row.id ?? row.company_id),
    submittedByUserId: asString(row.submitted_by_user_id ?? row.submittedByUserId) || null,
  };
}

function logEntry(row: AuditLogRow) {
  return {
    id: asString(row.id, `log-${Date.now()}`),
    actor: asString(row.actor, 'System'),
    actorRole: asString(row.actor_role ?? row.actorRole).toLowerCase() === 'auditor' ? 'auditor' as const : 'system' as const,
    action: asString(row.action, 'unknown.action'),
    detail: asString(row.detail ?? row.message),
    createdAt: asDate(row.created_at ?? row.createdAt) ?? new Date(),
  };
}

async function fetchBootstrapSnapshot() {
  const supabase = getSupabaseAdmin();

  const [
    auditorsByProfiles,
    auditorsByTable,
    validationRows,
    docRows,
    issueRows,
    auditRows,
    fallbackRequestRows,
  ] = await Promise.all([
    safeSelect<AuditorRow>(supabase, 'profiles', '*', (qb: any) => qb.eq('account_type', 'auditor').order('created_at', { ascending: false })),
    safeSelect<AuditorRow>(supabase, 'auditors', '*', (qb: any) => qb.order('joined_at', { ascending: false })),
    safeSelect<ValidationRow>(supabase, 'validation_requests', '*', (qb: any) => qb.order('created_at', { ascending: false })),
    safeSelect<ValidationDocRow>(supabase, 'validation_documents', '*', (qb: any) => qb.order('uploaded_at', { ascending: false })),
    safeSelect<ValidationIssueRow>(supabase, 'validation_issues', '*', (qb: any) => qb.order('created_at', { ascending: false })),
    safeSelect<AuditLogRow>(supabase, 'audit_log', '*', (qb: any) => qb.order('created_at', { ascending: false })),
    safeSelect<ValidationRow>(supabase, 'document_requests', '*', (qb: any) => qb.order('created_at', { ascending: false })),
  ]);

  const auditorRows = auditorsByProfiles.length ? auditorsByProfiles : auditorsByTable;
  const auditors = auditorRows.map(toAuditor);

  const sourceRows = validationRows.length ? validationRows : fallbackRequestRows;
  const docsByKey = groupBy(docRows, toReqKey);
  const issuesByKey = groupBy(issueRows, toReqKey);

  const companies = sourceRows.map((row) => {
    const key = toReqKey(row);
    return toCompany(row, (docsByKey[key] ?? []).map(toDoc), (issuesByKey[key] ?? []).map(toIssue));
  });

  const auditLog = auditRows.map(logEntry).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { auditors, companies, auditLog };
}

async function logAudit(payload: {
  actor?: string;
  actorRole?: 'auditor' | 'system';
  action: string;
  detail?: string;
}) {
  const supabase = getSupabaseAdmin();
  const row = {
    actor: asString(payload.actor, 'System'),
    actor_role: payload.actorRole === 'auditor' ? 'auditor' : 'system',
    action: asString(payload.action, 'unknown.action'),
    detail: asString(payload.detail, ''),
    created_at: new Date().toISOString(),
  };

  return safeInsert(supabase, 'audit_log', row);
}

router.get('/auditor/portal/bootstrap', async (_req: Request, res: Response) => {
  try {
    const snapshot = await fetchBootstrapSnapshot();
    res.json({
      ok: true,
      ...snapshot,
      hydratedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load auditor bootstrap data.',
    });
  }
});

router.get('/auditor/company/:id', async (req: Request, res: Response) => {
  try {
    const id = asString(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, message: 'Missing company id.' });
    }

    const snapshot = await fetchBootstrapSnapshot();
    const company = snapshot.companies.find((row) => row.id === id || row.requestId === id);

    if (!company) {
      return res.status(404).json({ ok: false, message: 'Company not found.' });
    }

    res.json({ ok: true, company });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load company details.',
    });
  }
});

router.get('/auditor/history', async (_req: Request, res: Response) => {
  try {
    const snapshot = await fetchBootstrapSnapshot();
    const companies = snapshot.companies;
    const trend = Array.from({ length: 6 }, (_, index) => {
      const subset = companies.slice(Math.max(0, companies.length - (index + 1) * Math.max(1, Math.ceil(companies.length / 6))), companies.length - index * Math.max(1, Math.ceil(companies.length / 6)));
      const avg = subset.length
        ? subset.reduce((sum, company) => sum + company.l2Score, 0) / subset.length
        : 0;
      return {
        monthOffset: 5 - index,
        score: Number(avg.toFixed(1)),
        companies: subset.length,
      };
    });

    res.json({ ok: true, trend, auditLog: snapshot.auditLog.slice(0, 100) });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load auditor history.',
    });
  }
});

router.post('/auditor/auth/signin', async (req: Request, res: Response) => {
  try {
    const email = asString(req.body?.email).toLowerCase();
    const detail = email ? `Signed in as ${email}.` : 'Auditor sign-in event recorded.';
    await logAudit({ actor: email || 'Auditor', actorRole: 'auditor', action: 'auditor.signin', detail });
    res.json({ ok: true, message: 'Auditor sign-in recorded.' });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to record auditor sign-in.',
    });
  }
});

router.post('/auditor/auth/signup', async (req: Request, res: Response) => {
  try {
    const payload = {
      full_name: asString(req.body?.fullName ?? req.body?.full_name),
      email: asString(req.body?.email).toLowerCase(),
      license_id: asString(req.body?.licenseId ?? req.body?.license_id),
      specialization: asString(req.body?.specialization),
      created_at: new Date().toISOString(),
      account_type: 'auditor',
    };

    const supabase = getSupabaseAdmin();
    const saved = await safeUpsert(supabase, 'profiles', payload, '*', { onConflict: 'email' });
    await logAudit({
      actor: payload.full_name || payload.email || 'Auditor',
      actorRole: 'auditor',
      action: 'auditor.signup',
      detail: `Created auditor profile ${payload.email || payload.full_name || 'unknown'}.`,
    });

    res.json({ ok: true, saved: saved ?? [] });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to record auditor signup.',
    });
  }
});

router.post('/auditor/auth/signout', async (_req: Request, res: Response) => {
  try {
    await logAudit({
      actor: 'Auditor',
      actorRole: 'auditor',
      action: 'auditor.signout',
      detail: 'Signed out of the Auditor Portal.',
    });
    res.json({ ok: true, message: 'Auditor sign-out recorded.' });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to record auditor sign-out.',
    });
  }
});

router.post('/auditor/reviews/claim', async (req: Request, res: Response) => {
  try {
    const companyId = asString(req.body?.companyId ?? req.body?.id);
    const auditorId = asString(req.body?.auditorId);

    if (!companyId || !auditorId) {
      return res.status(400).json({ ok: false, message: 'companyId and auditorId are required.' });
    }

    const supabase = getSupabaseAdmin();
    const updates = {
      status: 'in_review',
      assigned_to: auditorId,
      updated_at: new Date().toISOString(),
    };

    await safeUpdate(
      supabase,
      'validation_requests',
      updates,
      (qb: any) => qb.eq('id', companyId),
    );

    await safeUpdate(
      supabase,
      'document_requests',
      updates,
      (qb: any) => qb.eq('id', companyId),
    );

    await logAudit({
      actor: auditorId,
      actorRole: 'auditor',
      action: 'review.claim',
      detail: `Claimed company ${companyId} for review.`,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to claim review.',
    });
  }
});

router.post('/auditor/reviews/decision', async (req: Request, res: Response) => {
  try {
    const companyId = asString(req.body?.companyId ?? req.body?.id);
    const auditorId = asString(req.body?.auditorId);
    const decision = normalizeReviewStatus(req.body?.decision);
    const remarks = asString(req.body?.remarks);

    if (!companyId || !auditorId) {
      return res.status(400).json({ ok: false, message: 'companyId and auditorId are required.' });
    }

    const supabase = getSupabaseAdmin();
    const updates = {
      status: decision,
      decision_remarks: remarks,
      assigned_to: auditorId,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await safeUpdate(
      supabase,
      'validation_requests',
      updates,
      (qb: any) => qb.eq('id', companyId),
    );

    await safeUpdate(
      supabase,
      'document_requests',
      updates,
      (qb: any) => qb.eq('id', companyId),
    );

    if (decision === 'approved') {
      await safeInsert(supabase, 'certificates', {
        company_review_id: companyId,
        auditor_id: auditorId,
        status: 'issued',
        issued_at: new Date().toISOString(),
      });
    }

    await logAudit({
      actor: auditorId,
      actorRole: 'auditor',
      action: `review.${decision}`,
      detail: `Decision for ${companyId}: ${decision}${remarks ? ` — ${remarks}` : ''}.`,
    });

    res.json({ ok: true, decision });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to record decision.',
    });
  }
});

export default router;
