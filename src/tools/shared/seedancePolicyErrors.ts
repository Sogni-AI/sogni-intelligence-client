/**
 * Seedance-specific terminal policy & generation-failure error taxonomy.
 *
 * Pure logic — used by browser chat, hosted chat in sogni-api, and the skill
 * runtime so all three speak the same Seedance error contract.
 */
import {
  modelConsentRequiredPayloadFromError,
  modelNotYetAvailablePayloadFromError,
  vendorModelPremiumPayloadFromError,
  type ModelConsentRequiredPayload,
  type ModelNotYetAvailablePayload,
  type VendorModelPremiumRequiredPayload,
} from '../../media/index.js';

export const SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE =
  'InputImageSensitiveContentDetected.PrivacyInformation';

export const SEEDANCE_REAL_PERSON_PRIVACY_MESSAGE =
  "No problem — Seedance just has a content rule that keeps it from animating photos of real people directly, but we've got a couple of great ways to bring this to life! I can give the people a fun, clearly non-photographic makeover — anime, cartoon, claymation, LEGO, or bobblehead, or simply hide the faces — and then run Seedance on that. Or, if you'd like to keep the original look, I can switch to LTX 2.3, which animates your photo directly (it just won't use Seedance). Which sounds best — a stylized spin, or LTX 2.3?";

/**
 * Structured recovery for the real-person privacy rejection: stylize the source
 * image (so it is no longer a photographic depiction of a real person), then
 * resubmit the same video. Consumers render the options as action chips and as
 * a clear edit-then-resubmit flow. The edit itself routes to GPT Image 2 for
 * storyboard sheets and Qwen Image Edit 2511 otherwise through the existing
 * edit_image model routing — this descriptor intentionally does not pin a model.
 */
export interface SeedanceStylizeRecoveryOption {
  id: 'anime' | 'cartoon' | 'lego' | 'bobblehead' | 'claymation' | 'hide_faces';
  /** Short chip label. */
  label: string;
  /** edit_image instruction that stylizes the people while keeping the scene. */
  editInstruction: string;
}

export const SEEDANCE_STYLIZE_RECOVERY_OPTIONS: readonly SeedanceStylizeRecoveryOption[] = [
  {
    id: 'anime',
    label: 'Anime version',
    editInstruction:
      'Redraw every person in the image as a clearly non-photographic 2D anime character, keeping their pose, outfit, and the overall scene composition; do not preserve a realistic face or skin texture.',
  },
  {
    id: 'cartoon',
    label: 'Cartoon version',
    editInstruction:
      'Redraw every person in the image as a clearly non-photographic cartoon character with simplified facial features, keeping their pose, outfit colors, and the overall scene composition.',
  },
  {
    id: 'lego',
    label: 'LEGO version',
    editInstruction:
      'Rebuild every person in the image as a toy-like LEGO minifigure, keeping their pose, outfit colors, and the overall scene composition; avoid realistic human faces and skin.',
  },
  {
    id: 'bobblehead',
    label: 'Bobblehead version',
    editInstruction:
      'Turn every person in the image into a cute oversized-head bobblehead figurine with toy-like simplified features, keeping the outfit and overall scene composition but avoiding a realistic human likeness.',
  },
  {
    id: 'claymation',
    label: 'Claymation version',
    editInstruction:
      'Re-render every person in the image as a stop-motion claymation figure with visible clay texture and simplified faces, keeping their pose, outfit, and the overall scene composition.',
  },
  {
    id: 'hide_faces',
    label: 'Just hide the faces',
    editInstruction:
      'Obscure every human face in the image (for example with a tasteful mask, helmet, shadow, or soft blur) while keeping the people, their pose, outfit, and the overall scene composition intact.',
  },
];

export interface SeedanceStylizeRecovery {
  kind: 'stylize_source_then_resubmit';
  options: readonly SeedanceStylizeRecoveryOption[];
  /** The tool to re-run with the stylized image once it is ready. */
  resubmitToolName: 'generate_video';
}

export const SEEDANCE_STYLIZE_RECOVERY: SeedanceStylizeRecovery = {
  kind: 'stylize_source_then_resubmit',
  options: SEEDANCE_STYLIZE_RECOVERY_OPTIONS,
  resubmitToolName: 'generate_video',
};

export const SEEDANCE_PROVIDER_CONTENT_POLICY_MESSAGE =
  "Seedance's content check didn't pass this one, so no video came back this time. We can adjust the prompt or try a different look and give it another go.";

export const SEEDANCE_VENDOR_GENERATION_FAILED_MESSAGE =
  "Seedance hit a snag partway through this one, so no media was generated. The provider did not return a specific reason — a quick retry usually clears it up. If it happens again, you can report the issue right from this message.";
export const SEEDANCE_VENDOR_TIMEOUT_MESSAGE =
  "Seedance took a bit too long on this one and timed out, so no media was generated. A quick retry usually does the trick; if it times out again, you can report the issue right from this message.";

export const SEEDANCE_REFERENCE_AUDIO_TOO_LONG_MESSAGE =
  "That reference audio is a little longer than this Seedance mode allows. Trim it to the mode's limit (or pick a shorter clip) and we'll give it another go.";

export interface SeedanceTerminalPolicyPayload {
  error: 'seedance_input_image_privacy_policy' | 'seedance_content_policy';
  message: typeof SEEDANCE_REAL_PERSON_PRIVACY_MESSAGE | typeof SEEDANCE_PROVIDER_CONTENT_POLICY_MESSAGE;
  retryPolicy: 'manual_user_confirmation';
  nextAction: 'wait_for_user';
  vendorCode?: 5061;
  vendorErrorCode: typeof SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE | string;
  /**
   * Present only for the real-person privacy rejection: the typed
   * stylize-the-source-then-resubmit recovery the UI renders as action chips.
   */
  recovery?: SeedanceStylizeRecovery;
}

export interface SeedanceTerminalGenerationFailurePayload {
  error: 'seedance_generation_failed' | 'seedance_reference_audio_too_long';
  message: string;
  retryPolicy: 'manual_user_confirmation';
  nextAction: 'wait_for_user';
  reportIssue?: true;
  reportIssueReason?: string;
  vendorError?: string;
  vendorErrorCode?: string;
  maxAudioDurationSeconds?: number;
}

export class SeedanceTerminalPolicyError extends Error {
  readonly payload: SeedanceTerminalPolicyPayload;

  constructor(payload: SeedanceTerminalPolicyPayload) {
    super(payload.message);
    this.name = 'SeedanceTerminalPolicyError';
    this.payload = payload;
  }
}

function collectErrorText(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    const cause = (value as { cause?: unknown }).cause;
    return [
      value.name,
      value.message,
      cause ? collectErrorText(cause, seen) : '',
    ].filter(Boolean).join(' ');
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '';
  seen.add(value);

  const record = value as Record<string, unknown>;
  const nested = Object.values(record)
    .map((nestedValue) => collectErrorText(nestedValue, seen))
    .filter(Boolean)
    .join(' ');

  try {
    return `${JSON.stringify(value)} ${nested}`.trim();
  } catch {
    return nested;
  }
}

function hasVendorCode5061(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return value === 5061;
  if (typeof value === 'string') return value.trim() === '5061';
  if (value instanceof Error) {
    const cause = (value as { cause?: unknown }).cause;
    return cause ? hasVendorCode5061(cause, seen) : false;
  }
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  const record = value as Record<string, unknown>;
  if (record.code === 5061 || record.code === '5061') return true;
  return Object.values(record).some((nestedValue) =>
    hasVendorCode5061(nestedValue, seen),
  );
}

function textHasSeedanceRealPersonPrivacySignal(text: string): boolean {
  return (
    /\bmay\s+contain\s+(?:a\s+)?real\s+person\b/i.test(text) ||
    /\bcontains?\s+(?:a\s+)?real\s+person\b/i.test(text) ||
    /\bphotographic\s+depictions?\s+of\s+real\s+people\b/i.test(text)
  );
}

function textHasSeedanceContentPolicySignal(text: string): boolean {
  return (
    /\bcontent[_\s-]?policy\b/i.test(text) ||
    /\bmoderation\b/i.test(text) ||
    /\bsafety\s+(?:system|review|violation|violations)\b/i.test(text) ||
    /\bsafety[_\s-]?violations?\b/i.test(text) ||
    /\bSensitiveContentDetected\b/i.test(text) ||
    /\bsensitive\s+content\b/i.test(text) ||
    /\bnsfw\b/i.test(text)
  );
}

function vendorErrorCodeFromText(text: string): string | null {
  const jsonCode = text.match(/"code"\s*:\s*"([^"]+)"/i)?.[1];
  return jsonCode ?? null;
}

function seedanceAudioDurationLimitFromText(text: string): number | null {
  const match = text.match(
    /\baudio\s+duration\b[\s\S]{0,180}\b(?:less than or equal to|<=|no more than|maximum(?:\s+of)?)\s+(\d+(?:\.\d+)?)\b/i,
  );
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * BytePlus / Seedance returns terse `InvalidParameter` messages embedded in a
 * `400 {"error":{...,"message":"…"}}` blob. Pull the inner message so we can
 * surface it to the user instead of swallowing it as a generic
 * "no specific reason" failure.
 */
function seedanceInvalidParameterMessageFromText(text: string): string | null {
  if (!text) return null;
  // Capture both `"message":"…"` and `'message':'…'` shapes.
  const match = text.match(
    /"(?:message|Message)"\s*:\s*"((?:[^"\\]|\\.)*)"/,
  );
  if (!match?.[1]) return null;
  let parsed = match[1];
  try {
    parsed = JSON.parse(`"${parsed}"`);
  } catch {
    /* leave raw — escapes will read fine in plain English */
  }
  parsed = parsed.replace(/\s*Request id:\s*[A-Za-z0-9._-]+/i, '').trim();
  return parsed.length > 0 ? parsed : null;
}

interface SeedanceInvalidParameterShape {
  /** The raw vendor-facing message (already stripped of request ids). */
  vendorMessage: string;
  /** A plain-language summary the chat UI can show to the user. */
  userMessage: string;
}

const SEEDANCE_FRAME_REFERENCE_CONFLICT_PATTERN =
  /\bfirst\/last frame content cannot be mixed with reference media content\b/i;

// sogni-socket rejects any request that combines first/last-frame parameter
// images with reference media (audio, video, or extra image references)
// pre-flight. The dispatcher does not silently adapt — the prompt format
// differs between the two BytePlus modes, so collapsing one into the other
// would leave the prompt mismatched with the dispatch and degrade results.
// The socket's rejection text already names both modes and the recommended
// next steps, so we treat it as the canonical user-facing explanation.
const SEEDANCE_SOCKET_MIXED_MODE_PATTERN =
  /\bSeedance rejects requests that combine first\/last-frame images with reference media\b/i;

/**
 * Map a recognised Seedance `InvalidParameter` message onto a user-facing
 * explanation. Falls back to surfacing the vendor text verbatim.
 */
function shapeSeedanceInvalidParameterMessage(
  vendorMessage: string,
): SeedanceInvalidParameterShape {
  if (SEEDANCE_SOCKET_MIXED_MODE_PATTERN.test(vendorMessage)) {
    // The socket's pre-flight rejection already lists both modes and the
    // recommended next steps; pass it through verbatim.
    return { vendorMessage, userMessage: vendorMessage };
  }
  if (SEEDANCE_FRAME_REFERENCE_CONFLICT_PATTERN.test(vendorMessage)) {
    return {
      vendorMessage,
      userMessage:
        "Seedance can't mix a locked first/last-frame image with audio, video, or extra image references in one request. Send that image as a reference instead of a frame anchor, or drop the extra audio/video reference, and we'll try again.",
    };
  }
  return {
    vendorMessage,
    userMessage: `Seedance rejected the request: ${vendorMessage}`,
  };
}

export function seedanceTerminalPolicyPayloadFromError(
  error: unknown,
): SeedanceTerminalPolicyPayload | null {
  if (error instanceof SeedanceTerminalPolicyError) return error.payload;

  const text = collectErrorText(error);
  const hasVendorPrivacyCode = text.includes(SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE);
  const hasRealPersonPrivacySignal = textHasSeedanceRealPersonPrivacySignal(text);
  const hasContentPolicySignal = textHasSeedanceContentPolicySignal(text);
  if (!hasVendorPrivacyCode && !hasRealPersonPrivacySignal && !hasContentPolicySignal) return null;

  const isSeedanceError = /\bseedance\b/i.test(text);
  const hasExpectedVendorCode = hasVendorCode5061(error) || /\b5061\b/.test(text);
  if (!isSeedanceError && !hasExpectedVendorCode) return null;

  if (!hasVendorPrivacyCode && !hasRealPersonPrivacySignal) {
    return {
      error: 'seedance_content_policy',
      message: SEEDANCE_PROVIDER_CONTENT_POLICY_MESSAGE,
      retryPolicy: 'manual_user_confirmation',
      nextAction: 'wait_for_user',
      ...(hasExpectedVendorCode ? { vendorCode: 5061 } : {}),
      vendorErrorCode: vendorErrorCodeFromText(text) ?? 'SEEDANCE_CONTENT_POLICY',
    };
  }

  return {
    error: 'seedance_input_image_privacy_policy',
    message: SEEDANCE_REAL_PERSON_PRIVACY_MESSAGE,
    retryPolicy: 'manual_user_confirmation',
    nextAction: 'wait_for_user',
    ...(hasExpectedVendorCode ? { vendorCode: 5061 } : {}),
    vendorErrorCode: SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE,
    recovery: SEEDANCE_STYLIZE_RECOVERY,
  };
}

export function seedanceTerminalPolicyErrorFromError(
  error: unknown,
): SeedanceTerminalPolicyError | null {
  const payload = seedanceTerminalPolicyPayloadFromError(error);
  return payload ? new SeedanceTerminalPolicyError(payload) : null;
}

export function seedanceTerminalGenerationFailurePayloadFromError(
  error: unknown,
):
  | SeedanceTerminalGenerationFailurePayload
  | VendorModelPremiumRequiredPayload
  | ModelConsentRequiredPayload
  | ModelNotYetAvailablePayload
  | null {
  // Seedance 2.5 Uncensored and Seedance 2.0 Mini Uncensored refuse with 4103
  // until the account accepts their shared likeness and consent agreement in
  // the Sogni app; never a retryable failure.
  const consentPayload = modelConsentRequiredPayloadFromError(error);
  if (consentPayload) return consentPayload;

  // 4104: the network holds the model. The socket's message names models to
  // try instead; never a retryable failure.
  const notYetAvailablePayload = modelNotYetAvailablePayloadFromError(error);
  if (notYetAvailablePayload) return notYetAvailablePayload;

  const premiumPayload = vendorModelPremiumPayloadFromError(error);
  if (premiumPayload) return premiumPayload;

  const text = collectErrorText(error);
  if (
    !/\bAll\s+\d+\s+(?:video generation|sound-to-video|video-to-video)\s+jobs failed\b/i.test(text)
    && !/\bVendor task\b[\s\S]{0,140}\bstatus=failed\b/i.test(text)
    && !/\bVendor (?:job|dispatch) failed\b/i.test(text)
    && !SEEDANCE_SOCKET_MIXED_MODE_PATTERN.test(text)
  ) {
    return null;
  }

  if (SEEDANCE_SOCKET_MIXED_MODE_PATTERN.test(text)) {
    // Surface the socket's pre-flight rejection verbatim — it already names
    // both modes and the recommended next steps. Trim to the start of the
    // mode-naming sentence so any upstream wrapper prose doesn't bury it.
    const start = text.search(/\bSeedance rejects requests that combine first\/last-frame images with reference media\b/i);
    const message = start >= 0 ? text.slice(start, start + 1500).trim() : text.slice(0, 1500).trim();
    return {
      error: 'seedance_generation_failed',
      message,
      retryPolicy: 'manual_user_confirmation',
      nextAction: 'wait_for_user',
      vendorErrorCode: 'SEEDANCE_MIXED_MODE_REJECTED',
      vendorError: text.slice(0, 500),
    };
  }
  const audioDurationLimit = seedanceAudioDurationLimitFromText(text);
  if (audioDurationLimit !== null) {
    return {
      error: 'seedance_reference_audio_too_long',
      message: `That reference audio is a bit long — this Seedance mode allows up to ${audioDurationLimit}s. Trim it to ${audioDurationLimit}s or shorter and we'll give it another go.`,
      retryPolicy: 'manual_user_confirmation',
      nextAction: 'wait_for_user',
      vendorErrorCode: 'InvalidParameter',
      maxAudioDurationSeconds: audioDurationLimit,
      ...(text ? { vendorError: text.slice(0, 500) } : {}),
    };
  }
  const invalidParameterMessage = seedanceInvalidParameterMessageFromText(text);
  if (invalidParameterMessage) {
    if (textHasSeedanceRealPersonPrivacySignal(invalidParameterMessage)) {
      return {
        error: 'seedance_generation_failed',
        message: SEEDANCE_VENDOR_GENERATION_FAILED_MESSAGE,
        retryPolicy: 'manual_user_confirmation',
        nextAction: 'wait_for_user',
        reportIssue: true,
        reportIssueReason: 'Seedance provider job failed after starting with a privacy-related provider detail.',
        vendorErrorCode: text.includes(SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE)
          ? SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE
          : 'SEEDANCE_PRIVACY_DETAIL',
        vendorError: text.slice(0, 500),
      };
    }
    const shaped = shapeSeedanceInvalidParameterMessage(invalidParameterMessage);
    return {
      error: 'seedance_generation_failed',
      message: shaped.userMessage,
      retryPolicy: 'manual_user_confirmation',
      nextAction: 'wait_for_user',
      vendorErrorCode: 'InvalidParameter',
      vendorError: shaped.vendorMessage.slice(0, 500),
    };
  }
  if (/\b(?:timed?\s*out|timeout|deadline\s+exceeded)\b/i.test(text)) {
    return {
      error: 'seedance_generation_failed',
      message: SEEDANCE_VENDOR_TIMEOUT_MESSAGE,
      retryPolicy: 'manual_user_confirmation',
      nextAction: 'wait_for_user',
      reportIssue: true,
      reportIssueReason: 'Seedance provider job timed out after starting.',
      vendorErrorCode: 'PROVIDER_TIMEOUT',
      ...(text ? { vendorError: text.slice(0, 500) } : {}),
    };
  }
  return {
    error: 'seedance_generation_failed',
    message: SEEDANCE_VENDOR_GENERATION_FAILED_MESSAGE,
    retryPolicy: 'manual_user_confirmation',
    nextAction: 'wait_for_user',
    reportIssue: true,
    reportIssueReason: 'Seedance provider job failed after starting without a specific provider reason.',
    ...(text ? { vendorError: text.slice(0, 500) } : {}),
  };
}
