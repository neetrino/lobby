import { pipelineBoardResponseSchema, type PipelineBoard, type PipelineKindName } from '@lobby/contracts';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type { PipelineBoard, PipelineKindName };
export type PipelineStatus = PipelineBoard['statuses'][number];
export type PipelineColumn = PipelineBoard['columns'][number];
export type PipelineCard = PipelineColumn['cards'][number];

export class PipelineRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'PipelineRequestError';
    this.status = status;
    this.code = code;
  }
}

export function readPipeline(kind: PipelineKindName, signal?: AbortSignal): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}`, { method: 'GET' }, signal);
}

export function patchPipeline(
  kind: PipelineKindName,
  body: { name?: string; amountLabel?: string },
): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function createColumn(kind: PipelineKindName, name: string): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/columns`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function patchColumn(
  kind: PipelineKindName,
  columnId: string,
  body: { name?: string; widthPx?: number },
): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/columns/${columnId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteColumn(kind: PipelineKindName, columnId: string): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/columns/${columnId}`, { method: 'DELETE' });
}

export function createCard(
  kind: PipelineKindName,
  body: { columnId: string; title: string; company: string; amount: number },
): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/cards`, { method: 'POST', body: JSON.stringify(body) });
}

export type CardUpdate = {
  title?: string;
  company?: string;
  amount?: number;
  source?: string;
  qualification?: string;
  nextAction?: string;
  lostReason?: string;
  outcome?: PipelineCard['outcome'];
  expectedCloseOn?: string | null;
  contactId?: string | null;
  ownerUserId?: string | null;
  statusId?: string | null;
  position?: number;
  columnId?: string;
};

export function createStatus(
  kind: PipelineKindName,
  body: { name: string; color: string },
): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/statuses`, { method: 'POST', body: JSON.stringify(body) });
}

export function updateStatus(
  kind: PipelineKindName,
  statusId: string,
  body: { name?: string; color?: string },
): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/statuses/${statusId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteStatus(kind: PipelineKindName, statusId: string): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/statuses/${statusId}`, { method: 'DELETE' });
}

export function updateCard(
  kind: PipelineKindName,
  cardId: string,
  body: CardUpdate,
): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function convertLead(cardId: string): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/lead/cards/${cardId}/convert`, { method: 'POST' });
}

export function moveCard(kind: PipelineKindName, cardId: string, columnId: string): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify({ columnId }),
  });
}

export function deleteCard(kind: PipelineKindName, cardId: string): Promise<PipelineBoard> {
  return request(`/api/v1/pipelines/${kind}/cards/${cardId}`, { method: 'DELETE' });
}

async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<PipelineBoard> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    signal,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
  });
  if (!response.ok) {
    throw await readError(response);
  }
  return parseBoard(await response.json());
}

function parseBoard(value: unknown): PipelineBoard {
  const parsed = pipelineBoardResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new PipelineRequestError(500, 'REQUEST_FAILED');
  }
  return parsed.data.data;
}

async function readError(response: Response): Promise<PipelineRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : 'REQUEST_FAILED';
  return new PipelineRequestError(response.status, code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
