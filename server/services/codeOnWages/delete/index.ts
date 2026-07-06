/**
 * codeOnWages/index.ts
 *
 * Orchestrator for all Code on Wages Act registers.
 * Reads the master workbook once, then generates all statutory forms concurrently.
 *
 * Generated forms:
 *   Form I    — Register of Fines
 *   Form II   — Register of Deductions for Damage or Loss
 *   Form II*  — Muster Roll cum Wage Register
 *   Form III  — Register of Overtime
 *   Form IV   — Wage Register
 *   Form VI   — Muster Roll
 */

import fs   from 'fs';
import path from 'path';

import { readMasterWorkbook }                      from '../shared/masterReader.js';
import { ZipFile }                                 from '../shared/zipBuilder.js';
import { generateFinesRegister }                   from './finesRegister.js';
import { generateDeductionsRegister }              from './deductionsRegister.js';
import { generateMusterRollCumWageRegister }       from './musterRollCumWageRegister.js';
import { generateOvertimeRegister }                from './overtimeRegister.js';
import { generateWageRegister }                    from './wageRegister.js';
import { generateMusterRoll }                      from './musterRoll.js';

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates', 'Code_on_Wages');

function loadTemplateBuffer(filename: string): Buffer {
  const fullPath = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Code on Wages template not found: "${fullPath}"\n` +
      `Place .xlsx templates under: public/templates/Code_on_Wages/`,
    );
  }
  return fs.readFileSync(fullPath);
}

export interface CodeOnWagesResult {
  files:    ZipFile[];
  rowCount: number;
}

export async function generateCodeOnWages(masterBuffer: Buffer): Promise<CodeOnWagesResult> {
  const masterData = await readMasterWorkbook(masterBuffer);

  if (masterData.employees.length === 0) {
    throw new Error('generateCodeOnWages: no employee rows found in the master workbook.');
  }

  const [formI, formII, formIIMuster, formIII, formIV, formVI] = await Promise.all([
    generateFinesRegister(
      loadTemplateBuffer('Form I - Register of Fines.xlsx'), masterData,
    ),
    generateDeductionsRegister(
      loadTemplateBuffer('Form II - Deductions.xlsx'), masterData,
    ),
    generateMusterRollCumWageRegister(
      loadTemplateBuffer('Form II Muster Roll cum Wage Register.xlsx'), masterData,
    ),
    generateOvertimeRegister(
      loadTemplateBuffer('Form III - Overtime Register.xlsx'), masterData,
    ),
    generateWageRegister(
      loadTemplateBuffer('Form IV - Wage Register.xlsx'), masterData,
    ),
    generateMusterRoll(
      loadTemplateBuffer('Form VI - Muster Roll.xlsx'), masterData,
    ),
  ]);

  const files: ZipFile[] = [
    { name: 'Code_on_Wages/Form_I_Register_of_Fines.xlsx',              buffer: formI         },
    { name: 'Code_on_Wages/Form_II_Register_of_Deductions.xlsx',        buffer: formII        },
    { name: 'Code_on_Wages/Form_II_Muster_Roll_cum_Wage_Register.xlsx', buffer: formIIMuster  },
    { name: 'Code_on_Wages/Form_III_Overtime_Register.xlsx',            buffer: formIII       },
    { name: 'Code_on_Wages/Form_IV_Wage_Register.xlsx',                 buffer: formIV        },
    { name: 'Code_on_Wages/Form_VI_Muster_Roll.xlsx',                   buffer: formVI        },
  ];

  return { files, rowCount: masterData.employees.length };
}
