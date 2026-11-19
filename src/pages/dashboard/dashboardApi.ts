/**
 * src/pages/dashboard/dashboardApi.ts
 * Client for the dashboard endpoints. Calls /api/email-handler?action=… directly (works even if the
 * deployed vercel.json lacks the rewrites) and falls back to the public path.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const PUBLIC: Record<string, string> = {
  'cli-notifications': '/api/client/notifications',
  'cli-documents': '/api/client/documents',
  'cli-doc-file': '/api/client/document-file',
  'cli-planner': '/api/client/planner',
  'cli-assistant': '/api/client/assistant',
};

export async function portalFetch(action: keyof typeof PUBLIC, init: RequestInit = {}, query = ''): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  const q = query ? `&${query}` : '';
  try {
    const res = await fetch(`/api/email-handler?action=${action}${q}`, { ...init, headers });
    const html = (res.headers.get('content-type') || '').includes('text/html');
    if (!html && res.status !== 404 && res.status !== 405) return res;
  } catch { /* fall through */ }
  return fetch(`${PUBLIC[action]}${query ? `?${query}` : ''}`, { ...init, headers });
}

export async function portalJson<T>(action: keyof typeof PUBLIC, query = ''): Promise<T> {
  const res = await portalFetch(action, { headers: { Accept: 'application/json' } }, query);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error(body?.message ?? `Server responded ${res.status}`);
  return body as T;
}

/** Generic loader with refresh + optional polling. */
export function usePortal<T>(action: keyof typeof PUBLIC, pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const d = await portalJson<T>(action);
      if (alive.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [action]);

  useEffect(() => {
    alive.current = true;
    void load();
    const t = pollMs ? window.setInterval(() => { void load(); }, pollMs) : 0;
    return () => { alive.current = false; if (t) window.clearInterval(t); };
  }, [load, pollMs]);

  return { data, loading, error, refresh: load };
}

// ── notifications ──
export interface Notice { id: string; kind: 'success' | 'warning' | 'info' | 'danger'; title: string; detail: string; at: string; link?: string }
const SEEN_KEY = 'regnix.notif.seen';

export function useNotifications() {
  const { data, loading, error, refresh } = usePortal<{ role: string; notifications: Notice[] }>('cli-notifications', 60_000);
  const [seenAt, setSeenAt] = useState<number>(() => {
    try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
  });
  const notices = data?.notifications ?? [];
  const unread = notices.filter((n) => +new Date(n.at) > seenAt).length;
  const markAllRead = () => {
    const t = Date.now();
    setSeenAt(t);
    try { localStorage.setItem(SEEN_KEY, String(t)); } catch { /* ignore */ }
  };
  return { notices, unread, loading, error, refresh, markAllRead, seenAt, role: data?.role ?? 'client' };
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
