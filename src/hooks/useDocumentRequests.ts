/**
 * src/hooks/useDocumentRequests.ts
 *
 * CRUD for document_requests table.
 * Automatically scoped to the current user via RLS.
 *
 * Usage:
 *   const { requests, loading, create } = useDocumentRequests();
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, type DocumentRequest } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';

interface CreatePayload {
  company_name:       string;
  contact_email:      string;
  act_type:           string;
  state?:             string;
  head_count:         number;
  establishment_name?: string;
  address?:           string;
}

interface UseDocumentRequestsResult {
  requests: DocumentRequest[];
  loading:  boolean;
  error:    string | null;
  create:   (payload: CreatePayload) => Promise<DocumentRequest>;
  reload:   () => void;
}

export function useDocumentRequests(): UseDocumentRequestsResult {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setRequests([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('document_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else     setRequests((data ?? []) as DocumentRequest[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (payload: CreatePayload): Promise<DocumentRequest> => {
    if (!user) throw new Error('Not authenticated');
    const { data, error: err } = await supabase
      .from('document_requests')
      .insert({ ...payload, user_id: user.id, status: 'pending' })
      .select()
      .single();
    if (err) throw new Error(err.message);
    const row = data as DocumentRequest;
    setRequests(prev => [row, ...prev]);
    return row;
  }, [user]);

  return { requests, loading, error, create, reload: load };
}
