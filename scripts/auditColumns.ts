/**
 * Audits MASTER_COLUMNS and CLRA_ACT_COLUMNS: the number each key resolves to is compared with
 * (a) the column letter / number quoted in its own comment and (b) the real header in the template.
 */
import fs from 'fs';
import ExcelJS from 'exceljs';
import { MASTER_COLUMNS } from '../server/services/shared/masterColumns.js';
import { CLRA_ACT_COLUMNS } from '../server/services/clra/clraAct/mapping.js';
import { columnLetterToNumber } from '../server/services/shared/excelUtils.js';

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('public/templates/Regnix_Enterprise_Master_Register_v2.xlsx');
const ws = wb.getWorksheet('Master Register - Structured')!;
const header = (c: number) => String(ws.getCell(2, c).value ?? '').replace(/\s+/g, ' ').trim();

function audit(label: string, file: string, obj: Record<string, unknown>) {
  const src = fs.readFileSync(file, 'utf8').split('\n');
  const out: string[] = [];
  for (const line of src) {
    const m = line.match(/^\s*(\w+):\s*[^,]+,\s*\/\/\s*(.*)$/);
    if (!m || !(m[1] in obj)) continue;
    const key = m[1], comment = m[2], val = obj[key];
    if (typeof val !== 'number') continue;
    let claimed: number | null = null;
    const lead = comment.match(/^([A-Z]{1,2})\s+[—-]/) ?? comment.match(/^\d+\s*\(([A-Z]{1,2})\)/);
    if (lead) claimed = columnLetterToNumber(lead[1]);
    else { const n = comment.match(/^(\d{1,3})\b/); if (n) claimed = Number(n[1]); }
    if (claimed !== null && claimed !== val)
      out.push(`${label}.${key} resolves to ${val} ("${header(val) || 'NO HEADER'}") but comment says col ${claimed} ("${header(claimed)}")`);
    if (val > 560) out.push(`${label}.${key} = ${val} is beyond the last master column (560)`);
  }
  return out;
}
const res = [
  ...audit('MASTER', 'server/services/shared/masterColumns.ts', MASTER_COLUMNS),
  ...audit('CLRA', 'server/services/clra/clraAct/mapping.ts', CLRA_ACT_COLUMNS as any),
];
console.log(res.join('\n') || 'no mismatches');
