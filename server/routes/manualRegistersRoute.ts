/**
 * server/routes/manualRegistersRoute.ts
 *
 * Serves pre-built ZIP packages for Acts whose registers are entirely manual
 * (no master-workbook data injection required). When the user selects one of
 * these Acts the frontend simply hits the GET endpoint and receives the ZIP.
 *
 * Endpoints
 * ─────────
 * GET /api/download-bocw
 *   Building & Other Construction Workers (RE&CS) Act 1996
 *
 * GET /api/download-equal-remuneration
 *   Equal Remuneration Act 1976
 *
 * GET /api/download-ismw
 *   Inter-State Migrant Workmen (RE&CS) Act 1979
 *
 * GET /api/download-maternity-benefit
 *   Maternity Benefit Act 1961
 *
 * GET /api/download-posh
 *   Sexual Harassment of Women at Workplace (Prevention, Prohibition and
 *   Redressal) Act 2013 (POSH)
 *
 * GET /api/manual-registers/health
 *   Lists all acts and their file counts.
 *
 * ZIP files must be placed at:
 *   server/public/manual_registers/<ZIP_FILENAME>
 * (see MANUAL_ACTS map below for exact filenames)
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// ─── Act registry ─────────────────────────────────────────────────────────────

interface ManualAct {
  /** Human-readable name shown in health / error responses */
  label: string;
  /** Filename inside public/manual_registers/ */
  zipFile: string;
  /** Content-Disposition filename sent to the browser */
  downloadName: string;
  /** File count inside the ZIP (informational) */
  fileCount: number;
}

const MANUAL_ACTS: Record<string, ManualAct> = {
  bocw: {
    label:        'Building & Other Construction Workers (RE&CS) Act 1996',
    zipFile:      'BOCW_Act_1996.zip',
    downloadName: 'BOCW_Act_1996.zip',
    fileCount:    29,
  },
  'equal-remuneration': {
    label:        'Equal Remuneration Act 1976',
    zipFile:      'Equal_Remuneration_Act_1976.zip',
    downloadName: 'Equal_Remuneration_Act_1976.zip',
    fileCount:    2,
  },
  ismw: {
    label:        'Inter-State Migrant Workmen (RE&CS) Act 1979',
    zipFile:      'ISMW_1979.zip',
    downloadName: 'ISMW_1979.zip',
    fileCount:    4,
  },
  'maternity-benefit': {
    label:        'Maternity Benefit Act 1961',
    zipFile:      'Maternity_Benefit_Act_1961.zip',
    downloadName: 'Maternity_Benefit_Act_1961.zip',
    fileCount:    3,
  },
  posh: {
    label:        'Sexual Harassment of Women at Workplace Act 2013 (POSH)',
    zipFile:      'POSH_2013.zip',
    downloadName: 'POSH_2013.zip',
    fileCount:    3,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveZipPath(zipFile: string): string {
  return path.join(process.cwd(), 'public', 'manual_registers', zipFile);
}

function sendManualZip(actKey: string, _req: Request, res: Response): void {
  const act = MANUAL_ACTS[actKey];
  if (!act) {
    res.status(404).json({ error: `Unknown act key: ${actKey}` });
    return;
  }

  const filePath = resolveZipPath(act.zipFile);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({
      error: `ZIP not found for "${act.label}". Place ${act.zipFile} in server/public/manual_registers/.`,
    });
    return;
  }

  const stat = fs.statSync(filePath);

  res.set({
    'Content-Type':        'application/zip',
    'Content-Disposition': `attachment; filename="${act.downloadName}"`,
    'Content-Length':      String(stat.size),
    'X-Act':               act.label,
    'X-File-Count':        String(act.fileCount),
  });

  fs.createReadStream(filePath).pipe(res);
}

// ─── Individual download endpoints ────────────────────────────────────────────

router.get('/download-bocw', (req, res) => {
  sendManualZip('bocw', req, res);
});

router.get('/download-equal-remuneration', (req, res) => {
  sendManualZip('equal-remuneration', req, res);
});

router.get('/download-ismw', (req, res) => {
  sendManualZip('ismw', req, res);
});

router.get('/download-maternity-benefit', (req, res) => {
  sendManualZip('maternity-benefit', req, res);
});

router.get('/download-posh', (req, res) => {
  sendManualZip('posh', req, res);
});

// ─── Health ───────────────────────────────────────────────────────────────────

router.get('/manual-registers/health', (_req, res) => {
  const status = Object.entries(MANUAL_ACTS).map(([key, act]) => ({
    key,
    label:     act.label,
    endpoint:  `/api/download-${key}`,
    fileCount: act.fileCount,
    available: fs.existsSync(resolveZipPath(act.zipFile)),
  }));

  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    acts:      status,
  });
});

export default router;