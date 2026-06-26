/**
 * codeOnWagesService.ts
 *
 * Thin wrappers around the Code on Wages generator.
 */

import { generateCodeOnWages } from './codeOnWages/index.js';
import { buildZip } from './shared/zipBuilder.js';

export async function generateCodeOnWagesZip(masterBuffer: Buffer): Promise<Buffer> {
  const { files } = await generateCodeOnWages(masterBuffer);
  return buildZip(files);
}

export async function generateCodeOnWagesFiles(masterBuffer: Buffer) {
  return generateCodeOnWages(masterBuffer);
}
