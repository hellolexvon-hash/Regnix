/**
 * mockFiles.ts
 *
 * In production, `ReviewDoc.file` and `CompanyReview.liveRegisterFile` would
 * be the real files the company uploaded in Level 1 / Level 2 — passed
 * straight through to <PdfViewer> and <LiveRegister>, the exact same viewer
 * components the employer used during their own submission. That is the
 * point: the auditor tallies using the same tools, against the same files,
 * the same way a manual auditor would lay the printed register next to the
 * source spreadsheet.
 *
 * This demo build has no backend, so the two functions below synthesize a
 * real, valid PDF and a real, valid .xlsx workbook on the fly — byte-for-byte
 * openable in <PdfViewer> / <LiveRegister> — so the review flow can be
 * exercised end to end. Swap `openDocumentFile()` / `openLiveRegisterFile()`
 * for actual fetch()-and-blob calls against your document store when wiring
 * this to a real backend; every call site already expects a File | Blob.
 */

import * as XLSX from 'xlsx';
import type { CompanyReview, ReviewDoc } from './auditorStore';

// ── Deterministic pseudo-random (seeded by id, so re-opening a document
//    shows the same "data" every time rather than reshuffling) ──────────────

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmtINR(n: number): string {
  return n.toLocaleString('en-IN');
}

// ── Field templates per document type — what an auditor actually tallies ─── 

export interface TallyField {
  label:    string;
  docValue: string;
  regValue: string;
  match:    boolean;
}

function deriveFields(doc: ReviewDoc, company: CompanyReview): TallyField[] {
  const rng = mulberry32(seedFromString(company.id + doc.id));
  const n = company.employeeCount;
  const gross = Math.round((n * (28000 + rng() * 12000)) / 100) * 100;
  const empPf = Math.round(gross * 0.12);
  const empEsic = Math.round(gross * 0.0075);
  const mismatchIdx = doc.status === 'flagged' ? Math.floor(rng() * 4) : -1;

  const name = doc.name.toLowerCase();
  let fields: Omit<TallyField, 'match'>[];

  if (name.includes('pf')) {
    fields = [
      { label: 'Establishment code',           docValue: `MH/BAN/${1000000 + (seedFromString(company.id) % 8999999)}/000`, regValue: `MH/BAN/${1000000 + (seedFromString(company.id) % 8999999)}/000` },
      { label: 'Wage month',                   docValue: 'March 2026', regValue: 'March 2026' },
      { label: 'Total employees',              docValue: String(n), regValue: String(mismatchIdx === 0 ? n - 4 : n) },
      { label: 'Gross wages (Rs.)',             docValue: fmtINR(gross), regValue: fmtINR(mismatchIdx === 1 ? gross - 18400 : gross) },
      { label: 'Employer PF contribution (Rs.)', docValue: fmtINR(empPf), regValue: fmtINR(mismatchIdx === 2 ? empPf - 3200 : empPf) },
      { label: 'Employee PF contribution (Rs.)', docValue: fmtINR(empPf), regValue: fmtINR(empPf) },
    ];
  } else if (name.includes('esic')) {
    fields = [
      { label: 'ESIC employer code',  docValue: `27-${10000 + (seedFromString(company.id) % 89999)}-000`, regValue: `27-${10000 + (seedFromString(company.id) % 89999)}-000` },
      { label: 'Wage month',          docValue: 'March 2026', regValue: 'March 2026' },
      { label: 'Covered employees',   docValue: String(n), regValue: String(mismatchIdx === 0 ? n - 2 : n) },
      { label: 'ESIC employee contribution (Rs.)', docValue: fmtINR(empEsic), regValue: fmtINR(mismatchIdx === 1 ? empEsic + 640 : empEsic) },
      { label: 'IP number range',     docValue: '3011XXXX00 – 3011XXXX' + String(n).padStart(2, '0'), regValue: '3011XXXX00 – 3011XXXX' + String(n).padStart(2, '0') },
    ];
  } else if (name.includes('wage') || name.includes('bank')) {
    fields = [
      { label: 'Wage month',        docValue: 'March 2026', regValue: 'March 2026' },
      { label: 'Total employees',   docValue: String(n), regValue: String(n) },
      { label: 'Gross wages (Rs.)', docValue: fmtINR(gross), regValue: fmtINR(mismatchIdx === 0 ? gross - 6200 : gross) },
      { label: 'Net payable (Rs.)', docValue: fmtINR(gross - empPf - empEsic), regValue: fmtINR(gross - empPf - empEsic) },
      { label: 'Bank advisory ref.', docValue: `UTR${100000000 + (seedFromString(doc.id) % 899999999)}`, regValue: `UTR${100000000 + (seedFromString(doc.id) % 899999999)}` },
    ];
  } else {
    fields = [
      { label: 'Reference / licence no.', docValue: `REG-${1000 + (seedFromString(doc.id) % 8999)}`, regValue: `REG-${1000 + (seedFromString(doc.id) % 8999)}` },
      { label: 'Issuing authority',       docValue: 'State Labour Department', regValue: 'State Labour Department' },
      { label: 'Validity period',         docValue: 'Apr 2025 – Mar 2027', regValue: mismatchIdx === 0 ? 'Apr 2025 – Mar 2026' : 'Apr 2025 – Mar 2027' },
      { label: 'Signatory / seal',        docValue: 'Present', regValue: mismatchIdx === 1 ? 'Illegible' : 'Present' },
    ];
  }

  return fields.map(f => ({ ...f, match: f.docValue === f.regValue }));
}

export function getTallyFields(doc: ReviewDoc, company: CompanyReview): TallyField[] {
  return deriveFields(doc, company);
}

// ── PDF generation (hand-rolled, dependency-free, spec-valid PDF 1.4) ──────

function escapePdfText(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

interface PdfLine { label: string; value: string; flagged?: boolean; }

function buildPdfBytes(title: string, subtitle: string, lines: PdfLine[], footer: string): string {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 56;
  let y = 774;

  const ops: string[] = [];
  const addText = (font: 'F1' | 'F2', size: number, x: number, yPos: number, text: string) => {
    ops.push('BT', `/${font} ${size} Tf`, `${x} ${yPos} Td`, `(${escapePdfText(text)}) Tj`, 'ET');
  };

  addText('F2', 15, marginLeft, y, title);
  y -= 20;
  addText('F1', 9.5, marginLeft, y, subtitle);
  y -= 10;
  ops.push(`${marginLeft} ${y} m ${pageWidth - marginLeft} ${y} l S`);
  y -= 22;

  addText('F2', 8.5, marginLeft, y, 'FIELD');
  addText('F2', 8.5, marginLeft + 210, y, 'VALUE AS FILED');
  y -= 6;
  ops.push(`${marginLeft} ${y} m ${pageWidth - marginLeft} ${y} l S`);
  y -= 16;

  for (const line of lines) {
    if (y < 70) break;
    addText('F2', 9.5, marginLeft, y, line.label);
    addText('F1', 9.5, marginLeft + 210, y, line.value);
    y -= 19;
  }

  y -= 10;
  ops.push(`${marginLeft} ${y} m ${pageWidth - marginLeft} ${y} l S`);
  y -= 20;
  addText('F1', 8, marginLeft, y, footer);

  const contentStream = ops.join('\n');
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(`<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R >>`);
  objects.push(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  const objCount = objects.length + 1;
  let xref = `xref\n0 ${objCount}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += xref;
  pdf += `trailer\n<< /Size ${objCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

/** Builds a real, openable PDF Blob representing the register as filed by the company. */
export function buildMockDocumentPdf(doc: ReviewDoc, company: CompanyReview): Blob {
  const fields = getTallyFields(doc, company);
  const lines: PdfLine[] = fields.map(f => ({ label: f.label, value: f.docValue, flagged: !f.match }));
  const pdfString = buildPdfBytes(
    `${doc.name} — ${company.name}`,
    `${doc.act} · Submitted for Level 3 audit review · Demo document generated for review purposes`,
    lines,
    'Regnix Compliance Platform — Auditor Portal demo document. Not a statutory filing.',
  );
  const bytes = new Uint8Array(pdfString.length);
  for (let i = 0; i < pdfString.length; i++) bytes[i] = pdfString.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}

// ── XLSX generation (uses the same 'xlsx' package LiveRegister.tsx reads) ──

const FIRST_NAMES = ['Aarav', 'Priya', 'Rohan', 'Ishita', 'Vikram', 'Ananya', 'Karan', 'Sneha', 'Arjun', 'Meera', 'Rahul', 'Divya'];
const LAST_NAMES  = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Gupta', 'Joshi', 'Menon', 'Rao', 'Patel'];

/** Builds a real, openable .xlsx File representing the company's live payroll register. */
export function buildMockLiveRegisterFile(company: CompanyReview): File {
  const rng = mulberry32(seedFromString(company.id + '-liveregister'));
  const rowCount = Math.min(company.employeeCount, 30);

  const header = [
    'Employee Name', 'UAN', 'ESIC IP No.', 'Department', 'Date of Joining',
    'Gross Wages (Rs.)', 'PF Contribution (Rs.)', 'ESIC Contribution (Rs.)', 'Bank UTR',
  ];

  const rows: (string | number)[][] = [];
  for (let i = 0; i < rowCount; i++) {
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const last  = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const gross = Math.round((30000 + rng() * 14000) / 100) * 100;
    rows.push([
      `${first} ${last}`,
      `1002456${String(78900 + i).padStart(5, '0')}`,
      `3011${String(400000 + i).padStart(6, '0')}`,
      ['Production', 'Quality', 'Logistics', 'Admin', 'HR', 'Finance'][Math.floor(rng() * 6)],
      `${1 + Math.floor(rng() * 27)}/0${1 + Math.floor(rng() * 9)}/2024`,
      gross,
      Math.round(gross * 0.12),
      Math.round(gross * 0.0075),
      `UTR${100000000 + Math.floor(rng() * 899999999)}`,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employee Master');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const fileName = `${company.name.replace(/\s+/g, '_')}_Live_Register.xlsx`;
  return new File([buf], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
