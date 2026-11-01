/**
 * server/routes/populateRoute.ts
 *
 * POST /api/populate-master   multipart/form-data
 *   master   (file, required)   Regnix master register .xlsx (may be the blank template)
 *   source   (file, 0..5)       payroll / HRMS / attendance export (.xlsx or .csv)
 *   mapping  (text, optional)   JSON { "Source header": "AB" | 28 }
 *   options  (text, optional)   JSON subset of PopulateConfig (asOf as ISO date)
 * Returns a ZIP: populated master + Populate_Report.xlsx + populate_report.json
 */
import express from 'express';
import multer from 'multer';
import { buildZip } from '../services/shared/zipBuilder.js';
import { populateMaster } from '../services/populate/index.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 6 } });

const json = (s: unknown): Record<string, any> | undefined => {
  if (typeof s !== 'string' || !s.trim()) return undefined;
  try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : undefined; } catch { return undefined; }
};

router.post(
  '/populate-master',
  upload.fields([{ name: 'master', maxCount: 1 }, { name: 'source', maxCount: 5 }]),
  async (req, res, next) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const master = files?.master?.[0];
      if (!master) return res.status(400).json({ error: 'Master workbook is required (field "master").' });

      const options = json(req.body?.options) ?? {};
      if (typeof options.asOf === 'string') options.asOf = new Date(options.asOf);
      // never let a client flip the policy switches that make statutory output less safe
      delete options.allowUnverifiedTables;

      const result = await populateMaster({
        master: master.buffer,
        sources: (files?.source ?? []).map((f) => ({ name: f.originalname, buffer: f.buffer })),
        mapping: json(req.body?.mapping),
        config: options,
      });
      const zip = await buildZip(result.files);
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Regnix_Populated_${stamp}.zip"`,
        'Content-Length': String(zip.length),
        'X-Row-Count': String(result.rowCount),
        'X-Summary': JSON.stringify(result.summary).slice(0, 4000),
      });
      return res.send(zip);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
