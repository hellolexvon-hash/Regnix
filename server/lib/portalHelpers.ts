import type { SupabaseClient } from '@supabase/supabase-js';

export type AnyRecord = Record<string, any>;

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(text)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(text)) return false;
  }
  return fallback;
}

export function asDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((item) => asString(item)).filter(Boolean);
    } catch {
      // ignore JSON parse failures and fall through to comma splitting
    }
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function asJson(value: unknown): AnyRecord | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as AnyRecord;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as AnyRecord : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeReviewStatus(value: unknown): 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected' {
  const text = asString(value).toLowerCase();
  if (text === 'in_review' || text === 'in review') return 'in_review';
  if (text === 'approved') return 'approved';
  if (text === 'changes_requested' || text === 'changes requested') return 'changes_requested';
  if (text === 'rejected') return 'rejected';
  return 'pending';
}

export function normalizeIssueSeverity(value: unknown): 'critical' | 'major' | 'minor' {
  const text = asString(value).toLowerCase();
  if (text === 'critical') return 'critical';
  if (text === 'minor') return 'minor';
  return 'major';
}

export function normalizeSpecialization(value: unknown): 'PF & ESIC' | 'Labour Law' | 'Tax & Wages' | 'General Compliance' {
  const text = asString(value).toLowerCase();
  if (text.includes('tax')) return 'Tax & Wages';
  if (text.includes('general')) return 'General Compliance';
  if (text.includes('labour')) return 'Labour Law';
  return 'PF & ESIC';
}

export function groupBy<T>(rows: T[], keyFn: (row: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const row of rows) {
    const key = keyFn(row) || 'default';
    if (!out[key]) out[key] = [];
    out[key].push(row);
  }
  return out;
}

export async function safeSelect<T extends AnyRecord>(
  client: SupabaseClient,
  table: string,
  columns = '*',
  build?: (qb: any) => any,
): Promise<T[]> {
  try {
    let qb: any = client.from(table).select(columns);
    if (build) qb = build(qb);
    const { data, error } = await qb;
    if (error) throw error;
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

export async function safeInsert<T extends AnyRecord>(
  client: SupabaseClient,
  table: string,
  payload: AnyRecord | AnyRecord[],
  columns = '*',
): Promise<T[] | null> {
  try {
    const { data, error } = await client.from(table).insert(payload).select(columns);
    if (error) throw error;
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return null;
  }
}

export async function safeUpsert<T extends AnyRecord>(
  client: SupabaseClient,
  table: string,
  payload: AnyRecord | AnyRecord[],
  columns = '*',
  options?: { onConflict?: string },
): Promise<T[] | null> {
  try {
    let qb: any = client.from(table).upsert(payload, options ?? {}).select(columns);
    const { data, error } = await qb;
    if (error) throw error;
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return null;
  }
}

export async function safeUpdate<T extends AnyRecord>(
  client: SupabaseClient,
  table: string,
  values: AnyRecord,
  build: (qb: any) => any,
  columns = '*',
): Promise<T[] | null> {
  try {
    let qb: any = build(client.from(table).update(values).select(columns));
    const { data, error } = await qb;
    if (error) throw error;
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return null;
  }
}
