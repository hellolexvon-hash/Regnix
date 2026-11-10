/**
 * parseLegalText.ts — turns a plain-text Act (hard-wrapped lines, page numbers, repeated
 * "arrangement of sections") into readable sections made of reflowed paragraphs.
 */

export type BlockKind = 'section' | 'clause' | 'para' | 'heading' | 'raw';

export interface Block {
  kind: BlockKind;
  /** Visible text. For 'section' blocks, `lead` is rendered bold before `text`. */
  text: string;
  lead?: string;
  /** Clause nesting 0–2. */
  level?: 0 | 1 | 2;
  /** Section number, e.g. "2A" (first occurrence in the body only). */
  sectionNo?: string;
}

export interface DocSection {
  id: string;
  label: string;
  title: string;
  blocks: Block[];
}

export interface ParsedDoc {
  sections: DocSection[];
  /** section number → [sectionIdx, blockIdx] for "go to section". */
  sectionIndex: Map<string, [number, number]>;
}

const CHAPTER_RE = /^CHAPTER\s+([IVXLCDM]+[A-Z]?)\s*$/;
const ORD = '(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH)';
const SCHEDULE_RE = new RegExp(`^(?:THE\\s+)?(?:${ORD}\\s+)?SCHEDULE(?:\\s+[IVXL]+)?\\s*$`);
const SECTION_TITLE_RE = /^(\d{1,3}[A-Z]{0,2})\.\s+([^.]{3,220}?\.)\s*[—–-]\s*(.*)$/;
const SECTION_NUM_RE = /^(\d{1,3}[A-Z]{0,2})\.\s+(.+)$/;
const CLAUSE_RE = /^\((?:\d+[A-Z]?|[a-z]{1,3}|[ivx]+|[A-Z])\)\s/;
const ROMAN_CLAUSE_RE = /^\((?:ii|iii|iv|v|vi|vii|viii|ix|x)\)\s/;
const LETTER_CLAUSE_RE = /^\([a-z]{1,2}\)\s/;
const STARTS_NEW_RE = /^(Explanation|Provided|Illustration|Note|Notes|THE\s|SCHEDULE|PART\s|Form\s|FORM\s)/;

function isShoutingHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 110) return false;
  return /[A-Z]/.test(t) && t === t.toUpperCase() && !/[.;:,]$/.test(t) && !/^\(/.test(t);
}

/** Running page headers copied from the Gazette PDFs. */
const NOISE_RE = /GAZETTE OF INDIA|^EXTRAORDINARY$|^\[?PART II\s*[—–-]\s*(?:Sec(?:tion)?\.?\s*\d+)?\]?$/i;

/** Drop page-number lines: a bare number equal to (last page number + 1), and running headers. */
function stripPageNumbers(lines: string[]): string[] {
  const out: string[] = [];
  let expected = 1;
  for (const l of lines) {
    if (NOISE_RE.test(l.trim())) continue;
    if (/^\d{1,4}$/.test(l.trim()) && Number(l.trim()) === expected) {
      expected += 1;
      continue;
    }
    out.push(l);
  }
  return out;
}

function reflow(lines: string[], preserve: boolean, firstSeen: Set<string>): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const flush = (): void => { if (cur) { blocks.push(cur); cur = null; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flush(); continue; }
    const t = line.trim();

    if (preserve) {                       // schedules / tables keep their line breaks
      flush();
      blocks.push({ kind: 'raw', text: t });
      continue;
    }

    if (/^_{4,}$/.test(t)) { flush(); continue; }

    const sec = SECTION_TITLE_RE.exec(t);
    if (sec) {
      flush();
      const no = sec[1];
      const b: Block = { kind: 'section', lead: `${no}. ${sec[2]}`, text: sec[3] ?? '' };
      if (!firstSeen.has(no)) { firstSeen.add(no); b.sectionNo = no; }
      cur = b;
      continue;
    }
    const secNum = SECTION_NUM_RE.exec(t);
    if (secNum && !LETTER_CLAUSE_RE.test(t)) {
      flush();
      const no = secNum[1];
      const b: Block = { kind: 'section', lead: `${no}.`, text: secNum[2] };
      if (!firstSeen.has(no)) { firstSeen.add(no); b.sectionNo = no; }
      cur = b;
      continue;
    }
    if (CLAUSE_RE.test(t)) {
      flush();
      const level: 0 | 1 | 2 = ROMAN_CLAUSE_RE.test(t) ? 2 : LETTER_CLAUSE_RE.test(t) ? 1 : 0;
      cur = { kind: 'clause', text: t, level };
      continue;
    }
    if (isShoutingHeading(t)) { flush(); blocks.push({ kind: 'heading', text: t }); continue; }
    if (STARTS_NEW_RE.test(t)) { flush(); cur = { kind: 'para', text: t }; continue; }

    if (cur) cur.text += ' ' + t;
    else cur = { kind: 'para', text: t };
  }
  flush();
  return blocks;
}

export function parseLegalText(raw: string): ParsedDoc {
  const lines = stripPageNumbers(raw.split(/\r?\n/));

  // heading positions
  const heads: { idx: number; kind: 'chapter' | 'schedule'; label: string }[] = [];
  const seenChapter = new Map<string, number>();
  lines.forEach((l, idx) => {
    const t = l.trim();
    const c = CHAPTER_RE.exec(t);
    if (c) { heads.push({ idx, kind: 'chapter', label: `Chapter ${c[1]}` }); seenChapter.set(c[1], (seenChapter.get(c[1]) ?? 0) + 1); }
    else if (SCHEDULE_RE.test(t)) heads.push({ idx, kind: 'schedule', label: t.replace(/^THE\s+/, '') });
  });

  // The first "CHAPTER I" that repeats marks the real start of the body; everything before is the
  // arrangement of sections (a table of contents we show as one collapsed "Preamble" section).
  const firstChapters = heads.filter((h) => h.kind === 'chapter' && h.label === 'Chapter I');
  const bodyStart = firstChapters.length > 1 ? firstChapters[1].idx : (heads[0]?.idx ?? lines.length);
  const hasArrangement = firstChapters.length > 1;
  const bodyHeads = heads.filter((h) => h.idx >= bodyStart);

  const firstSeen = new Set<string>();
  const sectionIndex = new Map<string, [number, number]>();
  const sections: DocSection[] = [];

  const pre = lines.slice(0, bodyStart);
  sections.push({
    id: 'preamble',
    label: 'Preamble',
    title: hasArrangement ? 'Title & arrangement of sections' : 'Title & enacting formula',
    blocks: reflow(pre, hasArrangement, new Set<string>()),
  });

  bodyHeads.forEach((h, i) => {
    const end = i + 1 < bodyHeads.length ? bodyHeads[i + 1].idx : lines.length;
    const body = lines.slice(h.idx + 1, end);
    const firstNonEmpty = body.findIndex((l) => l.trim());
    let title = '';
    let rest = body;
    if (firstNonEmpty >= 0) {
      const cand = body[firstNonEmpty].trim();
      if (cand.length <= 120 && !SECTION_NUM_RE.test(cand)) { title = cand; rest = body.slice(firstNonEmpty + 1); }
    }
    const preserve = h.kind === 'schedule';
    const blocks = reflow(rest, preserve, firstSeen);
    const secIdx = sections.length;
    blocks.forEach((b, bi) => { if (b.sectionNo) sectionIndex.set(b.sectionNo.toLowerCase(), [secIdx, bi]); });
    sections.push({ id: `s${i}`, label: h.label, title: title || (h.kind === 'schedule' ? 'Schedule' : ''), blocks });
  });

  return { sections, sectionIndex };
}

/** Plain text of a block for searching. */
export const blockText = (b: Block): string => (b.lead ? `${b.lead} ${b.text}` : b.text);
