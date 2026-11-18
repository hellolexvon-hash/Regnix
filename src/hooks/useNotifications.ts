/**
 * src/hooks/useNotifications.ts
 * Reads public.user_notifications for the signed-in user + realtime inserts.
 *
 * FIX: the bell, dashboard home and sidebar all call this hook. supabase.channel(name)
 * returns the SAME channel for the same name, and calling .on() on an already
 * subscribed channel throws. Every hook instance now gets its own channel name.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export interface AppNotification {
  id: string;
  type: 'review' | 'request' | 'approval' | 'document' | 'system';
  priority: 'normal' | 'high';
  title: string;
  body: string | null;
  sender_name: string | null;
  sender_role: 'admin' | 'auditor' | 'system' | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

let instance = 0;

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const idRef = useRef(++instance);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;

    supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!active) return;
        if (!error) setItems((data as AppNotification[]) ?? []);
        setLoading(false);
      });

    // unique topic per hook instance (and per effect run, for React StrictMode)
    const channel = supabase
      .channel(`user_notifications:${userId}:${idRef.current}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        payload => setItems(prev => (prev.some(n => n.id === (payload.new as AppNotification).id) ? prev : [payload.new as AppNotification, ...prev])),
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from('user_notifications').update({ read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('user_notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  }, [userId]);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);
  const actionable  = useMemo(() => items.filter(n => n.type === 'review' || n.type === 'request'), [items]);

  return { items, actionable, unreadCount, loading, markRead, markAllRead };
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
