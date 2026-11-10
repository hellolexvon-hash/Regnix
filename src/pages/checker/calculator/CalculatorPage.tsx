import { useEffect, useState } from 'react';
import styles from './Calculator.module.css';
import type { Gender, PayrollRules } from './types';
import { builtinRules, RULE_STATES } from './rules/defaultRules';
import { loadRules } from './rules/rulesRepo';
import { ManualCalculator } from './ManualCalculator';
import { AiCalculator } from './AiCalculator';

const INDUSTRIES = ['Manufacturing', 'IT / Software', 'Banking & Finance', 'Healthcare', 'Retail', 'Construction', 'Education', 'Hospitality', 'Logistics', 'Real Estate', 'Media & Entertainment', 'Contract Labour / Staffing', 'Other'];
const STATES = Array.from(new Set(['Assam', 'Delhi', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala', 'Maharashtra', 'Meghalaya', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'West Bengal', 'Andhra Pradesh', ...RULE_STATES])).sort();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CalculatorPage() {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [state, setState] = useState('Maharashtra');
  const [industry, setIndustry] = useState('Manufacturing');
  const [gender, setGender] = useState<Gender>('any');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rules, setRules] = useState<PayrollRules>(() => builtinRules('Maharashtra', 'Manufacturing'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadRules(state, industry).then((r) => { if (live) { setRules(r); setLoading(false); } });
    return () => { live = false; };
  }, [state, industry]);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Applicability Checker</div>
          <div className={styles.title}>Payroll <em>Calculator</em></div>
          <div className={styles.sub}>Break a CTC into Basic, HRA, PF, ESIC, LWF and PT using your state’s rules — or upload a register and let Regnix spot rows and columns that break the pattern.</div>
        </div>
        <div className={styles.modes} role="tablist">
          <button role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? styles.modeOn : ''} onClick={() => setMode('manual')}>Manual calculator</button>
          <button role="tab" aria-selected={mode === 'ai'} className={mode === 'ai' ? styles.modeOn : ''} onClick={() => setMode('ai')}>AI pattern check</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span>Applicable rules</span>
          <span className={`${styles.badge} ${rules.source === 'database' && rules.verified ? styles.badgeOk : styles.badgeWarn}`}>
            {loading ? 'Loading rules…' : rules.source === 'database' ? (rules.verified ? 'Database · verified' : 'Database · partly unverified') : 'Built-in starter data'}
          </span>
        </div>
        <div className={styles.ctx}>
          <div className={styles.field}><label>State</label>
            <select className={styles.select} value={state} onChange={(e) => setState(e.target.value)}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className={styles.field}><label>Industry</label>
            <select className={styles.select} value={industry} onChange={(e) => setIndustry(e.target.value)}>{INDUSTRIES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className={styles.field}><label>Employee gender (for PT)</label>
            <select className={styles.select} value={gender} onChange={(e) => setGender(e.target.value as Gender)}><option value="any">Any / not specified</option><option value="M">Male</option><option value="F">Female</option></select></div>
          <div className={styles.field}><label>Pay month (PT Feb / LWF)</label>
            <select className={styles.select} value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
        </div>
        {rules.notes.length > 0 && <ul className={styles.notes}>{rules.notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
      </div>

      {mode === 'manual' ? <ManualCalculator rules={rules} gender={gender} month={month} /> : <AiCalculator rules={rules} gender={gender} month={month} />}
    </div>
  );
}
