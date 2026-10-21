/**
 * src/hooks/useAuth.tsx
 *
 * Real Supabase auth context.
 * Replaces the previous mock implementation.
 *
 * Exposes:
 *   user         — Supabase User (auth.users row)
 *   profile      — profiles row (company name, industry, etc.)
 *   isAuthenticated
 *   login(email, password)
 *   signup(data)
 *   logout()
 */

import {
  createContext, useContext, useEffect, useState,
  useCallback, type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabaseClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccountType = 'company' | 'client';

export interface SignupFormData {
  accountType:     AccountType;
  name:            string;        // full_name
  email:           string;
  password:        string;
  confirmPassword: string;
  companyName:     string;
  industry:        string;
  gstin:           string;
  selected_plan?:  string;        // pricing plan id chosen on /pricing
}

interface AuthContextValue {
  user:            User | null;
  profile:         Profile | null;
  isAuthenticated: boolean;
  loading:         boolean;
  login:           (email: string, password: string) => Promise<void>;
  signup:          (data: SignupFormData) => Promise<void>;
  logout:          () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile row for a given user id
  const fetchProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (!error && data) setProfile(data as Profile);
  }, []);

  // Bootstrap: restore session on page load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id).finally(() => setLoading(false));
      else   setLoading(false);
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) fetchProfile(u.id);
        else   setProfile(null);
      },
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  // ── Signup ─────────────────────────────────────────────────────────────────
  const signup = useCallback(async (data: SignupFormData) => {
    const { error } = await supabase.auth.signUp({
      email:    data.email,
      password: data.password,
      options: {
        // stored in raw_user_meta_data → the DB trigger copies to profiles
        data: {
          account_type: data.accountType,
          full_name:    data.name,
          company_name: data.companyName || null,
          industry:     data.industry    || null,
          gstin:        data.gstin       || null,
          firm_name:    data.accountType === 'client' ? data.companyName : null,
          selected_plan: data.selected_plan || null,
        },
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isAuthenticated: !!user,
      loading,
      login,
      signup,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
