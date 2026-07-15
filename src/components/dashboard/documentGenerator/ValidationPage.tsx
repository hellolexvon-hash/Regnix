/**
 * ValidationPage.tsx
 *
 * Top-level orchestrator for the 3-level compliance validation workflow.
 * Mounted at /dashboard/validation (and sub-paths via DashboardPage).
 *
 * The UI stays the same; only the state source is persistent now.
 */

import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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

interface ValidationRouteState {
  companyName?: string;
  liveRegisterFile?: File | null;
  selectedActs?: string[];
}

export default function ValidationPage({
  companyName      = 'Your Company',
  liveRegisterFile = null,
}: ValidationPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sub }  = useParams<{ sub?: string }>();

  const routeState = (location.state as ValidationRouteState | null) ?? null;

  const {
    levelStates,
    uploadedDocs,
    submittedAt,
    isApproved,
    currentRoute,
    companyName: storedCompanyName,
    liveRegisterFile: storedLiveRegisterFile,
    hydrated,
    setLevelState,
    setUploadedDocs,
    setSignatureUrl,
    setSubmittedAt,
    setApproved,
    setCurrentRoute,
    setCompanyName,
    setSelectedActs,
    setLiveRegisterFile,
  } = useValidationStore();

  const resolvedCompanyName = routeState?.companyName ?? storedCompanyName ?? companyName;
  const resolvedLiveRegisterFile = routeState?.liveRegisterFile ?? storedLiveRegisterFile ?? liveRegisterFile;

  // Keep persisted state aligned with the route and any route-state payload.
  useEffect(() => {
    if (routeState?.companyName) {
      setCompanyName(routeState.companyName);
    }
    if (routeState?.liveRegisterFile) {
      setLiveRegisterFile(routeState.liveRegisterFile);
    }
    if (Array.isArray(routeState?.selectedActs)) {
      setSelectedActs(routeState.selectedActs);
    }
  }, [routeState, setCompanyName, setLiveRegisterFile, setSelectedActs]);

  useEffect(() => {
    if (sub === 'level1' || sub === 'level2' || sub === 'level3') {
      setCurrentRoute(sub);
    }
  }, [sub, setCurrentRoute]);

  // If the user refreshes on /dashboard/validation, restore the saved stage.
  useEffect(() => {
    if (!hydrated) return;
    if (!sub && (currentRoute === 'level1' || currentRoute === 'level2' || currentRoute === 'level3')) {
      navigate(`/dashboard/validation/${currentRoute}`, { replace: true });
    }
  }, [hydrated, sub, currentRoute, navigate]);

  // If the user lands on /dashboard/validation after being in stage 2/3,
  // render the saved stage instead of restarting the workflow.
  const screen = (sub ?? currentRoute ?? 'landing') as 'landing' | 'level1' | 'level2' | 'level3';

  function goTo(path: 'landing' | 'level1' | 'level2' | 'level3') {
    setCurrentRoute(path);
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

  function handleLevel1Complete(
    docs: Parameters<typeof setUploadedDocs>[0],
    sig: string,
  ) {
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
    link.href      = '#';
    link.download  = `Audit_Report_${resolvedCompanyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    link.click();
  }

  if (!hydrated) return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (screen === 'level1') {
    return (
      <ValidationLevel1
        onComplete={handleLevel1Complete}
        onBack={() => {
          setCurrentRoute('landing');
          setLevelState(0, uploadedDocs.length > 0 ? 'active' : 'pending');
          navigate('/dashboard/validation', { replace: false });
        }}
      />
    );
  }

  if (screen === 'level2') {
    return (
      <ValidationLevel2
        docs={uploadedDocs}
        liveRegisterFile={resolvedLiveRegisterFile}
        companyName={resolvedCompanyName}
        onComplete={handleLevel2Complete}
        onBack={() => {
          setCurrentRoute('landing');
          navigate('/dashboard/validation', { replace: false });
        }}
      />
    );
  }

  if (screen === 'level3') {
    return (
      <ValidationLevel3
        companyName={resolvedCompanyName}
        submittedAt={submittedAt ?? undefined}
        isApproved={isApproved}
        onApprove={() => setApproved(true)}
        onDownloadReport={handleDownloadReport}
        onBack={() => {
          setCurrentRoute('landing');
          navigate('/dashboard/validation', { replace: false });
        }}
      />
    );
  }

  // Default: landing
  return (
    <ValidationLanding
      companyName={resolvedCompanyName}
      levelStates={levelStates}
      onStartLevel={handleStartLevel}
    />
  );
}