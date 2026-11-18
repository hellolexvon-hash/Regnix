/**
 * src/pages/dashboard/DocumentsPage.tsx
 * Every document the company uploaded (KYC, validation documents, live registers),
 * each with its Zoho WorkDrive link. Data: GET /api/client/documents.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { fetchDocuments, formatBytes, fmtDate, type PortalFile } from '@/lib/clientPortal';
import styles from './ZohoPages.module.css';

const CATEGORIES = ['All', 'KYC', 'Validation document', 'Live register'];

export function kindOf(mime: string, name: string): { label: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.includes('pdf') || ext === 'pdf') return { label: 'PDF', color: '#DC2626' };
  if (['xls', 'xlsx', 'xlsm', 'csv'].includes(ext)) return { label: ext.toUpperCase(), color: '#059669' };
  if (['doc', 'docx'].includes(ext)) return { label: ext.toUpperCase(), color: '#2563EB' };
  if (['png', 'jpg', 'jpeg'].includes(ext)) return { label: ext.toUpperCase(), color: '#D97706' };
  return { label: ext ? ext.toUpperCase() : 'FILE', color: '#8B85A8' };
}

export default function DocumentsPage() {
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await fetchDocuments(); setFiles(r.files); setFolderUrl(r.folderUrl); }
    catch (e) { setError((e as Error).message); setFiles([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => files
    .filter(f => cat === 'All' || f.category === cat)
    .filter(f => !query || `${f.title} ${f.name}`.toLowerCase().includes(query.toLowerCase())), [files, cat, query]);

  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);
  const count = (c: string) => files.filter(f => f.category === c).length;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.h1}>Documents</h1>
          <p className={styles.sub}>Everything you've uploaded, stored in your Zoho WorkDrive folder.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {folderUrl && (
            <button className={styles.ghostBtn} onClick={() => window.open(folderUrl, '_blank')}>
              <Icon name="folder" size={13} /> Open WorkDrive folder
            </button>
          )}
          <button className={styles.primaryBtn} onClick={load} disabled={loading}>
            <Icon name="refresh" size={13} className={loading ? styles.spin : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className={styles.statRow}>
        <div className={styles.stat}><span className={styles.statNum}>{files.length}</span><span className={styles.statLabel}>Total files</span></div>
        <div className={styles.stat}><span className={styles.statNum}>{count('KYC')}</span><span className={styles.statLabel}>KYC documents</span></div>
        <div className={styles.stat}><span className={styles.statNum}>{count('Validation document') + count('Live register')}</span><span className={styles.statLabel}>Validation files</span></div>
        <div className={styles.stat}><span className={styles.statNum}>{formatBytes(totalSize)}</span><span className={styles.statLabel}>Total size</span></div>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.chips}>
            {CATEGORIES.map(c => (
              <button key={c} className={`${styles.chip} ${cat === c ? styles.chipActive : ''}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className={styles.searchBox}>
            <Icon name="search" size={13} />
            <input placeholder="Search documents…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search documents" />
          </div>
        </div>

        {error && (
          <div className={styles.errorBox}><Icon name="alert" size={15} /><div><strong>Couldn't load documents.</strong><span>{error}</span></div></div>
        )}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Document</th><th>Category</th><th>Type</th><th>Size</th><th>Uploaded</th><th /></tr></thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6}><div className={styles.skeleton} /></td></tr>)}
              {!loading && visible.map(f => {
                const k = kindOf(f.mime, f.name);
                return (
                  <tr key={f.id} className={styles.tr}>
                    <td>
                      <div className={styles.nameCell}>
                        <span className={styles.fileIcon} style={{ background: `${k.color}14`, color: k.color }}><Icon name="fileText" size={15} /></span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span className={styles.fileName}>{f.title}</span>
                          {f.title !== f.name && <span className={styles.sub} style={{ margin: 0 }}>{f.name}</span>}
                        </span>
                      </div>
                    </td>
                    <td className={styles.muted}>{f.category}</td>
                    <td className={styles.muted}>{k.label}</td>
                    <td className={styles.muted}>{formatBytes(f.size)}</td>
                    <td className={styles.muted}>{fmtDate(f.at)}</td>
                    <td className={styles.actions}>
                      {f.zohoUrl
                        ? <button className={styles.rowBtn} title="Open in Zoho WorkDrive" onClick={() => window.open(f.zohoUrl!, '_blank')}><Icon name="external" size={13} /></button>
                        : <span className={styles.sub} title="Not synced to Zoho">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !error && visible.length === 0 && (
            <div className={styles.empty}><Icon name="cloud" size={24} /><span>No documents yet. Files you upload in Validation or KYC appear here.</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
