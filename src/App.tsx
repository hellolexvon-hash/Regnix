/**
 * src/App.tsx
 * Routes unchanged. AuthProvider now backed by Supabase via useAuth.tsx.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import LandingPage    from '@/pages/landing/LandingPage';
import SignupPage     from '@/pages/auth/SignupPage';
import LoginPage      from '@/pages/auth/LoginPage';
import DashboardPage  from '@/pages/dashboard/DashboardPage';
import AuditorPage    from '@/components/dashboard/AuditorView/AuditorPage';
import SuperAdminPage from '@/components/dashboard/superadmin/SuperAdminPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"         element={<LandingPage />} />
          <Route path="/signup"   element={<SignupPage />} />
          <Route path="/login"    element={<LoginPage />} />

          {/* Dashboard — nested section & sub-section */}
          <Route path="/dashboard"                element={<DashboardPage />} />
          <Route path="/dashboard/:section"       element={<DashboardPage />} />
          <Route path="/dashboard/:section/:sub"  element={<DashboardPage />} />

          {/* Auditor portal — independent of employer auth session */}
          <Route path="/auditor/*" element={<AuditorPage />} />
          <Route path="/admin/*" element={<SuperAdminPage />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
