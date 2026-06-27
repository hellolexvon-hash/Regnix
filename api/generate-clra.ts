/**
 * api/generate-clra.ts — Vercel serverless wrapper
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import router from '../server/routes/clraActRoute.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
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
    console.error('[CLRA] Unhandled error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  }
};