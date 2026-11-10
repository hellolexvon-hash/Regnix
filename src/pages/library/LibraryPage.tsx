import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  CATEGORY_LABEL, LIBRARY_DOCS, formatSize, getDoc,
  type LibraryCategory, type LibraryDoc, type LibraryFormat,
} from '../../data/libraryCatalog';
import { DocCover } from './DocCover';
import { Icon } from './Icons';
import { LibraryReader } from './LibraryReader';
import styles from './LibraryPage.module.css';

type CatFilter = 'all' | LibraryCategory;
type FmtFilter = 'all' | LibraryFormat;
type SortKey = 'title' | 'newest' | 'oldest';
type View = 'grid' | 'list';

const LS = { recents: 'regnix.lib.recents', cat: 'regnix.lib.cat', view: 'regnix.lib.view' };

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

const CHIPS: { key: CatFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'codes', label: CATEGORY_LABEL.codes },
  { key: 'acts', label: CATEGORY_LABEL.acts },
  { key: 'corporate', label: CATEGORY_LABEL.corporate },
];

function docIdFromUrl(): string | null {
  try { return new URLSearchParams(window.location.search).get('doc'); } catch { return null; }
}

export function LibraryPage(): ReactElement {
  const [openId, setOpenId] = useState<string | null>(() => (getDoc(docIdFromUrl()) ? docIdFromUrl() : null));
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<CatFilter>(() => load<CatFilter>(LS.cat, 'all'));
  const [fmt, setFmt] = useState<FmtFilter>('all');
  const [sort, setSort] = useState<SortKey>('title');
  const [view, setView] = useState<View>(() => load<View>(LS.view, 'grid'));
  const [recents, setRecents] = useState<string[]>(() => load<string[]>(LS.recents, []));

  useEffect(() => { save(LS.cat, cat); }, [cat]);
  useEffect(() => { save(LS.view, view); }, [view]);

  useEffect(() => {
    const onPop = (): void => { const id = docIdFromUrl(); setOpenId(getDoc(id) ? id : null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openDoc = useCallback((id: string) => {
    setOpenId(id);
    setRecents((prev) => { const next = [id, ...prev.filter((x) => x !== id)].slice(0, 4); save(LS.recents, next); return next; });
    try { const u = new URL(window.location.href); u.searchParams.set('doc', id); window.history.pushState({}, '', u); } catch { /* ignore */ }
  }, []);

  const closeDoc = useCallback(() => {
    setOpenId(null);
    try { const u = new URL(window.location.href); u.searchParams.delete('doc'); window.history.pushState({}, '', u); } catch { /* ignore */ }
  }, []);

  const counts = useMemo(() => {
    const c: Record<CatFilter, number> = { all: LIBRARY_DOCS.length, codes: 0, acts: 0, corporate: 0 };
    LIBRARY_DOCS.forEach((d) => { c[d.category] += 1; });
    return c;
  }, []);

  const docs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = LIBRARY_DOCS.filter((d) =>
      (cat === 'all' || d.category === cat) &&
      (fmt === 'all' || d.format === fmt) &&
      (!q || [d.title, d.actNo, d.summary, String(d.year), ...d.tags].join(' ').toLowerCase().includes(q)));
    return [...list].sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title) : sort === 'newest' ? b.year - a.year : a.year - b.year);
  }, [query, cat, fmt, sort]);

  const recentDocs = recents.map((id) => getDoc(id)).filter((d): d is LibraryDoc => !!d);
  const open = getDoc(openId);
  if (open) return <LibraryReader doc={open} onBack={closeDoc} />;

  const filtered = query.trim() !== '' || cat !== 'all' || fmt !== 'all';
  const reset = (): void => { setQuery(''); setCat('all'); setFmt('all'); };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>E-Library</p>
          <h1 className={styles.title}>Statutory <em>library</em></h1>
          <p className={styles.sub}>
            Read the Acts, Codes and Rules behind your registers — in the browser or offline.
          </p>
        </div>
        <div className={styles.stats}>
          <div><strong>{LIBRARY_DOCS.length}</strong><span>Documents</span></div>
          <div><strong>{counts.codes}</strong><span>Labour Codes</span></div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, act number, topic…" aria-label="Search library" />
          {query && <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" size={12} /></button>}
        </label>
        <select className={styles.select} value={fmt} onChange={(e) => setFmt(e.target.value as FmtFilter)} aria-label="Format">
          <option value="all">All formats</option><option value="pdf">PDF</option><option value="txt">Text</option>
        </select>
        <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="title">A – Z</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option>
        </select>
        <div className={styles.toggle} role="group" aria-label="Layout">
          <button type="button" className={view === 'grid' ? styles.toggleOn : ''} onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'}><Icon name="grid" /></button>
          <button type="button" className={view === 'list' ? styles.toggleOn : ''} onClick={() => setView('list')} aria-label="List view" aria-pressed={view === 'list'}><Icon name="list" /></button>
        </div>
      </div>

      <div className={styles.chips} role="tablist">
        {CHIPS.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={cat === c.key}
            className={`${styles.chip} ${cat === c.key ? styles.chipOn : ''}`} onClick={() => setCat(c.key)}>
            {c.label}<span>{counts[c.key]}</span>
          </button>
        ))}
      </div>

      {recentDocs.length > 0 && !filtered && (
        <section className={styles.recent}>
          <h2 className={styles.h2}>Recently opened</h2>
          <div className={styles.recentRow}>
            {recentDocs.map((d) => (
              <button key={d.id} type="button" className={styles.recentItem} onClick={() => openDoc(d.id)}>
                <div className={styles.recentCover}><DocCover doc={d} size="sm" /></div>
                <span><strong>{d.shortTitle}</strong><small>{d.actNo}</small></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <p className={styles.count}>{docs.length} {docs.length === 1 ? 'document' : 'documents'}</p>

      {docs.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="book" size={28} />
          <h3>No documents match</h3>
          <p>Try a different keyword or clear the filters.</p>
          <button type="button" className={styles.btnGhost} onClick={reset}>Clear filters</button>
        </div>
      ) : (
        <div className={view === 'grid' ? styles.grid : styles.rows}>
          {docs.map((d) => (
            <article key={d.id} className={view === 'grid' ? styles.card : styles.row}>
              <button type="button" className={styles.coverBtn} onClick={() => openDoc(d.id)} aria-label={`Read ${d.title}`}>
                <DocCover doc={d} size={view === 'grid' ? 'md' : 'sm'} />
              </button>
              <div className={styles.body}>
                <span className={styles.meta}>{CATEGORY_LABEL[d.category]} · {d.actNo}</span>
                <h3 className={styles.name}>{d.title}</h3>
                <p className={styles.summary}>{d.summary}</p>
                {d.usedIn && d.usedIn.length > 0 && (
                  <span className={styles.used} title={d.usedIn.join(' · ')}><Icon name="link" size={11} />Used in Regnix</span>
                )}
                <div className={styles.foot}>
                  <span className={styles.size}>{d.format === 'pdf' ? `PDF · ${d.pages} pages` : 'Text'} · {formatSize(d.sizeKb)}</span>
                  <div className={styles.actions}>
                    <button type="button" className={styles.btnPrimary} onClick={() => openDoc(d.id)}><Icon name="book" size={14} />Read</button>
                    <a className={styles.btnIcon} href={d.file} download={d.file.split('/').pop()} aria-label={`Download ${d.shortTitle}`} title="Download"><Icon name="download" size={15} /></a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className={styles.note}>
        <Icon name="info" size={13} /> Reference copies for convenience. Always verify against the official Gazette of India before relying on a provision.
      </p>
    </div>
  );
}
