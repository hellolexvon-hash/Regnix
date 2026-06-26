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
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import styles from './DocumentGenerator.module.css';
import { createPortal } from 'react-dom';

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
  'Assam','Delhi','Gujarat',
  'Haryana','Karnataka', 'Kerala','Maharashtra', 'Meghalaya', 'Odisha', 'Punjab',
  'Rajasthan','Tamil Nadu', 'Telangana',
  'West Bengal'
];

const SE_ACT_STATES = [
  'Assam', 'Delhi', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala',
  'Maharashtra', 'Meghalaya', 'Odisha', 'Punjab', 'Rajasthan',
  'Tamil Nadu', 'Telangana', 'West Bengal',
] as const;

const SE_ACT_STATE_SET = new Set(SE_ACT_STATES.map((s) => s.toLowerCase()));

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
// Each act with a dedicated TypeScript backend module gets its own endpoint.
// All others fall through to /api/generate-docs (Python pipeline).
// ─────────────────────────────────────────────────────────────────────────────

/** Acts that have a dedicated TS backend route */
const DEDICATED_ACTS: Partial<Record<ActId, string>> = {
  code_wages:  '/api/generate-code-wages',
  apprentices: '/api/generate-apprentices',
  clra:        '/api/generate-clra',
  factories:   '/api/generate-factories',
  se_act:      '/api/generate-se-act',
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


function isSeActStateSupported(state: string): boolean {
  return SE_ACT_STATE_SET.has(state.trim().toLowerCase());
}

function formatSupportedSeStates(): string {
  return SE_ACT_STATES.join(', ');
}

/**
 * Call each act's endpoint (dedicated or fallback) in parallel.
 * Returns an array of { actId, blob } pairs.
 *
 * Routing rules:
 *  - If the act has a dedicated endpoint → POST to that endpoint with actId in body.
 *  - Otherwise → POST to /api/generate-docs with selectedActs = [actId].
 *
 * This ensures /api/generate-docs is never called with a mixed bag of acts;
 * each act always travels to the right handler.
 */
async function callActEndpoints(
  file: File,
  actIds: ActId[],
  state: string,
): Promise<{ actId: ActId; blob: Blob; fileCount: number; rowCount: number }[]> {
  if (actIds.includes('se_act') && !isSeActStateSupported(state)) {
    throw new Error(
      `Unsupported state: "${state}". Valid states: ${formatSupportedSeStates()}`,
    );
  }

  const results = await Promise.all(
    actIds.map(async actId => {
      const endpoint = DEDICATED_ACTS[actId] ?? '/api/generate-docs';
      const fd = buildFormData(file, actId, state);

      const res = await fetch(endpoint, { method: 'POST', body: fd });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`[${actId}] ${errJson.error ?? `Server error ${res.status}`}`);
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
function Step1({ data, selectedActs, onChange, onNext }: {
  data: CompanyDetails;
  selectedActs: ActId[];
  onChange: (p: Partial<CompanyDetails>) => void;
  onNext: () => void;
}) {
  const seActSelected = selectedActs.includes('se_act');
  const stateOptions = seActSelected ? [...SE_ACT_STATES] : STATES;
  const validState = !seActSelected || isSeActStateSupported(data.state);
  const required = ['name', 'pan', 'address', 'state', 'industry', 'headcount', 'authorizedPerson', 'email'];
  const valid = required.every(k => (data as any)[k]?.trim()) && validState;

  useEffect(() => {
    if (seActSelected && data.state && !isSeActStateSupported(data.state)) {
      onChange({ state: '' });
    }
  }, [seActSelected, data.state, onChange]);

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
        <div>
          <h2 className={styles.stepCardTitle}>Company Details</h2>
          <p className={styles.stepCardSub}>These details will be pre-filled into every register header — company name, state and industry determine which templates are used.</p>
        </div>
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
        {select(`State *${seActSelected ? ' (SE Act supported only)' : ''}`, 'state', stateOptions)}
        {select('Industry *', 'industry', INDUSTRIES)}
        {field('Total Headcount *', 'headcount', 'e.g. 150', { half: true })}
      </div>

      {seActSelected && !validState && (
        <div className={styles.instructionBox}>
          <div className={styles.instructionTitle}>SE Act state restriction</div>
          <p className={styles.stepCardSub}>
            Shops &amp; Establishments (SE Act) generation is available only for: {formatSupportedSeStates()}.
            Choose one of these states to generate SE Act registers, or remove SE Act from the selected acts.
          </p>
        </div>
      )}

      <div className={styles.sectionDivider}>Authorised Contact</div>
      <div className={styles.fieldGrid}>
        {field('Full Name *', 'authorizedPerson', 'Rajesh Kumar', { half: true })}
        {field('Designation', 'designation', 'VP – Compliance', { half: true })}
        {field('Email *', 'email', 'compliance@company.com', { type: 'email', half: true })}
        {field('Phone', 'phone', '+91 98765 43210', { half: true })}
      </div>

      <div className={styles.stepActions}>
        {!valid && <span className={styles.validationHint}>* Fill all required fields to continue</span>}
        <button className={styles.btnPrimary} onClick={onNext} disabled={!valid}>
          Continue — Select Acts →
        </button>
      </div>
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

      if (selectedActs.includes('se_act') && !isSeActStateSupported(company.state)) {
        throw new Error(
          `Unsupported state: "${company.state}". Valid states: ${formatSupportedSeStates()}`,
        );
      }

      // Call each act's dedicated endpoint in parallel.
      // Each act routes to its own handler (dedicated TS route or /api/generate-docs).
      const results = await callActEndpoints(file, selectedActs, company.state);

      setProgress(85);

      // Aggregate totals across all act responses.
      const totalFileCount = results.reduce((n, r) => n + r.fileCount, 0);
      const totalRowCount  = results.reduce((n, r) => Math.max(n, r.rowCount), 0);

      // Properly merge all act ZIPs into one valid ZIP using JSZip.
      // Simple blob concatenation does NOT produce a valid ZIP — each ZIP has its
      // own central directory at the end, so concatenating bytes corrupts both.
      // Instead: unpack every act's ZIP, add all its files into one master JSZip,
      // then generate a single clean ZIP blob.
      let zipUrl: string;

      if (results.length === 1) {
        zipUrl = URL.createObjectURL(results[0].blob);
      } else {
        const merged = new JSZip();

        await Promise.all(
          results.map(async ({ actId, blob }) => {
            const actZip = await JSZip.loadAsync(await blob.arrayBuffer());
            // Place each act's files in a named subfolder to avoid filename collisions
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

        const mergedBlob = await merged.generateAsync({
          type:               'blob',
          compression:        'DEFLATE',
          compressionOptions: { level: 6 },
        });
        zipUrl = URL.createObjectURL(mergedBlob);
      }

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

      <div className={styles.stepActions}>
        <button className={styles.btnSecondary} onClick={reDownload}>
          ⬇ Re-download ZIP
        </button>
        <button className={styles.btnPrimary} onClick={onRestart}>
          + Start New Audit
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE REGISTER — full spreadsheet viewer with audit tools
// ─────────────────────────────────────────────────────────────────────────────

interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

type ImportMode = null | 'picker'; // picker = show the 2-option modal

function LiveRegister({
  open,
  onClose,
  uploadedFile,
  selectedActs,
}: {
  open: boolean;
  onClose: () => void;
  uploadedFile: File | null;
  selectedActs: ActId[];
}) {
  const [sheets, setSheets]               = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet]     = useState(0);
  const [search, setSearch]               = useState('');
  const [filterCol, setFilterCol]         = useState<number | null>(null);
  const [filterVal, setFilterVal]         = useState('');
  const [sortCol, setSortCol]             = useState<number | null>(null);
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>('asc');
  const [highlightSearch, setHighlight]   = useState('');
  const [frozenCols, setFrozenCols]       = useState(2);
  const [importing, setImporting]         = useState(false);
  const [importErr, setImportErr]         = useState('');
  const [mounted, setMounted]             = useState(false);
  const [closing, setClosing]             = useState(false);
  const [minimized, setMinimized]         = useState(false);
  const [importMode, setImportMode]       = useState<ImportMode>(null);
  const [fetchUrl, setFetchUrl]           = useState('');
  const [fetchLoading, setFetchLoading]   = useState(false);
  const [fetchErr, setFetchErr]           = useState('');
  const [colChooserOpen, setColChooser]   = useState(false);
  const [visibleCols, setVisibleCols]     = useState<Set<number>>(new Set());
  const importRef  = useRef<HTMLInputElement>(null);
  const tableRef   = useRef<HTMLDivElement>(null);

  // ── macOS spring open/close/minimize ──────────────────────────────────────
  useEffect(() => {
    if (open && !minimized) {
      setClosing(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    } else if (!open) {
      setClosing(true);
      setMounted(false);
    }
  }, [open, minimized]);

  // ── Auto-load when step-4 file arrives ────────────────────────────────────
  useEffect(() => {
    if (uploadedFile && open) loadFile(uploadedFile);
  }, [uploadedFile, open]);

  // ── Reset visible cols when sheet changes ──────────────────────────────────
  const sheet = sheets[activeSheet];
  useEffect(() => {
    if (sheet) setVisibleCols(new Set(sheet.headers.map((_, i) => i)));
  }, [activeSheet, sheets.length]);

  // ── File parser ───────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportErr('');
    setImportMode(null);
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array', cellDates: true });
      const parsed: SheetData[] = wb.SheetNames.map(name => {
        const ws  = wb.Sheets[name];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!raw.length) return { name, headers: [], rows: [] };
        const headers = (raw[0] ?? []).map((h: any) => (h == null ? '' : String(h)));
        const rows    = raw.slice(1).map(r =>
          headers.map((_, i) => {
            const v = r[i];
            if (v == null)          return null;
            if (v instanceof Date)  return v.toLocaleDateString('en-IN');
            return typeof v === 'number' ? v : String(v);
          }),
        );
        return { name, headers, rows };
      });
      setSheets(parsed);
      setActiveSheet(0);
      setSearch(''); setFilterCol(null); setFilterVal(''); setSortCol(null);
    } catch (e: any) {
      setImportErr('Failed to parse file: ' + (e?.message ?? 'unknown error'));
    } finally {
      setImporting(false);
    }
  }, []);

  // ── Fetch from URL ────────────────────────────────────────────────────────
  const handleFetch = async () => {
    const url = fetchUrl.trim();
    if (!url) return;
    setFetchLoading(true);
    setFetchErr('');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ab  = await res.arrayBuffer();
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
      const mime = ext === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const file = new File([ab], `fetched.${ext ?? 'xlsx'}`, { type: mime });
      await loadFile(file);
      setFetchUrl('');
      setImportMode(null);
    } catch (e: any) {
      setFetchErr('Fetch failed: ' + (e?.message ?? 'network error'));
    } finally {
      setFetchLoading(false);
    }
  };

  // ── Fetch from current session (uploaded file in acts) ────────────────────
  const handleFetchFromActs = async () => {
    if (!uploadedFile) {
      setImportErr('No file found. Please upload your Master Register in Step 4 first.');
      setImportMode(null);
      return;
    }
    await loadFile(uploadedFile);
  };

  // ── Visible rows: search + filter + sort ──────────────────────────────────
  const visibleRows = (() => {
    if (!sheet) return [];
    let rows = sheet.rows;
    const q  = search.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.some(c => c != null && String(c).toLowerCase().includes(q)));
    if (filterCol != null && filterVal.trim()) {
      const fv = filterVal.trim().toLowerCase();
      rows = rows.filter(r => String(r[filterCol] ?? '').toLowerCase().includes(fv));
    }
    if (sortCol != null) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  })();

  // ── Highlight matches ─────────────────────────────────────────────────────
  const highlight = (val: string | number | null): React.ReactNode => {
    const text = val == null ? '' : String(val);
    const hl   = highlightSearch.trim().toLowerCase();
    if (!hl || !text.toLowerCase().includes(hl)) return text || null;
    const idx  = text.toLowerCase().indexOf(hl);
    return (<>{text.slice(0, idx)}<mark style={{ background:'#FDE047', borderRadius:2, padding:'0 1px' }}>{text.slice(idx, idx + hl.length)}</mark>{text.slice(idx + hl.length)}</>);
  };

  const toggleSort = (ci: number) => {
    if (sortCol === ci) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(ci); setSortDir('asc'); }
  };

  // ── Export with only visible columns ─────────────────────────────────────
  const exportFiltered = () => {
    if (!sheet) return;
    const colIdxs = sheet.headers.map((_, i) => i).filter(i => visibleCols.has(i));
    const headers  = colIdxs.map(i => sheet.headers[i]);
    const data     = [headers, ...visibleRows.map(r => colIdxs.map(i => r[i] ?? ''))];
    const ws       = XLSX.utils.aoa_to_sheet(data);
    const wb       = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    XLSX.writeFile(wb, `${sheet.name}_export.xlsx`);
  };

  const handleClose = () => {
    setClosing(true); setMounted(false);
    setTimeout(onClose, 340);
  };

  const handleMinimize = () => {
    setMounted(false);
    setMinimized(true);
    setTimeout(() => setMinimized(false), 10);
  };

  const handleMaximize = () => {
    // toggle full-screen by just letting the window fill naturally (already large)
  };

  const auditStats = sheet ? {
    total:   sheet.rows.length,
    visible: visibleRows.length,
    cols:    sheet.headers.length,
    blank:   visibleRows.reduce((n, r) => n + r.filter(c => c == null || c === '').length, 0),
  } : null;

  if (!open && !closing) return null;

  const colIdxsShown = sheet
    ? sheet.headers.map((_, i) => i).filter(i => visibleCols.has(i))
    : [];

  return (
    <div
      className={`${styles.lrOverlay} ${mounted ? styles.lrOverlayIn : ''} ${closing ? styles.lrOverlayOut : ''}`}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className={`${styles.lrWindow} ${mounted ? styles.lrWindowIn : ''} ${closing ? styles.lrWindowOut : ''}`}>

        {/* ══ TITLE BAR ══════════════════════════════════════════════════════ */}
        <div className={styles.lrTitleBar}>
          <div className={styles.lrTrafficLights}>
            <button className={`${styles.lrTl} ${styles.lrTlClose}`}  onClick={handleClose}    title="Close" />
            <button className={`${styles.lrTl} ${styles.lrTlMin}`}    onClick={handleMinimize} title="Minimise" />
            <button className={`${styles.lrTl} ${styles.lrTlMax}`}    onClick={handleMaximize} title="Full screen" />
          </div>
          <div className={styles.lrTitle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
            </svg>
            Live Register Viewer
            {sheet && <span className={styles.lrSheetBadge}>{sheet.name}</span>}
          </div>
          <div className={styles.lrTitleRight}>
            {sheet && (
              <button className={styles.lrIconBtn} onClick={() => setColChooser(v => !v)} title="Choose visible columns">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                Columns {colChooserOpen ? '▲' : '▼'}
              </button>
            )}
            {sheets.length > 0 && (
              <button className={styles.lrIconBtn} onClick={exportFiltered} title="Export visible columns + filtered rows">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </button>
            )}
            <button className={styles.lrIconBtn} onClick={() => setImportMode('picker')} title="Import data">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]); e.target.value = ''; }} />
          </div>
        </div>

        {/* ══ IMPORT PICKER MODAL ════════════════════════════════════════════ */}
        {importMode === 'picker' && (
          <div className={styles.lrImportOverlay} onClick={() => { setImportMode(null); setFetchErr(''); }}>
            <div className={styles.lrImportModal} onClick={e => e.stopPropagation()}>
              <div className={styles.lrImportTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Import Data
              </div>
              <p className={styles.lrImportSub}>Choose how to load your register data</p>

              <div className={styles.lrImportOptions}>
                {/* Option 1 — From current session */}
                <button
                  className={styles.lrImportOption}
                  onClick={handleFetchFromActs}
                  disabled={!uploadedFile}
                >
                  <div className={styles.lrImportOptIcon} style={{ background: uploadedFile ? '#EDE9FE' : '#F1F0F5' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={uploadedFile ? '#7C3AED' : '#B0ABCA'} strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                    </svg>
                  </div>
                  <div className={styles.lrImportOptText}>
                    <span className={styles.lrImportOptTitle}>From Current Session</span>
                    <span className={styles.lrImportOptSub}>
                      {uploadedFile
                        ? `Use "${uploadedFile.name}" already uploaded`
                        : 'No file uploaded yet — upload in Step 4 first'}
                    </span>
                  </div>
                  {uploadedFile
                    ? <span className={styles.lrImportOptBadge} style={{ background: '#EDE9FE', color: '#7C3AED' }}>Ready</span>
                    : <span className={styles.lrImportOptBadge} style={{ background: '#FEF3C7', color: '#92400E' }}>Pending</span>}
                </button>

                {/* Option 2 — Upload from local */}
                <button
                  className={styles.lrImportOption}
                  onClick={() => { setImportMode(null); importRef.current?.click(); }}
                >
                  <div className={styles.lrImportOptIcon} style={{ background: '#ECFDF5' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div className={styles.lrImportOptText}>
                    <span className={styles.lrImportOptTitle}>Upload from Local</span>
                    <span className={styles.lrImportOptSub}>Browse your computer for an .xlsx, .xls or .csv file</span>
                  </div>
                  <span className={styles.lrImportOptBadge} style={{ background: '#ECFDF5', color: '#065F46' }}>Browse</span>
                </button>

                {/* Option 3 — Fetch from URL */}
                <div className={styles.lrImportOptionUrl}>
                  <div className={styles.lrImportOptIcon} style={{ background: '#EFF6FF' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
                    </svg>
                  </div>
                  <div className={styles.lrImportOptText}>
                    <span className={styles.lrImportOptTitle}>Fetch from URL</span>
                    <div className={styles.lrFetchRow}>
                      <input
                        className={styles.lrFetchInput}
                        placeholder="https://example.com/register.xlsx"
                        value={fetchUrl}
                        onChange={e => setFetchUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleFetch()}
                      />
                      <button
                        className={styles.lrFetchBtn}
                        onClick={handleFetch}
                        disabled={fetchLoading || !fetchUrl.trim()}
                      >
                        {fetchLoading ? '…' : 'Fetch'}
                      </button>
                    </div>
                    {fetchErr && <span className={styles.lrFetchErr}>{fetchErr}</span>}
                  </div>
                </div>
              </div>

              {importErr && (
                <div className={styles.lrImportErr}>{importErr}</div>
              )}

              <button className={styles.lrImportClose} onClick={() => { setImportMode(null); setFetchErr(''); setImportErr(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ══ COLUMN CHOOSER PANEL ═══════════════════════════════════════════ */}
        {colChooserOpen && sheet && (
          <div className={styles.lrColChooser}>
            <div className={styles.lrColChooserHeader}>
              <span>Choose Columns</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={styles.lrColChooserBtn}
                  onClick={() => setVisibleCols(new Set(sheet.headers.map((_, i) => i)))}>
                  All
                </button>
                <button className={styles.lrColChooserBtn}
                  onClick={() => setVisibleCols(new Set())}>
                  None
                </button>
                <button className={styles.lrColChooserBtn} style={{ marginLeft: 8 }}
                  onClick={() => setColChooser(false)}>
                  ✕
                </button>
              </div>
            </div>
            <div className={styles.lrColChooserGrid}>
              {sheet.headers.map((h, i) => (
                <label key={i} className={styles.lrColChooserItem}>
                  <input
                    type="checkbox"
                    checked={visibleCols.has(i)}
                    onChange={() => {
                      setVisibleCols(prev => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      });
                    }}
                  />
                  <span className={styles.lrColChooserLabel}>{h || `Col ${i + 1}`}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ══ TOOLBAR ════════════════════════════════════════════════════════ */}
        <div className={styles.lrToolbar}>
          <div className={styles.lrSearchWrap}>
            <svg className={styles.lrSearchIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className={styles.lrSearch} placeholder="Search all columns…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className={styles.lrSearchClear} onClick={() => setSearch('')}>×</button>}
          </div>

          <div className={styles.lrSearchWrap}>
            <svg className={styles.lrSearchIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <input className={styles.lrSearch} placeholder="Highlight text…"
              value={highlightSearch} onChange={e => setHighlight(e.target.value)} />
            {highlightSearch && <button className={styles.lrSearchClear} onClick={() => setHighlight('')}>×</button>}
          </div>

          {sheet && (
            <div className={styles.lrFilterWrap}>
              <select className={styles.lrFilterSel}
                value={filterCol ?? ''}
                onChange={e => setFilterCol(e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">Filter column…</option>
                {sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Col ${i + 1}`}</option>)}
              </select>
              <input className={styles.lrFilterInput} placeholder="value…"
                value={filterVal} disabled={filterCol == null}
                onChange={e => setFilterVal(e.target.value)} />
              {(filterCol != null || filterVal) && (
                <button className={styles.lrSearchClear}
                  onClick={() => { setFilterCol(null); setFilterVal(''); }}>×</button>
              )}
            </div>
          )}

          <div className={styles.lrFreeze}>
            <span className={styles.lrFreezeLabel}>Freeze</span>
            <button className={styles.lrFreezeBtn} onClick={() => setFrozenCols(Math.max(0, frozenCols - 1))}>−</button>
            <span className={styles.lrFreezeVal}>{frozenCols}</span>
            <button className={styles.lrFreezeBtn} onClick={() => setFrozenCols(Math.min(sheet?.headers.length ?? 0, frozenCols + 1))}>+</button>
          </div>

          {sortCol != null && sheet && (
            <div className={styles.lrSortPill}>
              ↕ {sheet.headers[sortCol] || `Col ${sortCol + 1}`} ({sortDir})
              <button className={styles.lrSearchClear} onClick={() => setSortCol(null)}>×</button>
            </div>
          )}

          {auditStats && (
            <div className={styles.lrStats}>
              <span className={styles.lrStatChip}>{auditStats.visible}/{auditStats.total} rows</span>
              <span className={styles.lrStatChip}>{colIdxsShown.length}/{auditStats.cols} cols</span>
              {auditStats.blank > 0 && (
                <span className={`${styles.lrStatChip} ${styles.lrStatWarn}`}>⚠ {auditStats.blank} blank</span>
              )}
            </div>
          )}
        </div>

        {/* ══ SHEET TABS ═════════════════════════════════════════════════════ */}
        {sheets.length > 1 && (
          <div className={styles.lrSheetTabs}>
            {sheets.map((s, i) => (
              <button key={i}
                className={`${styles.lrSheetTab} ${i === activeSheet ? styles.lrSheetTabActive : ''}`}
                onClick={() => { setActiveSheet(i); setSearch(''); setFilterCol(null); setFilterVal(''); setSortCol(null); }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                </svg>
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* ══ BODY ═══════════════════════════════════════════════════════════ */}
        <div className={styles.lrBody}>
          {importing && (
            <div className={styles.lrLoading}>
              <div className={styles.lrSpinner} />
              <span>Parsing workbook…</span>
            </div>
          )}

          {!importing && sheets.length === 0 && (
            <div className={styles.lrEmpty}>
              <div className={styles.lrEmptyIcon}>📊</div>
              <div className={styles.lrEmptyTitle}>No data loaded</div>
              <div className={styles.lrEmptySub}>
                {selectedActs.length > 0
                  ? `You selected ${selectedActs.length} act${selectedActs.length > 1 ? 's' : ''} — upload your Master Register in Step 4, or import a file.`
                  : 'Import an .xlsx file to view data. Select acts and upload your Master Register in Step 4 for auto-load.'}
              </div>
              {importErr && <div className={styles.lrImportErrBanner}>{importErr}</div>}
              <button className={styles.lrEmptyBtn} onClick={() => setImportMode('picker')}>
                ⬆ Import Register
              </button>
            </div>
          )}

          {!importing && sheet && (
            <div className={styles.lrTableWrap} ref={tableRef}>
              <table className={styles.lrTable}>
                <thead>
                  <tr>
                    <th className={styles.lrThRow}>#</th>
                    {colIdxsShown.map(ci => (
                      <th key={ci}
                        className={`${styles.lrTh} ${ci < frozenCols ? styles.lrThFrozen : ''}`}
                        style={ci < frozenCols ? { left: `${48 + colIdxsShown.indexOf(ci) * 120}px` } : undefined}
                        onClick={() => toggleSort(ci)}
                        title={`Sort by "${sheet.headers[ci] || `Col ${ci + 1}`}"`}>
                        <span className={styles.lrThInner}>
                          {sheet.headers[ci] || <span className={styles.lrThEmpty}>Col {ci + 1}</span>}
                          {sortCol === ci
                            ? <span className={styles.lrSortArrow}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                            : <span className={styles.lrSortArrowFaint}>↕</span>}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={colIdxsShown.length + 1} className={styles.lrNoResults}>
                        No rows match your search / filter
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? styles.lrRowEven : styles.lrRowOdd}>
                        <td className={styles.lrTdRow}>{ri + 1}</td>
                        {colIdxsShown.map((ci, dispIdx) => (
                          <td key={ci}
                            className={`${styles.lrTd} ${dispIdx < frozenCols ? styles.lrTdFrozen : ''} ${row[ci] == null || row[ci] === '' ? styles.lrTdBlank : ''}`}
                            style={dispIdx < frozenCols ? { left: `${48 + dispIdx * 120}px` } : undefined}
                            title={row[ci] == null ? '(empty)' : String(row[ci])}>
                            {highlight(row[ci])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ══ STATUS BAR ═════════════════════════════════════════════════════ */}
        <div className={styles.lrStatusBar}>
          {sheet ? (
            <>
              <span>{sheet.name}</span>
              <span className={styles.lrStatusSep}>·</span>
              <span>{visibleRows.length}/{sheet.rows.length} rows</span>
              <span className={styles.lrStatusSep}>·</span>
              <span>{colIdxsShown.length}/{sheet.headers.length} cols visible</span>
              {sortCol != null && (
                <><span className={styles.lrStatusSep}>·</span>
                <span>↕ {sheet.headers[sortCol] || `Col ${sortCol + 1}`}</span></>
              )}
              {search && (
                <><span className={styles.lrStatusSep}>·</span>
                <span>🔍 "{search}"</span></>
              )}
            </>
          ) : (
            <span>Ready — click Import to load a register</span>
          )}
          <span style={{ marginLeft: 'auto', opacity: 0.5 }}>Regnix Live Register · Audit Mode</span>
        </div>
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

  useEffect(() => {
    if (selectedActs.includes('se_act') && company.state && !isSeActStateSupported(company.state)) {
      setCompany((current) => ({
        ...current,
        state: '',
      }));
    }
  }, [selectedActs, company.state]);

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
            selectedActs={selectedActs}
            onChange={p => setCompany(d => ({ ...d, ...p }))}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2
            selected={selectedActs}
            onChange={setSelectedActs}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
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
            title="Open Live Register Viewer"
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
          />
        </>,
        document.body
      )}
    </>
  );
}