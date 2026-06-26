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
 * Manual registers (passed through as-is from template folder):
 *   All files in CLRA_Act_1970/Manual resister/
 *   India_Labour_Leave_EasyGuide.xlsx (root level)
 *
 * ════════════════════════════════════════════════════════════════════════
 * TEMPLATE FOLDER LAYOUT expected under public/templates/CLRA_Act_1970/:
 *
 *   CLRA Form I Workmen Register.xlsx
 *   CLRA Form XIV-XVI Muster Roll.xlsx
 *   CLRA Form XVII Wages Register.xlsx
 *   Form_XX_Register_of_Deductions_for_Dam.xlsx
 *   Form_XXI_Register_of_Fines.xlsx
 *   Form_XXII_Register_of_Advances.xlsx
 *   Form_XXIII_Register_of_Overtime.xlsx
 *   Bonus Register Bonus Act.xlsx
 *   Gratuity Register Gratuity Act.xlsx
 *   EPF Register Form 5-10-12.xlsx
 *   LWF and PT Register.xlsx
 *   India_Labour_Leave_EasyGuide.xlsx
 *   Manual resister/
 *     Dashboard and Analysis excel.xlsx
 *     FORM III [See rule 18 (3)] Register of Registration.xlsx
 *     FORM V-A [See rule 24 (1-A)] Application for adjustment of Security Deposit.xlsx
 *     FORM_XIV_Employment_Card.xlsx
 *     LWF_PT_EasyGuide.xlsx
 * ════════════════════════════════════════════════════════════════════════
 */

import fs   from 'fs';
import path from 'path';

import { readMasterWorkbook }         from '../../shared/masterReader.ts';
import { ZipFile }                    from '../../shared/zipBuilder.ts';
import { generateWorkmenRegister }    from './workmenRegister.ts';
import { generateMusterRoll }         from './musterRoll.ts';
import { generateWagesRegister }      from './wagesRegister.ts';
import { generateDeductionsRegister } from './deductionsRegister.ts';
import { generateFinesRegister }      from './finesRegister.ts';
import { generateAdvancesRegister }   from './advancesRegister.ts';
import { generateOvertimeRegister }   from './overtimeRegister.ts';
import { generateBonusRegister }      from './bonusRegister.ts';
import { generateGratuityRegister }   from './gratuityRegister.ts';
import { generateEpfRegister }        from './epfRegister.ts';
import { generateLwfPtRegister }      from './lwfPtRegister.ts';

const TEMPLATES_DIR  = path.join(process.cwd(), 'public', 'templates', 'CLRA_Act_1970');
// NOTE: folder on disk is "Manual resister" (typo preserved from original zip)
const MANUAL_SUB_DIR = 'Manual resister';

// ─── Template loader ──────────────────────────────────────────────────────────

/**
 * Load a template buffer from the CLRA templates directory.
 * @param filename  filename inside TEMPLATES_DIR (or subDir)
 * @param subDir    optional subfolder relative to TEMPLATES_DIR
 * @param optional  if true, returns null instead of throwing when file missing
 */
function loadTemplateBuffer(filename: string, subDir?: string, optional = false): Buffer | null {
  const dir      = subDir ? path.join(TEMPLATES_DIR, subDir) : TEMPLATES_DIR;
  const fullPath = path.join(dir, filename);
  if (!fs.existsSync(fullPath)) {
    if (optional) {
      console.warn(`[clraAct] Optional template not found, skipping: "${fullPath}"`);
      return null;
    }
    throw new Error(
      `CLRA Act template not found: "${fullPath}"\n` +
      `Place .xlsx templates under: public/templates/CLRA_Act_1970/`,
    );
  }
  return fs.readFileSync(fullPath);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClraActResult {
  files:    ZipFile[];
  rowCount: number;
}

// ─── Main export ──────────────────────────────────────────────────────────────

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
      loadTemplateBuffer('CLRA Form I Workmen Register.xlsx') as Buffer, masterData,
    ),
    generateMusterRoll(
      loadTemplateBuffer('CLRA Form XIV-XVI Muster Roll.xlsx') as Buffer, masterData,
    ),
    generateWagesRegister(
      loadTemplateBuffer('CLRA Form XVII Wages Register.xlsx') as Buffer, masterData,
    ),
    generateDeductionsRegister(
      loadTemplateBuffer('Form_XX_Register_of_Deductions_for_Dam.xlsx') as Buffer, masterData,
    ),
    generateFinesRegister(
      loadTemplateBuffer('Form_XXI_Register_of_Fines.xlsx') as Buffer, masterData,
    ),
    generateAdvancesRegister(
      loadTemplateBuffer('Form_XXII_Register_of_Advances.xlsx') as Buffer, masterData,
    ),
    generateOvertimeRegister(
      loadTemplateBuffer('Form_XXIII_Register_of_Overtime.xlsx') as Buffer, masterData,
    ),
    generateBonusRegister(
      loadTemplateBuffer('Bonus Register Bonus Act.xlsx') as Buffer, masterData,
    ),
    generateGratuityRegister(
      loadTemplateBuffer('Gratuity Register Gratuity Act.xlsx') as Buffer, masterData,
    ),
    generateEpfRegister(
      loadTemplateBuffer('EPF Register Form 5-10-12.xlsx') as Buffer, masterData,
    ),
    generateLwfPtRegister(
      loadTemplateBuffer('LWF and PT Register.xlsx') as Buffer, masterData,
    ),
  ]);

  // ── Manual registers — passed through as-is ───────────────────────────────
  // Optional: skip gracefully if a manual file doesn't exist on disk
  const manualSpecs: Array<{ src: string; subDir?: string; dest: string }> = [
    {
      src:    'Dashboard and Analysis excel.xlsx',
      subDir: MANUAL_SUB_DIR,
      dest:   'CLRA_Act_1970/Manual_registers/Dashboard_and_Analysis.xlsx',
    },
    {
      src:    'FORM III [See rule 18 (3)] Register of Registration.xlsx',
      subDir: MANUAL_SUB_DIR,
      dest:   'CLRA_Act_1970/Manual_registers/Form_III_Register_of_Registration.xlsx',
    },
    {
      src:    'FORM V-A [See rule 24 (1-A)] Application for adjustment of Security Deposit.xlsx',
      subDir: MANUAL_SUB_DIR,
      dest:   'CLRA_Act_1970/Manual_registers/Form_VA_Security_Deposit_Application.xlsx',
    },
    {
      src:    'FORM_XIV_Employment_Card.xlsx',
      subDir: MANUAL_SUB_DIR,
      dest:   'CLRA_Act_1970/Manual_registers/Form_XIV_Employment_Card.xlsx',
    },
    {
      src:    'LWF_PT_EasyGuide.xlsx',
      subDir: MANUAL_SUB_DIR,
      dest:   'CLRA_Act_1970/Manual_registers/LWF_PT_EasyGuide.xlsx',
    },
    {
      src:    'India_Labour_Leave_EasyGuide.xlsx',
      subDir: MANUAL_SUB_DIR,
      dest:   'CLRA_Act_1970/Manual_registers/India_Labour_Leave_EasyGuide.xlsx',
    },
  ];

  const manualFiles: ZipFile[] = [];
  for (const spec of manualSpecs) {
    const buf = loadTemplateBuffer(spec.src, spec.subDir, true /* optional */);
    if (buf) {
      manualFiles.push({ name: spec.dest, buffer: buf });
    }
  }

  // ── Assemble all files ────────────────────────────────────────────────────
  const files: ZipFile[] = [
    { name: 'CLRA_Act_1970/Form_I_Register_of_Workmen.xlsx',      buffer: formI      },
    { name: 'CLRA_Act_1970/Form_XIV_XVI_Muster_Roll.xlsx',        buffer: formXIV    },
    { name: 'CLRA_Act_1970/Form_XVII_Register_of_Wages.xlsx',     buffer: formXVII   },
    { name: 'CLRA_Act_1970/Form_XX_Register_of_Deductions.xlsx',  buffer: formXX     },
    { name: 'CLRA_Act_1970/Form_XXI_Register_of_Fines.xlsx',      buffer: formXXI    },
    { name: 'CLRA_Act_1970/Form_XXII_Register_of_Advances.xlsx',  buffer: formXXII   },
    { name: 'CLRA_Act_1970/Form_XXIII_Register_of_Overtime.xlsx', buffer: formXXIII  },
    { name: 'CLRA_Act_1970/Bonus_Register.xlsx',                  buffer: bonusReg   },
    { name: 'CLRA_Act_1970/Gratuity_Register.xlsx',               buffer: gratuityReg},
    { name: 'CLRA_Act_1970/EPF_Register_Form_5_10_12.xlsx',       buffer: epfReg     },
    { name: 'CLRA_Act_1970/LWF_and_PT_Register.xlsx',             buffer: lwfPtReg   },
    ...manualFiles,
  ];

  return { files, rowCount: masterData.employees.length };
}
