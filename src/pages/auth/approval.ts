/**
 * src/pages/auth/approval.ts
 *
 * Shared helper for the access rules:
 *   1. an admin must approve the signup   (profiles.approval_status)
 *   2. the admin must verify the KYC      (profiles.kyc_verified)
 * A user can sign in only after BOTH. Neither column can be changed by the
 * user (see signup-approval.sql and signup-kyc-flow.sql).
 */

import { supabase } from '../../lib/supabaseClient';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface AccessState {
  approval: ApprovalStatus | null;
  kycVerified: boolean;
  plan: string | null;
}

export type Gate = 'ok' | 'pending' | 'kyc' | 'rejected' | 'unknown';

export async function getAccessState(): Promise<AccessState | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('approval_status, kyc_verified, selected_plan')
    .eq('id', uid)
    .maybeSingle();

  if (error || !data) return null;
  return {
    approval: data.approval_status as ApprovalStatus,
    kycVerified: data.kyc_verified === true,
    plan: (data.selected_plan as string | null) ?? null,
  };
}

export function gateFor(state: AccessState | null): Gate {
  if (!state) return 'unknown';
  if (state.approval === 'rejected') return 'rejected';
  if (state.approval === 'pending') return 'pending';
  if (state.approval === 'approved') return state.kycVerified ? 'ok' : 'kyc';
  return 'unknown';
}

/** Approval status of the currently signed-in user, or null if unknown. */
export async function getApprovalStatus(): Promise<ApprovalStatus | null> {
  return (await getAccessState())?.approval ?? null;
}

export function gateMessage(gate: Gate): string {
  if (gate === 'rejected') {
    return 'Your application was not approved. Please contact support for help.';
  }
  return 'We could not verify your account status. Please try again.';
}

export async function signOutQuietly(): Promise<void> {
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
}
