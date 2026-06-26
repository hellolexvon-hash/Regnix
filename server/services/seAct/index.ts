/**
 * server/services/seAct/index.ts
 *
 * Orchestrator for the Shops & Establishments Act.
 *
 * Manual_Resister files are passed through unchanged.
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';

import { readMasterWorkbook } from '../shared/masterReader.js';
import { generateRegisterEmployment } from './registerEmployment.js';
import { generateRegisterWages } from './registerWages.js';
import { generateRegisterLeave } from './registerLeave.js';
import { generateRegisterAdvances } from './registerAdvances.js';
import { generateRegisterFines } from './registerFines.js';
import { generateRegisterDeductions } from './registerDeductions.js';
import { generateOvertimeRegister } from './overtimeRegister.js';
import { generateMusterRollWages } from './musterRollWages.js';

export interface SeActFile {
  name: string;
  buffer: Buffer;
}

export interface SeActResult {
  files: SeActFile[];
  state: string;
  employeeCount: number;
}

const MANUAL_FOLDER_NAMES = new Set([
  'manual_resister',
  'manual_register',
  'manual_registers',
  'manual resister',
  'manual register',
  'manual registers',
]);

function resolveTemplatesRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), 'public', 'templates'),
    path.resolve(process.cwd(), '.', 'public', 'templates'),
    path.resolve(process.cwd(), 'templates'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

async function resolveStateFolder(
  templatesRoot: string,
  state: string,
): Promise<string | null> {
  const seActRoot = path.join(templatesRoot, 'SE_Act');
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await fs.readdir(seActRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const normalise = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
  const target = normalise(state);

  for (const entry of entries) {
    if (entry.isDirectory() && normalise(entry.name) === target) {
      return path.join(seActRoot, entry.name);
    }
  }
  return null;
}

async function walkXlsx(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await walkXlsx(full));
      } else if (
        entry.isFile() &&
        /\.(xlsx|xls)$/i.test(entry.name) &&
        !entry.name.startsWith('~')
      ) {
        results.push(full);
      }
    }
  } catch {
    // no files
  }
  return results;
}

const TEMPLATE_DISPATCH: Array<[string, string]> = [
  ['form b - employment register', 'employment'],
  ['form xxii', 'employment'],
  ['register of employment', 'employment'],

  ['form xxiii', 'wages'],
  ['register of wages', 'wages'],

  ['form t - leave register', 'leave'],
  ['form xxv', 'leave'],
  ['register of leave', 'leave'],

  ['form-t-combined', 'muster'],
  ['muster roll', 'muster'],

  ['register of advances', 'advances'],
  ['register of fines', 'fines'],
  ['register of deductions', 'deductions'],
  ['overtime register', 'overtime'],
];

function dispatchTemplate(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const [fragment, key] of TEMPLATE_DISPATCH) {
    if (lower.includes(fragment)) return key;
  }
  return null;
}

function isManualRegisterFile(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  return normalized.split('/').some((part) => MANUAL_FOLDER_NAMES.has(part));
}

export async function generateSeAct(
  masterBuffer: Buffer,
  state: string,
): Promise<SeActResult> {
  const { employees } = await readMasterWorkbook(masterBuffer);
  if (employees.length === 0) {
    throw new Error('seAct/index: no employee rows found in master workbook.');
  }

  const templatesRoot = resolveTemplatesRoot();
  const stateFolder = await resolveStateFolder(templatesRoot, state);
  if (!stateFolder) {
    throw new Error(
      `seAct/index: no template folder found for state "${state}". ` +
      `Expected a subfolder under public/templates/SE_Act/`,
    );
  }

  const allFiles = await walkXlsx(stateFolder);
  if (allFiles.length === 0) {
    throw new Error(`seAct/index: no .xlsx/.xls files found in "${stateFolder}".`);
  }

  const files: SeActFile[] = [];
  const skipped: string[] = [];

  await Promise.all(
    allFiles.map(async (tplPath) => {
      const filename = path.basename(tplPath);
      const relName = path.relative(templatesRoot, tplPath).replace(/\\/g, '/');

      try {
        if (isManualRegisterFile(relName)) {
          const raw = await fs.readFile(tplPath);
          files.push({ name: relName, buffer: raw });
          return;
        }

        const key = dispatchTemplate(filename);
        if (!key) {
          console.warn(`[seAct] No generator for "${filename}" — skipping`);
          skipped.push(filename);
          return;
        }

        if (tplPath.endsWith('.xls')) {
          console.warn(`[seAct] Skipping legacy .xls "${filename}" — use .xlsx version`);
          skipped.push(filename);
          return;
        }

        const tplBuf = await fs.readFile(tplPath);
        let outBuf: Buffer;

        switch (key) {
          case 'employment':
            outBuf = await generateRegisterEmployment(tplBuf, employees);
            break;
          case 'wages':
            outBuf = await generateRegisterWages(tplBuf, employees);
            break;
          case 'leave':
            outBuf = await generateRegisterLeave(tplBuf, employees, state);
            break;
          case 'advances':
            outBuf = await generateRegisterAdvances(tplBuf, employees);
            break;
          case 'fines':
            outBuf = await generateRegisterFines(tplBuf, employees);
            break;
          case 'deductions':
            outBuf = await generateRegisterDeductions(tplBuf, employees);
            break;
          case 'overtime':
            outBuf = await generateOvertimeRegister(tplBuf, employees);
            break;
          case 'muster':
            outBuf = await generateMusterRollWages(tplBuf, employees);
            break;
          default:
            skipped.push(filename);
            return;
        }

        files.push({ name: relName, buffer: outBuf });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[seAct] Failed "${filename}": ${msg}`);
        skipped.push(filename);
      }
    }),
  );

  if (files.length === 0) {
    throw new Error(
      `seAct/index: all ${allFiles.length} templates failed. ` +
      `Skipped: ${skipped.join(', ')}`,
    );
  }

  if (skipped.length > 0) {
    console.warn(`[seAct] ${skipped.length} skipped: ${skipped.join(', ')}`);
  }

  files.sort((a, b) => a.name.localeCompare(b.name));
  return { files, state, employeeCount: employees.length };
}