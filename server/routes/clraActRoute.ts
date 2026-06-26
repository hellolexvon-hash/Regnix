/**
 * server/routes/clraActRoute.ts
 *
 * POST /api/generate-clra
 *   Accepts a Regnix Master Register (.xlsx) → returns ZIP of all CLRA Act 1970 registers.
 *
 * GET /api/generate-clra/health
 *
 * File lives at:  server/routes/clraActRoute.ts
 * Service lives at: server/services/clraAct/index.ts
 */

import express from 'express';
import multer  from 'multer';

import { buildZip }        from '../lib/zipBuilder.js';
import { generateClraAct } from '../services/clra/clraAct/index.js';

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

// ─── POST /api/generate-clra ─────────────────────────────────────────────────

router.post(
  '/generate-clra',
  upload.single('master'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Master workbook is required.' });
      }

      const result    = await generateClraAct(req.file.buffer);
      const zipBuffer = await buildZip(result.files);

      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      res.set({
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="CLRA_Act_1970_${stamp}.zip"`,
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

// ─── GET /api/generate-clra/health ───────────────────────────────────────────

router.get('/generate-clra/health', (_req, res) => {
  res.json({
    status:    'ok',
    act:       'Contract Labour (R&A) Act 1970',
    forms:     ['Form I', 'Form XIV/XVI', 'Form XVII', 'Form XX', 'Form XXI', 'Form XXII', 'Form XXIII'],
    registers: ['Bonus', 'Gratuity', 'EPF', 'LWF & PT'],
    manual:    ['Dashboard', 'Form III', 'Form V-A', 'Form XIV Card', 'LWF PT Guide', 'Labour Leave Guide'],
    timestamp: new Date().toISOString(),
  });
});

export default router;
