/**
 * zipBuilder.ts
 * Builds a ZIP archive from an array of { name, buffer } entries.
 * Uses JSZip instead of archiver to avoid ESM/CommonJS export issues.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

export interface ZipEntry {
  name: string; // path inside the zip, e.g. "CLRA_Act_1970/Form_I.xlsx"
  buffer: Buffer;
}

export async function buildZip(entries: ZipEntry[]): Promise<Buffer> {
  const zip = new JSZip();

  for (const entry of entries) {
    zip.file(entry.name, entry.buffer);
  }

  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
  });
}