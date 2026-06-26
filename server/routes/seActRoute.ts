/**
 * server/routes/seActRoute.ts
 *
 * Shops & Establishments Act API
 *
 * POST /api/generate-se-act
 *   Accepts multipart/form-data:
 *     master  — Regnix Master Register .xlsx (required)
 *     state   — State name string (required)
 *              Valid: Assam, Delhi, Gujarat, Haryana, Karnataka,
 *              Kerala, Maharashtra, Meghalaya, Odisha, Punjab,
 *              Rajasthan, Tamil Nadu, Telangana, West Bengal
 *   Returns: application/zip
 *
 * GET /api/generate-se-act/states
 *   Returns JSON list of supported states.
 *
 * GET /api/generate-se-act/health
 */

import express from 'express';
import multer  from 'multer';

import { buildZip }      from '../lib/zipBuilder.js';
import { generateSeAct } from '../services/seAct/index.js';

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

export const SE_ACT_STATES = [
  'Assam',
  'Delhi',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Meghalaya',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'West Bengal',
] as const;

export type SeActState = (typeof SE_ACT_STATES)[number];

// ─── GET /api/generate-se-act/states ─────────────────────────────────────────

router.get('/generate-se-act/states', (_req, res) => {
  res.json({ states: SE_ACT_STATES });
});

// ─── GET /api/generate-se-act/health ─────────────────────────────────────────

router.get('/generate-se-act/health', (_req, res) => {
  res.json({
    status:    'ok',
    act:       'Shops & Establishments Act',
    states:    SE_ACT_STATES,
    registers: [
      'Register of Employment',
      'Register of Wages',
      'Register of Leave',
      'Register of Advances',
      'Register of Fines',
      'Register of Deductions',
      'Overtime Register',
      'Muster Roll cum Wage Register (Telangana)',
    ],
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/generate-se-act ────────────────────────────────────────────────

router.post(
  '/generate-se-act',
  upload.single('master'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Master workbook is required.' });
      }

      const rawState = (req.body?.state ?? '').trim() as string;
      if (!rawState) {
        return res.status(400).json({ error: 'State is required.' });
      }

      const normalised = SE_ACT_STATES.find(
        (s) => s.toLowerCase() === rawState.toLowerCase(),
      );
      if (!normalised) {
        return res.status(400).json({
          error: `Unsupported state: "${rawState}". Valid states: ${SE_ACT_STATES.join(', ')}`,
        });
      }

      const result    = await generateSeAct(req.file.buffer, normalised);
      const zipBuffer = await buildZip(result.files);

      const stamp    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const safeName = normalised.replace(/\s+/g, '_');

      res.set({
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="SE_Act_${safeName}_${stamp}.zip"`,
        'Content-Length':      String(zipBuffer.length),
        'X-File-Count':        String(result.files.length),
        'X-Row-Count':         String(result.employeeCount),
        'X-State':             normalised,
        'X-File-Names':        JSON.stringify(result.files.map((f) => f.name)),
      });

      return res.send(zipBuffer);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
