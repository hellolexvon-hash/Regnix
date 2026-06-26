/**
 * server/services/seActService.ts
 *
 * Thin service wrapper for the Shops & Establishments Act generator.
 * File lives at: server/services/seActService.ts
 * Delegate lives at: server/services/seAct/index.ts
 */

import { generateSeAct } from './seAct/index.js';
import { buildZip }      from '../lib/zipBuilder.js';

export type { SeActResult } from './seAct/index.js';

export async function generateSeActZip(
  masterBuffer: Buffer,
  state: string,
): Promise<Buffer> {
  const { files } = await generateSeAct(masterBuffer, state);
  return buildZip(files);
}

export async function generateSeActFiles(
  masterBuffer: Buffer,
  state: string,
) {
  return generateSeAct(masterBuffer, state);
}
