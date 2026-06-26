/**
 * codeOnWages/index.ts
 *
 * Act orchestrator only.
 * Reads the master workbook once, calls all five Code on Wages generators,
 * and returns named file buffers ready for ZIP creation.
 */

import fs from 'fs';
import path from 'path';

import { readMasterWorkbook } from '../shared/masterReader.js';
import { ZipFile } from '../shared/zipBuilder.js';

import { generateFinesRegister } from './finesRegister.js';
import { generateDeductionsRegister } from './deductionsRegister.js';
import { generateOvertimeRegister } from './overtimeRegister.js';
import { generateWageRegister } from './wageRegister.js';
import { generateMusterRoll } from './musterRoll.js';

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates', 'Code_on_Wages');

function loadTemplate(filename: string): Buffer {
  const full = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(full)) {
    throw new Error(
      `Code on Wages template not found: ${full}\n` +
      `Place templates under public/templates/Code_on_Wages/.`,
    );
  }
  return fs.readFileSync(full);
}

export interface CodeOnWagesResult {
  files: ZipFile[];
  rowCount: number;
}

export async function generateCodeOnWages(masterBuffer: Buffer): Promise<CodeOnWagesResult> {
  const masterData = await readMasterWorkbook(masterBuffer);

  if (masterData.employees.length === 0) {
    throw new Error('generateCodeOnWages: no employee rows found in the master workbook.');
  }

  const [formI, formII, formIII, formIV, formVI] = await Promise.all([
    generateFinesRegister(loadTemplate('Form I - Register of Fines.xlsx'), masterData),
    generateDeductionsRegister(loadTemplate('Form II - Deductions.xlsx'), masterData),
    generateOvertimeRegister(loadTemplate('Form III - Overtime Register.xlsx'), masterData),
    generateWageRegister(loadTemplate('Form IV - Wage Register.xlsx'), masterData),
    generateMusterRoll(loadTemplate('Form VI - Muster Roll.xlsx'), masterData),
  ]);

  const files: ZipFile[] = [
    { name: 'Code_on_Wages/Form_I_Register_of_Fines.xlsx', buffer: formI },
    { name: 'Code_on_Wages/Form_II_Register_of_Deductions.xlsx', buffer: formII },
    { name: 'Code_on_Wages/Form_III_Overtime_Register.xlsx', buffer: formIII },
    { name: 'Code_on_Wages/Form_IV_Wage_Register.xlsx', buffer: formIV },
    { name: 'Code_on_Wages/Form_VI_Muster_Roll.xlsx', buffer: formVI },
  ];

  return { files, rowCount: masterData.employees.length };
}
