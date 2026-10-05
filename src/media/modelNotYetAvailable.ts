/**
 * Model not yet available (Supernet error 4104).
 *
 * The socket refuses a model that is not yet available on its network, for
 * example a model released to staging but held in production, on jobs and on
 * price estimates. Its message names models to try instead, so it is surfaced
 * verbatim. Retrying cannot succeed until the server makes the model available.
 */

export const MODEL_NOT_YET_AVAILABLE_ERROR = 'model_not_yet_available';

/** Error code the Supernet uses for the refusal. */
export const MODEL_NOT_YET_AVAILABLE_ERROR_CODE = 4104;

/** `code` of the typed `SogniModelNotYetAvailableError`. */
const TYPED_ERROR_CODE = 'MODEL_NOT_YET_AVAILABLE';

/** Used only when the refusal arrived without the socket's message. */
export const MODEL_NOT_YET_AVAILABLE_FALLBACK_MESSAGE = 'This model is not yet available.';

export interface ModelNotYetAvailablePayload {
  error: typeof MODEL_NOT_YET_AVAILABLE_ERROR;
  errorCode: typeof MODEL_NOT_YET_AVAILABLE_ERROR_CODE;
  /** The socket's message, verbatim. */
  message: string;
  retryPolicy: 'manual_user_confirmation';
  nextAction: 'wait_for_user';
  /** The refused model, when the socket named it. */
  modelId?: string;
}

export function modelNotYetAvailablePayload(
  message?: string | null,
  modelId?: string | null,
): ModelNotYetAvailablePayload {
  return {
    error: MODEL_NOT_YET_AVAILABLE_ERROR,
    errorCode: MODEL_NOT_YET_AVAILABLE_ERROR_CODE,
    message: message?.trim() ? message : MODEL_NOT_YET_AVAILABLE_FALLBACK_MESSAGE,
    retryPolicy: 'manual_user_confirmation',
    nextAction: 'wait_for_user',
    ...(modelId ? { modelId } : {}),
  };
}

function isNotYetAvailableCode(value: unknown): boolean {
  if (typeof value === 'number') return value === MODEL_NOT_YET_AVAILABLE_ERROR_CODE;
  if (typeof value === 'string') return value.trim() === String(MODEL_NOT_YET_AVAILABLE_ERROR_CODE);
  return false;
}

function recordMessage(record: Record<string, unknown>): string | null {
  for (const key of ['message', 'error_message', 'errorMessage']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

interface NotYetAvailableSignal {
  message: string | null;
  modelId: string | null;
}

// Finds the record that carries 4104: the SDK ErrorData ({ code: 4104, message }),
// the raw socket jobError ({ error: '4104', error_message, modelId }), the REST
// ApiError body ({ errorCode: 4104, message }), or a wrapper error that keeps one
// of them in `details`, `originalError`, `payload`, or `cause`. Its message is
// the socket's own wording.
function findNotYetAvailableSignal(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): NotYetAvailableSignal | null {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  if (seen.has(value)) return null;
  seen.add(value);

  const record = value as Record<string, unknown>;
  const nestedValues = value instanceof Error
    ? [(value as { cause?: unknown }).cause, record.details, record.originalError, record.payload]
    : Object.values(record);
  // Prefer the innermost record that carries a message: a wrapper's own
  // message is not the socket's.
  let partial: NotYetAvailableSignal | null = null;
  for (const nested of nestedValues) {
    const signal = findNotYetAvailableSignal(nested, seen, depth + 1);
    if (signal?.message) return signal;
    partial = partial ?? signal;
  }

  const modelId = typeof record.modelId === 'string' && record.modelId ? record.modelId : null;
  if (
    isNotYetAvailableCode(record.code)
    || isNotYetAvailableCode(record.errorCode)
    || isNotYetAvailableCode(record.originalCode)
    || isNotYetAvailableCode(record.error)
    || record.error === MODEL_NOT_YET_AVAILABLE_ERROR
    || record.code === TYPED_ERROR_CODE
  ) {
    return { message: recordMessage(record), modelId: modelId ?? partial?.modelId ?? null };
  }
  return partial;
}

const NOT_YET_AVAILABLE_TEXT = /\bmodel_not_yet_available\b|\bmodel is not yet available\b/i;

/**
 * True when free text carries the 4104 refusal. The socket's price estimate
 * endpoint answers with the plain-text message (HTTP 400) and no code.
 */
export function textIndicatesModelNotYetAvailable(text: string): boolean {
  return NOT_YET_AVAILABLE_TEXT.test(text);
}

// The socket's sentence without a wrapper's prefix, e.g. "All 1 video
// generation jobs failed: This model is not yet available, ...".
function notYetAvailableSentence(text: string): string {
  const match = NOT_YET_AVAILABLE_TEXT.exec(text);
  if (!match) return text;
  const before = text.slice(0, match.index);
  const start = Math.max(before.lastIndexOf(': '), before.lastIndexOf('. '));
  return (start >= 0 ? text.slice(start + 2) : text).trim();
}

function errorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') return recordMessage(error as Record<string, unknown>) ?? '';
  return '';
}

/**
 * Maps any error carrying the 4104 refusal to the typed, non-retryable payload
 * with the socket's message verbatim; returns null for every other error.
 */
export function modelNotYetAvailablePayloadFromError(
  error: unknown,
): ModelNotYetAvailablePayload | null {
  if (error === null || error === undefined) return null;
  if (isNotYetAvailableCode(error)) return modelNotYetAvailablePayload();
  const signal = findNotYetAvailableSignal(error, new WeakSet<object>(), 0);
  if (signal) return modelNotYetAvailablePayload(signal.message, signal.modelId);
  const text = errorText(error);
  return textIndicatesModelNotYetAvailable(text)
    ? modelNotYetAvailablePayload(notYetAvailableSentence(text))
    : null;
}
