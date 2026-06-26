import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err:   unknown,
  _req:  Request,
  res:   Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : 'Internal server error';
  const status  = (err as { status?: number }).status ?? 500;

  console.error('[error]', message);

  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
}
