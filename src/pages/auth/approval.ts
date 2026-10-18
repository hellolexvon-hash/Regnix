/**
 * src/pages/auth/approval.ts
 *
 * Shared helper for the "admin must approve a signup before the user can
 * sign in" rule. The authoritative status lives in profiles.approval_status
 * (see signup-approval.sql); a user cannot change it themselves.
 *
 * NOTE: adjust the supabase import below if your client lives elsewhere.
 */

import { supabase } from '../../lib/supabaseClient';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/** Approval status of the currently signed-in user, or null if unknown. */
export async function getApprovalStatus(): Promise<ApprovalStatus | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('approval_status')
    .eq('id', uid)
    .maybeSingle();

  if (error || !data) return null;
  return data.approval_status as ApprovalStatus;
}

export function approvalMessage(status: ApprovalStatus | null): string {
  if (status === 'rejected') {
    return 'Your application was not approved. Please contact support for help.';
  }
  if (status === 'pending') {
    return 'Your application is still in review. You will be able to sign in once an admin approves it.';
  }
  return 'We could not verify your account status. Please try again.';
}

export async function signOutQuietly(): Promise<void> {
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
}