/**
 * src/pages/auth/LoginPage.tsx
 *
 * Supabase-backed login.
 * Unchanged visual design — only auth wired to real Supabase.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getAccessState, gateFor, gateMessage, signOutQuietly } from './approval';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  // Once signed in the user must be (1) approved by an admin and (2) KYC-verified.
  //   pending        -> "application in review" page (session kept)
  //   approved w/o KYC -> "complete your KYC" page   (session kept)
  //   rejected       -> signed out with a message
  useEffect(() => {
    if (loading || !isAuthenticated || busy) return;
    let cancelled = false;
    (async () => {
      const gate = gateFor(await getAccessState());
      if (cancelled) return;
      if (gate === 'ok')           navigate('/dashboard', { replace: true });
      else if (gate === 'pending') navigate('/pending', { replace: true });
      else if (gate === 'kyc')     navigate('/pending?stage=kyc', { replace: true });
      else {
        await signOutQuietly();
        if (!cancelled) setError(gateMessage(gate));
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, loading, busy, navigate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // The approval check + redirect happens in the effect above.
      await login(email.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      // Supabase returns "Invalid login credentials" — surface it plainly
      setError(msg.includes('Invalid') ? 'Invalid email or password. Please try again.' : msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null; // prevent flash before auth resolves

  return (
    <div className={styles.page}>
      {/* ── Left panel ── */}
      <div className={styles.left}>
        <div className={styles.leftPattern} aria-hidden />
        <div className={styles.leftGlow}    aria-hidden />
        <div className={styles.leftGlow2}   aria-hidden />

        <Link to="/" className={styles.logoLink}>
          <span className={styles.logoMark}>
            <img src="/regnix-markw.png" alt="Regnix logo" className={styles.logoImg} />
          </span>
          <span className={styles.logoName}>Regnix</span>
          <span className={styles.logoDot}>·</span>
          <span className={styles.logoSub}>by Lexvon</span>
        </Link>

        <div className={styles.leftContent}>
          <p className={styles.leftEyebrow}>Welcome back</p>
          <h2 className={styles.leftTitle}>
            Your compliance command<br />
            <span className={styles.leftTitleItalic}>centre awaits</span>
          </h2>
          <p className={styles.leftSub}>
            Sign in to continue managing your compliance, audit, legal, and HR
            operations in one unified workspace.
          </p>
          <div className={styles.leftPoints}>
            {[
              'Real-time compliance score',
              'Open audit & legal notices',
              'Pending deadlines & tasks',
              'AI-powered recommendations',
              'Team workflow updates',
            ].map((p) => (
              <div key={p} className={styles.leftPoint}>
                <span className={styles.pointCheck}>✓</span>
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className={styles.right}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h1 className={styles.formTitle}>Sign in to Regnix</h1>
            <p className={styles.formSub}>
              No account yet?{' '}
              <Link to="/signup" className={styles.formLink}>Create one free</Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <Input
              label="Work Email"
              type="email"
              placeholder="rahul@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <div className={styles.forgotRow}>
              <a href="#" className={styles.forgot}>Forgot password?</a>
            </div>

            {error && <p className={styles.errorMsg} role="alert">{error}</p>}

            <Button type="submit" variant="primary" size="lg" loading={busy}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}