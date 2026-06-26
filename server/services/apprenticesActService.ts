/**
 * apprenticesActService.ts
 *
 * Thin wrappers around the Apprentices Act 1961 generator.
 */

import { generateApprenticesAct } from './apprenticesAct/index.js';
import { buildZip } from './shared/zipBuilder.js';

export async function generateApprenticesActZip(masterBuffer: Buffer): Promise<Buffer> {
  const { files } = await generateApprenticesAct(masterBuffer);
  return buildZip(files);
}

export async function generateApprenticesActFiles(masterBuffer: Buffer) {
  return generateApprenticesAct(masterBuffer);
}
