/**
 * auditorStore.ts
 *
 * Database-backed state container for the Auditor Portal.
 *
 * The UI consumes the exact same shape as before, but the data now comes from:
 *   1) the database-backed bootstrap endpoint (preferred), or
 *   2) direct Supabase table reads as a fallback.
 *
 * The portal only shows companies that actually reached validation / review,
 * and each document is hydrated with the real uploaded file blob when a file
 * URL is available. No UI structure changes are required.
 *
 * Notes:
 *   - The local auditor sign-in/sign-up gate is preserved so the existing
 *     portal flow stays intact.
 *   - The review queue / command center / document review views are all fed
 *     from the database snapshot.
 *   - Uploaded files are materialized into Blob/File instances so PdfViewer
 *     and LiveRegister can render the actual company files.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ── Types ────────────────────────────────────────────────────────────────────

export type Specialization =
  | 'PF & ESIC'
  | 'Labour Law'
  | 'Tax & Wages'
  | 'General Compliance';

export interface Auditor {
  id:             string;
  fullName:       string;
  email:          string;
  licenseId:      string;
  specialization: Specialization;
  joinedAt:       Date;
}

export type ReviewStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'changes_requested'
  | 'rejected';

export type IssueSeverity = 'critical' | 'major' | 'minor';

export interface AuditLogEntry {
  id:        string;
  actor:     string;
  actorRole: 'auditor' | 'system';
  action:    string;
  detail:    string;
  createdAt: Date;
}

export interface CarriedIssue {
  id:         string;
  docName:    string;
  severity:   IssueSeverity;
  rule:       string;
  rootCause:  string;
  resolvedL2: boolean;
}

export interface TallyRow {
  label:    string;
  docValue: string;
  regValue: string;
  match:    boolean;
}

export interface ReviewDoc {
  id:        string;
  name:      string;
  act:       string;
  status:    'validated' | 'flagged';
  score:     number; // 0-100

  // Database-backed file metadata
  fileUrl?:   string | null;
  fileName?:  string | null;
  mimeType?:  string | null;
  storagePath?: string | null;
  uploadedAt?: Date | null;

  // Materialized blob for the viewer
  blob?: Blob | null;

  // Optional precomputed comparison rows from the database
  tallyRows?: TallyRow[] | null;
}

export interface CompanyReview {
  id:              string;
  name:            string;
  industry:        string;
  cin:             string;
  contactPerson:   string;
  contactEmail:    string;
  employeeCount:   number;
  actsCovered:     string[];
  docs:            ReviewDoc[];
  issues:          CarriedIssue[];
  l2Score:         number;
  l2CompletedAt:   Date;
  status:          ReviewStatus;
  assignedTo:      string | null;
  decisionRemarks: string;
  decidedAt:       Date | null;

  // Materialized master register file for the live comparison viewer.
  liveRegisterUrl?:   string | null;
  liveRegisterFile?:  File | null;
  requestId?:         string | null;
  submittedByUserId?: string | null;
}

interface Store {
  auditors:         Auditor[];
  credentials:      Record<string, string>;
  currentAuditorId: string | null;
  companies:        CompanyReview[];
  auditLog:         AuditLogEntry[];
  loading:          boolean;
  error:            string | null;
  hydrated:         boolean;
}

// ── Demo auditor gate (kept so the current portal flow still works) ──────────

const DEMO_AUDITOR: Auditor = {
  id: 'demo-auditor',
  fullName: 'Ananya Rao',
  email: 'ananya.rao@regnix-audit.in',
  licenseId: 'RGX-AUD-2291',
  specialization: 'PF & ESIC',
  joinedAt: new Date('2025-01-01T10:00:00.000Z'),
};

let _store: Store = {
  auditors:         [DEMO_AUDITOR],
  credentials:      { [DEMO_AUDITOR.email]: 'demo1234' },
  currentAuditorId: null,
  companies:        [],
  auditLog:         [],
  loading:          true,
  error:            null,
  hydrated:         false,
};

let _hydratePromise: Promise<void> | null = null;

const AUDITOR_SESSION_KEY = 'regnix.auditor.currentAuditorId.v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readStoredCurrentAuditorId(): string | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(AUDITOR_SESSION_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

function persistCurrentAuditorId(value: string | null) {
  if (!isBrowser()) return;
  try {
    if (value) window.sessionStorage.setItem(AUDITOR_SESSION_KEY, value);
    else window.sessionStorage.removeItem(AUDITOR_SESSION_KEY);
  } catch {
    // Ignore storage errors; the in-memory gate still works.
  }
}

// ── Module utilities ────────────────────────────────────────────────────────

type Listener = () => void;
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach((fn) => fn());
}

function setField<K extends keyof Store>(key: K, value: Store[K]) {
  _store = { ..._store, [key]: value };
  if (key === 'currentAuditorId') {
    persistCurrentAuditorId(value as string | null);
  }
  notify();
}

function daysAgo(n: number, h = 10, m = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function parseDateish(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function ensureArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function toSpecialization(value: unknown): Specialization {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('tax')) return 'Tax & Wages';
  if (text.includes('general')) return 'General Compliance';
  if (text.includes('labour')) return 'Labour Law';
  return 'PF & ESIC';
}

function normalizeReviewStatus(value: unknown): ReviewStatus {
  const text = String(value ?? '').toLowerCase();
  if (text === 'approved') return 'approved';
  if (text === 'changes_requested' || text === 'changes requested') return 'changes_requested';
  if (text === 'rejected') return 'rejected';
  if (text === 'in_review' || text === 'in review') return 'in_review';
  return 'pending';
}

function normalizeIssueSeverity(value: unknown): IssueSeverity {
  const text = String(value ?? '').toLowerCase();
  if (text === 'critical') return 'critical';
  if (text === 'minor') return 'minor';
  return 'major';
}

function normalizeDocStatus(value: unknown): 'validated' | 'flagged' {
  const text = String(value ?? '').toLowerCase();
  return text === 'flagged' || text === 'issue' ? 'flagged' : 'validated';
}

function normalizeTallyRows(value: unknown): TallyRow[] | null {
  if (!value) return null;
  const rows = ensureArray(value);
  if (!rows.length) return null;

  const out: TallyRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const label = pickString(r.label, r.field, r.name);
    const docValue = pickString(r.docValue, r.filedValue, r.asFiled, r.filed);
    const regValue = pickString(r.regValue, r.liveValue, r.registerValue, r.masterValue);
    const matchRaw = r.match;
    const match = typeof matchRaw === 'boolean'
      ? matchRaw
      : docValue === regValue;
    if (label) {
      out.push({ label, docValue, regValue, match });
    }
  }
  return out.length ? out : null;
}

async function fetchBlobFromUrl(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

async function fetchFileFromUrl(url: string, fileName: string, mimeType?: string | null): Promise<File | null> {
  const blob = await fetchBlobFromUrl(url);
  if (!blob) return null;
  return new File([blob], fileName, { type: mimeType || blob.type || 'application/octet-stream' });
}

function createLocalAuditLog(actor: string, actorRole: AuditLogEntry['actorRole'], action: string, detail: string) {
  const entry: AuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor,
    actorRole,
    action,
    detail,
    createdAt: new Date(),
  };
  _store = { ..._store, auditLog: [entry, ..._store.auditLog].slice(0, 500) };
  notify();
}

// ── Demo fallback seed for sign-in only (not for portal company data) ────────

function seedDemoIfMissing() {
  if (_store.auditors.length === 0) {
    _store = {
      ..._store,
      auditors: [DEMO_AUDITOR],
      credentials: { [DEMO_AUDITOR.email]: 'demo1234' },
    };
  }
}

function resolveCurrentAuditorId(auditors: Auditor[], preferredId: string | null | undefined): string | null {
  if (!preferredId) return null;
  return auditors.some((auditor) => auditor.id === preferredId) ? preferredId : null;
}

// ── Database bootstrap / normalization ──────────────────────────────────────

interface ApiBootstrapPayload {
  auditors?: unknown;
  companies?: unknown;
  reviewCycles?: unknown;
  auditLog?: unknown;
  currentAuditorId?: string | null;
  error?: string;
}

async function tryBootstrapApi(): Promise<ApiBootstrapPayload | null> {
  try {
    const res = await fetch('/api/auditor/portal/bootstrap', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ApiBootstrapPayload;
  } catch {
    return null;
  }
}

function normalizeAuditors(raw: unknown): Auditor[] {
  const rows = ensureArray(raw);
  const auditors: Auditor[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const fullName = pickString(r.full_name, r.fullName, r.name, r.display_name);
    const email = pickString(r.email, r.work_email);
    if (!fullName || !email) continue;
    auditors.push({
      id: pickString(r.id, r.auditor_id, r.profile_id, email),
      fullName,
      email: email.toLowerCase(),
      licenseId: pickString(r.license_id, r.licenseId, r.registration_no, r.registrationNumber),
      specialization: toSpecialization(r.specialization),
      joinedAt: parseDateish(r.joined_at ?? r.joinedAt) ?? daysAgo(1),
    });
  }

  return auditors.length ? auditors : [DEMO_AUDITOR];
}

function normalizeAuditLog(raw: unknown): AuditLogEntry[] {
  const rows = ensureArray(raw);
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const actorRole = String(r.actor_role ?? r.actorRole ?? '').toLowerCase() === 'system' ? 'system' : 'auditor';
      const createdAt = parseDateish(r.created_at ?? r.createdAt) ?? new Date();
      const actor = pickString(r.actor, r.actor_name, r.actorName, 'System');
      const action = pickString(r.action, r.event, 'unknown.action');
      const detail = pickString(r.detail, r.message, '');
      if (!detail && !action) return null;
      return {
        id: pickString(r.id, `log-${createdAt.getTime()}`),
        actor,
        actorRole,
        action,
        detail,
        createdAt,
      } satisfies AuditLogEntry;
    })
    .filter((entry): entry is AuditLogEntry => Boolean(entry))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 500);
}

async function normalizeDocs(rawDocs: unknown): Promise<ReviewDoc[]> {
  const rows = ensureArray(rawDocs);
  const docs: ReviewDoc[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const fileUrl = pickString(r.file_url, r.fileUrl, r.storage_url, r.storageUrl, r.url);
    const fileName = pickString(r.file_name, r.fileName, r.name, r.original_name);
    const mimeType = pickString(r.mime_type, r.mimeType, r.content_type, r.contentType) || null;
    const blob = fileUrl ? await fetchBlobFromUrl(fileUrl) : null;
    const tallyRows = normalizeTallyRows(r.tally_rows ?? r.tallyRows ?? r.comparison_rows);

    docs.push({
      id: pickString(r.id, r.document_id, fileUrl || fileName || `doc-${docs.length + 1}`),
      name: pickString(r.name, r.document_name, fileName, 'Uploaded document'),
      act: pickString(r.act, r.act_name, r.category, 'Compliance'),
      status: normalizeDocStatus(r.status),
      score: pickNumber(r.score, r.review_score, 100),
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      mimeType,
      storagePath: pickString(r.storage_path, r.storagePath) || null,
      uploadedAt: parseDateish(r.uploaded_at ?? r.uploadedAt),
      blob,
      tallyRows,
    });
  }

  return docs;
}

async function normalizeCompaniesFromApi(rawCompanies: unknown): Promise<CompanyReview[]> {
  const rows = ensureArray(rawCompanies);
  const companies: CompanyReview[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const documents = await normalizeDocs(r.docs ?? r.documents ?? r.uploaded_documents ?? []);
    const issuesRaw = ensureArray(r.issues);
    const issues: CarriedIssue[] = issuesRaw
      .map((issue) => {
        if (!issue || typeof issue !== 'object') return null;
        const i = issue as Record<string, unknown>;
        const docName = pickString(i.doc_name, i.docName, i.document_name, i.documentName);
        const rule = pickString(i.rule, i.issue, i.description, 'Unspecified');
        return {
          id: pickString(i.id, `issue-${companies.length}-${Math.random().toString(36).slice(2, 7)}`),
          docName: docName || 'Uploaded document',
          severity: normalizeIssueSeverity(i.severity),
          rule,
          rootCause: pickString(i.root_cause, i.rootCause, i.reason, ''),
          resolvedL2: Boolean(i.resolved_l2 ?? i.resolvedL2),
        } satisfies CarriedIssue;
      })
      .filter((item): item is CarriedIssue => Boolean(item));

    const organization = (r.organization && typeof r.organization === 'object')
      ? (r.organization as Record<string, unknown>)
      : r;

    const liveRegisterUrl = pickString(
      r.live_register_url,
      r.liveRegisterUrl,
      organization.live_register_url,
      organization.liveRegisterUrl,
      organization.master_register_url,
      organization.masterRegisterUrl,
    ) || null;

    const liveRegisterFileName = pickString(
      r.live_register_file_name,
      r.liveRegisterFileName,
      organization.live_register_file_name,
      organization.liveRegisterFileName,
      `${pickString(organization.name, r.name, 'Live Register')}.xlsx`,
    ) || 'Live Register.xlsx';

    const liveRegisterFile = liveRegisterUrl
      ? await fetchFileFromUrl(liveRegisterUrl, liveRegisterFileName, pickString(organization.mime_type, r.live_register_mime_type) || null)
      : null;

    const actsCovered = ensureArray(
      organization.acts_covered ?? organization.actsCovered ?? r.acts_covered ?? r.actsCovered,
    ).map((v) => String(v)).filter(Boolean);

    companies.push({
      id: pickString(r.id, r.review_cycle_id, r.reviewCycleId, organization.id, `company-${companies.length + 1}`),
      name: pickString(organization.name, r.company_name, r.name, 'Unnamed company'),
      industry: pickString(organization.industry, r.industry, 'Unspecified'),
      cin: pickString(organization.cin, r.cin, ''),
      contactPerson: pickString(
        organization.contact_person,
        organization.contactPerson,
        r.contact_person,
        r.contactPerson,
        '',
      ),
      contactEmail: pickString(
        organization.contact_email,
        organization.contactEmail,
        r.contact_email,
        r.contactEmail,
        '',
      ),
      employeeCount: pickNumber(
        organization.employee_count,
        organization.employeeCount,
        r.employee_count,
        r.employeeCount,
      ),
      actsCovered: actsCovered.length ? actsCovered : documents.map((doc) => doc.act).filter(Boolean),
      docs: documents,
      issues,
      l2Score: pickNumber(r.l2_score, r.l2Score, 0),
      l2CompletedAt: parseDateish(r.l2_completed_at ?? r.l2CompletedAt) ?? daysAgo(1),
      status: normalizeReviewStatus(r.status),
      assignedTo: pickString(r.assigned_to, r.assignedTo) || null,
      decisionRemarks: pickString(r.decision_remarks, r.decisionRemarks),
      decidedAt: parseDateish(r.decided_at ?? r.decidedAt),
      liveRegisterUrl,
      liveRegisterFile,
      requestId: pickString(r.request_id, r.requestId) || null,
      submittedByUserId: pickString(r.submitted_by_user_id, r.submittedByUserId) || null,
    });
  }

  return companies
    .filter((company) => company.docs.length > 0 || company.liveRegisterFile !== null || company.liveRegisterUrl)
    .sort((a, b) => b.l2CompletedAt.getTime() - a.l2CompletedAt.getTime());
}

async function fetchFromSupabase(): Promise<{ auditors: Auditor[]; companies: CompanyReview[]; auditLog: AuditLogEntry[] }> {
  const [reviewCyclesRes, organizationsRes, documentsRes, issuesRes, auditLogRes, auditorsRes] = await Promise.all([
    supabase.from('review_cycles').select('*'),
    supabase.from('organizations').select('*'),
    supabase.from('documents').select('*'),
    supabase.from('issues').select('*'),
    supabase.from('audit_log').select('*'),
    supabase.from('auditors').select('*'),
  ]);

  const firstError =
    reviewCyclesRes.error ??
    organizationsRes.error ??
    documentsRes.error ??
    issuesRes.error ??
    auditLogRes.error ??
    auditorsRes.error;

  if (firstError) throw firstError;

  const reviewCycles = reviewCyclesRes.data ?? [];
  const organizations = organizationsRes.data ?? [];
  const documents = documentsRes.data ?? [];
  const issues = issuesRes.data ?? [];
  const auditLog = normalizeAuditLog(auditLogRes.data ?? []);
  const auditors = normalizeAuditors(auditorsRes.data ?? []);

  const orgById = new Map<string, Record<string, unknown>>();
  for (const org of organizations as unknown[]) {
    if (org && typeof org === 'object') {
      const r = org as Record<string, unknown>;
      const id = pickString(r.id, r.organization_id, r.organizationId);
      if (id) orgById.set(id, r);
    }
  }

  const docsByCycle = new Map<string, unknown[]>();
  for (const doc of documents as unknown[]) {
    if (!doc || typeof doc !== 'object') continue;
    const r = doc as Record<string, unknown>;
    const cycleId = pickString(r.review_cycle_id, r.reviewCycleId, r.cycle_id, r.cycleId, r.company_id, r.companyId);
    if (!cycleId) continue;
    const arr = docsByCycle.get(cycleId) ?? [];
    arr.push(r);
    docsByCycle.set(cycleId, arr);
  }

  const issuesByCycle = new Map<string, unknown[]>();
  for (const issue of issues as unknown[]) {
    if (!issue || typeof issue !== 'object') continue;
    const r = issue as Record<string, unknown>;
    const cycleId = pickString(r.review_cycle_id, r.reviewCycleId, r.cycle_id, r.cycleId, r.company_id, r.companyId);
    if (!cycleId) continue;
    const arr = issuesByCycle.get(cycleId) ?? [];
    arr.push(r);
    issuesByCycle.set(cycleId, arr);
  }

  const companies: CompanyReview[] = [];

  for (const cycle of reviewCycles as unknown[]) {
    if (!cycle || typeof cycle !== 'object') continue;
    const r = cycle as Record<string, unknown>;
    const organizationId = pickString(r.organization_id, r.organizationId, r.company_id, r.companyId);
    const org = organizationId ? orgById.get(organizationId) ?? null : null;
    const cycleId = pickString(r.id, r.review_cycle_id, r.reviewCycleId, organizationId);

    const documentsForCycle = docsByCycle.get(cycleId) ?? [];
    const issuesForCycle = issuesByCycle.get(cycleId) ?? [];
    const normalizedDocs = await normalizeDocs(documentsForCycle);
    const normalizedIssues: CarriedIssue[] = issuesForCycle
      .map((issue) => {
        if (!issue || typeof issue !== 'object') return null;
        const i = issue as Record<string, unknown>;
        return {
          id: pickString(i.id, `issue-${cycleId}-${Math.random().toString(36).slice(2, 7)}`),
          docName: pickString(i.doc_name, i.docName, i.document_name, i.documentName, 'Uploaded document'),
          severity: normalizeIssueSeverity(i.severity),
          rule: pickString(i.rule, i.description, i.reason, 'Unspecified'),
          rootCause: pickString(i.root_cause, i.rootCause, ''),
          resolvedL2: Boolean(i.resolved_l2 ?? i.resolvedL2),
        } satisfies CarriedIssue;
      })
      .filter((item): item is CarriedIssue => Boolean(item));

    const liveRegisterUrl = pickString(
      r.live_register_url,
      r.liveRegisterUrl,
      org?.live_register_url,
      org?.liveRegisterUrl,
      org?.master_register_url,
      org?.masterRegisterUrl,
    ) || null;

    const liveRegisterFileName = pickString(
      r.live_register_file_name,
      r.liveRegisterFileName,
      org?.live_register_file_name,
      org?.liveRegisterFileName,
      `${pickString(org?.name, r.company_name, 'Live Register')}.xlsx`,
    ) || 'Live Register.xlsx';

    const liveRegisterFile = liveRegisterUrl
      ? await fetchFileFromUrl(liveRegisterUrl, liveRegisterFileName, pickString(r.live_register_mime_type, org?.live_register_mime_type) || null)
      : null;

    const actsCovered = ensureArray(org?.acts_covered ?? org?.actsCovered ?? r.acts_covered ?? r.actsCovered)
      .map((v) => String(v))
      .filter(Boolean);

    companies.push({
      id: cycleId || pickString(organizationId, `company-${companies.length + 1}`),
      name: pickString(org?.name, r.company_name, r.name, 'Unnamed company'),
      industry: pickString(org?.industry, r.industry, 'Unspecified'),
      cin: pickString(org?.cin, r.cin, ''),
      contactPerson: pickString(
        org?.contact_person,
        org?.contactPerson,
        r.contact_person,
        r.contactPerson,
        '',
      ),
      contactEmail: pickString(
        org?.contact_email,
        org?.contactEmail,
        r.contact_email,
        r.contactEmail,
        '',
      ),
      employeeCount: pickNumber(org?.employee_count, org?.employeeCount, r.employee_count, r.employeeCount),
      actsCovered: actsCovered.length ? actsCovered : normalizedDocs.map((doc) => doc.act).filter(Boolean),
      docs: normalizedDocs,
      issues: normalizedIssues,
      l2Score: pickNumber(r.l2_score, r.l2Score, 0),
      l2CompletedAt: parseDateish(r.l2_completed_at ?? r.l2CompletedAt) ?? daysAgo(1),
      status: normalizeReviewStatus(r.status),
      assignedTo: pickString(r.assigned_to, r.assignedTo) || null,
      decisionRemarks: pickString(r.decision_remarks, r.decisionRemarks),
      decidedAt: parseDateish(r.decided_at ?? r.decidedAt),
      liveRegisterUrl,
      liveRegisterFile,
      requestId: pickString(r.request_id, r.requestId) || null,
      submittedByUserId: pickString(r.submitted_by_user_id, r.submittedByUserId) || null,
    });
  }

  return {
    auditors,
    companies: companies
      .filter((company) => company.docs.length > 0 || company.liveRegisterFile !== null || company.liveRegisterUrl)
      .sort((a, b) => b.l2CompletedAt.getTime() - a.l2CompletedAt.getTime()),
    auditLog,
  };
}

async function hydrateStore(): Promise<void> {
  if (_store.hydrated) return;

  setField('loading', true);
  setField('error', null);

  const storedCurrentAuditorId = readStoredCurrentAuditorId();

  try {
    const api = await tryBootstrapApi();
    if (api && (api.companies || api.reviewCycles || api.auditors || api.auditLog)) {
      const companies = await normalizeCompaniesFromApi(api.companies ?? api.reviewCycles ?? []);
      const auditors = api.auditors ? normalizeAuditors(api.auditors) : [_store.auditors[0]];
      const auditLog = api.auditLog ? normalizeAuditLog(api.auditLog) : [];
      const currentAuditorId = resolveCurrentAuditorId(auditors, api.currentAuditorId ?? storedCurrentAuditorId);
      _store = {
        ..._store,
        auditors,
        companies,
        auditLog,
        currentAuditorId,
        loading: false,
        hydrated: true,
      };
      persistCurrentAuditorId(currentAuditorId);
      notify();
      return;
    }

    const snapshot = await fetchFromSupabase();
    const currentAuditorId = resolveCurrentAuditorId(snapshot.auditors, storedCurrentAuditorId);
    _store = {
      ..._store,
      auditors: snapshot.auditors.length ? snapshot.auditors : _store.auditors,
      companies: snapshot.companies,
      auditLog: snapshot.auditLog,
      currentAuditorId,
      loading: false,
      hydrated: true,
    };
    persistCurrentAuditorId(currentAuditorId);
    notify();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load auditor portal data.';
    _store = {
      ..._store,
      currentAuditorId: resolveCurrentAuditorId(_store.auditors, storedCurrentAuditorId),
      loading: false,
      hydrated: true,
      error: message,
    };
    persistCurrentAuditorId(_store.currentAuditorId);
    notify();
  }
}

async function persistAuditAction(path: string, payload: unknown): Promise<void> {
  try {
    await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best-effort persistence; local UI remains responsive even if the backend is unavailable.
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuditorStore() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    seedDemoIfMissing();

    if (!_hydratePromise) {
      _hydratePromise = hydrateStore().finally(() => {
        _store = { ..._store, loading: false };
        notify();
      });
    }

    const listener: Listener = () => forceRender((n) => n + 1);
    _listeners.add(listener);

    return () => {
      _listeners.delete(listener);
    };
  }, []);

  const currentAuditor = _store.auditors.find((a) => a.id === _store.currentAuditorId) ?? null;

  return {
    auditors:  _store.auditors,
    companies: _store.companies,
    auditLog:  _store.auditLog,
    currentAuditor,
    isAuthenticated: currentAuditor !== null,
    loading: _store.loading,
    error: _store.error,
    hydrated: _store.hydrated,

    async refresh() {
      _store = { ..._store, hydrated: false, loading: true, error: null };
      notify();
      _hydratePromise = hydrateStore().finally(() => {
        _store = { ..._store, loading: false };
        notify();
      });
      await _hydratePromise;
    },

    signUp(input: {
      fullName: string;
      email: string;
      password: string;
      licenseId: string;
      specialization: Specialization;
    }): { ok: true } | { ok: false; error: string } {
      const email = input.email.trim().toLowerCase();
      if (_store.credentials[email]) {
        return { ok: false, error: 'An auditor account with this email already exists. Try signing in instead.' };
      }

      const auditor: Auditor = {
        id: `a-${Date.now()}`,
        fullName: input.fullName.trim(),
        email,
        licenseId: input.licenseId.trim(),
        specialization: input.specialization,
        joinedAt: new Date(),
      };

      _store = {
        ..._store,
        auditors: [..._store.auditors, auditor],
        credentials: { ..._store.credentials, [email]: input.password },
        currentAuditorId: auditor.id,
      };
      notify();
      createLocalAuditLog(auditor.fullName, 'auditor', 'auditor.signup', `New auditor account created (${auditor.specialization}, licence ${auditor.licenseId}).`);
      void persistAuditAction('/api/auditor/auth/signup', {
        fullName: auditor.fullName,
        email: auditor.email,
        licenseId: auditor.licenseId,
        specialization: auditor.specialization,
      });
      return { ok: true };
    },

    signIn(email: string, password: string): { ok: true } | { ok: false; error: string } {
      const key = email.trim().toLowerCase();
      if (!_store.credentials[key]) {
        createLocalAuditLog(email, 'auditor', 'auditor.signin_failed', 'Sign-in attempt with an unrecognized email.');
        return { ok: false, error: 'No auditor account found with this email.' };
      }
      if (_store.credentials[key] !== password) {
        createLocalAuditLog(email, 'auditor', 'auditor.signin_failed', 'Sign-in attempt with an incorrect password.');
        return { ok: false, error: 'Incorrect password. Please try again.' };
      }
      const auditor = _store.auditors.find((a) => a.email === key)!;
      setField('currentAuditorId', auditor.id);
      persistCurrentAuditorId(auditor.id);
      createLocalAuditLog(auditor.fullName, 'auditor', 'auditor.signin', 'Signed in to the Auditor Portal.');
      void persistAuditAction('/api/auditor/auth/signin', { email: auditor.email });
      return { ok: true };
    },

    signOut() {
      setField('currentAuditorId', null);
      persistCurrentAuditorId(null);
      void persistAuditAction('/api/auditor/auth/signout', {});
    },

    claimCompany(companyId: string) {
      if (!_store.currentAuditorId) return;
      const auditor = _store.auditors.find((a) => a.id === _store.currentAuditorId);
      const company = _store.companies.find((c) => c.id === companyId);

      const companies = _store.companies.map((c) =>
        c.id === companyId && c.status === 'pending'
          ? { ...c, status: 'in_review' as ReviewStatus, assignedTo: _store.currentAuditorId }
          : c,
      );

      setField('companies', companies);

      if (auditor && company) {
        createLocalAuditLog(auditor.fullName, 'auditor', 'review.claim', `Claimed ${company.name} for review.`);
        void persistAuditAction('/api/auditor/reviews/claim', {
          companyId,
          auditorId: auditor.id,
        });
      }
    },

    decide(companyId: string, decision: 'approved' | 'changes_requested' | 'rejected', remarks: string) {
      const auditor = _store.auditors.find((a) => a.id === _store.currentAuditorId);
      const company = _store.companies.find((c) => c.id === companyId);

      const companies = _store.companies.map((c) =>
        c.id === companyId
          ? {
              ...c,
              status: decision,
              decisionRemarks: remarks,
              decidedAt: new Date(),
              assignedTo: c.assignedTo ?? _store.currentAuditorId,
            }
          : c,
      );

      setField('companies', companies);

      if (auditor && company) {
        const label = decision === 'approved'
          ? 'Approved'
          : decision === 'rejected'
            ? 'Rejected'
            : 'Requested changes on';

        createLocalAuditLog(auditor.fullName, 'auditor', `review.${decision}`, `${label} ${company.name}.`);
        void persistAuditAction('/api/auditor/reviews/decision', {
          companyId,
          auditorId: auditor.id,
          decision,
          remarks,
        });
      }
    },
  };
}
