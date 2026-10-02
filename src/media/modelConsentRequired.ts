/**
 * Model consent refusal (Supernet error 4103).
 *
 * Seedance 2.5 Uncensored (`seedance-2-5-spicy`) renders only after the account
 * accepts a one-time likeness and consent agreement in a Sogni app. Until then
 * the socket refuses every job for that model with error 4103 and a
 * `consentRequired` object naming the agreement. Retrying cannot succeed, and no
 * SDK, agent, or API-key session may accept the agreement on the user's behalf:
 * the user has to accept it in the Sogni app.
 */

export const MODEL_CONSENT_REQUIRED_ERROR = 'model_consent_required';

/** Error code the Supernet uses for the refusal. */
export const MODEL_CONSENT_REQUIRED_ERROR_CODE = 4103;

export const MODEL_CONSENT_REQUIRED_MESSAGE =
  'Seedance 2.5 Uncensored requires a one-time likeness and consent agreement. Review and accept it in the Sogni app, then try again.';

/** The agreement named by a 4103 refusal, e.g. `{ key: 'seedance-2-5-spicy', version: 1 }`. */
export interface ModelConsentRequirement {
  key: string;
  version: number;
  modelId?: string;
}

export interface ModelConsentRequiredPayload {
  error: typeof MODEL_CONSENT_REQUIRED_ERROR;
  errorCode: typeof MODEL_CONSENT_REQUIRED_ERROR_CODE;
  message: typeof MODEL_CONSENT_REQUIRED_MESSAGE;
  retryPolicy: 'manual_user_confirmation';
  nextAction: 'wait_for_user';
  consentRequired?: ModelConsentRequirement;
  technicalError?: string;
}

export function modelConsentRequiredPayload(
  consentRequired?: ModelConsentRequirement | null,
  technicalError?: string,
): ModelConsentRequiredPayload {
  return {
    error: MODEL_CONSENT_REQUIRED_ERROR,
    errorCode: MODEL_CONSENT_REQUIRED_ERROR_CODE,
    message: MODEL_CONSENT_REQUIRED_MESSAGE,
    retryPolicy: 'manual_user_confirmation',
    nextAction: 'wait_for_user',
    ...(consentRequired ? { consentRequired: { ...consentRequired } } : {}),
    ...(technicalError ? { technicalError: technicalError.slice(0, 500) } : {}),
  };
}

function asConsentRequirement(value: unknown): ModelConsentRequirement | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.key !== 'string' || !record.key) return null;
  const version = typeof record.version === 'number' ? record.version : Number(record.version);
  return {
    key: record.key,
    version: Number.isFinite(version) ? version : 0,
    ...(typeof record.modelId === 'string' && record.modelId ? { modelId: record.modelId } : {}),
  };
}

function isConsentCode(value: unknown): boolean {
  if (typeof value === 'number') return value === MODEL_CONSENT_REQUIRED_ERROR_CODE;
  if (typeof value === 'string') return value.trim() === String(MODEL_CONSENT_REQUIRED_ERROR_CODE);
  return false;
}

interface ConsentSignal {
  found: boolean;
  consentRequired: ModelConsentRequirement | null;
}

// Walks the SDK ErrorData ({ code: 4103, consentRequired }), the raw socket
// jobError ({ error: '4103', consentRequired }), and wrapper errors that keep
// either one in `details`, `originalError`, or `cause`.
function findConsentSignal(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): ConsentSignal {
  const none: ConsentSignal = { found: false, consentRequired: null };
  if (!value || typeof value !== 'object' || depth > 6) return none;
  if (seen.has(value)) return none;
  seen.add(value);

  const record = value as Record<string, unknown>;
  const consentRequired = asConsentRequirement(record.consentRequired);
  if (consentRequired) return { found: true, consentRequired };

  let found =
    isConsentCode(record.code)
    || isConsentCode(record.errorCode)
    || isConsentCode(record.originalCode)
    || isConsentCode(record.error)
    || record.error === MODEL_CONSENT_REQUIRED_ERROR
    || record.code === MODEL_CONSENT_REQUIRED_ERROR;

  const nestedValues = value instanceof Error
    ? [(value as { cause?: unknown }).cause, record.details, record.originalError, record.payload]
    : Object.values(record);
  for (const nested of nestedValues) {
    const signal = findConsentSignal(nested, seen, depth + 1);
    if (signal.consentRequired) return { found: true, consentRequired: signal.consentRequired };
    found = found || signal.found;
  }
  return { found, consentRequired: null };
}

function errorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    for (const key of ['message', 'error_message', 'errorMessage']) {
      if (typeof record[key] === 'string') return record[key] as string;
    }
  }
  return '';
}

/**
 * True when free text carries the 4103 refusal, e.g. an SDK message that lost
 * its structured fields on the way to the caller.
 */
export function textIndicatesModelConsentRequired(text: string): boolean {
  return (
    /\bmodel_consent_required\b|\bmodelConsentRequired\b/.test(text)
    || /\blikeness\s+and\s+consent\s+agreement\b/i.test(text)
  );
}

/**
 * Maps any error carrying the 4103 refusal to the typed, non-retryable payload;
 * returns null for every other error. The payload keeps the socket's
 * `consentRequired` so apps can open the agreement.
 */
export function modelConsentRequiredPayloadFromError(
  error: unknown,
): ModelConsentRequiredPayload | null {
  if (error === null || error === undefined) return null;
  if (isConsentCode(error)) return modelConsentRequiredPayload();

  const signal = findConsentSignal(error, new WeakSet<object>(), 0);
  const text = errorText(error);
  if (!signal.found && !textIndicatesModelConsentRequired(text)) return null;
  return modelConsentRequiredPayload(signal.consentRequired, text || undefined);
}
