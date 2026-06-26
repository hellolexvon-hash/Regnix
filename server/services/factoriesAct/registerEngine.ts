/**
 * factoriesAct/registerEngine.ts
 *
 * Re-exports the shared register engine for use by Factories Act generators.
 * Keeps the same pattern as clraAct/registerEngine.ts and apprenticesAct/registerEngine.ts.
 */

export { generateSingleSheetRegister, sumColumn } from '../codeOnWages/registerEngine.js';
export type { RegisterLayout } from '../codeOnWages/registerEngine.js';
