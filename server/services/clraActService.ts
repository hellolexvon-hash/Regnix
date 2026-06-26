/**
 * server/services/clraActService.ts
 *
 * Thin service wrapper for the CLRA Act 1970 document generator.
 * File lives at: server/services/clraActService.ts
 * Delegate lives at: server/services/clraAct/index.ts
 */

import { generateClraAct } from './clra/clraAct/index.ts';

export type { ClraActResult } from './clra/clraAct/index.ts';

export async function runClraActGeneration(masterBuffer: Buffer) {
  return generateClraAct(masterBuffer);
}
