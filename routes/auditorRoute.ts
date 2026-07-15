import { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../src/lib/supabaseAdmin.js';

const router = Router();

/* ----------------------------------------------------------------------------
Types
---------------------------------------------------------------------------- */

type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected';
type IssueSeverity = 'critical' | 'major' | 'minor';
type Specialization = 'PF & ESIC' | 'Labour Law' | 'Tax & Wages' | 'General Compliance';

type ProfileRow = {
  id?: string | null;
  account_type?: string | null;
  full_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  industry?: string | null;
  gstin?: string | null;
  firm_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AuditorProfileRow = {
  user_id?: string | null;
  license_id?: string | null;
  specialization?: string | null;
  joined_at?: string | null;
  is_active?: boolean | string | null;
};

type OrganizationRow = {
  id?: string | null;
  owner_profile_id?: string | null;
  name?: string | null;
  industry?: string | null;
  cin?: string | null;
  gstin?: string | null;
  address?: string | null;
  state?: string | null;
  employee_count?: number | string | null;
  acts_covered?: string[] | string | null;
  created_at?: string | null;
};

type OrganizationMemberRow = {
  organization_id?: string | null;
  user_id?: string | null;
  contact_email?: string | null;
  contact_person?: string | null;
  member_type?: string | null;
  is_primary?: boolean | string | null;
  created_at?: string | null;
};

type ReviewCycleRow = {
  id?: string | null;
  organization_id?: string | null;
  validation_session_id?: string | null;
  reporting_month?: string | null;
  status?: string | null;
  current_level?: string | null;
  l2_score?: number | string | null;
  l2_completed_at?: string | null;
  assigned_auditor_id?: string | null;
  decision_remarks?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
};

type ValidationSessionRow = {
  id?: string | null;
  user_id?: string | null;
  document_request_id?: string | null;
  organization_id?: string | null;
  company_name?: string | null;
  contact_email?: string | null;
  selected_acts?: string[] | string | null;
  current_route?: string | null;
  current_step?: number | string | null;
  level_states?: string[] | string | null;
  uploaded_docs?: unknown[] | string | null;
  signature_data_url?: string | null;
  live_register_file_name?: string | null;
  live_register_file_type?: string | null;
  submitted_at?: string | null;
  is_approved?: boolean | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ValidationDocRow = {
  id?: string | null;
  validation_session_id?: string | null;
  file_name?: string | null;
  storage_key?: string | null;
  mime_type?: string | null;
  file_size?: number | string | null;
  sha256_hash?: string | null;
  file_type?: string | null;
  sheet_preview?: unknown;
  verified?: boolean | string | null;
  created_at?: string | null;
};

type IssueRow = {
  id?: string | null;
  review_cycle_id?: string | null;
  document_id?: string | null;
  severity?: string | null;
  rule?: string | null;
  root_cause?: string | null;
  resolved_l2?: boolean | string | null;
  created_at?: string | null;
};

type DocumentRequestRow = {
  id?: string | null;
  user_id?: string | null;
  organization_id?: string | null;
  company_name?: string | null;
  contact_email?: string | null;
  act_type?: string | null;
  state?: string | null;
  head_count?: number | string | null;
  establishment_name?: string | null;
  address?: string | null;
  status?: string | null;
  validation_session_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AuditLogRow = {
  id?: string | number | null;
  actor_user_id?: string | null;
  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: unknown;
  ip_address?: string | null;
  created_at?: string | null;
};

type CertificateRow = {
  id?: string | null;
  review_cycle_id?: string | null;
  certificate_no?: string | null;
  data_snapshot?: unknown;
  pdf_storage_key?: string | null;
  pdf_sha256?: string | null;
  issued_by?: string | null;
  issued_at?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
};

interface Auditor {
  id: string;
  fullName: string;
  email: string;
  licenseId: string;
  specialization: Specialization;
  joinedAt: Date;
  active: boolean;
}

interface ReviewDoc {
  id: string;
  name: string;
  act: string;
  status: 'validated' | 'flagged';
  score: number;
  fileName: string | null;
  mimeType: string | null;
  storagePath: string | null;
  uploadedAt: Date | null;
  tallyRows: unknown[] | null;
  verified: boolean;
}

interface CarriedIssue {
  id: string;
  docName: string;
  severity: IssueSeverity;
  rule: string;
  rootCause: string;
  resolvedL2: boolean;
}

interface CompanyReview {
  id: string;
  name: string;
  industry: string;
  cin: string;
  contactPerson: string;
  contactEmail: string;
  employeeCount: number;
  actsCovered: string[];
  docs: ReviewDoc[];
  issues: CarriedIssue[];
  l2Score: number;
  l2CompletedAt: Date;
  status: ReviewStatus;
  assignedTo: string | null;
  decisionRemarks: string;
  decidedAt: Date | null;
  liveRegisterUrl: string | null;
  liveRegisterFile: File | null;
  requestId: string;
  submittedByUserId: string | null;

  organizationId?: string | null;
  validationSessionId?: string | null;
  reviewCycleId?: string | null;
  documentRequestId?: string | null;
}

interface AuditLogEntry {
  id: string;
  actor: string;
  actorRole: 'auditor' | 'system';
  action: string;
  detail: string;
  createdAt: Date;
}

/* ----------------------------------------------------------------------------
Small helpers
---------------------------------------------------------------------------- */

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean);
      }
    } catch {
      return trimmed
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeReviewStatus(value: unknown): ReviewStatus {
  const s = asString(value).toLowerCase();
  if (s === 'in_review' || s === 'under_review') return 'in_review';
  if (s === 'approved') return 'approved';
  if (s === 'changes_requested' || s === 'changes requested') return 'changes_requested';
  if (s === 'rejected') return 'rejected';
  return 'pending';
}

function normalizeIssueSeverity(value: unknown): IssueSeverity {
  const s = asString(value).toLowerCase();
  if (s === 'major') return 'major';
  if (s === 'minor') return 'minor';
  return 'critical';
}

function normalizeSpecialization(value: unknown): Specialization {
  const s = asString(value).toLowerCase();
  if (s.includes('pf') || s.includes('esic')) return 'PF & ESIC';
  if (s.includes('tax') || s.includes('wages')) return 'Tax & Wages';
  if (s.includes('labour')) return 'Labour Law';
  return 'General Compliance';
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function latestBy<T>(
  items: T[],
  keyFn: (item: T) => string,
  sortValueFn: (item: T) => number,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev || sortValueFn(item) > sortValueFn(prev)) {
      map.set(key, item);
    }
  }
  return map;
}

function computeAverageScore(docs: ReviewDoc[]): number {
  const scores = docs.map((doc) => doc.score).filter((n) => Number.isFinite(n));
  if (!scores.length) return 0;
  const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(avg * 10) / 10;
}

function pickPrimaryMember(members: OrganizationMemberRow[]): OrganizationMemberRow | null {
  if (!members.length) return null;
  return (
    members.find((m) => asBoolean(m.is_primary, false))
    ?? members.find((m) => asString(m.member_type).toLowerCase() === 'client_admin')
    ?? members[0]
    ?? null
  );
}

function mapActorRole(value: unknown): 'auditor' | 'system' {
  const s = asString(value).toLowerCase();
  return s === 'auditor' ? 'auditor' : 'system';
}

function reviewSortDate(company: CompanyReview): number {
  return company.decidedAt?.getTime() ?? company.l2CompletedAt?.getTime() ?? 0;
}

/* ----------------------------------------------------------------------------
Typed Supabase helpers
---------------------------------------------------------------------------- */

async function safeSelect<T>(
  supabase: any,
  table: string,
  columns = '*',
  build?: (qb: any) => any,
): Promise<T[]> {
  let query = supabase.from(table).select(columns);
  if (build) query = build(query);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

async function safeInsert<T>(
  supabase: any,
  table: string,
  row: Record<string, unknown>,
  columns = '*',
): Promise<T | T[] | null> {
  const { data, error } = await supabase.from(table).insert(row).select(columns);
  if (error) throw error;
  return (data ?? null) as T | T[] | null;
}

async function safeUpdate<T>(
  supabase: any,
  table: string,
  patch: Record<string, unknown>,
  build: (qb: any) => any,
  columns = '*',
): Promise<T[] | null> {
  let query = supabase.from(table).update(patch).select(columns);
  query = build(query);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? null) as T[] | null;
}

async function safeUpsert<T>(
  supabase: any,
  table: string,
  row: Record<string, unknown>,
  columns = '*',
  opts?: { onConflict?: string },
): Promise<T | T[] | null> {
  const { data, error } = await supabase
    .from(table)
    .upsert(row, opts?.onConflict ? { onConflict: opts.onConflict } : undefined)
    .select(columns);
  if (error) throw error;
  return (data ?? null) as T | T[] | null;
}

/* ----------------------------------------------------------------------------
Row mappers
---------------------------------------------------------------------------- */

function toAuditor(profile: ProfileRow, auditorProfile?: AuditorProfileRow | null): Auditor {
  const email = asString(profile.email).toLowerCase();
  const joinedAt = asDate(auditorProfile?.joined_at ?? profile.created_at) ?? new Date();

  return {
    id: asString(profile.id, email || `auditor-${Date.now()}`),
    fullName: asString(profile.full_name, 'Auditor'),
    email,
    licenseId: asString(auditorProfile?.license_id),
    specialization: normalizeSpecialization(auditorProfile?.specialization ?? profile.industry),
    joinedAt,
    active: asBoolean(auditorProfile?.is_active, true),
  };
}

function toDoc(row: ValidationDocRow): ReviewDoc {
  const preview = parseJsonObject(row.sheet_preview);
  const tallyRows = Array.isArray((preview as any).rows) ? ((preview as any).rows as unknown[]) : null;

  return {
    id: asString(row.id, `doc-${Date.now()}`),
    name: asString(row.file_name, 'Document'),
    act: asString(row.file_type || row.mime_type || 'General', 'General'),
    status: asBoolean(row.verified, false) ? 'validated' : 'flagged',
    score: asNumber(row.file_size, 100),
    fileName: asString(row.file_name) || null,
    mimeType: asString(row.mime_type) || null,
    storagePath: asString(row.storage_key) || null,
    uploadedAt: asDate(row.created_at),
    tallyRows,
    verified: asBoolean(row.verified, false),
  };
}

function toIssue(row: IssueRow): CarriedIssue {
  return {
    id: asString(row.id, `issue-${Date.now()}`),
    docName: asString(row.document_id, 'Document'),
    severity: normalizeIssueSeverity(row.severity),
    rule: asString(row.rule, 'Compliance rule'),
    rootCause: asString(row.root_cause, ''),
    resolvedL2: asBoolean(row.resolved_l2, false),
  };
}

function buildCompanyFromReviewCycle(args: {
  reviewCycle: ReviewCycleRow;
  organization: OrganizationRow | null;
  member: OrganizationMemberRow | null;
  session: ValidationSessionRow | null;
  request: DocumentRequestRow | null;
  docs: ValidationDocRow[];
  issues: IssueRow[];
}): CompanyReview {
  const { reviewCycle, organization, member, session, request, docs, issues } = args;
  const mappedDocs = docs.map(toDoc);
  const mappedIssues = issues.map(toIssue);

  const name = asString(organization?.name || session?.company_name || request?.company_name, 'Unnamed Company');
  const industry = asString(organization?.industry, 'Unspecified');
  const contactPerson = asString(
    member?.contact_person
      || session?.company_name
      || request?.establishment_name
      || name,
    'Contact Person',
  );
  const contactEmail = asString(
    member?.contact_email
      || session?.contact_email
      || request?.contact_email,
    '',
  ).toLowerCase();

  return {
    id: asString(reviewCycle.id, `review-${Date.now()}`),
    name,
    industry,
    cin: asString(organization?.cin),
    contactPerson,
    contactEmail,
    employeeCount: asNumber(organization?.employee_count, asNumber(request?.head_count, 0)),
    actsCovered: asStringArray(organization?.acts_covered ?? session?.selected_acts),
    docs: mappedDocs,
    issues: mappedIssues,
    l2Score: asNumber(reviewCycle.l2_score, computeAverageScore(mappedDocs)),
    l2CompletedAt: asDate(reviewCycle.l2_completed_at ?? session?.updated_at ?? reviewCycle.created_at) ?? new Date(),
    status: normalizeReviewStatus(reviewCycle.status),
    assignedTo: asString(reviewCycle.assigned_auditor_id) || null,
    decisionRemarks: asString(reviewCycle.decision_remarks),
    decidedAt: asDate(reviewCycle.decided_at),
    liveRegisterUrl: null,
    liveRegisterFile: null,
    requestId: asString(reviewCycle.validation_session_id || session?.document_request_id || reviewCycle.id),
    submittedByUserId: asString(session?.user_id ?? request?.user_id ?? organization?.owner_profile_id) || null,
    organizationId: asString(reviewCycle.organization_id) || null,
    validationSessionId: asString(reviewCycle.validation_session_id ?? session?.id) || null,
    reviewCycleId: asString(reviewCycle.id) || null,
    documentRequestId: asString(session?.document_request_id ?? request?.id) || null,
  };
}

function buildCompanyFromSession(args: {
  session: ValidationSessionRow;
  organization: OrganizationRow | null;
  member: OrganizationMemberRow | null;
  request: DocumentRequestRow | null;
  docs: ValidationDocRow[];
}): CompanyReview {
  const { session, organization, member, request, docs } = args;
  const mappedDocs = docs.map(toDoc);

  const status: ReviewStatus = session.is_approved
    ? 'approved'
    : asString(session.current_route) === 'level3'
      ? 'in_review'
      : 'pending';

  const name = asString(organization?.name || session.company_name || request?.company_name, 'Unnamed Company');
  const industry = asString(organization?.industry, 'Unspecified');

  return {
    id: asString(session.id, `session-${Date.now()}`),
    name,
    industry,
    cin: asString(organization?.cin),
    contactPerson: asString(
      member?.contact_person
        || session.company_name
        || request?.establishment_name
        || name,
      'Contact Person',
    ),
    contactEmail: asString(
      member?.contact_email
        || session.contact_email
        || request?.contact_email,
      '',
    ).toLowerCase(),
    employeeCount: asNumber(organization?.employee_count, asNumber(request?.head_count, 0)),
    actsCovered: asStringArray(organization?.acts_covered ?? session.selected_acts),
    docs: mappedDocs,
    issues: [],
    l2Score: computeAverageScore(mappedDocs),
    l2CompletedAt: asDate(session.updated_at ?? session.submitted_at ?? session.created_at) ?? new Date(),
    status,
    assignedTo: null,
    decisionRemarks: '',
    decidedAt: session.is_approved ? asDate(session.submitted_at ?? session.updated_at) : null,
    liveRegisterUrl: null,
    liveRegisterFile: null,
    requestId: asString(session.document_request_id ?? session.id),
    submittedByUserId: asString(session.user_id ?? request?.user_id ?? organization?.owner_profile_id) || null,
    organizationId: asString(session.organization_id) || null,
    validationSessionId: asString(session.id) || null,
    reviewCycleId: null,
    documentRequestId: asString(session.document_request_id) || null,
  };
}

function buildCompanyFromRequest(request: DocumentRequestRow): CompanyReview {
  return {
    id: asString(request.id, `request-${Date.now()}`),
    name: asString(request.company_name, 'Unnamed Company'),
    industry: 'Unspecified',
    cin: '',
    contactPerson: asString(request.establishment_name || request.company_name, 'Contact Person'),
    contactEmail: asString(request.contact_email).toLowerCase(),
    employeeCount: asNumber(request.head_count, 0),
    actsCovered: asStringArray(request.act_type ? [request.act_type] : []),
    docs: [],
    issues: [],
    l2Score: 0,
    l2CompletedAt: asDate(request.updated_at ?? request.created_at) ?? new Date(),
    status: 'pending',
    assignedTo: null,
    decisionRemarks: '',
    decidedAt: null,
    liveRegisterUrl: null,
    liveRegisterFile: null,
    requestId: asString(request.id),
    submittedByUserId: asString(request.user_id) || null,
    organizationId: asString(request.organization_id) || null,
    validationSessionId: asString(request.validation_session_id) || null,
    reviewCycleId: null,
    documentRequestId: asString(request.id) || null,
  };
}

function logEntry(row: AuditLogRow): AuditLogEntry {
  const metadata = parseJsonObject(row.metadata);
  const actor = asString(metadata.actor ?? metadata.actorName ?? row.actor_user_id ?? 'System', 'System');
  const detail = asString(metadata.detail ?? metadata.message ?? '', '');
  const actorRole = mapActorRole(metadata.actorRole ?? metadata.actor_role ?? 'system');

  return {
    id: asString(row.id, `log-${Date.now()}`),
    actor,
    actorRole,
    action: asString(row.action, 'unknown.action'),
    detail,
    createdAt: asDate(row.created_at) ?? new Date(),
  };
}

/* ----------------------------------------------------------------------------
Snapshot builder
---------------------------------------------------------------------------- */

async function fetchBootstrapSnapshot() {
  const supabase = getSupabaseAdmin();

  const [
    profileRows,
    auditorProfileRows,
    organizationRows,
    organizationMemberRows,
    reviewCycleRows,
    sessionRows,
    docRows,
    issueRows,
    auditRows,
    fallbackRequestRows,
  ] = await Promise.all([
    safeSelect<ProfileRow>(supabase, 'profiles', '*', (qb: any) => qb.order('created_at', { ascending: false })),
    safeSelect<AuditorProfileRow>(supabase, 'auditor_profiles', '*', (qb: any) => qb.order('joined_at', { ascending: false })),
    safeSelect<OrganizationRow>(supabase, 'organizations', '*', (qb: any) => qb.order('created_at', { ascending: false })),
    safeSelect<OrganizationMemberRow>(supabase, 'organization_members', '*', (qb: any) => qb.order('created_at', { ascending: false })),
    safeSelect<ReviewCycleRow>(supabase, 'review_cycles', '*', (qb: any) => qb.order('created_at', { ascending: false })),
    safeSelect<ValidationSessionRow>(supabase, 'validation_sessions', '*', (qb: any) => qb.order('updated_at', { ascending: false })),
    safeSelect<ValidationDocRow>(supabase, 'validation_documents', '*', (qb: any) => qb.order('created_at', { ascending: false })),
    safeSelect<IssueRow>(supabase, 'issues', '*', (qb: any) => qb.order('created_at', { ascending: false })),
    safeSelect<AuditLogRow>(supabase, 'audit_log', '*', (qb: any) => qb.order('created_at', { ascending: false }).limit(500)),
    safeSelect<DocumentRequestRow>(supabase, 'document_requests', '*', (qb: any) => qb.order('created_at', { ascending: false })),
  ]);

  const auditorProfileMap = new Map(auditorProfileRows.map((row) => [asString(row.user_id), row]));
  const organizationMap = new Map(organizationRows.map((row) => [asString(row.id), row]));
  const memberByOrg = groupBy(organizationMemberRows, (row) => asString(row.organization_id));
  const sessionById = new Map(sessionRows.map((row) => [asString(row.id), row]));
  const sessionByOrg = latestBy(
    sessionRows.filter((row) => asString(row.organization_id)),
    (row) => asString(row.organization_id),
    (row) => asDate(row.updated_at ?? row.created_at)?.getTime() ?? 0,
  );
  const docsBySession = groupBy(docRows, (row) => asString(row.validation_session_id));
  const issuesByReview = groupBy(issueRows, (row) => asString(row.review_cycle_id));
  const requestsBySession = new Map(
    fallbackRequestRows
      .filter((row) => asString(row.validation_session_id))
      .map((row) => [asString(row.validation_session_id), row] as const),
  );
  const requestsByOrg = new Map(
    fallbackRequestRows
      .filter((row) => asString(row.organization_id))
      .map((row) => [asString(row.organization_id), row] as const),
  );
  const requestById = new Map(fallbackRequestRows.map((row) => [asString(row.id), row]));
  const reviewByOrg = latestBy(
    reviewCycleRows.filter((row) => asString(row.organization_id)),
    (row) => asString(row.organization_id),
    (row) => asDate(row.created_at ?? row.decided_at ?? row.l2_completed_at)?.getTime() ?? 0,
  );

  const auditors = profileRows
    .filter((row) => asString(row.account_type).toLowerCase() === 'auditor' || auditorProfileMap.has(asString(row.id)))
    .map((profile) => toAuditor(profile, auditorProfileMap.get(asString(profile.id)) ?? null))
    .filter((auditor) => Boolean(auditor.id));

  const companies: CompanyReview[] = [];

  // 1) review cycles
  for (const reviewCycle of reviewCycleRows) {
    const orgId = asString(reviewCycle.organization_id);
    const organization = organizationMap.get(orgId) ?? null;
    const session = reviewCycle.validation_session_id
      ? sessionById.get(asString(reviewCycle.validation_session_id)) ?? null
      : sessionByOrg.get(orgId) ?? null;
    const request = session?.document_request_id
      ? requestById.get(asString(session.document_request_id)) ?? null
      : requestsByOrg.get(orgId) ?? null;
    const members = memberByOrg[orgId] ?? [];
    const member = pickPrimaryMember(members);
    const sessionId = asString(session?.id ?? reviewCycle.validation_session_id);
    const docs = docsBySession[sessionId] ?? [];
    const issues = issuesByReview[asString(reviewCycle.id)] ?? [];

    companies.push(buildCompanyFromReviewCycle({
      reviewCycle,
      organization,
      member,
      session: session ?? null,
      request: request ?? null,
      docs,
      issues,
    }));
  }

  // 2) sessions without review cycle
  for (const session of sessionRows) {
    const alreadyIncluded = companies.some(
      (company) =>
        company.validationSessionId === asString(session.id)
        || company.requestId === asString(session.document_request_id)
        || company.organizationId === asString(session.organization_id),
    );
    if (alreadyIncluded) continue;

    const orgId = asString(session.organization_id);
    const organization = organizationMap.get(orgId) ?? null;
    const members = memberByOrg[orgId] ?? [];
    const member = pickPrimaryMember(members);
    const request = session.document_request_id
      ? requestsBySession.get(asString(session.document_request_id)) ?? null
      : requestsByOrg.get(orgId) ?? null;
    const docs = docsBySession[asString(session.id)] ?? [];

    companies.push(buildCompanyFromSession({
      session,
      organization,
      member,
      request,
      docs,
    }));
  }

  // 3) requests without session/review cycle
  for (const request of fallbackRequestRows) {
    const alreadyIncluded = companies.some(
      (company) =>
        company.documentRequestId === asString(request.id)
        || company.requestId === asString(request.id),
    );
    if (alreadyIncluded) continue;

    companies.push(buildCompanyFromRequest(request));
  }

  companies.sort((a, b) => reviewSortDate(b) - reviewSortDate(a));

  const auditLog = auditRows
    .map(logEntry)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    auditors,
    companies,
    auditLog,
    reviewCountByOrg: reviewByOrg,
  };
}

async function findCompanySnapshot(companyId: string) {
  const snapshot = await fetchBootstrapSnapshot();
  const id = companyId.trim();
  const company = snapshot.companies.find((row) =>
    row.id === id
    || row.requestId === id
    || row.organizationId === id
    || row.validationSessionId === id
    || row.reviewCycleId === id
    || row.documentRequestId === id,
  );
  return { snapshot, company };
}

/* ----------------------------------------------------------------------------
Audit logging
---------------------------------------------------------------------------- */

async function appendAudit(payload: {
  actor?: string;
  actorRole?: 'auditor' | 'system';
  action: string;
  detail?: string;
  entityType?: string;
  entityId?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const actor = asString(payload.actor, 'System');
  const metadata = {
    actor,
    actorRole: payload.actorRole ?? 'system',
    detail: asString(payload.detail, ''),
  };

  await safeInsert(supabase, 'audit_log', {
    actor_user_id: isUuid(actor) ? actor : null,
    action: asString(payload.action, 'unknown.action'),
    entity_type: asString(payload.entityType, 'auditor'),
    entity_id: payload.entityId && isUuid(payload.entityId) ? payload.entityId : null,
    metadata,
    created_at: new Date().toISOString(),
  });
}

/* ----------------------------------------------------------------------------
Routes
---------------------------------------------------------------------------- */

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

router.get('/auditor/bootstrap', async (_req: Request, res: Response) => {
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

    const { company } = await findCompanySnapshot(id);

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
    const bucketSize = Math.max(1, Math.ceil(companies.length / 6));

    const trend = Array.from({ length: 6 }, (_, index) => {
      const start = Math.max(0, companies.length - (index + 1) * bucketSize);
      const end = Math.max(0, companies.length - index * bucketSize);
      const subset = companies.slice(start, end);
      const avg = subset.length
        ? subset.reduce((sum, company) => sum + company.l2Score, 0) / subset.length
        : 0;

      return {
        monthOffset: 5 - index,
        score: Number(avg.toFixed(1)),
        companies: subset.length,
      };
    });

    res.json({
      ok: true,
      trend,
      auditLog: snapshot.auditLog.slice(0, 100),
    });
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
    await appendAudit({
      actor: email || 'Auditor',
      actorRole: 'auditor',
      action: 'auditor.signin',
      detail: email ? `Signed in as ${email}.` : 'Auditor sign-in event recorded.',
      entityType: 'auditor',
      entityId: null,
    });

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
    const fullName = asString(req.body?.fullName ?? req.body?.full_name);
    const email = asString(req.body?.email).toLowerCase();
    const licenseId = asString(req.body?.licenseId ?? req.body?.license_id);
    const specialization = normalizeSpecialization(req.body?.specialization);

    const supabase = getSupabaseAdmin();

    // Keep profiles aligned with your current schema (company/client),
    // and store auditor-only fields in auditor_profiles.
    let profileId = asString(req.body?.userId);
    if (!profileId && email) {
      const existing = await safeSelect<ProfileRow>(supabase, 'profiles', '*', (qb: any) =>
        qb.eq('email', email).limit(1),
      );
      profileId = asString(existing[0]?.id);
    }

    if (!profileId) {
      const created = await safeUpsert<ProfileRow>(
        supabase,
        'profiles',
        {
          account_type: 'client',
          full_name: fullName || 'Auditor',
          email,
          company_name: null,
          industry: null,
          gstin: null,
          firm_name: null,
          updated_at: new Date().toISOString(),
        },
        '*',
        { onConflict: 'email' },
      );

      const createdRow = Array.isArray(created) ? created[0] : created;
      profileId = asString((createdRow as Record<string, unknown> | null)?.id);
    }

    if (!profileId) {
      return res.status(400).json({ ok: false, message: 'Could not resolve or create profile for auditor.' });
    }

    await safeUpsert<AuditorProfileRow>(
      supabase,
      'auditor_profiles',
      {
        user_id: profileId,
        license_id: licenseId,
        specialization,
        joined_at: new Date().toISOString(),
        is_active: true,
      },
      '*',
      { onConflict: 'user_id' },
    );

    await appendAudit({
      actor: fullName || email || 'Auditor',
      actorRole: 'auditor',
      action: 'auditor.signup',
      detail: `Created auditor profile ${email || fullName || 'unknown'}.`,
      entityType: 'auditor',
      entityId: profileId,
    });

    res.json({ ok: true, profileId });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to record auditor signup.',
    });
  }
});

router.post('/auditor/auth/signout', async (_req: Request, res: Response) => {
  try {
    await appendAudit({
      actor: 'Auditor',
      actorRole: 'auditor',
      action: 'auditor.signout',
      detail: 'Signed out of the Auditor Portal.',
      entityType: 'auditor',
      entityId: null,
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

    const { company } = await findCompanySnapshot(companyId);
    if (!company) {
      return res.status(404).json({ ok: false, message: 'Company not found.' });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (company.reviewCycleId) {
      await safeUpdate(
        supabase,
        'review_cycles',
        {
          status: 'in_review',
          assigned_auditor_id: auditorId,
          current_level: 'level_3',
          updated_at: now,
        },
        (qb: any) => qb.eq('id', company.reviewCycleId),
      );
    }

    if (company.validationSessionId) {
      await safeUpdate(
        supabase,
        'validation_sessions',
        {
          current_route: 'level3',
          current_step: 3,
          updated_at: now,
        },
        (qb: any) => qb.eq('id', company.validationSessionId),
      );
    }

    if (company.documentRequestId) {
      await safeUpdate(
        supabase,
        'document_requests',
        {
          status: 'processing',
          updated_at: now,
        },
        (qb: any) => qb.eq('id', company.documentRequestId),
      );
    }

    await appendAudit({
      actor: auditorId,
      actorRole: 'auditor',
      action: 'review.claim',
      detail: `Claimed ${company.name} for review.`,
      entityType: 'review_cycle',
      entityId: company.reviewCycleId || company.validationSessionId || company.documentRequestId || null,
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

    const { company } = await findCompanySnapshot(companyId);
    if (!company) {
      return res.status(404).json({ ok: false, message: 'Company not found.' });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (company.reviewCycleId) {
      await safeUpdate(
        supabase,
        'review_cycles',
        {
          status: decision,
          decision_remarks: remarks,
          assigned_auditor_id: auditorId,
          decided_at: now,
          updated_at: now,
        },
        (qb: any) => qb.eq('id', company.reviewCycleId),
      );
    }

    if (company.validationSessionId) {
      await safeUpdate(
        supabase,
        'validation_sessions',
        {
          is_approved: decision === 'approved',
          current_route: 'level3',
          current_step: 3,
          updated_at: now,
        },
        (qb: any) => qb.eq('id', company.validationSessionId),
      );
    }

    if (company.documentRequestId) {
      await safeUpdate(
        supabase,
        'document_requests',
        {
          status: decision === 'approved' ? 'completed' : 'processing',
          updated_at: now,
        },
        (qb: any) => qb.eq('id', company.documentRequestId),
      );
    }

    if (decision === 'approved' && company.reviewCycleId) {
      const certificateNo = `RGX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const snapshot = {
        company,
        remarks,
        decidedAt: now,
        auditorId,
        decision,
      };

      await safeUpsert<CertificateRow>(
        supabase,
        'certificates',
        {
          review_cycle_id: company.reviewCycleId,
          certificate_no: certificateNo,
          data_snapshot: snapshot,
          pdf_storage_key: `certificates/${company.reviewCycleId}.pdf`,
          pdf_sha256: `pending-${Date.now()}`,
          issued_by: isUuid(auditorId) ? auditorId : null,
          issued_at: now,
          revoked_at: null,
          revoked_reason: null,
        },
        '*',
        { onConflict: 'review_cycle_id' },
      );
    }

    await appendAudit({
      actor: auditorId,
      actorRole: 'auditor',
      action: `review.${decision}`,
      detail: `Decision for ${company.name}: ${decision}${remarks ? ` — ${remarks}` : ''}.`,
      entityType: 'review_cycle',
      entityId: company.reviewCycleId || company.validationSessionId || company.documentRequestId || null,
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