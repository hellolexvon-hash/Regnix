/**
 * SuperAdminAuth.tsx
 *
 * Sign-in gate for the Super Admin console. Deliberately NOT self-service —
 * no "Sign Up" tab. Super admin accounts should be provisioned directly in
 * the database (or by an existing super admin, in a future release) rather
 * than created through a public form — this is the account type with
 * visibility into every client and every auditor on the platform.
 *
 * Visually distinct (amber accent vs. the Auditor Portal's violet) so
 * anyone glancing at the screen — including the person using it — has an
 * immediate, unambiguous signal that this is an elevated-privilege session.
 */

import { useState } from 'react';
import s from './SuperAdmin.module.css';
import { useSuperAdminAuth } from './superAdminStore';
import { IconShieldCheck, IconAlertTriangle } from '../AuditorView/icons';

interface SuperAdminAuthProps {
  onAuthenticated: () => void;
}

export default function SuperAdminAuth({ onAuthenticated }: SuperAdminAuthProps) {
  const admin = useSuperAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter both email and password.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const result = admin.signIn(email, password);
      setSubmitting(false);
      if (result.ok === true) onAuthenticated();
      else setError(result.error);
    }, 400);
  }

  function fillDemo() {
    setEmail('karan.mehta@regnix.io');
    setPassword('admin1234');
    setError('');
  }

  return (
    <div className={s.saAuthPage}>
      <div className={s.saAuthCard}>
        <div className={s.saAuthMark}><IconShieldCheck size={20} /></div>
        <h1 className={s.saAuthTitle}>Regnix <strong>Super Admin</strong></h1>
        <p className={s.saAuthSub}>Platform-wide visibility across every client and auditor. Restricted access.</p>

        {error && (
          <div className={s.saAuthError}><IconAlertTriangle size={13} /> {error}</div>
        )}

        <form className={s.saAuthForm} onSubmit={handleSubmit}>
          <div className={s.saField}>
            <label className={s.saLabel}>Admin email</label>
            <input
              className={s.saInput}
              type="email"
              placeholder="you@regnix.io"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className={s.saField}>
            <label className={s.saLabel}>Password</label>
            <input
              className={s.saInput}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button className={s.saSubmit} type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In →'}
          </button>
          <button type="button" className={s.saDemoLink} onClick={fillDemo}>
            Use demo admin credentials
          </button>
        </form>

        <p className={s.saAuthFoot}>
          Every action taken in this console is written to the platform audit log.
        </p>
      </div>
    </div>
  );
}
