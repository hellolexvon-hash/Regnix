/**
 * api/download.ts — ONE Vercel function for all manual-register downloads.
 *
 * Replaces five identical wrappers (download-bocw, download-equal-remuneration, download-ismw,
 * download-maternity-benefit, download-posh), which all mounted the same manualRegistersRoute.
 * Merged to stay under the Hobby plan's 12-function limit.
 *
 * vercel.json rewrites each public URL to /api/download?doc=<name>. The handler maps that back
 * to the original public path before the Express router runs, so manualRegistersRoute is
 * unchanged. Direct requests to the original paths also work (local / manual testing).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import router from '../server/routes/manualRegistersRoute.js';

const app = express();
app.use(cors());
app.use('/api', router);

const DOC_PATHS: Readonly<Record<string, string>> = {
  bocw: '/api/download-bocw',
  'equal-remuneration': '/api/download-equal-remuneration',
  ismw: '/api/download-ismw',
  'maternity-benefit': '/api/download-maternity-benefit',
  posh: '/api/download-posh',
};
const KNOWN_PATHS = new Set(Object.values(DOC_PATHS));

export default (req: VercelRequest, res: VercelResponse): void => {
  let url: URL;
  try {
    url = new URL(req.url ?? '/', `https://${req.headers.host ?? 'localhost'}`);
  } catch {
    res.status(400).json({ ok: false, error: 'Invalid request URL.' });
    return;
  }

  const doc = url.searchParams.get('doc') ?? undefined;
  const target = KNOWN_PATHS.has(url.pathname) ? url.pathname : doc ? DOC_PATHS[doc] : undefined;
  if (!target) {
    res.status(400).json({ ok: false, error: 'Missing or invalid download document.' });
    return;
  }

  url.searchParams.delete('doc');
  const rest = url.searchParams.toString();
  req.url = `${target}${rest ? `?${rest}` : ''}`;
  app(req as any, res as any);
};
