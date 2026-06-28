/**
 * ValidationPage.tsx
 *
 * Top-level orchestrator for the 3-level compliance validation workflow.
 *
 * Manages:
 *  - Which screen is shown (landing | level1 | level2 | level3)
 *  - Carries state across levels (docs, signature, live register file)
 *  - Level state tracking (pending/active/done/waiting)
 *
 * Usage:
 *  <ValidationPage
 *    companyName="Acme Corp"
 *    liveRegisterFile={masterFile}   // optional: the master .xlsx used during generation
 *  />
 */

import { useState } from 'react';
import ValidationLanding, { type LevelState } from './ValidationLanding';
import ValidationLevel1, { type UploadedDoc } from './ValidationLevel1';
import ValidationLevel2 from './ValidationLevel2';
import ValidationLevel3 from './ValidationLevel3';

type Screen = 'landing' | 'level1' | 'level2' | 'level3';

interface ValidationPageProps {
  companyName?: string;
  /** The master .xlsx file used during register generation — shown in Level 2 right pane */
  liveRegisterFile?: File | null;
}

export default function ValidationPage({
  companyName = 'Your Company',
  liveRegisterFile = null,
}: ValidationPageProps) {
  const [screen, setScreen]   = useState<Screen>('landing');
  const [levelStates, setLevelStates] = useState<[LevelState, LevelState, LevelState]>([
    'pending', 'pending', 'pending',
  ]);
  const [uploadedDocs, setUploadedDocs]     = useState<UploadedDoc[]>([]);
  const [signatureUrl, setSignatureUrl]     = useState<string>('');
  const [submittedAt, setSubmittedAt]       = useState<Date | undefined>();
  const [isApproved, setIsApproved]         = useState(false);

  function setLevelState(level: 0 | 1 | 2, state: LevelState) {
    setLevelStates(prev => {
      const next: [LevelState, LevelState, LevelState] = [...prev] as [LevelState, LevelState, LevelState];
      next[level] = state;
      return next;
    });
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function handleStartLevel(level: 1 | 2 | 3) {
    if (level === 1) {
      setLevelState(0, 'active');
      setScreen('level1');
    } else if (level === 2) {
      setLevelState(1, 'active');
      setScreen('level2');
    } else {
      setLevelState(2, 'waiting');
      setScreen('level3');
    }
  }

  function handleLevel1Complete(docs: UploadedDoc[], sig: string) {
    setUploadedDocs(docs);
    setSignatureUrl(sig);
    setLevelState(0, 'done');
    setLevelState(1, 'pending');
    setScreen('landing');
  }

  function handleLevel2Complete() {
    setLevelState(1, 'done');
    setLevelState(2, 'pending');
    const now = new Date();
    setSubmittedAt(now);
    setScreen('landing');
  }

  function handleLevel3Back() {
    setScreen('landing');
  }

  function handleDownloadReport() {
    // In production: fetch signed report from backend
    const link = document.createElement('a');
    link.href     = '#';
    link.download = `Audit_Report_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    link.click();
    alert('Audit report download triggered. Connect to your backend to serve the actual PDF.');
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (screen === 'level1') {
    return (
      <ValidationLevel1
        onComplete={handleLevel1Complete}
        onBack={() => {
          setLevelState(0, uploadedDocs.length > 0 ? 'active' : 'pending');
          setScreen('landing');
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
        onBack={() => setScreen('landing')}
      />
    );
  }

  if (screen === 'level3') {
    return (
      <ValidationLevel3
        companyName={companyName}
        submittedAt={submittedAt}
        isApproved={isApproved}
        onDownloadReport={handleDownloadReport}
        onBack={handleLevel3Back}
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
