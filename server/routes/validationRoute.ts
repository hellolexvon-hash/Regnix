import { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

type LevelState = 'pending' | 'active' | 'done' | 'waiting';

type ValidationDocPayload = {
  id?: string;
  name?: string;
  fixed?: boolean;
  sheetCount?: number;
  sheetNames?: string[];
  fileName?: string | null;
  fileType?: string | null;
};

type ValidationStatePayload = {
  scope?: string;
  userId?: string;
  contactEmail?: string;
  companyName?: string;
  currentRoute?: 'landing' | 'level1' | 'level2' | 'level3';
  currentStep?: number;
  levelStates?: LevelState[];
  uploadedDocs?: ValidationDocPayload[];
  signatureUrl?: string;
  submittedAt?: string | Date | null;
  isApproved?: boolean;
  selectedActs?: string[];
  liveRegisterFileName?: string | null;
  validationSessionId?: string | null;
};

function normalizeLevelStates(value: unknown): [LevelState, LevelState, LevelState] {
  const fallback: [LevelState, LevelState, LevelState] = ['pending', 'pending', 'pending'];
  const parsed = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  if (!Array.isArray(parsed) || parsed.length !== 3) return fallback;
  const allowed: LevelState[] = ['pending', 'active', 'done', 'waiting'];
  return [
    allowed.includes(parsed[0] as LevelState) ? (parsed[0] as LevelState) : 'pending',
    allowed.includes(parsed[1] as LevelState) ? (parsed[1] as LevelState) : 'pending',
    allowed.includes(parsed[2] as LevelState) ? (parsed[2] as LevelState) : 'pending',
  ];
}

function asStringArray(value: unknown): string[] {
  const parsed = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return []; } })() : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v): v is string => typeof v === 'string');
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function findSessionByUserId(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('validation_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function findDocs(sessionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('validation_documents')
    .select('*')
    .eq('validation_session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function mapSessionState(row: any, docs: any[]) {
  return {
    validationSessionId: row.id ?? null,
    userId: row.user_id ?? null,
    companyName: row.company_name ?? '',
    contactEmail: row.contact_email ?? null,
    currentRoute: row.current_route ?? 'landing',
    currentStep: row.current_step ?? 1,
    levelStates: normalizeLevelStates(row.level_states),
    uploadedDocs: docs.map((doc) => {
      const preview = doc.sheet_preview && typeof doc.sheet_preview === 'object' ? doc.sheet_preview : {};
      const sheetCount = asNumber((preview as any).sheetCount ?? (preview as any).sheet_count ?? 0, 0);
      const sheetNames = asStringArray((preview as any).sheetNames ?? (preview as any).sheet_names ?? []);
      return {
        id: doc.id,
        name: doc.file_name ?? doc.name ?? 'Document',
        fixed: asBool(doc.verified, false),
        sheetCount,
        sheetNames,
        fileName: doc.file_name ?? null,
        fileType: doc.mime_type ?? null,
      };
    }),
    signatureUrl: row.signature_data_url ?? '',
    submittedAt: row.submitted_at ?? null,
    isApproved: asBool(row.is_approved, false),
    selectedActs: asStringArray(row.selected_acts),
    liveRegisterFileName: row.live_register_file_name ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

router.get('/validation/state', async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId ?? req.query.scope ?? '').trim();
    if (!userId || !isUuid(userId)) {
      return res.json({ ok: true, state: null });
    }

    const session = await findSessionByUserId(userId);
    if (!session) {
      return res.json({ ok: true, state: null });
    }

    const docs = await findDocs(session.id);
    return res.json({ ok: true, state: mapSessionState(session, docs) });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load validation state.',
    });
  }
});

router.post('/validation/state', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as ValidationStatePayload;
    const userId = String(body.userId ?? body.scope ?? '').trim();
    if (!userId || !isUuid(userId)) {
      return res.status(400).json({ ok: false, message: 'userId is required.' });
    }

    const supabase = getSupabaseAdmin();
    const existing = await findSessionByUserId(userId);

    const sessionRow = {
      user_id: userId,
      contact_email: body.contactEmail ?? existing?.contact_email ?? '',
      company_name: body.companyName ?? existing?.company_name ?? '',
      current_route: body.currentRoute ?? existing?.current_route ?? 'landing',
      current_step: asNumber(body.currentStep ?? existing?.current_step ?? 1, 1),
      level_states: normalizeLevelStates(body.levelStates ?? existing?.level_states ?? undefined),
      uploaded_docs: body.uploadedDocs ?? existing?.uploaded_docs ?? [],
      signature_data_url: body.signatureUrl ?? existing?.signature_data_url ?? '',
      submitted_at: toIso(body.submittedAt ?? existing?.submitted_at),
      is_approved: asBool(body.isApproved ?? existing?.is_approved, false),
      selected_acts: body.selectedActs ?? existing?.selected_acts ?? [],
      live_register_file_name: body.liveRegisterFileName ?? existing?.live_register_file_name ?? null,
      updated_at: new Date().toISOString(),
    };

    let savedSessionId = existing?.id ?? null;
    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('validation_sessions')
        .update(sessionRow)
        .eq('id', existing.id);
      if (updateError) throw updateError;
    } else {
      const { data, error: insertError } = await supabase
        .from('validation_sessions')
        .insert(sessionRow)
        .select('*')
        .single();
      if (insertError) throw insertError;
      savedSessionId = data?.id ?? null;
    }

    if (savedSessionId) {
      // Keep the document metadata table in sync. The browser stores the binary
      // blobs in IndexedDB; the database stores the audit trail / metadata.
      await supabase.from('validation_documents').delete().eq('validation_session_id', savedSessionId);

      const docRows = (body.uploadedDocs ?? []).map((doc, index) => ({
        validation_session_id: savedSessionId,
        file_name: doc.fileName ?? doc.name ?? `document-${index + 1}`,
        storage_key: `validation-session/${savedSessionId}/doc/${doc.id ?? index}`,
        mime_type: doc.fileType ?? null,
        file_size: 0,
        sha256_hash: `local-only-${savedSessionId}-${doc.id ?? index}`,
        file_type: doc.fileType ?? null,
        verified: asBool(doc.fixed, false),
        sheet_preview: {
          sheetCount: asNumber(doc.sheetCount, 0),
          sheetNames: Array.isArray(doc.sheetNames) ? doc.sheetNames : [],
        },
      }));

      if (docRows.length > 0) {
        const { error: insertDocsError } = await supabase.from('validation_documents').insert(docRows);
        if (insertDocsError) throw insertDocsError;
      }
    }

    res.json({
      ok: true,
      state: {
        validationSessionId: savedSessionId,
        userId,
        contactEmail: sessionRow.contact_email,
        companyName: sessionRow.company_name,
        currentRoute: sessionRow.current_route,
        currentStep: sessionRow.current_step,
        levelStates: sessionRow.level_states,
        uploadedDocs: body.uploadedDocs ?? [],
        signatureUrl: sessionRow.signature_data_url,
        submittedAt: sessionRow.submitted_at,
        isApproved: sessionRow.is_approved,
        selectedActs: sessionRow.selected_acts,
        liveRegisterFileName: sessionRow.live_register_file_name,
        updatedAt: sessionRow.updated_at,
      },
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to save validation state.',
    });
  }
});

export default router;