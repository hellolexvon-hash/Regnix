/**
 * Shared Express application used by the consolidated Vercel email handler
 * and by the existing local server. Email route behavior remains centralized
 * in server/routes/emailRoute.ts so auth checks, rate limits, and templates
 * are not duplicated across production entry points.
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
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors(
      allowedOrigins.length > 0
        ? {
            origin: (origin, callback) => {
              // Missing Origin is normal for server-to-server webhooks.
              if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
              }
              callback(null, false);
            },
          }
        : undefined,
    ),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use('/api', emailRouter);

  return app;
}
