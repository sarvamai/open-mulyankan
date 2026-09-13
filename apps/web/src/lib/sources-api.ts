/**
 * The `/sources` client — the app's first real call to `platform/core`.
 *
 * Every response shape here mirrors `core_api/routers/sources.py`. The server
 * speaks camelCase so the two line up field for field; when they drift, the
 * router is right and this file is wrong.
 *
 * This app is an untrusted client (ADR-0008): the checks below are for the
 * reader's benefit, and the server repeats every one of them.
 */

/** Where core-api is. Set `NEXT_PUBLIC_MULYANKAN_API` to point elsewhere. */
export const API_BASE = (
  process.env.NEXT_PUBLIC_MULYANKAN_API ?? 'http://localhost:8000'
).replace(/\/$/, '');

export type SourceKind = 'textbook' | 'paper';
export type SourceStatus = 'processing' | 'ready' | 'failed';
export type StageState = 'running' | 'completed' | 'failed';

export interface SourceStage {
  id: string;
  label: string;
  state: StageState;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
}

export interface SourceRow {
  id: string;
  kind: SourceKind;
  name: string;
  subject: string;
  classLevel: number;
  meta: string;
  createdAt: string;
  status: SourceStatus;
  pageCount: number;
  /** Null when the PDF declares no table of contents — not zero. */
  chapterCount: number | null;
  characterCount: number;
  imageCount: number;
  pagesWithText: number;
  pagesWithoutText: number;
  pagesWithUnusableText: number;
  /** Pages no deterministic extractor can read; the `ocr` SPI's future input. */
  pagesNeedingOcr: number;
  hasCover: boolean;
  error: string | null;
  stages: SourceStage[];
}

export interface UploadFields {
  file: File;
  kind: SourceKind;
  name: string;
  subject: string;
  classLevel: number;
  meta: string;
}

/** A failed call, carrying the server's own reason where it gave one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    // A network-level failure here almost always means core-api is not
    // running, which is worth saying plainly rather than as "Failed to fetch".
    throw new ApiError(`Cannot reach core-api at ${API_BASE}`, 0);
  }
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** FastAPI reports `detail` as a string, or as a list for validation errors. */
async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  } catch {
    // No JSON body; the status line is all there is to report.
  }
  return `Request failed (${response.status})`;
}

export function listSources(signal?: AbortSignal): Promise<SourceRow[]> {
  return request<SourceRow[]>('/sources', { signal });
}

export function getSource(id: string, signal?: AbortSignal): Promise<SourceRow> {
  return request<SourceRow>(`/sources/${id}`, { signal });
}

export function uploadSource(fields: UploadFields): Promise<SourceRow> {
  const body = new FormData();
  body.set('file', fields.file);
  body.set('kind', fields.kind);
  body.set('name', fields.name);
  body.set('subject', fields.subject);
  body.set('class_level', String(fields.classLevel));
  body.set('meta', fields.meta);
  return request<SourceRow>('/sources', { method: 'POST', body });
}

export function renameSource(id: string, name: string): Promise<SourceRow> {
  return request<SourceRow>(`/sources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function deleteSource(id: string): Promise<void> {
  return request<void>(`/sources/${id}`, { method: 'DELETE' });
}

/**
 * The rendered first page. Small and lossy by design — the server stores a
 * 512px JPEG, never the page itself.
 */
export function coverUrl(id: string): string {
  return `${API_BASE}/sources/${id}/cover`;
}
