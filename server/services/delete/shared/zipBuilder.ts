/**
 * shared/zipBuilder.ts
 *
 * Accepts generated Excel file buffers and returns a ZIP archive.
 * No Act logic. No template logic.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const JSZip = require('jszip') as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZipFile {
  /** Path inside the ZIP, e.g. "Code_on_Wages/Form_IV.xlsx" */
  name: string;
  buffer: Buffer;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build a ZIP archive from an array of named buffers.
 *
 * @param files - Array of { name, buffer } entries.
 * @returns ZIP as a Node Buffer.
 */
export async function buildZip(files: ZipFile[]): Promise<Buffer> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.buffer);
  }

  return (await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })) as Buffer;
}
