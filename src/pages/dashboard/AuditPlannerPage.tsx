/**
 * src/pages/dashboard/AuditPlannerPage.tsx
 * Audit planner: every review cycle with its live stage, the auditor on it, the score and
 * certificate, plus next actions and the upcoming statutory due dates.
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icons';
import { usePortal } from './dashboardApi';
import s from './DashboardPages.module.css';

interface Review {
  id: string; month: string; status: string; stage: number; stages: string[]; score: number | null; submittedAt: string | null;
  decidedAt: string | null; remarks: string; auditor: string | null; openIssues: number; files: number;
  certificate: { no: string; issuedAt: string; revoked: boolean } | null;
}
interface Due { date: string; title: string; act: string; type: string }
interface Action { title: string; detail: string; tone: 'danger' | 'warning' | 'info'; link: string }

const STATUS: Record<string, [string, string]> = {
  pending: ['Awaiting auditor', s.b_info], in_review: ['In review', s.b_warn], approved: ['Approved', s.b_ok],
  changes_requested: ['Changes requested', s.b_warn], rejected: ['Rejected', s.b_bad],
};
const monthLabel = (m: string) => new Date(m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export default function AuditPlannerPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = usePortal<{ reviews: Review[]; upcoming: Due[]; actions: Action[] }>('cli-planner', 60_000);
  const reviews = data?.reviews ?? [];
  const approved = reviews.filter((r) => r.status === 'approved').length;
  const active = reviews.filter((r) => r.status === 'pending' || r.status === 'in_review').length;
  const scored = reviews.filter((r) => r.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : null;
  const soon = Date.now() + 5 * 86400000;

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.h1}>Audit Planner</h1>
          <p className={s.sub}>Track each audit from upload to certificate, and see what's due next.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={s.btn} onClick={() => { void refresh(); }}><Icon name="refresh" size={13} />Refresh</button>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => navigate('/dashboard/validation')}><Icon name="zap" size={13} />Start validation</button>
        </div>
      </div>

      <div className={s.stats}>
        <div className={s.stat}><div className={s.statNum}>{reviews.length}</div><div className={s.statLabel}>Review cycles</div></div>
        <div className={s.stat}><div className={s.statNum}>{active}</div><div className={s.statLabel}>In progress</div></div>
        <div className={s.stat}><div className={s.statNum}>{approved}</div><div className={s.statLabel}>Certified</div></div>
        <div className={s.stat}><div className={s.statNum}>{avg != null ? `${avg}%` : '—'}</div><div className={s.statLabel}>Avg. audit score</div></div>
      </div>

      {error && <div className={s.err}>{error}</div>}

      <div className={s.grid2}>
        <div className={s.card}>
          <div className={s.cardPad} style={{ paddingBottom: 0 }}><h2 className={s.cardTitle}>Review cycles</h2></div>
          {loading ? <div className={s.state}><div className={s.spin} />Loading…</div>
            : reviews.length === 0 ? <div className={s.state}><Icon name="clock" size={26} />No audits yet. Complete a validation and submit it to start your first review cycle.</div>
            : reviews.map((r) => {
              const [label, cls] = STATUS[r.status] ?? [r.status, s.b_mute];
              return (
                <div key={r.id} className={s.cycle}>
                  <div className={s.cycleTop}>
                    <div>
                      <div className={s.cycleMonth}>{monthLabel(r.month)}</div>
                      <div className={s.cycleMeta}>
                        {r.auditor && <span><Icon name="user" size={11} style={{ verticalAlign: -1 }} /> {r.auditor}</span>}
                        <span>{r.files} file(s)</span>
                        {r.score != null && <span>Score <b className={s.score}>{Math.round(r.score)}%</b></span>}
                        {r.openIssues > 0 && <span style={{ color: '#B45309' }}>{r.openIssues} open issue(s)</span>}
                      </div>
                    </div>
                    <span className={`${s.badge} ${cls}`}>{label}</span>
                  </div>
                  <div className={s.steps}>
                    {r.stages.map((st, i) => {
                      const n = i + 1;
                      const cls2 = n < r.stage || (r.status === 'approved' && n <= r.stage) ? s.stepDone : n === r.stage ? s.stepNow : '';
                      return (
                        <div key={st} className={`${s.step} ${cls2}`}>
                          <span className={s.dot}>{cls2 === s.stepDone ? <Icon name="check" size={12} /> : n}</span>
                          <span className={s.stepLabel}>{st}</span>
                        </div>
                      );
                    })}
                  </div>
                  {r.remarks && (r.status === 'changes_requested' || r.status === 'rejected') && <div className={s.remarks}><b>Auditor remarks:</b> {r.remarks}</div>}
                  {r.certificate && (
                    <div className={s.remarks} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="award" size={15} /> Certificate <b>{r.certificate.no}</b>{r.certificate.revoked && <span className={`${s.badge} ${s.b_bad}`}>Revoked</span>}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className={s.stack}>
          {(data?.actions.length ?? 0) > 0 && (
            <div className={`${s.card} ${s.cardPad}`}>
              <h2 className={s.cardTitle}>Next actions</h2>
              {data!.actions.map((a) => (
                <button key={a.title} className={s.action} onClick={() => navigate(a.link)}>
                  <span className={`${s.fileIcon} ${a.tone === 'danger' ? s.b_bad : a.tone === 'warning' ? s.b_warn : s.b_info}`}><Icon name="alert" size={15} /></span>
                  <span><span className={s.fileName} style={{ display: 'block' }}>{a.title}</span><span className={s.fileSub} style={{ whiteSpace: 'normal' }}>{a.detail}</span></span>
                </button>
              ))}
            </div>
          )}
          <div className={`${s.card} ${s.cardPad}`}>
            <h2 className={s.cardTitle}>Upcoming due dates</h2>
            {(data?.upcoming ?? []).slice(0, 10).map((d, i) => {
              const dt = new Date(d.date);
              return (
                <div key={`${d.date}-${d.title}-${i}`} className={`${s.due} ${+dt <= soon ? s.dueSoon : ''}`}>
                  <div className={s.dueDate}><div className={s.dueDay}>{dt.getDate()}</div><div className={s.dueMon}>{dt.toLocaleDateString('en-IN', { month: 'short' })}</div></div>
                  <div><div className={s.dueTitle}>{d.title}</div><div className={s.dueAct}>{d.act}</div></div>
                </div>
              );
            })}
            {!loading && !data?.upcoming.length && <div className={s.fileSub}>Nothing due soon.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
