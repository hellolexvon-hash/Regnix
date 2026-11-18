import { useMemo, useState } from 'react';
import styles from './Calculator.module.css';
import type { Gender, PayrollRules } from './types';
import { calcSalary } from './engine/salaryEngine';

const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

interface Props { rules: PayrollRules; gender: Gender; month: number; }

export function ManualCalculator({ rules, gender, month }: Props) {
  const [ctcText, setCtcText] = useState('600000');
  const [period, setPeriod] = useState<'annual' | 'monthly'>('annual');
  const [basicPct, setBasicPct] = useState<number | null>(null);   // null → follow the database default
  const [hraPct, setHraPct] = useState<number | null>(null);
  const [pfCeiling, setPfCeiling] = useState(true);
  const [gratuity, setGratuity] = useState(true);
  const [epsMember, setEpsMember] = useState(false);
  const [edliInCtc, setEdliInCtc] = useState(false);

  const basic = basicPct ?? rules.params.basicPct * 100;
  const hra = hraPct ?? rules.params.hraPctOfBasic * 100;
  const ctc = Number(ctcText.replace(/[,₹\s]/g, ''));

  const result = useMemo(() => {
    if (!(ctc > 0)) return { error: 'Enter a CTC greater than zero.' } as const;
    try {
      return { b: calcSalary({ ctc, period, basicPct: basic / 100, hraPctOfBasic: hra / 100, pfOnCeiling: pfCeiling, gratuityInCtc: gratuity, epsMember, edliAdminInCtc: edliInCtc, gender, month, rules }) } as const;
    } catch (e) { return { error: (e as Error).message } as const; }
  }, [ctc, period, basic, hra, pfCeiling, gratuity, epsMember, edliInCtc, gender, month, rules]);

  const b = 'b' in result ? result.b : null;
  const row = (label: string, v: number, note = '') => (
    <tr><td>{label}</td><td>{inr(v)}</td><td className={styles.muted}>{note}</td></tr>
  );

  return (
    <div className={styles.split}>
      <div className={`${styles.card} ${styles.stack}`}>
        <div className={styles.cardTitle}>Inputs</div>
        <div className={styles.field}>
          <label>Cost to company (CTC)</label>
          <div className={styles.inline}>
            <input className={styles.input} inputMode="numeric" value={ctcText} onChange={(e) => setCtcText(e.target.value)} aria-label="CTC" />
          </div>
        </div>
        <div className={styles.seg} role="group" aria-label="CTC period">
          <button className={period === 'annual' ? styles.segOn : ''} onClick={() => setPeriod('annual')}>Per year</button>
          <button className={period === 'monthly' ? styles.segOn : ''} onClick={() => setPeriod('monthly')}>Per month</button>
        </div>
        <div className={styles.inline}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label>Basic % of gross</label>
            <input className={styles.input} type="number" min={1} max={100} value={Number(basic.toFixed(2))} onChange={(e) => setBasicPct(Number(e.target.value))} />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label>HRA % of basic</label>
            <input className={styles.input} type="number" min={0} max={100} value={Number(hra.toFixed(2))} onChange={(e) => setHraPct(Number(e.target.value))} />
          </div>
        </div>
        <label className={styles.check}><input type="checkbox" checked={pfCeiling} onChange={(e) => setPfCeiling(e.target.checked)} />PF on wage ceiling (₹{rules.params.pfWageCeiling.toLocaleString('en-IN')})</label>
        <label className={styles.check}><input type="checkbox" checked={gratuity} onChange={(e) => setGratuity(e.target.checked)} />Include gratuity ({(rules.params.gratuityRate * 100).toFixed(2)}% of basic) in CTC</label>
        <label className={styles.check}><input type="checkbox" checked={epsMember} onChange={(e) => setEpsMember(e.target.checked)} />EPS member even above ceiling (joined when wages ≤ ₹{rules.params.pfWageCeiling.toLocaleString('en-IN')})</label>
        <label className={styles.check}><input type="checkbox" checked={edliInCtc} onChange={(e) => setEdliInCtc(e.target.checked)} />Include EDLI 0.5% + EPF admin 0.5% in CTC</label>
        {(basicPct != null || hraPct != null) && (
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => { setBasicPct(null); setHraPct(null); }}>Reset to {rules.state || 'default'} rule values</button>
        )}
        <div className={styles.empty}>Gross is solved so that gross + employer PF + employer ESIC{gratuity ? ' + gratuity' : ''} equals your CTC.</div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Monthly breakup{rules.state ? ` · ${rules.state}` : ''}</div>
        {'error' in result && <div className={styles.err}>{result.error}</div>}
        {b && (
          <>
            <div className={styles.bigRow}>
              <div className={styles.big}><span>Gross / month</span><strong>{inr(b.gross)}</strong></div>
              <div className={`${styles.big} ${styles.bigAccent}`}><span>Net take-home</span><strong>{inr(b.netPay)}</strong></div>
              <div className={styles.big}><span>Employer cost</span><strong>{inr(b.employerCost)}</strong></div>
            </div>
            <table className={styles.tbl}>
              <thead><tr><th>Component</th><th>Amount</th><th>Basis</th></tr></thead>
              <tbody>
                <tr className={styles.sect}><td colSpan={3}>Earnings</td></tr>
                {row('Basic', b.basic, `${basic.toFixed(1)}% of gross`)}
                {row('HRA', b.hra, `${hra.toFixed(1)}% of basic`)}
                {row('Special allowance', b.special, 'balancing figure')}
                <tr className={styles.total}><td>Gross</td><td>{inr(b.gross)}</td><td /></tr>
                <tr className={styles.sect}><td colSpan={3}>Employee deductions</td></tr>
                {row('PF (employee)', b.pfEmployee, `${+(rules.params.pfEmployeeRate * 100).toFixed(2)}% of PF wage ₹${b.pfWage.toLocaleString('en-IN')}${pfCeiling && b.basic > rules.params.pfWageCeiling ? ` (capped at ₹${rules.params.pfWageCeiling.toLocaleString('en-IN')})` : ''}`)}
                {row('ESIC (employee)', b.esicEmployee, b.esicApplicable ? `${rules.params.esicEmployeeRate * 100}% of gross` : `gross above ₹${rules.params.esicGrossCeiling.toLocaleString('en-IN')} — not applicable`)}
                {row('Professional tax', b.pt, rules.ptSlabs.length ? `${rules.state} slab${month === 2 ? ' (Feb)' : ''}` : 'no slabs loaded')}
                {row('Labour welfare fund', b.lwfEmployee, rules.lwf ? (b.lwfEmployee ? `${rules.lwf.frequency}, deducted this month` : `${rules.lwf.frequency}, not due this month`) : 'no LWF rule for state')}
                <tr className={styles.total}><td>Total deductions</td><td>{inr(b.totalDeductions)}</td><td /></tr>
                <tr className={styles.sect}><td colSpan={3}>Employer contributions</td></tr>
                {row('PF (employer) — total 12%', b.pfEmployer, `12% of PF wage ₹${b.pfWage.toLocaleString('en-IN')}`)}
                {row('  ↳ EPS (pension)', b.epsEmployer, b.epsEmployer ? '8.33% of PF wage' : 'nil — wages above ceiling at joining')}
                {row('  ↳ EPF (A/c 01)', b.epfEmployer, b.epsEmployer ? '12% − EPS (≈3.67%)' : 'full 12%')}
                {row('EDLI', b.edli, `0.5% of PF wage${edliInCtc ? '' : ' · outside CTC'}`)}
                {row('EPF admin charges', b.pfAdmin, `0.5% of PF wage${edliInCtc ? '' : ' · outside CTC'} (min ₹500/establishment)`)}
                {row('ESIC (employer)', b.esicEmployer, b.esicApplicable ? `${rules.params.esicEmployerRate * 100}% of gross` : 'not applicable')}
                {row('LWF (employer)', b.lwfEmployer)}
                {gratuity && row('Gratuity provision', b.gratuity)}
              </tbody>
            </table>
            {b.warnings.map((w) => <div key={w} className={styles.warn} style={{ marginTop: 10 }}>{w}</div>)}
          </>
        )}
      </div>
    </div>
  );
}