/**
 * apprenticesAct/index.ts
 *
 * Orchestrator for all Apprentices Act 1961 registers.
 * Reads the master workbook once, generates all statutory forms concurrently.
 *
 * Generated registers:
 *   Form AA-1 — Apprentice Register           (Section 18 / Rule 13)
 *   Form AA-2 — Contract Register             (Section 4  / Rule 5)
 *   Form AA-5 — Attendance Register           (Section 6  / Rule 11)
 *   Form AA-6 — Stipend Payment Register      (Sections 13 & 14 / Rule 11)
 *
 * Manual registers (downloaded as-is from templates, not generated):
 *   Training Record  — passed through unchanged
 */

import fs   from 'fs';
import path from 'path';

import { readMasterWorkbook }          from '../shared/masterReader.js';
import { ZipFile }                     from '../shared/zipBuilder.js';
import { generateApprenticeRegister }  from './apprenticeRegister.js';
import { generateAttendanceRegister }  from './attendanceRegister.js';
import { generateContractRegister }    from './contractRegister.js';
import { generateStipendRegister }     from './stipendRegister.js';

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates', 'Apprentices_Act_1961');
const MANUAL_DIR    = path.join(TEMPLATES_DIR, 'Manual_registers');

function loadTemplateBuffer(filename: string, subDir?: string): Buffer {
  const dir      = subDir ? path.join(TEMPLATES_DIR, subDir) : TEMPLATES_DIR;
  const fullPath = path.join(dir, filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Apprentices Act template not found: "${fullPath}"\n` +
      `Place .xlsx templates under: public/templates/Apprentices_Act_1961/`,
    );
  }
  return fs.readFileSync(fullPath);
}

export interface ApprenticesActResult {
  files:    ZipFile[];
  rowCount: number;
}

export async function generateApprenticesAct(masterBuffer: Buffer): Promise<ApprenticesActResult> {
  const masterData = await readMasterWorkbook(masterBuffer);

  if (masterData.employees.length === 0) {
    throw new Error('generateApprenticesAct: no employee rows found in the master workbook.');
  }

  // Generated registers — filled from master data
  const [formAA1, formAA2, formAA5, formAA6] = await Promise.all([
    generateApprenticeRegister(
      loadTemplateBuffer('Apprentice_Register.xlsx'), masterData,
    ),
    generateContractRegister(
      loadTemplateBuffer('Contract_Register.xlsx'), masterData,
    ),
    generateAttendanceRegister(
      loadTemplateBuffer('Attendance_Register.xlsx'), masterData,
    ),
    generateStipendRegister(
      loadTemplateBuffer('Stipend_Register.xlsx'), masterData,
    ),
  ]);

  // Manual registers — passed through as-is (no generation needed)
  const trainingRecordBuffer = loadTemplateBuffer('Training_Record.xlsx', 'Manual_registers');

  const files: ZipFile[] = [
    {
      name:   'Apprentices_Act_1961/Form_AA1_Apprentice_Register.xlsx',
      buffer: formAA1,
    },
    {
      name:   'Apprentices_Act_1961/Form_AA2_Contract_Register.xlsx',
      buffer: formAA2,
    },
    {
      name:   'Apprentices_Act_1961/Form_AA5_Attendance_Register.xlsx',
      buffer: formAA5,
    },
    {
      name:   'Apprentices_Act_1961/Form_AA6_Stipend_Register.xlsx',
      buffer: formAA6,
    },
    {
      name:   'Apprentices_Act_1961/Manual_registers/Training_Record.xlsx',
      buffer: trainingRecordBuffer,
    },
  ];

  return { files, rowCount: masterData.employees.length };
}
