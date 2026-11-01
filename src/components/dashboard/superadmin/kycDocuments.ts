/**
* KYC document catalogue offered to the super admin when requesting documents.
* Source: Onboarding_Documents_Checklist.xlsx. `label` is the exact string stored in
* kyc_requests.documents and matched by the upload page, so do not rename casually.
*/

export interface KycDocItem { label: string; about: string; applies: string }
export interface KycDocGroup { id: string; title: string; common: boolean; docs: KycDocItem[] }

export const KYC_DOC_GROUPS: KycDocGroup[] = [
  { id: "corporate-tax-banking", title: "Corporate, tax & banking", common: true, docs: [
    { label: "Certificate of Incorporation (apostilled / notarised)", about: "Certificate of Incorporation, authenticated by apostille (Hague Convention) or notary", applies: "Foreign entities" },
    { label: "List of directors with DIN", about: "Director Identification Number (DIN) for each director", applies: "All companies" },
    { label: "UBO declaration", about: "Ultimate Beneficial Owner declaration: natural persons who ultimately own or control the entity", applies: "All vendors / clients" },
    { label: "GST certificate", about: "Goods and Services Tax Registration Certificate", applies: "GST-registered entities" },
    { label: "TAN", about: "Tax Deduction and Collection Account Number", applies: "Entities deducting / collecting tax" },
    { label: "Cancelled cheque / bank letter", about: "Proof of bank account details", applies: "All vendors" },
    { label: "Trade License", about: "Municipal licence to carry on a trade or business from the premises", applies: "Where required by local body" },
    { label: "S&E registration", about: "Shops and Establishments Act registration", applies: "Commercial establishments" },
  ] },
  { id: "labour-employment", title: "Labour & employment", common: true, docs: [
    { label: "PF registration", about: "Provident Fund registration under the Employees' Provident Funds and Miscellaneous Provisions Act, 1952", applies: "Establishments above the PF threshold" },
    { label: "Form 5A (PF)", about: "EPF form listing employees covered at PF registration (confirm exact use with your PF consultant)", applies: "As requested by client" },
    { label: "ESIC registration", about: "Employees' State Insurance Corporation registration under the ESI Act, 1948", applies: "Establishments above the ESI threshold" },
    { label: "CLRA registration / licence", about: "Contract Labour (Regulation and Abolition) Act, 1970: registration for principal employer, licence for contractor", applies: "Principal employers and contractors using contract labour" },
  ] },
  { id: "contracts-legal", title: "Contracts & legal", common: true, docs: [
    { label: "Signed MSA", about: "Master Services Agreement", applies: "All engagements" },
    { label: "Order Form / SOW", about: "Order Form / Statement of Work", applies: "All engagements" },
    { label: "DPA", about: "Data Processing Agreement, aligned to the Digital Personal Data Protection Act, 2023 (DPDP Act)", applies: "Where personal data is processed" },
    { label: "NDA", about: "Non-Disclosure Agreement", applies: "All engagements" },
  ] },
  { id: "food-beverage", title: "Food & beverage", common: false, docs: [
    { label: "FSSAI licence / registration", about: "Food Safety and Standards Authority of India licence or registration", applies: "Food businesses" },
  ] },
  { id: "manufacturing-factories", title: "Manufacturing & factories", common: false, docs: [
    { label: "Factory Registration", about: "Registration under the Factories Act, 1948", applies: "Factories" },
    { label: "Factory License", about: "Licence to operate the factory", applies: "Factories" },
    { label: "Air pollution report", about: "Air emission / stack monitoring report, usually tied to Consent to Operate under the Air (Prevention and Control of Pollution) Act, 1981", applies: "Factories with emissions" },
    { label: "Water sanity report", about: "Read as water / effluent test report tied to Consent to Operate under the Water (Prevention and Control of Pollution) Act, 1974. Confirm it is not a drinking-water or sanitation report", applies: "Factories with effluent / water discharge" },
  ] },
  { id: "security-services", title: "Security services", common: false, docs: [
    { label: "PSARA licence", about: "Private Security Agencies (Regulation) Act, 2005 licence (written as PASARA in the source list)", applies: "Security agencies" },
  ] },
  { id: "construction", title: "Construction", common: false, docs: [
    { label: "BOCW registration", about: "Building and Other Construction Workers (Regulation of Employment and Conditions of Service) Act, 1996 registration", applies: "Establishments employing construction workers" },
  ] },
  { id: "bfsi", title: "BFSI", common: false, docs: [
    { label: "RBI / IRDAI / SEBI licence or registration", about: "Reserve Bank of India / Insurance Regulatory and Development Authority of India / Securities and Exchange Board of India licence or registration certificate", applies: "Regulated financial entities" },
    { label: "NBFC certificate of registration", about: "Non-Banking Financial Company certificate of registration", applies: "NBFCs" },
    { label: "Fit-and-proper declaration of directors", about: "Declaration that directors meet the regulator's fit-and-proper criteria", applies: "Regulated financial entities" },
    { label: "AML / KYC policy", about: "Anti-Money Laundering / Know Your Customer policy", applies: "Regulated financial entities" },
    { label: "Data-localisation and outsourcing compliance undertaking", about: "Commitment to store data in India and comply with the regulator's outsourcing norms", applies: "Regulated financial entities" },
  ] },
  { id: "healthcare-pharma", title: "Healthcare & pharma", common: false, docs: [
    { label: "Clinical Establishment registration", about: "Registration under the Clinical Establishments (Registration and Regulation) Act, 2010 or state equivalent", applies: "Clinics, hospitals, labs" },
    { label: "State medical council registration", about: "Registration of doctors with the state medical council", applies: "Medical practitioners" },
    { label: "NABH accreditation (if any)", about: "National Accreditation Board for Hospitals & Healthcare Providers accreditation", applies: "Optional" },
    { label: "Drug licence", about: "Licence under the Drugs and Cosmetics Act, 1940", applies: "Pharma / pharmacy" },
    { label: "CDSCO registration", about: "Central Drugs Standard Control Organisation registration", applies: "Pharma" },
    { label: "GST and pharmacy licence", about: "GST registration plus retail or wholesale pharmacy (drug) licence", applies: "Pharmacies" },
    { label: "HIPAA / equivalent data-handling undertaking", about: "Health Insurance Portability and Accountability Act (US) or equivalent data-handling undertaking", applies: "If client serves foreign patients" },
  ] },
];

/** One-click starting points. */
export const KYC_PRESETS: { id: string; title: string; labels: string[] }[] = [
  { id: 'core', title: 'Core company KYC', labels: ['Certificate of Incorporation (apostilled / notarised)', 'List of directors with DIN', 'UBO declaration', 'GST certificate', 'TAN', 'Cancelled cheque / bank letter'] },
  { id: 'labour', title: 'Labour compliance', labels: ['PF registration', 'ESIC registration', 'CLRA registration / licence', 'S&E registration'] },
  { id: 'contracts', title: 'Contracts pack', labels: ['Signed MSA', 'Order Form / SOW', 'DPA', 'NDA'] },
];

export const KYC_DEFAULT_LABELS = KYC_PRESETS[0].labels;
