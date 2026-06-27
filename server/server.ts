/**
 * server.ts — Regnix backend entry point
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import codeWagesRouter from './routes/codeOnWagesRoute.js';
import apprenticesRouter from './routes/apprenticesActRoute.js';
import clraRouter from './routes/clraActRoute.js';
import factoriesRouter from './routes/factoriesActRoute.js';
import seActRouter from './routes/seActRoute.js';
import manualRegistersRouter from './routes/manualRegistersRoute.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const publicTemplatesDir = path.join(rootDir, 'public', 'templates');

app.use('/templates', express.static(publicTemplatesDir));

if (isProduction && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'Regnix backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', codeWagesRouter);
app.use('/api', apprenticesRouter);
app.use('/api', clraRouter);
app.use('/api', factoriesRouter);
app.use('/api', seActRouter);
app.use('/api', manualRegistersRouter);

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
        '/api/generate-code-wages',
        '/api/generate-apprentices',
        '/api/generate-clra',
        '/api/generate-factories',
        '/api/generate-se-act',
        '/api/generate-se-act/states',
        '/api/generate-se-act/health',
        // Manual registers — no master upload needed
        '/api/download-bocw',
        '/api/download-equal-remuneration',
        '/api/download-ismw',
        '/api/download-maternity-benefit',
        '/api/download-posh',
        '/api/manual-registers/health',
      ],
    });
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\x1b[36m✓ Regnix backend → http://localhost:${PORT}\x1b[0m`);
  console.log('  GET  /api/health');
  console.log('  POST /api/generate-code-wages');
  console.log('  POST /api/generate-apprentices');
  console.log('  POST /api/generate-clra');
  console.log('  POST /api/generate-factories');
  console.log('  POST /api/generate-se-act');
  console.log('  GET  /api/generate-se-act/states');
  console.log('  GET  /api/generate-se-act/health');
  console.log('  ──── Manual registers (no master upload) ────');
  console.log('  GET  /api/download-bocw');
  console.log('  GET  /api/download-equal-remuneration');
  console.log('  GET  /api/download-ismw');
  console.log('  GET  /api/download-maternity-benefit');
  console.log('  GET  /api/download-posh');
  console.log('  GET  /api/manual-registers/health');
});

export default app;