/**
 * DocumentGenerator.tsx
 *
 * Full 5-step workflow:
 *  Step 1 — Company Details
 *  Step 2 — Select Acts
 *  Step 3 — Download the Regnix Master Template (.xlsx), fill it offline
 *  Step 4 — Upload filled Master XL → backend generates all registers → download ZIP
 *  Step 5 — Summary / done screen
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import styles from './DocumentGenerator.module.css';
import LiveRegister from './LiveRegister';


// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

interface CompanyDetails {
  name: string;
  cin: string;
  pan: string;
  gstin: string;
  address: string;
  state: string;
  industry: string;
  headcount: string;
  incorporationDate: string;
  authorizedPerson: string;
  designation: string;
  email: string;
  phone: string;
}

const EMPTY_COMPANY: CompanyDetails = {
  name: '', cin: '', pan: '', gstin: '', address: '', state: '', industry: '',
  headcount: '', incorporationDate: '', authorizedPerson: '', designation: '',
  email: '', phone: '',
};

const STATES = [
   'Assam', 'Delhi', 'Gujarat', 'Haryana', 
   'Karnataka', 'Kerala', 'Maharashtra', 'Meghalaya', 
   'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 
   'West Bengal'

];

const INDUSTRIES = [
  'Manufacturing', 'IT / Software', 'Banking & Finance', 'Healthcare', 'Retail',
  'Construction', 'Education', 'Hospitality', 'Logistics', 'Real Estate',
  'Media & Entertainment', 'Contract Labour / Staffing', 'Other',
];

export type ActId =
  | 'clra' | 'factories' | 'code_wages' | 'bocw' | 'maternity'
  | 'posh' | 'equal_remuneration' | 'ismw' | 'apprentices' | 'se_act';

interface Act {
  id: ActId;
  label: string;
  shortLabel: string;
  category: string;
  description: string;
  fileCount: number;
  forms: string[];
}

const ACTS: Act[] = [
  {
    id: 'clra',
    label: 'Contract Labour (R&A) Act, 1970',
    shortLabel: 'CLRA',
    category: 'Labour',
    description: 'Applicable where 20+ contract workers are employed. Generates 7 registers including Workmen, Wages, Muster Roll, Overtime, Advances, Fines & Deductions.',
    fileCount: 7,
    forms: ['Workmen Register (Form I)', 'Muster Roll (XIV–XVI)', 'Wages Register (XVII)', 'Overtime (XXIII)', 'Advances (XXII)', 'Fines (XXI)', 'Deductions (XX)'],
  },
  {
    id: 'factories',
    label: 'Factories Act, 1948',
    shortLabel: 'Factories',
    category: 'Labour',
    description: 'For manufacturing units with 10+ workers using power. Generates Adult Worker Register, Leave with Wages, Overtime, statutory Form 11, Form 22, Accident Notice (Form 24) and Dangerous Occurrence Notice (Form 25).',
    fileCount: 13,
    forms: ['Adult Worker Register (Rule 62)', 'Leave With Wages (Form 15)', 'Overtime Register (Form 22)', 'Form 11 – Adult Workers', 'Form 22 – Overtime', 'Form 24 – Accident Notice', 'Form 25 – Dangerous Occurrence'],
  },
  {
    id: 'code_wages',
    label: 'Code on Wages, 2019',
    shortLabel: 'Code on Wages',
    category: 'Labour',
    description: 'Consolidates Payment of Wages, Minimum Wages, Payment of Bonus Acts. Generates Fines, Deductions, Overtime, Wages Register and Muster Roll.',
    fileCount: 5,
    forms: ['Register of Fines (Form I)', 'Register of Deductions (Form II)', 'Overtime Register (Form III)', 'Wage Register (Form IV)', 'Muster Roll (Form VI)'],
  },
  {
    id: 'bocw',
    label: 'BOCW Act, 1996',
    shortLabel: 'BOCW',
    category: 'Labour',
    description: 'Building and Other Construction Workers Act. Generates 6 registers covering workers, wages, muster roll, overtime, advances and deductions.',
    fileCount: 6,
    forms: ['Workers Register (Form XV)', 'Wages Register (XVII)', 'Muster Roll (XVI)', 'Overtime (XXII)', 'Advances (XXI)', 'Deductions (XIX)'],
  },
  {
    id: 'maternity',
    label: 'Maternity Benefit Act, 1961',
    shortLabel: 'Maternity',
    category: 'Labour',
    description: 'For establishments with 10+ women employees. Generates Maternity Benefit Register and Leave Register.',
    fileCount: 2,
    forms: ['Maternity Benefit Register', 'Leave Register'],
  },
  {
    id: 'posh',
    label: 'POSH Act, 2013',
    shortLabel: 'POSH',
    category: 'Compliance',
    description: 'Prevention of Sexual Harassment. Generates Complaint Register and Training Register with company header pre-filled.',
    fileCount: 2,
    forms: ['POSH Complaint Register (R5)', 'POSH Training Register (R7)'],
  },
  {
    id: 'equal_remuneration',
    label: 'Equal Remuneration Act, 1976',
    shortLabel: 'Equal Remuneration',
    category: 'Labour',
    description: 'Generates Gender Wage Register and Recruitment Register to demonstrate equal pay compliance.',
    fileCount: 2,
    forms: ['Gender Wage Register', 'Recruitment Register'],
  },
  {
    id: 'ismw',
    label: 'ISMW Act, 1979',
    shortLabel: 'ISMW',
    category: 'Labour',
    description: 'Inter-State Migrant Workmen Act. Generates 4 registers: Migrant Worker, Journey Allowance, Displacement Allowance and Wage Register.',
    fileCount: 4,
    forms: ['Migrant Worker Register (R1)', 'Journey Allowance Register (R2)', 'Displacement Allowance (R3)', 'Wage Register (R4)'],
  },
  {
    id: 'apprentices',
    label: 'Apprentices Act, 1961',
    shortLabel: 'Apprentices',
    category: 'Labour',
    description: 'Generates Apprentice Register, Attendance Register and Stipend Register.',
    fileCount: 3,
    forms: ['Apprentice Register', 'Attendance Register', 'Stipend Register'],
  },
  {
    id: 'se_act',
    label: 'Shops & Establishments Act',
    shortLabel: 'S&E Act',
    category: 'State',
    description: 'State-specific S&E Act registers. Generates 7 state-specific registers: Employment, Wages, Leave, Overtime, Deductions, Advances and Fines.',
    fileCount: 7,
    forms: ['Employment Register', 'Wages Register', 'Leave Register', 'Overtime Register', 'Deductions Register', 'Advances Register', 'Fines Register'],
  },
];

const CATEGORIES = ['All', 'Labour', 'State', 'Compliance'];

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT ROUTING
// Each act routes to its dedicated TypeScript backend endpoint.
// Manual acts (bocw, maternity, posh, equal_remuneration, ismw) are served as
// pre-built ZIPs via GET — no master file upload required.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acts that have a dedicated TS backend route (POST with master file).
 * Every POST-based act MUST appear here — there is no generic fallback.
 */
const DEDICATED_ACTS: Partial<Record<ActId, string>> = {
  code_wages:  '/api/generate-code-wages',
  apprentices: '/api/generate-apprentices',
  clra:        '/api/generate-clra',
  factories:   '/api/generate-factories',
  se_act:      '/api/generate-se-act',
};

/**
 * States supported by the Shops & Establishments Act backend.
 * Must match SE_ACT_STATES in server/routes/seActRoute.ts exactly.
 */
const SE_ACT_SUPPORTED_STATES = [
  'Assam', 'Delhi', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala',
  'Maharashtra', 'Meghalaya', 'Odisha', 'Punjab', 'Rajasthan',
  'Tamil Nadu', 'Telangana', 'West Bengal',
] as const;

/**
 * Acts whose registers are fully manual — no master file needed.
 * These are served as pre-built ZIPs via a plain GET endpoint.
 * When selected, the browser downloads the ZIP directly; they are
 * excluded from the POST flow entirely.
 */
const MANUAL_ACT_ENDPOINTS: Partial<Record<ActId, string>> = {
  bocw:               '/api/download-bocw',
  maternity:          '/api/download-maternity-benefit',
  posh:               '/api/download-posh',
  equal_remuneration: '/api/download-equal-remuneration',
  ismw:               '/api/download-ismw',
};

/**
 * Build a FormData payload for a single act call.
 * Always includes the master file, state, and the specific actId.
 */
function buildFormData(file: File, actId: ActId, state: string): FormData {
  const fd = new FormData();
  fd.append('master', file);
  fd.append('selectedActs', JSON.stringify([actId]));
  fd.append('actId', actId);
  fd.append('state', state);
  return fd;
}

/**
 * Trigger browser download for a manual act (GET endpoint, no master file).
 * Returns metadata so the summary step can still count files.
 */
/** Fetch a manual act ZIP from the server and return it as a blob (no download triggered here). */
async function fetchManualActBlob(actId: ActId): Promise<{ actId: ActId; blob: Blob; fileCount: number }> {
  const endpoint = MANUAL_ACT_ENDPOINTS[actId]!;
  const res = await fetch(endpoint, { method: 'GET' });
  if (!res.ok) {
    let errMsg = `Server error ${res.status}`;
    try { const j = await res.json(); errMsg = j.error ?? errMsg; } catch { /**/ }
    throw new Error(`[${actId.toUpperCase()}] ${errMsg}`);
  }
  const blob = await res.blob();
  const act  = ACTS.find(a => a.id === actId);
  return { actId, blob, fileCount: act?.fileCount ?? 0 };
}

/**
 * Call each act's endpoint in parallel.
 *
 * Routing rules:
 *  - Manual acts (MANUAL_ACT_ENDPOINTS) → GET download, no master file upload.
 *  - All other acts (DEDICATED_ACTS) → POST to their own dedicated endpoint.
 *
 * All act blobs (manual GET + generated POST) are merged into a single ZIP.
 * Each act gets its own subfolder named by shortLabel (e.g. CLRA/, BOCW/).
 */
async function callActEndpoints(
  file: File,
  actIds: ActId[],
  state: string,
): Promise<{ actId: ActId; blob: Blob; fileCount: number; rowCount: number }[]> {
  if (actIds.length === 0) return [];

  const results = await Promise.all(
    actIds.map(async actId => {
      const endpoint = DEDICATED_ACTS[actId];
      if (!endpoint) {
        throw new Error(
          `No backend route registered for "${actId}". Deselect this act or contact support.`,
        );
      }

      const fd = buildFormData(file, actId, state);
      const res = await fetch(endpoint, { method: 'POST', body: fd });

      if (!res.ok) {
        let errMsg = `Server error ${res.status}`;
        try { const j = await res.json(); errMsg = j.error ?? errMsg; } catch { /**/ }
        throw new Error(`[${actId.toUpperCase()}] ${errMsg}`);
      }

      const fileCount = Number(res.headers.get('X-File-Count') ?? 0);
      const rowCount  = Number(res.headers.get('X-Row-Count')  ?? 0);
      const blob      = await res.blob();

      return { actId, blob, fileCount, rowCount };
    }),
  );
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP BAR
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Company Details' },
  { n: 2, label: 'Select Acts' },
  { n: 3, label: 'Download Template' },
  { n: 4, label: 'Upload & Generate' },
  { n: 5, label: 'Done' },
];

function StepBar({ current }: { current: number }) {
  return (
    <div className={styles.stepBar}>
      {STEPS.map((s, i) => (
        <div key={s.n} className={styles.stepBarItem}>
          <div className={`${styles.stepDot} ${current > s.n ? styles.stepDotDone : ''} ${current === s.n ? styles.stepDotActive : ''}`}>
            {current > s.n
              ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              : s.n}
          </div>
          <span className={`${styles.stepLabel} ${current === s.n ? styles.stepLabelActive : ''}`}>{s.label}</span>
          {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${current > s.n ? styles.stepLineDone : ''}`} />}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Company Details
// ─────────────────────────────────────────────────────────────────────────────
function Step1({ data, onChange, onNext }: {
  data: CompanyDetails;
  onChange: (p: Partial<CompanyDetails>) => void;
  onNext: () => void;
}) {
  const required = ['name', 'pan', 'address', 'state', 'industry', 'headcount', 'authorizedPerson', 'email'];
  const valid = required.every(k => (data as any)[k]?.trim());

  const field = (label: string, key: keyof CompanyDetails, ph: string, opts?: { type?: string; half?: boolean }) => (
    <div className={`${styles.field} ${opts?.half ? styles.fieldHalf : ''}`}>
      <label className={styles.label}>{label}</label>
      <input
        className={styles.input}
        type={opts?.type ?? 'text'}
        placeholder={ph}
        value={(data as any)[key]}
        onChange={e => onChange({ [key]: e.target.value })}
      />
    </div>
  );

  const select = (label: string, key: keyof CompanyDetails, options: string[]) => (
    <div className={`${styles.field} ${styles.fieldHalf}`}>
      <label className={styles.label}>{label}</label>
      <select className={styles.select} value={(data as any)[key]} onChange={e => onChange({ [key]: e.target.value })}>
        <option value="">Select…</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepCardHeader}>
        <div className={styles.stepCardIcon}>🏢</div>
        <div className={styles.stepCardHeaderText}>
          <h2 className={styles.stepCardTitle}>Company Details</h2>
          <p className={styles.stepCardSub}>These details will be pre-filled into every register header — company name, state and industry determine which templates are used.</p>
        </div>
        <button className={styles.btnPrimary} onClick={onNext} disabled={!valid} title={!valid ? 'Fill all required fields to continue' : ''}>
          Continue →
        </button>
      </div>

      <div className={styles.sectionDivider}>Legal Information</div>
      <div className={styles.fieldGrid}>
        {field('Company / Organisation Name *', 'name', 'Acme Manufacturing Pvt. Ltd.')}
        {field('CIN (optional)', 'cin', 'U12345MH2010PTC123456', { half: true })}
        {field('PAN *', 'pan', 'AABCA1234Z', { half: true })}
        {field('GSTIN (optional)', 'gstin', '27AABCA1234Z1Z5', { half: true })}
        {field('Incorporation Date', 'incorporationDate', '', { type: 'date', half: true })}
      </div>

      <div className={styles.sectionDivider}>Location & Industry</div>
      <div className={styles.fieldGrid}>
        {field('Registered Address *', 'address', '123, Industrial Area, Phase 2…')}
        {select('State *', 'state', STATES)}
        {select('Industry *', 'industry', INDUSTRIES)}
        {field('Total Headcount *', 'headcount', 'e.g. 150', { half: true })}
      </div>

      <div className={styles.sectionDivider}>Authorised Contact</div>
      <div className={styles.fieldGrid}>
        {field('Full Name *', 'authorizedPerson', 'Rajesh Kumar', { half: true })}
        {field('Designation', 'designation', 'VP – Compliance', { half: true })}
        {field('Email *', 'email', 'compliance@company.com', { type: 'email', half: true })}
        {field('Phone', 'phone', '+91 98765 43210', { half: true })}
      </div>

      {!valid && (
        <div className={styles.validationBanner}>
          <span className={styles.validationHint}>* Fill all required fields to continue</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Select Acts
// ─────────────────────────────────────────────────────────────────────────────
function Step2({ selected, onChange, onBack, onNext }: {
  selected: ActId[];
  onChange: (ids: ActId[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [cat, setCat] = useState('All');
  const filtered = cat === 'All' ? ACTS : ACTS.filter(a => a.category === cat);
  const toggle = (id: ActId) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const totalFiles = selected.reduce((n, id) => n + (ACTS.find(a => a.id === id)?.fileCount ?? 0), 0);

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepCardHeader}>
        <div className={styles.stepCardIcon}>⚖️</div>
        <div>
          <h2 className={styles.stepCardTitle}>Select Applicable Acts</h2>
          <p className={styles.stepCardSub}>Select the labour & compliance acts that apply to your establishment. Each act maps to real Excel register templates from the Regnix template library.</p>
        </div>
      </div>

      <div className={styles.catTabs}>
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`${styles.catTab} ${cat === c ? styles.catTabActive : ''}`}
            onClick={() => setCat(c)}
          >
            {c}
            {c !== 'All' && (
              <span className={styles.catCount}>
                {ACTS.filter(a => a.category === c).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.actGrid}>
        {filtered.map(act => {
          const on = selected.includes(act.id);
          return (
            <div
              key={act.id}
              className={`${styles.actCard} ${on ? styles.actCardOn : ''}`}
              onClick={() => toggle(act.id)}
            >
              <div className={styles.actCardTop}>
                <div className={styles.actCheck}>{on ? '✓' : ''}</div>
                <span className={`${styles.actCatBadge} ${styles[`cat_${act.category.toLowerCase()}`]}`}>
                  {act.category}
                </span>
              </div>
              <div className={styles.actName}>{act.label}</div>
              <div className={styles.actDesc}>{act.description}</div>
              <div className={styles.actForms}>
                {act.forms.slice(0, 3).map(f => (
                  <span key={f} className={styles.actFormPill}>{f}</span>
                ))}
                {act.forms.length > 3 && (
                  <span className={styles.actFormPillMore}>+{act.forms.length - 3} more</span>
                )}
              </div>
              <div className={styles.actFileCount}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                {act.fileCount} register{act.fileCount > 1 ? 's' : ''}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.selectedSummary}>
        <span className={styles.selectedCount}>
          {selected.length} act{selected.length !== 1 ? 's' : ''} selected
        </span>
        <span className={styles.selectedFiles}>
          {totalFiles} register files will be generated
        </span>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.btnSecondary} onClick={onBack}>← Back</button>
        <button className={styles.btnPrimary} onClick={onNext} disabled={selected.length === 0}>
          Download Master Template →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Download Master Template
// ─────────────────────────────────────────────────────────────────────────────
function Step3({ company, selectedActs, onBack, onNext }: {
  company: CompanyDetails;
  selectedActs: ActId[];
  onBack: () => void;
  onNext: () => void;
}) {
  const [downloaded, setDownloaded] = useState(false);

  const totalFiles = selectedActs.reduce(
    (n, id) => n + (ACTS.find(a => a.id === id)?.fileCount ?? 0), 0,
  );

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/templates/Regnix_Enterprise_Master_Register_v2.xlsx';
    link.download = 'Regnix_Enterprise_Master_Register_v2.xlsx';
    link.click();
    setDownloaded(true);
  };

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepCardHeader}>
        <div className={styles.stepCardIcon}>📥</div>
        <div>
          <h2 className={styles.stepCardTitle}>Download & Fill Master Template</h2>
          <p className={styles.stepCardSub}>
            Download the Regnix Enterprise Master Register, fill in your {company.name} employee data, then upload it in the next step.
            Your {selectedActs.length} selected acts will generate {totalFiles} register files.
          </p>
        </div>
      </div>

      <div className={styles.actSummaryList}>
        {selectedActs.map(id => {
          const act = ACTS.find(a => a.id === id)!;
          return (
            <div key={id} className={styles.actSummaryRow}>
              <div className={styles.actSummaryLeft}>
                <span className={styles.actSummaryName}>{act.label}</span>
                <div className={styles.actSummaryForms}>
                  {act.forms.map(f => (
                    <span key={f} className={styles.actFormMini}>{f}</span>
                  ))}
                </div>
              </div>
              <span className={styles.actSummaryCount}>{act.fileCount} files</span>
            </div>
          );
        })}
      </div>

      <div className={styles.templateCard}>
        <div className={styles.xlsIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <div className={styles.templateInfo}>
          <div className={styles.templateName}>Regnix_Enterprise_Master_Register_v2.xlsx</div>
          <div className={styles.templateMeta}>
            {Object.keys(Object.fromEntries(
              selectedActs.flatMap(id => ACTS.find(a => a.id === id)!.forms.map(f => [f, 1]))
            )).length}+ column fields · covers all {selectedActs.length} selected acts
          </div>
        </div>
        <button
          className={`${styles.btnDownload} ${downloaded ? styles.btnDownloadDone : ''}`}
          onClick={handleDownload}
        >
          {downloaded ? '✓ Downloaded' : '⬇ Download'}
        </button>
      </div>

      <div className={styles.instructionBox}>
        <div className={styles.instructionTitle}>📋 How to fill the Master Register</div>
        <ol className={styles.instructionList}>
          <li>Open the downloaded Excel file — go to the <strong>"Master Register - Structured"</strong> sheet</li>
          <li>Fill employee data row by row (one row = one employee/workman)</li>
          <li>Key fields: <strong>Employee Name (col 300), Employee Code (col 9), Designation (col 47), Date of Joining (col 43), Basic Salary (col 94), Days Worked (col 92)</strong></li>
          <li>For contractor registers also fill: Contractor Name (col 28), Principal Employer (col 30), Nature of Work (col 101)</li>
          <li>Dates must be in <strong>DD-MM-YYYY</strong> format</li>
          <li>Do not rename or delete sheets</li>
          <li>Save the file and upload it in the next step</li>
        </ol>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.btnSecondary} onClick={onBack}>← Back</button>
        <button className={styles.btnPrimary} onClick={onNext} disabled={!downloaded}>
          I've filled it — Upload Now →
        </button>
        {!downloaded && (
          <span className={styles.validationHint}>Download and fill the template first</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Upload & Generate
// ─────────────────────────────────────────────────────────────────────────────
type UploadStatus = 'idle' | 'uploading' | 'generating' | 'done' | 'error';

function Step4({ company, selectedActs, onBack, onDone, onFileReady }: {
  company: CompanyDetails;
  selectedActs: ActId[];
  onBack: () => void;
  onDone: (info: { fileCount: number; rowCount: number; zipUrl: string }, file?: File) => void;
  onFileReady?: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const currentFileRef = useRef<File | null>(null);

  const processFile = async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError('Please upload an Excel file (.xlsx or .xls)');
      setStatus('error');
      return;
    }

    setFileName(file.name);
    currentFileRef.current = file;
    onFileReady?.(file);
    setStatus('uploading');
    setProgress(15);

    try {
      setStatus('generating');
      setProgress(30);

      // Validate SE Act state before firing any requests.
      if (selectedActs.includes('se_act')) {
        const stateMatch = SE_ACT_SUPPORTED_STATES.find(
          s => s.toLowerCase() === company.state.toLowerCase(),
        );
        if (!stateMatch) {
          throw new Error(
            `Shops & Establishments Act: your company state "${company.state || '(not set)'}" is not supported. ` +
            `Supported states: ${SE_ACT_SUPPORTED_STATES.join(', ')}.`,
          );
        }
      }

      // Split acts: manual (GET pre-built ZIPs) vs post (generate from master file).
      const manualActIds = selectedActs.filter(id => id in MANUAL_ACT_ENDPOINTS);
      const postActIds   = selectedActs.filter(id => !(id in MANUAL_ACT_ENDPOINTS));

      // Fetch all blobs in parallel — manual acts via GET, post acts via POST.
      const [manualResults, postResults] = await Promise.all([
        Promise.all(manualActIds.map(id => fetchManualActBlob(id))),
        callActEndpoints(file, postActIds, company.state),
      ]);

      setProgress(75);

      // Combine into one flat list: every act gets its own named folder in the ZIP.
      const allResults: { actId: ActId; blob: Blob; fileCount: number }[] = [
        ...manualResults,
        ...postResults,
      ];

      const totalFileCount = allResults.reduce((n, r) => n + r.fileCount, 0);
      const totalRowCount  = postResults.reduce((n, r) => Math.max(n, r.rowCount), 0);

      // Always build one merged ZIP with a subfolder per act.
      const merged = new JSZip();

      await Promise.all(
        allResults.map(async ({ actId, blob }) => {
          const actZip = await JSZip.loadAsync(await blob.arrayBuffer());
          const act    = ACTS.find(a => a.id === actId)!;
          const folder = merged.folder(act.shortLabel)!;
          const filePromises: Promise<void>[] = [];
          actZip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
              filePromises.push(
                zipEntry.async('uint8array').then(data => {
                  folder.file(relativePath, data);
                }),
              );
            }
          });
          await Promise.all(filePromises);
        }),
      );

      setProgress(92);

      const zipBlob = await merged.generateAsync({
        type:               'blob',
        compression:        'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const zipUrl   = URL.createObjectURL(zipBlob);
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const a = document.createElement('a');
      a.href     = zipUrl;
      a.download = `${company.name.replace(/\s+/g, '_')}_Registers_${timestamp}.zip`;
      a.click();

      setProgress(100);
      setStatus('done');
      onDone({ fileCount: totalFileCount, rowCount: totalRowCount, zipUrl }, currentFileRef.current ?? undefined);
    } catch (err: any) {
      setStatus('error');
      setError(err.message ?? 'Unknown error. Please try again.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const totalFiles = selectedActs.reduce(
    (n, id) => n + (ACTS.find(a => a.id === id)?.fileCount ?? 0), 0,
  );

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepCardHeader}>
        <div className={styles.stepCardIcon}>⚙️</div>
        <div>
          <h2 className={styles.stepCardTitle}>Upload & Generate Registers</h2>
          <p className={styles.stepCardSub}>
            Upload your filled Master Register. The Regnix engine will read every row and fill {totalFiles} statutory register templates in seconds.
          </p>
        </div>
      </div>

      {/* Act summary pills */}
      <div className={styles.actPillRow}>
        {selectedActs.map(id => {
          const act = ACTS.find(a => a.id === id)!;
          return (
            <span key={id} className={styles.actPill}>
              {act.shortLabel} · {act.fileCount}
            </span>
          );
        })}
      </div>

      {(status === 'idle' || status === 'error') && (
        <div
          className={`${styles.dropzone} ${dragging ? styles.dropzoneDrag : ''} ${status === 'error' ? styles.dropzoneError : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
          />
          <div className={styles.dropzoneIcon}>{status === 'error' ? '❌' : '📂'}</div>
          <div className={styles.dropzoneText}>
            {status === 'error' ? error : 'Drop your filled Regnix Master Register here, or click to browse'}
          </div>
          {status === 'idle' && (
            <div className={styles.dropzoneSub}>Regnix_Enterprise_Master_Register_v2.xlsx · .xlsx / .xls</div>
          )}
          {status === 'error' && (
            <div className={styles.dropzoneRetry}>Click to try again</div>
          )}
        </div>
      )}

      {(status === 'uploading' || status === 'generating') && (
        <div className={styles.generatingBox}>
          <div className={styles.generatingFile}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {fileName}
          </div>
          <div className={styles.generatingLabel}>
            {status === 'uploading' ? '⬆ Uploading master register…' : `⚙ Calling ${selectedActs.length} act endpoint${selectedActs.length > 1 ? 's' : ''} in parallel…`}
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.generatingSub}>
            {selectedActs.map(id => ACTS.find(a => a.id === id)!.shortLabel).join(' · ')}
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className={styles.uploadSuccess}>
          <div className={styles.successIcon}>✅</div>
          <div>
            <div className={styles.successTitle}>Registers generated successfully!</div>
            <div className={styles.successSub}>{fileName} processed · download started automatically</div>
          </div>
        </div>
      )}

      <div className={styles.stepActions}>
        <button className={styles.btnSecondary} onClick={onBack} disabled={status === 'uploading' || status === 'generating'}>
          ← Back
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Done
// ─────────────────────────────────────────────────────────────────────────────
function Step5({ company, selectedActs, info, onRestart }: {
  company: CompanyDetails;
  selectedActs: ActId[];
  info: { fileCount: number; rowCount: number; zipUrl: string };
  onRestart: () => void;
}) {
  const navigate = useNavigate();

  const reDownload = () => {
    const a = document.createElement('a');
    a.href = info.zipUrl;
    a.download = `${company.name.replace(/\s+/g, '_')}_Registers.zip`;
    a.click();
  };

  return (
    <div className={styles.stepCard}>
      <div className={styles.doneHero}>
        <div className={styles.doneCheck}>✓</div>
        <h2 className={styles.doneTitle}>All Registers Generated!</h2>
        <p className={styles.doneSub}>
          {info.fileCount} statutory register files were filled from {info.rowCount} employee record{info.rowCount !== 1 ? 's' : ''} and packaged into a ZIP.
        </p>
      </div>

      <div className={styles.doneStatsRow}>
        <div className={styles.doneStat}>
          <div className={styles.doneStatNum}>{info.rowCount}</div>
          <div className={styles.doneStatLabel}>Employees Processed</div>
        </div>
        <div className={styles.doneStat}>
          <div className={styles.doneStatNum}>{selectedActs.length}</div>
          <div className={styles.doneStatLabel}>Acts Covered</div>
        </div>
        <div className={styles.doneStat}>
          <div className={styles.doneStatNum}>{info.fileCount}</div>
          <div className={styles.doneStatLabel}>Register Files</div>
        </div>
      </div>

      <div className={styles.doneActList}>
        {selectedActs.map(id => {
          const act = ACTS.find(a => a.id === id)!;
          return (
            <div key={id} className={styles.doneActRow}>
              <div className={styles.doneActCheck}>✓</div>
              <div>
                <div className={styles.doneActName}>{act.label}</div>
                <div className={styles.doneActForms}>{act.forms.join(' · ')}</div>
              </div>
              <span className={styles.doneActCount}>{act.fileCount} files</span>
            </div>
          );
        })}
      </div>

      <div style={{
        background: '#F5F3FF', border: '1.5px solid #C4B5FD',
        borderRadius: 12, padding: '14px 18px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 22 }}>🛡️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F0A1E', marginBottom: 3 }}>
            Ready for validation?
          </div>
          <div style={{ fontSize: 11.5, color: '#8B85A8' }}>
            Proceed to the 3-level compliance audit to certify your registers.
          </div>
        </div>
        <button
          className={styles.btnPrimary}
          onClick={() => navigate('/dashboard/validation')}
          style={{ whiteSpace: 'nowrap' }}
        >
          Start Validation →
        </button>
      </div>

      <div className={styles.stepActions}>
        <button className={styles.btnSecondary} onClick={reDownload}>
          ⬇ Re-download ZIP
        </button>
        <button className={styles.btnSecondary} onClick={onRestart}>
          + Start New Audit
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function DocumentGenerator() {
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState<CompanyDetails>(EMPTY_COMPANY);
  const [selectedActs, setSelectedActs] = useState<ActId[]>([]);
  const [doneInfo, setDoneInfo] = useState<{ fileCount: number; rowCount: number; zipUrl: string } | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fabPulse, setFabPulse] = useState(false);

  const restart = () => {
    setStep(1);
    setCompany(EMPTY_COMPANY);
    setSelectedActs([]);
    setDoneInfo(null);
  };

  // When a file is uploaded in Step4, store it and pulse the FAB
  const handleFileDone = (info: { fileCount: number; rowCount: number; zipUrl: string }, file?: File) => {
    if (file) {
      setUploadedFile(file);
      setFabPulse(true);
      setTimeout(() => setFabPulse(false), 3000);
    }
    setDoneInfo(info);
    setStep(5);
  };

  return (
    <>
      <div className={styles.page}>
        <StepBar current={step} />

        {step === 1 && (
          <Step1
            data={company}
            onChange={p => setCompany(d => ({ ...d, ...p }))}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2
            selected={selectedActs}
            onChange={setSelectedActs}
            onBack={() => setStep(1)}
            onNext={() => {
              // If every selected act is manual, skip steps 3 & 4 entirely.
              const allManual = selectedActs.every(id => id in MANUAL_ACT_ENDPOINTS);
              if (allManual) {
                // All-manual: fetch all blobs then merge into one ZIP.
                Promise.all(selectedActs.map(id => fetchManualActBlob(id)))
                  .then(async results => {
                    const merged = new JSZip();
                    await Promise.all(
                      results.map(async ({ actId, blob }) => {
                        const actZip = await JSZip.loadAsync(await blob.arrayBuffer());
                        const act    = ACTS.find(a => a.id === actId)!;
                        const folder = merged.folder(act.shortLabel)!;
                        const fps: Promise<void>[] = [];
                        actZip.forEach((p, e) => {
                          if (!e.dir) fps.push(e.async('uint8array').then(d => { folder.file(p, d); }));
                        });
                        await Promise.all(fps);
                      }),
                    );
                    const zipBlob = await merged.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
                    const zipUrl  = URL.createObjectURL(zipBlob);
                    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    const a = document.createElement('a');
                    a.href     = zipUrl;
                    a.download = `Registers_${timestamp}.zip`;
                    a.click();
                    const totalFiles = results.reduce((n, r) => n + r.fileCount, 0);
                    setDoneInfo({ fileCount: totalFiles, rowCount: 0, zipUrl });
                    setStep(5);
                  })
                  .catch(err => {
                    alert(`Download failed: ${err.message}`);
                  });
              } else {
                setStep(3);
              }
            }}
          />
        )}
        {step === 3 && (
          <Step3
            company={company}
            selectedActs={selectedActs}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <Step4
            company={company}
            selectedActs={selectedActs}
            onBack={() => setStep(3)}
            onDone={(info, file) => handleFileDone(info, file)}
            onFileReady={(f) => { setUploadedFile(f); setFabPulse(true); setTimeout(() => setFabPulse(false), 3000); }}
          />
        )}
        {step === 5 && doneInfo && (
          <Step5
            company={company}
            selectedActs={selectedActs}
            info={doneInfo}
            onRestart={restart}
          />
        )}
      </div>

      {/* ── Live Register FAB + Viewer — portalled to document.body so no parent CSS can hide/clip them ── */}
      {typeof document !== 'undefined' && createPortal(
        <>
          <button
            className={`${styles.fab} ${fabPulse ? styles.fabPulse : ''} ${liveOpen ? styles.fabActive : ''}`}
            onClick={() => setLiveOpen(o => !o)}
            title="Live Register"
          >
            <span className={styles.fabInner}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M3 15h18M9 3v18"/>
              </svg>
              <span className={styles.fabLabel}>{liveOpen ? 'Close' : 'Live Register'}</span>
            </span>
            {fabPulse && <span className={styles.fabRing} />}
          </button>

          <LiveRegister
            open={liveOpen}
            onClose={() => setLiveOpen(false)}
            uploadedFile={uploadedFile}
            selectedActs={selectedActs}
            companyName={company.name}
          />
        </>,
        document.body
      )}
    </>
  );
}