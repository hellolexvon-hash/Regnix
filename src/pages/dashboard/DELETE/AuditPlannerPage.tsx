/**
 * src/pages/dashboard/AuditPlannerPage.tsx
 * The company's audit cycles (review_cycles): stage, score, auditor, auditor remarks,
 * issues, certificate and the documents submitted for each cycle (Zoho links).
 * Data: GET /api/client/audit.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { fetchAudits, formatBytes, fmtDate, type AuditCycle } from '@/lib/clientPortal';
import styles from './ZohoPages.module.css';

const STATUS: Record<AuditCycle['status'], { label: string; color: string; progress: number }> = {
  pending:           { label: 'Awaiting auditor',  color: '#8B85A8', progress: 40 },
  in_review:         { label: 'Under review',      color: '#2563EB', progress: 70 },
  changes_requested: { label: 'Changes requested', color: '#D97706', progress: 60 },
  approved:          { label: 'Approved',          color: '#059669', progress: 100 },
  rejected:          { label: 'Rejected',          color: '#DC2626', progress: 100 },
};
const SEV: Record<string, string> = { critical: '#DC2626', major: '#D97706', minor: '#8B85A8' };
const month = (d: string) => new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export default function AuditPlannerPage() {
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [orgName, setOrgName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetchAudits();
      setCycles(r.cycles); setOrgName(r.organization?.name ?? '');
      setSelectedId(prev => prev && r.cycles.some(c => c.id === prev) ? prev : r.cycles[0]?.id ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => cycles.find(c => c.id === selectedId) ?? null, [cycles, selectedId]);
  const counts = useMemo(() => ({
    total: cycles.length,
    active: cycles.filter(c => c.status === 'pending' || c.status === 'in_review').length,
    changes: cycles.filter(c => c.status === 'changes_requested').length,
    approved: cycles.filter(c => c.status === 'approved').length,
  }), [cycles]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>Audit Planner</h1>
          <p className={styles.sub}>{orgName ? `${orgName} — ` : ''}track each audit cycle, auditor feedback and submitted documents.</p>
        </div>
        <button className={styles.primaryBtn} onClick={load} disabled={loading}>
          <Icon name="refresh" size={13} className={loading ? styles.spin : ''} /> Refresh
        </button>
      </div>

      <div className={styles.statRow}>
        <div className={styles.stat}><span className={styles.statNum}>{counts.total}</span><span className={styles.statLabel}>Audit cycles</span></div>
        <div className={styles.stat}><span className={styles.statNum}>{counts.active}</span><span className={styles.statLabel}>In progress</span></div>
        <div className={styles.stat}><span className={styles.statNum} style={{ color: '#D97706' }}>{counts.changes}</span><span className={styles.statLabel}>Changes requested</span></div>
        <div className={styles.stat}><span className={styles.statNum} style={{ color: '#059669' }}>{counts.approved}</span><span className={styles.statLabel}>Approved</span></div>
      </div>

      {error && <div className={styles.errorBox}><Icon name="alert" size={15} /><div><strong>Couldn't load audits.</strong><span>{error}</span></div></div>}

      <div className={styles.split}>
        <div className={styles.card}>
          <div className={styles.sectionLabel}>AUDIT CYCLES</div>
          <div className={styles.auditList}>
            {loading && <div className={styles.skeleton} />}
            {!loading && cycles.length === 0 && !error && (
              <div className={styles.empty}><Icon name="clipboard" size={22} /><span>No audits yet. Submit Level 2 validation to start one.</span></div>
            )}
            {cycles.map(c => {
              const st = STATUS[c.status] ?? STATUS.pending;
              return (
                <button key={c.id} className={`${styles.auditItem} ${c.id === selectedId ? styles.auditActive : ''}`} onClick={() => setSelectedId(c.id)}>
                  <span className={styles.auditTop}>
                    <span className={styles.auditTitle}>{month(c.reportingMonth)}</span>
                    <span className={styles.badge} style={{ color: st.color, background: `${st.color}14` }}>{st.label}</span>
                  </span>
                  <span className={styles.auditMeta}>
                    <Icon name="user" size={11} /> {c.auditorName ?? 'Not assigned yet'}
                    <Icon name="checkCircle" size={11} style={{ marginLeft: 8 }} /> Score {Math.round(c.score)}%
                  </span>
                  <span className={styles.bar}><span className={styles.barFill} style={{ width: `${st.progress}%` }} /></span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.card}>
          {!selected ? (
            <div className={styles.empty}><Icon name="clipboard" size={24} /><span>Select an audit cycle.</span></div>
          ) : (
            <>
              <div className={styles.detailHead}>
                <div>
                  <div className={styles.detailTitle}>{month(selected.reportingMonth)} audit</div>
                  <div className={styles.detailMeta}>
                    <span><Icon name="calendar" size={12} /> Submitted {fmtDate(selected.submittedAt)}</span>
                    <span><Icon name="user" size={12} /> {selected.auditorName ?? 'Awaiting auditor'}</span>
                    <span><Icon name="checkCircle" size={12} /> Level 2 score {Math.round(selected.score)}%</span>
                    {selected.decidedAt && <span><Icon name="clock" size={12} /> Decided {fmtDate(selected.decidedAt)}</span>}
                  </div>
                </div>
                {selected.certificate && !selected.certificate.revoked && (
                  <span className={styles.badge} style={{ color: '#059669', background: '#05966914' }}>
                    <Icon name="shieldCheck" size={11} style={{ marginRight: 4, verticalAlign: '-2px' }} />Certificate {selected.certificate.no}
                  </span>
                )}
              </div>

              {selected.remarks && (
                <div className={styles.remarks}>
                  <span className={styles.sectionLabel}>AUDITOR REMARKS</span>
                  <p>{selected.remarks}</p>
                </div>
              )}

              {selected.issues.length > 0 && (
                <>
                  <div className={styles.sectionLabel}>FINDINGS · {selected.issues.filter(i => !i.resolved).length} OPEN</div>
                  <div className={styles.issueList}>
                    {selected.issues.slice(0, 12).map((i, n) => (
                      <div key={n} className={styles.issue}>
                        <span className={styles.sev} style={{ background: SEV[i.severity] ?? '#8B85A8' }} />
                        <span className={styles.issueBody}>
                          <span className={styles.issueRule}>{i.rule}</span>
                          <span className={styles.sub} style={{ margin: 0 }}>{i.docName}{i.rootCause ? ` · ${i.rootCause}` : ''}</span>
                        </span>
                        <span className={styles.badge} style={{ color: i.resolved ? '#059669' : '#D97706', background: i.resolved ? '#05966914' : '#D9770614' }}>
                          {i.resolved ? 'Resolved' : 'Open'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className={styles.sectionLabel}>SUBMITTED DOCUMENTS · ZOHO WORKDRIVE ({selected.files.length})</div>
              {selected.missingFiles.length > 0 && (
                <div className={styles.errorBox}><Icon name="alert" size={15} /><div><strong>Missing files</strong><span>{selected.missingFiles.join(', ')}</span></div></div>
              )}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Document</th><th>Size</th><th>Uploaded</th><th /></tr></thead>
                  <tbody>
                    {selected.files.map(f => (
                      <tr key={f.id} className={styles.tr}>
                        <td><div className={styles.nameCell}><span className={styles.fileIcon} style={{ background: '#7C3AED14', color: '#7C3AED' }}><Icon name="fileText" size={15} /></span><span className={styles.fileName}>{f.name}</span></div></td>
                        <td className={styles.muted}>{formatBytes(f.size)}</td>
                        <td className={styles.muted}>{fmtDate(f.at)}</td>
                        <td className={styles.actions}>
                          {f.zohoUrl && <button className={styles.rowBtn} title="Open in Zoho WorkDrive" onClick={() => window.open(f.zohoUrl!, '_blank')}><Icon name="external" size={13} /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selected.files.length === 0 && <div className={styles.empty}><Icon name="cloud" size={22} /><span>No documents attached to this cycle.</span></div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
