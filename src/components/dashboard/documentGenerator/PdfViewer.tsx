/**
 * PdfViewer.tsx
 *
 * A fully self-hosted, in-browser PDF rendering environment for Regnix.
 * Built on pdfjs-dist (Mozilla PDF.js) — renders directly to <canvas>,
 * zero external services, zero iframes, zero third-party viewer embeds.
 * All processing happens client-side in the browser's own JS engine.
 *
 * Mounts via React Portal as a full-screen window, sharing the exact same
 * macOS-style window chrome (traffic lights, spring-open animation,
 * minimize-to-dock) as LiveRegister.tsx, so the two viewers feel like one
 * consistent "Regnix Document Workspace" rather than two different tools.
 *
 * Features:
 *  — Full-screen by default; "Zoom" traffic light toggles windowed mode
 *  — Canvas-based page rendering at device pixel ratio (crisp on retina)
 *  — Page navigation: prev/next, jump-to-page, keyboard arrows
 *  — Zoom: +/-, fit-width, fit-page, percentage readout
 *  — Thumbnail rail (left) for quick navigation across all pages
 *  — In-document text search using PDF.js's text layer (find-as-you-type,
 *    match count, next/prev match, auto-scroll + highlight)
 *  — Rotate page view (90° increments)
 *  — Download original file
 *  — Print (browser-native print of the rendered pages)
 *  — Loading / error states, page-by-page lazy rendering for large PDFs
 *  — Minimize-to-dock bubble matching LiveRegister's pattern
 *
 * Zero inline styles — all from PdfViewer.module.css.
 */

import {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import pv from './PdfViewer.module.css';

/**
 * ── PDF.js worker setup ──────────────────────────────────────────────────────
 * This MUST be self-hosted (no CDN) to satisfy "developer-owned environment."
 * The pattern below is Mozilla's official, currently-recommended approach for
 * Vite, Webpack 5+, and other modern bundlers that support `import.meta.url` +
 * `new URL(...)` asset resolution — the bundler detects this pattern at build
 * time and emits the worker file as a proper static asset alongside your build,
 * fingerprinted and cached like any other asset. No network call, no CDN.
 *
 * IMPORTANT — this line must stay in the same module where PdfViewer is used
 * (not hoisted into a separate "setup" file), because some bundlers resolve
 * `import.meta.url` relative to the file it's written in. Keeping it here,
 * at the top of this component file, is intentional.
 *
 * If your bundler does NOT support this pattern (e.g. an older Webpack 4
 * config, or a custom esbuild setup without `import.meta.url` asset
 * resolution), copy these two files into your `public/` directory instead
 * and point workerSrc at the public path:
 *
 *   cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
 *   // then:
 *   pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfViewerProps {
  open:          boolean;
  onClose:       () => void;
  file:          File | Blob | null;
  fileName?:     string;
  companyName?:  string;
}

type WindowState  = 'open' | 'closing' | 'minimizing' | 'closed';
type FitMode       = 'width' | 'page' | 'custom';

interface SearchMatch {
  pageIndex: number; // 0-based
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function clampZoomIndex(i: number): number {
  return Math.max(0, Math.min(ZOOM_STEPS.length - 1, i));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Minimized dock bubble (matches LiveRegister's MiniBubble) ──────────────

function MiniBubble({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className={pv.miniBubble} onClick={onClick} title={`Restore ${label}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span>{label}</span>
    </div>
  );
}

// ─── Single page canvas renderer ────────────────────────────────────────────

interface PageCanvasProps {
  pdf:        PDFDocumentProxy;
  pageNumber: number;       // 1-based
  scale:      number;
  rotation:   number;
  isVisible:  boolean;      // lazy-render gate
  onRendered?: (pageNumber: number) => void;
}

function PageCanvas({ pdf, pageNumber, scale, rotation, isVisible, onRendered }: PageCanvasProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    (async () => {
      const page: PDFPageProxy = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale, rotation });
      const canvas   = canvasRef.current;
      if (!canvas) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5); // cap for memory
      canvas.width  = Math.floor(viewport.width  * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width  = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Cancel any in-flight render for this page before starting a new one
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* noop */ }
      }

      const task = page.render({ canvas, canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
        if (!cancelled) {
          setRendered(true);
          onRendered?.(pageNumber);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Failed to render page ${pageNumber}:`, err);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [pdf, pageNumber, scale, rotation, isVisible]);

  return (
    <div className={pv.pageWrap} data-page={pageNumber}>
      {!rendered && isVisible && (
        <div className={pv.pageSkeleton}>
          <div className={pv.pageSkeletonSpinner} />
        </div>
      )}
      <canvas ref={canvasRef} className={pv.pageCanvas} />
      <div className={pv.pageNumberBadge}>{pageNumber}</div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function PdfViewer({
  open,
  onClose,
  file,
  fileName    = 'Document.pdf',
  companyName = '',
}: PdfViewerProps) {

  // ── Window state ────────────────────────────────────────────────────────────
  const [winState,   setWinState]   = useState<WindowState>('closed');
  const [minimized,  setMinimized]  = useState(false);
  const [isFloating, setIsFloating] = useState(false);

  // ── Document state ──────────────────────────────────────────────────────────
  const [pdf,        setPdf]        = useState<PDFDocumentProxy | null>(null);
  const [numPages,   setNumPages]   = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [loadErr,    setLoadErr]    = useState('');
  const [fileSize,   setFileSize]   = useState(0);

  // ── View state ───────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomIdx,     setZoomIdx]     = useState(4); // index into ZOOM_STEPS → 1.0
  const [fitMode,      setFitMode]    = useState<FitMode>('width');
  const [rotation,     setRotation]   = useState(0);
  const [showThumbs,   setShowThumbs] = useState(true);
  const [jumpInput,    setJumpInput]  = useState('1');

  // ── Search state ─────────────────────────────────────────────────────────────
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching,   setSearching]   = useState(false);
  const [matches,     setMatches]     = useState<SearchMatch[]>([]);
  const [matchIdx,    setMatchIdx]    = useState(0);

  const viewerRef     = useRef<HTMLDivElement>(null);
  const pageRefs       = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerWidth = useRef(0);
  const closeRef        = useRef<() => void>(() => {});

  const zoom = ZOOM_STEPS[zoomIdx];

  // ── Window open / close animation ───────────────────────────────────────────
  useEffect(() => {
    if (open && !minimized) {
      setWinState('open');
    } else if (!open && winState !== 'closed') {
      setWinState('closing');
      const t = setTimeout(() => setWinState('closed'), 380);
      return () => clearTimeout(t);
    }
  }, [open, minimized]);

  useEffect(() => {
    if (winState === 'open') setIsFloating(false);
  }, [open]);

  // ── Escape key closes the window ────────────────────────────────────────────
  useEffect(() => {
    if (winState === 'closed') return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); return; }
        closeRef.current();
      }
      // Page navigation via arrow keys (only when not typing in an input)
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (isTyping) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goToPage(currentPage + 1);
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   goToPage(currentPage - 1);
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); setSearchOpen(true); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winState, currentPage, searchOpen]);

  // ── Load PDF when file changes ──────────────────────────────────────────────
  useEffect(() => {
    if (!file || !open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadErr('');
      setPdf(null);
      setCurrentPage(1);
      setJumpInput('1');
      setSearchQuery('');
      setMatches([]);

      try {
        const buf = await file.arrayBuffer();
        setFileSize(buf.byteLength);
        const loadingTask = pdfjsLib.getDocument({ data: buf });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
      } catch (err: any) {
        if (!cancelled) setLoadErr(err?.message ?? 'Failed to load PDF document');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [file, open]);

  // Clean up the PDF document on unmount / file change
  useEffect(() => {
    return () => { pdf?.destroy().catch(() => {}); };
  }, [pdf]);

  // ── Track container width for fit-width mode ────────────────────────────────
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerWidth.current = entry.contentRect.width;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Page intersection tracking (update currentPage as user scrolls) ────────
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1, 2, 3]));
  useEffect(() => {
    if (!pdf || !viewerRef.current) return;
    const el = viewerRef.current;

    const io = new IntersectionObserver(entries => {
      setVisiblePages(prev => {
        const next = new Set(prev);
        let mostVisiblePage: number | null = null;
        let mostVisibleRatio = 0;
        for (const entry of entries) {
          const pn = Number((entry.target as HTMLElement).dataset.page);
          if (entry.isIntersecting) {
            next.add(pn);
            if (entry.intersectionRatio > mostVisibleRatio) {
              mostVisibleRatio = entry.intersectionRatio;
              mostVisiblePage  = pn;
            }
          }
        }
        if (mostVisiblePage != null) {
          setCurrentPage(mostVisiblePage);
          setJumpInput(String(mostVisiblePage));
        }
        return next;
      });
    }, { root: el, rootMargin: '600px 0px 600px 0px', threshold: [0, 0.5, 1] });

    pageRefs.current.forEach(node => io.observe(node));
    return () => io.disconnect();
  }, [pdf, numPages]);

  // ── Derived: effective scale for fit-width / fit-page modes ────────────────
  const [basePageWidth, setBasePageWidth] = useState(612); // default US-letter pt width

  useEffect(() => {
    if (!pdf) return;
    pdf.getPage(1).then(page => {
      const vp = page.getViewport({ scale: 1, rotation });
      setBasePageWidth(vp.width);
    }).catch(() => {});
  }, [pdf, rotation]);

  const effectiveScale = useMemo(() => {
    if (fitMode === 'width' && containerWidth.current > 0) {
      const padding = 64; // matches CSS .pageScroll padding
      return Math.max(0.25, (containerWidth.current - padding) / basePageWidth);
    }
    if (fitMode === 'page' && containerWidth.current > 0) {
      const availH = window.innerHeight - 220; // toolbar + statusbar approx
      return Math.max(0.25, availH / (basePageWidth * 1.414)); // assume A4-ish ratio fallback
    }
    return zoom;
  }, [fitMode, zoom, basePageWidth]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goToPage = useCallback((n: number) => {
    if (!pdf) return;
    const clamped = Math.max(1, Math.min(numPages, n));
    setCurrentPage(clamped);
    setJumpInput(String(clamped));
    const node = pageRefs.current.get(clamped);
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pdf, numPages]);

  function handleJumpSubmit() {
    const n = parseInt(jumpInput, 10);
    if (!isNaN(n)) goToPage(n);
    else setJumpInput(String(currentPage));
  }

  // ── Zoom controls ────────────────────────────────────────────────────────────
  function zoomIn()  { setFitMode('custom'); setZoomIdx(i => clampZoomIndex(i + 1)); }
  function zoomOut() { setFitMode('custom'); setZoomIdx(i => clampZoomIndex(i - 1)); }
  function setFitWidth() { setFitMode('width'); }
  function setFitPage()  { setFitMode('page'); }
  function rotateCw()    { setRotation(r => (r + 90) % 360); }

  // ── Search (using PDF.js text content extraction) ───────────────────────────
  const runSearch = useCallback(async (query: string) => {
    if (!pdf || !query.trim()) { setMatches([]); return; }
    setSearching(true);
    const q = query.trim().toLowerCase();
    const found: SearchMatch[] = [];
    try {
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((it: any) => it.str).join(' ').toLowerCase();
        if (pageText.includes(q)) {
          found.push({ pageIndex: i - 1 });
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setMatches(found);
      setMatchIdx(0);
      setSearching(false);
      if (found.length > 0) goToPage(found[0].pageIndex + 1);
    }
  }, [pdf, numPages, goToPage]);

  useEffect(() => {
    const t = setTimeout(() => { if (searchOpen) runSearch(searchQuery); }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, searchOpen, runSearch]);

  function nextMatch() {
    if (!matches.length) return;
    const next = (matchIdx + 1) % matches.length;
    setMatchIdx(next);
    goToPage(matches[next].pageIndex + 1);
  }
  function prevMatch() {
    if (!matches.length) return;
    const prev = (matchIdx - 1 + matches.length) % matches.length;
    setMatchIdx(prev);
    goToPage(matches[prev].pageIndex + 1);
  }

  // ── Download / Print ────────────────────────────────────────────────────────
  function handleDownload() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handlePrint() {
    window.print();
  }

  // ── Window handlers ──────────────────────────────────────────────────────────
  const handleClose = () => {
    setWinState('closing');
    setTimeout(onClose, 360);
  };
  closeRef.current = handleClose;

  const handleMinimize = () => {
    setWinState('minimizing');
    setTimeout(() => { setMinimized(true); setWinState('closed'); }, 340);
  };

  const handleRestore = () => {
    setMinimized(false);
    setWinState('open');
  };

  // ── Render guards ────────────────────────────────────────────────────────────
  if (typeof document === 'undefined') return null;
  if (winState === 'closed' && !minimized) return null;

  const windowClass = [
    pv.window,
    winState === 'open'       ? pv.windowOpen       : '',
    winState === 'closing'    ? pv.windowClosing    : '',
    winState === 'minimizing' ? pv.windowMinimizing : '',
    isFloating                 ? pv.windowFloating   : '',
  ].filter(Boolean).join(' ');

  return createPortal(
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      {winState !== 'closed' && (
        <div
          className={`${pv.backdrop} ${winState === 'open' ? pv.backdropIn : pv.backdropOut}`}
          onClick={handleClose}
        />
      )}

      {/* ── Main window ──────────────────────────────────────────────────── */}
      {winState !== 'closed' && (
        <div className={windowClass}>

          {/* ── Title bar ─────────────────────────────────────────────── */}
          <div className={pv.titleBar}>
            <div className={pv.trafficLights}>
              <button className={`${pv.tl} ${pv.tlClose}`} onClick={handleClose}    aria-label="Close" />
              <button className={`${pv.tl} ${pv.tlMin}`}   onClick={handleMinimize} aria-label="Minimise" />
              <button className={`${pv.tl} ${pv.tlMax}`}
                onClick={() => setIsFloating(f => !f)}
                aria-label={isFloating ? 'Enter Full Screen' : 'Exit Full Screen'}
                title={isFloating ? 'Enter Full Screen' : 'Exit Full Screen'} />
            </div>

            <div className={pv.titleCenter}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF5F57" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className={pv.titleText}>{fileName}</span>
              {companyName && <span className={pv.titleCompany}>{companyName}</span>}
              {numPages > 0 && <span className={pv.titlePages}>{numPages} page{numPages !== 1 ? 's' : ''}</span>}
            </div>

            <div className={pv.titleActions}>
              <button className={pv.tbBtn} onClick={() => setShowThumbs(v => !v)} title="Toggle thumbnails">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
                Pages
              </button>
              <button className={pv.tbBtn} onClick={() => setSearchOpen(v => !v)} title="Search (⌘F)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Search
              </button>
              <button className={pv.tbBtn} onClick={handlePrint} title="Print">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print
              </button>
              <button className={`${pv.tbBtn} ${pv.tbBtnAccent}`} onClick={handleDownload} title="Download original file">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </button>
            </div>
          </div>

          {/* ── Toolbar: zoom / page nav / rotate ────────────────────────── */}
          <div className={pv.toolbar}>

            <div className={pv.toolGroup}>
              <button className={pv.toolBtn} onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} title="Previous page">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className={pv.pageJump}>
                <input
                  className={pv.pageJumpInput}
                  value={jumpInput}
                  onChange={e => setJumpInput(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleJumpSubmit()}
                  onBlur={handleJumpSubmit}
                />
                <span className={pv.pageJumpSep}>/</span>
                <span className={pv.pageJumpTotal}>{numPages || '—'}</span>
              </div>
              <button className={pv.toolBtn} onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages} title="Next page">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            <div className={pv.toolDivider} />

            <div className={pv.toolGroup}>
              <button className={pv.toolBtn} onClick={zoomOut} disabled={zoomIdx === 0} title="Zoom out">−</button>
              <span className={pv.zoomReadout}>{Math.round(effectiveScale * 100)}%</span>
              <button className={pv.toolBtn} onClick={zoomIn} disabled={zoomIdx === ZOOM_STEPS.length - 1} title="Zoom in">+</button>
              <button className={`${pv.toolBtn} ${pv.toolBtnText} ${fitMode === 'width' ? pv.toolBtnActive : ''}`} onClick={setFitWidth} title="Fit width">Width</button>
              <button className={`${pv.toolBtn} ${pv.toolBtnText} ${fitMode === 'page' ? pv.toolBtnActive : ''}`} onClick={setFitPage} title="Fit page">Page</button>
            </div>

            <div className={pv.toolDivider} />

            <div className={pv.toolGroup}>
              <button className={pv.toolBtn} onClick={rotateCw} title="Rotate 90°">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/>
                  <path d="M2 11.5a10 10 0 0118-6.5l1.5 1.5"/><path d="M22 12.5a10 10 0 01-18 6.5l-1.5-1.5"/>
                </svg>
              </button>
            </div>

            {/* ── Search bar (inline, expands toolbar) ── */}
            {searchOpen && (
              <div className={pv.searchBar}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  className={pv.searchInput}
                  placeholder="Search in document…"
                  value={searchQuery}
                  autoFocus
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.shiftKey ? prevMatch() : nextMatch());
                    if (e.key === 'Escape') setSearchOpen(false);
                  }}
                />
                <span className={pv.searchCount}>
                  {searching ? '…' : matches.length > 0 ? `${matchIdx + 1} / ${matches.length} pages` : searchQuery ? 'No matches' : ''}
                </span>
                <button className={pv.searchNavBtn} onClick={prevMatch} disabled={!matches.length} title="Previous match">↑</button>
                <button className={pv.searchNavBtn} onClick={nextMatch} disabled={!matches.length} title="Next match">↓</button>
                <button className={pv.searchCloseBtn} onClick={() => setSearchOpen(false)}>✕</button>
              </div>
            )}

            <div className={pv.toolSpacer} />
            <span className={pv.fileSizeLabel}>{fileSize > 0 ? formatFileSize(fileSize) : ''}</span>
          </div>

          {/* ── Body: thumbnails + page viewer ───────────────────────────── */}
          <div className={`${pv.main} ${showThumbs ? pv.mainWithThumbs : ''}`}>

            {/* Thumbnail rail */}
            {showThumbs && pdf && (
              <div className={pv.thumbRail}>
                {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    className={`${pv.thumbItem} ${n === currentPage ? pv.thumbItemActive : ''}`}
                    onClick={() => goToPage(n)}
                  >
                    <div className={pv.thumbCanvasWrap}>
                      <ThumbCanvas pdf={pdf} pageNumber={n} isVisible={Math.abs(n - currentPage) < 30} />
                    </div>
                    <span className={pv.thumbLabel}>{n}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Page scroll area */}
            <div className={pv.pageScrollOuter} ref={viewerRef}>

              {/* Loading */}
              {loading && (
                <div className={pv.loadingState}>
                  <div className={pv.spinner} />
                  <span>Rendering document…</span>
                </div>
              )}

              {/* Error */}
              {!loading && loadErr && (
                <div className={pv.errorState}>
                  <div className={pv.errorIcon}>⚠</div>
                  <h3 className={pv.errorTitle}>Could not render this PDF</h3>
                  <p className={pv.errorSub}>{loadErr}</p>
                  <button className={pv.errorRetryBtn} onClick={handleDownload}>⬇ Download file instead</button>
                </div>
              )}

              {/* Empty (no file) */}
              {!loading && !loadErr && !file && (
                <div className={pv.errorState}>
                  <div className={pv.errorIcon}>📄</div>
                  <h3 className={pv.errorTitle}>No document loaded</h3>
                  <p className={pv.errorSub}>Select a PDF from the file manager to preview it here.</p>
                </div>
              )}

              {/* Pages */}
              {!loading && !loadErr && pdf && (
                <div className={pv.pageScroll}>
                  {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
                    <div
                      key={n}
                      ref={node => { if (node) pageRefs.current.set(n, node); else pageRefs.current.delete(n); }}
                      data-page={n}
                    >
                      <PageCanvas
                        pdf={pdf}
                        pageNumber={n}
                        scale={effectiveScale}
                        rotation={rotation}
                        isVisible={visiblePages.has(n) || Math.abs(n - currentPage) <= 2}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Status bar ────────────────────────────────────────────── */}
          <div className={pv.statusBar}>
            <span>Page {currentPage} of {numPages || '—'}</span>
            <span className={pv.statusSep}>·</span>
            <span>{Math.round(effectiveScale * 100)}% zoom</span>
            {rotation !== 0 && (
              <><span className={pv.statusSep}>·</span><span>Rotated {rotation}°</span></>
            )}
            {matches.length > 0 && (
              <><span className={pv.statusSep}>·</span><span>{matches.length} page{matches.length !== 1 ? 's' : ''} match "{searchQuery}"</span></>
            )}
            <span className={pv.statusRight}>Regnix Document Workspace · Rendered locally in your browser</span>
          </div>
        </div>
      )}

      {/* ── Minimized dock bubble ─────────────────────────────────────────── */}
      {minimized && <MiniBubble onClick={handleRestore} label={fileName} />}
    </>,
    document.body,
  );
}

// ─── Thumbnail canvas (smaller, lower-res render for the rail) ─────────────

function ThumbCanvas({ pdf, pageNumber, isVisible }: {
  pdf: PDFDocumentProxy; pageNumber: number; isVisible: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!isVisible || rendered) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 0.18 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      try {
        // include the canvas element as required by RenderParameters
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setRendered(true);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [pdf, pageNumber, isVisible, rendered]);

  return <canvas ref={canvasRef} className={pv.thumbCanvas} />;
}
