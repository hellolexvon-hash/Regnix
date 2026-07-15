/**
 * src/components/dashboard/documentGenerator/DocumentGenerator.tsx
 *
 * Document Generator — full Supabase integration:
 *  - company_name, contact_email auto-filled from authenticated profile
 *  - head_count: number-only input with validation
 *  - state: required for S&E Act only
 *  - form submission saved to document_requests table
 *  - master Excel upload → POST to /api/generate-documents
 */

import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import styles from './DocumentGenerator.module.css';

/* ── Types ──────────────────────────────────────────────────────── */
interface ActOption {
  id:       string;
  label:    string;
  forms:    string[];
  needsState: boolean;
}

const ACTS: ActOption[] = [
  {
    id: 'code_on_wages',
    label: 'Code on Wages, 2019',
    forms: ['Form I — Register of Fines', 'Form II — Register of Deductions', 'Form II — Muster Roll cum Wage Register', 'Form III — Register of Overtime', 'Form IV — Wage Register', 'Form VI — Muster Roll'],
    needsState: false,
  },
  {
    id: 'clra',
    label: 'Contract Labour (R&A) Act, 1970',
    forms: ['Form I — Register of Workmen', 'Form XIV/XVI — Muster Roll', 'Form XVII — Register of Wages', 'Form XX — Register of Deductions', 'Form XXI — Register of Fines', 'Form XXII — Register of Advances', 'Form XXIII — Register of Overtime', 'Bonus Register', 'Gratuity Register', 'EPF Register', 'LWF & PT Register'],
    needsState: false,
  },
  {
    id: 'factories',
    label: 'Factories Act, 1948',
    forms: ['Form 1 — Register of Adult Workers', 'Form 2 — Register of Child Workers', 'Form 12 — Register of Accidents', 'Form 17 — Register of Leave with Wages', 'Form 25 — Muster Roll'],
    needsState: false,
  },
  {
    id: 'se_act',
    label: 'Shops & Establishments Act (State)',
    forms: ['Register of Employment', 'Register of Wages', 'Register of Leave', 'Register of Advances', 'Register of Fines', 'Register of Deductions', 'Overtime Register', 'Muster Roll cum Wage Register'],
    needsState: true,
  },
  {
    id: 'apprentices',
    label: 'Apprentices Act, 1961',
    forms: ['Register of Apprentices', 'Muster Roll', 'Wage Register'],
    needsState: false,
  },
];

const STATES = [
  'Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Odisha','Punjab','Rajasthan','Tamil Nadu',
  'Telangana','Uttar Pradesh','Uttarakhand','West Bengal',
];

type Step = 1 | 2 | 3;

/* ── Main Component ─────────────────────────────────────────────── */
export default function DocumentGenerator() {
  const { user, profile } = useAuth();

  /* ── Form state ── */
  const [step,      setStep]      = useState<Step>(1);
  const [actId,     setActId]     = useState('');
  const [state,     setState]     = useState('');
  const [headCount, setHeadCount] = useState('');
  const [estName,   setEstName]   = useState('');
  const [address,   setAddress]   = useState('');
  const [file,      setFile]      = useState<File | null>(null);

  /* Auto-fill from profile */
  const contactEmail = profile?.email ?? user?.email ?? '';
  const companyName  = profile?.company_name ?? profile?.firm_name ?? '';

  /* On profile load, pre-fill establishment name */
  useEffect(() => {
    if (companyName && !estName) setEstName(companyName);
  }, [companyName]);

  /* ── UI state ── */
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done,        setDone]        = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAct = ACTS.find(a => a.id === actId);

  /* ── Validation ── */
  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!actId)       e.actId     = 'Please select an Act.';
    if (selectedAct?.needsState && !state) e.state = 'State is required for S&E Act.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!headCount || isNaN(Number(headCount)) || Number(headCount) < 1)
      e.headCount = 'Enter a valid headcount (whole number, minimum 1).';
    if (!estName.trim())
      e.estName = 'Establishment name is required.';
    if (!file)
      e.file = 'Please upload the Master Register Excel file.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Headcount: only allow digits ── */
  const handleHeadCountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); // strip non-digits
    setHeadCount(val);
    if (errors.headCount) setErrors(prev => ({ ...prev, headCount: '' }));
  };

  /* ── File selection ── */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && !/\.(xlsx|xls)$/i.test(f.name)) {
      setErrors(prev => ({ ...prev, file: 'Only .xlsx or .xls files are accepted.' }));
      return;
    }
    setFile(f);
    if (errors.file) setErrors(prev => ({ ...prev, file: '' }));
  };

  /* ── Step navigation ── */
  const goNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };
  const goBack = () => setStep(prev => (prev > 1 ? (prev - 1) as Step : prev));

  /* ── Submit ── */
  const handleGenerate = async () => {
    if (!validateStep2()) { setStep(2); return; }
    if (!file || !user)   return;

    setSubmitting(true);
    setSubmitError('');

    try {
      /* 1 — Save request to Supabase */
      const { data: reqRow, error: dbErr } = await supabase
        .from('document_requests')
        .insert({
          user_id:            user.id,
          company_name:       companyName  || estName,
          contact_email:      contactEmail,
          act_type:           actId,
          state:              state || null,
          head_count:         Number(headCount),
          establishment_name: estName  || null,
          address:            address  || null,
          status:             'processing',
        })
        .select()
        .single();

      if (dbErr) throw new Error(dbErr.message);

      /* 2 — POST master file + params to backend */
      const formData = new FormData();
      formData.append('masterFile',  file);
      formData.append('actType',     actId);
      formData.append('state',       state);
      formData.append('headCount',   headCount);
      formData.append('requestId',   reqRow.id);

      const res = await fetch('/api/generate-documents', {
        method: 'POST',
        body:   formData,
        headers: {
          // Include Supabase JWT so backend can verify the user
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      /* 3 — Get download URL from response */
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      setDownloadUrl(url);

      /* 4 — Mark completed in DB */
      await supabase
        .from('document_requests')
        .update({ status: 'completed' })
        .eq('id', reqRow.id);

      setDone(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Done screen ── */
  if (done && downloadUrl) {
    return (
      <div className={styles.page}>
        <div className={styles.doneCard}>
          <div className={styles.doneIcon}>✅</div>
          <h2 className={styles.doneTitle}>Documents Generated!</h2>
          <p className={styles.doneSub}>
            Your statutory registers for <strong>{selectedAct?.label}</strong> are ready.
            {companyName && <> Prepared for <strong>{companyName}</strong>.</>}
          </p>
          <a
            href={downloadUrl}
            download={`Regnix_${actId}_registers.zip`}
            className={styles.downloadBtn}
          >
            ⬇ Download ZIP
          </a>
          <button
            className={styles.resetBtn}
            onClick={() => {
              setDone(false); setDownloadUrl(''); setStep(1);
              setActId(''); setState(''); setHeadCount('');
              setEstName(companyName); setAddress(''); setFile(null);
            }}
          >
            Generate Another
          </button>
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Document Generator</h1>
        <p className={styles.subtitle}>
          Generate statutory registers from your Master Register workbook.
        </p>
      </div>

      {/* ── Stepper ── */}
      <div className={styles.stepper}>
        {(['Select Act', 'Organisation Details', 'Upload & Generate'] as const).map((label, i) => {
          const n = (i + 1) as Step;
          return (
            <div key={label} className={`${styles.stepItem} ${step >= n ? styles.stepActive : ''} ${step > n ? styles.stepDone : ''}`}>
              <div className={styles.stepCircle}>{step > n ? '✓' : n}</div>
              <span className={styles.stepLabel}>{label}</span>
              {i < 2 && <div className={styles.stepLine} />}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Select Act ── */}
      {step === 1 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Select Applicable Act</h2>
          <div className={styles.actGrid}>
            {ACTS.map(act => (
              <button
                key={act.id}
                className={`${styles.actCard} ${actId === act.id ? styles.actCardActive : ''}`}
                onClick={() => { setActId(act.id); setErrors(prev => ({ ...prev, actId: '' })); }}
                type="button"
              >
                <span className={styles.actCardTitle}>{act.label}</span>
                <span className={styles.actCardCount}>{act.forms.length} registers</span>
              </button>
            ))}
          </div>
          {errors.actId && <p className={styles.fieldError}>{errors.actId}</p>}

          {/* State selector for S&E Act */}
          {selectedAct?.needsState && (
            <div className={styles.fieldWrap} style={{ marginTop: 16 }}>
              <label className={styles.label}>State <span className={styles.required}>*</span></label>
              <select
                className={`${styles.select} ${errors.state ? styles.inputError : ''}`}
                value={state}
                onChange={e => { setState(e.target.value); setErrors(prev => ({ ...prev, state: '' })); }}
              >
                <option value="">Select state…</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.state && <p className={styles.fieldError}>{errors.state}</p>}
            </div>
          )}

          {/* Forms preview */}
          {selectedAct && (
            <div className={styles.formsPreview}>
              <p className={styles.formsPreviewTitle}>Registers that will be generated:</p>
              <div className={styles.formsList}>
                {selectedAct.forms.map(f => (
                  <span key={f} className={styles.formPill}>{f}</span>
                ))}
              </div>
            </div>
          )}

          <div className={styles.stepActions}>
            <div />
            <button className={styles.primaryBtn} onClick={goNext} disabled={!actId}>
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Organisation Details + Upload ── */}
      {step === 2 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Organisation Details</h2>

          <div className={styles.formGrid}>
            {/* Company name — auto-filled, editable */}
            <div className={styles.fieldWrap}>
              <label className={styles.label}>
                Company / Establishment Name <span className={styles.required}>*</span>
              </label>
              <input
                className={`${styles.input} ${errors.estName ? styles.inputError : ''}`}
                placeholder="Acme Industries Pvt. Ltd."
                value={estName}
                onChange={e => { setEstName(e.target.value); setErrors(prev => ({ ...prev, estName: '' })); }}
              />
              {errors.estName && <p className={styles.fieldError}>{errors.estName}</p>}
            </div>

            {/* Contact email — auto-filled from auth, read-only */}
            <div className={styles.fieldWrap}>
              <label className={styles.label}>Contact Email</label>
              <input
                className={`${styles.input} ${styles.inputReadonly}`}
                value={contactEmail}
                readOnly
                title="Auto-filled from your account"
              />
              <p className={styles.fieldHint}>Auto-filled from your account email.</p>
            </div>

            {/* Headcount — numbers only */}
            <div className={styles.fieldWrap}>
              <label className={styles.label}>
                Total Headcount <span className={styles.required}>*</span>
              </label>
              <input
                className={`${styles.input} ${errors.headCount ? styles.inputError : ''}`}
                placeholder="e.g. 250"
                value={headCount}
                onChange={handleHeadCountChange}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
              />
              {errors.headCount
                ? <p className={styles.fieldError}>{errors.headCount}</p>
                : <p className={styles.fieldHint}>Numbers only. Enter the total number of employees.</p>}
            </div>

            {/* Address */}
            <div className={styles.fieldWrap}>
              <label className={styles.label}>Establishment Address</label>
              <input
                className={styles.input}
                placeholder="#12, Industrial Area, Bengaluru – 560001"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>
          </div>

          {/* File upload */}
          <div className={`${styles.fieldWrap} ${styles.fullWidth}`} style={{ marginTop: 8 }}>
            <label className={styles.label}>
              Master Register Workbook (.xlsx) <span className={styles.required}>*</span>
            </label>
            <div
              className={`${styles.dropZone} ${file ? styles.dropZoneOk : ''} ${errors.file ? styles.dropZoneError : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) { setFile(f); setErrors(prev => ({ ...prev, file: '' })); }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {file ? (
                <div className={styles.fileInfo}>
                  <span className={styles.fileIcon}>📄</span>
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileSize}>({(file.size / 1024).toFixed(0)} KB)</span>
                  <button
                    className={styles.fileRemove}
                    type="button"
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                  >✕</button>
                </div>
              ) : (
                <div className={styles.dropPrompt}>
                  <span className={styles.dropIcon}>⬆</span>
                  <span className={styles.dropText}>Click to browse or drag & drop your Excel master file</span>
                  <span className={styles.dropHint}>.xlsx or .xls — Regnix Enterprise Master Register</span>
                </div>
              )}
            </div>
            {errors.file && <p className={styles.fieldError}>{errors.file}</p>}
          </div>

          <div className={styles.stepActions}>
            <button className={styles.secondaryBtn} onClick={goBack}>← Back</button>
            <button className={styles.primaryBtn} onClick={goNext}>
              Review →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Generate ── */}
      {step === 3 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Review & Generate</h2>

          <div className={styles.reviewGrid}>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Act</span>
              <span className={styles.reviewValue}>{selectedAct?.label}</span>
            </div>
            {state && (
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>State</span>
                <span className={styles.reviewValue}>{state}</span>
              </div>
            )}
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Establishment</span>
              <span className={styles.reviewValue}>{estName}</span>
            </div>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Contact Email</span>
              <span className={styles.reviewValue}>{contactEmail}</span>
            </div>
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Headcount</span>
              <span className={styles.reviewValue}>{headCount} employees</span>
            </div>
            {address && (
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Address</span>
                <span className={styles.reviewValue}>{address}</span>
              </div>
            )}
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Master File</span>
              <span className={styles.reviewValue}>{file?.name}</span>
            </div>
          </div>

          <div className={styles.reviewForms}>
            <p className={styles.formsPreviewTitle}>
              {selectedAct?.forms.length} registers will be generated:
            </p>
            <div className={styles.formsList}>
              {selectedAct?.forms.map(f => (
                <span key={f} className={styles.formPill}>{f}</span>
              ))}
            </div>
          </div>

          {submitError && (
            <p className={styles.submitError} role="alert">{submitError}</p>
          )}

          <div className={styles.stepActions}>
            <button className={styles.secondaryBtn} onClick={goBack} disabled={submitting}>← Back</button>
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={submitting}
            >
              {submitting ? (
                <><span className={styles.spinner} /> Generating…</>
              ) : (
                '⚡ Generate Documents'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
