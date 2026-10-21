/**
 * src/pages/auth/RequireApproved.tsx
 *
 * Route guard for /dashboard/*. Lets the page through only for a signed-in
 * user who is (1) approved by a super admin AND (2) KYC-verified.
 *   - pending application  -> /pending            (session kept)
 *   - approved, no KYC yet -> /pending?stage=kyc  (session kept)
 *   - rejected / unknown   -> signed out, /login
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getAccessState, gateFor, signOutQuietly, type Gate } from './approval';

type GuardState = 'checking' | Gate | 'anon';

export default function RequireApproved({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [state, setState] = useState<GuardState>('checking');

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { setState('anon'); return; }

    let cancelled = false;
    setState('checking');
    (async () => {
      const gate = gateFor(await getAccessState());
      if (cancelled) return;
      if (gate === 'rejected') await signOutQuietly();
      if (!cancelled) setState(gate);
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, loading]);

  if (loading || state === 'checking') return null;
  if (state === 'ok') return <>{children}</>;
  if (state === 'pending') return <Navigate to="/pending" replace />;
  if (state === 'kyc') return <Navigate to="/pending?stage=kyc" replace />;
  return <Navigate to="/login" replace />;
}
