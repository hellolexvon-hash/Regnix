/** npx tsx scripts/populate-cli.ts --master M.xlsx [--source S.xlsx ...] [--out dir] [--asof 2026-10-31] [--allow-unverified] [--mapping map.json] */
import fs from 'fs';
import path from 'path';
import { populateMaster } from '../server/services/populate/index.js';

const a = process.argv.slice(2);
const all = (f: string) => a.flatMap((x, i) => (x === f ? [a[i + 1]] : []));
const one = (f: string) => all(f)[0];
const master = one('--master');
if (!master) { console.error('usage: --master file.xlsx [--source file ...] [--out dir] [--asof YYYY-MM-DD] [--allow-unverified] [--mapping map.json]'); process.exit(2); }
const out = one('--out') ?? 'out';
fs.mkdirSync(out, { recursive: true });
const result = await populateMaster({
  master: fs.readFileSync(master),
  sources: all('--source').map((f) => ({ name: path.basename(f), buffer: fs.readFileSync(f) })),
  mapping: one('--mapping') ? JSON.parse(fs.readFileSync(one('--mapping'), 'utf8')) : undefined,
  config: { allowUnverifiedTables: a.includes('--allow-unverified'), asOf: one('--asof') ? new Date(one('--asof') + 'T00:00:00Z') : undefined },
});
for (const f of result.files) fs.writeFileSync(path.join(out, f.name), f.buffer);
console.log(JSON.stringify(result.summary, null, 2));
console.log('written to', out);
