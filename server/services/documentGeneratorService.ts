/**
 * documentGeneratorService.ts
 *
 * Pure Node/TypeScript — no Python, no subprocess.
 *
 * Flow:
 *  1. Read employee rows from the uploaded master .xlsx  (ExcelJS)
 *  2. Walk public/templates/ recursively                 (Node fs)
 *  3. Filter templates by selected acts + state
 *  4. Fill each template with employee data              (ExcelJS)
 *  5. Pack everything into a ZIP                         (archiver)
 *  6. Return { zipBuffer, fileNames, rowCount }
 */

import fsSync              from 'fs';
import { promises as fs }  from 'fs';
import path                from 'path';

import { GenerateOptions, GenerateResult } from '../types/index.js';
import { toBuffer, walkXlsx, resolveTemplatesRoot } from '../lib/utils.js';
import { readMaster }          from '../lib/masterReader.js';
import { fillTemplate }        from '../lib/templateFiller.js';
import { buildZip, ZipEntry }  from '../lib/zipBuilder.js';

// ─── Act → folder mapping ─────────────────────────────────────────────────────

const ACT_FOLDER_MAP: Record<string, string> = {
  clra:               'CLRA_Act_1970',
  factories:          'Factories_Act_1948',
  code_wages:         'Code_on_Wages',
  bocw:               'BOCW_Act_1996',
  maternity:          'Maternity_Benefit_Act_1961',
  posh:               'POSH_2013',
  equal_remuneration: 'Equal_Remuneration_Act_1976',
  ismw:               'ISMW_1979',
  apprentices:        'Apprentices_Act_1961',
  se_act:             'SE_Act',
};

// ─── Filter logic ─────────────────────────────────────────────────────────────

function shouldInclude(
  absPath:       string,
  templatesRoot: string,
  selectedActs?: string[],
  state?:        string,
): boolean {
  const rel = path.relative(templatesRoot, absPath).replace(/\\/g, '/');

  // No act filter → include everything
  if (!selectedActs || selectedActs.length === 0) {
    return applyStateFilter(rel, state);
  }

  const allowedFolders = selectedActs
    .map((id) => ACT_FOLDER_MAP[id])
    .filter(Boolean);

  if (allowedFolders.length === 0) return true;

  const inSelectedAct = allowedFolders.some((folder) => rel.startsWith(folder));
  if (!inSelectedAct) return false;

  return applyStateFilter(rel, state);
}

/** For SE_Act, only include the matching state subfolder. */
function applyStateFilter(rel: string, state?: string): boolean {
  if (!rel.startsWith('SE_Act')) return true;
  if (!state)                    return true;

  // rel = "SE_Act/Karnataka/Register of Wages.xlsx"
  const stateFolder = rel.split('/')[1] ?? '';
  return stateFolder.toLowerCase() === state.trim().toLowerCase();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateComplianceDocs(
  options: GenerateOptions,
): Promise<GenerateResult> {

  // 1. Validate templates root
  const templatesRoot = resolveTemplatesRoot(options.templatesDir);
  if (!fsSync.existsSync(templatesRoot)) {
    throw new Error(
      `Templates directory not found. ` +
      `Place your .xlsx template files under public/templates/.`,
    );
  }

  // 2. Read master workbook
  const masterBuf = toBuffer(options.masterFile);
  const { rows, headers } = await readMaster(masterBuf);

  // 3. Collect & filter templates
  const allTemplates = await walkXlsx(templatesRoot);
  if (allTemplates.length === 0) {
    throw new Error(`No .xlsx templates found under: ${templatesRoot}`);
  }

  const filtered = allTemplates.filter((p) =>
    shouldInclude(p, templatesRoot, options.selectedActs, options.state),
  );

  if (filtered.length === 0) {
    throw new Error(
      `No templates matched. ` +
      `Acts: [${options.selectedActs?.join(', ') ?? 'all'}]  ` +
      `State: ${options.state ?? 'all'}`,
    );
  }

  // 4. Fill templates concurrently
  const entries: ZipEntry[] = [];
  const failed:  string[]   = [];

  await Promise.all(
    filtered.map(async (tplPath) => {
      const relName = path.relative(templatesRoot, tplPath).replace(/\\/g, '/');
      try {
        const tplBuf = await fs.readFile(tplPath);
        const filled = await fillTemplate(tplBuf, rows, headers);
        entries.push({ name: relName, buffer: filled });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[documentGeneratorService] Skipping "${relName}": ${msg}`);
        failed.push(relName);
      }
    }),
  );

  if (entries.length === 0) {
    throw new Error(`All ${filtered.length} templates failed to process.`);
  }

  if (failed.length > 0) {
    console.warn(`[documentGeneratorService] ${failed.length} skipped:`, failed.join(', '));
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  // 5. Build & return ZIP
  const zipBuffer = await buildZip(entries);
  return {
    zipBuffer,
    fileNames: entries.map((e) => e.name),
    rowCount:  rows.length,
  };
}
