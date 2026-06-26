/**
 * server/services/factoriesActService.ts
 *
 * Thin service wrapper for the Factories Act 1948 document generator.
 * File lives at: server/services/factoriesActService.ts
 * Delegate lives at: server/services/factoriesAct/index.ts
 */

import { generateFactoriesAct } from './factoriesAct/index.js';

export type { FactoriesActResult } from './factoriesAct/index.js';

export async function runFactoriesActGeneration(masterBuffer: Buffer) {
  return generateFactoriesAct(masterBuffer);
}
