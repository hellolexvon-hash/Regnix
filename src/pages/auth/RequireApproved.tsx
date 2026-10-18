/**
 * src/pages/auth/RequireApproved.tsx
 *
 * Route guard for /dashboard/*. Renders nothing visible of its own: it lets
 * the page through only for a signed-in user whose profile has been approved
 * by a super admin; everyone else is sent to /login.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getApprovalStatus, signOutQuietly } from './approval';

type GuardState = 'checking' | 'ok' | 'denied';

export default function RequireApproved({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [state, setState] = useState<GuardState>('checking');

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { setState('denied'); return; }

    let cancelled = false;
    setState('checking');
    (async () => {
      const status = await getApprovalStatus();
      if (cancelled) return;
      if (status === 'approved') {
        setState('ok');
        return;
      }
      // pending / rejected: end the session. (unknown: just deny; the login
      // page re-checks and shows a message.)
      if (status === 'pending' || status === 'rejected') await signOutQuietly();
      if (!cancelled) setState('denied');
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, loading]);

  if (loading || state === 'checking') return null;
  if (state === 'denied') return <Navigate to="/login" replace />;
  return <>{children}</>;
}