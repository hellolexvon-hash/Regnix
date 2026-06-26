/**
 * apprenticesAct/registerEngine.ts
 *
 * Re-exports the shared register engine for use by Apprentices Act generators.
 * Keeps the same pattern as codeOnWages/registerEngine.ts.
 */

export { generateSingleSheetRegister, sumColumn } from '../codeOnWages/registerEngine.js';
export type { RegisterLayout } from '../codeOnWages/registerEngine.js';
