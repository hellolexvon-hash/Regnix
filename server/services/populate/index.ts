/**
 * populate/index.ts — public entry point.
 *
 *   const out = await populateMaster({ master, sources: [{ name, buffer }] });
 *   out.files → [Master (populated), Populate_Report.xlsx, populate_report.json]
 */
import { runPopulate, type PopulateInput, type PopulateOutput } from './engine.js';
import { buildReport, summarise } from './report.js';
import type { ZipFile } from '../shared/zipBuilder.js';

export interface PopulateResult { files: ZipFile[]; rowCount: number; summary: ReturnType<typeof summarise>; raw: PopulateOutput }

export async function populateMaster(input: PopulateInput): Promise<PopulateResult> {
  const raw = await runPopulate(input);
  const summary = summarise(raw);
  const reportXlsx = await buildReport(raw);
  const json = {
    summary,
    gaps: raw.gaps, notApplicable: raw.notApplicable, discrepancies: raw.discrepancies.slice(0, 5000),
    conflicts: raw.conflicts.slice(0, 5000), issues: raw.issues.slice(0, 20000),
    sources: raw.sources.map((s) => ({ ...s, mapping: s.mapping })), acts: raw.acts,
    config: { ...raw.config, asOf: raw.config.asOf?.toISOString() },
  };
  return {
    rowCount: raw.employees, summary, raw,
    files: [
      { name: 'Regnix_Enterprise_Master_Register_POPULATED.xlsx', buffer: raw.masterBuffer },
      { name: 'Populate_Report.xlsx', buffer: reportXlsx },
      { name: 'populate_report.json', buffer: Buffer.from(JSON.stringify(json, null, 2)) },
    ],
  };
}
export type { PopulateInput } from './engine.js';
