/**
 * factories/index.ts
 *
 * Act orchestrator for the Factories Act, 1948.
 * Orchestration only — no template logic, no extraction logic.
 */

import path from 'path';
import fs   from 'fs';

import { readMasterWorkbook } from '../shared/masterReader.js';
import { ZipFile }            from '../shared/zipBuilder.js';

import { generateRegisterA } from './registerA.js';
import { generateRegisterB } from './registerB.js';

// ─── Template paths ───────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates', 'Factories_Act_1948');

function loadTemplate(filename: string): Buffer {
  const full = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(full)) {
    throw new Error(`Factories Act template not found: ${full}`);
  }
  return fs.readFileSync(full);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface FactoriesResult {
  files:    ZipFile[];
  rowCount: number;
}

/**
 * Generate all Factories Act registers from a master workbook buffer.
 */
export async function generateFactories(masterBuffer: Buffer): Promise<FactoriesResult> {
  const masterData = await readMasterWorkbook(masterBuffer);

  if (masterData.employees.length === 0) {
    throw new Error('generateFactories: No employee rows found in master workbook.');
  }

  const [registerA, registerB] = await Promise.all([
    generateRegisterA(loadTemplate('Register A - Adult Workers.xlsx'), masterData),
    generateRegisterB(loadTemplate('Register B - Leave with Wages.xlsx'), masterData),
  ]);

  const files: ZipFile[] = [
    { name: 'Factories_Act_1948/Register_A_Adult_Workers.xlsx',    buffer: registerA },
    { name: 'Factories_Act_1948/Register_B_Leave_with_Wages.xlsx', buffer: registerB },
  ];

  return { files, rowCount: masterData.employees.length };
}
