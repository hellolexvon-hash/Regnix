/**
 * AuditorAuth.tsx
 *
 * Sign in / sign up gate for the Auditor Portal. Split layout:
 *   - Left: dark branding panel with portal identity + trust stats
 *   - Right: white form panel, tab-switched between Sign In and Sign Up
 *
 * On success, calls onAuthenticated() — the parent (AuditorPage) re-renders
 * into the dashboard shell once useAuditorStore().isAuthenticated is true.
 *
 * Zero inline styles — all from Auditor.module.css (.aa* classes).
 */

import { useState } from 'react';
import s from './Auditor.module.css';
import { useAuditorStore } from './auditorStore';
import { IconScale, IconAlertTriangle } from './icons';

interface AuditorAuthProps {
  onAuthenticated: () => void;
}

type Tab = 'signin' | 'signup';

export default function AuditorAuth({ onAuthenticated }: AuditorAuthProps) {
  const store = useAuditorStore();
  const [tab, setTab] = useState<Tab>('signin');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sign in fields
  const [siEmail, setSiEmail]       = useState('');
  const [siPassword, setSiPassword] = useState('');

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!siEmail.trim() || !siPassword) {
      setError('Please enter both email and password.');
      return;
    }
    setSubmitting(true);
    const result = await store.signIn(siEmail, siPassword);
    setSubmitting(false);
    if (result.ok) onAuthenticated();
    else setError(result.error);
  }

  return (
    <div className={s.aaPage}>
      <div className={s.aaShell}>

        {/* ── Left branding panel ─────────────────────────────────────────── */}
        <div className={s.aaBrand}>
          <div className={s.aaBrandTop}>
            <div className={s.aaBrandMark}><IconScale size={16} /></div>
            <span className={s.aaBrandName}>Regnix <strong>Auditor Portal</strong></span>
          </div>

          <div className={s.aaBrandBody}>
            <h1 className={s.aaBrandTitle}>
              Independent review,<br />built for statutory compliance.
            </h1>
            <p className={s.aaBrandSub}>
              Review documents that have already passed employer-side upload
              and live-register comparison, then issue the final compliance
              sign-off for each company.
            </p>

            <div className={s.aaBrandStats}>
              <div className={s.aaBrandStat}>
                <span className={s.aaBrandStatNum}>{store.companies.length}</span>
                <span className={s.aaBrandStatLabel}>Companies in queue</span>
              </div>
              <div className={s.aaBrandStat}>
                <span className={s.aaBrandStatNum}>
                  {store.companies.filter(c => c.status === 'approved').length}
                </span>
                <span className={s.aaBrandStatLabel}>Approved reports</span>
              </div>
              <div className={s.aaBrandStat}>
                <span className={s.aaBrandStatNum}>1–3</span>
                <span className={s.aaBrandStatLabel}>Day turnaround</span>
              </div>
            </div>
          </div>

          <div className={s.aaBrandFoot}>
            Auditor access is independent of employer accounts. Decisions made
            here cannot be edited or overridden by the company being audited.
          </div>
        </div>

        {/* ── Right form panel ────────────────────────────────────────────── */}
        <div className={s.aaForm}>
          <div className={s.aaFormInner}>

            <div className={s.aaTabs}>
              <button
                className={tab === 'signin' ? `${s.aaTab} ${s.aaTabActive}` : s.aaTab}
                onClick={() => { setTab('signin'); setError(''); }}
              >
                Sign In
              </button>
              <button
                className={tab === 'signup' ? `${s.aaTab} ${s.aaTabActive}` : s.aaTab}
                onClick={() => { setTab('signup'); setError(''); }}
              >
                Sign Up
              </button>
            </div>

            {error && (
              <div className={s.aaError}>
                <IconAlertTriangle size={13} /> {error}
              </div>
            )}

            {/* ─ Sign In ─ */}
            {tab === 'signin' && (
              <form className={s.aaFormBody} onSubmit={handleSignIn}>
                <p className={s.aaFormLead}>Welcome back. Sign in to open your review queue.</p>

                <div className={s.aaField}>
                  <label className={s.aaLabel}>Email address</label>
                  <input
                    className={s.aaInput}
                    type="email"
                    placeholder="you@auditfirm.com"
                    value={siEmail}
                    onChange={e => setSiEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>

                <div className={s.aaField}>
                  <label className={s.aaLabel}>Password</label>
                  <input
                    className={s.aaInput}
                    type="password"
                    placeholder="••••••••"
                    value={siPassword}
                    onChange={e => setSiPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <button className={s.aaSubmit} type="submit" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign In →'}
                </button>

              </form>
            )}

            {/* ─ Sign Up ─ */}
            {tab === 'signup' && (
              <div className={s.aaFormBody}>
                <p className={s.aaFormLead}>Auditor accounts are issued by Regnix.</p>
                <p className={s.aaFormLead}>
                  To become an auditor, ask a Regnix administrator to enable auditor access on your account.
                  Once enabled, sign in with the same email and password.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
