/**
 * PATCH FILE — DocumentGenerator.tsx — Step5 replacement
 *
 * Replace the existing Step5 function and the root export's restart() call.
 *
 * Changes:
 *  1. Step5 gets a new "Start Validation" button that uses useNavigate
 *     to go to /dashboard/validation, carrying company + liveFile context.
 *  2. onRestart is unchanged (still resets DocumentGenerator state).
 *
 * HOW TO APPLY:
 *  a) Add this import at the top of DocumentGenerator.tsx (with the other imports):
 *       import { useNavigate } from 'react-router-dom';
 *
 *  b) Replace the Step5 function entirely with the one below.
 *
 *  c) In the root DocumentGenerator() component, add the hook:
 *       const navigate = useNavigate();
 *     and update the onRestart prop passed to Step5:
 *       onRestart={restart}
 *       onStartValidation={() => navigate('/dashboard/validation')}
 *
 *  d) Update the Step5 JSX call:
 *     BEFORE:
 *       <Step5
 *         company={company}
 *         selectedActs={selectedActs}
 *         info={doneInfo}
 *         onRestart={restart}
 *       />
 *     AFTER:
 *       <Step5
 *         company={company}
 *         selectedActs={selectedActs}
 *         info={doneInfo}
 *         onRestart={restart}
 *         onStartValidation={() => navigate('/dashboard/validation')}
 *       />
 */

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Done  (replace the existing Step5 function with this)
// ─────────────────────────────────────────────────────────────────────────────
function Step5({ company, selectedActs, info, onRestart, onStartValidation }: {
  company:             CompanyDetails;
  selectedActs:        ActId[];
  info:                { fileCount: number; rowCount: number; zipUrl: string };
  onRestart:           () => void;
  onStartValidation:   () => void;
}) {
  const reDownload = () => {
    const a = document.createElement('a');
    a.href = info.zipUrl;
    a.download = `${company.name.replace(/\s+/g, '_')}_Registers.zip`;
    a.click();
  };

  return (
    <div className={styles.stepCard}>
      <div className={styles.doneHero}>
        <div className={styles.doneCheck}>✓</div>
        <h2 className={styles.doneTitle}>All Registers Generated!</h2>
        <p className={styles.doneSub}>
          {info.fileCount} statutory register files were filled from {info.rowCount} employee record{info.rowCount !== 1 ? 's' : ''} and packaged into a ZIP.
        </p>
      </div>

      <div className={styles.doneStatsRow}>
        <div className={styles.doneStat}>
          <div className={styles.doneStatNum}>{info.rowCount}</div>
          <div className={styles.doneStatLabel}>Employees Processed</div>
        </div>
        <div className={styles.doneStat}>
          <div className={styles.doneStatNum}>{selectedActs.length}</div>
          <div className={styles.doneStatLabel}>Acts Covered</div>
        </div>
        <div className={styles.doneStat}>
          <div className={styles.doneStatNum}>{info.fileCount}</div>
          <div className={styles.doneStatLabel}>Register Files</div>
        </div>
      </div>

      <div className={styles.doneActList}>
        {selectedActs.map(id => {
          const act = ACTS.find(a => a.id === id)!;
          return (
            <div key={id} className={styles.doneActRow}>
              <div className={styles.doneActCheck}>✓</div>
              <div>
                <div className={styles.doneActName}>{act.label}</div>
                <div className={styles.doneActForms}>{act.forms.join(' · ')}</div>
              </div>
              <span className={styles.doneActCount}>{act.fileCount} files</span>
            </div>
          );
        })}
      </div>

      {/* Next step prompt */}
      <div style={{
        background: '#F5F3FF', border: '1.5px solid #C4B5FD',
        borderRadius: 12, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 22 }}>🛡️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F0A1E', marginBottom: 3 }}>
            Ready for validation?
          </div>
          <div style={{ fontSize: 11.5, color: '#8B85A8' }}>
            Proceed to the 3-level compliance audit to certify your registers.
          </div>
        </div>
        <button
          className={styles.btnPrimary}
          onClick={onStartValidation}
          style={{ whiteSpace: 'nowrap' }}
        >
          Start Validation →
        </button>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.btnSecondary} onClick={reDownload}>
          ⬇ Re-download ZIP
        </button>
        <button className={styles.btnSecondary} onClick={onRestart}>
          + Start New Audit
        </button>
      </div>
    </div>
  );
}
