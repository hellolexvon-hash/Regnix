/**
 * superAdminStore.ts
 *
 * Deliberately a SEPARATE credential store from auditorStore.ts's auditor
 * accounts — a super admin is a distinct role with distinct, higher-blast-
 * radius permissions (visibility into every client and every auditor), so
 * it gets its own sign-in rather than being "just another auditor flag."
 * In the real backend (see database-schema.sql) both map to the same
 * `users` table differentiated by `role`, but the frontend session
 * boundary is kept separate on purpose — a super-admin session should
 * never silently inherit auditor-portal UI state or vice versa.
 *
 * All system-wide numbers here are DERIVED from useAuditorStore()'s live
 * companies/auditors/auditLog — nothing is hardcoded, same principle as
 * certificateData.ts.
 */

import { useState, useEffect, useCallback } from 'react';
// Separate-session client so /admin never clobbers a normal user's session
import { supabaseConsole as supabase } from '@/lib/supabaseConsole';
import { useAuditorStore, type CompanyReview, type Auditor, type AuditLogEntry } from '../AuditorView/auditorStore';

export interface SuperAdmin {
  id:        string;
  fullName:  string;
  email:     string;
  title:     string;
}

interface AdminStoreState {
  admins:            SuperAdmin[];
  credentials:       Record<string, string>;
  currentAdminId:    string | null;
}

const DEMO_ADMIN: SuperAdmin = {
  id: 'admin-1', fullName: 'Karan Mehta', email: 'karan.mehta@regnix.io', title: 'Platform Operations',
};

let _admin: AdminStoreState = {
  admins:         [DEMO_ADMIN],
  credentials:    { [DEMO_ADMIN.email]: 'admin1234' },
  currentAdminId: null,
};

// ── Transactional email (sent by the backend; the server decides recipient + content) ──
const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

/** Ask the backend to send a transactional email. Returns null on success, else an error message. */
async function postEmail(path: string, body: Record<string, string>): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return 'Not signed in.';
  try {
    const res = await fetch(`${API_BASE}/api/email/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const j = await res.json().catch(() => ({}));
    return (j as { error?: string }).error ?? `Request failed (${res.status}).`;
  } catch {
    return 'Could not reach the email service.';
  }
}

// Why the last real (Supabase) sign-in attempt failed; shown when the console falls back to the demo session.
let _lastRemoteError = '';

type Listener = () => void;
const _listeners = new Set<Listener>();
function notify() { _listeners.forEach(fn => fn()); }

/** Make a verified Supabase super admin the current console admin. */
async function adoptRemoteAdmin(userId: string, email: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();

  const remoteAdmin: SuperAdmin = {
    id:       userId,
    fullName: (profile?.full_name as string | undefined) ?? 'Super Admin',
    email,
    title:    'Super Admin',
  };
  _admin = {
    ..._admin,
    admins: [..._admin.admins.filter(a => a.id !== remoteAdmin.id), remoteAdmin],
    currentAdminId: remoteAdmin.id,
  };
  notify();
}

// Restore a real super-admin session after a page refresh (runs once per page load).
let _restoreStarted = false;
async function restoreRemoteSession() {
  if (_restoreStarted) return;
  _restoreStarted = true;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  const { data: isAdmin } = await supabase.rpc('is_super_admin');
  if (isAdmin === true) await adoptRemoteAdmin(user.id, user.email ?? '');
}

export function useSuperAdminAuth() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener: Listener = () => forceRender(n => n + 1);
    _listeners.add(listener);
    void restoreRemoteSession();
    return () => { _listeners.delete(listener); };
  }, []);

  const currentAdmin = _admin.admins.find(a => a.id === _admin.currentAdminId) ?? null;

  return {
    currentAdmin,
    isAuthenticated: currentAdmin !== null,
    /** true only for a real Supabase super admin; the local demo admin has no database access */
    isLive: currentAdmin !== null && currentAdmin.id !== DEMO_ADMIN.id,
    /** reason the real sign-in failed (empty when it has not been tried or succeeded) */
    remoteError: _lastRemoteError,

    signIn(email: string, password: string): { ok: true } | { ok: false; error: string } {
      const key = email.trim().toLowerCase();
      const match = _admin.admins.find(a => a.email.toLowerCase() === key);
      if (!match || _admin.credentials[match.email] !== password) {
        return { ok: false, error: 'Incorrect email or password.' };
      }
      _admin = { ..._admin, currentAdminId: match.id };
      notify();
      return { ok: true };
    },

    /**
     * Real sign-in against Supabase. Only accounts listed (and active) in
     * super_admin_profiles get in. This is what gives the console a session
     * that is allowed to read the activity feed and approve/reject signups.
     */
    async signInRemote(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) {
        _lastRemoteError = `Supabase sign-in failed: ${error?.message ?? 'no user returned'}.`;
        return { ok: false, error: 'Incorrect email or password.' };
      }

      const { data: isAdmin, error: adminErr } = await supabase.rpc('is_super_admin');
      if (adminErr || isAdmin !== true) {
        _lastRemoteError = adminErr
          ? `is_super_admin() failed: ${adminErr.message}.`
          : 'Signed in, but this user is not an active row in super_admin_profiles.';
        await supabase.auth.signOut();
        return { ok: false, error: 'This account does not have super admin access.' };
      }

      _lastRemoteError = '';
      await adoptRemoteAdmin(data.user.id, data.user.email ?? email.trim());
      return { ok: true };
    },

    signOut() {
      void supabase.auth.signOut();
      _admin = { ..._admin, currentAdminId: null };
      notify();
    },
  };
}

// ── Signup approvals + notifications ────────────────────────────────────

export interface PendingSignup {
  id:          string;
  fullName:    string;
  email:       string;
  accountType: string;
  companyName: string;
  industry:    string;
  plan:        string | null;   // selected pricing plan id
  createdAt:   Date;
  isNew:       boolean;   // has an unread "new signup" notification
}

/**
 * Pending applicants + their notifications for the Super Admin console.
 * Live: subscribes to admin_notifications (inserted by a DB trigger on every
 * signup) and also polls every 30s as a fallback.
 */
export function useSignupApprovals(enabled: boolean) {
  const [pending, setPending] = useState<PendingSignup[]>([]);
  const [error, setError]     = useState('');
  const [busyId, setBusyId]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [profilesRes, notesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, account_type, company_name, firm_name, industry, selected_plan, created_at')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('admin_notifications')
        .select('entity_id')
        .eq('type', 'new_signup')
        .eq('is_read', false),
    ]);

    if (profilesRes.error) { setError(profilesRes.error.message); return; }
    setError('');

    if (notesRes.error) { setError(notesRes.error.message); return; }
    const unread = new Set((notesRes.data ?? []).map(n => n.entity_id as string));
    setPending((profilesRes.data ?? []).map(p => ({
      id:          p.id as string,
      fullName:    (p.full_name as string) ?? '—',
      email:       (p.email as string) ?? '—',
      accountType: (p.account_type as string) ?? '—',
      companyName: ((p.company_name as string) || (p.firm_name as string)) ?? '—',
      industry:    (p.industry as string) ?? '—',
      plan:        (p.selected_plan as string | null) ?? null,
      createdAt:   new Date(p.created_at as string),
      isNew:       unread.has(p.id as string),
    })));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();

    const channel = supabase
      .channel('admin-signup-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, () => { void refresh(); })
      .subscribe();
    const poll = setInterval(() => { void refresh(); }, 30000);

    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  const decide = useCallback(async (id: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusyId(id);
    const { error: rpcError } = await run();
    setBusyId(null);
    if (rpcError) { setError(rpcError.message); return false; }
    await refresh();
    return true;
  }, [refresh]);

  return {
    pending,
    error,
    busyId,
    approve: async (id: string) => {
      const ok = await decide(id, () => supabase.rpc('approve_signup', { p_user_id: id }));
      if (ok) {
        // Email the user that they can sign in now. A mail failure must not undo the approval.
        const mailErr = await postEmail('approval', { userId: id });
        if (mailErr) setError('Approved, but the email could not be sent: ' + mailErr);
      }
      return ok;
    },
    reject: async (id: string, reason?: string) => {
      const ok = await decide(id, () => supabase.rpc('reject_signup', { p_user_id: id, p_reason: reason ?? null }));
      if (ok) {
        // Tell the applicant. A mail failure must not undo the rejection.
        const mailErr = await postEmail('rejection', { userId: id });
        if (mailErr) setError('Rejected, but the email could not be sent: ' + mailErr);
      }
      return ok;
    },
  };
}

// ── Authorized (approved) users + KYC / payment requests ────────────────

export type KycStatus = 'none' | 'requested' | 'verified' | 'cancelled';

export interface KycRequest {
  id:              string;
  documents:       string[];
  amount:          number;
  currency:        string;
  dueDate:         string | null;
  note:            string;
  docsReceived:    boolean;
  paymentReceived: boolean;
  status:          Exclude<KycStatus, 'none'>;
  createdAt:       Date;
  submittedAt:     Date | null;       // user pressed "Submit for verification"
  payment: {
    method:    string;
    reference: string;
    amount:    number | null;
    paidOn:    string | null;
    note:      string;
  };
  files:           KycFile[];         // documents the user uploaded (stored in Zoho WorkDrive)
}

export interface KycFile {
  id:       string;
  label:    string;
  fileName: string;
  mimeType: string;
  size:     number;
  url:      string;   // Zoho WorkDrive link
}

export interface AuthorizedUser {
  id:          string;
  fullName:    string;
  email:       string;
  accountType: string;
  companyName: string;
  industry:    string;
  gstin:       string;
  plan:        string | null;
  zohoFolderUrl: string | null;
  kycVerified: boolean;
  approvedAt:  Date | null;
  createdAt:   Date;
  kyc:         KycRequest | null;   // latest request, if any
}

export interface KycRequestInput {
  documents: string[];
  amount:    number;
  currency:  string;
  dueDate:   string;   // yyyy-mm-dd or ''
  note:      string;
}

/**
 * Approved users and the state of their KYC / payment request.
 * Requesting emails the user (backend /api/email/kyc-request); a mail failure
 * never undoes the request.
 */
export function useAuthorizedUsers(enabled: boolean, selfId: string | null) {
  const [users, setUsers]   = useState<AuthorizedUser[]>([]);
  const [error, setError]   = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [profilesRes, kycRes, filesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, account_type, company_name, firm_name, industry, gstin, selected_plan, zoho_folder_url, kyc_verified, approved_at, created_at')
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false }),
      supabase
        .from('kyc_requests')
        .select('id, profile_id, documents, amount, currency, due_date, note, docs_received, payment_received, status, created_at, submitted_at, payment_method, payment_reference, payment_amount, payment_paid_on, payment_note')
        .order('created_at', { ascending: false }),
      supabase
        .from('kyc_files')
        .select('id, request_id, doc_label, file_name, mime_type, size_bytes, zoho_url')
        .order('created_at', { ascending: true }),
    ]);

    if (profilesRes.error) { setError(profilesRes.error.message); return; }
    if (kycRes.error)      { setError(kycRes.error.message); return; }
    // kyc_files may not exist yet (migration not run) — don't break the page for it
    const filesByRequest = new Map<string, KycFile[]>();
    for (const f of filesRes.error ? [] : (filesRes.data ?? [])) {
      const rid = f.request_id as string;
      const list = filesByRequest.get(rid) ?? [];
      list.push({
        id: f.id as string, label: f.doc_label as string, fileName: f.file_name as string,
        mimeType: (f.mime_type as string) ?? '', size: Number(f.size_bytes ?? 0), url: (f.zoho_url as string) ?? '',
      });
      filesByRequest.set(rid, list);
    }
    setError('');

    // rows arrive newest first, so the first one seen per user is their latest request
    const latest = new Map<string, KycRequest>();
    for (const k of kycRes.data ?? []) {
      const pid = k.profile_id as string;
      if (latest.has(pid)) continue;
      latest.set(pid, {
        id:              k.id as string,
        documents:       (k.documents as string[] | null) ?? [],
        amount:          Number(k.amount ?? 0),
        currency:        (k.currency as string) ?? 'INR',
        dueDate:         (k.due_date as string | null) ?? null,
        note:            (k.note as string | null) ?? '',
        docsReceived:    k.docs_received as boolean,
        paymentReceived: k.payment_received as boolean,
        status:          k.status as KycRequest['status'],
        createdAt:       new Date(k.created_at as string),
        submittedAt:     k.submitted_at ? new Date(k.submitted_at as string) : null,
        payment: {
          method:    (k.payment_method as string | null) ?? '',
          reference: (k.payment_reference as string | null) ?? '',
          amount:    k.payment_amount == null ? null : Number(k.payment_amount),
          paidOn:    (k.payment_paid_on as string | null) ?? null,
          note:      (k.payment_note as string | null) ?? '',
        },
        files:           filesByRequest.get(k.id as string) ?? [],
      });
    }

    setUsers((profilesRes.data ?? [])
      .filter(p => p.id !== selfId)
      .map(p => ({
        id:          p.id as string,
        fullName:    (p.full_name as string) ?? '—',
        email:       (p.email as string) ?? '—',
        accountType: (p.account_type as string) ?? '—',
        companyName: ((p.company_name as string) || (p.firm_name as string)) ?? '—',
        industry:    (p.industry as string) ?? '—',
        gstin:       (p.gstin as string) ?? '',
        plan:        (p.selected_plan as string | null) ?? null,
        zohoFolderUrl: (p.zoho_folder_url as string | null) ?? null,
        kycVerified: p.kyc_verified === true,
        approvedAt:  p.approved_at ? new Date(p.approved_at as string) : null,
        createdAt:   new Date(p.created_at as string),
        kyc:         latest.get(p.id as string) ?? null,
      })));
  }, [selfId]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const channel = supabase
      .channel('admin-authorized-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_requests' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' },     () => { void refresh(); })
      .subscribe();
    const poll = setInterval(() => { void refresh(); }, 30000);
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  const requestKyc = useCallback(async (userId: string, input: KycRequestInput): Promise<boolean> => {
    setBusyId(userId);
    setNotice('');
    const { data: requestId, error: rpcError } = await supabase.rpc('request_kyc', {
      p_user_id:   userId,
      p_documents: input.documents,
      p_amount:    input.amount,
      p_currency:  input.currency,
      p_due_date:  input.dueDate || null,
      p_note:      input.note || null,
    });
    if (rpcError) { setBusyId(null); setError(rpcError.message); return false; }
    setError('');

    const mailErr = await postEmail('kyc-request', { requestId: String(requestId) });
    setNotice(mailErr
      ? 'Request saved, but the email could not be sent: ' + mailErr
      : 'Request saved and the user has been emailed.');

    setBusyId(null);
    await refresh();
    return true;
  }, [refresh]);

  const updateRequest = useCallback(async (
    userId: string,
    requestId: string,
    patch: { docsReceived?: boolean; paymentReceived?: boolean; status?: 'verified' | 'cancelled' },
  ): Promise<boolean> => {
    setBusyId(userId);
    setNotice('');
    const { error: rpcError } = await supabase.rpc('update_kyc_request', {
      p_id:               requestId,
      p_docs_received:    patch.docsReceived ?? null,
      p_payment_received: patch.paymentReceived ?? null,
      p_status:           patch.status ?? null,
    });
    setBusyId(null);
    if (rpcError) { setError(rpcError.message); return false; }
    setError('');
    if (patch.status === 'verified') {
      const mailErr = await postEmail('kyc-verified', { requestId });
      if (mailErr) setNotice('Verified, but the email could not be sent: ' + mailErr);
    }
    await refresh();
    return true;
  }, [refresh]);

  return { users, error, notice, busyId, requestKyc, updateRequest };
}

// ── Notification bell feed ──────────────────────────────────────────────

export interface AdminNotification {
  id:         number;
  type:       string;
  title:      string;
  detail:     string;
  entityType: string | null;
  entityId:   string | null;
  isRead:     boolean;
  createdAt:  Date;
}

/**
 * Every activity (signups, approvals, uploads, reviews, certificates ...) lands
 * in admin_notifications via DB triggers. Live via realtime, 15s poll fallback.
 */
export function useAdminNotifications(enabled: boolean) {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from('admin_notifications')
      .select('id, type, title, detail, entity_type, entity_id, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (qErr) { setError(qErr.message); return; }
    setError('');
    setItems((data ?? []).map(n => ({
      id:         n.id as number,
      type:       n.type as string,
      title:      n.title as string,
      detail:     (n.detail as string) ?? '',
      entityType: (n.entity_type as string | null) ?? null,
      entityId:   (n.entity_id as string | null) ?? null,
      isRead:     n.is_read as boolean,
      createdAt:  new Date(n.created_at as string),
    })));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const channel = supabase
      .channel('admin-notification-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, () => { void refresh(); })
      .subscribe();
    const poll = setInterval(() => { void refresh(); }, 15000);
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  const markRead = useCallback(async (id: number) => {
    setItems(list => list.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    setItems(list => list.map(n => ({ ...n, isRead: true })));
    await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
  }, []);

  return {
    items,
    error,
    unread: items.filter(n => !n.isRead).length,
    markRead,
    markAllRead,
  };
}

// ── Derived system-wide analytics ───────────────────────────────────────

export interface AuditorWorkload {
  auditor:   Auditor;
  assigned:  number;
  approved:  number;
  rejected:  number;
  changesRequested: number;
  avgTurnaroundDays: number | null;
}

export interface SystemOverview {
  totalCompanies:      number;
  byStatus:            Record<CompanyReview['status'], number>;
  totalAuditors:       number;
  totalCertificatesIssued: number;
  totalOpenIssues:     number;
  totalCriticalIssues: number;
  avgL2Score:          number;
  workload:            AuditorWorkload[];
  recentActivity:      AuditLogEntry[];
}

function turnaroundDays(c: CompanyReview): number | null {
  if (!c.decidedAt) return null;
  return Math.round((c.decidedAt.getTime() - c.l2CompletedAt.getTime()) / 86400000);
}

/** Call from inside a component — composes on top of useAuditorStore(), never duplicates its state. */
export function useSystemOverview(): SystemOverview {
  const { companies, auditors, auditLog } = useAuditorStore();

  const byStatus = {
    pending: 0, in_review: 0, approved: 0, changes_requested: 0, rejected: 0,
  } as Record<CompanyReview['status'], number>;
  for (const c of companies) byStatus[c.status]++;

  const totalOpenIssues = companies.reduce((sum, c) => sum + c.issues.filter(i => !i.resolvedL2).length, 0);
  const totalCriticalIssues = companies.reduce(
    (sum, c) => sum + c.issues.filter(i => !i.resolvedL2 && i.severity === 'critical').length, 0,
  );
  const avgL2Score = companies.length
    ? Math.round((companies.reduce((s, c) => s + c.l2Score, 0) / companies.length) * 10) / 10
    : 0;

  const workload: AuditorWorkload[] = auditors.map(auditor => {
    const owned = companies.filter(c => c.assignedTo === auditor.id);
    const decided = owned.filter(c => c.decidedAt);
    const turnarounds = decided.map(turnaroundDays).filter((n): n is number => n !== null);
    return {
      auditor,
      assigned: owned.filter(c => c.status === 'in_review').length,
      approved: owned.filter(c => c.status === 'approved').length,
      rejected: owned.filter(c => c.status === 'rejected').length,
      changesRequested: owned.filter(c => c.status === 'changes_requested').length,
      avgTurnaroundDays: turnarounds.length
        ? Math.round((turnarounds.reduce((s, n) => s + n, 0) / turnarounds.length) * 10) / 10
        : null,
    };
  });

  return {
    totalCompanies: companies.length,
    byStatus,
    totalAuditors: auditors.length,
    totalCertificatesIssued: byStatus.approved,
    totalOpenIssues,
    totalCriticalIssues,
    avgL2Score,
    workload,
    recentActivity: auditLog.slice(0, 30),
  };
}