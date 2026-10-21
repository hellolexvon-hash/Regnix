/**
 * src/pages/pricing/PricingPage.tsx
 *
 * "Get started" lands here. The visitor picks a plan by team size and goes on
 * to /signup?plan=<id>. The plan then travels with the application: it is shown
 * on the signup form, stored on the profile and shown to the admin.
 */

import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PLANS, formatINR, headcountLabel } from '@/lib/plans';
import styles from './PricingPage.module.css';

export default function PricingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const type = params.get('type'); // 'company' | 'client' from the landing page buttons
  const typeQs = type === 'company' || type === 'client' ? `&type=${type}` : '';

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.glow2} aria-hidden />

      <header className={styles.nav}>
        <Link to="/" className={styles.logo}>
          <img src="/regnix-markw.png" alt="" className={styles.logoImg} />
          <span>Regnix</span>
        </Link>
        <Link to="/login" className={styles.navLink}>Sign in</Link>
      </header>

      <main className={styles.main}>
        <span className={styles.badge}>Plans priced by team size</span>
        <h1 className={styles.title}>
          Compliance that scales
          <span className={styles.gradient}> with your headcount</span>
        </h1>
        <p className={styles.sub}>
          Pick the plan that matches your number of employees. Your application is reviewed by our
          team, then a quick KYC &amp; first payment activates your workspace.
        </p>

        <div className={styles.grid}>
          {PLANS.map((p) => (
            <article key={p.id} className={`${styles.card} ${p.popular ? styles.cardPopular : ''}`}>
              {p.popular && <span className={styles.popularTag}>Most popular</span>}
              <h2 className={styles.planName}>{p.name}</h2>
              <p className={styles.planFor}>{p.tagline}</p>

              <div className={styles.priceRow}>
                <span className={styles.price}>{formatINR(p.monthlyPrice)}</span>
                <span className={styles.per}>/month</span>
              </div>
              <div className={styles.headcount}>{headcountLabel(p)}</div>

              <ul className={styles.features}>
                {p.features.map((f) => (
                  <li key={f}><span className={styles.tick}>✓</span>{f}</li>
                ))}
              </ul>

              <button
                className={`${styles.cta} ${p.popular ? styles.ctaPrimary : ''}`}
                onClick={() => navigate(`/signup?plan=${p.id}${typeQs}`)}
              >
                Choose {p.name}
              </button>
            </article>
          ))}
        </div>

        <p className={styles.foot}>
          Prices in INR, billed monthly. Need more than 250 employees?{' '}
          <a href="mailto:support@regnix.io" className={styles.footLink}>Talk to us</a>.
        </p>
      </main>
    </div>
  );
}
