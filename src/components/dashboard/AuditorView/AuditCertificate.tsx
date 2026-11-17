/**
 * AuditCertificate.tsx
 *
 * The Regnix Compliance Certificate for a company approved at Level 3. All figures come
 * from buildCertificateData() (real documents / issues / decision). The QR code encodes the
 * public verification URL (/verify/<certificate no>), which is checked against the database.
 *
 * Export: a hidden, fixed-width, un-clipped copy is captured with html2canvas and paginated
 * into an A4 PDF (JPEG, to stay under Vercel's request-body cap). "Download" and "Email" both
 * also store the PDF for the company (their Level 3 page) and in Zoho WorkDrive.
 *
 * Install: npm install html2canvas jspdf qrcode && npm install -D @types/qrcode
 */
import { useEffect, useRef, useState, forwardRef } from 'react';
import QRCode from 'qrcode';
import s from './AuditCertificate.module.css';
import type { Auditor, CompanyReview } from './auditorStore';
import { buildCertificateData, type CertificateData, type RiskLevel } from './certificateData';
import { saveCertificate } from './certificateApi';
import { IconScale, IconCheckCircle, IconShieldCheck, IconAlertTriangle } from './icons';

interface Props { open: boolean; onClose: () => void; company: CompanyReview; auditor: Auditor }

const RISK_CLASS: Record<RiskLevel, string> = { Low: 'acRiskLow', Medium: 'acRiskMed', High: 'acRiskHigh' };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

function Ring({ pct, size = 78, stroke = 7, id }: { pct: number; size?: number; stroke?: number; id: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className={s.acRingWrap} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3aa8ff" /><stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(122,159,255,.14)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (clamp(pct) / 100) * c} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className={s.acRingCenter}><span className={s.acRingPct}>{pct}%</span></div>
    </div>
  );
}

function Stars({ count }: { count: number }) {
  return <span className={s.acStars}>{Array.from({ length: 5 }).map((_, i) => <span key={i} className={i < count ? s.acStarFilled : s.acStarEmpty}>&#9733;</span>)}</span>;
}

const Seal = () => (
  <svg viewBox="0 0 100 100" className={s.acSeal} aria-hidden="true">
    <defs><linearGradient id="acGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#b45309" /></linearGradient></defs>
    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#acGold)" strokeWidth="2.5" />
    <circle cx="50" cy="50" r="38" fill="rgba(251,191,36,.08)" stroke="url(#acGold)" strokeWidth="1" strokeDasharray="2 3" />
    <path d="M50 28 34 35v13c0 10 7 17 16 20 9-3 16-10 16-20V35L50 28z" fill="none" stroke="url(#acGold)" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="m43 49 5 5 9-10" fill="none" stroke="url(#acGold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Sheet = forwardRef<HTMLDivElement, { data: CertificateData; qr: string }>(function Sheet({ data, qr }, ref) {
  const { issues } = data;
  return (
    <div className={s.acSheet} ref={ref}>
      <div className={s.acFrame}>
        <div className={s.acWatermark} aria-hidden="true">REGNIX</div>

        <div className={s.acHeader}>
          <div className={s.acBrand}>
            <span className={s.acBrandMark}><IconScale size={16} /></span>
            <div><p className={s.acBrandName}>REGNIX</p><p className={s.acBrandTag}>Compliance Intelligence. Simplified.</p></div>
          </div>
          <div className={s.acHeaderTitle}>
            <p className={s.acHeaderTitleLine1}>CERTIFICATE OF</p>
            <p className={s.acHeaderTitleLine2}>STATUTORY COMPLIANCE</p>
          </div>
          <div className={s.acHeaderBadges}>
            <Seal />
            <span className={s.acRiskBadge} data-risk={data.riskLevel}>Risk: {data.riskLevel}</span>
          </div>
        </div>

        <p className={s.acCertifies}>This is to certify that the statutory compliance records of</p>
        <p className={s.acClient}>{data.clientName}</p>
        <p className={s.acClientSub}>{data.industry}{data.cin ? ` · CIN/Reg. ${data.cin}` : ''} · {data.employees} employees</p>
        <p className={s.acCertifies}>have been independently reviewed against the live payroll register and the Regnix audit checklist, and approved at Level 3.</p>

        <div className={s.acMetaRow}>
          <div className={s.acMetaItem}><span>Certificate No.</span><strong>{data.certificateNo}</strong></div>
          <div className={s.acMetaItem}><span>Issued on</span><strong>{data.issuedOn}</strong></div>
          <div className={s.acMetaItem}><span>Reporting month</span><strong>{data.reportingMonth}</strong></div>
          <div className={s.acMetaItem}><span>Re-audit due</span><strong>{data.reauditBy}</strong></div>
        </div>

        <div className={s.acHero}>
          <div className={s.acHeroSide}>
            <span className={s.acHeroLabel}>Compliance maturity</span>
            <span className={s.acHeroValue}>{data.complianceMaturity}</span>
            <Stars count={data.maturityStars} />
          </div>
          <div className={s.acHeroCenter}>
            <span className={s.acHeroCenterLabel}>Overall compliance score</span>
            <Ring pct={data.overallScore} size={148} stroke={11} id="acRingMain" />
          </div>
          <div className={s.acHeroSide}>
            <span className={s.acHeroLabel}>Document coverage</span>
            <span className={s.acHeroValue}>{data.regulatoryCoverage}%</span>
            <span className={s.acHeroSub}>Audit readiness {data.auditReadiness}%</span>
          </div>
        </div>

        <div className={s.acStatStrip}>
          <div className={s.acStat}><strong>{data.documentsReviewed}</strong><span>Documents reviewed</span></div>
          <div className={s.acStat}><strong>{data.documentsVerified}</strong><span>Verified clean</span></div>
          <div className={s.acStat}><strong>{data.l2Score}</strong><span>Level 2 score</span></div>
          <div className={s.acStat} data-warn={issues.open > 0}><strong>{issues.open}</strong><span>Open issues</span></div>
          <div className={s.acStat}><strong>{issues.resolved}</strong><span>Resolved in L2</span></div>
        </div>

        <div className={s.acAnalyticsRow}>
          <div className={s.acPanel}>
            <p className={s.acPanelTitle}>Compliance by act</p>
            <table className={s.acMatrixTable}>
              <thead><tr><th>Act</th><th>Docs</th><th>Score</th><th>Open</th><th>Status</th></tr></thead>
              <tbody>
                {data.acts.map(a => (
                  <tr key={a.act}><td>{a.act}</td><td>{a.documents}</td><td>{a.pct}%</td><td>{a.openIssues}</td>
                    <td><span className={s[RISK_CLASS[a.risk]]}>{a.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.acPanel}>
            <p className={s.acPanelTitle}>Issue profile (open)</p>
            <div className={s.acSevList}>
              <div className={s.acSevRow}><span className={s.acRiskHigh}>Critical</span><strong>{issues.critical}</strong></div>
              <div className={s.acSevRow}><span className={s.acRiskMed}>Major</span><strong>{issues.major}</strong></div>
              <div className={s.acSevRow}><span className={s.acRiskLow}>Minor</span><strong>{issues.minor}</strong></div>
            </div>
            <div className={s.acEnterpriseRisk}>Enterprise risk <span className={s[RISK_CLASS[data.riskLevel]]}>{data.riskLevel}</span></div>
          </div>
        </div>

        <div className={s.acPanel}>
          <p className={s.acPanelTitle}>Document scorecard</p>
          <table className={s.acMatrixTable}>
            <thead><tr><th>Document</th><th>Act</th><th>Score</th><th>Open</th><th>Result</th></tr></thead>
            <tbody>
              {data.docs.map(d => (
                <tr key={d.name}><td>{d.name}</td><td>{d.act}</td><td>{d.score}%</td><td>{d.openIssues}</td>
                  <td><span className={d.status === 'validated' ? s.acRiskLow : s.acRiskMed}>{d.status === 'validated' ? 'Verified' : 'Flagged'}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={s.acAnalyticsRow}>
          <div className={s.acPanel}>
            <p className={s.acPanelTitle}>Auditor's assessment</p>
            <p className={s.acIntelNote}>{data.narrative.summary}</p>
            <ul className={s.acIntelList}>{data.narrative.achievements.map((t, i) => <li key={i}><IconCheckCircle size={11} /> {t}</li>)}</ul>
            {data.remarks && <p className={s.acRemarks}>“{data.remarks}”</p>}
          </div>
          <div className={s.acPanel}>
            <p className={s.acPanelTitle}>Focus areas &amp; next steps</p>
            <ul className={s.acIntelList}>
              {data.narrative.focusAreas.map((t, i) => <li key={`f${i}`}><IconAlertTriangle size={11} /> {t}</li>)}
              {data.narrative.actions.map((t, i) => <li key={`a${i}`}><IconShieldCheck size={11} /> {t}</li>)}
            </ul>
          </div>
        </div>

        <div className={s.acTrustRow}>
          <div className={s.acTrustLeft}>
            <p className={s.acPanelTitle}>Verification &amp; signatures</p>
            <div className={s.acSignatures}>
              <div className={s.acSigBlock}>
                <p className={s.acSigName}>{data.auditor.name}</p>
                <p className={s.acSigRole}>Independent Auditor · Licence {data.auditor.licenseId}</p>
                <p className={s.acSigMeta}>{data.auditor.specialization} · Signed {data.issuedOn}</p>
              </div>
              <div className={s.acSigBlock}>
                <p className={s.acSigName}>{data.contactPerson || data.clientName}</p>
                <p className={s.acSigRole}>Company point of contact</p>
                <p className={s.acSigMeta}>{data.clientName}</p>
              </div>
              <div className={s.acSigBlock}>
                <p className={s.acSigName}>Regnix Platform</p>
                <p className={s.acSigRole}>Verification registry</p>
                <p className={s.acSigMeta}>Cert. {data.certificateNo}</p>
              </div>
            </div>
          </div>
          <div className={s.acTrustRight}>
            {qr ? <img className={s.acQrImg} src={qr} alt="Verification QR code" /> : <div className={s.acQrImg} />}
            <span className={s.acQrLabel}>Scan to verify</span>
            <span className={s.acQrUrl}>{data.verifyUrl.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>

        <div className={s.acFooterBadges}>
          <span>CONFIDENTIAL</span><span>INDEPENDENTLY AUDITED</span>
          <span className={s.acFooterBadgeMain}><IconCheckCircle size={12} /> VERIFIABLE ONLINE</span>
          <span>REGNIX COMPLIANCE</span>
        </div>
      </div>
    </div>
  );
});

type Notice = { kind: 'ok' | 'err'; text: string } | null;

export default function AuditCertificate({ open, onClose, company, auditor }: Props) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'' | 'pdf' | 'email'>('');
  const [notice, setNotice] = useState<Notice>(null);
  const [qr, setQr] = useState('');

  const data = buildCertificateData(company, auditor);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    QRCode.toDataURL(data.verifyUrl, { margin: 1, width: 240, color: { dark: '#04070d', light: '#ffffff' } })
      .then(u => { if (alive) setQr(u); }).catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [open, data.verifyUrl]);

  if (!open) return null;

  async function renderPdf() {
    if (!exportRef.current) return null;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const node = exportRef.current;
    const canvas = await html2canvas(node, {
      scale: 2, backgroundColor: '#060a12', useCORS: true, logging: false,
      width: node.scrollWidth, height: node.scrollHeight, windowWidth: node.scrollWidth, windowHeight: node.scrollHeight,
    });
    const img = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const ih = (canvas.height * pw) / canvas.width;
    let left = ih, pos = 0;
    pdf.addImage(img, 'JPEG', 0, pos, pw, ih);
    left -= ph;
    while (left > 0) { pos -= ph; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, pos, pw, ih); left -= ph; }
    return { pdf, base64: pdf.output('datauristring').split(',')[1] };
  }

  const snapshot = {
    certificateNo: data.certificateNo, overallScore: data.overallScore, complianceMaturity: data.complianceMaturity,
    regulatoryCoverage: data.regulatoryCoverage, riskLevel: data.riskLevel, issues: data.issues, acts: data.acts,
    auditor: data.auditor, issuedOn: data.issuedOn,
  };

  async function run(kind: 'pdf' | 'email') {
    setBusy(kind); setNotice(null);
    try {
      const out = await renderPdf();
      if (!out) throw new Error('render');
      if (kind === 'pdf') out.pdf.save(`${data.certificateNo}_${company.name.replace(/\s+/g, '_')}.pdf`);
      const r = await saveCertificate({ companyId: company.id, pdfBase64: out.base64, sendEmail: kind === 'email', snapshot });
      if (!r.ok) setNotice({ kind: 'err', text: r.error ?? 'Could not save the certificate.' });
      else if (kind === 'email' && r.emailed === false) setNotice({ kind: 'err', text: 'Saved for the company, but email is not configured or the contact has no email.' });
      else setNotice({ kind: 'ok', text: kind === 'email' ? `Emailed to ${company.contactEmail} and saved to the company's portal.` : 'Downloaded and saved to the company\'s portal.' });
    } catch {
      setNotice({ kind: 'err', text: 'Something went wrong while preparing the certificate.' });
    } finally { setBusy(''); }
  }

  return (
    <div className={s.acOverlay} role="dialog" aria-modal="true">
      <div className={s.acToolbar}>
        {notice && (notice.kind === 'ok'
          ? <span className={s.acSendStatusOk}><IconCheckCircle size={13} /> {notice.text}</span>
          : <span className={s.acSendStatusErr}><IconAlertTriangle size={13} /> {notice.text}</span>)}
        <button className={s.acCloseBtn} onClick={onClose}>Close</button>
        <button className={s.acEmailBtn} onClick={() => { void run('email'); }} disabled={busy !== '' || !company.contactEmail}>
          {busy === 'email' ? 'Sending…' : `Email to ${(company.contactPerson || 'company').split(' ')[0]}`}
        </button>
        <button className={s.acDownloadBtn} onClick={() => { void run('pdf'); }} disabled={busy !== ''}>
          {busy === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
        </button>
      </div>
      <div className={s.acScroll}><Sheet data={data} qr={qr} /></div>
      <div className={s.acExportHost} aria-hidden="true"><Sheet data={data} qr={qr} ref={exportRef} /></div>
    </div>
  );
}
