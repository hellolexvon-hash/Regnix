/**
 * clraAct/index.ts
 *
 * Orchestrator for all Contract Labour (R&A) Act 1970 registers.
 * Reads the master workbook once, generates all statutory forms concurrently.
 *
 * Generated registers (filled from master data):
 *   Form I      — Register of Workmen
 *   Form XIV/XVI— Muster Roll
 *   Form XVII   — Register of Wages
 *   Form XX     — Register of Deductions for Damage/Loss
 *   Form XXI    — Register of Fines
 *   Form XXII   — Register of Advances
 *   Form XXIII  — Register of Overtime
 *   Bonus Register   — Payment of Bonus Act
 *   Gratuity Register— Payment of Gratuity Act
 *   EPF Register     — Form 5 / 10 / 3A
 *   LWF & PT Register
 *
 * Manual registers (downloaded as-is, not generated):
 *   Dashboard and Analysis excel
 *   FORM III Registration Register
 *   FORM V-A Security Deposit Application
 *   FORM XIV Employment Card
 *   LWF_PT_EasyGuide
 *   India_Labour_Leave_EasyGuide
 */

import fs   from 'fs';
import path from 'path';

import { readMasterWorkbook }          from '../shared/masterReader.js';
import { ZipFile }                     from '../shared/zipBuilder.js';
import { generateWorkmenRegister }     from './workmenRegister.js';
import { generateMusterRoll }          from './musterRoll.js';
import { generateWagesRegister }       from './wagesRegister.js';
import { generateDeductionsRegister }  from './deductionsRegister.js';
import { generateFinesRegister }       from './finesRegister.js';
import { generateAdvancesRegister }    from './advancesRegister.js';
import { generateOvertimeRegister }    from './overtimeRegister.js';
import { generateBonusRegister }       from './bonusRegister.js';
import { generateGratuityRegister }    from './gratuityRegister.js';
import { generateEpfRegister }         from './epfRegister.js';
import { generateLwfPtRegister }       from './lwfPtRegister.js';

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates', 'CLRA_Act_1970');
const MANUAL_DIR    = path.join(TEMPLATES_DIR, 'Manual_registers');

function loadTemplateBuffer(filename: string, subDir?: string): Buffer {
  const dir      = subDir ? path.join(TEMPLATES_DIR, subDir) : TEMPLATES_DIR;
  const fullPath = path.join(dir, filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `CLRA Act template not found: "${fullPath}"\n` +
      `Place .xlsx templates under: public/templates/CLRA_Act_1970/`,
    );
  }
  return fs.readFileSync(fullPath);
}

export interface ClraActResult {
  files:    ZipFile[];
  rowCount: number;
}

export async function generateClraAct(masterBuffer: Buffer): Promise<ClraActResult> {
  const masterData = await readMasterWorkbook(masterBuffer);

  if (masterData.employees.length === 0) {
    throw new Error('generateClraAct: no employee rows found in the master workbook.');
  }

  // ── Generated registers ───────────────────────────────────────────────────
  const [
    formI,
    formXIV,
    formXVII,
    formXX,
    formXXI,
    formXXII,
    formXXIII,
    bonusReg,
    gratuityReg,
    epfReg,
    lwfPtReg,
  ] = await Promise.all([
    generateWorkmenRegister(
      loadTemplateBuffer('CLRA Form I Workmen Register.xlsx'), masterData,
    ),
    generateMusterRoll(
      loadTemplateBuffer('CLRA Form XIV-XVI Muster Roll.xlsx'), masterData,
    ),
    generateWagesRegister(
      loadTemplateBuffer('CLRA Form XVII Wages Register.xlsx'), masterData,
    ),
    generateDeductionsRegister(
      loadTemplateBuffer('Form_XX_Register_of_Deductions_for_Dam.xlsx'), masterData,
    ),
    generateFinesRegister(
      loadTemplateBuffer('Form_XXI_Register_of_Fines.xlsx'), masterData,
    ),
    generateAdvancesRegister(
      loadTemplateBuffer('Form_XXII_Register_of_Advances.xlsx'), masterData,
    ),
    generateOvertimeRegister(
      loadTemplateBuffer('Form_XXIII_Register_of_Overtime.xlsx'), masterData,
    ),
    generateBonusRegister(
      loadTemplateBuffer('Bonus Register Bonus Act.xlsx'), masterData,
    ),
    generateGratuityRegister(
      loadTemplateBuffer('Gratuity Register Gratuity Act.xlsx'), masterData,
    ),
    generateEpfRegister(
      loadTemplateBuffer('EPF Register Form 5-10-12.xlsx'), masterData,
    ),
    generateLwfPtRegister(
      loadTemplateBuffer('LWF and PT Register.xlsx'), masterData,
    ),
  ]);

  // ── Manual registers — passed through as-is ───────────────────────────────
  const manualBuffers = {
    dashboard:      loadTemplateBuffer('Dashboard and Analysis excel.xlsx', 'Manual resister'),
    formIII:        loadTemplateBuffer('FORM III [See rule 18 (3)] Register of Registration.xlsx', 'Manual resister'),
    formVA:         loadTemplateBuffer('FORM V-A [See rule 24 (1-A)] Application for adjustment of Security Deposit.xlsx', 'Manual resister'),
    formXIVCard:    loadTemplateBuffer('FORM_XIV_Employment_Card.xlsx', 'Manual resister'),
    lwfPtGuide:     loadTemplateBuffer('LWF_PT_EasyGuide.xlsx', 'Manual resister'),
    labourLeave:    loadTemplateBuffer('India_Labour_Leave_EasyGuide.xlsx'),
  };

  const files: ZipFile[] = [
    // Generated
    {
      name:   'CLRA_Act_1970/Form_I_Register_of_Workmen.xlsx',
      buffer: formI,
    },
    {
      name:   'CLRA_Act_1970/Form_XIV_XVI_Muster_Roll.xlsx',
      buffer: formXIV,
    },
    {
      name:   'CLRA_Act_1970/Form_XVII_Register_of_Wages.xlsx',
      buffer: formXVII,
    },
    {
      name:   'CLRA_Act_1970/Form_XX_Register_of_Deductions.xlsx',
      buffer: formXX,
    },
    {
      name:   'CLRA_Act_1970/Form_XXI_Register_of_Fines.xlsx',
      buffer: formXXI,
    },
    {
      name:   'CLRA_Act_1970/Form_XXII_Register_of_Advances.xlsx',
      buffer: formXXII,
    },
    {
      name:   'CLRA_Act_1970/Form_XXIII_Register_of_Overtime.xlsx',
      buffer: formXXIII,
    },
    {
      name:   'CLRA_Act_1970/Bonus_Register.xlsx',
      buffer: bonusReg,
    },
    {
      name:   'CLRA_Act_1970/Gratuity_Register.xlsx',
      buffer: gratuityReg,
    },
    {
      name:   'CLRA_Act_1970/EPF_Register_Form_5_10_12.xlsx',
      buffer: epfReg,
    },
    {
      name:   'CLRA_Act_1970/LWF_and_PT_Register.xlsx',
      buffer: lwfPtReg,
    },
    // Manual registers
    {
      name:   'CLRA_Act_1970/Manual_registers/Dashboard_and_Analysis.xlsx',
      buffer: manualBuffers.dashboard,
    },
    {
      name:   'CLRA_Act_1970/Manual_registers/Form_III_Register_of_Registration.xlsx',
      buffer: manualBuffers.formIII,
    },
    {
      name:   'CLRA_Act_1970/Manual_registers/Form_VA_Security_Deposit_Application.xlsx',
      buffer: manualBuffers.formVA,
    },
    {
      name:   'CLRA_Act_1970/Manual_registers/Form_XIV_Employment_Card.xlsx',
      buffer: manualBuffers.formXIVCard,
    },
    {
      name:   'CLRA_Act_1970/Manual_registers/LWF_PT_EasyGuide.xlsx',
      buffer: manualBuffers.lwfPtGuide,
    },
    {
      name:   'CLRA_Act_1970/Manual_registers/India_Labour_Leave_EasyGuide.xlsx',
      buffer: manualBuffers.labourLeave,
    },
  ];

  return { files, rowCount: masterData.employees.length };
}
