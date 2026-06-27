/**
 * api/health.ts — Vercel serverless wrapper
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default (_req: VercelRequest, res: VercelResponse) => {
  res.status(200).json({
    ok: true,
    message: 'Regnix backend is running',
    timestamp: new Date().toISOString(),
  });
};
