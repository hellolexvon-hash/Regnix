/**
 * ValidationPage.tsx
 *
 * Top-level orchestrator for the 3-level compliance validation workflow.
 * Mounted at /dashboard/validation (and sub-paths via DashboardPage).
 *
 * The UI stays the same; only the state source is persistent now.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useValidationStore } from './validationStore';
import ValidationLanding from './ValidationLanding';
import ValidationLevel1  from './ValidationLevel1';
import ValidationLevel2  from './ValidationLevel2';
import ValidationLevel3  from './ValidationLevel3';
import { uploadValidationDocs, submitLevel2, fetchL3Status, downloadCertificate, type Level2Payload, type L3Status } from './validationDocsUpload';

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

  // Apply the route-state payload (coming from DocumentGenerator Step 5) ONCE,
  // and only after the store has hydrated — otherwise hydration overwrites it.
  // The ref guard + stable store actions stop the old render loop.
  const appliedRouteKey = useRef('');
  useEffect(() => {
    if (!hydrated || !routeState) return;
    const f = routeState.liveRegisterFile;
    const key = [
      routeState.companyName ?? '',
      f ? `${f.name}|${f.size}|${f.lastModified}` : '',
      (routeState.selectedActs ?? []).join(','),
    ].join('#');
    if (appliedRouteKey.current === key) return;
    appliedRouteKey.current = key;

    if (routeState.companyName) setCompanyName(routeState.companyName);
    if (f) setLiveRegisterFile(f);
    if (Array.isArray(routeState.selectedActs)) setSelectedActs(routeState.selectedActs);
  }, [hydrated, routeState, setCompanyName, setLiveRegisterFile, setSelectedActs]);

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
    // Background copy of every Level 1 document to the company's Zoho WorkDrive folder
    void uploadValidationDocs(docs.map(d => ({ file: d.file, name: d.name })), resolvedCompanyName);
    setSignatureUrl(sig);
    setLevelState(0, 'done');
    setLevelState(1, 'pending');
    goTo('landing');
  }

  async function handleLevel2Complete(summary: Level2Payload) {
    const r = await submitLevel2(summary);
    if (!r.ok) throw new Error(r.message || 'Could not submit for audit.');
    setLevelState(1, 'done');
    setLevelState(2, 'pending');
    setSubmittedAt(new Date());
    goTo('landing');
  }

  // Level 3: poll the real audit status (claimed → decided) while the page is open
  const [l3, setL3] = useState<L3Status | null>(null);
  useEffect(() => {
    if (screen !== 'level3' && screen !== 'landing') return;
    let alive = true;
    const tick = async () => {
      const st = await fetchL3Status();
      if (!alive || !st) return;
      setL3(st);
      if (st.status === 'approved') setApproved(true);
    };
    void tick();
    const id = setInterval(tick, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [screen, setApproved]);

  async function handleDownloadReport() {
    const name = `${l3?.certificate?.certificateNo ?? 'Compliance_Certificate'}.pdf`;
    const ok = await downloadCertificate(name);
    if (!ok) window.alert('The certificate PDF is not ready yet. The auditor saves it when issuing the certificate — please try again shortly.');
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
        auditNote={l3 && ['changes_requested', 'rejected'].includes(l3.status) ? { status: l3.status as 'changes_requested' | 'rejected', remarks: l3.remarks ?? '' } : undefined}
        auditorAssigned={!!l3?.assigned}
        certificateNo={l3?.certificate?.certificateNo}
        onApprove={import.meta.env.DEV ? () => setApproved(true) : undefined}
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