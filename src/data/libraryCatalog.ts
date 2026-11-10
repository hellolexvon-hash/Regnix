/**
 * src/data/libraryCatalog.ts
 * Catalog for the Regnix E-Library. Files live in /public/library/ and are served as /library/<file>.
 * To add a document: drop the file into public/library/ and add one entry below.
 */

export type LibraryCategory = 'codes' | 'acts' | 'corporate';
export type LibraryFormat = 'pdf' | 'txt';

export interface LibraryDoc {
  id: string;
  title: string;
  /** Short name used on the cover and in lists. */
  shortTitle: string;
  actNo: string;
  year: number;
  category: LibraryCategory;
  format: LibraryFormat;
  /** Path under /public, e.g. /library/code-on-wages-2019.pdf */
  file: string;
  /** Page count (PDF only). */
  pages?: number;
  sizeKb: number;
  summary: string;
  tags: string[];
  /** Regnix registers / calculations that rely on this law. */
  usedIn?: string[];
}

export const CATEGORY_LABEL: Record<LibraryCategory, string> = {
  codes: 'Labour Codes',
  acts: 'Acts & Rules',
  corporate: 'Corporate & Data',
};

export const LIBRARY_DOCS: readonly LibraryDoc[] = [
  {
    id: 'code-on-wages-2019',
    title: 'The Code on Wages, 2019',
    shortTitle: 'Code on Wages',
    actNo: 'No. 29 of 2019',
    year: 2019,
    category: 'codes',
    format: 'pdf',
    file: '/library/code-on-wages-2019.pdf',
    pages: 29,
    sizeKb: 231,
    summary: 'Consolidates the laws on minimum wages, payment of wages, bonus and equal remuneration.',
    tags: ['Minimum wages', 'Payment of wages', 'Bonus', 'Equal remuneration'],
    usedIn: ['Code on Wages registers (Forms I–VI)'],
  },
  {
    id: 'code-on-social-security-2020',
    title: 'The Code on Social Security, 2020',
    shortTitle: 'Social Security Code',
    actNo: 'No. 36 of 2020',
    year: 2020,
    category: 'codes',
    format: 'txt',
    file: '/library/code-on-social-security-2020.txt',
    sizeKb: 375,
    summary: 'Extends social security to employees and workers — provident fund, ESI, gratuity, maternity benefit and more.',
    tags: ['EPF', 'ESIC', 'Gratuity', 'Maternity benefit', 'Gig workers'],
    usedIn: ['EPF & ESIC contribution rules in Populate'],
  },
  {
    id: 'industrial-relations-code-2020',
    title: 'The Industrial Relations Code, 2020',
    shortTitle: 'Industrial Relations Code',
    actNo: 'No. 35 of 2020',
    year: 2020,
    category: 'codes',
    format: 'pdf',
    file: '/library/industrial-relations-code-2020.pdf',
    pages: 56,
    sizeKb: 444,
    summary: 'Consolidates the laws on trade unions, standing orders and the investigation and settlement of industrial disputes.',
    tags: ['Trade unions', 'Standing orders', 'Industrial disputes', 'Layoff & retrenchment'],
  },
  {
    id: 'osh-code-2020',
    title: 'The Occupational Safety, Health and Working Conditions Code, 2020',
    shortTitle: 'OSH Code',
    actNo: 'No. 37 of 2020',
    year: 2020,
    category: 'codes',
    format: 'pdf',
    file: '/library/osh-code-2020.pdf',
    pages: 86,
    sizeKb: 519,
    summary: 'Consolidates the laws on safety, health and working conditions in factories, mines, docks, building work and contract labour.',
    tags: ['Safety', 'Health', 'Working hours', 'Contract labour', 'Inter-state migrant workers'],
  },
  {
    id: 'payment-of-bonus-act-1965',
    title: 'The Payment of Bonus Act, 1965',
    shortTitle: 'Payment of Bonus Act',
    actNo: 'Act 21 of 1965',
    year: 1965,
    category: 'acts',
    format: 'pdf',
    file: '/library/payment-of-bonus-act-1965.pdf',
    pages: 31,
    sizeKb: 643,
    summary: 'Statutory bonus for employees of factories and establishments — eligibility, allocable surplus, minimum and maximum bonus.',
    tags: ['Bonus', 'Allocable surplus', 'Eligibility'],
    usedIn: ['Bonus Register (CLRA)', 'Bonus accrual in Populate'],
  },
  {
    id: 'payment-of-gratuity-act-1972',
    title: 'The Payment of Gratuity Act, 1972',
    shortTitle: 'Payment of Gratuity Act',
    actNo: 'Act 39 of 1972',
    year: 1972,
    category: 'acts',
    format: 'pdf',
    file: '/library/payment-of-gratuity-act-1972.pdf',
    pages: 11,
    sizeKb: 237,
    summary: 'Gratuity on retirement, resignation, superannuation, death or disablement after five years of continuous service.',
    tags: ['Gratuity', 'Continuous service', 'Nomination'],
    usedIn: ['Gratuity Register (CLRA)', 'Gratuity provision in Populate'],
  },
  {
    id: 'clra-central-rules-1971',
    title: 'The Contract Labour (Regulation & Abolition) Central Rules, 1971',
    shortTitle: 'CLRA Central Rules',
    actNo: 'Under Act 37 of 1970',
    year: 1971,
    category: 'acts',
    format: 'pdf',
    file: '/library/clra-central-rules-1971.pdf',
    pages: 57,
    sizeKb: 220,
    summary: 'Central rules under the CLRA Act, 1970 — licensing, registers, returns and the prescribed forms.',
    tags: ['Licensing', 'Registers', 'Forms', 'Principal employer', 'Contractor'],
    usedIn: ['CLRA registers (Forms I, XVII, XX–XXIII)'],
  },
  {
    id: 'companies-act-2013',
    title: 'The Companies Act, 2013',
    shortTitle: 'Companies Act',
    actNo: 'Act 18 of 2013',
    year: 2013,
    category: 'corporate',
    format: 'txt',
    file: '/library/companies-act-2013.txt',
    sizeKb: 992,
    summary: 'The law on incorporation, management, governance and winding up of companies in India.',
    tags: ['Incorporation', 'Directors', 'Share capital', 'Winding up'],
  },
  {
    id: 'it-act-2000',
    title: 'The Information Technology Act, 2000',
    shortTitle: 'IT Act',
    actNo: 'Act 21 of 2000',
    year: 2000,
    category: 'corporate',
    format: 'pdf',
    file: '/library/it-act-2000.pdf',
    pages: 36,
    sizeKb: 813,
    summary: 'Legal recognition of electronic records and digital signatures, with provisions on cyber offences and intermediaries.',
    tags: ['Electronic records', 'Digital signatures', 'Cyber offences'],
  },
  {
    id: 'dpdp-act-2023',
    title: 'The Digital Personal Data Protection Act, 2023',
    shortTitle: 'DPDP Act',
    actNo: 'No. 22 of 2023',
    year: 2023,
    category: 'corporate',
    format: 'pdf',
    file: '/library/dpdp-act-2023.pdf',
    pages: 21,
    sizeKb: 178,
    summary: 'Governs the processing of digital personal data — consent, rights of data principals and the Data Protection Board.',
    tags: ['Personal data', 'Consent', 'Data fiduciary', 'Data Protection Board'],
  },
];

export const getDoc = (id: string | null | undefined): LibraryDoc | undefined =>
  LIBRARY_DOCS.find((d) => d.id === id);

export function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
