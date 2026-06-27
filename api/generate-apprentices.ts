/**
 * api/generate-apprentices.ts
 * Vercel serverless function — wraps the Express router so the same
 * route code works both locally (via server.ts) and on Vercel.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import router from '../server/routes/apprenticesActRoute.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', router);

export default (req: VercelRequest, res: VercelResponse) =>
  app(req as any, res as any);
