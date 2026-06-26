/**
 * factoriesAct/index.ts
 *
 * Orchestrator for all Factories Act 1948 registers.
 * Reads the master workbook once, generates all statutory forms concurrently.
 *
 * Generated registers (filled from master data):
 *   01_Adult_Worker_Register       — Rule 62(1) / Section 62               (tabular, 16 cols, rows 9–28)
 *   02_Leave_With_Wages_Register   — Rule 78-A / Section 79 / Form 15      (tabular, 16 cols, rows 9–28)
 *   03_Overtime_Register           — Rule 63 / Section 59 / Form 22        (tabular, 16 cols, rows 9–28)
 *   Form_11_Adult_Worker           — [See Rule 62(1)] statutory variant     (tabular, 14 cols, rows 9–28)
 *   Form_22_Overtime               — [See Rule 63] statutory variant        (tabular, 14 cols, rows 9–28)
 *   Form_24_Accident_Notice        — [See Rule 121] vertical notice         (rows 5–31)
 *   Form_25_Dangerous_Occurrence   — [See Rule 121-A] vertical notice       (rows 5–33)
 *
 * Manual registers (passed through as-is from template folder):
 *   All files in Factories_Act_1948/Manual_Resister/
 *
 * ════════════════════════════════════════════════════════════════════════
 * TEMPLATE FOLDER LAYOUT expected under public/templates/Factories_Act_1948/:
 *
 *   01_Adult_Worker_Register.xlsx
 *   02_Leave_With_Wages_Register.xlsx
 *   03_Overtime_Register.xlsx
 *   Form_11_Adult_Worker.xlsx
 *   Form_22_Overtime.xlsx
 *   Form_24_Accident_Notice.xlsx
 *   Form_25_Dangerous_Occurrence.xlsx
 *   Manual_Resister/
 *     05_Health_Register.xlsx
 *     06_Inspection_Book.xlsx
 *     07_Humidity_Register.xlsx
 *     09_PPE_Issue_Register.xlsx
 *     10_Canteen_Register.xlsx
 *     Form_15_Leave_Wages.xlsx
 * ════════════════════════════════════════════════════════════════════════
 */

import fs   from 'fs';
import path from 'path';

import { readMasterWorkbook }                from '../shared/masterReader.js';
import { ZipFile }                           from '../shared/zipBuilder.js';
import { generateAdultWorkerRegister }       from './adultWorkerRegister.js';
import { generateLeaveWithWagesRegister }    from './leaveWithWagesRegister.js';
import { generateOvertimeRegister }          from './overtimeRegister.js';
import { generateForm11AdultWorker }         from './form11AdultWorker.js';
import { generateForm22Overtime }            from './form22Overtime.js';
import { generateForm24AccidentNotice }      from './form24AccidentNotice.js';
import { generateForm25DangerousOccurrence } from './form25DangerousOccurrence.js';

const TEMPLATES_DIR  = path.join(process.cwd(), 'public', 'templates', 'Factories_Act_1948');
// NOTE: folder on disk is "Manual_Resister" (typo preserved from original zip)
const MANUAL_SUB_DIR = 'Manual_Resister';

// ─── Template loader ──────────────────────────────────────────────────────────

function loadTemplateBuffer(filename: string, subDir?: string, optional = false): Buffer | null {
  const dir      = subDir ? path.join(TEMPLATES_DIR, subDir) : TEMPLATES_DIR;
  const fullPath = path.join(dir, filename);
  if (!fs.existsSync(fullPath)) {
    if (optional) {
      console.warn(`[factoriesAct] Optional template not found, skipping: "${fullPath}"`);
      return null;
    }
    throw new Error(
      `Factories Act template not found: "${fullPath}"\n` +
      `Place .xlsx templates under: public/templates/Factories_Act_1948/`,
    );
  }
  return fs.readFileSync(fullPath);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FactoriesActResult {
  files:    ZipFile[];
  rowCount: number;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateFactoriesAct(masterBuffer: Buffer): Promise<FactoriesActResult> {
  const masterData = await readMasterWorkbook(masterBuffer);

  if (masterData.employees.length === 0) {
    throw new Error('generateFactoriesAct: no employee rows found in the master workbook.');
  }

  // ── Generated registers (all in parallel) ─────────────────────────────────
  const [
    adultWorkerReg,
    leaveWithWagesReg,
    overtimeReg,
    form11,
    form22,
    form24,
    form25,
  ] = await Promise.all([
    generateAdultWorkerRegister(
      loadTemplateBuffer('01_Adult_Worker_Register.xlsx') as Buffer, masterData,
    ),
    generateLeaveWithWagesRegister(
      loadTemplateBuffer('02_Leave_With_Wages_Register.xlsx') as Buffer, masterData,
    ),
    generateOvertimeRegister(
      loadTemplateBuffer('03_Overtime_Register.xlsx') as Buffer, masterData,
    ),
    generateForm11AdultWorker(
      loadTemplateBuffer('Form_11_Adult_Worker.xlsx') as Buffer, masterData,
    ),
    generateForm22Overtime(
      loadTemplateBuffer('Form_22_Overtime.xlsx') as Buffer, masterData,
    ),
    generateForm24AccidentNotice(
      loadTemplateBuffer('Form_24_Accident_Notice.xlsx') as Buffer, masterData,
    ),
    generateForm25DangerousOccurrence(
      loadTemplateBuffer('Form_25_Dangerous_Occurrence.xlsx') as Buffer, masterData,
    ),
  ]);

  // ── Manual registers — passed through as-is ───────────────────────────────
  const manualSpecs: Array<{ src: string; dest: string }> = [
    {
      src:  '05_Health_Register.xlsx',
      dest: 'Factories_Act_1948/Manual_Resister/05_Health_Register.xlsx',
    },
    {
      src:  '06_Inspection_Book.xlsx',
      dest: 'Factories_Act_1948/Manual_Resister/06_Inspection_Book.xlsx',
    },
    {
      src:  '07_Humidity_Register.xlsx',
      dest: 'Factories_Act_1948/Manual_Resister/07_Humidity_Register.xlsx',
    },
    {
      src:  '09_PPE_Issue_Register.xlsx',
      dest: 'Factories_Act_1948/Manual_Resister/09_PPE_Issue_Register.xlsx',
    },
    {
      src:  '10_Canteen_Register.xlsx',
      dest: 'Factories_Act_1948/Manual_Resister/10_Canteen_Register.xlsx',
    },
    {
      src:  'Form_15_Leave_Wages.xlsx',
      dest: 'Factories_Act_1948/Manual_Resister/Form_15_Leave_Wages.xlsx',
    },
  ];

  const manualFiles: ZipFile[] = [];
  for (const spec of manualSpecs) {
    const buf = loadTemplateBuffer(spec.src, MANUAL_SUB_DIR, true /* optional */);
    if (buf) {
      manualFiles.push({ name: spec.dest, buffer: buf });
    }
  }

  // ── Assemble all files ────────────────────────────────────────────────────
  const files: ZipFile[] = [
    {
      name:   'Factories_Act_1948/01_Adult_Worker_Register.xlsx',
      buffer: adultWorkerReg,
    },
    {
      name:   'Factories_Act_1948/02_Leave_With_Wages_Register.xlsx',
      buffer: leaveWithWagesReg,
    },
    {
      name:   'Factories_Act_1948/03_Overtime_Register.xlsx',
      buffer: overtimeReg,
    },
    {
      name:   'Factories_Act_1948/Form_11_Adult_Worker.xlsx',
      buffer: form11,
    },
    {
      name:   'Factories_Act_1948/Form_22_Overtime.xlsx',
      buffer: form22,
    },
    {
      name:   'Factories_Act_1948/Form_24_Accident_Notice.xlsx',
      buffer: form24,
    },
    {
      name:   'Factories_Act_1948/Form_25_Dangerous_Occurrence.xlsx',
      buffer: form25,
    },
    ...manualFiles,
  ];

  return { files, rowCount: masterData.employees.length };
}
