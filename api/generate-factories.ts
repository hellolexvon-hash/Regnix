/**
 * api/generate-factories.ts — Vercel serverless wrapper
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import router from '../server/routes/factoriesActRoute.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', router);

export default (req: VercelRequest, res: VercelResponse) =>
  app(req as any, res as any);
