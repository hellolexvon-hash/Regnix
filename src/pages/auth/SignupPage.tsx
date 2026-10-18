/**
 * src/pages/auth/SignupPage.tsx
 *
 * Supabase-backed signup.
 * All form data (account_type, full_name, company_name, industry, gstin,
 * firm_name) is written to the `profiles` table via the DB trigger on
 * auth.users insert.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AccountType, SignupFormData } from '@/hooks/useAuth';
import { getApprovalStatus, signOutQuietly } from './approval';
import styles from './AuthPage.module.css';

const INDUSTRIES = [
  'Manufacturing', 'IT / Software', 'BFSI', 'Healthcare',
  'Retail', 'Logistics', 'Construction', 'Education', 'Hospitality', 'Other',
];

const INITIAL_FORM = {
  name: '', email: '', password: '', confirmPassword: '',
  companyName: '', industry: '', gstin: '',
};

export default function SignupPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { signup, isAuthenticated, loading } = useAuth();

  const [accountType, setAccountType] = useState<AccountType>(
    (params.get('type') as AccountType) || 'company',
  );
  const [form,  setForm]  = useState(INITIAL_FORM);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');
  const [done,  setDone]  = useState(false); // email confirmation pending

  useEffect(() => {
    // Don't redirect while submitting or while the "in review" screen is showing,
    // and only send already-signed-in users on if an admin has approved them.
    if (loading || !isAuthenticated || done || busy) return;
    let cancelled = false;
    (async () => {
      const status = await getApprovalStatus();
      if (!cancelled && status === 'approved') navigate('/dashboard', { replace: true });
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, loading, done, busy, navigate]);

  const set = (k: keyof typeof INITIAL_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const validate = (): string => {
    if (!form.name.trim())  return 'Full name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address.';
    if (accountType === 'company' && !form.companyName.trim()) return 'Company name is required.';
    if (accountType === 'company' && !form.industry) return 'Please select an industry.';
    if (!form.password) return 'Password is required.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError('');
    setBusy(true);
    try {
      await signup({
        accountType,
        name:            form.name.trim(),
        email:           form.email.trim(),
        password:        form.password,
        confirmPassword: form.confirmPassword,
        companyName:     form.companyName.trim(),
        industry:        form.industry,
        gstin:           form.gstin.trim(),
      } as SignupFormData);
      // The new profile starts as approval_status = 'pending' (DB default) and
      // the super admin is notified by a DB trigger. If Supabase auto-signed
      // the user in (email confirmation OFF), sign them out: the account only
      // becomes usable after an admin approves it.
      await signOutQuietly();
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  // ── Email confirmation pending screen ─────────────────────────────────────
  if (done) {
    return (
      <div className={styles.page}>
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
        </div>
        <div className={styles.right}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h1 className={styles.formTitle}>Your application is in review ⏳</h1>
              <p className={styles.formSub}>
                Thanks for signing up, {form.name.trim().split(' ')[0]}. Your application
                is in review and we will get back to you shortly
                {form.email ? <> at <strong>{form.email}</strong></> : null}.
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={() => navigate('/login', { replace: true })}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
          <p className={styles.leftEyebrow}>Join 200+ Indian enterprises</p>
          <h2 className={styles.leftTitle}>
            India's most intelligent<br />
            <span className={styles.leftTitleItalic}>compliance platform</span>
          </h2>
          <p className={styles.leftSub}>
            Compliance, audit, legal, payroll, and HR operations — unified
            in one intelligent workspace.
          </p>
          <div className={styles.leftPoints}>
            {[
              'AI-powered compliance engine',
              'Legal document analysis & drafting',
              'Audit planning & continuous monitoring',
              'Payroll & statutory filing automation',
              'Vendor & employee lifecycle tracking',
            ].map(p => (
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
            <h1 className={styles.formTitle}>Create your account</h1>
            <p className={styles.formSub}>
              Already have an account?{' '}
              <Link to="/login" className={styles.formLink}>Sign in</Link>
            </p>
          </div>

          {/* Account type toggle */}
          <div className={styles.typeToggle} data-active={accountType}>
            <span className={styles.typeToggleThumb} aria-hidden />
            <button
              className={`${styles.typeBtn} ${accountType === 'company' ? styles.typeActive : ''}`}
              onClick={() => setAccountType('company')}
              type="button"
              aria-pressed={accountType === 'company'}
            >
              🏢 Company
            </button>
            <button
              className={`${styles.typeBtn} ${accountType === 'client' ? styles.typeActive : ''}`}
              onClick={() => setAccountType('client')}
              type="button"
              aria-pressed={accountType === 'client'}
            >
              👤 Client / Consultant
            </button>
          </div>
          <p className={styles.typeHint}>
            {accountType === 'company'
              ? 'For enterprises & organizations managing their own compliance.'
              : 'For consultants & advisors managing compliance for multiple clients.'}
          </p>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {/* ── Personal info ── */}
            <Input
              label="Full Name"
              placeholder="Rahul Sharma"
              value={form.name}
              onChange={set('name')}
              required
              autoFocus
              autoComplete="name"
            />
            <Input
              label="Work Email"
              type="email"
              placeholder="rahul@company.com"
              value={form.email}
              onChange={set('email')}
              required
              autoComplete="email"
            />

            {/* ── Account-type specific fields ── */}
            <div key={accountType} className={styles.fieldGroup}>
              {accountType === 'company' && (
                <>
                  <Input
                    label="Company Name"
                    placeholder="Acme Pvt. Ltd."
                    value={form.companyName}
                    onChange={set('companyName')}
                    required
                  />
                  <div className={styles.row}>
                    <div className={styles.fieldWrap}>
                      <label className={styles.fieldLabel}>Industry</label>
                      <select
                        className={styles.select}
                        value={form.industry}
                        onChange={set('industry')}
                        required
                      >
                        <option value="">Select industry</option>
                        {INDUSTRIES.map(i => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="GSTIN (optional)"
                      placeholder="22AAAAA0000A1Z5"
                      value={form.gstin}
                      onChange={set('gstin')}
                    />
                  </div>
                </>
              )}
              {accountType === 'client' && (
                <Input
                  label="Firm / Practice Name"
                  placeholder="Your consulting firm"
                  value={form.companyName}
                  onChange={set('companyName')}
                />
              )}
            </div>

            {/* ── Password ── */}
            <div className={styles.row}>
              <Input
                label="Password"
                type="password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={set('password')}
                required
                autoComplete="new-password"
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                required
                autoComplete="new-password"
              />
            </div>

            {error && <p className={styles.errorMsg} role="alert">{error}</p>}

            <Button type="submit" variant="primary" size="lg" loading={busy}>
              {accountType === 'company' ? 'Create Company Account' : 'Create Client Account'}
            </Button>

            <p className={styles.terms}>
              By signing up you agree to Lexvon's{' '}
              <a href="#">Terms of Service</a> and{' '}
              <a href="#">Privacy Policy</a>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}