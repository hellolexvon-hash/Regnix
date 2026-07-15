import type { SupabaseClient } from '@supabase/supabase-js';

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

export function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      return trimmed
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }

  return [];
}

export function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function normalizeReviewStatus(value: unknown): string {
  const s = asString(value).trim().toLowerCase();
  if (['pending', 'in_review', 'approved', 'changes_requested', 'rejected'].includes(s)) {
    return s;
  }
  if (['in review', 'in-review', 'review'].includes(s)) return 'in_review';
  if (['changes requested', 'changes-requested', 'revise'].includes(s)) return 'changes_requested';
  return 'pending';
}

export function normalizeIssueSeverity(value: unknown): string {
  const s = asString(value).trim().toLowerCase();
  if (['critical', 'major', 'minor'].includes(s)) return s;
  if (['high'].includes(s)) return 'critical';
  if (['med', 'medium'].includes(s)) return 'major';
  return 'minor';
}

export function normalizeSpecialization(value: unknown): string {
  const s = asString(value).trim().toLowerCase();

  if (s.includes('pf') || s.includes('esic')) return 'PF & ESIC';
  if (s.includes('labour')) return 'Labour Law';
  if (s.includes('tax') || s.includes('wage')) return 'Tax & Wages';
  if (s.includes('general')) return 'General Compliance';

  return 'General Compliance';
}

type QueryBuilder = {
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  select?: (columns?: string) => QueryBuilder;
};

function applyModifier<TBuilder extends QueryBuilder>(
  builder: TBuilder,
  modifier?: (qb: TBuilder) => TBuilder | void,
): TBuilder {
  if (!modifier) return builder;
  const next = modifier(builder);
  return (next ?? builder) as TBuilder;
}

export async function safeSelect<T>(
  supabase: SupabaseClient,
  table: string,
  columns = '*',
  modifier?: (qb: QueryBuilder) => QueryBuilder | void,
): Promise<T[]> {
  let query = supabase.from(table).select(columns) as unknown as QueryBuilder;

  query = applyModifier(query, modifier);

  const { data, error } = await (query as unknown as Promise<{ data: T[] | null; error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export async function safeInsert<T>(
  supabase: SupabaseClient,
  table: string,
  values: Record<string, unknown> | Record<string, unknown>[],
  columns = '*',
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .insert(values)
    .select(columns);

  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export async function safeUpdate<T>(
  supabase: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
  modifier?: (qb: QueryBuilder) => QueryBuilder | void,
  columns = '*',
): Promise<T[]> {
  let query = supabase.from(table).update(values).select(columns) as unknown as QueryBuilder;
  query = applyModifier(query, modifier);

  const { data, error } = await (query as unknown as Promise<{ data: T[] | null; error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export async function safeUpsert<T>(
supabase: SupabaseClient, table: string, values: Record<string, unknown> | Record<string, unknown>[], columns = '*', p0: { onConflict: string; },
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .upsert(values)
    .select(columns);

  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}