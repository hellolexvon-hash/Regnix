/**
 * src/components/auth/ProtectedRoute.tsx
 *
 * Wrap any route that requires authentication.
 * Shows nothing while session is loading, redirects to /login if not authed.
 *
 * Usage in App.tsx:
 *   <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
 */

import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo = '/login' }: Props) {
  const { isAuthenticated, loading } = useAuth();

  if (loading)          return null;          // wait for Supabase session
  if (!isAuthenticated) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
}
