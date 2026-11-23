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
  hasFile?:  boolean;
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

export interface CompanyDetails {
  company: {
    name: string; cin: string; pan: string; gstin: string; address: string; state: string; industry: string;
    headcount: string; incorporationDate: string | null; authorizedPerson: string; designation: string; email: string; phone: string;
  };
  kycFiles: { label: string; fileName: string; url: string | null; at: string }[];
  files: { id: string; docName: string | null; role: string; fileName: string; mimeType: string | null; size: number; at: string; url: string }[];
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
  liveRegisterFileName?: string | null;
  requestId?:         string | null;
  submittedByUserId?: string | null;

  // Real audit flow
  accessStatus?:      'none' | 'requested' | 'approved' | 'denied';
  details?:           CompanyDetails | null;   // everything the company filed; only after access is approved
  locked?:            boolean;          // true until THIS auditor claims it and accepts the terms
  termsAcceptedAt?:   Date | null;
  missingFiles?:      string[];         // files that could not be stored (e.g. over 3 MB)
  resubmission?:      { at: string; note: string; replacedDocs: string[]; previousRemarks: string; round: number } | null;  // company's reply to a change request
  certificate?:       { certificateNo: string; issuedAt: Date; sha256: string | null; revoked: boolean; hasPdf?: boolean } | null;
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

// ── Server access (Supabase session → Bearer token) ──────────────────────────

// Public path → email-handler action. Calling the action URL directly works even when the
// deployed vercel.json is missing the rewrite (otherwise the SPA catch-all returns index.html).
const AUDITOR_ACTIONS: Record<string, string> = {
  '/api/auditor/portal/bootstrap': 'aud-bootstrap',
  '/api/auditor/reviews/claim':    'aud-claim',
  '/api/auditor/file':             'aud-file',
  '/api/auditor/reviews/decision': 'aud-decision',
  '/api/auditor/certificate':      'aud-cert',
  '/api/client/notifications':     'cli-notifications',
};

let directBroken = false;

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);

  const [path, query = ''] = url.split('?');
  const action = AUDITOR_ACTIONS[path];
  if (!action) return fetch(url, { ...init, headers });

  // Once the action URL has failed, stop trying it: every call would otherwise cost two round-trips.
  if (!directBroken) {
    const direct = `/api/email-handler?action=${action}${query ? `&${query}` : ''}`;
    try {
      const res = await fetch(direct, { ...init, headers });
      const html = (res.headers.get('content-type') || '').includes('text/html');
      if (!html && res.status !== 404 && res.status !== 405) return res;
      directBroken = true;
    } catch { /* fall through to the public path */ }
  }
  return fetch(url, { ...init, headers });
}

type Result = { ok: true } | { ok: false; error: string };
type DecisionResult = { ok: true; certificateNo?: string } | { ok: false; error: string };

let _store: Store = {
  auditors: [], credentials: {}, currentAuditorId: null, companies: [], auditLog: [],
  loading: true, error: null, hydrated: false,
};
let _hydratePromise: Promise<void> | null = null;

type Listener = () => void;
const _listeners = new Set<Listener>();
function notify() { _listeners.forEach((fn) => fn()); }
function patch(p: Partial<Store>) { _store = { ..._store, ...p }; notify(); }

const d = (v: unknown): Date | null => { if (!v) return null; const x = new Date(String(v)); return Number.isNaN(x.getTime()) ? null : x; };

function mapCompany(r: any): CompanyReview {
  return {
    id: r.id, name: r.name, industry: r.industry, cin: r.cin ?? '', contactPerson: r.contactPerson ?? '', contactEmail: r.contactEmail ?? '',
    employeeCount: Number(r.employeeCount) || 0, actsCovered: r.actsCovered ?? [],
    docs: (r.docs ?? []).map((x: any): ReviewDoc => ({ ...x, uploadedAt: d(x.uploadedAt), blob: null, tallyRows: null })),
    issues: r.issues ?? [], l2Score: Number(r.l2Score) || 0, l2CompletedAt: d(r.l2CompletedAt) ?? new Date(),
    status: r.status, assignedTo: r.assignedTo ?? null, decisionRemarks: r.decisionRemarks ?? '', decidedAt: d(r.decidedAt),
    liveRegisterUrl: r.liveRegisterUrl ?? null, liveRegisterFile: null, liveRegisterFileName: r.liveRegisterFileName ?? null,
    locked: !!r.locked, accessStatus: r.accessStatus ?? 'none', details: r.details ?? null, termsAcceptedAt: d(r.termsAcceptedAt), missingFiles: r.missingFiles ?? [], resubmission: r.resubmission ?? null,
    certificate: r.certificate ? { ...r.certificate, issuedAt: d(r.certificate.issuedAt) ?? new Date() } : null,
  };
}

async function hydrateStore(): Promise<void> {
  patch({ loading: true, error: null });
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { patch({ loading: false, hydrated: true, currentAuditorId: null, companies: [] }); return; }
    const res = await authFetch('/api/auditor/portal/bootstrap', { headers: { Accept: 'application/json' } });
    if (res.status === 403 || res.status === 401) {
      patch({ loading: false, hydrated: true, currentAuditorId: null, companies: [], error: 'This account is not registered as an auditor.' });
      return;
    }
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const p = await res.json();
    const auditors: Auditor[] = (p.auditors ?? []).map((a: any) => ({ ...a, email: String(a.email ?? '').toLowerCase(), joinedAt: d(a.joinedAt) ?? new Date() }));
    const me = p.auditor ? { ...p.auditor, joinedAt: d(p.auditor.joinedAt) ?? new Date() } as Auditor : null;
    if (me && !auditors.some((a) => a.id === me.id)) auditors.push(me);
    patch({ auditors, companies: (p.companies ?? []).map(mapCompany), currentAuditorId: me?.id ?? null, loading: false, hydrated: true, error: null });
  } catch (err) {
    patch({ loading: false, hydrated: true, error: err instanceof Error ? err.message : 'Failed to load auditor portal data.' });
  }
}

/** After the certificate PDF is stored, flag it locally so it isn't generated again on the next open. */
export function markCertificateStored(companyId: string) {
  patch({ companies: _store.companies.map((c) => (c.id === companyId && c.certificate ? { ...c, certificate: { ...c.certificate, hasPdf: true } } : c)) });
}

async function reload() { _hydratePromise = hydrateStore(); await _hydratePromise; }

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuditorStore() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!_hydratePromise) _hydratePromise = hydrateStore();
    const listener: Listener = () => forceRender((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const currentAuditor = _store.auditors.find((a) => a.id === _store.currentAuditorId) ?? null;

  return {
    auditors: _store.auditors,
    companies: _store.companies,
    auditLog: _store.auditLog,
    currentAuditor,
    isAuthenticated: currentAuditor !== null,
    loading: _store.loading,
    error: _store.error,
    hydrated: _store.hydrated,

    refresh: reload,

    /** Real sign-in: Supabase account that has an auditor_profiles row. */
    async signIn(email: string, password: string): Promise<Result> {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) return { ok: false, error: 'Incorrect email or password.' };
      await reload();
      if (!_store.currentAuditorId) {
        await supabase.auth.signOut();
        return { ok: false, error: _store.error || 'This account is not registered as an auditor.' };
      }
      return { ok: true };
    },

    signUp(): Result {
      return { ok: false, error: 'Auditor accounts are created by a Regnix administrator.' };
    },

    async signOut() {
      await supabase.auth.signOut();
      patch({ currentAuditorId: null, companies: [], auditLog: [] });
    },

    /** Self-assign: needs the auditor to have accepted the terms. Only one auditor can win. */
    async claimCompany(companyId: string, acceptedTerms: boolean): Promise<Result> {
      try {
        const res = await authFetch('/api/auditor/reviews/claim', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, acceptedTerms }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { if (res.status === 409) await reload(); return { ok: false, error: body?.message ?? `Server ${res.status}` }; }
        await reload();
        return { ok: true };
      } catch { return { ok: false, error: 'Could not reach the server.' }; }
    },

    async decide(companyId: string, decision: 'approved' | 'changes_requested' | 'rejected', remarks: string): Promise<DecisionResult> {
      try {
        const res = await authFetch('/api/auditor/reviews/decision', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, decision, remarks }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: body?.message ?? `Server ${res.status}` };
        await reload();
        return { ok: true, certificateNo: body?.certificate?.certificateNo };
      } catch { return { ok: false, error: 'Could not reach the server.' }; }
    },
  };
}


// ── Auditor notifications (access approved / denied, new submissions, assignments) ──
export interface AuditorNotice { id: string; kind: 'success' | 'warning' | 'info' | 'danger'; title: string; detail: string; at: string }
const SEEN = 'regnix.auditor.notif.seen';

export function useAuditorNotifications(enabled: boolean) {
  const [items, setItems] = useState<AuditorNotice[]>([]);
  const [seen, setSeen] = useState<number>(() => { try { return Number(localStorage.getItem(SEEN)) || 0; } catch { return 0; } });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await authFetch('/api/client/notifications', { headers: { Accept: 'application/json' } });
        const j = await r.json().catch(() => null);
        if (alive && r.ok && j?.ok) setItems(j.notifications ?? []);
      } catch { /* ignore */ }
    };
    void load();
    const t = window.setInterval(() => { void load(); }, 30_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [enabled]);

  const unread = items.filter((n) => +new Date(n.at) > seen).length;
  const markAllRead = () => { const t = Date.now(); setSeen(t); try { localStorage.setItem(SEEN, String(t)); } catch { /* ignore */ } };
  return { items, unread, seen, markAllRead };
}
