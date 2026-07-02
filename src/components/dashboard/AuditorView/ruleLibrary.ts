/**
 * ruleLibrary.ts
 *
 * Source of truth for document-level audit checklists, transcribed from the
 * "REGNIX Compliance Validation & Audit Manual". Each entry is the FULL rule
 * set for that document type — not a condensed subset — so the auditor's
 * checklist matches exactly what a manual auditor would work through.
 *
 * Shared data module: intended for use by both the employer-side validation
 * flow (ValidationLevel2) and the Auditor Portal (AuditorCompanyReview), so
 * both sides check documents against the same standardized rule text.
 *
 * Usage:
 *   import { resolveRuleSet } from './ruleLibrary';
 *   const { category, rules } = resolveRuleSet(doc.name);
 */

export interface RuleCategory {
  category: string;
  rules:    string[];
}

// ── The manual, verbatim ─────────────────────────────────────────────────────

export const RULE_LIBRARY: Record<string, string[]> = {

  'Bank Advisory Slip': [
    'Salary credited after 7th of following month',
    'Employee count mismatch with payroll',
    'Duplicate payment',
    'UTR missing',
    'Wrong bank account',
    'Inactive employee paid',
    'Salary amount mismatch',
    'Payment approval missing',
    'Unreadable document',
    'Tampered document',
    'Unauthorized by bank / No bank attestation found',
    'Other reason',
  ],

  'Wage Slip': [
    'Applicable Act/Rule/Code on wages (as per latest salary calculation breakup)',
    'Employee name missing.',
    'Attendance days incorrect.',
    'Paid days incorrect.',
    'LOP days incorrect.',
    'Employee name does not match master records.',
    'Employee ID missing / incorrect.',
    'Wrong calculations / wrong component calculations.',
    'Mismatch between payroll, bank advice, and statutory filings.',
    'Gross or net salary manipulation.',
    'Attendance discrepancies.',
    'Missing statutory information.',
    'Corrupted / blurred / low quality document.',
    'PF wages incorrect.',
    'PF contribution incorrect.',
    'ESIC wages incorrect.',
    'ESIC contribution incorrect.',
    'PT calculation incorrect.',
    'LWF calculation incorrect.',
    'Gratuity eligibility ignored.',
    'Bonus eligibility incorrect.',
    'Minimum wages not complied with.',
    'Overtime wages below statutory rate.',
    'Income Tax (TDS) deduction incorrect.',
    'Arrears not included.',
    'Shift allowance errors.',
    'Night shift allowance errors.',
    'Attendance allowance missing.',
    'Performance bonus incorrect.',
  ],

  'PF Form 5A': [
    'PF Establishment Code mismatch.',
    'Employer name mismatch with EPFO records.',
    'Director/Partner/Proprietor details not updated.',
    'Unauthorized or missing signatory.',
    'Registration cancelled/suspended.',
    'Form 5A amendment pending despite organizational changes.',
    'Fake, forged, or tampered Form 5A.',
    'Cross-document mismatch with PF ECR, PF Challan, or PF Consolidated.',
    'Missing mandatory pages or invalid version.',
    'Incorrect establishment details.',
    'Others.',
    'Not uploaded.',
    'Old documents uploaded.',
  ],

  'PF Payment Paid Challan': [
    'PF contribution paid after the 15th of the following month.',
    'TRRN missing, invalid, or cancelled.',
    'Payment failed, reversed, or not credited to EPFO.',
    'Challan amount does not match PF ECR or payroll.',
    'PF Establishment Code mismatch.',
    'Employee count mismatch with PF ECR.',
    'Duplicate or partial PF payment.',
    'Interest and damages not accounted for where payment is delayed.',
    'Tampered or forged challan.',
    'Contribution period or wage month incorrect.',
    'Incorrect establishment details.',
    'Others.',
    'Not uploaded.',
    'Old documents uploaded.',
    '7Q and 14B is reflecting.',
    'Challan not paid.',
  ],

  'PF ECR': [
    'PF ECR uploaded after the statutory due date.',
    'Missing or invalid UAN.',
    'Eligible employee omitted from the PF ECR.',
    'Duplicate employee/UAN records.',
    'PF wages do not match payroll.',
    'Employer or employee PF contribution mismatch.',
    'EPS contribution incorrect.',
    'Employee count mismatch with payroll or PF Challan.',
    'PF ECR does not reconcile with PF Paid Challan or PF Consolidated Statement.',
    'Inactive/resigned employee included or active employee excluded.',
    'Tampered or manipulated PF ECR.',
    'Incorrect wage month or contribution period.',
    'Missing mandatory fields.',
    'Incorrect DOJ or DOE affecting PF liability.',
    'Missing payroll approval or audit trail.',
    'NCP days are not correct.',
    'Incorrect establishment details.',
    'Others.',
    'Not uploaded.',
    'Old documents uploaded.',
  ],

  'ESIC Registration Certificate': [
    'ESIC Employer Code missing or invalid.',
    'Registration cancelled, suspended, or inactive.',
    'Fake, forged, or tampered ESIC Registration Certificate.',
    'Employer name mismatch with statutory records.',
    'Registered address mismatch.',
    'Branch/establishment not covered under the ESIC registration.',
    'Ownership or legal entity changed but ESIC records not updated.',
    'Employees covered under an incorrect Employer Code.',
    'ESIC Registration Certificate does not reconcile with ESIC Challan, ESIC ECR, payroll, or wage register.',
    'Duplicate Employer Code for the same establishment.',
    'Registration amendment pending despite organizational changes.',
    'Nature of business or establishment classification is incorrect.',
    'Mandatory pages or certificate details missing.',
    'Certificate unreadable or corrupted.',
    'Registration information inconsistent with other statutory registrations (PF, GST, Shops & Establishment, CLRA).',
    'Incorrect establishment details.',
    'Others.',
    'Not uploaded.',
    'Old documents uploaded.',
  ],

  'ESIC Challan': [
    'ESIC contribution paid after the 15th of the following month.',
    'Payment failed, reversed, or not credited to ESIC.',
    'Invalid or incorrect Employer Code.',
    'Contribution amount does not match ESIC ECR or payroll.',
    'Incorrect contribution month or wage period.',
    'Employee count mismatch with ESIC ECR or payroll.',
    'Employer contribution underpaid.',
    'Employee contribution incorrectly calculated.',
    'Duplicate or partial ESIC payment.',
    'Challan tampered or forged.',
    'Gross wages do not reconcile with payroll.',
    'Bank payment proof or UTR missing.',
    'Mandatory payment interest not paid for delayed contribution.',
    'ESIC Challan does not reconcile with ESIC ECR.',
    'Monthly ESIC compliance is incomplete due to missing or inconsistent statutory records.',
    'Incorrect establishment details.',
    'Others.',
    'Not uploaded.',
    'Old documents uploaded.',
  ],

  'ESIC ECR': [
    'ESIC ECR prepared/uploaded after the statutory timeline.',
    'Missing or invalid IP Number.',
    'Eligible employee omitted from the ESIC ECR.',
    'Duplicate employee or duplicate IP Number.',
    'Gross wages do not match payroll or wage register.',
    'Employee ESIC contribution incorrectly calculated.',
    'Employer ESIC contribution incorrectly calculated.',
    'Incorrect application of the ESIC wage ceiling.',
    'Employee count mismatch with payroll or ESIC Challan.',
    'ESIC ECR does not reconcile with ESIC Paid Challan.',
    'Resigned employee included or active employee excluded.',
    'Invalid Employer Code.',
    'Tampered or forged ESIC ECR.',
    'Mandatory employee fields missing or incomplete.',
    'Payroll, attendance, wage register, and ESIC records do not reconcile.',
    'Incorrect establishment details.',
    'Others.',
    'Not uploaded.',
    'Old documents uploaded.',
  ],

  'Employee Compensation Policy': [
    'Insurance policy expired or not valid for the audit period.',
    'Employer name does not match statutory registrations.',
    'Employees/workmen are not covered under the policy.',
    'Sum insured is insufficient for the workforce.',
    'Wrong contractor or principal employer covered.',
    'Employee/workmen count differs from payroll or muster roll.',
    'Declared wages differ from payroll, resulting in incorrect coverage.',
    'Premium unpaid, resulting in policy lapse or suspension.',
    'Fake, forged, or tampered insurance policy.',
    'Policy does not cover the audited worksite or project location.',
    'Contract period exceeds policy validity.',
    'Policy renewal or endorsement pending despite active operations.',
    'Policy excludes mandatory statutory risks.',
    'Insurance details do not reconcile with labour licence, payroll, or contract documents.',
    'Mandatory schedules, endorsements, or annexures are missing.',
    'Others.',
    'Not uploaded.',
    'Old documents uploaded.',
  ],

  'Certificate of Insurance': [
    'Certificate expired or not valid for the audit period.',
    'Policy number missing or does not match the insurance policy.',
    'Employer/legal entity mismatch.',
    'Incorrect or insufficient insurance coverage.',
    'Sum insured below contractual or statutory requirements.',
    'Insurance policy inactive, cancelled, or lapsed.',
    'Fake, forged, or tampered certificate.',
    'Wrong contractor or principal employer covered.',
    'Employees/workmen not covered by the insurance.',
    'Premium not paid, resulting in policy invalidation.',
    'Certificate details do not reconcile with the insurance policy or contract.',
    'Mandatory endorsements or additional insured details missing.',
    'Contract/project location not covered.',
    'Missing insurer authorization or digital authentication.',
    'Insurance certificate does not comply with contractual or statutory requirements.',
    'Incorrect establishment details.',
    'Others.',
    'Not uploaded.',
    'Old documents uploaded.',
  ],

  'Registration Certificate': [
    'Registration Certificate not uploaded.',
    'Registration cancelled, suspended, or inactive.',
    'Invalid or fake Registration Certificate.',
    'Registration number missing or unverifiable.',
    'Incorrect establishment details.',
    'Employer/legal entity name mismatch.',
    'Cross-document mismatch with GST, PF, ESIC, CLRA, BOCW, or other statutory registrations.',
    'Tampered or altered Registration Certificate.',
    'Mandatory amendments not updated.',
    'Government verification failed (QR code, certificate number, or issuing authority details).',
    'Others.',
    'Old documents uploaded.',
  ],

  'S&E Licence': [
    'Shops & Establishment Licence not uploaded.',
    'Licence expired, suspended, cancelled, or inactive.',
    'Invalid or fake licence.',
    'Licence number missing or unverifiable.',
    'Incorrect establishment details.',
    'Employer/legal entity name mismatch.',
    'Registered address mismatch.',
    'Nature of business inconsistent with actual operations.',
    'Employee strength exceeds the licensed limit.',
    'Cross-document mismatch with GST, PF, ESIC, Registration Certificate, CLRA, or payroll.',
    'Tampered or altered licence.',
    'Mandatory renewal or amendment not updated.',
    'Government verification failed.',
    'Mandatory pages or endorsements missing.',
    'Old/outdated licence uploaded.',
    'Others.',
    'Old documents uploaded.',
  ],

  'CLRA Licence': [
    'CLRA Licence not uploaded.',
    'Licence expired, suspended, cancelled, or inactive.',
    'Labour strength exceeds the licensed limit.',
    'Invalid or fake CLRA Licence.',
    'Licence number missing or unverifiable.',
    'Principal Employer details mismatch.',
    'Contractor/legal entity mismatch.',
    'Worksite or project not covered under the licence.',
    'Nature of work differs from the approved licence.',
    'Cross-document mismatch with Work Order, CLRA Registration, BOCW, PF, ESIC, GST, Attendance, or Wage Register.',
    'Tampered or altered licence.',
    'Mandatory renewal or amendment not updated.',
    'Government verification failed.',
    'Incorrect establishment details.',
    'Old or outdated licence uploaded.',
  ],

  'Act Related Registers': [
    'Mandatory statutory registers not maintained.',
    'Registers not uploaded.',
    'Employee records do not match payroll.',
    'Attendance does not reconcile with payroll.',
    'Wage Register does not match Bank Advice.',
    'PF/ESIC records do not reconcile with statutory registers.',
    'Employee count mismatch.',
    'Incorrect statutory deductions.',
    'Forged, altered, or manipulated registers.',
    'Registers maintained for the wrong establishment.',
    'Wrong compliance month or financial year.',
    'Old registers uploaded.',
    'Mandatory signatures or approvals missing.',
    'Registers not maintained in the prescribed statutory format.',
    'Cross-document mismatch with Appointment Letters, Work Orders, PF, ESIC, CLRA, BOCW, or payroll.',
    'Missing overtime records.',
    'Missing leave records.',
    'Missing statutory benefit registers.',
    'Duplicate employee entries.',
    'Incomplete employee information.',
    'Unreadable or corrupted registers.',
    'Missing audit trail for electronic registers.',
    'Backdated or manually overwritten records.',
    'Missing mandatory statutory fields.',
    'Any client-specific statutory register not maintained.',
  ],

  'GSTIN Certificate': [
    'GSTIN Certificate not uploaded.',
    'Invalid or fake GSTIN.',
    'GST registration cancelled, suspended, or inactive.',
    'GSTIN cannot be verified on the GST portal.',
    'PAN mismatch.',
    'Legal entity mismatch.',
    'Business address mismatch.',
    'Cross-document mismatch with Registration Certificate, PF, ESIC, CLRA, BOCW, or Work Order.',
    'Tampered or forged GST Certificate.',
    'Mandatory amendments not updated.',
    'Wrong establishment details.',
    'Old GST Certificate uploaded.',
    'Mandatory pages missing.',
    'Government verification failed.',
    'GST registration under cancellation due to non-compliance.',
    'Incorrect business constitution.',
    'State code mismatch.',
    'Unreadable or corrupted document.',
    'Trade name mismatch.',
    'Client/vendor master mismatch.',
  ],

  'Gratuity Form 5': [
    'Gratuity Form V not uploaded.',
    'Form not submitted where legally required.',
    'Employer/legal entity mismatch.',
    'Establishment name or address mismatch.',
    'Delayed or non-submission of the statutory form.',
    'Cross-document mismatch with Registration Certificate, GSTIN, PF, ESIC, or Shops & Establishment records.',
    'Fake, forged, or tampered form.',
    'Wrong establishment details.',
    'Old or superseded form uploaded.',
    'Government acknowledgement missing (where applicable).',
    'Mandatory pages or fields missing.',
    'Unauthorized or missing signatory.',
    'Incorrect date of applicability/opening.',
    'Unreadable or corrupted document.',
    'Statutory amendments not reflected.',
  ],

  'Appointment Letter': [
    'Appointment Letter not uploaded.',
    'Employee appointed under the wrong legal entity.',
    'Employee identity mismatch.',
    'DOJ missing.',
    'Salary structure mismatch with payroll.',
    'Employee working without a valid Appointment Letter.',
    'Fake, forged, or tampered Appointment Letter.',
    'Incorrect establishment details.',
    'Old or draft Appointment Letter uploaded.',
    'Mandatory signatures missing.',
    'Offer Letter and Appointment Letter mismatch.',
    'Employee designation mismatch.',
    'Missing statutory employment clauses.',
    'Unreadable or incomplete document.',
    'Non-compliance deduction & calculation validation.',
    'Forged/tampered Appointment Letter detected in manipulated statements.',
    'Forged or tampered Appointment Letter deductions/legalities involved.',
    'Cross-document mismatch with Employee Master, Payroll, PF, ESIC, or Bank Advice.',
  ],

  'Offer Letter': [
    'OCR extraction of candidate name, designation, DOJ, CTC, and work location.',
    'Comparison of Offer Letter details with the Appointment Letter before onboarding.',
    'Detection of unsigned or unaccepted Offer Letters.',
    'Detection of edited PDFs or digitally altered documents.',
    'Identification of outdated Offer Letter templates.',
    'Validation of mandatory employment clauses.',
    'Comparison of work location with deployment records.',
    'Detection of duplicate Offer Letters issued to the same candidate.',
    'Verification that CTC matches the approved compensation structure.',
    'Validation that the issuing authority is authorized to release Offer Letters.',
  ],

  'PT Paid Challan': [
    'PT Paid Challan not uploaded.',
    'PT payment made after the statutory due date.',
    'Invalid or cancelled PT Registration Number.',
    'PT amount mismatch with payroll.',
    'Incorrect PT slab applied.',
    'Underpayment or overpayment of Professional Tax.',
    'Payment failed or bank transaction reversed.',
    'Cross-document mismatch with Payroll, Employee Master, or PT return.',
    'Fake or tampered PT Challan.',
    'Incorrect establishment details.',
    'Old or outdated PT Challan uploaded.',
    'Wrong tax period or financial year.',
    'Government payment acknowledgement missing.',
    'Unreadable or incomplete challan.',
    'Missing UTR/CIN/GRN or transaction reference.',
  ],

  'LWF Paid Challan': [
    'LWF Paid Challan not uploaded.',
    'LWF contribution paid after the statutory due date.',
    'LWF registration missing where mandatory.',
    'Incorrect employer or employee contribution amount.',
    'Eligible employees excluded from contribution.',
    'Employee count mismatch with Payroll or Attendance.',
    'Incorrect contribution period or financial year.',
    'Cross-document mismatch with Payroll, Employee Master, or Wage Register.',
    'Fake, forged, or tampered LWF Challan.',
    'Incorrect establishment details.',
    'Old or outdated LWF Challan uploaded.',
    'Government payment acknowledgement missing.',
    'Bank transaction failed or reversed.',
    'Unreadable or incomplete challan.',
    'Missing UTR, transaction reference, or official payment confirmation.',
  ],

  'Declaration Docs 01-04': [
    'Mandatory declaration not uploaded.',
    'Declaration not signed by the employee, contractor, or authorized signatory.',
    'Employee name missing.',
    'Employee ID missing.',
    'Document date missing.',
    'Signature missing.',
    'Witness missing (if required).',
    'Mandatory fields incomplete.',
    'Wrong document version.',
    'Duplicate upload.',
    'Incomplete pages.',
    'Unreadable document.',
    'Identity mismatch with Employee Master or Vendor Master.',
  ],

  'Other Docs 01-05': [
    'Document expired.',
    'Company name mismatch.',
    'Document number missing.',
    'Issue date missing.',
    'Expiry date missing.',
    'Signature missing.',
    'Seal missing.',
    'Incomplete upload.',
    'Duplicate document.',
    'Unreadable document.',
    'Mandatory pages or annexures missing.',
    'Client-specific mandatory document not submitted.',
    'Document expired or renewal overdue.',
    'Fake, forged, or tampered document.',
  ],

  'LWF Registration / License': [
    'LWF Registration/Licence not uploaded.',
    'Invalid, cancelled, or suspended LWF Registration.',
    'Registration/Licence expired or renewal overdue.',
    'LWF registration missing despite statutory applicability.',
    'Employer/legal entity mismatch.',
    'Establishment name or address mismatch.',
    'Cross-document mismatch with LWF Challan, Payroll, PT, GSTIN, PF, or ESIC.',
    'Fake, forged, or tampered registration document.',
    'Incorrect establishment details.',
    'Old or outdated registration uploaded.',
    'Government verification failed.',
    'Mandatory pages or official seals missing.',
    'Wrong state registration.',
    'Unreadable or corrupted document.',
    'Statutory amendments not updated.',
  ],

  'PT Registration / License': [
    'PT Registration/Licence not uploaded.',
    'Invalid, cancelled, or suspended PT Registration.',
    'Registration expired or renewal overdue.',
    'PT Registration missing despite statutory applicability.',
    'Wrong registration type (PTRC/PTEC).',
    'Employer/legal entity mismatch.',
    'Establishment name or address mismatch.',
    'Cross-document mismatch with PT Challan, Payroll, GSTIN, PF, ESIC, or Registration Certificate.',
    'Fake, forged, or tampered registration document.',
    'Incorrect establishment details.',
    'Old or outdated registration uploaded.',
    'Government verification failed.',
    'Mandatory pages or official seals missing.',
    'Wrong state or jurisdiction registration.',
    'Unreadable or corrupted document.',
  ],
};

// ── Aliases: map the document names actually used in ReviewDoc.name (which
//    may carry suffixes like "Register" or "Statement", or a slightly
//    different label) to their canonical manual category ─────────────────────

const ALIASES: Record<string, string> = {
  'wage slip register':           'Wage Slip',
  'pf consolidated statement':    'PF ECR',
  'pf payment challan':           'PF Payment Paid Challan',
  'pf payment paid challan':      'PF Payment Paid Challan',
  'contract labour licence':      'CLRA Licence',
  'contract labour license':      'CLRA Licence',
  'shops & est. registration':    'S&E Licence',
  'shops and establishment licence': 'S&E Licence',
  's&e licence':                  'S&E Licence',
  's&e license':                  'S&E Licence',
  'lwf registration':             'LWF Registration / License',
  'lwf license':                  'LWF Registration / License',
  'pt registration':              'PT Registration / License',
  'pt license':                   'PT Registration / License',
  'declaration doc':              'Declaration Docs 01-04',
  'other doc':                    'Other Docs 01-05',
};

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolves a ReviewDoc.name (e.g. "Wage Slip Register", "PF Consolidated
 * Statement") to its full checklist from the manual. Falls back to a
 * substring match against known categories, then to the generic "Other
 * Docs 01-05" checklist if nothing matches — mirroring how the manual
 * itself treats unlisted document types.
 */
export function resolveRuleSet(docName: string): RuleCategory {
  const norm = normalize(docName);

  // 1. Exact match against a manual category
  const exactKey = Object.keys(RULE_LIBRARY).find(k => normalize(k) === norm);
  if (exactKey) return { category: exactKey, rules: RULE_LIBRARY[exactKey] };

  // 2. Alias table
  const aliasTarget = ALIASES[norm];
  if (aliasTarget) return { category: aliasTarget, rules: RULE_LIBRARY[aliasTarget] };

  // 3. Substring match (either direction) against category names
  const fuzzyKey = Object.keys(RULE_LIBRARY).find(
    k => norm.includes(normalize(k)) || normalize(k).includes(norm)
  );
  if (fuzzyKey) return { category: fuzzyKey, rules: RULE_LIBRARY[fuzzyKey] };

  // 4. Generic fallback — same behaviour as the manual's own catch-all
  return { category: 'Other Docs 01-05', rules: RULE_LIBRARY['Other Docs 01-05'] };
}

/** All category names, for reference/UI use (e.g. an admin rule-library browser). */
export const RULE_CATEGORIES: string[] = Object.keys(RULE_LIBRARY);
