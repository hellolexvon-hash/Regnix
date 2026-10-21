/**
 * server/lib/zohoWorkDrive.ts
 *
 * Minimal Zoho WorkDrive client (OAuth refresh-token flow, Node 18+ fetch/FormData).
 *
 * Env (set in Vercel):
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN   (Self Client / Server-based app,
 *                                                             scopes: WorkDrive.files.ALL)
 *   ZOHO_PARENT_FOLDER_ID   WorkDrive folder that will hold one sub-folder per company
 *   ZOHO_ACCOUNTS_URL       default https://accounts.zoho.in   (.com / .eu / .in per your data centre)
 *   ZOHO_API_URL            default https://www.zohoapis.in
 */

const ACCOUNTS = process.env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.in';
const API = process.env.ZOHO_API_URL ?? 'https://www.zohoapis.in';

let cached: { token: string; exp: number } | null = null;

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const params = new URLSearchParams({
    refresh_token: need('ZOHO_REFRESH_TOKEN'),
    client_id: need('ZOHO_CLIENT_ID'),
    client_secret: need('ZOHO_CLIENT_SECRET'),
    grant_type: 'refresh_token',
  });
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, { method: 'POST', body: params });
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !j.access_token) throw new Error(`Zoho auth failed: ${j.error ?? res.status}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Folder / file names: keep it readable, strip characters WorkDrive rejects. */
export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled';
}

export interface ZohoFolder { id: string; url: string }

/** Create a folder named after the company inside the configured parent folder. */
export async function createCompanyFolder(companyName: string): Promise<ZohoFolder> {
  const token = await accessToken();
  const res = await fetch(`${API}/workdrive/api/v1/files`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/vnd.api+json' },
    body: JSON.stringify({
      data: { attributes: { name: safeName(companyName), parent_id: need('ZOHO_PARENT_FOLDER_ID') }, type: 'files' },
    }),
  });
  const j = (await res.json()) as {
    data?: { id?: string; attributes?: { permalink?: string } };
    errors?: unknown;
  };
  if (!res.ok || !j.data?.id) throw new Error(`Zoho create folder failed (${res.status}): ${JSON.stringify(j.errors ?? j)}`);
  return { id: j.data.id, url: j.data.attributes?.permalink ?? `https://workdrive.zoho.in/folder/${j.data.id}` };
}

export interface ZohoFile { id: string; url: string }

export async function uploadFile(folderId: string, fileName: string, mime: string, bytes: Buffer): Promise<ZohoFile> {
  const token = await accessToken();
  const form = new FormData();
  form.append('content', new Blob([bytes], { type: mime }), safeName(fileName));
  const qs = new URLSearchParams({ parent_id: folderId, filename: safeName(fileName), 'override-name-exist': 'true' });
  const res = await fetch(`${API}/workdrive/api/v1/upload?${qs}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    body: form,
  });
  const j = (await res.json()) as {
    data?: { attributes?: { resource_id?: string; Permalink?: string; permalink?: string } }[];
    errors?: unknown;
  };
  const a = j.data?.[0]?.attributes;
  if (!res.ok || !a?.resource_id) throw new Error(`Zoho upload failed (${res.status}): ${JSON.stringify(j.errors ?? j)}`);
  return { id: a.resource_id, url: a.Permalink ?? a.permalink ?? `https://workdrive.zoho.in/file/${a.resource_id}` };
}
