/**
 * generateDocsRoute.ts
 *
 * POST /api/generate-docs      — upload filled master .xlsx → download ZIP of registers
 * GET  /api/download-template  — download the blank master template
 * GET  /api/health             — health check
 */

import express, { Request, Response, NextFunction } from 'express';
import multer  from 'multer';
import path    from 'path';
import fsSync  from 'fs';

import { generateComplianceDocs } from '../services/documentGeneratorService.js';

const router = express.Router();

// ─── Multer ───────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx / .xls files are accepted.'));
    }
  },
});

const uploadFields = upload.fields([{ name: 'master', maxCount: 1 }]);

// ─── POST /api/generate-docs ──────────────────────────────────────────────────

router.post(
  '/generate-docs',
  uploadFields,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;

      if (!files?.master?.[0]) {
        res.status(400).json({
          error: 'Master workbook is required. Upload your filled Regnix_Enterprise_Master_Register_v2.xlsx.',
        });
        return;
      }

      // Parse optional body fields sent by the frontend
      let selectedActs: string[] | undefined;
      if (typeof req.body?.selectedActs === 'string') {
        try { selectedActs = JSON.parse(req.body.selectedActs); } catch { /* ignore */ }
      }

      const state: string | undefined =
        typeof req.body?.state === 'string' && req.body.state.trim()
          ? req.body.state.trim()
          : undefined;

      const result = await generateComplianceDocs({
        masterFile:   files.master[0].buffer,
        selectedActs,
        state,
      });

      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      res.set({
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="Regnix_Registers_${stamp}.zip"`,
        'Content-Length':      String(result.zipBuffer.length),
        'X-File-Count':        String(result.fileNames.length),
        'X-Row-Count':         String(result.rowCount),
        'X-File-Names':        JSON.stringify(result.fileNames),
      });

      res.send(result.zipBuffer);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/download-template ───────────────────────────────────────────────

router.get('/download-template', (_req: Request, res: Response) => {
  const candidates = [
    path.join(process.cwd(), 'public', 'templates', 'Regnix_Enterprise_Master_Register_v2.xlsx'),
    path.join(process.cwd(), 'public', 'templates', 'RegnixMain.xlsx'),
    path.join(process.cwd(), 'public', 'Regnix_Enterprise_Master_Register_v2.xlsx'),
  ];

  const found = candidates.find((p) => fsSync.existsSync(p));

  if (!found) {
    res.status(404).json({
      error: 'Master template not found. Place Regnix_Enterprise_Master_Register_v2.xlsx in public/templates/.',
    });
    return;
  }

  res.download(found, 'Regnix_Enterprise_Master_Register_v2.xlsx');
});

// ─── GET /api/health ──────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
