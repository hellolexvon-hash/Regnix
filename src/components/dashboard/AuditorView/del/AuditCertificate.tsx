/**
 * AuditCertificate.tsx
 *
 * Renders the Regnix Compliance Intelligence Certificate for a company that
 * has been approved at Level 3. Every number on this certificate comes from
 * `buildCertificateData(company, auditor)` in certificateData.ts — nothing
 * here is hardcoded per company.
 *
 * Usage (from AuditorCompanyReview.tsx, once company.status === 'approved'):
 *
 *   <AuditCertificate open={showCertificate} onClose={...} company={company} auditor={auditor} />
 *
 * ── Export architecture ─────────────────────────────────────────────────
 * The certificate is rendered TWICE while the modal is open:
 *   1. A visible, scrollable copy the auditor actually looks at.
 *   2. A hidden, fixed-width, un-clipped copy used ONLY for html2canvas
 *      capture (position: fixed; left: -10000px — laid out in the document,
 *      just off-screen, so it is never scroll-clipped or viewport-clipped).
 * html2canvas by default only captures what fits in the current viewport
 * unless you feed it an element with its own real scrollWidth/scrollHeight
 * outside of any overflow:auto ancestor — capturing the visible modal
 * directly (which lives inside a scrollable container) truncates the
 * output. The hidden copy sidesteps that entirely.
 *
 * Install: npm install html2canvas jspdf
 */

import { useRef, useState, forwardRef } from 'react';
import s from './AuditCertificate.module.css';
import type { Auditor, CompanyReview } from './auditorStore';
import { buildCertificateData, type CertificateData, type RiskLevel } from './certificateData';
import { sendCertificateEmail } from './certificateEmailService';
import {
  IconScale, IconCheckCircle, IconShieldCheck, IconAlertTriangle,
} from './icons';

interface AuditCertificateProps {
  open: boolean;
  onClose: () => void;
  company: CompanyReview;
  auditor: Auditor;
}

const RISK_CLASS: Record<RiskLevel, string> = {
  Low: 'acRiskLow', Medium: 'acRiskMed', High: 'acRiskHigh',
};

function clamp01(n: number) { return Math.max(0, Math.min(100, n)); }

function Ring({ pct, size = 78, stroke = 7, label }: { pct: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamp01(pct) / 100) * c;
  return (
    <div className={s.acRingWrap} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(122,159,255,.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#acRingGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id="acRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3aa8ff" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
      </svg>
      <div className={s.acRingCenter}>
        <span className={s.acRingPct}>{pct}%</span>
        {label && <span className={s.acRingLabel}>{label}</span>}
      </div>
    </div>
  );
}

function TrendArrow({ dir }: { dir: 'up' | 'down' | 'flat' }) {
  if (dir === 'up') return <span className={s.acTrendUp}>&#9650;</span>;
  if (dir === 'down') return <span className={s.acTrendDown}>&#9660;</span>;
  return <span className={s.acTrendFlat}>&#9679;</span>;
}

function Stars({ count }: { count: number }) {
  return (
    <span className={s.acStars}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < count ? s.acStarFilled : s.acStarEmpty}>&#9733;</span>
      ))}
    </span>
  );
}

function TrendChart({ points }: { points: { label: string; score: number }[] }) {
  const w = 300, h = 110, pad = 10;
  const min = Math.min(...points.map(p => p.score)) - 3;
  const max = Math.max(...points.map(p => p.score)) + 3;
  const xStep = (w - pad * 2) / (points.length - 1);
  const yFor = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const coords = points.map((p, i) => [pad + i * xStep, yFor(p.score)] as const);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0]},${h - pad} L${coords[0][0]},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={s.acTrendSvg}>
      <defs>
        <linearGradient id="acAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ef9ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7ef9ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#acAreaGrad)" stroke="none" />
      <path d={linePath} fill="none" stroke="#7ef9ff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 3.2 : 1.8}
          fill={i === coords.length - 1 ? '#ffffff' : '#7ef9ff'} />
      ))}
    </svg>
  );
}

/** Deterministic decorative QR-style placeholder — see file header note in certificateData.ts. */
function QrPlaceholder({ seed }: { seed: string }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const size = 9;
  const cells: boolean[] = Array.from({ length: size * size }, () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return (h % 100) < 46;
  });
  return (
    <div className={s.acQr} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {cells.map((on, i) => <div key={i} className={on ? s.acQrCellOn : s.acQrCellOff} />)}
    </div>
  );
}

/** The full certificate markup, rendered identically for on-screen viewing and off-screen export. */
const CertificateSheet = forwardRef<HTMLDivElement, { data: CertificateData }>(function CertificateSheet(
  { data }, ref,
) {
  return (
    <div className={s.acSheet} ref={ref}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={s.acHeader}>
        <div className={s.acBrand}>
          <span className={s.acBrandMark}><IconScale size={16} /></span>
          <div>
            <p className={s.acBrandName}>REGNIX</p>
            <p className={s.acBrandTag}>Compliance Intelligence. Simplified.</p>
          </div>
        </div>
        <div className={s.acHeaderTitle}>
          <p className={s.acHeaderTitleLine1}>REGNIX COMPLIANCE</p>
          <p className={s.acHeaderTitleLine2}>INTELLIGENCE CERTIFICATE</p>
        </div>
        <div className={s.acHeaderBadges}>
          <span className={s.acCompliantBadge}><IconCheckCircle size={13} /> COMPLIANT</span>
          <span className={s.acRiskBadge} data-risk={data.riskLevel}>Risk: {data.riskLevel}</span>
        </div>
      </div>

      {/* ── Meta strip ─────────────────────────────────────────────── */}
      <div className={s.acMetaRow}>
        <div className={s.acMetaItem}><span>Reporting Month</span><strong>{data.reportingMonth}</strong></div>
        <div className={s.acMetaItem}><span>Certificate No.</span><strong>{data.certificateId}</strong></div>
        <div className={s.acMetaItem}><span>Client Name</span><strong>{data.clientName}</strong></div>
        <div className={s.acMetaItem}><span>Industry</span><strong>{data.entityLocation}</strong></div>
        <div className={s.acMetaItem}><span>Generated On</span><strong>{data.generatedOn}</strong></div>
      </div>

      {/* ── Hero: maturity / score / coverage ─────────────────────── */}
      <div className={s.acHero}>
        <div className={s.acHeroSide}>
          <span className={s.acHeroLabel}>Compliance Maturity</span>
          <span className={s.acHeroValue}>{data.complianceMaturity}</span>
          <Stars count={data.maturityStars} />
        </div>

        <div className={s.acHeroCenter}>
          <span className={s.acHeroCenterLabel}>Overall Compliance Score</span>
          <Ring pct={data.overallScore} size={148} stroke={11} />
        </div>

        <div className={s.acHeroSide}>
          <span className={s.acHeroLabel}>Regulatory Coverage</span>
          <span className={s.acHeroValue}>{data.regulatoryCoverage}%</span>
          <span className={s.acHeroSub}>Audit Readiness {data.auditReadiness}%</span>
        </div>
      </div>

      {/* ── Per-act ring grid ──────────────────────────────────────── */}
      <div className={s.acActGrid}>
        {data.acts.map(a => (
          <div className={s.acActCard} key={a.act}>
            <Ring pct={a.pct} size={62} stroke={6} />
            <div className={s.acActMeta}>
              <span className={s.acActName}>{a.act}</span>
              <span className={s.acActTrend}><TrendArrow dir={a.trend} /> Trend</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Stat strip ─────────────────────────────────────────────── */}
      <div className={s.acStatStrip}>
        <div className={s.acStat}><strong>{data.totalApplicableCompliances}</strong><span>Applicable compliances</span></div>
        <div className={s.acStat}><strong>{data.compliancesMet}</strong><span>Compliances met</span></div>
        <div className={s.acStat} data-warn={data.openDeviations > 0}><strong>{data.openDeviations}</strong><span>Open deviations</span></div>
        <div className={s.acStat}><strong>{data.documentsVerified}</strong><span>Documents verified</span></div>
        <div className={s.acStat}><strong>{data.employeesCovered}</strong><span>Employees covered</span></div>
        <div className={s.acStat}><strong>{data.suppliersAssessed}</strong><span>Suppliers assessed</span></div>
        <div className={s.acStat}><strong>{data.regulatoryCoveragePct}%</strong><span>Regulatory coverage</span></div>
        <div className={s.acStat}><strong>{data.complianceMaturityIndex}/10</strong><span>Maturity index</span></div>
        <div className={s.acStat}><strong>{data.auditIndexPct}%</strong><span>Audit index</span></div>
        <div className={s.acStat}><strong>{data.aiConfidenceScore}%</strong><span>AI confidence score</span></div>
      </div>

      {/* ── Analytics row: matrix / trend / forecast ──────────────── */}
      <div className={s.acAnalyticsRow}>
        <div className={s.acPanel}>
          <p className={s.acPanelTitle}>Statutory Compliance Coverage Matrix</p>
          <table className={s.acMatrixTable}>
            <thead>
              <tr><th>Act</th><th>Applicable</th><th>Compliant</th><th>Pending</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.matrix.map(row => (
                <tr key={row.act}>
                  <td>{row.act}</td>
                  <td>Yes</td>
                  <td>{row.compliant ? 'Yes' : 'Partial'}</td>
                  <td>{row.pending}</td>
                  <td><span className={s[RISK_CLASS[row.risk]]}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={s.acPanel}>
          <p className={s.acPanelTitle}>12-Month Compliance Trend</p>
          <TrendChart points={data.trend} />
          <div className={s.acTrendFoot}>
            <span>Change vs prior month <strong className={data.trendDeltaVsPrior >= 0 ? s.acPos : s.acNeg}>
              {data.trendDeltaVsPrior >= 0 ? '+' : ''}{data.trendDeltaVsPrior}%
            </strong></span>
            <span>Best month <strong>{data.bestMonth.label} ({data.bestMonth.score}%)</strong></span>
          </div>
        </div>

        <div className={s.acPanel}>
          <p className={s.acPanelTitle}>AI Predictive Analytics</p>
          <div className={s.acForecastGrid}>
            <div><span>Next-Month Forecast</span><strong>{data.forecast.nextMonthPct}%</strong></div>
            <div><span>3-Month Forecast</span><strong>{data.forecast.next3MonthPct}%</strong></div>
            <div><span>Annual Projection</span><strong>{data.forecast.annualPct}%</strong></div>
            <div><span>Compliance Stability</span><strong>{data.forecast.stability}</strong></div>
            <div><span>AI Confidence Level</span><strong>{data.forecast.confidence}%</strong></div>
            <div><span>Forecast Reliability</span><strong>{data.forecast.reliability}</strong></div>
          </div>
        </div>
      </div>

      {/* ── Intelligence / heatmap / doc verification ─────────────── */}
      <div className={s.acAnalyticsRow}>
        <div className={s.acPanel}>
          <p className={s.acPanelTitle}>AI Compliance Intelligence</p>
          <p className={s.acIntelNote}>{data.intelligence.excellenceNote}</p>
          <p className={s.acIntelSubhead}>Key achievements</p>
          <ul className={s.acIntelList}>
            {data.intelligence.keyAchievements.map((t, i) => <li key={i}><IconCheckCircle size={11} /> {t}</li>)}
          </ul>
          {data.intelligence.recommendedActions.length > 0 && (
            <>
              <p className={s.acIntelSubhead}>Recommended actions</p>
              <ul className={s.acIntelList}>
                {data.intelligence.recommendedActions.map((t, i) => <li key={i}><IconAlertTriangle size={11} /> {t}</li>)}
              </ul>
            </>
          )}
        </div>

        <div className={s.acPanel}>
          <p className={s.acPanelTitle}>Compliance Risk Heatmap</p>
          <div className={s.acHeatList}>
            {data.heatmap.map(h => (
              <div className={s.acHeatRow} key={h.act}>
                <span>{h.act}</span>
                <span className={s[RISK_CLASS[h.risk]]}>{h.risk}</span>
              </div>
            ))}
          </div>
          <div className={s.acEnterpriseRisk}>
            Enterprise Risk Score
            <span className={s[RISK_CLASS[data.enterpriseRiskScore]]}>{data.enterpriseRiskScore}</span>
          </div>
        </div>

        <div className={s.acPanel}>
          <p className={s.acPanelTitle}>Document Verification Status</p>
          <div className={s.acDocList}>
            {data.docVerification.map(d => (
              <div className={s.acDocRow} key={d.label}>
                <span>{d.label}</span>
                <span>{d.pct}%</span>
              </div>
            ))}
          </div>
          <div className={s.acVerifyTotal}>
            Verification Completion <strong>{data.verificationCompletionPct}%</strong>
          </div>
        </div>
      </div>

      {/* ── Verification & trust layer ─────────────────────────────── */}
      <div className={s.acTrustRow}>
        <div className={s.acTrustLeft}>
          <p className={s.acPanelTitle}>Verification &amp; Trust Layer</p>
          <div className={s.acTrustTags}>
            <span><IconShieldCheck size={12} /> Certificate ID: {data.certificateId}</span>
            <span><IconCheckCircle size={12} /> Digital Signature Verified</span>
            <span><IconShieldCheck size={12} /> Tamper Protection Enabled</span>
          </div>

          <div className={s.acSignatures}>
            <div className={s.acSigBlock}>
              <p className={s.acSigName}>{data.auditor.name}</p>
              <p className={s.acSigRole}>Independent Auditor &middot; Licence {data.auditor.licenseId}</p>
              <p className={s.acSigMeta}>Decision recorded {data.decidedOn}</p>
            </div>
            <div className={s.acSigBlock}>
              <p className={s.acSigName}>{data.companyContact.name}</p>
              <p className={s.acSigRole}>Company Point of Contact</p>
              <p className={s.acSigMeta}>{data.companyContact.email}</p>
            </div>
            <div className={s.acSigBlock}>
              <p className={s.acSigName}>Regnix Platform</p>
              <p className={s.acSigRole}>Automated Verification Engine</p>
              <p className={s.acSigMeta}>Generated {data.generatedOn}</p>
            </div>
          </div>
        </div>

        <div className={s.acTrustRight}>
          <QrPlaceholder seed={data.certificateId} />
          <span className={s.acQrLabel}>Scan to verify</span>
        </div>
      </div>

      {/* ── Footer badges ───────────────────────────────────────────── */}
      <div className={s.acFooterBadges}>
        <span>CONFIDENTIAL</span>
        <span>AI VALIDATED</span>
        <span className={s.acFooterBadgeMain}><IconCheckCircle size={12} /> COMPLIANCE VERIFIED</span>
        <span>AUDIT READY</span>
        <span>REGULATORY ASSURANCE</span>
      </div>

    </div>
  );
});

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export default function AuditCertificate({ open, onClose, company, auditor }: AuditCertificateProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [sendError, setSendError] = useState('');

  if (!open) return null;

  const data = buildCertificateData(company, auditor);

  /** Captures the hidden, full-width export copy and builds a paginated A4 PDF. Shared by download + email. */
  async function renderPdf(): Promise<{ pdf: import('jspdf').jsPDF; base64: string } | null> {
    if (!exportRef.current) return null;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const node = exportRef.current;
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: '#060a12',
      useCORS: true,
      logging: false,
      // Explicitly size the capture window to the node's full, un-clipped
      // content — this is what fixes the truncated-PDF bug. Without this,
      // html2canvas defaults to the current browser viewport size.
      width: node.scrollWidth,
      height: node.scrollHeight,
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Paginate: if the certificate is taller than one A4 page, keep adding
    // pages, shifting the same full image up by one page-height each time.
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const base64 = pdf.output('datauristring').split(',')[1];
    return { pdf, base64 };
  }

  async function handleDownloadPdf() {
    setExporting(true);
    try {
      const result = await renderPdf();
      if (!result) return;
      result.pdf.save(`${company.name.replace(/\s+/g, '_')}_Compliance_Certificate.pdf`);
    } finally {
      setExporting(false);
    }
  }

  async function handleEmail() {
    if (!company.contactEmail) {
      setSendState('error');
      setSendError('No company contact email on file.');
      return;
    }
    setSendState('sending');
    setSendError('');
    try {
      const result = await renderPdf();
      if (!result) throw new Error('Could not render certificate.');
      const emailResult: Awaited<ReturnType<typeof sendCertificateEmail>> = await sendCertificateEmail({
        certificateId: data.certificateId,
        companyName: company.name,
        toEmail: company.contactEmail,
        toName: company.contactPerson,
        fileName: `${company.name.replace(/\s+/g, '_')}_Compliance_Certificate.pdf`,
        pdfBase64: result.base64,
      });
      if (emailResult.ok === true) {
        setSendState('sent');
      } else {
        setSendState('error');
        setSendError(emailResult.error);
      }
    } catch {
      setSendState('error');
      setSendError('Something went wrong while preparing the certificate.');
    }
  }

  return (
    <div className={s.acOverlay} role="dialog" aria-modal="true">
      <div className={s.acToolbar}>
        {sendState === 'sent' && <span className={s.acSendStatusOk}><IconCheckCircle size={13} /> Emailed to {company.contactEmail}</span>}
        {sendState === 'error' && <span className={s.acSendStatusErr}><IconAlertTriangle size={13} /> {sendError}</span>}

        <button className={s.acCloseBtn} onClick={onClose}>Close</button>
        <button className={s.acEmailBtn} onClick={handleEmail} disabled={sendState === 'sending'}>
          {sendState === 'sending' ? 'Sending…' : `Email to ${company.contactPerson.split(' ')[0]}`}
        </button>
        <button className={s.acDownloadBtn} onClick={handleDownloadPdf} disabled={exporting}>
          {exporting ? 'Preparing PDF…' : 'Download PDF'}
        </button>
      </div>

      <div className={s.acScroll}>
        <CertificateSheet data={data} />
      </div>

      {/* Hidden, fixed-width, fully un-clipped copy used only for html2canvas
          capture — see file header note. Never visible to the user. */}
      <div className={s.acExportHost} aria-hidden="true">
        <CertificateSheet data={data} ref={exportRef} />
      </div>
    </div>
  );
}