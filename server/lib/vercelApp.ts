/**
 * Shared Express application used by the consolidated Vercel email handler
 * and by the existing local server. Email route behavior remains centralized
 * in server/routes/emailRoute.ts so auth checks, rate limits, and templates
 * are not duplicated across production entry points.
 */

import express from 'express';
import cors from 'cors';
import emailRouter from '../routes/emailRoute.js';
import kycUploadRouter from '../routes/kycUploadRoute.js';

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

  // KYC upload endpoints carry base64 files, so they get their own (larger) JSON limit
  // and must be mounted BEFORE the global 100kb parser below.
  app.use('/api', kycUploadRouter);

  app.use(express.json({ limit: '100kb' }));
  app.use('/api', emailRouter);

  return app;
}
