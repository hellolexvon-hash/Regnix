/**
 * Consolidated production entry point for Lexvon email endpoints.
 *
 * Vercel rewrites the five public email URLs to this one Serverless Function.
 * The action is translated back to the public route before the shared Express
 * application handles the request, so the existing emailRouter continues to
 * own validation, authorization, rate limits, templates, and mail delivery.
 */

import type { Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { emailApp } from '../server/lib/vercelApp.js';

const app = emailApp();

const ACTION_PATHS: Readonly<Record<string, string>> = {
  signup: '/api/webhooks/signup',
  approval: '/api/email/approval',
  rejection: '/api/email/rejection',
  'kyc-request': '/api/email/kyc-request',
  'kyc-verified': '/api/email/kyc-verified',
};

const PATH_ACTIONS: Readonly<Record<string, string>> = {
  '/api/webhooks/signup': 'signup',
  '/api/email/approval': 'approval',
  '/api/email/rejection': 'rejection',
  '/api/email/kyc-request': 'kyc-request',
  '/api/email/kyc-verified': 'kyc-verified',
};

type RequestWithVercelQuery = IncomingMessage & {
  query?: Record<string, unknown>;
};

function stringQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function sendJsonError(
  res: ServerResponse,
  statusCode: number,
  message: string,
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: false, error: message }));
}

export default function handler(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const host = req.headers.host ?? 'localhost';
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(req.url ?? '/', `https://${host}`);
  } catch {
    sendJsonError(res, 400, 'Invalid request URL.');
    return;
  }

  // Support both Vercel's rewritten URL (?action=...) and direct requests to
  // one of the original public paths (useful in local/manual testing).
  const directAction = PATH_ACTIONS[parsedUrl.pathname];
  const queryBag = (req as RequestWithVercelQuery).query;
  const queryAction =
    parsedUrl.searchParams.get('action') ??
    stringQueryValue(queryBag?.action);
  const action = directAction ?? queryAction;
  const targetPath = action ? ACTION_PATHS[action] : undefined;

  if (!targetPath) {
    sendJsonError(res, 400, 'Missing or invalid email action.');
    return;
  }

  // Remove only the internal dispatch parameter. Preserve all other query
  // parameters and leave the request method, headers, and body unchanged.
  parsedUrl.searchParams.delete('action');
  const remainingQuery = parsedUrl.searchParams.toString();
  req.url = `${targetPath}${remainingQuery ? `?${remainingQuery}` : ''}`;

  // Express enriches the incoming Node request/response with its own fields.
  // These casts do not change the objects and preserve the existing app/router.
  app(req as Request, res as Response);
}
