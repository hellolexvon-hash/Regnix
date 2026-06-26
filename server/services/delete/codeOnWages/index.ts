/**
 * codeOnWages/index.ts
 *
 * Act orchestrator for Code on Wages.
 * Coordinates all five form generators and returns named buffers.
 * No template logic. No extraction logic. Orchestration only.
 */

import path from 'path';
import fs   from 'fs';

import { readMasterWorkbook } from '../shared/masterReader.js';
import { ZipFile }            from '../shared/zipBuilder.js';

import { generateFinesRegister }      from './finesRegister.js';
import { generateDeductionsRegister } from './deductionsRegister.js';
import { generateOvertimeRegister }   from './overtimeRegister.js';
import { generateWageRegister }       from './wageRegister.js';
import { generateMusterRoll }         from './musterRoll.js';

// ─── Template paths ───────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates', 'Code_on_Wages');

function tpl(filename: string): string {
  return path.join(TEMPLATES_DIR, filename);
}

function loadTemplate(filename: string): Buffer {
  const full = tpl(filename);
  if (!fs.existsSync(full)) {
    throw new Error(
      `Code on Wages template not found: ${full}\n` +
      `Place templates under public/templates/Code_on_Wages/.`,
    );
  }
  return fs.readFileSync(full);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface CodeOnWagesResult {
  files:    ZipFile[];
  rowCount: number;
}

/**
 * Generate all Code on Wages registers from a master workbook buffer.
 *
 * @param masterBuffer - Raw bytes of the uploaded Regnix Master Register.
 * @returns Array of { name, buffer } entries ready to ZIP.
 */
export async function generateCodeOnWages(
  masterBuffer: Buffer,
): Promise<CodeOnWagesResult> {

  // 1. Read master once
  const masterData = await readMasterWorkbook(masterBuffer);

  if (masterData.employees.length === 0) {
    throw new Error('generateCodeOnWages: No employee rows found in master workbook.');
  }

  // 2. Generate all five forms concurrently
  const [formI, formII, formIII, formIV, formVI] = await Promise.all([
    generateFinesRegister(
      loadTemplate('Form I - Register of Fines.xlsx'),
      masterData,
    ),
    generateDeductionsRegister(
      loadTemplate('Form II - Deductions.xlsx'),
      masterData,
    ),
    generateOvertimeRegister(
      loadTemplate('Form III - Overtime Register.xlsx'),
      masterData,
    ),
    generateWageRegister(
      loadTemplate('Form IV - Wage Register.xlsx'),
      masterData,
    ),
    generateMusterRoll(
      loadTemplate('Form VI - Muster Roll.xlsx'),
      masterData,
    ),
  ]);

  // 3. Return named files
  const files: ZipFile[] = [
    { name: 'Code_on_Wages/Form_I_Register_of_Fines.xlsx',      buffer: formI   },
    { name: 'Code_on_Wages/Form_II_Register_of_Deductions.xlsx', buffer: formII  },
    { name: 'Code_on_Wages/Form_III_Overtime_Register.xlsx',     buffer: formIII },
    { name: 'Code_on_Wages/Form_IV_Wage_Register.xlsx',          buffer: formIV  },
    { name: 'Code_on_Wages/Form_VI_Muster_Roll.xlsx',            buffer: formVI  },
  ];

  return { files, rowCount: masterData.employees.length };
}
