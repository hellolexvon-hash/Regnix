export type Gender = 'any' | 'M' | 'F';

export interface PayrollParams {
  basicPct: number;          // basic as a fraction of gross, e.g. 0.5
  hraPctOfBasic: number;     // e.g. 0.4
  pfEmployeeRate: number;
  pfEmployerRate: number;
  pfWageCeiling: number;
  esicEmployeeRate: number;
  esicEmployerRate: number;
  esicGrossCeiling: number;
  gratuityRate: number;
}

export interface PtSlab {
  gender: Gender;
  minGross: number;
  maxGross: number | null;   // null = no upper limit
  monthlyAmount: number;
  febAmount: number | null;
}

export interface LwfRule {
  employeeAmount: number;
  employerAmount: number;
  frequency: 'monthly' | 'half-yearly' | 'yearly';
  months: number[];          // calendar months (1-12) in which it is deducted
  minGross: number | null;
}

export interface PayrollRules {
  state: string;
  industry: string;
  params: PayrollParams;
  ptSlabs: PtSlab[];
  lwf: LwfRule | null;
  source: 'database' | 'builtin';
  verified: boolean;
  notes: string[];
}

export interface SalaryInput {
  ctc: number;
  period: 'annual' | 'monthly';
  basicPct: number;
  hraPctOfBasic: number;
  pfOnCeiling: boolean;
  gratuityInCtc: boolean;
  /** Member joined when wages were within the ceiling, so EPS (8.33%) also applies above it. */
  epsMember: boolean;
  /** Count EDLI 0.5% + EPF admin 0.5% inside CTC (otherwise shown as extra employer cost). */
  edliAdminInCtc: boolean;
  gender: Gender;
  month: number;             // 1-12, used for PT (Feb) and LWF
  rules: PayrollRules;
}

export interface SalaryBreakdown {
  gross: number;
  basic: number;
  hra: number;
  special: number;
  pfEmployee: number;
  pfEmployer: number;
  pfWage: number;            // contribution wage = Basic (+DA), capped at the ceiling
  epsEmployer: number;       // 8.33% pension share of the employer 12%
  epfEmployer: number;       // balance of the employer 12% (3.67%, or all 12% when EPS is nil)
  edli: number;              // 0.5%
  pfAdmin: number;           // 0.5%
  esicEmployee: number;
  esicEmployer: number;
  esicApplicable: boolean;
  pt: number;
  lwfEmployee: number;
  lwfEmployer: number;
  gratuity: number;
  totalDeductions: number;
  netPay: number;
  employerCost: number;
  ctcMonthly: number;
  warnings: string[];
}