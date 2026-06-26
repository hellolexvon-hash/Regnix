import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { generateComplianceDocs, ActId } from '../services/documentGeneratorService';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

const uploadFields = upload.fields([{ name: 'master', maxCount: 1 }]);

/**
 * POST /api/generate-docs
 *
 * Multipart form fields:
 *   master       — the filled Regnix Enterprise Master Register (.xlsx)   [required]
 *   selectedActs — JSON string: string[]  e.g. '["clra","factories"]'     [required]
 *   state        — company state for SE Act templates  e.g. "Karnataka"   [optional]
 *
 * Response: application/zip
 *   Headers:
 *     X-File-Count   — number of Excel files inside the zip
 *     X-Row-Count    — number of employee rows processed
 */
router.post(
  '/generate-docs',
  uploadFields,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;

      if (!files?.master?.[0]) {
        res.status(400).json({ error: 'Missing required master workbook.' });
        return;
      }

      // Parse selectedActs
      let selectedActs: ActId[] = [];
      try {
        const raw = req.body.selectedActs as string | undefined;
        if (!raw) throw new Error('empty');
        selectedActs = JSON.parse(raw) as ActId[];
        if (!Array.isArray(selectedActs) || selectedActs.length === 0) throw new Error('empty');
      } catch {
        res.status(400).json({ error: 'selectedActs must be a non-empty JSON array of act IDs.' });
        return;
      }

      const state = (req.body.state as string | undefined)?.trim() || 'Karnataka';

      const result = await generateComplianceDocs({
        masterFile:   files.master[0].buffer,
        selectedActs,
        state,
      });

      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.set({
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="Regnix_Registers_${timestamp}.zip"`,
        'Content-Length':      String(result.zipBuffer.length),
        'X-File-Count':        String(result.fileNames.length),
        'X-Row-Count':         String(result.rowCount),
      });
      res.send(Buffer.from(result.zipBuffer));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
