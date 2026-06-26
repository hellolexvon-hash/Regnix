/**
 * server/routes/apprenticesActRoute.ts
 *
 * Apprentices Act 1961 API
 *
 * POST /api/generate-apprentices
 *   Accepts a Regnix Master Register (.xlsx) and returns a ZIP containing:
 *   - Form AA-1  Apprentice Register
 *   - Form AA-2  Contract of Apprenticeship Register
 *   - Form AA-5  Attendance Register
 *   - Form AA-6  Stipend Payment Register
 *   - Manual_registers/Training_Record.xlsx  (passed through as-is)
 */

import express from 'express';
import multer  from 'multer';

import { buildZip }               from '../lib/zipBuilder.js';
import { generateApprenticesAct } from '../services/apprenticesAct/index.js';

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

// ─── POST /api/generate-apprentices ──────────────────────────────────────────

router.post(
  '/generate-apprentices',
  upload.single('master'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Master workbook is required.' });
      }

      const result    = await generateApprenticesAct(req.file.buffer);
      const zipBuffer = await buildZip(result.files);

      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      res.set({
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="Apprentices_Act_1961_${stamp}.zip"`,
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

// ─── GET /api/generate-apprentices/health ────────────────────────────────────

router.get('/generate-apprentices/health', (_req, res) => {
  res.json({
    status:    'ok',
    act:       'Apprentices Act 1961',
    forms:     ['Form AA-1', 'Form AA-2', 'Form AA-5', 'Form AA-6'],
    manual:    ['Training_Record'],
    timestamp: new Date().toISOString(),
  });
});

export default router;
