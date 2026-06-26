/**
 * server/routes/codeOnWagesRoute.ts
 *
 * Code on Wages Act API — updated to use the new services/codeOnWages architecture.
 *
 * POST /api/generate-code-wages
 *   Accepts a Regnix Master Register (.xlsx) and returns a ZIP containing:
 *   - Form I    Register of Fines
 *   - Form II   Register of Deductions
 *   - Form III  Overtime Register
 *   - Form IV   Wage Register
 *   - Form VI   Muster Roll
 */

import express from 'express';
import multer  from 'multer';
import path    from 'path';
import fs      from 'fs';

import { buildZip }            from '../lib/zipBuilder.js';
import { generateCodeOnWages } from '../services/codeOnWages/index.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── POST /api/generate-code-wages ───────────────────────────────────────────

router.post(
  '/generate-code-wages',
  upload.single('master'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Master workbook is required.' });
      }

      const result    = await generateCodeOnWages(req.file.buffer);
      const zipBuffer = await buildZip(result.files);

      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      res.set({
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="Code_On_Wages_${stamp}.zip"`,
        'Content-Length':      String(zipBuffer.length),
        'X-File-Count':        String(result.files.length),
        'X-Row-Count':         String(result.rowCount),
        'X-File-Names':        JSON.stringify(result.files.map((f) => f.name)),
      });

      return res.send(zipBuffer);
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/generate-code-wages/health ─────────────────────────────────────

router.get('/generate-code-wages/health', (_req, res) => {
  res.json({
    status:    'ok',
    act:       'Code on Wages',
    forms:     ['Form I', 'Form II', 'Form III', 'Form IV', 'Form VI'],
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/generate-code-wages-template ───────────────────────────────────

router.get('/generate-code-wages-template', (_req, res) => {
  const candidates = [
    path.join(process.cwd(), 'public', 'templates', 'Code_on_Wages', 'Form IV - Wage Register.xlsx'),
    path.join(process.cwd(), 'public', 'Code_on_Wages', 'Form IV - Wage Register.xlsx'),
  ];

  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) {
    return res.status(404).json({ error: 'Form IV template not found.' });
  }

  return res.download(file, 'Form IV - Wage Register.xlsx');
});

export default router;
