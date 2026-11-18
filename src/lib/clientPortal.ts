/**
 * src/lib/clientPortal.ts — calls the Express client-portal routes with the user's Supabase token.
 */
import { supabase } from '@/lib/supabaseClient';

export interface PortalFile {
  id: string; name: string; title: string; category: string;
  mime: string; size: number; zohoUrl: string | null; at: string; reviewCycleId: string | null;
}
export interface AuditIssue { docName: string; severity: string; rule: string; rootCause: string; resolved: boolean; }
export interface AuditCycle {
  id: string; reportingMonth: string; status: 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected';
  level: string; score: number; submittedAt: string | null; decidedAt: string | null; createdAt: string;
  auditorName: string | null; accepted: boolean; remarks: string; docs: number; missingFiles: string[];
  issues: AuditIssue[]; certificate: { no: string; issuedAt: string; revoked: boolean } | null;
  files: { id: string; name: string; size: number; zohoUrl: string | null; at: string }[];
}

async function get<T>(path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token ?? ''}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.message || `Request failed (${res.status})`);
  return json as T;
}

export const fetchDocuments = () => get<{ folderUrl: string | null; files: PortalFile[] }>('/client/documents');
export const fetchAudits = () => get<{ organization: { name: string; employees: number; acts: string[] } | null; cycles: AuditCycle[] }>('/client/audit');

export function formatBytes(n: number): string {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
