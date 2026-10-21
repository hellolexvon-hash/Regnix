/**
 * src/pages/auth/PendingApprovalPage.tsx   (route: /pending)
 *
 * Where a signed-in user waits until they may enter the dashboard:
 *   stage "review" -> application awaiting admin approval
 *   stage "kyc"    -> approved; complete KYC (documents + payment) via the emailed link
 * Polls every 15s and forwards to /dashboard as soon as the user is fully cleared.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { getPlan, formatINR, headcountLabel } from '@/lib/plans';
import { getAccessState, gateFor, signOutQuietly, type AccessState } from './approval';
import styles from './AuthPage.module.css';
import p from './PendingApprovalPage.module.css';

interface KycInfo { token: string | null; submitted: boolean; status: string }

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<AccessState | null>(null);
  const [kyc, setKyc] = useState<KycInfo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      const s = await getAccessState();
      if (!alive) return;
      const gate = gateFor(s);
      if (gate === 'ok') { navigate('/dashboard', { replace: true }); return; }
      if (gate === 'rejected' || gate === 'unknown') {
        if (gate === 'rejected') await signOutQuietly();
        navigate('/login', { replace: true });
        return;
      }
      setState(s);

      if (gate === 'kyc') {
        // RLS lets a user read their own request; if it is not readable we just show the generic message.
        const { data } = await supabase
          .from('kyc_requests')
          .select('upload_token, submitted_at, status')
          .eq('status', 'requested')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (alive && data) {
          setKyc({
            token: (data.upload_token as string | null) ?? null,
            submitted: !!data.submitted_at,
            status: data.status as string,
          });
        }
      }
      if (alive) setReady(true);
    }

    void check();
    const t = setInterval(() => { void check(); }, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [navigate]);

  async function logout() {
    await signOutQuietly();
    navigate('/login', { replace: true });
  }

  if (!ready || !state) return null;

  const plan = getPlan(state.plan);
  const kycStage = state.approval === 'approved';

  const steps = [
    { label: 'Application submitted', done: true },
    { label: 'Admin approval', done: kycStage, active: !kycStage },
    { label: 'KYC & payment', done: false, active: kycStage && !kyc?.submitted },
    { label: 'KYC verification', done: false, active: kycStage && !!kyc?.submitted },
    { label: 'Workspace access', done: false },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.leftPattern} aria-hidden />
        <div className={styles.leftGlow} aria-hidden />
        <div className={styles.leftGlow2} aria-hidden />
        <Link to="/" className={styles.logoLink}>
          <span className={styles.logoMark}><img src="/regnix-markw.png" alt="Regnix logo" className={styles.logoImg} /></span>
          <span className={styles.logoName}>Regnix</span>
          <span className={styles.logoDot}>·</span>
          <span className={styles.logoSub}>by Lexvon</span>
        </Link>
        <div className={styles.leftContent}>
          <p className={styles.leftEyebrow}>{kycStage ? 'Almost there' : 'Application received'}</p>
          <h2 className={styles.leftTitle}>
            {kycStage ? 'One last step —' : 'We are reviewing'}<br />
            <span className={styles.leftTitleItalic}>{kycStage ? 'verify your company' : 'your application'}</span>
          </h2>
          <ol className={p.steps}>
            {steps.map((s) => (
              <li key={s.label} className={`${p.step} ${s.done ? p.stepDone : ''} ${s.active ? p.stepActive : ''}`}>
                <span className={p.stepDot}>{s.done ? '✓' : ''}</span>{s.label}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.formCard}>
          <div className={p.statusIcon} data-kyc={kycStage}>{kycStage ? '📄' : '⏳'}</div>

          {!kycStage ? (
            <>
              <h1 className={styles.formTitle}>Approval pending</h1>
              <p className={styles.formSub}>
                Your application is with our team. You cannot use the workspace until an admin approves
                it. We will email you the moment that happens — usually within one business day.
              </p>
            </>
          ) : (
            <>
              <h1 className={styles.formTitle}>Application approved 🎉</h1>
              <p className={styles.formSub}>
                {kyc?.submitted
                  ? 'We received your documents and payment details. Our team is verifying them and will email you as soon as you can sign in.'
                  : kyc
                    ? 'Upload your company documents and complete the payment to finish KYC. You will be able to sign in once it is verified.'
                    : 'We will email you a secure link to upload your KYC documents and complete the payment. Check your inbox.'}
              </p>
            </>
          )}

          {plan && (
            <div className={p.planCard}>
              <div>
                <span className={p.planLabel}>Your plan</span>
                <strong className={p.planName}>{plan.name}</strong>
                <span className={p.planMeta}>{headcountLabel(plan)}</span>
              </div>
              <div className={p.planPrice}>{formatINR(plan.monthlyPrice)}<small>/month</small></div>
            </div>
          )}

          <div className={p.actions}>
            {kycStage && kyc?.token && !kyc.submitted && (
              <button className={p.primary} onClick={() => navigate(`/kyc-upload/${kyc.token}`)}>
                Upload documents &amp; pay →
              </button>
            )}
            <button className={p.secondary} onClick={() => { void logout(); }}>Sign out</button>
          </div>

          <p className={styles.terms}>This page refreshes automatically. Questions? support@regnix.io</p>
        </div>
      </div>
    </div>
  );
}
