/**
 * ValidationLevel2.tsx — Regnix Compliance Intelligence Workspace
 *
 * Architecture: 4 distinct sub-screens controlled by `activeView` state
 *
 *  1. OVERVIEW   — 29-document master checklist with upload, status, risk,
 *                  due-date, act, completion % bar. Grouped by category.
 *                  Filter by status / risk / act. Search. Progress ring.
 *
 *  2. VALIDATE   — Per-document deep validation engine:
 *                  • Rule checklist from the master audit library
 *                  • Each rule: Severity (Critical/Major/Minor), description,
 *                    status (Pass/Fail/Warning/NA), auto-detected vs manual
 *                  • Auditor remarks per rule, root cause, corrective action
 *                  • Overall doc score, validation verdict
 *
 *  3. ISSUES     — Master issue tracker across all 29 documents:
 *                  • Filterable by doc, severity, status, category
 *                  • Each row: Severity | Doc | Rule | Expected | Found |
 *                    Root Cause | Fix | Status | Auditor note | Action
 *                  • Bulk resolve / revalidate / waive
 *
 *  4. DASHBOARD  — Executive compliance scorecard:
 *                  • Per-act compliance bars (PF, ESIC, Wages, Tax, Labour…)
 *                  • Issue severity breakdown
 *                  • Statutory due-date tracker
 *                  • Upload/validation progress
 *
 * Zero inline styles except computed widths/colors for bars — all classes
 * from Validation.module.css (new v2* classes).
 */

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import s from './Validation.module.css';
import TermsModal from './TermsModal';
import type { UploadedDoc, SheetPreview } from './validationStore';

/* ════════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════════ */

type ActiveView   = 'overview' | 'validate' | 'issues' | 'dashboard';
type UploadStatus = 'Uploaded' | 'Pending' | 'Not Applicable';
type RiskLevel    = 'Critical' | 'High' | 'Medium' | 'Low';
type IssueStatus  = 'Open' | 'Resolved' | 'Revalidation' | 'Waived';
type RuleStatus   = 'Pass' | 'Fail' | 'Warning' | 'NA' | 'Pending';
type Severity     = 'Critical' | 'Major' | 'Minor';
type ActGroup     = 'PF' | 'ESIC' | 'Wages' | 'Tax' | 'Labour' | 'Insurance' | 'HR' | 'General';

interface ValidationRule {
  id:          string;
  ruleNo:      number;
  description: string;
  severity:    Severity;
  status:      RuleStatus;
  expected:    string;
  found:       string;
  rootCause:   string;
  fixAction:   string;
  autoCheck:   boolean;   // true = AI auto-detected, false = manual review
  remark:      string;
}

interface DocCard {
  id:              string;
  name:            string;
  shortName:       string;
  act:             string;
  actGroup:        ActGroup;
  uploadStatus:    UploadStatus;
  riskLevel:       RiskLevel;
  dueDate:         string;
  score:           number;
  rulesTotal:      number;
  rulesPassed:     number;
  rulesFailed:     number;
  file?:           File;
  sheets?:         SheetPreview[];
  validated:       boolean;
  mandatory:       boolean;
  validationRules: ValidationRule[];
}

interface ComplianceIssue {
  id:          string;
  docId:       string;
  docName:     string;
  ruleId:      string;
  ruleNo:      number;
  severity:    Severity;
  description: string;
  expected:    string;
  found:       string;
  rootCause:   string;
  fixAction:   string;
  status:      IssueStatus;
  remark:      string;
  detectedBy:  'AI' | 'Manual';
  createdAt:   string;
}

interface Props {
  docs:             UploadedDoc[];
  liveRegisterFile: File | null;
  companyName?:     string;
  onComplete:       () => void;
  onBack:           () => void;
}

/* ════════════════════════════════════════════════════════════════════════
   MASTER RULE LIBRARY
   15 rules per document, drawn from the Regnix audit rulebook: bank/wage
   reconciliation, statutory challans/ECRs, licences & certificates, HR
   letters, declarations, and generic "other" documents.
   ════════════════════════════════════════════════════════════════════════ */

type RuleTpl = Omit<ValidationRule, 'id' | 'status' | 'found' | 'remark'>;

const MASTER_RULES: Record<string, RuleTpl[]> = {
  'bank-advisory': [
    { ruleNo:1,  description:'Company name matches payroll register',        severity:'Critical', expected:'Exact match',        rootCause:'Name mismatch in bank template',          fixAction:'Correct company name in bank advice',          autoCheck:true  },
    { ruleNo:2,  description:'Salary month and year correct',                severity:'Critical', expected:'Current period',     rootCause:'Previous month advice uploaded',           fixAction:'Upload correct period document',               autoCheck:true  },
    { ruleNo:3,  description:'Employee count matches payroll',               severity:'Major',    expected:'Equal count',        rootCause:'Payroll not updated before bank advice',   fixAction:'Reconcile payroll and bank advice',             autoCheck:true  },
    { ruleNo:4,  description:'Total salary amount matches payroll',          severity:'Critical', expected:'Exact match',        rootCause:'Deductions/OT not reflected',              fixAction:'Recalculate and reissue bank advice',           autoCheck:true  },
    { ruleNo:5,  description:'Bank account numbers complete and valid',      severity:'Major',    expected:'All accounts valid', rootCause:'Incorrect account seeded',                 fixAction:'Verify accounts with bank records',             autoCheck:false },
    { ruleNo:6,  description:'UTR / transaction reference present',          severity:'Major',    expected:'Present',            rootCause:'Payment confirmation not attached',        fixAction:'Attach payment confirmation',                  autoCheck:true  },
    { ruleNo:7,  description:'Bank stamp / authorization present',          severity:'Major',    expected:'Stamped & signed',   rootCause:'Unsigned or unstamped document',           fixAction:'Get bank authorization stamp',                 autoCheck:false },
    { ruleNo:8,  description:'Salary paid on or before 7th of next month',  severity:'Critical', expected:'By 7th',             rootCause:'Processing delay',                         fixAction:'Ensure payroll cycle meets statutory deadline', autoCheck:true  },
    { ruleNo:9,  description:'No duplicate advisory uploaded',               severity:'Major',    expected:'Unique document',    rootCause:'System re-upload',                         fixAction:'Remove duplicate, retain single document',      autoCheck:true  },
    { ruleNo:10, description:'No salary reversal entries found',             severity:'Critical', expected:'No reversals',       rootCause:'Failed bank transactions',                 fixAction:'Investigate and reprocess failed payments',     autoCheck:true  },
    { ruleNo:11, description:'Payment narration includes employee detail',   severity:'Minor',    expected:'Valid narration',    rootCause:'Generic narration used',                   fixAction:'Update narration format',                      autoCheck:false },
    { ruleNo:12, description:'No inactive / exited employee paid',           severity:'Critical', expected:'Active only',        rootCause:'Exit not updated in payroll',              fixAction:'Audit payroll master for exit dates',           autoCheck:true  },
    { ruleNo:13, description:'Supporting payroll register available',       severity:'Major',    expected:'Attached',           rootCause:'Not uploaded in L1',                       fixAction:'Upload payroll register in L1',                autoCheck:true  },
    { ruleNo:14, description:'Document is readable and not blurred',        severity:'Minor',    expected:'Clear scan',         rootCause:'Poor scan quality',                        fixAction:'Re-scan at 300 DPI minimum',                   autoCheck:false },
    { ruleNo:15, description:'Payment approval authorization present',      severity:'Major',    expected:'Approved',           rootCause:'Approval missing before payment',          fixAction:'Attach signed payment approval',               autoCheck:false },
  ],
  'wage-slip': [
    { ruleNo:1,  description:'Employee name matches HRMS master',           severity:'Critical', expected:'Exact match',         rootCause:'Name mismatch in payroll',                fixAction:'Correct employee name in system',              autoCheck:true  },
    { ruleNo:2,  description:'Employee ID present and valid',                severity:'Major',    expected:'Valid ID',            rootCause:'ID field left blank',                     fixAction:'Add employee ID to payroll system',            autoCheck:true  },
    { ruleNo:3,  description:'Wage month and year correct',                  severity:'Critical', expected:'Current period',      rootCause:'Previous period slip uploaded',           fixAction:'Upload correct period slip',                   autoCheck:true  },
    { ruleNo:4,  description:'Gross salary matches payroll register',       severity:'Critical', expected:'Exact match',         rootCause:'OT or allowance not included',            fixAction:'Recalculate gross wages',                      autoCheck:true  },
    { ruleNo:5,  description:'Net salary calculation is correct',           severity:'Critical', expected:'Gross − Deductions',  rootCause:'Formula error in payroll',                fixAction:'Audit payroll calculation formula',            autoCheck:true  },
    { ruleNo:6,  description:'PF deduction matches ECR',                    severity:'Critical', expected:'12% of PF wages',     rootCause:'Rate applied incorrectly',                fixAction:'Correct PF deduction rate',                    autoCheck:true  },
    { ruleNo:7,  description:'ESIC deduction matches ECR',                  severity:'Critical', expected:'0.75% of gross',      rootCause:'Wrong rate applied',                      fixAction:'Correct ESIC deduction rate',                  autoCheck:true  },
    { ruleNo:8,  description:'Employer details complete',                   severity:'Major',    expected:'All fields present',  rootCause:'Template missing employer details',       fixAction:'Update wage slip template',                    autoCheck:false },
    { ruleNo:9,  description:'Authorized signature present',                severity:'Major',    expected:'Signed',              rootCause:'Unsigned slip uploaded',                  fixAction:'Get HR/payroll manager signature',             autoCheck:false },
    { ruleNo:10, description:'LOP / leave deductions correctly applied',    severity:'Major',    expected:'LOP as per attendance',rootCause:'Attendance not reconciled',              fixAction:'Reconcile attendance before payroll processing',autoCheck:true  },
    { ruleNo:11, description:'PT deduction applied where applicable',       severity:'Major',    expected:'As per state slab',    rootCause:'State-specific PT not configured',        fixAction:'Configure state-wise PT slabs',                autoCheck:true  },
    { ruleNo:12, description:'Document not blurred / unreadable',           severity:'Minor',    expected:'Clear',               rootCause:'Poor print quality',                      fixAction:'Reprint and scan',                             autoCheck:false },
  ],
  'pf-form5a': [
    { ruleNo:1,  description:'Establishment Code is correct',               severity:'Critical', expected:'EPFO code',          rootCause:'Wrong code in form',                      fixAction:'Verify establishment code with EPFO',          autoCheck:true  },
    { ruleNo:2,  description:'Employer name matches EPFO records',          severity:'Critical', expected:'Exact match',        rootCause:'Name variation / mismatch',               fixAction:'Update name as per EPFO portal',               autoCheck:true  },
    { ruleNo:3,  description:'Registered address matches EPFO',             severity:'Major',    expected:'Match EPFO records', rootCause:'Branch address used instead of registered',fixAction:'Update with registered office address',        autoCheck:false },
    { ruleNo:4,  description:'Authorised signatory details complete',      severity:'Critical', expected:'Name & designation', rootCause:'Signatory field blank',                   fixAction:'Complete signatory details',                   autoCheck:false },
    { ruleNo:5,  description:'Director / partner details correct',        severity:'Major',    expected:'Current directors',  rootCause:'Old directors listed after resignation',  fixAction:'Update with current board/partners',           autoCheck:false },
    { ruleNo:6,  description:'Latest version of Form 5A uploaded',        severity:'Major',    expected:'Current version',    rootCause:'Old form template used',                  fixAction:'Download latest form from EPFO portal',        autoCheck:false },
    { ruleNo:7,  description:'EPFO acknowledgement present',               severity:'Major',    expected:'Acknowledgement attached', rootCause:'Not filed online',                  fixAction:'File on EPFO portal and attach acknowledgement',autoCheck:false },
    { ruleNo:8,  description:'Amendment details included if applicable',   severity:'Minor',    expected:'Amendment noted',    rootCause:'Change not reflected',                    fixAction:'File amendment form with EPFO',                autoCheck:false },
    { ruleNo:9,  description:'All pages of form present',                  severity:'Major',    expected:'Complete document',  rootCause:'Partial scan',                            fixAction:'Re-scan all pages',                            autoCheck:false },
    { ruleNo:10, description:'Document is legible and clear',              severity:'Minor',    expected:'Clear scan',         rootCause:'Poor document quality',                   fixAction:'Rescan at higher resolution',                  autoCheck:false },
  ],
  'pf-challan': [
    { ruleNo:1,  description:'TRRN (Transaction Reference) present',        severity:'Critical', expected:'Valid TRRN',         rootCause:'Challan not verified online',              fixAction:'Verify challan on EPFO/bank portal',           autoCheck:true  },
    { ruleNo:2,  description:'Payment made on or before 15th of month',    severity:'Critical', expected:'By 15th',            rootCause:'Processing delay',                         fixAction:'Schedule PF payments before 12th',             autoCheck:true  },
    { ruleNo:3,  description:'Wage month is correct',                      severity:'Critical', expected:'Current period',     rootCause:'Advance/arrear month mismatch',            fixAction:'Correct wage month in challan',                autoCheck:true  },
    { ruleNo:4,  description:'Total amount matches PF consolidated',       severity:'Critical', expected:'Exact match',        rootCause:'Partial payment made',                     fixAction:'Pay balance and attach reconciliation',        autoCheck:true  },
    { ruleNo:5,  description:'Employee count matches ECR',                 severity:'Major',    expected:'Exact match',        rootCause:'ECR generated before all employees added', fixAction:'Regenerate ECR and challan',                   autoCheck:true  },
    { ruleNo:6,  description:'Employer contribution (EPF+EPS+EDLI) correct',severity:'Critical', expected:'As per ECR',        rootCause:'Wrong rate applied',                       fixAction:'Recalculate contribution breakup',             autoCheck:true  },
    { ruleNo:7,  description:'Employee EPF contribution correct',          severity:'Critical', expected:'12% of PF wages',    rootCause:'Incorrect wage ceiling applied',           fixAction:'Apply correct PF wage ceiling',                autoCheck:true  },
    { ruleNo:8,  description:'Administrative charges (0.5%) correct',      severity:'Major',    expected:'0.5% of EPF wages',  rootCause:'Old rate applied',                         fixAction:'Update admin charge rate',                     autoCheck:true  },
    { ruleNo:9,  description:'EDLI contribution (0.5%) correct',           severity:'Major',    expected:'0.5% of wages',      rootCause:'EDLI not configured',                      fixAction:'Configure EDLI in payroll',                    autoCheck:true  },
    { ruleNo:10, description:'No duplicate challan uploaded',              severity:'Major',    expected:'Unique challan',     rootCause:'Double upload',                            fixAction:'Remove duplicate',                             autoCheck:true  },
    { ruleNo:11, description:'Bank payment confirmation attached',         severity:'Major',    expected:'Bank receipt',       rootCause:'Confirmation not attached',                fixAction:'Attach bank payment receipt',                  autoCheck:false },
    { ruleNo:12, description:'Interest u/s 7Q not applicable',             severity:'Critical', expected:'Payment on time',    rootCause:'Late payment',                             fixAction:'Pay interest and file with EPFO',              autoCheck:true  },
    { ruleNo:13, description:'Damages u/s 14B not applicable',             severity:'Critical', expected:'No default',         rootCause:'Repeated late payment',                    fixAction:'Regularize payment schedule',                  autoCheck:true  },
    { ruleNo:14, description:'Correct establishment code on challan',      severity:'Critical', expected:'EPFO code',          rootCause:'Wrong code entered',                       fixAction:'Correct establishment code',                   autoCheck:true  },
    { ruleNo:15, description:'NCP (Non-Contributing Period) days correct', severity:'Major',    expected:'As per ECR',         rootCause:'Attendance not synced',                    fixAction:'Update NCP days from attendance',              autoCheck:true  },
  ],
  'pf-consolidated': [
    { ruleNo:1,  description:'Total employee count matches ECR',           severity:'Critical', expected:'Exact match',        rootCause:'ECR and consolidated generated separately',fixAction:'Regenerate from same payroll run',             autoCheck:true  },
    { ruleNo:2,  description:'Total gross wages match payroll register',   severity:'Critical', expected:'Exact match',        rootCause:'Arrears/OT excluded',                      fixAction:'Include all wage components',                  autoCheck:true  },
    { ruleNo:3,  description:'PF wages reconcile with gross wages',       severity:'Critical', expected:'≤₹15,000 ceiling',   rootCause:'Wrong wage ceiling applied',                fixAction:'Apply correct PF wage ceiling',                autoCheck:true  },
    { ruleNo:4,  description:'Employer EPF contribution (3.67%) correct', severity:'Critical', expected:'3.67% of PF wages',  rootCause:'Full 12% credited to EPF',                  fixAction:'Split EPF/EPS correctly',                      autoCheck:true  },
    { ruleNo:5,  description:'EPS contribution (8.33%) correct',           severity:'Critical', expected:'8.33% of PF wages',  rootCause:'EPS not calculated separately',             fixAction:'Recalculate EPS component',                    autoCheck:true  },
    { ruleNo:6,  description:'EDLI contribution (0.5%) correct',           severity:'Major',    expected:'0.5% of wages',      rootCause:'Not configured in payroll',                 fixAction:'Configure EDLI component',                     autoCheck:true  },
    { ruleNo:7,  description:'No duplicate employee entries',              severity:'Major',    expected:'Unique employees',   rootCause:'Payroll data duplication',                  fixAction:'Remove duplicates and reprocess',              autoCheck:true  },
    { ruleNo:8,  description:'No inactive employee included',              severity:'Major',    expected:'Active only',        rootCause:'Exit date not captured',                    fixAction:'Update exit in HR master',                     autoCheck:true  },
    { ruleNo:9,  description:'Contribution month matches challan month',   severity:'Critical', expected:'Same period',        rootCause:'Cut-off date processing error',             fixAction:'Align consolidated with challan period',       autoCheck:true  },
    { ruleNo:10, description:'Summary totals mathematically correct',      severity:'Critical', expected:'Formula correct',    rootCause:'Manual errors in summary',                  fixAction:'Regenerate from system',                       autoCheck:true  },
    { ruleNo:11, description:'Reconciles with bank advice total',          severity:'Critical', expected:'Match bank advice',  rootCause:'Deductions not passed to bank',             fixAction:'Reconcile payroll with bank advice',           autoCheck:true  },
    { ruleNo:12, description:'Digital approval / authorized signature',    severity:'Major',    expected:'Signed',             rootCause:'Unsigned document uploaded',                 fixAction:'Get payroll manager signature',                autoCheck:false },
  ],
  'pf-ecr': [
    { ruleNo:1,  description:'All UANs present and valid (12-digit)',      severity:'Critical', expected:'Valid UAN',          rootCause:'UAN not generated for new joiners',         fixAction:'Generate UAN on EPFO portal before ECR',       autoCheck:true  },
    { ruleNo:2,  description:'Employee names match EPFO member records',  severity:'Major',    expected:'Match EPFO',         rootCause:'Name entered differently in payroll',       fixAction:'Correct name as per Aadhaar/EPFO record',      autoCheck:true  },
    { ruleNo:3,  description:'PF wages within ceiling (₹15,000)',         severity:'Critical', expected:'≤₹15,000',           rootCause:'Wrong wage ceiling applied',                fixAction:'Cap PF wages at ₹15,000',                      autoCheck:true  },
    { ruleNo:4,  description:'No duplicate UANs in ECR',                  severity:'Critical', expected:'Unique UAN',         rootCause:'Employee appears in two departments',       fixAction:'Remove duplicate entry',                       autoCheck:true  },
    { ruleNo:5,  description:'Exited employees not included',             severity:'Critical', expected:'Active only',        rootCause:'Exit date not updated',                     fixAction:'Remove exited employee, update EPFO',          autoCheck:true  },
    { ruleNo:6,  description:'New joiners included in ECR',               severity:'Critical', expected:'All joiners present',rootCause:'Joiner cut-off missed',                    fixAction:'Add joiner and regenerate ECR',                autoCheck:true  },
    { ruleNo:7,  description:'Aadhaar seeded for all employees',           severity:'Major',    expected:'Aadhaar linked',     rootCause:'Employee not completed KYC',                fixAction:'Complete Aadhaar seeding on EPFO portal',      autoCheck:true  },
    { ruleNo:8,  description:'NCP (Non-Contributing) days correct',        severity:'Major',    expected:'Match attendance',   rootCause:'Attendance data not synchronized',          fixAction:'Update NCP from attendance system',            autoCheck:true  },
    { ruleNo:9,  description:'Gross wages match payroll register',        severity:'Critical', expected:'Exact match',        rootCause:'ECR generated from different data',         fixAction:'Regenerate ECR from same payroll run',         autoCheck:true  },
    { ruleNo:10, description:'ECR uploaded within due date',               severity:'Critical', expected:'By 15th',            rootCause:'Late upload',                               fixAction:'Upload ECR before 15th',                       autoCheck:true  },
    { ruleNo:11, description:'UAN not deactivated',                        severity:'Critical', expected:'Active UAN',         rootCause:'Employee has multiple companies',           fixAction:'Reactivate UAN or link correct UAN',           autoCheck:true  },
    { ruleNo:12, description:'Employer contribution matches ECR total',    severity:'Critical', expected:'Match ECR',          rootCause:'Manual adjustment in challan',              fixAction:'Reconcile ECR and challan amounts',            autoCheck:true  },
    { ruleNo:13, description:'Correct DOJ entered for new joiners',        severity:'Major',    expected:'Actual DOJ',         rootCause:'Wrong date entered',                        fixAction:'Correct DOJ and update EPFO',                  autoCheck:true  },
    { ruleNo:14, description:'Correct DOE entered for exiting employees',  severity:'Major',    expected:'Actual DOE',         rootCause:'Wrong date entered',                        fixAction:'Correct DOE and file exit on EPFO',            autoCheck:true  },
  ],
  'esic-reg': [
    { ruleNo:1,  description:'Employer code matches ESIC registration',    severity:'Critical', expected:'Valid code',         rootCause:'Wrong code on certificate',                 fixAction:'Verify with ESIC portal',                      autoCheck:true  },
    { ruleNo:2,  description:'Company name matches ESIC portal',          severity:'Critical', expected:'Exact match',        rootCause:'Trade name used instead of legal name',     fixAction:'Correct name on ESIC registration',            autoCheck:true  },
    { ruleNo:3,  description:'Registered address matches ESIC',            severity:'Major',    expected:'Match ESIC',         rootCause:'Branch address used',                       fixAction:'Update registration with correct address',     autoCheck:false },
    { ruleNo:4,  description:'Certificate is not expired',                 severity:'Critical', expected:'Valid',              rootCause:'Certificate validity lapsed',               fixAction:'Renew ESIC registration',                      autoCheck:true  },
    { ruleNo:5,  description:'Government seal present',                   severity:'Major',    expected:'Seal present',       rootCause:'Photocopy without seal',                    fixAction:'Obtain original with government seal',         autoCheck:false },
    { ruleNo:6,  description:'All pages of certificate uploaded',          severity:'Major',    expected:'Complete upload',    rootCause:'Partial scan',                              fixAction:'Re-scan complete certificate',                 autoCheck:false },
    { ruleNo:7,  description:'Registration number format valid',          severity:'Critical', expected:'Valid format',       rootCause:'Incorrect number format',                   fixAction:'Cross-check with ESIC portal',                 autoCheck:true  },
    { ruleNo:8,  description:'No duplicate certificate uploaded',         severity:'Minor',    expected:'Unique upload',      rootCause:'System re-upload',                          fixAction:'Remove duplicate',                             autoCheck:true  },
    { ruleNo:9,  description:'Document is legible',                       severity:'Minor',    expected:'Clear scan',         rootCause:'Poor scan quality',                         fixAction:'Rescan certificate',                           autoCheck:false },
    { ruleNo:10, description:'Correct establishment linked',              severity:'Critical', expected:'Correct entity',     rootCause:'Multiple establishments confused',          fixAction:'Link correct establishment',                   autoCheck:false },
  ],
  'esic-challan': [
    { ruleNo:1,  description:'Challan number present',                    severity:'Critical', expected:'Valid number',       rootCause:'Challan not generated properly',            fixAction:'Generate challan on ESIC portal',              autoCheck:true  },
    { ruleNo:2,  description:'Payment made on or before 15th',            severity:'Critical', expected:'By 15th',            rootCause:'Late payment',                              fixAction:'Schedule ESIC payment before 13th',            autoCheck:true  },
    { ruleNo:3,  description:'Contribution period is correct',            severity:'Critical', expected:'Current month',      rootCause:'Wrong month selected',                      fixAction:'Correct contribution period',                  autoCheck:true  },
    { ruleNo:4,  description:'Total amount matches ESIC ECR',             severity:'Critical', expected:'Exact match',        rootCause:'Manual override',                           fixAction:'Reconcile challan with ECR',                   autoCheck:true  },
    { ruleNo:5,  description:'Employer code matches registration',        severity:'Critical', expected:'Match registration', rootCause:'Code typed incorrectly',                    fixAction:'Correct employer code',                        autoCheck:true  },
    { ruleNo:6,  description:'Employee count matches ECR',                severity:'Major',    expected:'Exact match',        rootCause:'Employees added after ECR generation',      fixAction:'Regenerate ECR and challan',                   autoCheck:true  },
    { ruleNo:7,  description:'No duplicate challan uploaded',             severity:'Major',    expected:'Unique challan',     rootCause:'Double upload',                             fixAction:'Remove duplicate',                             autoCheck:true  },
    { ruleNo:8,  description:'Interest not applicable (paid on time)',   severity:'Critical', expected:'No interest',        rootCause:'Late payment',                              fixAction:'Pay interest and regularize',                  autoCheck:true  },
    { ruleNo:9,  description:'Payment receipt attached',                  severity:'Major',    expected:'Receipt present',    rootCause:'Not attached',                              fixAction:'Attach bank payment receipt',                  autoCheck:false },
    { ruleNo:10, description:'Document is readable',                      severity:'Minor',    expected:'Clear scan',         rootCause:'Poor scan',                                 fixAction:'Rescan',                                       autoCheck:false },
    { ruleNo:11, description:'Correct establishment on challan',          severity:'Critical', expected:'Correct entity',     rootCause:'Multi-establishment confusion',             fixAction:'Verify establishment on challan',              autoCheck:false },
    { ruleNo:12, description:'Gross wages match payroll register',        severity:'Critical', expected:'Match payroll',      rootCause:'ECR generated from different source',       fixAction:'Regenerate from payroll',                      autoCheck:true  },
  ],
  'esic-ecr': [
    { ruleNo:1,  description:'Employee IP numbers present and valid',     severity:'Critical', expected:'Valid IP number',    rootCause:'New employee not registered on ESIC',       fixAction:'Register employee and get IP number',          autoCheck:true  },
    { ruleNo:2,  description:'No duplicate IP numbers',                  severity:'Critical', expected:'Unique IP',          rootCause:'Data duplication',                          fixAction:'Remove duplicate entry',                       autoCheck:true  },
    { ruleNo:3,  description:'All eligible employees included',          severity:'Critical', expected:'All covered',        rootCause:'Wage ceiling check error',                  fixAction:'Include all employees within wage ceiling',    autoCheck:true  },
    { ruleNo:4,  description:'Gross wages match payroll',                severity:'Critical', expected:'Exact match',        rootCause:'ECR generated separately from payroll',     fixAction:'Regenerate from payroll system',               autoCheck:true  },
    { ruleNo:5,  description:'Employee contribution (0.75%) correct',    severity:'Critical', expected:'0.75% of gross',     rootCause:'Wrong rate applied',                        fixAction:'Correct ESIC employee rate',                   autoCheck:true  },
    { ruleNo:6,  description:'Employer contribution (3.25%) correct',    severity:'Critical', expected:'3.25% of gross',     rootCause:'Wrong rate applied',                        fixAction:'Correct ESIC employer rate',                   autoCheck:true  },
    { ruleNo:7,  description:'Wage ceiling validation (₹21,000)',        severity:'Critical', expected:'≤₹21,000',           rootCause:'Excluded employee earning within ceiling',  fixAction:'Include employee in ESIC',                     autoCheck:true  },
    { ruleNo:8,  description:'No exited employee included',              severity:'Major',    expected:'Active only',        rootCause:'Exit not updated',                          fixAction:'Remove exited employee',                       autoCheck:true  },
    { ruleNo:9,  description:'Correct contribution month',                severity:'Critical', expected:'Current month',      rootCause:'Previous month ECR re-uploaded',            fixAction:'Regenerate for current month',                 autoCheck:true  },
    { ruleNo:10, description:'ECR uploaded within due date',              severity:'Critical', expected:'By 15th',            rootCause:'Late upload',                               fixAction:'Upload before 15th',                           autoCheck:true  },
    { ruleNo:11, description:'Correct DOJ for new employees',             severity:'Major',    expected:'Actual DOJ',         rootCause:'Wrong date entered',                        fixAction:'Correct DOJ',                                  autoCheck:true  },
    { ruleNo:12, description:'Employee status correct (Active/Exited)',  severity:'Major',    expected:'Correct status',     rootCause:'Status not updated',                        fixAction:'Update employee status',                       autoCheck:true  },
  ],
  'emp-comp-policy': [
    { ruleNo:1,  description:'Policy is not expired',                     severity:'Critical', expected:'Valid policy',       rootCause:'Renewal not done',                          fixAction:'Renew Employee Compensation Policy',           autoCheck:true  },
    { ruleNo:2,  description:'Coverage amount is adequate',               severity:'Critical', expected:'As per Act',         rootCause:'Insufficient coverage purchased',           fixAction:'Enhance coverage amount',                       autoCheck:false },
    { ruleNo:3,  description:'Correct legal entity is insured',           severity:'Critical', expected:'Company name match', rootCause:'Old entity name on policy',                 fixAction:'Update insured entity name',                    autoCheck:false },
    { ruleNo:4,  description:'Policy number present',                     severity:'Major',    expected:'Policy number',      rootCause:'Certificate page missing',                  fixAction:'Upload complete certificate',                   autoCheck:true  },
    { ruleNo:5,  description:'All covered employees/categories listed',   severity:'Major',    expected:'All categories',     rootCause:'New categories not added',                  fixAction:'Update policy to include new categories',       autoCheck:false },
    { ruleNo:6,  description:'Insurer details complete',                  severity:'Minor',    expected:'Insurer details',    rootCause:'Details not on certificate',                fixAction:'Obtain complete certificate',                   autoCheck:false },
    { ruleNo:7,  description:'Authorized signature present',              severity:'Major',    expected:'Signed',             rootCause:'Unsigned document',                         fixAction:'Get insurer signature',                         autoCheck:false },
    { ruleNo:8,  description:'Renewal not overdue',                       severity:'Critical', expected:'Active policy',      rootCause:'Renewal deadline missed',                   fixAction:'Renew immediately',                             autoCheck:true  },
    { ruleNo:9,  description:'Document complete (all pages)',             severity:'Minor',    expected:'All pages',          rootCause:'Partial upload',                            fixAction:'Upload complete policy document',               autoCheck:false },
    { ruleNo:10, description:'Document is readable',                      severity:'Minor',    expected:'Clear scan',         rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'cert-insurance': [
    { ruleNo:1,  description:'Policy is not expired',                     severity:'Critical', expected:'Valid policy',       rootCause:'Renewal delayed',                           fixAction:'Renew immediately',                             autoCheck:true  },
    { ruleNo:2,  description:'Company name matches exactly',              severity:'Critical', expected:'Exact match',        rootCause:'Trade name vs legal name mismatch',         fixAction:'Correct entity name on policy',                 autoCheck:false },
    { ruleNo:3,  description:'Policy number present',                     severity:'Major',    expected:'Policy number',      rootCause:'Incomplete certificate',                    fixAction:'Obtain complete certificate',                   autoCheck:true  },
    { ruleNo:4,  description:'Coverage is adequate',                      severity:'Critical', expected:'Minimum coverage',   rootCause:'Under-insurance',                           fixAction:'Increase coverage',                             autoCheck:false },
    { ruleNo:5,  description:'Government/insurer seal present',           severity:'Major',    expected:'Sealed',             rootCause:'Photocopy without seal',                    fixAction:'Get stamped original',                          autoCheck:false },
    { ruleNo:6,  description:'Validity period explicitly mentioned',      severity:'Major',    expected:'Dates present',      rootCause:'Certificate incomplete',                    fixAction:'Obtain complete certificate with dates',        autoCheck:true  },
    { ruleNo:7,  description:'Insurer details complete',                  severity:'Minor',    expected:'Full details',       rootCause:'Details missing',                           fixAction:'Request complete certificate',                  autoCheck:false },
    { ruleNo:8,  description:'No duplicate upload',                       severity:'Minor',    expected:'Unique',             rootCause:'Re-upload',                                 fixAction:'Remove duplicate',                              autoCheck:true  },
    { ruleNo:9,  description:'All pages present',                         severity:'Minor',    expected:'Complete',           rootCause:'Partial scan',                              fixAction:'Upload all pages',                              autoCheck:false },
    { ruleNo:10, description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor quality',                              fixAction:'Rescan',                                        autoCheck:false },
  ],
  'reg-cert': [
    { ruleNo:1,  description:'Registration number format is valid',       severity:'Critical', expected:'Valid format',       rootCause:'Incorrect registration number',             fixAction:'Verify with authority',                         autoCheck:true  },
    { ruleNo:2,  description:'Company name matches registration',         severity:'Critical', expected:'Exact match',        rootCause:'Trade name used',                           fixAction:'Correct on registration',                       autoCheck:false },
    { ruleNo:3,  description:'Certificate not expired',                   severity:'Critical', expected:'Valid',              rootCause:'Not renewed',                               fixAction:'Renew registration',                            autoCheck:true  },
    { ruleNo:4,  description:'Registered address matches',                severity:'Major',    expected:'Match records',      rootCause:'Branch address used',                       fixAction:'Update address',                                autoCheck:false },
    { ruleNo:5,  description:'Authority details and seal present',        severity:'Major',    expected:'Sealed & signed',    rootCause:'Photocopy uploaded',                        fixAction:'Upload original certificate',                   autoCheck:false },
    { ruleNo:6,  description:'All pages present',                         severity:'Minor',    expected:'Complete',           rootCause:'Partial upload',                            fixAction:'Upload all pages',                              autoCheck:false },
    { ruleNo:7,  description:'No duplicate upload',                       severity:'Minor',    expected:'Unique',             rootCause:'Re-upload',                                 fixAction:'Remove duplicate',                              autoCheck:true  },
    { ruleNo:8,  description:'Document is legible',                       severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'se-licence': [
    { ruleNo:1,  description:'Licence is not expired',                    severity:'Critical', expected:'Valid',              rootCause:'Renewal not done timely',                   fixAction:'Renew S&E licence before expiry',               autoCheck:true  },
    { ruleNo:2,  description:'Establishment name and address match',      severity:'Critical', expected:'Exact match',        rootCause:'Branch relocated',                          fixAction:'Update licence with new address',               autoCheck:false },
    { ruleNo:3,  description:'Licence number present',                    severity:'Major',    expected:'Number present',     rootCause:'Incomplete document',                       fixAction:'Upload complete licence',                       autoCheck:true  },
    { ruleNo:4,  description:'Renewal not overdue',                       severity:'Critical', expected:'Current',            rootCause:'Renewal deadline missed',                   fixAction:'File renewal immediately',                      autoCheck:true  },
    { ruleNo:5,  description:'Authority signature and seal present',      severity:'Major',    expected:'Signed & sealed',     rootCause:'Photocopy uploaded',                        fixAction:'Upload original licence',                       autoCheck:false },
    { ruleNo:6,  description:'All pages uploaded',                        severity:'Minor',    expected:'Complete',           rootCause:'Partial scan',                              fixAction:'Upload all pages',                              autoCheck:false },
    { ruleNo:7,  description:'No duplicate upload',                       severity:'Minor',    expected:'Unique',             rootCause:'Re-upload',                                 fixAction:'Remove duplicate',                              autoCheck:true  },
    { ruleNo:8,  description:'Category of establishment correct',         severity:'Major',    expected:'Match actual use',   rootCause:'Wrong category on licence',                 fixAction:'Amend licence category',                        autoCheck:false },
    { ruleNo:9,  description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'clra-licence': [
    { ruleNo:1,  description:'Licence is not expired',                    severity:'Critical', expected:'Valid',              rootCause:'Renewal delayed',                           fixAction:'Renew CLRA licence immediately',                autoCheck:true  },
    { ruleNo:2,  description:'Maximum labour count not exceeded',         severity:'Critical', expected:'Within limit',       rootCause:'Headcount grew beyond licensed limit',      fixAction:'Apply for enhanced limit',                      autoCheck:true  },
    { ruleNo:3,  description:'Correct contractor details on licence',     severity:'Critical', expected:'Match records',      rootCause:'Different contractor entity',               fixAction:'Correct contractor entity',                     autoCheck:false },
    { ruleNo:4,  description:'Correct principal employer details',        severity:'Critical', expected:'Match records',      rootCause:'PE changed but licence not updated',        fixAction:'Update PE details on CLRA',                     autoCheck:false },
    { ruleNo:5,  description:'Licence number format valid',                severity:'Major',    expected:'Valid format',       rootCause:'Number entered incorrectly',                fixAction:'Verify with labour office',                     autoCheck:true  },
    { ruleNo:6,  description:'Establishment address matches',             severity:'Major',    expected:'Match records',      rootCause:'Address changed, licence not amended',      fixAction:'Amend licence address',                         autoCheck:false },
    { ruleNo:7,  description:'Government seal and signature present',    severity:'Major',    expected:'Stamped & signed',   rootCause:'Photocopy uploaded',                        fixAction:'Upload original with seal',                     autoCheck:false },
    { ruleNo:8,  description:'Nature of work matches actual work',        severity:'Major',    expected:'Match actual',       rootCause:'Work nature changed',                       fixAction:'Amend licence for work nature',                 autoCheck:false },
    { ruleNo:9,  description:'Renewal not pending',                       severity:'Critical', expected:'Current',            rootCause:'Renewal overdue',                           fixAction:'File for renewal',                              autoCheck:true  },
    { ruleNo:10, description:'No invalid licence number',                 severity:'Critical', expected:'Valid number',       rootCause:'Fake or tampered licence suspected',        fixAction:'Verify authenticity with authority',            autoCheck:true  },
    { ruleNo:11, description:'All pages present',                         severity:'Minor',    expected:'Complete',           rootCause:'Partial scan',                              fixAction:'Upload complete document',                      autoCheck:false },
    { ruleNo:12, description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'statutory-registers': [
    { ruleNo:1,  description:'Correct register format per applicable Act',severity:'Critical', expected:'Prescribed format',  rootCause:'Old format or custom template used',        fixAction:'Use latest prescribed register format',         autoCheck:false },
    { ruleNo:2,  description:'All mandatory employee entries present',    severity:'Critical', expected:'All employees',      rootCause:'New joiners not added',                     fixAction:'Update register with all employees',            autoCheck:true  },
    { ruleNo:3,  description:'All mandatory columns filled',              severity:'Major',    expected:'No blank columns',   rootCause:'Partial data entry',                        fixAction:'Complete all mandatory columns',                 autoCheck:false },
    { ruleNo:4,  description:'Monthly signatures present',                severity:'Major',    expected:'Signed monthly',     rootCause:'Signatures not taken regularly',            fixAction:'Get retrospective signatures from employer',    autoCheck:false },
    { ruleNo:5,  description:'Dates are correct and valid',               severity:'Major',    expected:'Correct dates',      rootCause:'Data entry errors',                         fixAction:'Correct dates in register',                      autoCheck:true  },
    { ruleNo:6,  description:'No calculation errors',                     severity:'Critical', expected:'Correct math',       rootCause:'Manual calculation errors',                 fixAction:'Verify and correct calculations',                autoCheck:true  },
    { ruleNo:7,  description:'No duplicate employee entries',             severity:'Major',    expected:'Unique',             rootCause:'Data entry error',                          fixAction:'Remove duplicates',                              autoCheck:true  },
    { ruleNo:8,  description:'Register is updated (not months behind)',   severity:'Critical', expected:'Current month',      rootCause:'Periodic update not done',                  fixAction:'Update register immediately',                   autoCheck:true  },
    { ruleNo:9,  description:'Registers maintained for all applicable Acts',severity:'Critical', expected:'All registers',   rootCause:'Some registers not maintained',              fixAction:'Identify and maintain missing registers',       autoCheck:false },
    { ruleNo:10, description:'Document is readable',                      severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'gstin': [
    { ruleNo:1,  description:'GSTIN format valid (15 characters)',        severity:'Critical', expected:'Valid GSTIN',        rootCause:'Incorrect GSTIN entered',                   fixAction:'Verify GSTIN on GST portal',                     autoCheck:true  },
    { ruleNo:2,  description:'Business legal name matches MCA records',   severity:'Critical', expected:'Exact match',        rootCause:'Name variation used',                       fixAction:'Update GSTIN or MCA records',                   autoCheck:true  },
    { ruleNo:3,  description:'Trade name correct',                        severity:'Major',    expected:'Match portal',       rootCause:'Wrong trade name',                          fixAction:'Correct trade name',                            autoCheck:true  },
    { ruleNo:4,  description:'Registered address matches GST portal',     severity:'Major',    expected:'Match portal',       rootCause:'Address not updated after change',          fixAction:'File GST amendment',                             autoCheck:false },
    { ruleNo:5,  description:'Registration is Active (not cancelled)',    severity:'Critical', expected:'Active',             rootCause:'Non-compliance leading to cancellation',    fixAction:'Regularize GST compliance',                      autoCheck:true  },
    { ruleNo:6,  description:'Certificate is latest version',             severity:'Minor',    expected:'Current',            rootCause:'Old certificate uploaded',                  fixAction:'Download current certificate from GST portal',  autoCheck:true  },
    { ruleNo:7,  description:'PAN embedded in GSTIN matches company PAN', severity:'Critical', expected:'Matching PAN',       rootCause:'Wrong GSTIN or PAN mismatch',               fixAction:'Verify GSTIN structure',                         autoCheck:true  },
    { ruleNo:8,  description:'State code correct',                        severity:'Major',    expected:'Match state',        rootCause:'Wrong state code in GSTIN',                 fixAction:'Verify state code',                              autoCheck:true  },
    { ruleNo:9,  description:'No duplicate certificate uploaded',         severity:'Minor',    expected:'Unique',             rootCause:'Re-upload',                                 fixAction:'Remove duplicate',                              autoCheck:true  },
    { ruleNo:10, description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Download fresh copy from GST portal',           autoCheck:false },
    { ruleNo:11, description:'Registration date matches actual date',     severity:'Major',    expected:'Match records',      rootCause:'Wrong registration date on certificate',    fixAction:'Verify on GST portal',                           autoCheck:true  },
  ],
  'gratuity-form5': [
    { ruleNo:1,  description:'Employer/company details complete',        severity:'Critical', expected:'All details',        rootCause:'Template not updated',                      fixAction:'Complete employer section',                     autoCheck:false },
    { ruleNo:2,  description:'Employee details match HR records',        severity:'Critical', expected:'Match HR',           rootCause:'Data entry error',                          fixAction:'Correct employee details',                      autoCheck:true  },
    { ruleNo:3,  description:'Nominee details complete',                  severity:'Major',    expected:'All nominee details',rootCause:'Employee did not complete nomination',      fixAction:'Get employee to complete nomination',           autoCheck:false },
    { ruleNo:4,  description:'Date of nomination present',                severity:'Major',    expected:'Date present',       rootCause:'Date field blank',                          fixAction:'Enter date of nomination',                      autoCheck:false },
    { ruleNo:5,  description:'Employee signature present',                severity:'Critical', expected:'Signed by employee', rootCause:'Form not signed',                           fixAction:'Get employee signature',                        autoCheck:false },
    { ruleNo:6,  description:'Witness signature present (if required)',   severity:'Major',    expected:'Witnessed',          rootCause:'Witness not arranged',                      fixAction:'Get witness to sign',                           autoCheck:false },
    { ruleNo:7,  description:'Latest version of Form 5 used',             severity:'Major',    expected:'Current version',    rootCause:'Old form used',                             fixAction:'Download latest form',                          autoCheck:false },
    { ruleNo:8,  description:'No duplicate form for same employee',       severity:'Minor',    expected:'Unique',             rootCause:'Re-submission',                             fixAction:'Retain latest, remove duplicate',               autoCheck:true  },
    { ruleNo:9,  description:'All pages present',                         severity:'Minor',    expected:'Complete',           rootCause:'Partial scan',                              fixAction:'Upload all pages',                              autoCheck:false },
    { ruleNo:10, description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'appointment-letter': [
    { ruleNo:1,  description:'Employee name matches HR master',           severity:'Critical', expected:'Exact match',        rootCause:'Name error in letter',                      fixAction:'Reissue with correct name',                     autoCheck:true  },
    { ruleNo:2,  description:'Date of joining matches actual DOJ',        severity:'Critical', expected:'Match HR records',   rootCause:'Incorrect DOJ on letter',                   fixAction:'Reissue with correct DOJ',                      autoCheck:true  },
    { ruleNo:3,  description:'Designation matches HR records',           severity:'Major',    expected:'Match HR',           rootCause:'Different designation on letter',           fixAction:'Reissue with correct designation',              autoCheck:true  },
    { ruleNo:4,  description:'CTC / salary matches payroll',              severity:'Critical', expected:'Match payroll',      rootCause:'Offer revised but letter not updated',      fixAction:'Reissue updated letter',                        autoCheck:true  },
    { ruleNo:5,  description:'Notice period clearly stated',              severity:'Major',    expected:'Stated',             rootCause:'Clause missing',                            fixAction:'Add notice period clause',                      autoCheck:false },
    { ruleNo:6,  description:'Probation period mentioned',                severity:'Major',    expected:'Stated',             rootCause:'Clause missing',                            fixAction:'Add probation clause',                          autoCheck:false },
    { ruleNo:7,  description:'Employee signature present',                severity:'Critical', expected:'Signed',             rootCause:'Acknowledgement not taken',                 fixAction:'Get employee acknowledgement signature',        autoCheck:false },
    { ruleNo:8,  description:'HR/authorized signatory signature present', severity:'Major',    expected:'Signed',             rootCause:'Unsigned letter uploaded',                  fixAction:'Get authorized signatory',                      autoCheck:false },
    { ruleNo:9,  description:'Company seal present',                      severity:'Major',    expected:'Seal present',       rootCause:'Letter issued without seal',                fixAction:'Re-issue with seal',                            autoCheck:false },
    { ruleNo:10, description:'Signed copy uploaded (not editable doc)',   severity:'Major',    expected:'Signed PDF/scan',    rootCause:'Editable document uploaded',                fixAction:'Upload signed copy only',                       autoCheck:false },
    { ruleNo:11, description:'All pages present',                         severity:'Minor',    expected:'Complete',           rootCause:'Partial scan',                              fixAction:'Upload all pages',                              autoCheck:false },
    { ruleNo:12, description:'Standard compliance clauses present',      severity:'Minor',    expected:'Clauses present',    rootCause:'Standard clauses omitted',                  fixAction:'Include standard compliance clauses',           autoCheck:false },
    { ruleNo:13, description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'offer-letter': [
    { ruleNo:1,  description:'Candidate name matches joining records',    severity:'Critical', expected:'Exact match',        rootCause:'Name mismatch',                             fixAction:'Reissue with correct name',                     autoCheck:true  },
    { ruleNo:2,  description:'Salary/CTC matches appointment letter',    severity:'Critical', expected:'Match appointment',  rootCause:'Salary revised but offer not updated',      fixAction:'Reissue updated offer',                         autoCheck:true  },
    { ruleNo:3,  description:'Designation matches appointment letter',   severity:'Major',    expected:'Match appointment',  rootCause:'Designation changed',                       fixAction:'Align both documents',                          autoCheck:true  },
    { ruleNo:4,  description:'Joining date mentioned',                    severity:'Major',    expected:'Date present',       rootCause:'Joining date not mentioned',                fixAction:'Reissue with joining date',                     autoCheck:false },
    { ruleNo:5,  description:'Candidate acceptance/signature present',   severity:'Critical', expected:'Accepted',           rootCause:'Acceptance not taken',                      fixAction:'Get candidate to sign and return offer',        autoCheck:false },
    { ruleNo:6,  description:'HR signature present',                     severity:'Major',    expected:'Signed',             rootCause:'Unsigned offer uploaded',                   fixAction:'Get HR signature',                              autoCheck:false },
    { ruleNo:7,  description:'Offer not expired/withdrawn',               severity:'Critical', expected:'Active offer',       rootCause:'Expired offer uploaded',                    fixAction:'Remove invalid offer',                          autoCheck:true  },
    { ruleNo:8,  description:'Correct company (legal entity) name',      severity:'Critical', expected:'Legal entity name',  rootCause:'Wrong entity name',                         fixAction:'Reissue on correct entity letterhead',          autoCheck:false },
    { ruleNo:9,  description:'All pages present',                        severity:'Minor',    expected:'Complete',           rootCause:'Partial scan',                              fixAction:'Upload all pages',                              autoCheck:false },
    { ruleNo:10, description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'pt-challan': [
    { ruleNo:1,  description:'PT registration number matches certificate',severity:'Critical', expected:'Match certificate',  rootCause:'Wrong number on challan',                   fixAction:'Correct PT registration number',                autoCheck:true  },
    { ruleNo:2,  description:'Payment period is correct',                 severity:'Critical', expected:'Correct period',     rootCause:'Wrong period selected',                     fixAction:'Correct payment period',                        autoCheck:true  },
    { ruleNo:3,  description:'Amount matches applicable PT slab',         severity:'Critical', expected:'Per state slab',     rootCause:'Wrong slab applied',                        fixAction:'Apply correct state-specific PT slab',          autoCheck:true  },
    { ruleNo:4,  description:'Payment made on time (state due date)',    severity:'Critical', expected:'On time',            rootCause:'Late payment',                              fixAction:'Regularize with late fee if applicable',        autoCheck:true  },
    { ruleNo:5,  description:'No duplicate challan',                      severity:'Major',    expected:'Unique',             rootCause:'Double upload',                             fixAction:'Remove duplicate',                              autoCheck:true  },
    { ruleNo:6,  description:'Bank confirmation attached',                 severity:'Major',    expected:'Receipt present',    rootCause:'Not attached',                              fixAction:'Attach payment receipt',                        autoCheck:false },
    { ruleNo:7,  description:'Employee count matches payroll',            severity:'Major',    expected:'Match payroll',      rootCause:'Count not updated',                         fixAction:'Update employee count',                         autoCheck:true  },
    { ruleNo:8,  description:'Correct establishment on challan',          severity:'Major',    expected:'Correct entity',     rootCause:'Wrong establishment',                       fixAction:'Verify establishment',                          autoCheck:false },
    { ruleNo:9,  description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'lwf-challan': [
    { ruleNo:1,  description:'Contribution period matches payment period',severity:'Critical', expected:'Same period',        rootCause:'Wrong period selected',                     fixAction:'Correct contribution period',                   autoCheck:true  },
    { ruleNo:2,  description:'Amount matches applicable LWF slab',        severity:'Critical', expected:'Per state slab',     rootCause:'Wrong rate applied',                        fixAction:'Apply correct state LWF rate',                  autoCheck:true  },
    { ruleNo:3,  description:'Payment made before due date',              severity:'Critical', expected:'On time',            rootCause:'Late payment',                              fixAction:'Regularize with applicable late fee',           autoCheck:true  },
    { ruleNo:4,  description:'Employee count matches payroll',            severity:'Major',    expected:'Match payroll',      rootCause:'Count not updated',                         fixAction:'Update employee count',                         autoCheck:true  },
    { ruleNo:5,  description:'No duplicate challan',                      severity:'Major',    expected:'Unique',             rootCause:'Double upload',                             fixAction:'Remove duplicate',                              autoCheck:true  },
    { ruleNo:6,  description:'LWF registration number matches',           severity:'Major',    expected:'Match registration', rootCause:'Wrong registration used',                   fixAction:'Correct registration number',                   autoCheck:true  },
    { ruleNo:7,  description:'Payment receipt present',                   severity:'Major',    expected:'Receipt attached',   rootCause:'Not attached',                              fixAction:'Attach bank receipt',                           autoCheck:false },
    { ruleNo:8,  description:'Correct establishment on challan',          severity:'Major',    expected:'Correct entity',     rootCause:'Multi-establishment issue',                 fixAction:'Verify establishment',                          autoCheck:false },
    { ruleNo:9,  description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'declaration': [
    { ruleNo:1,  description:'Employee name present, matches HR records', severity:'Critical', expected:'Match HR',           rootCause:'Name not filled or wrong',                  fixAction:'Complete name field correctly',                 autoCheck:true  },
    { ruleNo:2,  description:'Employee ID / code present',                severity:'Major',    expected:'ID present',         rootCause:'ID field blank',                            fixAction:'Fill employee ID',                              autoCheck:true  },
    { ruleNo:3,  description:'Date of declaration present',               severity:'Major',    expected:'Date present',       rootCause:'Date not filled',                           fixAction:'Add declaration date',                          autoCheck:false },
    { ruleNo:4,  description:'Employee signature present',                severity:'Critical', expected:'Signed',             rootCause:'Declaration not signed',                    fixAction:'Get employee to sign',                          autoCheck:false },
    { ruleNo:5,  description:'Witness signature present where required',  severity:'Major',    expected:'Witnessed',          rootCause:'Witness not arranged',                      fixAction:'Arrange witness signature',                     autoCheck:false },
    { ruleNo:6,  description:'All mandatory fields completed',            severity:'Major',    expected:'All fields',         rootCause:'Form partially filled',                     fixAction:'Complete all mandatory fields',                 autoCheck:false },
    { ruleNo:7,  description:'Correct version of document used',          severity:'Major',    expected:'Latest version',     rootCause:'Old form used',                             fixAction:'Use latest version',                            autoCheck:false },
    { ruleNo:8,  description:'No duplicate submission for same employee', severity:'Minor',    expected:'Unique',             rootCause:'Double submission',                         fixAction:'Remove duplicate',                              autoCheck:true  },
    { ruleNo:9,  description:'All pages present',                         severity:'Minor',    expected:'Complete',           rootCause:'Partial upload',                            fixAction:'Upload all pages',                              autoCheck:false },
    { ruleNo:10, description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
  'other-doc': [
    { ruleNo:1,  description:'Document not expired',                     severity:'Critical', expected:'Valid',              rootCause:'Expired document uploaded',                 fixAction:'Upload current valid document',                 autoCheck:true  },
    { ruleNo:2,  description:'Company name matches records',              severity:'Major',    expected:'Match records',      rootCause:'Name mismatch',                             fixAction:'Verify and correct name',                       autoCheck:false },
    { ruleNo:3,  description:'Document number/reference present',        severity:'Major',    expected:'Reference present',  rootCause:'Reference missing',                         fixAction:'Add document reference',                        autoCheck:true  },
    { ruleNo:4,  description:'Issue date present',                        severity:'Major',    expected:'Date present',       rootCause:'Date not on document',                      fixAction:'Obtain document with date',                     autoCheck:true  },
    { ruleNo:5,  description:'Expiry date present where applicable',      severity:'Major',    expected:'Expiry present',     rootCause:'Validity not mentioned',                    fixAction:'Obtain document with validity period',          autoCheck:true  },
    { ruleNo:6,  description:'Authorized signature present',              severity:'Major',    expected:'Signed',             rootCause:'Unsigned document',                         fixAction:'Get authorized signature',                      autoCheck:false },
    { ruleNo:7,  description:'Official seal present',                     severity:'Minor',    expected:'Sealed',             rootCause:'Seal missing',                              fixAction:'Obtain sealed copy',                            autoCheck:false },
    { ruleNo:8,  description:'All pages uploaded',                       severity:'Minor',    expected:'Complete',           rootCause:'Partial upload',                            fixAction:'Upload complete document',                      autoCheck:false },
    { ruleNo:9,  description:'No duplicate upload',                      severity:'Minor',    expected:'Unique',             rootCause:'Re-upload',                                 fixAction:'Remove duplicate',                              autoCheck:true  },
    { ruleNo:10, description:'Document legible',                          severity:'Minor',    expected:'Clear',              rootCause:'Poor scan',                                 fixAction:'Rescan',                                        autoCheck:false },
  ],
};

function makeRules(key: string): ValidationRule[] {
  const templates = MASTER_RULES[key] ?? MASTER_RULES['other-doc'];
  return templates.map((t, i) => ({
    ...t,
    id:     `${key}-r${i}`,
    status: 'Pending' as RuleStatus,
    found:  '',
    remark: '',
  }));
}

/* ════════════════════════════════════════════════════════════════════════
   MASTER DOCUMENT LIST — 29 documents
   ════════════════════════════════════════════════════════════════════════ */

const MASTER_DOCS: Omit<DocCard, 'id' | 'file' | 'sheets' | 'validated' | 'validationRules'>[] = [
  { name:'Bank Advisory Slip',            shortName:'Bank Advisory',    act:'Payment of Wages Act',   actGroup:'Wages',     uploadStatus:'Pending', riskLevel:'Critical', dueDate:'7th of month',        score:0, rulesTotal:15, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Wage Slip',                     shortName:'Wage Slip',        act:'Payment of Wages Act',   actGroup:'Wages',     uploadStatus:'Pending', riskLevel:'High',     dueDate:'Monthly',             score:0, rulesTotal:12, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'PF Form 5A',                    shortName:'PF Form 5A',       act:'EPF & MP Act 1952',       actGroup:'PF',        uploadStatus:'Pending', riskLevel:'High',     dueDate:'One-time / Amendment', score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'PF Payment Paid Challan',       shortName:'PF Challan',       act:'EPF & MP Act 1952',       actGroup:'PF',        uploadStatus:'Pending', riskLevel:'Critical', dueDate:'15th of month',        score:0, rulesTotal:15, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'PF Consolidated Statement',     shortName:'PF Consolidated',  act:'EPF & MP Act 1952',       actGroup:'PF',        uploadStatus:'Pending', riskLevel:'Critical', dueDate:'15th of month',        score:0, rulesTotal:12, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'PF ECR',                        shortName:'PF ECR',           act:'EPF & MP Act 1952',       actGroup:'PF',        uploadStatus:'Pending', riskLevel:'Critical', dueDate:'15th of month',        score:0, rulesTotal:14, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'ESIC Registration Certificate', shortName:'ESIC Reg Cert',    act:'ESI Act 1948',            actGroup:'ESIC',      uploadStatus:'Pending', riskLevel:'High',     dueDate:'One-time / Renewal',   score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'ESIC Challan',                  shortName:'ESIC Challan',     act:'ESI Act 1948',            actGroup:'ESIC',      uploadStatus:'Pending', riskLevel:'Critical', dueDate:'15th of month',        score:0, rulesTotal:12, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'ESIC ECR',                      shortName:'ESIC ECR',         act:'ESI Act 1948',            actGroup:'ESIC',      uploadStatus:'Pending', riskLevel:'Critical', dueDate:'15th of month',        score:0, rulesTotal:12, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Employee Compensation Policy',  shortName:'EC Policy',        act:'EC Act 1923',             actGroup:'Insurance', uploadStatus:'Pending', riskLevel:'High',     dueDate:'Annual renewal',       score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Certificate of Insurance',      shortName:'Cert of Insurance',act:'EC Act 1923',             actGroup:'Insurance', uploadStatus:'Pending', riskLevel:'High',     dueDate:'Annual renewal',       score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Registration Certificate',      shortName:'Reg Certificate',  act:'Factories / S&E Act',     actGroup:'Labour',    uploadStatus:'Pending', riskLevel:'High',     dueDate:'Annual renewal',       score:0, rulesTotal:8,  rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'S&E Licence',                   shortName:'S&E Licence',      act:'Shops & Establishments',  actGroup:'Labour',    uploadStatus:'Pending', riskLevel:'High',     dueDate:'Annual renewal',       score:0, rulesTotal:9,  rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'CLRA Licence',                  shortName:'CLRA Licence',     act:'CLRA Act 1970',           actGroup:'Labour',    uploadStatus:'Pending', riskLevel:'Critical', dueDate:'Annual renewal',       score:0, rulesTotal:12, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Act Related Registers',         shortName:'Statutory Registers',act:'Multiple Acts',         actGroup:'Labour',    uploadStatus:'Pending', riskLevel:'High',     dueDate:'Monthly',              score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'GSTIN Certificate',             shortName:'GSTIN',            act:'GST Act 2017',            actGroup:'Tax',       uploadStatus:'Pending', riskLevel:'High',     dueDate:'Annual',               score:0, rulesTotal:11, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Gratuity Form 5',               shortName:'Gratuity Form 5',  act:'Payment of Gratuity Act', actGroup:'Labour',    uploadStatus:'Pending', riskLevel:'Medium',   dueDate:'On joining',           score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Appointment Letter',            shortName:'Appointment Letter',act:'Labour Laws',            actGroup:'HR',        uploadStatus:'Pending', riskLevel:'High',     dueDate:'On joining',           score:0, rulesTotal:13, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Offer Letter',                  shortName:'Offer Letter',     act:'Labour Laws',             actGroup:'HR',        uploadStatus:'Pending', riskLevel:'Medium',   dueDate:'Pre-joining',          score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'PT Paid Challan',               shortName:'PT Challan',       act:'State PT Act',            actGroup:'Tax',       uploadStatus:'Pending', riskLevel:'Medium',   dueDate:'State-specific',       score:0, rulesTotal:9,  rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'LWF Paid Challan',              shortName:'LWF Challan',      act:'Labour Welfare Fund',     actGroup:'Labour',    uploadStatus:'Pending', riskLevel:'Medium',   dueDate:'Half-yearly',          score:0, rulesTotal:9,  rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Declaration Docs 01',           shortName:'Declaration 01',   act:'General',                 actGroup:'General',   uploadStatus:'Pending', riskLevel:'Medium',   dueDate:'On joining',           score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:true  },
  { name:'Declaration Docs 02',           shortName:'Declaration 02',   act:'General',                 actGroup:'General',   uploadStatus:'Pending', riskLevel:'Medium',   dueDate:'On joining',           score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:false },
  { name:'Declaration Docs 03',           shortName:'Declaration 03',   act:'General',                 actGroup:'General',   uploadStatus:'Pending', riskLevel:'Low',      dueDate:'On joining',           score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:false },
  { name:'Declaration Docs 04',           shortName:'Declaration 04',   act:'General',                 actGroup:'General',   uploadStatus:'Pending', riskLevel:'Low',      dueDate:'On joining',           score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:false },
  { name:'Other Docs 01',                 shortName:'Other Docs 01',    act:'General',                 actGroup:'General',   uploadStatus:'Pending', riskLevel:'Low',      dueDate:'As applicable',        score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:false },
  { name:'Other Docs 02',                 shortName:'Other Docs 02',    act:'General',                 actGroup:'General',   uploadStatus:'Pending', riskLevel:'Low',      dueDate:'As applicable',        score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:false },
  { name:'Other Docs 03',                 shortName:'Other Docs 03',    act:'General',                 actGroup:'General',   uploadStatus:'Pending', riskLevel:'Low',      dueDate:'As applicable',        score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:false },
  { name:'Other Docs 04',                 shortName:'Other Docs 04',    act:'General',                 actGroup:'General',   uploadStatus:'Pending', riskLevel:'Low',      dueDate:'As applicable',        score:0, rulesTotal:10, rulesPassed:0, rulesFailed:0, mandatory:false },
];

const RULES_KEY_MAP: Record<string, string> = {
  'Bank Advisory Slip':            'bank-advisory',
  'Wage Slip':                     'wage-slip',
  'PF Form 5A':                    'pf-form5a',
  'PF Payment Paid Challan':       'pf-challan',
  'PF Consolidated Statement':     'pf-consolidated',
  'PF ECR':                        'pf-ecr',
  'ESIC Registration Certificate': 'esic-reg',
  'ESIC Challan':                  'esic-challan',
  'ESIC ECR':                      'esic-ecr',
  'Employee Compensation Policy':  'emp-comp-policy',
  'Certificate of Insurance':      'cert-insurance',
  'Registration Certificate':      'reg-cert',
  'S&E Licence':                   'se-licence',
  'CLRA Licence':                  'clra-licence',
  'Act Related Registers':         'statutory-registers',
  'GSTIN Certificate':             'gstin',
  'Gratuity Form 5':               'gratuity-form5',
  'Appointment Letter':            'appointment-letter',
  'Offer Letter':                  'offer-letter',
  'PT Paid Challan':               'pt-challan',
  'LWF Paid Challan':              'lwf-challan',
};

/* ════════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════════ */

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function riskPill(r: RiskLevel | Severity): string {
  if (r === 'Critical' || r === 'High') return s.pillDanger;
  if (r === 'Medium' || r === 'Major')  return s.pillMedium;
  return s.pillLow;
}

function ruleStatusClass(st: RuleStatus): string {
  if (st === 'Pass')    return s.v2RulePass;
  if (st === 'Fail')    return s.v2RuleFail;
  if (st === 'Warning') return s.v2RuleWarn;
  if (st === 'NA')      return s.v2RuleNa;
  return s.v2RulePendingChip;
}

function ruleStatusIcon(st: RuleStatus): string {
  if (st === 'Pass')    return '✓';
  if (st === 'Fail')    return '✕';
  if (st === 'Warning') return '⚠';
  if (st === 'NA')      return '—';
  return '○';
}

async function parseXlsx(file: File): Promise<SheetPreview[]> {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames.map(name => {
    const ws  = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null });
    return {
      name,
      headers: ((raw[0] ?? []) as any[]).map((c: any) => String(c ?? '')),
      rows:    (raw.slice(1) as (string | number | null)[][]).slice(0, 100),
    };
  });
}

function initDocs(): DocCard[] {
  return MASTER_DOCS.map((d, i) => {
    const key   = RULES_KEY_MAP[d.name] ?? (d.name.startsWith('Declaration') ? 'declaration' : 'other-doc');
    const rules = makeRules(key);
    return { ...d, id: `doc-${i}`, validated: false, validationRules: rules };
  });
}

/* ── Compact circular score indicator ── */
function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r     = size / 2 - 5;
  const circ  = 2 * Math.PI * r;
  const fill  = (score / 100) * circ;
  const color = score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={s.v2ScoreRing}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>
        {score}
      </text>
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════ */

export default function ValidationLevel2({
  docs, liveRegisterFile, companyName = 'Company', onComplete, onBack,
}: Props) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [activeView,   setActiveView]   = useState<ActiveView>('overview');
  const [docCards,     setDocCards]     = useState<DocCard[]>(initDocs);
  const [activDocId,   setActivDocId]   = useState<string | null>(null);
  const [issues,       setIssues]       = useState<ComplianceIssue[]>([]);
  const [showTerms,    setShowTerms]    = useState(false);
  const [aiRunning,    setAiRunning]    = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterAct,    setFilterAct]    = useState<string>('All');
  const [filterSev,    setFilterSev]    = useState<string>('All');
  const [searchQ,      setSearchQ]      = useState('');
  const [issFilt,      setIssFilt]      = useState<string>('All');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  /* ── Derived stats ── */
  const totalDocs     = docCards.length;
  const uploaded      = docCards.filter(d => d.uploadStatus === 'Uploaded').length;
  const validated     = docCards.filter(d => d.validated).length;
  const naCount        = docCards.filter(d => d.uploadStatus === 'Not Applicable').length;
  const pending        = docCards.filter(d => d.uploadStatus === 'Pending').length;
  const openIssues     = issues.filter(i => i.status === 'Open').length;
  const critIssues     = issues.filter(i => i.severity === 'Critical').length;
  const majIssues      = issues.filter(i => i.severity === 'Major').length;
  const minIssues      = issues.filter(i => i.severity === 'Minor').length;
  const resolvedCount  = issues.filter(i => i.status === 'Resolved').length;
  const overallScore   = uploaded === 0 ? 0
    : Math.max(0, Math.min(100, Math.round(((uploaded + naCount) / totalDocs * 100) - (critIssues * 8) - (majIssues * 3) - (minIssues * 1))));

  const actGroups = ['PF', 'ESIC', 'Wages', 'Tax', 'Labour', 'Insurance', 'HR', 'General'] as ActGroup[];
  const actScore = (group: ActGroup): number => {
    const groupDocs = docCards.filter(d => d.actGroup === group);
    if (!groupDocs.length) return 100;
    const done = groupDocs.filter(d => d.uploadStatus === 'Uploaded' || d.uploadStatus === 'Not Applicable').length;
    return Math.round((done / groupDocs.length) * 100);
  };

  const activeDoc = docCards.find(d => d.id === activDocId);

  /* ── File upload + simulated AI validation pass ── */
  const handleFileUpload = useCallback(async (docId: string, files: FileList | null) => {
    if (!files?.length) return;
    const file   = files[0];
    const sheets = /\.xlsx?$/i.test(file.name) ? await parseXlsx(file).catch(() => undefined) : undefined;

    setDocCards(prev => prev.map(d => d.id === docId ? { ...d, uploadStatus: 'Uploaded', file, sheets } : d));
    setAiRunning(docId);
    setActivDocId(docId);
    setActiveView('validate');

    setTimeout(() => {
      setAiRunning(null);
      setDocCards(prev => prev.map(d => {
        if (d.id !== docId) return d;
        const rules = d.validationRules.map(r => ({
          ...r,
          status: r.autoCheck
            ? (Math.random() > 0.3 ? 'Pass' : Math.random() > 0.5 ? 'Fail' : 'Warning') as RuleStatus
            : 'Pending' as RuleStatus,
          found: r.autoCheck ? (Math.random() > 0.3 ? r.expected : 'Mismatch detected') : '',
        }));
        const passed = rules.filter(r => r.status === 'Pass').length;
        const failed = rules.filter(r => r.status === 'Fail').length;
        const score  = Math.round((passed / rules.length) * 100);

        const newIssues: ComplianceIssue[] = rules
          .filter(r => r.status === 'Fail')
          .map(r => ({
            id: newId(), docId, docName: d.name, ruleId: r.id, ruleNo: r.ruleNo,
            severity: r.severity, description: r.description, expected: r.expected,
            found: r.found || 'Mismatch detected', rootCause: r.rootCause, fixAction: r.fixAction,
            status: 'Open' as IssueStatus, remark: '', detectedBy: 'AI' as const,
            createdAt: new Date().toLocaleString('en-IN'),
          }));

        setIssues(prev => [...prev.filter(i => i.docId !== docId), ...newIssues]);
        return { ...d, validationRules: rules, validated: true, rulesPassed: passed, rulesFailed: failed, score };
      }));
    }, 1600);
  }, []);

  /* ── Manual rule status update ── */
  function updateRuleStatus(docId: string, ruleId: string, status: RuleStatus) {
    setDocCards(prev => prev.map(d => {
      if (d.id !== docId) return d;
      const rules  = d.validationRules.map(r => r.id === ruleId ? { ...r, status } : r);
      const passed = rules.filter(r => r.status === 'Pass').length;
      const failed = rules.filter(r => r.status === 'Fail').length;
      const scored = rules.filter(r => r.status !== 'Pending').length;
      const score  = scored === 0 ? 0 : Math.round((passed / scored) * 100);
      return { ...d, validationRules: rules, rulesPassed: passed, rulesFailed: failed, score, validated: scored === rules.length };
    }));
    if (status === 'Pass' || status === 'NA') {
      setIssues(prev => prev.map(i => i.ruleId === ruleId ? { ...i, status: 'Resolved' } : i));
    } else if (status === 'Fail' && activeDoc) {
      const rule = activeDoc.validationRules.find(r => r.id === ruleId);
      if (rule) {
        setIssues(prev => {
          if (prev.some(i => i.ruleId === ruleId)) {
            return prev.map(i => i.ruleId === ruleId ? { ...i, status: 'Open' } : i);
          }
          return [...prev, {
            id: newId(), docId, docName: activeDoc.name, ruleId: rule.id, ruleNo: rule.ruleNo,
            severity: rule.severity, description: rule.description, expected: rule.expected,
            found: 'Marked failed by auditor', rootCause: rule.rootCause, fixAction: rule.fixAction,
            status: 'Open', remark: '', detectedBy: 'Manual', createdAt: new Date().toLocaleString('en-IN'),
          }];
        });
      }
    }
  }

  function setRuleRemark(docId: string, ruleId: string, remark: string) {
    setDocCards(prev => prev.map(d => d.id === docId
      ? { ...d, validationRules: d.validationRules.map(r => r.id === ruleId ? { ...r, remark } : r) }
      : d));
  }

  /* ── Issue actions ── */
  function resolveIssue(id: string)  { setIssues(prev => prev.map(i => i.id === id ? { ...i, status: 'Resolved' } : i)); }
  function revalIssue(id: string)    { setIssues(prev => prev.map(i => i.id === id ? { ...i, status: 'Revalidation' } : i)); }
  function waiveIssue(id: string)    { setIssues(prev => prev.map(i => i.id === id ? { ...i, status: 'Waived' } : i)); }
  function reopenIssue(id: string)   { setIssues(prev => prev.map(i => i.id === id ? { ...i, status: 'Open' } : i)); }
  function updateIssueRemark(id: string, remark: string) {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, remark } : i));
  }

  /* ── Filters ── */
  const filteredDocs = docCards.filter(d => {
    if (filterStatus !== 'All' && d.uploadStatus !== filterStatus) return false;
    if (filterAct !== 'All' && d.actGroup !== filterAct) return false;
    if (searchQ && !d.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });
  const filteredIssues = issues.filter(i => {
    if (issFilt !== 'All' && i.status !== issFilt) return false;
    if (filterSev !== 'All' && i.severity !== filterSev) return false;
    return true;
  });
  const groupedDocs = actGroups.reduce<Record<string, DocCard[]>>((acc, g) => {
    const grp = filteredDocs.filter(d => d.actGroup === g);
    if (grp.length) acc[g] = grp;
    return acc;
  }, {});

  const canComplete = uploaded > 0 && openIssues === 0;

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className={s.page}>
      <div className={s.pageInner}>

        {/* ── Progress header ── */}
        <div className={s.progressHeader}>
          <div className={s.progressHeaderLeft}>
            <span className={s.progressTitle}>Compliance Audit — Level 2 · {companyName}</span>
            <div className={s.progressTrack}>
              {(['L1 Upload', 'L2 Validation', 'L3 Audit'] as const).map((label, i) => (
                <div key={label} className={s.progressStep}>
                  {i > 0 && <div className={i === 1 ? s.progressConnector : `${s.progressConnector} ${s.progressConnectorDone}`} />}
                  <div className={i === 0 ? `${s.progressDot} ${s.progressDotDone}` : i === 1 ? `${s.progressDot} ${s.progressDotActive}` : s.progressDot}>
                    {i === 0 ? '✓' : i + 1}
                  </div>
                  <span className={i === 0 ? `${s.progressStepLabel} ${s.progressStepLabelDone}` : i === 1 ? `${s.progressStepLabel} ${s.progressStepLabelActive}` : s.progressStepLabel}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={s.v2HeaderStats}>
            <div className={s.v2HeaderStat}><span className={s.v2HeaderStatNum}>{uploaded}</span><span className={s.v2HeaderStatLabel}>Uploaded</span></div>
            <div className={s.v2HeaderStat}><span className={s.v2HeaderStatNum}>{validated}</span><span className={s.v2HeaderStatLabel}>Validated</span></div>
            <div className={`${s.v2HeaderStat} ${openIssues > 0 ? s.v2HeaderStatDanger : ''}`}><span className={s.v2HeaderStatNum}>{openIssues}</span><span className={s.v2HeaderStatLabel}>Open Issues</span></div>
            <ScoreRing score={overallScore} size={52} />
          </div>
        </div>

        {/* ── Sub-nav tabs ── */}
        <div className={s.v2NavBar}>
          {([
            { key: 'overview',  label: '📋 Overview',  count: `${uploaded}/${totalDocs}` },
            { key: 'validate',  label: '🔍 Validate',  count: validated > 0 ? String(validated) : undefined },
            { key: 'issues',    label: '⚠ Issues',     count: openIssues > 0 ? String(openIssues) : undefined, danger: true },
            { key: 'dashboard', label: '📊 Dashboard', count: undefined },
          ] as const).map(tab => (
            <button
              key={tab.key}
              className={[s.v2NavTab, activeView === tab.key ? s.v2NavTabActive : ''].join(' ')}
              onClick={() => setActiveView(tab.key)}
            >
              {tab.label}
              {tab.count && (
                <span className={'danger' in tab && tab.danger && openIssues > 0 ? s.v2NavBadgeDanger : s.v2NavBadge}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ VIEW 1 — OVERVIEW ══ */}
        {activeView === 'overview' && (
          <div className={s.v2View}>
            <div className={s.v2FilterBar}>
              <div className={s.fmSearch}>
                <span className={s.fmSearchIcon}>🔍</span>
                <input className={s.fmSearchInput} placeholder="Search documents…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
              <select className={s.v2FilterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Uploaded">Uploaded</option>
                <option value="Not Applicable">N/A</option>
              </select>
              <select className={s.v2FilterSelect} value={filterAct} onChange={e => setFilterAct(e.target.value)}>
                <option value="All">All Acts</option>
                {actGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <span className={s.v2FilterCount}>{filteredDocs.length} of {totalDocs} documents</span>
            </div>

            {Object.entries(groupedDocs).map(([group, gdocs]) => (
              <div key={group} className={s.v2DocGroup}>
                <div className={s.v2DocGroupHeader}>
                  <span className={s.v2DocGroupTitle}>{group}</span>
                  <span className={s.v2DocGroupCount}>{gdocs.filter(d => d.uploadStatus === 'Uploaded').length}/{gdocs.length} uploaded</span>
                </div>
                <div className={s.v2DocTable}>
                  <div className={s.v2DocTableHead}>
                    <span>Document</span><span>Act / Regulation</span><span>Due Date</span>
                    <span>Status</span><span>Risk</span><span>Score</span><span>Rules</span><span>Actions</span>
                  </div>
                  {gdocs.map(doc => {
                    const isRunning = aiRunning === doc.id;
                    return (
                      <div key={doc.id} className={[s.v2DocRow, doc.uploadStatus === 'Uploaded' ? s.v2DocRowUploaded : ''].join(' ')}>
                        <div className={s.v2DocRowName}>
                          <span className={s.v2DocIcon}>{doc.mandatory ? '📌' : '📄'}</span>
                          <div>
                            <div className={s.v2DocName} title={doc.name}>{doc.name}</div>
                            {doc.validated && <div className={s.v2DocValidated}>✓ Validated</div>}
                          </div>
                        </div>
                        <span className={s.v2DocAct}>{doc.act}</span>
                        <span className={s.v2DocDue}>{doc.dueDate}</span>
                        <span>
                          <span className={[s.pill,
                            doc.uploadStatus === 'Uploaded' ? s.pillUploaded :
                            doc.uploadStatus === 'Not Applicable' ? s.pillNotApplicable : s.pillPending].join(' ')}>
                            {isRunning ? '⏳ AI' : doc.uploadStatus === 'Uploaded' ? '✓ Uploaded' : doc.uploadStatus === 'Not Applicable' ? 'N/A' : 'Pending'}
                          </span>
                        </span>
                        <span><span className={`${s.pill} ${riskPill(doc.riskLevel)}`}>{doc.riskLevel}</span></span>
                        <span>{doc.uploadStatus === 'Uploaded' ? <ScoreRing score={doc.score} size={38} /> : <span className={s.v2ScoreDash}>—</span>}</span>
                        <span className={s.v2RulesChip}>
                          {doc.validated
                            ? <span className={s.v2RulesChipText}><span className={s.v2RulePass}>{doc.rulesPassed}✓</span> <span className={s.v2RuleFail}>{doc.rulesFailed}✕</span></span>
                            : <span className={s.v2RulesPending}>{doc.rulesTotal} rules</span>}
                        </span>
                        <div className={s.v2DocRowActions}>
                          {doc.uploadStatus !== 'Not Applicable' && (
                            <>
                              <input
                                ref={el => { fileInputRefs.current[doc.id] = el; }}
                                type="file" accept=".xlsx,.xls,.pdf"
                                className={s.hiddenInput}
                                onChange={e => handleFileUpload(doc.id, e.target.files)}
                              />
                              <button className={s.v2ActionBtn} title={doc.uploadStatus === 'Uploaded' ? 'Replace document' : 'Upload document'}
                                onClick={() => fileInputRefs.current[doc.id]?.click()}>
                                {doc.uploadStatus === 'Uploaded' ? '↻' : '↑'}
                              </button>
                            </>
                          )}
                          {doc.uploadStatus === 'Uploaded' && (
                            <button className={`${s.v2ActionBtn} ${s.v2ActionBtnPrimary}`} title="Open validation workspace"
                              onClick={() => { setActivDocId(doc.id); setActiveView('validate'); }}>
                              🔍
                            </button>
                          )}
                          <button className={s.v2ActionBtn} title={doc.uploadStatus === 'Not Applicable' ? 'Remove N/A' : 'Mark as Not Applicable'}
                            onClick={() => setDocCards(prev => prev.map(d => d.id === doc.id
                              ? { ...d, uploadStatus: d.uploadStatus === 'Not Applicable' ? 'Pending' : 'Not Applicable' } : d))}>
                            {doc.uploadStatus === 'Not Applicable' ? '↩' : 'N/A'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className={s.cardFooter}>
              <button className={s.btnSecondary} onClick={onBack}>← Back</button>
              {canComplete ? (
                <button className={s.btnGreen} onClick={() => setShowTerms(true)}>✅ All Clear — Proceed to Level 3 →</button>
              ) : (
                <div className={s.validationBanner}>
                  <span className={s.validationHint}>
                    {pending > 0 ? `${pending} document${pending !== 1 ? 's' : ''} pending upload` : ''}
                    {pending > 0 && openIssues > 0 ? ' · ' : ''}
                    {openIssues > 0 ? `${openIssues} open issue${openIssues !== 1 ? 's' : ''} must be resolved` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ VIEW 2 — VALIDATE ══ */}
        {activeView === 'validate' && (
          <div className={s.v2View}>
            <div className={s.v2ValidateLayout}>
              <div className={s.v2ValidateSidebar}>
                <div className={s.v2SidebarHeader}>
                  <span className={s.v2SidebarTitle}>Documents</span>
                  <button className={s.v2SidebarBack} onClick={() => setActiveView('overview')}>← Overview</button>
                </div>
                <div className={s.v2SidebarList}>
                  {docCards.map(doc => (
                    <div key={doc.id}
                      className={[s.v2SidebarItem, activDocId === doc.id ? s.v2SidebarItemActive : ''].join(' ')}
                      onClick={() => setActivDocId(doc.id)}>
                      <div className={s.v2SidebarItemLeft}>
                        <span className={s.v2SidebarItemName}>{doc.shortName}</span>
                        <span className={s.v2SidebarItemAct}>{doc.actGroup}</span>
                      </div>
                      <div className={s.v2SidebarItemRight}>
                        {doc.validated
                          ? <ScoreRing score={doc.score} size={32} />
                          : <span className={`${s.pill} ${doc.uploadStatus === 'Uploaded' ? s.pillActive : s.pillPending}`}>
                              {doc.uploadStatus === 'Uploaded' ? 'Ready' : 'Pending'}
                            </span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={s.v2ValidateMain}>
                {!activeDoc ? (
                  <div className={s.v2EmptyValidate}>
                    <div className={s.v2EmptyIcon}>🔍</div>
                    <div className={s.v2EmptyTitle}>Select a document to validate</div>
                    <div className={s.v2EmptyDesc}>Choose any document from the sidebar. Upload it first to run AI validation, then review each rule manually.</div>
                  </div>
                ) : (
                  <>
                    <div className={s.v2ValidateDocHeader}>
                      <div className={s.v2ValidateDocHeaderLeft}>
                        <div className={s.v2ValidateDocName}>{activeDoc.name}</div>
                        <div className={s.v2ValidateDocMeta}>
                          <span>{activeDoc.act}</span><span>·</span><span>Due: {activeDoc.dueDate}</span><span>·</span>
                          <span className={`${s.pill} ${riskPill(activeDoc.riskLevel)}`}>{activeDoc.riskLevel} Risk</span>
                          {activeDoc.validated && <span className={`${s.pill} ${s.pillDone}`}>✓ Validated</span>}
                        </div>
                      </div>
                      <div className={s.v2ValidateDocHeaderRight}>
                        {activeDoc.uploadStatus !== 'Uploaded' ? (
                          <div className={s.v2UploadPrompt}>
                            <span>Upload this document to start validation</span>
                            <button className={s.btnPrimary} onClick={() => fileInputRefs.current[activeDoc.id]?.click()}>↑ Upload</button>
                            <input ref={el => { fileInputRefs.current[activeDoc.id] = el; }} type="file" accept=".xlsx,.xls,.pdf"
                              className={s.hiddenInput} onChange={e => handleFileUpload(activeDoc.id, e.target.files)} />
                          </div>
                        ) : <ScoreRing score={activeDoc.score} size={64} />}
                      </div>
                    </div>

                    {aiRunning === activeDoc.id && (
                      <div className={s.v2AiBanner}>
                        <div className={s.v2AiSpinner} />
                        <span>AI is analysing this document against {activeDoc.rulesTotal} validation rules…</span>
                      </div>
                    )}

                    {activeDoc.uploadStatus === 'Uploaded' && (
                      <div className={s.v2RulesSummary}>
                        <div className={s.v2RulesSumItem}><span className={s.v2RulePass}>{activeDoc.rulesPassed}</span><span>Pass</span></div>
                        <div className={s.v2RulesSumItem}><span className={s.v2RuleFail}>{activeDoc.rulesFailed}</span><span>Fail</span></div>
                        <div className={s.v2RulesSumItem}><span className={s.v2RuleWarn}>{activeDoc.validationRules.filter(r => r.status === 'Warning').length}</span><span>Warning</span></div>
                        <div className={s.v2RulesSumItem}><span className={s.v2RulePendingNum}>{activeDoc.validationRules.filter(r => r.status === 'Pending').length}</span><span>Pending</span></div>
                        <div className={s.v2RulesSumProgress}>
                          <div className={s.v2RulesProgressBar}><div className={s.v2RulesProgressFill} style={{ width: `${activeDoc.score}%` }} /></div>
                          <span>{activeDoc.score}% score</span>
                        </div>
                      </div>
                    )}

                    <div className={s.v2RulesTable}>
                      <div className={s.v2RulesTableHead}>
                        <span>#</span><span>Validation Rule</span><span>Severity</span><span>Expected</span>
                        <span>Found</span><span>Status</span><span>By</span><span>Action</span>
                      </div>
                      {activeDoc.validationRules.map(rule => (
                        <div key={rule.id}>
                          <div
                            className={[s.v2RulesRow,
                              rule.status === 'Fail' ? s.v2RulesRowFail : rule.status === 'Warning' ? s.v2RulesRowWarn : '',
                              expandedRule === rule.id ? s.v2RulesRowExpanded : ''].join(' ')}
                            onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                          >
                            <span className={s.v2RuleNo}>{rule.ruleNo}</span>
                            <span className={s.v2RuleDesc}>{rule.description}</span>
                            <span><span className={`${s.pill} ${riskPill(rule.severity)}`}>{rule.severity}</span></span>
                            <span className={s.v2RuleExpected}>{rule.expected}</span>
                            <span className={s.v2RuleFound}>{rule.found || '—'}</span>
                            <span><span className={`${s.v2RuleStatusChip} ${ruleStatusClass(rule.status)}`}>{ruleStatusIcon(rule.status)} {rule.status}</span></span>
                            <span className={s.v2RuleBy}>{rule.autoCheck ? <span className={s.v2AiBadge}>AI</span> : <span className={s.v2ManualBadge}>Manual</span>}</span>
                            <span className={s.v2RuleActions}>
                              <button className={`${s.v2RuleBtn} ${s.v2RuleBtnPass}`} onClick={e => { e.stopPropagation(); updateRuleStatus(activeDoc.id, rule.id, 'Pass'); }}>✓</button>
                              <button className={`${s.v2RuleBtn} ${s.v2RuleBtnFail}`} onClick={e => { e.stopPropagation(); updateRuleStatus(activeDoc.id, rule.id, 'Fail'); }}>✕</button>
                              <button className={`${s.v2RuleBtn} ${s.v2RuleBtnWarn}`} onClick={e => { e.stopPropagation(); updateRuleStatus(activeDoc.id, rule.id, 'Warning'); }}>⚠</button>
                              <button className={s.v2RuleBtn} onClick={e => { e.stopPropagation(); updateRuleStatus(activeDoc.id, rule.id, 'NA'); }}>N/A</button>
                            </span>
                          </div>
                          {expandedRule === rule.id && (
                            <div className={s.v2RuleDetail}>
                              <div className={s.v2RuleDetailGrid}>
                                <div className={s.v2RuleDetailItem}><span className={s.v2RuleDetailLabel}>Root Cause</span><span className={s.v2RuleDetailValue}>{rule.rootCause}</span></div>
                                <div className={s.v2RuleDetailItem}><span className={s.v2RuleDetailLabel}>Corrective Action</span><span className={s.v2RuleDetailValue}>{rule.fixAction}</span></div>
                                <div className={s.v2RuleDetailItem}>
                                  <span className={s.v2RuleDetailLabel}>Auditor Remark</span>
                                  <input className={s.v2RuleRemarkInput} placeholder="Add remark…" value={rule.remark}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => setRuleRemark(activeDoc.id, rule.id, e.target.value)} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ VIEW 3 — ISSUES TRACKER ══ */}
        {activeView === 'issues' && (
          <div className={s.v2View}>
            <div className={s.v2FilterBar}>
              <select className={s.v2FilterSelect} value={issFilt} onChange={e => setIssFilt(e.target.value)}>
                <option value="All">All Status</option>
                <option value="Open">Open</option>
                <option value="Resolved">Resolved</option>
                <option value="Revalidation">Revalidation</option>
                <option value="Waived">Waived</option>
              </select>
              <select className={s.v2FilterSelect} value={filterSev} onChange={e => setFilterSev(e.target.value)}>
                <option value="All">All Severity</option>
                <option value="Critical">Critical</option>
                <option value="Major">Major</option>
                <option value="Minor">Minor</option>
              </select>
              <span className={s.v2FilterCount}>
                {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''} ·
                <span className={s.v2IssueStatCrit}> {critIssues} Critical</span> ·
                <span className={s.v2IssueStatMaj}> {majIssues} Major</span> ·
                <span className={s.v2IssueStatMin}> {minIssues} Minor</span>
              </span>
            </div>

            {filteredIssues.length === 0 ? (
              <div className={s.v2EmptyValidate}>
                <div className={s.v2EmptyIcon}>✅</div>
                <div className={s.v2EmptyTitle}>No issues found</div>
                <div className={s.v2EmptyDesc}>
                  {issues.length === 0 ? 'Upload and validate documents to detect issues.' : 'All issues have been resolved or filtered out.'}
                </div>
              </div>
            ) : (
              <div className={s.v2IssueTableWrap}>
                <div className={s.v2IssueTableHead}>
                  <span>Sev</span><span>Document</span><span>Rule</span><span>Description</span>
                  <span>Expected</span><span>Found</span><span>Root Cause</span><span>Fix</span>
                  <span>Status</span><span>By</span><span>Remark</span><span>Action</span>
                </div>
                {filteredIssues.map(issue => (
                  <div key={issue.id}
                    className={[s.v2IssueRow,
                      issue.status === 'Resolved' ? s.v2IssueResolved : issue.status === 'Waived' ? s.v2IssueWaived : '',
                      issue.severity === 'Critical' ? s.v2IssueRowCrit : issue.severity === 'Major' ? s.v2IssueRowMaj : ''].join(' ')}>
                    <span><span className={`${s.pill} ${riskPill(issue.severity)}`}>{issue.severity[0]}</span></span>
                    <span className={s.v2IssueDocName}>{issue.docName}</span>
                    <span className={s.v2IssueRuleNo}>R{issue.ruleNo}</span>
                    <span className={s.v2IssueDesc}>{issue.description}</span>
                    <span className={s.v2IssueExpected}>{issue.expected}</span>
                    <span className={s.v2IssueFound}>{issue.found}</span>
                    <span className={s.v2IssueCause}>{issue.rootCause}</span>
                    <span className={s.v2IssueFix}>{issue.fixAction}</span>
                    <span>
                      <span className={[s.pill,
                        issue.status === 'Open' ? s.pillDanger :
                        issue.status === 'Resolved' ? s.pillDone :
                        issue.status === 'Revalidation' ? s.pillMedium : s.pillPending].join(' ')}>{issue.status}</span>
                    </span>
                    <span><span className={issue.detectedBy === 'AI' ? s.v2AiBadge : s.v2ManualBadge}>{issue.detectedBy}</span></span>
                    <span><input className={s.v2IssueRemark} placeholder="Add remark…" value={issue.remark} onChange={e => updateIssueRemark(issue.id, e.target.value)} /></span>
                    <span className={s.v2IssueActions}>
                      {issue.status === 'Open' ? (
                        <>
                          <button className={`${s.v2RuleBtn} ${s.v2RuleBtnPass}`} onClick={() => resolveIssue(issue.id)} title="Mark Resolved">✓</button>
                          <button className={`${s.v2RuleBtn} ${s.v2RuleBtnWarn}`} onClick={() => revalIssue(issue.id)} title="Send for Revalidation">↻</button>
                          <button className={s.v2RuleBtn} onClick={() => waiveIssue(issue.id)} title="Waive">W</button>
                        </>
                      ) : (
                        <button className={s.v2RuleBtn} onClick={() => reopenIssue(issue.id)} title="Reopen">↩</button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ VIEW 4 — DASHBOARD ══ */}
        {activeView === 'dashboard' && (
          <div className={s.v2View}>
            <div className={s.v2DashGrid}>
              <div className={s.v2DashCard}>
                <div className={s.v2DashCardTitle}>Overall Compliance Score</div>
                <div className={s.v2DashScoreRow}>
                  <ScoreRing score={overallScore} size={90} />
                  <div className={s.v2DashScoreMeta}>
                    <div className={s.v2DashBigNum}>{overallScore}%</div>
                    <div className={s.v2DashBigLabel}>{overallScore >= 80 ? '✅ Compliant' : overallScore >= 50 ? '⚠ Partial' : '🔴 Non-Compliant'}</div>
                    <div className={s.v2DashSmall}>{uploaded}/{totalDocs} docs uploaded · {validated} validated</div>
                  </div>
                </div>
              </div>

              <div className={s.v2DashCard}>
                <div className={s.v2DashCardTitle}>Issue Severity Breakdown</div>
                <div className={s.v2DashSevRow}>
                  <div className={s.v2DashSevItem}><div className={`${s.v2DashSevNum} ${s.v2DashCrit}`}>{critIssues}</div><div className={s.v2DashSevLabel}>Critical</div></div>
                  <div className={s.v2DashSevItem}><div className={`${s.v2DashSevNum} ${s.v2DashMaj}`}>{majIssues}</div><div className={s.v2DashSevLabel}>Major</div></div>
                  <div className={s.v2DashSevItem}><div className={`${s.v2DashSevNum} ${s.v2DashMin}`}>{minIssues}</div><div className={s.v2DashSevLabel}>Minor</div></div>
                  <div className={s.v2DashSevItem}><div className={`${s.v2DashSevNum} ${s.v2DashResolved}`}>{resolvedCount}</div><div className={s.v2DashSevLabel}>Resolved</div></div>
                </div>
              </div>

              <div className={`${s.v2DashCard} ${s.v2DashCardWide}`}>
                <div className={s.v2DashCardTitle}>Act-wise Compliance Status</div>
                <div className={s.v2DashActGrid}>
                  {actGroups.map(group => {
                    const score = actScore(group);
                    return (
                      <div key={group} className={s.v2DashActItem}>
                        <div className={s.v2DashActName}>{group}</div>
                        <div className={s.v2DashActBar}>
                          <div className={s.v2DashActFill} style={{ width: `${score}%`, background: score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626' }} />
                        </div>
                        <div className={s.v2DashActScore}>{score}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={s.v2DashCard}>
                <div className={s.v2DashCardTitle}>Statutory Due Dates</div>
                <div className={s.v2DashDueList}>
                  {[
                    { label: 'PF Payment',   due: '15th of month',  status: docCards.find(d => d.name === 'PF Payment Paid Challan')?.uploadStatus },
                    { label: 'ESIC Payment', due: '15th of month',  status: docCards.find(d => d.name === 'ESIC Challan')?.uploadStatus },
                    { label: 'Salary/Bank',  due: '7th of month',   status: docCards.find(d => d.name === 'Bank Advisory Slip')?.uploadStatus },
                    { label: 'PT Challan',   due: 'State-specific', status: docCards.find(d => d.name === 'PT Paid Challan')?.uploadStatus },
                    { label: 'LWF Challan',  due: 'Half-yearly',    status: docCards.find(d => d.name === 'LWF Paid Challan')?.uploadStatus },
                  ].map(item => (
                    <div key={item.label} className={s.v2DashDueRow}>
                      <span className={s.v2DashDueLabel}>{item.label}</span>
                      <span className={s.v2DashDueDate}>{item.due}</span>
                      <span className={`${s.pill} ${item.status === 'Uploaded' ? s.pillDone : s.pillPending}`}>{item.status === 'Uploaded' ? '✓ Filed' : 'Pending'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={s.v2DashCard}>
                <div className={s.v2DashCardTitle}>Document Upload Progress</div>
                <div className={s.v2DashProgressList}>
                  {[
                    { label: 'Uploaded',       count: uploaded,  color: '#059669', pct: Math.round(uploaded  / totalDocs * 100) },
                    { label: 'Pending',        count: pending,   color: '#D97706', pct: Math.round(pending   / totalDocs * 100) },
                    { label: 'Not Applicable', count: naCount,   color: '#9CA3AF', pct: Math.round(naCount   / totalDocs * 100) },
                    { label: 'Validated',      count: validated, color: '#6C3BD5', pct: Math.round(validated / totalDocs * 100) },
                  ].map(item => (
                    <div key={item.label} className={s.v2DashProgRow}>
                      <span className={s.v2DashProgLabel}>{item.label}</span>
                      <div className={s.v2DashProgBar}><div className={s.v2DashProgFill} style={{ width: `${item.pct}%`, background: item.color }} /></div>
                      <span className={s.v2DashProgNum}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={s.cardFooter}>
              <button className={s.btnSecondary} onClick={onBack}>← Back</button>
              {canComplete
                ? <button className={s.btnGreen} onClick={() => setShowTerms(true)}>✅ Proceed to Level 3 →</button>
                : <span className={s.validationHint}>{openIssues > 0 ? `${openIssues} open issue${openIssues !== 1 ? 's' : ''} must be resolved before proceeding` : `${pending} document${pending !== 1 ? 's' : ''} still pending upload`}</span>}
            </div>
          </div>
        )}

      </div>

      {showTerms && (
        <TermsModal level={2} onAgree={() => { setShowTerms(false); onComplete(); }} onClose={() => setShowTerms(false)} />
      )}
    </div>
  );
}