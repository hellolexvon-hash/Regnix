import fsSync            from 'fs';
import { promises as fs } from 'fs';
import path               from 'path';
import { Binary }         from '../types/index.js';

// ─── Buffer helpers ───────────────────────────────────────────────────────────

export function toBuffer(data: Binary): Buffer {
  if (Buffer.isBuffer(data))       return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  const u8 = data as Uint8Array;
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
}

// ─── File-system helpers ──────────────────────────────────────────────────────

/** Recursively collect every *.xlsx file path under `dir`. */
export async function walkXlsx(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: fsSync.Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xlsx')) {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results.sort();
}

// ─── Path resolvers ───────────────────────────────────────────────────────────

/** Resolve the templates root, trying multiple conventional locations. */
export function resolveTemplatesRoot(override?: string): string {
  const cwd = process.cwd();
  const candidates = override
    ? [override]
    : [
        path.join(cwd, 'public', 'templates'),
        path.join(cwd, 'public', 'template'),
        path.join(cwd, 'templates'),
        path.join(cwd, 'template'),
      ];

  for (const p of candidates) {
    if (fsSync.existsSync(p)) return p;
  }
  return candidates[0];
}

/** Normalise a cell value to a plain string (or empty string). */
export function cellStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('en-IN');
  return String(value).trim();
}
