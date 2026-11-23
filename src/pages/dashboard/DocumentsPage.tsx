/**
 * src/pages/dashboard/DocumentsPage.tsx
 * Every document the company has uploaded — read from Zoho WorkDrive metadata
 * (validation_zoho_files + kyc_files) with filter, search, preview and open-in-Zoho.
 */
import { Fragment, useMemo, useState } from 'react';
import { Icon } from './Icons';
import { portalFetch, openCertificate, usePortal, timeAgo } from './dashboardApi';
import s from './DashboardPages.module.css';

interface Doc {
  id: string; source: 'validation' | 'kyc' | 'certificate'; category: string; name: string; fileName: string; mimeType: string | null;
  size: number; at: string; zohoUrl: string | null; inZoho: boolean; canPreview: boolean;
}

const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : b ? `${b} B` : '—');
const FILTERS = ['All', 'Certificate', 'Validation document', 'Live register', 'KYC'] as const;

const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string): string {
  const d = new Date(iso); const t = new Date();
  const diff = Math.round((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DocumentsPage() {
  const { data, loading, error, refresh } = usePortal<{ documents: Doc[]; folderUrl: string | null }>('cli-documents');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [busy, setBusy] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [order, setOrder] = useState<'new' | 'old'>('new');

  const docs = data?.documents ?? [];
  const shown = useMemo(() => docs.filter((d) =>
    (filter === 'All' || d.category === filter) &&
    (!q.trim() || `${d.name} ${d.fileName}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (order === 'new' ? +new Date(b.at) - +new Date(a.at) : +new Date(a.at) - +new Date(b.at))), [docs, q, filter, order]);
  const inZoho = docs.filter((d) => d.inZoho).length;
  const totalSize = docs.reduce((a, d) => a + d.size, 0);

  const openFile = async (d: Doc, download: boolean) => {
    setBusy(d.id); setFileErr(null);
    try {
      if (d.source === 'certificate') { await openCertificate(d.id, download, d.fileName); return; }
      const res = await portalFetch('cli-doc-file', {}, `id=${encodeURIComponent(d.id)}`);
      if (!res.ok) throw new Error('This file has no stored preview copy — open it in Zoho instead.');
      const url = URL.createObjectURL(await res.blob());
      if (download) { const a = document.createElement('a'); a.href = url; a.download = d.fileName; a.click(); }
      else window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { setFileErr(e instanceof Error ? e.message : 'Could not open the file.'); }
    finally { setBusy(null); }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.h1}>Documents</h1>
          <p className={s.sub}>Everything you've uploaded, stored in your Zoho WorkDrive company folder.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={s.btn} onClick={() => { void refresh(); }}><Icon name="refresh" size={13} />Refresh</button>
          {data?.folderUrl && <a className={`${s.btn} ${s.btnPrimary}`} href={data.folderUrl} target="_blank" rel="noreferrer"><Icon name="folder" size={13} />Open Zoho folder</a>}
        </div>
      </div>

      <div className={s.stats}>
        <div className={s.stat}><div className={s.statNum}>{docs.length}</div><div className={s.statLabel}>Total files</div></div>
        <div className={s.stat}><div className={s.statNum}>{inZoho}</div><div className={s.statLabel}>Synced to Zoho</div></div>
        <div className={s.stat}><div className={s.statNum}>{docs.filter((d) => d.category === 'KYC').length}</div><div className={s.statLabel}>KYC files</div></div>
        <div className={s.stat}><div className={s.statNum}>{fmtSize(totalSize)}</div><div className={s.statLabel}>Storage used</div></div>
      </div>

      {error && <div className={s.err}>{error}</div>}
      {fileErr && <div className={s.err}>{fileErr}</div>}

      <div className={s.card}>
        <div className={s.toolbar}>
          <label className={s.searchBox}><Icon name="search" size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" aria-label="Search documents" /></label>
          {FILTERS.map((f) => <button key={f} className={`${s.pill} ${filter === f ? s.pillOn : ''}`} onClick={() => setFilter(f)}>{f}</button>)}
          <button className={s.pill} onClick={() => setOrder((o) => (o === 'new' ? 'old' : 'new'))} title="Change sort order">{order === 'new' ? 'Newest first' : 'Oldest first'}</button>
        </div>
        {loading ? (
          <div className={s.state}><div className={s.spin} />Loading your documents…</div>
        ) : shown.length === 0 ? (
          <div className={s.state}><Icon name="folder" size={26} />{docs.length ? 'No documents match your filter.' : 'No documents uploaded yet. Upload registers in Validation and they will appear here.'}</div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>Document</th><th>Category</th><th>Size</th><th>Uploaded</th><th>Zoho</th><th /></tr></thead>
              <tbody>
                {shown.map((d, i) => (
                  <Fragment key={`${d.source}-${d.id}`}>
                    {(i === 0 || dayKey(shown[i - 1].at) !== dayKey(d.at)) && (
                      <tr><td colSpan={6} className={s.dayRow}>{dayLabel(d.at)}</td></tr>
                    )}
                  <tr>
                    <td><div className={s.fileCell}>
                      <span className={s.fileIcon}><Icon name="file" size={16} /></span>
                      <div><div className={s.fileName}>{d.name}</div><div className={s.fileSub}>{d.fileName}</div></div>
                    </div></td>
                    <td><span className={`${s.badge} ${s.b_info}`}>{d.category}</span></td>
                    <td>{fmtSize(d.size)}</td>
                    <td title={new Date(d.at).toLocaleString('en-IN')}>{timeAgo(d.at)}</td>
                    <td>{d.source === 'certificate' ? <span className={`${s.badge} ${s.b_ok}`}><Icon name="award" size={11} />Issued</span> : d.inZoho ? <span className={`${s.badge} ${s.b_ok}`}><Icon name="check" size={11} />Synced</span> : <span className={`${s.badge} ${s.b_mute}`}>Not synced</span>}</td>
                    <td><div className={s.actions}>
                      <button className={s.iconAct} title="Preview" aria-label="Preview" disabled={!d.canPreview || busy === d.id} onClick={() => { void openFile(d, false); }}>{busy === d.id ? <span className={s.spinSm} /> : <Icon name="eye" size={14} />}</button>
                      <button className={s.iconAct} title="Download" aria-label="Download" disabled={!d.canPreview || busy === d.id} onClick={() => { void openFile(d, true); }}><Icon name="download" size={14} /></button>
                      {d.zohoUrl ? <a className={s.iconAct} title="Open in Zoho" aria-label="Open in Zoho" href={d.zohoUrl} target="_blank" rel="noreferrer"><Icon name="external" size={14} /></a>
                        : <button className={s.iconAct} disabled aria-label="Open in Zoho"><Icon name="external" size={14} /></button>}
                    </div></td>
                  </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
