import { Fragment, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { CATEGORY_LABEL, formatSize, type LibraryDoc } from '../../data/libraryCatalog';
import { blockText, parseLegalText, type Block, type ParsedDoc } from './parseLegalText';
import { Icon } from './Icons';
import styles from './LibraryReader.module.css';

interface Props { doc: LibraryDoc; onBack: () => void }

const FS_KEY = 'regnix.lib.fontSize';
const fileName = (d: LibraryDoc): string => d.file.split('/').pop() ?? 'document';

function Toolbar({ doc, onBack, children }: Props & { children?: ReactNode }): ReactElement {
  return (
    <div className={styles.bar}>
      <button type="button" className={styles.back} onClick={onBack}><Icon name="back" size={15} />Library</button>
      <div className={styles.barTitle}>
        <strong>{doc.title}</strong>
        <span>{CATEGORY_LABEL[doc.category]} · {doc.actNo} · {doc.format === 'pdf' ? `${doc.pages} pages` : 'Text'} · {formatSize(doc.sizeKb)}</span>
      </div>
      <div className={styles.barTools}>
        {children}
        <a className={styles.dl} href={doc.file} download={fileName(doc)}><Icon name="download" size={14} /><span>Download</span></a>
      </div>
    </div>
  );
}

function PdfReader({ doc, onBack }: Props): ReactElement {
  const [page, setPage] = useState(1);
  const [src, setSrc] = useState(`${doc.file}#view=FitH&navpanes=0`);
  const [loaded, setLoaded] = useState(false);
  const [key, setKey] = useState(0);
  const jump = (n: number): void => {
    const p = Math.min(Math.max(1, n || 1), doc.pages ?? 1);
    setPage(p); setSrc(`${doc.file}#page=${p}&view=FitH&navpanes=0`); setKey((k) => k + 1);
  };
  return (
    <div className={styles.shell}>
      <Toolbar doc={doc} onBack={onBack}>
        <label className={styles.jump}>Page
          <input type="number" min={1} max={doc.pages} value={page}
            onChange={(e) => setPage(Number(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') jump(page); }} aria-label="Go to page" />
          <span>/ {doc.pages}</span>
        </label>
        <a className={styles.ghost} href={doc.file} target="_blank" rel="noreferrer"><Icon name="external" size={14} /><span>New tab</span></a>
      </Toolbar>
      <div className={styles.pdfWrap}>
        {!loaded && <div className={styles.skeleton}><span /></div>}
        <iframe key={key} className={styles.pdf} src={src} title={doc.title} onLoad={() => setLoaded(true)} />
      </div>
      <p className={styles.hint}>Not displaying? Some mobile browsers can't embed PDFs — use <a href={doc.file} target="_blank" rel="noreferrer">New tab</a> or Download.</p>
    </div>
  );
}

function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase(); const needle = q.toLowerCase();
  const out: ReactNode[] = []; let i = 0; let n = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, i)) {
    if (at > i) out.push(text.slice(i, at));
    out.push(<mark key={n++} data-hit>{text.slice(at, at + needle.length)}</mark>);
    i = at + needle.length;
  }
  out.push(text.slice(i));
  return out;
}

function BlockView({ b, q }: { b: Block; q: string }): ReactElement {
  const body = (
    <>{b.lead && <span className={styles.lead}>{b.lead} </span>}{highlight(b.text, q)}</>
  );
  switch (b.kind) {
    case 'heading': return <h3 className={styles.bh}>{highlight(b.text, q)}</h3>;
    case 'section': return <p className={styles.bs} id={b.sectionNo ? `sec-${b.sectionNo}` : undefined}>{body}</p>;
    case 'clause': return <p className={`${styles.bc} ${styles[`l${b.level ?? 0}`]}`}>{body}</p>;
    case 'raw': return <pre className={styles.raw}>{b.text}</pre>;
    default: return <p className={styles.bp}>{body}</p>;
  }
}

function TextReader({ doc, onBack }: Props): ReactElement {
  const [parsed, setParsed] = useState<ParsedDoc | null>(null);
  const [error, setError] = useState('');
  const [idx, setIdx] = useState(0);
  const [q, setQ] = useState('');
  const [hit, setHit] = useState(0);
  const [goto, setGoto] = useState('');
  const [gotoErr, setGotoErr] = useState(false);
  const [pendingBlock, setPendingBlock] = useState<number | null>(null);
  const [fs, setFs] = useState<number>(() => { try { return Number(localStorage.getItem(FS_KEY)) || 16; } catch { return 16; } });
  const [tocOpen, setTocOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let off = false;
    fetch(doc.file).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((t) => { if (!off) setParsed(parseLegalText(t)); })
      .catch((e: unknown) => { if (!off) setError(e instanceof Error ? e.message : 'Failed to load'); });
    return () => { off = true; };
  }, [doc.file]);

  useEffect(() => { try { localStorage.setItem(FS_KEY, String(fs)); } catch { /* ignore */ } }, [fs]);

  const term = q.trim().length >= 2 ? q.trim() : '';
  const matches = useMemo(() => {
    if (!parsed || !term) return [] as number[];
    const t = term.toLowerCase();
    return parsed.sections.flatMap((s, i) => (
      (s.label + ' ' + s.title).toLowerCase().includes(t) || s.blocks.some((b) => blockText(b).toLowerCase().includes(t)) ? [i] : []));
  }, [parsed, term]);

  const goSection = (i: number): void => { setIdx(i); setTocOpen(false); pageRef.current?.scrollTo({ top: 0 }); };
  const nav = (d: number): void => { if (parsed) goSection(Math.min(Math.max(0, idx + d), parsed.sections.length - 1)); };

  const cycleHit = (d: number): void => {
    if (!matches.length) return;
    const cur = matches.indexOf(idx);
    const next = cur === -1 ? (d > 0 ? 0 : matches.length - 1) : (cur + d + matches.length) % matches.length;
    setHit(next); goSection(matches[next]);
  };

  const submitGoto = (): void => {
    const no = goto.trim().toUpperCase();
    const at = parsed?.sectionIndex.get(no);
    if (!at) { setGotoErr(true); return; }
    setGotoErr(false); setIdx(at[0]); setPendingBlock(at[1]); setTocOpen(false);
  };

  // scroll to a target block (go-to-section) or the first highlight after render
  useEffect(() => {
    const root = pageRef.current; if (!root) return;
    if (pendingBlock !== null) {
      root.querySelector<HTMLElement>(`[data-b="${pendingBlock}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      setPendingBlock(null);
    } else if (term) {
      root.querySelector<HTMLElement>('mark[data-hit]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [idx, pendingBlock, term, hit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT') { e.preventDefault(); searchRef.current?.focus(); return; }
      if (tag === 'INPUT') return;
      if (e.key === 'ArrowRight') nav(1);
      if (e.key === 'ArrowLeft') nav(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const section = parsed?.sections[idx];

  return (
    <div className={styles.shell}>
      <Toolbar doc={doc} onBack={onBack}>
        <div className={styles.fs} role="group" aria-label="Text size">
          <button type="button" onClick={() => setFs((v) => Math.max(13, v - 1))} aria-label="Smaller text">A−</button>
          <button type="button" onClick={() => setFs((v) => Math.min(24, v + 1))} aria-label="Larger text">A+</button>
        </div>
      </Toolbar>

      <div className={styles.subbar}>
        <button type="button" className={styles.tocBtn} onClick={() => setTocOpen((o) => !o)}><Icon name="list" size={14} />Contents</button>
        <label className={styles.find}>
          <Icon name="search" size={14} />
          <input ref={searchRef} value={q} onChange={(e) => { setQ(e.target.value); setHit(0); }} placeholder="Search in document  ( / )" aria-label="Search in document"
            onKeyDown={(e) => { if (e.key === 'Enter') cycleHit(e.shiftKey ? -1 : 1); }} />
          {term && <span className={styles.hits}>{matches.length ? `${hit + 1 > matches.length ? 1 : hit + 1}/${matches.length} chapters` : 'No match'}</span>}
        </label>
        {term && matches.length > 0 && (
          <div className={styles.fs}>
            <button type="button" onClick={() => cycleHit(-1)} aria-label="Previous match"><Icon name="up" size={14} /></button>
            <button type="button" onClick={() => cycleHit(1)} aria-label="Next match"><Icon name="down" size={14} /></button>
          </div>
        )}
        <label className={`${styles.find} ${styles.goto} ${gotoErr ? styles.err : ''}`}>
          <span>Go to section</span>
          <input value={goto} onChange={(e) => { setGoto(e.target.value); setGotoErr(false); }} placeholder="e.g. 188"
            onKeyDown={(e) => { if (e.key === 'Enter') submitGoto(); }} aria-label="Go to section number" />
        </label>
      </div>

      <div className={styles.split}>
        <nav className={`${styles.toc} ${tocOpen ? styles.tocOpen : ''}`} aria-label="Contents">
          {parsed?.sections.map((s, i) => (
            <button key={s.id} type="button" className={`${styles.tocItem} ${i === idx ? styles.tocOn : ''}`} onClick={() => goSection(i)}>
              <b>{s.label}</b>{s.title && <span>{s.title}</span>}
              {term && matches.includes(i) && <i className={styles.dot} />}
            </button>
          ))}
        </nav>

        <div className={styles.page} ref={pageRef}>
          {error && <div className={styles.msg}>Couldn't load this document ({error}). <a href={doc.file} download={fileName(doc)}>Download it instead</a>.</div>}
          {!parsed && !error && <div className={styles.skeleton}><span /></div>}
          {section && parsed && (
            <article className={styles.paper} style={{ fontSize: fs }}>
              <header className={styles.chHead}>
                <small>{section.label}</small>
                {section.title && <h2>{section.title}</h2>}
              </header>
              {section.blocks.map((b, i) => (
                <Fragment key={i}><div data-b={i}><BlockView b={b} q={term} /></div></Fragment>
              ))}
              <footer className={styles.pager}>
                <button type="button" disabled={idx === 0} onClick={() => nav(-1)}><Icon name="back" size={14} />Previous</button>
                <span>{idx + 1} of {parsed.sections.length}</span>
                <button type="button" disabled={idx === parsed.sections.length - 1} onClick={() => nav(1)}>Next<Icon name="chevron" size={14} /></button>
              </footer>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}

export function LibraryReader({ doc, onBack }: Props): ReactElement {
  return doc.format === 'pdf' ? <PdfReader doc={doc} onBack={onBack} /> : <TextReader doc={doc} onBack={onBack} />;
}
