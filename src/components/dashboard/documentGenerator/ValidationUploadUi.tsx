/**
 * ValidationUploadUi.tsx
 *
 * Shared "something is uploading / opening" feedback for the company side:
 *   <UploadOverlay>  full-screen progress card → per-file result (✓ stored / ✗ failed) with Retry
 *   <FlashToast>     small corner message ("✓ Submitted for audit") that fades by itself
 *
 * Styled by ValidationUpload.module.css (self-contained — nothing to append to Validation.module.css).
 */
import { useEffect } from 'react';
import u from './ValidationUpload.module.css';

export interface FailedItem { name: string; reason: string }

interface OverlayProps {
  /** 'working' = progress bar, 'review' = some files failed, 'error' = whole step failed, 'done' = all stored */
  state: 'working' | 'review' | 'error' | 'done';
  title: string;
  detail?: string;
  /** 0–100, or null for an indeterminate bar */
  pct?: number | null;
  total?: number;
  failed?: FailedItem[];
  retryLabel?: string;
  continueLabel?: string;
  closeLabel?: string;
  onRetry?: () => void;
  onContinue?: () => void;
  onClose?: () => void;
}

const REASON: Record<string, string> = {
  'over 3 MB': 'larger than 3 MB — compress or split it, then upload again',
  'empty file': 'the file is empty',
  'not signed in': 'you were signed out — sign in again',
  network: 'network problem — check your connection',
};
const why = (r: string) => REASON[r] ?? (r.startsWith('server') ? `server rejected it (${r})` : r);

export function UploadOverlay(p: OverlayProps) {
  const working = p.state === 'working';
  const retryable = (p.failed ?? []).some((f) => f.reason !== 'over 3 MB' && f.reason !== 'empty file');
  return (
    <div className={u.overlay} role="dialog" aria-modal="true" aria-live="polite">
      <div className={u.card}>
        <div className={`${u.icon} ${working ? u.iconWork : p.state === 'done' ? u.iconOk : p.state === 'review' ? u.iconWarn : u.iconBad}`} aria-hidden="true">
          {working ? <span className={u.spin} /> : p.state === 'done' ? '✓' : p.state === 'review' ? '!' : '✕'}
        </div>
        <p className={u.title}>{p.title}</p>
        {p.detail && <p className={u.detail}>{p.detail}</p>}

        {working && (
          <div className={u.track}>
            {p.pct == null ? <span className={u.indet} /> : <span className={u.fill} style={{ width: `${Math.max(3, Math.min(100, p.pct))}%` }} />}
          </div>
        )}

        {p.state === 'review' && (p.failed?.length ?? 0) > 0 && (
          <ul className={u.failList}>
            {p.failed!.map((f) => (<li key={f.name}><b>{f.name}</b><span>{why(f.reason)}</span></li>))}
          </ul>
        )}

        {working && <p className={u.hint}>Please keep this page open until it finishes.</p>}

        {!working && (
          <div className={u.actions}>
            {p.state === 'review' && retryable && p.onRetry && <button className={u.primary} onClick={p.onRetry}>{p.retryLabel ?? 'Retry failed files'}</button>}
            {p.state === 'review' && p.onContinue && <button className={u.secondary} onClick={p.onContinue}>{p.continueLabel ?? 'Continue anyway'}</button>}
            {p.state !== 'review' && p.onClose && <button className={u.secondary} onClick={p.onClose}>{p.closeLabel ?? 'Close'}</button>}
            {p.state === 'review' && !p.onContinue && p.onClose && <button className={u.secondary} onClick={p.onClose}>{p.closeLabel ?? 'Close'}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export function FlashToast({ text, kind = 'ok', onDone, ms = 6000 }: { text: string; kind?: 'ok' | 'bad' | 'info'; onDone: () => void; ms?: number }) {
  useEffect(() => { const t = setTimeout(onDone, ms); return () => clearTimeout(t); }, [text, ms, onDone]);
  return (
    <div className={`${u.toast} ${kind === 'ok' ? u.toastOk : kind === 'bad' ? u.toastBad : u.toastInfo}`} role="status">
      <span>{text}</span>
      <button className={u.toastX} onClick={onDone} aria-label="Dismiss">×</button>
    </div>
  );
}
