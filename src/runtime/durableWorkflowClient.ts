/**
 * Durable creative workflow REST + SSE client.
 *
 * Talks to `/v1/creative-agent/workflows` on `sogni-api`. Used by all three
 * consumers of the shared package (browser chat, hosted chat in the API,
 * and the public skill runtime) so they speak the same fetch/SSE contract.
 *
 * Pure browser+node compatible — uses `fetch`/`ReadableStream` and lets the
 * caller inject a `fetchImpl` for testing. The caller is responsible for
 * supplying an absolute API base URL (`apiBaseUrl`).
 */
import {
  buildBackboneDurableWorkflowRun,
  type BackboneDurableWorkflowRunContract,
  type BackboneDurableWorkflowInput,
  type BackboneWorkflowStatus,
} from '../contracts/backboneDurableWorkflow.js';

export const DURABLE_CREATIVE_WORKFLOW_ENDPOINT = '/v1/creative-agent/workflows';

// Minimal fetch typings so this client compiles with `lib: ['ES2022']` (no
// DOM lib) yet remains usable in both browsers and modern Node (≥ 18).
type RequestCredentialsLike = 'omit' | 'same-origin' | 'include';

type FetchLike = typeof fetch;

interface ApiEnvelope<T> {
  status: string;
  data: T;
  message?: string;
  error?: unknown;
}

export type DurableCreativeWorkflowWaitingReason =
  | 'ask_clarifying_question'
  | 'select_media_required'
  | 'cost_approval_required'
  | 'cost_reauthorization_required'
  | 'safety_review_required'
  | 'workflow_user_input_required'
  | 'insufficient_credit'
  | 'permission_required'
  | 'other';

export interface DurableCreativeWorkflowRecord {
  workflowId: string;
  /** Safe Content Filter preference captured when the workflow started. */
  safeContentFilter?: boolean;
  title?: string;
  status: BackboneWorkflowStatus;
  /** Why a `waiting_for_user` workflow is paused. */
  waitingReason?: DurableCreativeWorkflowWaitingReason;
  /** True only when the workflow's confirm-cost endpoint is the valid resolution. */
  awaitingCostApproval?: boolean;
  input?: Record<string, unknown>;
  plan?: BackboneDurableWorkflowRunContract;
  steps?: unknown[];
  events?: unknown[];
  artifacts?: unknown[];
  billingPreview?: unknown;
  billingPreviews?: unknown[];
  createTime?: number;
  updateTime?: number;
}

export interface DurableCreativeWorkflowClientOptions {
  apiKey?: string;
  /** Absolute API base URL (e.g. `https://api.sogni.ai`). Required. */
  apiBaseUrl: string;
  credentials?: RequestCredentialsLike;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  tokenType?: string;
  appSource?: string;
  idempotencyKey?: string;
  maxEstimatedCapacityUnits?: number;
  confirmCost?: boolean;
  /** Preference for a new workflow; omitted values use the service default. */
  safeContentFilter?: boolean;
}

export interface StartDurableCreativeWorkflowRequest {
  input: Omit<BackboneDurableWorkflowInput, 'mediaReferences'>;
  token_type?: string;
  app_source?: string;
  media_references?: unknown[];
  max_estimated_capacity_units?: number;
  confirm_cost?: boolean;
  safe_content_filter?: boolean;
}

function appendPath(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export function getDurableCreativeWorkflowUrl(
  workflowId: string | undefined,
  apiBaseUrl: string,
): string {
  const path = workflowId
    ? `${DURABLE_CREATIVE_WORKFLOW_ENDPOINT}/${encodeURIComponent(workflowId)}`
    : DURABLE_CREATIVE_WORKFLOW_ENDPOINT;
  return appendPath(apiBaseUrl, path);
}

export function getDurableCreativeWorkflowEventsUrl(
  workflowId: string,
  apiBaseUrl: string,
): string {
  return `${getDurableCreativeWorkflowUrl(workflowId, apiBaseUrl)}/events`;
}

export function buildDurableCreativeWorkflowPreview(
  input: BackboneDurableWorkflowInput,
  options: { workflowId?: string; now?: string; title?: string } = {},
): BackboneDurableWorkflowRunContract {
  return buildBackboneDurableWorkflowRun(input, {
    workflowId: options.workflowId ?? 'wf_durable_workflow_preview',
    ...(options.now ? { now: options.now } : {}),
    ...(options.title ? { title: options.title } : {}),
  });
}

export function buildStartDurableCreativeWorkflowRequest(
  input: BackboneDurableWorkflowInput,
  options: Pick<
    DurableCreativeWorkflowClientOptions,
    'tokenType' | 'appSource' | 'maxEstimatedCapacityUnits' | 'confirmCost' | 'safeContentFilter'
  > = {},
): StartDurableCreativeWorkflowRequest {
  const { mediaReferences, ...requestInput } = input;
  return {
    input: requestInput,
    ...(options.tokenType ? { token_type: options.tokenType } : {}),
    ...(options.appSource ? { app_source: options.appSource } : {}),
    ...(mediaReferences !== undefined ? { media_references: mediaReferences } : {}),
    ...(options.maxEstimatedCapacityUnits !== undefined
      ? { max_estimated_capacity_units: options.maxEstimatedCapacityUnits }
      : {}),
    ...(options.confirmCost !== undefined ? { confirm_cost: options.confirmCost } : {}),
    ...(options.safeContentFilter !== undefined ? { safe_content_filter: options.safeContentFilter } : {}),
  };
}

function getFetch(options: DurableCreativeWorkflowClientOptions): FetchLike {
  return options.fetchImpl ?? fetch;
}

function buildHeaders(apiKey?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

function buildRequestHeaders(options: DurableCreativeWorkflowClientOptions): Record<string, string> {
  return {
    ...buildHeaders(options.apiKey),
    ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();
  let body: Partial<ApiEnvelope<T>> = {};
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (isPlainObject(parsed)) {
        body = parsed as Partial<ApiEnvelope<T>>;
      }
    } catch {
      // Non-JSON body falls through.
    }
  }

  if (!response.ok) {
    const detail = typeof body.message === 'string'
      ? body.message
      : typeof body.error === 'string'
        ? body.error
        : response.statusText;
    throw new Error(`Creative workflow API request failed (${response.status}): ${detail}`);
  }

  if (!('data' in body)) {
    throw new Error('Creative workflow API response did not include a data envelope');
  }

  return body as ApiEnvelope<T>;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`Creative workflow API response missing ${path}`);
  }
  return value;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Creative workflow API response missing ${path}`);
  }
  return value;
}

export async function startDurableCreativeWorkflow(
  input: BackboneDurableWorkflowInput,
  options: DurableCreativeWorkflowClientOptions,
): Promise<DurableCreativeWorkflowRecord> {
  if (!options.apiKey) {
    throw new Error('Durable creative workflow execution requires an API key');
  }

  const response = await getFetch(options)(getDurableCreativeWorkflowUrl(undefined, options.apiBaseUrl), {
    method: 'POST',
    credentials: options.credentials ?? 'include',
    signal: options.signal,
    headers: buildRequestHeaders(options),
    body: JSON.stringify(buildStartDurableCreativeWorkflowRequest(input, {
      tokenType: options.tokenType,
      appSource: options.appSource,
      maxEstimatedCapacityUnits: options.maxEstimatedCapacityUnits,
      confirmCost: options.confirmCost,
      safeContentFilter: options.safeContentFilter,
    })),
  });
  const envelope = await readJsonEnvelope<{ workflow: DurableCreativeWorkflowRecord }>(response);
  const data = requireRecord(envelope.data, 'data');
  return requireRecord(data.workflow, 'data.workflow') as unknown as DurableCreativeWorkflowRecord;
}

export async function getDurableCreativeWorkflow(
  workflowId: string,
  options: DurableCreativeWorkflowClientOptions,
): Promise<DurableCreativeWorkflowRecord> {
  const response = await getFetch(options)(getDurableCreativeWorkflowUrl(workflowId, options.apiBaseUrl), {
    method: 'GET',
    credentials: options.credentials ?? 'include',
    signal: options.signal,
    headers: buildHeaders(options.apiKey),
  });
  const envelope = await readJsonEnvelope<{ workflow: DurableCreativeWorkflowRecord }>(response);
  const data = requireRecord(envelope.data, 'data');
  return requireRecord(data.workflow, 'data.workflow') as unknown as DurableCreativeWorkflowRecord;
}

export async function listDurableCreativeWorkflows(
  options: DurableCreativeWorkflowClientOptions & { limit?: number; offset?: number },
): Promise<{ workflows: DurableCreativeWorkflowRecord[]; next: number | null }> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  const query = params.toString();
  const url = `${getDurableCreativeWorkflowUrl(undefined, options.apiBaseUrl)}${query ? `?${query}` : ''}`;

  const response = await getFetch(options)(url, {
    method: 'GET',
    credentials: options.credentials ?? 'include',
    signal: options.signal,
    headers: buildHeaders(options.apiKey),
  });
  const envelope = await readJsonEnvelope<{ workflows: DurableCreativeWorkflowRecord[]; next: number | null }>(response);
  const data = requireRecord(envelope.data, 'data');
  const workflows = requireArray(data.workflows, 'data.workflows') as DurableCreativeWorkflowRecord[];
  const nextRaw = data.next;
  const next = nextRaw === null || typeof nextRaw === 'number' ? nextRaw : null;
  return { workflows, next };
}

export async function getDurableCreativeWorkflowEvents(
  workflowId: string,
  options: DurableCreativeWorkflowClientOptions,
): Promise<unknown[]> {
  const response = await getFetch(options)(getDurableCreativeWorkflowEventsUrl(workflowId, options.apiBaseUrl), {
    method: 'GET',
    credentials: options.credentials ?? 'include',
    signal: options.signal,
    headers: buildHeaders(options.apiKey),
  });
  const envelope = await readJsonEnvelope<{ events: unknown[] }>(response);
  const data = requireRecord(envelope.data, 'data');
  return requireArray(data.events, 'data.events');
}

// ---------------------------------------------------------------------------
// SSE event stream
// ---------------------------------------------------------------------------

/**
 * One decoded `text/event-stream` frame. `event` is the `event:` field name
 * if the server sent one (defaults to `'message'`); `data` is the joined
 * `data:` lines parsed as JSON when possible, otherwise the raw string.
 * `id` is the `id:` field used by the server for `Last-Event-ID` resume.
 */
export interface DurableCreativeWorkflowEventFrame {
  id?: string;
  event: string;
  data: unknown;
}

/**
 * Parse one full `text/event-stream` chunk (already split on the `\n\n`
 * boundary) into a frame. Returns `null` for keepalive comments and frames
 * that contain only blank/comment lines.
 *
 * Exported for unit tests; runtime callers should use
 * `streamDurableCreativeWorkflowEvents`.
 */
export function parseSseChunk(chunk: string): DurableCreativeWorkflowEventFrame | null {
  let id: string | undefined;
  let event = 'message';
  const dataLines: string[] = [];
  let hasNonComment = false;

  for (const rawLine of chunk.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') continue;
    if (line.startsWith(':')) continue; // comment / keepalive
    hasNonComment = true;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'id') id = value;
    else if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (!hasNonComment || dataLines.length === 0) return null;

  const rawData = dataLines.join('\n');
  let data: unknown = rawData;
  try {
    data = JSON.parse(rawData);
  } catch {
    // Non-JSON payload — surface the raw string.
  }
  return id !== undefined ? { id, event, data } : { event, data };
}

export interface StreamDurableCreativeWorkflowEventsOptions extends DurableCreativeWorkflowClientOptions {
  /** Resume from this sequence number (sent as both `Last-Event-ID` and `?after=`). */
  lastEventId?: string | number;
}

/**
 * Open a Server-Sent Events stream for a durable workflow. Yields one
 * frame per server event. Closes when the stream ends, when the caller
 * aborts via `options.signal`, or when the server emits a terminal
 * `workflow_status` event.
 *
 * EventSource cannot carry `Authorization` headers, so this uses
 * `fetch` + `ReadableStream` and does the SSE parsing inline.
 */
export async function* streamDurableCreativeWorkflowEvents(
  workflowId: string,
  options: StreamDurableCreativeWorkflowEventsOptions,
): AsyncGenerator<DurableCreativeWorkflowEventFrame> {
  const url = getDurableCreativeWorkflowEventsUrl(workflowId, options.apiBaseUrl) + '/stream'
    + (options.lastEventId !== undefined ? `?after=${encodeURIComponent(String(options.lastEventId))}` : '');

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
    ...(options.lastEventId !== undefined ? { 'Last-Event-ID': String(options.lastEventId) } : {}),
  };

  const response = await getFetch(options)(url, {
    method: 'GET',
    credentials: options.credentials ?? 'include',
    signal: options.signal,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Creative workflow stream failed (${response.status}): ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('Creative workflow stream returned no response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = findFrameBoundary(buffer);
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const frame = parseSseChunk(chunk);
        if (frame) yield frame;
        boundary = findFrameBoundary(buffer);
      }
    }
    if (buffer.length > 0) {
      const frame = parseSseChunk(buffer);
      if (frame) yield frame;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already closed */ }
  }
}

interface FrameBoundary {
  index: number;
  length: number;
}

function findFrameBoundary(buffer: string): FrameBoundary | -1 {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (lf === -1 && crlf === -1) return -1;
  if (lf !== -1 && (crlf === -1 || lf < crlf)) return { index: lf, length: 2 };
  return { index: crlf, length: 4 };
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export function getDurableCreativeWorkflowCancelUrl(
  workflowId: string,
  apiBaseUrl: string,
): string {
  return `${getDurableCreativeWorkflowUrl(workflowId, apiBaseUrl)}/cancel`;
}

export function getDurableCreativeWorkflowResumeUrl(
  workflowId: string,
  apiBaseUrl: string,
): string {
  return `${getDurableCreativeWorkflowUrl(workflowId, apiBaseUrl)}/resume`;
}

export interface CancelDurableCreativeWorkflowResult {
  workflow: DurableCreativeWorkflowRecord;
  /** True when this call flipped status to `cancelled`; false if already terminal. */
  transitioned: boolean;
}

export interface ResumeDurableCreativeWorkflowResult {
  workflow: DurableCreativeWorkflowRecord;
  /** True when the API accepted a background resume request. */
  resumed: boolean;
}

export async function cancelDurableCreativeWorkflow(
  workflowId: string,
  options: DurableCreativeWorkflowClientOptions,
): Promise<CancelDurableCreativeWorkflowResult> {
  if (!options.apiKey) {
    throw new Error('Durable creative workflow cancellation requires an API key');
  }

  const response = await getFetch(options)(getDurableCreativeWorkflowCancelUrl(workflowId, options.apiBaseUrl), {
    method: 'POST',
    credentials: options.credentials ?? 'include',
    signal: options.signal,
    headers: buildHeaders(options.apiKey),
  });
  const envelope = await readJsonEnvelope<{ workflow: DurableCreativeWorkflowRecord; transitioned: boolean }>(response);
  const data = requireRecord(envelope.data, 'data');
  const workflow = requireRecord(data.workflow, 'data.workflow') as unknown as DurableCreativeWorkflowRecord;
  const transitioned = typeof data.transitioned === 'boolean' ? data.transitioned : false;
  return { workflow, transitioned };
}

export async function resumeDurableCreativeWorkflow(
  workflowId: string,
  options: DurableCreativeWorkflowClientOptions,
): Promise<ResumeDurableCreativeWorkflowResult> {
  if (!options.apiKey) {
    throw new Error('Durable creative workflow resume requires an API key');
  }

  const body = {
    ...(options.tokenType ? { token_type: options.tokenType } : {}),
    ...(options.appSource ? { app_source: options.appSource } : {}),
  };
  const response = await getFetch(options)(getDurableCreativeWorkflowResumeUrl(workflowId, options.apiBaseUrl), {
    method: 'POST',
    credentials: options.credentials ?? 'include',
    signal: options.signal,
    headers: buildHeaders(options.apiKey),
    ...(Object.keys(body).length > 0 ? { body: JSON.stringify(body) } : {}),
  });
  const envelope = await readJsonEnvelope<{ workflow: DurableCreativeWorkflowRecord; resumed: boolean }>(response);
  const data = requireRecord(envelope.data, 'data');
  const workflow = requireRecord(data.workflow, 'data.workflow') as unknown as DurableCreativeWorkflowRecord;
  const resumed = typeof data.resumed === 'boolean' ? data.resumed : false;
  return { workflow, resumed };
}
