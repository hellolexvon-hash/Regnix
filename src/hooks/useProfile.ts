/**
 * src/hooks/useProfile.ts
 *
 * Convenience hook — returns the Supabase profile with a reload helper.
 * Use this anywhere you need profile data outside of auth context.
 *
 * Usage:
 *   const { profile, reload } = useProfile();
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';

interface UseProfileResult {
  profile:  Profile | null;
  loading:  boolean;
  error:    string | null;
  reload:   () => void;
}

export function useProfile(): UseProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (err) setError(err.message);
    else     setProfile(data as Profile);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { profile, loading, error, reload: load };
}
