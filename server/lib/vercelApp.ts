/**
 * server/lib/vercelApp.ts
 *
 * Vercel only runs the files under /api as serverless functions; it does not
 * run server/server.ts. Each email endpoint is a tiny function file that
 * exports this Express app, so the same routes (auth checks, rate limits,
 * templates) are used locally (server.ts) and in production (Vercel).
 */

import express from 'express';
import cors from 'cors';
import emailRouter from '../routes/emailRoute.js';

export function emailApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors(
      allowedOrigins.length > 0
        ? {
            origin: (origin, cb) => {
              // no Origin header = server-to-server (e.g. the Supabase webhook)
              if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
              return cb(null, false);
            },
          }
        : undefined,
    ),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', emailRouter);
  return app;
}