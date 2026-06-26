/**
 * server.ts — Regnix backend entry point
 *
 * Pure Node / TypeScript. No Python. No subprocesses.
 * Uses ExcelJS to read & fill .xlsx files, archiver to ZIP them.
 *
 * Run:
 *   npm run dev
 *   npm run build && npm start
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import generateDocsRouter from './routes/generateDocsRoute.js';
import codeWagesRouter from './routes/codeOnWagesRoute.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ─── Static files ─────────────────────────────────────────────────────────────

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const publicTemplatesDir = path.join(rootDir, 'public', 'templates');

// Serve downloadable templates
app.use('/templates', express.static(publicTemplatesDir));

// Serve build assets in production
if (isProduction && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'Regnix backend is running',
    timestamp: new Date().toISOString(),
  });
});

// ─── API routes ───────────────────────────────────────────────────────────────

app.use('/api', generateDocsRouter);
app.use('/api', codeWagesRouter);

// ─── Frontend fallback in production ──────────────────────────────────────────

if (isProduction && fs.existsSync(path.join(distDir, 'index.html'))) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      message: 'Regnix backend is running in development mode',
      endpoints: [
        '/api/health',
        '/api/generate-docs',
        '/api/download-template',
        '/api/generate-code-wages',
      ],
    });
  });
}

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler (must be last) ────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\x1b[36m✓ Regnix backend → http://localhost:${PORT}\x1b[0m`);
  console.log('  GET  /api/health');
  console.log('  POST /api/generate-docs');
  console.log('  GET  /api/download-template');
  console.log('  POST /api/generate-code-wages');
});

export default app;