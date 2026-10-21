/**
 * Model consent refusal (Supernet error 4103).
 *
 * Seedance 2.5 Uncensored (`seedance-2-5-uncensored`) and Seedance 2.0 Mini
 * Uncensored (`seedance-2-0-mini-uncensored`) render only after the account
 * accepts a one-time likeness and consent agreement in a Sogni app. Both share
 * one agreement (key `seedance-2-5-uncensored`). Until the account accepts it
 * the socket refuses every job for either model with error 4103 and a
 * `consentRequired` object naming the agreement and the refused model. Retrying
 * cannot succeed, and no SDK, agent, or API-key session may accept the agreement
 * on the user's behalf: the user has to accept it in the Sogni app.
 *
 * The same agreement (same key and version) also lets regular Seedance 2.5
 * (`seedance-2-5`) take photos and clips of real people. That model never
 * refuses with 4103: without the agreement it keeps the vendor's real-person
 * refusal, whose socket sentence links the agreement at
 * https://app.sogni.ai/account/model-consents/seedance-2-5 (see
 * seedanceSocketContentRefusalMessage).
 */
import { isSeedanceMiniUncensoredVideoModelId } from '../utils/seedanceModelIds.js';


export const MODEL_CONSENT_REQUIRED_ERROR = 'model_consent_required';

/** Error code the Supernet uses for the refusal. */
export const MODEL_CONSENT_REQUIRED_ERROR_CODE = 4103;

export const MODEL_CONSENT_REQUIRED_MESSAGE =
  'Seedance 2.5 Uncensored requires a one-time likeness and consent agreement. Review and accept it in the Sogni app, then try again.';

/** The same refusal when the refused job asked for Seedance 2.0 Mini Uncensored. */
export const SEEDANCE_MINI_UNCENSORED_CONSENT_REQUIRED_MESSAGE =
  'Seedance 2.0 Mini Uncensored requires a one-time likeness and consent agreement. Review and accept it in the Sogni app, then try again.';

/**
 * The agreement named by a 4103 refusal, e.g.
 * `{ key: 'seedance-2-5-uncensored', version: 2, modelId: 'seedance-2-0-mini-uncensored' }`.
 */
export interface ModelConsentRequirement {
  key: string;
  version: number;
  modelId?: string;
}

export interface ModelConsentRequiredPayload {
  error: typeof MODEL_CONSENT_REQUIRED_ERROR;
  errorCode: typeof MODEL_CONSENT_REQUIRED_ERROR_CODE;
  message: typeof MODEL_CONSENT_REQUIRED_MESSAGE | typeof SEEDANCE_MINI_UNCENSORED_CONSENT_REQUIRED_MESSAGE;
  retryPolicy: 'manual_user_confirmation';
  nextAction: 'wait_for_user';
  consentRequired?: ModelConsentRequirement;
  technicalError?: string;
  /** Direct browser destination; never contains API keys or accepts on the user's behalf. */
  consentUrl?: string;
  /** Human/agent recovery guidance, separate from the existing error message. */
  consentInstructions?: string;
  accountUsername?: string;
}

// The socket names the refused model in consentRequired.modelId; the shared
// agreement key is the same for both uncensored Seedance models. A refusal that
// arrives as text only names the model in the socket's own sentence.
function consentRequiredModelIdFor(
  consentRequired: ModelConsentRequirement | null | undefined,
  text: string | undefined,
): 'seedance-2-5-uncensored' | 'seedance-2-0-mini-uncensored' {
  const namesMiniUncensored = consentRequired?.modelId
    ? isSeedanceMiniUncensoredVideoModelId(consentRequired.modelId)
    : /\bSeedance 2\.0 Mini Uncensored requires\b/i.test(text ?? '');
  return namesMiniUncensored ? 'seedance-2-0-mini-uncensored' : 'seedance-2-5-uncensored';
}

export function modelConsentRequiredPayload(
  consentRequired?: ModelConsentRequirement | null,
  technicalError?: string,
  accountUsername?: string,
): ModelConsentRequiredPayload {
  const modelId = consentRequiredModelIdFor(consentRequired, technicalError);
  const username = accountUsername?.trim();
  const destination = new URL(`https://app.sogni.ai/account/model-consents/${modelId}`);
  if (username) destination.searchParams.set('account', username);
  const consentUrl = destination.href;
  return {
    error: MODEL_CONSENT_REQUIRED_ERROR,
    errorCode: MODEL_CONSENT_REQUIRED_ERROR_CODE,
    message: modelId === 'seedance-2-0-mini-uncensored'
      ? SEEDANCE_MINI_UNCENSORED_CONSENT_REQUIRED_MESSAGE : MODEL_CONSENT_REQUIRED_MESSAGE,
    retryPolicy: 'manual_user_confirmation',
    nextAction: 'wait_for_user',
    consentUrl,
    consentInstructions: `Open ${consentUrl}, sign in with the same Sogni account as your agent or API key${username ? ` (@${username})` : ''}, review the agreement, check "I agree", and select "Continue". Then return to your agent or terminal and retry your original request. One agreement covers both Uncensored Seedance models. Nothing was charged for the refused request.`,
    ...(username ? { accountUsername: username } : {}),
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
  accountUsername?: string,
): ModelConsentRequiredPayload | null {
  if (error === null || error === undefined) return null;
  if (isConsentCode(error)) return modelConsentRequiredPayload(undefined, undefined, accountUsername);

  const signal = findConsentSignal(error, new WeakSet<object>(), 0);
  const text = errorText(error);
  if (!signal.found && !textIndicatesModelConsentRequired(text)) return null;
  return modelConsentRequiredPayload(signal.consentRequired, text || undefined, accountUsername);
}
