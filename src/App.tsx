/**
 * src/App.tsx
 * Routes unchanged. AuthProvider now backed by Supabase via useAuth.tsx.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import LandingPage    from '@/pages/landing/LandingPage';
import SignupPage     from '@/pages/auth/SignupPage';
import LoginPage      from '@/pages/auth/LoginPage';
import RequireApproved from '@/pages/auth/RequireApproved';
import DashboardPage  from '@/pages/dashboard/DashboardPage';
import AuditorPage    from '@/components/dashboard/AuditorView/AuditorPage';
import PricingPage    from '@/pages/pricing/PricingPage';
import PendingApprovalPage from '@/pages/auth/PendingApprovalPage';
import KycUploadPage   from '@/pages/kyc/KycUploadPage';
import SuperAdminPage from '@/components/dashboard/superadmin/SuperAdminPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"         element={<LandingPage />} />
          <Route path="/pricing"  element={<PricingPage />} />
          <Route path="/signup"   element={<SignupPage />} />
          <Route path="/login"    element={<LoginPage />} />

          {/* Waiting room: application review / KYC. Needs a session but not full access. */}
          <Route path="/pending"  element={<PendingApprovalPage />} />
          {/* Secure KYC upload link from the email (token-based, no login) */}
          <Route path="/kyc-upload/:token" element={<KycUploadPage />} />

          {/* Dashboard — nested section & sub-section */}
          {/* Only users approved by a super admin AND KYC-verified get in */}
          <Route path="/dashboard"                element={<RequireApproved><DashboardPage /></RequireApproved>} />
          <Route path="/dashboard/:section"       element={<RequireApproved><DashboardPage /></RequireApproved>} />
          <Route path="/dashboard/:section/:sub"  element={<RequireApproved><DashboardPage /></RequireApproved>} />

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