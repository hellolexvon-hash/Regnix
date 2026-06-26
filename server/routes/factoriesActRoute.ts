/**
 * server/routes/factoriesActRoute.ts
 *
 * Factories Act 1948 API
 *
 * POST /api/generate-factories
 *   Accepts a Regnix Master Register (.xlsx) and returns a ZIP containing:
 *
 *   Generated (auto-filled from master):
 *   - 01_Adult_Worker_Register.xlsx   Rule 62(1) / Section 62 / Form 11
 *   - 02_Leave_With_Wages_Register.xlsx  Rule 78-A / Section 79 / Form 15
 *   - 03_Overtime_Register.xlsx       Rule 63 / Section 59 / Form 22
 *   - Form_11_Adult_Worker.xlsx       Statutory Form 11 variant
 *   - Form_22_Overtime.xlsx           Statutory Form 22 variant
 *   - Form_24_Accident_Notice.xlsx    Section 88 / Rule 121
 *   - Form_25_Dangerous_Occurrence.xlsx  Section 88-A / Rule 121-A
 *
 *   Manual (passed through as-is):
 *   - Manual_Resister/05_Health_Register.xlsx
 *   - Manual_Resister/06_Inspection_Book.xlsx
 *   - Manual_Resister/07_Humidity_Register.xlsx
 *   - Manual_Resister/09_PPE_Issue_Register.xlsx
 *   - Manual_Resister/10_Canteen_Register.xlsx
 *   - Manual_Resister/Form_15_Leave_Wages.xlsx
 *
 * GET /api/generate-factories/health
 */

import express from 'express';
import multer  from 'multer';

import { buildZip }              from '../lib/zipBuilder.js';
import { generateFactoriesAct }  from '../services/factoriesAct/index.js';

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

// ─── POST /api/generate-factories ────────────────────────────────────────────

router.post(
  '/generate-factories',
  upload.single('master'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Master workbook is required.' });
      }

      const result    = await generateFactoriesAct(req.file.buffer);
      const zipBuffer = await buildZip(result.files);

      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      res.set({
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="Factories_Act_1948_${stamp}.zip"`,
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

// ─── GET /api/generate-factories/health ──────────────────────────────────────

router.get('/generate-factories/health', (_req, res) => {
  res.json({
    status:    'ok',
    act:       'Factories Act 1948',
    generated: [
      '01_Adult_Worker_Register (Rule 62(1) / Form 11)',
      '02_Leave_With_Wages_Register (Rule 78-A / Form 15)',
      '03_Overtime_Register (Rule 63 / Form 22)',
      'Form_11_Adult_Worker (Statutory)',
      'Form_22_Overtime (Statutory)',
      'Form_24_Accident_Notice (Rule 121 / Section 88)',
      'Form_25_Dangerous_Occurrence (Rule 121-A / Section 88-A)',
    ],
    manual: [
      '05_Health_Register',
      '06_Inspection_Book',
      '07_Humidity_Register',
      '09_PPE_Issue_Register',
      '10_Canteen_Register',
      'Form_15_Leave_Wages',
    ],
    timestamp: new Date().toISOString(),
  });
});

export default router;
