/**
 * ValidationPage.tsx
 *
 * Top-level orchestrator for the 3-level compliance validation workflow.
 * Mounted at /dashboard/validation (and sub-paths via DashboardPage).
 *
 * Routing strategy:
 *   /dashboard/validation            → landing (level overview)
 *   /dashboard/validation/level1     → Level 1 upload & verify
 *   /dashboard/validation/level2     → Level 2 live comparison
 *   /dashboard/validation/level3     → Level 3 auditor waiting
 *
 * Uses useNavigate + useParams so the browser back button works correctly.
 * DashboardPage already has:  <Route path="/dashboard/:section/:sub" element={<DashboardPage />} />
 * so these sub-paths resolve automatically.
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useValidationStore } from './validationStore';
import ValidationLanding from './ValidationLanding';
import ValidationLevel1  from './ValidationLevel1';
import ValidationLevel2  from './ValidationLevel2';
import ValidationLevel3  from './ValidationLevel3';

interface ValidationPageProps {
  companyName?:      string;
  /** The master .xlsx used during register generation — passed into Level 2 right pane */
  liveRegisterFile?: File | null;
}

export default function ValidationPage({
  companyName      = 'Your Company',
  liveRegisterFile = null,
}: ValidationPageProps) {
  const navigate   = useNavigate();
  const { sub }    = useParams<{ sub?: string }>();

  const {
    levelStates,
    uploadedDocs,
    signatureUrl,
    submittedAt,
    isApproved,
    setLevelState,
    setUploadedDocs,
    setSignatureUrl,
    setSubmittedAt,
    setApproved,
  } = useValidationStore();

  // Sync URL → keep /dashboard/validation canonical for the landing screen
  const screen = sub ?? 'landing';

  function goTo(path: 'landing' | 'level1' | 'level2' | 'level3') {
    if (path === 'landing') {
      navigate('/dashboard/validation', { replace: false });
    } else {
      navigate(`/dashboard/validation/${path}`, { replace: false });
    }
  }

  // ── Level handlers ──────────────────────────────────────────────────────────

  function handleStartLevel(level: 1 | 2 | 3) {
    if (level === 1) {
      setLevelState(0, 'active');
      goTo('level1');
    } else if (level === 2) {
      setLevelState(1, 'active');
      goTo('level2');
    } else {
      setLevelState(2, 'waiting');
      goTo('level3');
    }
  }

  function handleLevel1Complete(docs: Parameters<typeof setUploadedDocs>[0], sig: string) {
    setUploadedDocs(docs);
    setSignatureUrl(sig);
    setLevelState(0, 'done');
    setLevelState(1, 'pending');
    goTo('landing');
  }

  function handleLevel2Complete() {
    setLevelState(1, 'done');
    setLevelState(2, 'pending');
    setSubmittedAt(new Date());
    goTo('landing');
  }

  function handleDownloadReport() {
    // Production: fetch signed PDF from backend
    const link     = document.createElement('a');
    link.href     = '#';
    link.download = `Audit_Report_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    link.click();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (screen === 'level1') {
    return (
      <ValidationLevel1
        onComplete={handleLevel1Complete}
        onBack={() => {
          setLevelState(0, uploadedDocs.length > 0 ? 'active' : 'pending');
          goTo('landing');
        }}
      />
    );
  }

  if (screen === 'level2') {
    return (
      <ValidationLevel2
        docs={uploadedDocs}
        liveRegisterFile={liveRegisterFile}
        companyName={companyName}
        onComplete={handleLevel2Complete}
        onBack={() => goTo('landing')}
      />
    );
  }

  if (screen === 'level3') {
    return (
      <ValidationLevel3
        companyName={companyName}
        submittedAt={submittedAt ?? undefined}
        isApproved={isApproved}
        onApprove={() => setApproved(true)}
        onDownloadReport={handleDownloadReport}
        onBack={() => goTo('landing')}
      />
    );
  }

  // Default: landing
  return (
    <ValidationLanding
      companyName={companyName}
      levelStates={levelStates}
      onStartLevel={handleStartLevel}
    />
  );
}
