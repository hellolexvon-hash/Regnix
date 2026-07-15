/**
 * server.ts — Regnix backend entry point
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import generateDocsRouter from './routes/generateDocsRoute.js';
import codeWagesRouter from './routes/codeOnWagesRoute.js';
import apprenticesRouter from './routes/apprenticesActRoute.js';
import clraRouter from './routes/clraActRoute.js';
import factoriesRouter from './routes/factoriesActRoute.js';
import seActRouter from './routes/seActRoute.js';
import manualRegistersRouter from './routes/manualRegistersRoute.js';
import auditorRouter from './routes/auditorRoute.js';
import validationRouter from './routes/validationRoute.js';
import superAdminRouter from './routes/superAdminRoute.js';
import certificateRouter from './routes/certificateRoute.js';

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

const publicManualRegistersDir = path.join(rootDir, 'public', 'manual_registers');
app.use('/manual_registers', express.static(publicManualRegistersDir));

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

app.use('/api', generateDocsRouter);
app.use('/api', codeWagesRouter);
app.use('/api', apprenticesRouter);
app.use('/api', clraRouter);
app.use('/api', factoriesRouter);
app.use('/api', seActRouter);
app.use('/api', manualRegistersRouter);
app.use('/api', validationRouter);
app.use('/api', auditorRouter);
app.use('/api', superAdminRouter);
app.use('/api', certificateRouter);

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
        '/api/generate-apprentices',
        '/api/generate-clra',
        '/api/generate-factories',
        '/api/generate-se-act',
        '/api/download-bocw',
        '/api/download-maternity-benefit',
        '/api/download-posh',
        '/api/download-equal-remuneration',
        '/api/download-ismw',
        '/api/validation/state',
        '/api/validation/submit',
        '/api/auditor/portal/bootstrap',
        '/api/auditor/auth/signin',
        '/api/auditor/auth/signup',
        '/api/auditor/auth/signout',
        '/api/auditor/reviews/claim',
        '/api/auditor/reviews/decision',
        '/api/auditor/company/:id',
        '/api/auditor/history',
        '/api/admin/dashboard',
        '/api/admin/clients',
        '/api/admin/auditors',
        '/api/admin/activity',
        '/api/certificate/email',
        '/api/certificate/issue',
      ],
    });
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Regnix backend listening on port ${PORT}`);
});