/**
 * api/populate-master.ts — Vercel serverless wrapper (same pattern as api/generate-clra.ts)
 *
 * NOTE: Vercel limits request AND response bodies to ~4.5 MB. Larger masters must be run
 * with scripts/populate-cli.ts or on a non-serverless host.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import router from '../server/routes/populateRoute.js';

const app = express();
app.use(cors());
app.use('/api', router);

export default async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  try {
    await new Promise<void>((resolve, reject) => {
      app(req as any, res as any, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    console.error('[populate-master] Unhandled error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
};