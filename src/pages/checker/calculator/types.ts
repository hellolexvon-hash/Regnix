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
