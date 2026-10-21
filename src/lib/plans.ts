/**
 * src/lib/plans.ts
 *
 * Single source of truth for pricing plans. Used by the pricing page, the
 * signup form, the admin console (plan + price next to every applicant, KYC
 * modal prefill) and the upload page.
 *
 * Keep the ids in sync with the CHECK constraint in signup-kyc-flow.sql.
 */

export type PlanId = 'essential' | 'pro' | 'apex' | 'business' | 'enterprise';

export interface Plan {
  id: PlanId;
  name: string;
  minEmployees: number;
  maxEmployees: number;
  monthlyPrice: number; // INR
  tagline: string;
  features: string[];
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'essential', name: 'Essential', minEmployees: 1, maxEmployees: 50, monthlyPrice: 6999,
    tagline: 'For small teams getting compliant',
    features: ['AI-powered compliance engine', 'Statutory calendar & reminders', 'Audit-ready document vault', 'Email support'],
  },
  {
    id: 'pro', name: 'Pro', minEmployees: 51, maxEmployees: 100, monthlyPrice: 11999, popular: true,
    tagline: 'For growing companies',
    features: ['Everything in Essential', 'Legal document analysis & drafting', 'Payroll & statutory filing automation', 'Priority support'],
  },
  {
    id: 'apex', name: 'Apex', minEmployees: 101, maxEmployees: 150, monthlyPrice: 17999,
    tagline: 'For multi-team organizations',
    features: ['Everything in Pro', 'Continuous audit monitoring', 'Vendor & employee lifecycle tracking', 'Team workflows & roles'],
  },
  {
    id: 'business', name: 'Business', minEmployees: 151, maxEmployees: 200, monthlyPrice: 23999,
    tagline: 'For established enterprises',
    features: ['Everything in Apex', 'Advanced analytics & reports', 'Dedicated onboarding', 'Dedicated account manager'],
  },
  {
    id: 'enterprise', name: 'Enterprise', minEmployees: 201, maxEmployees: 250, monthlyPrice: 29999,
    tagline: 'For large workforces',
    features: ['Everything in Business', 'Custom compliance workflows', 'Quarterly compliance reviews', 'Premium SLA'],
  },
];

export function getPlan(id: string | null | undefined): Plan | null {
  if (!id) return null;
  return PLANS.find((p) => p.id === id) ?? null;
}

export function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN');
}

export function headcountLabel(p: Plan): string {
  return `${p.minEmployees}–${p.maxEmployees} employees`;
}
