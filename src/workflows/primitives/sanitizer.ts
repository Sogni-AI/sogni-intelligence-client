/**
 * Canonical untrusted-input sanitizer for prompt interpolation.
 *
 * Two implementations were drifting in the v2 ecosystem before this
 * commit:
 *
 *  - `sogni-api-v2/src/service/wf-primitives.service.ts` stripped only
 *    C0 + DEL control chars but did NOT strip delimiter forgery — an
 *    attacker who wrote `</UNTRUSTED_USER_INPUT>...inject...` into a
 *    free-form field could break out of the untrusted block.
 *  - `sogni-creative-agent-v2/src/workflows/primitives/sanitizer.ts`
 *    stripped both control chars AND a vocabulary of chat-template /
 *    role markers / delimiter tags, exposed a `SanitizeField`-tag-driven
 *    `sanitizeUntrustedString(raw, field) => SanitizeResult` plus a
 *    `wrapAsUntrustedUserInput(parts: string[])` joiner and per-field
 *    `MAX_*` caps — but shipped as a private local copy.
 *
 * This module is the canonical SUPERSET of both surfaces. It publishes:
 *
 *  - The string-returning, throw-on-overflow primitives the v2 dispatch
 *    path expects: `sanitizeUntrustedString(input, opts?) => string` and
 *    `wrapAsUntrustedUserInput(field, content) => string` (XML block).
 *  - The field-tag-driven surface the creative-agent planner / classifier
 *    / storyboard primitives expect: `sanitizeUntrustedString(raw, field)
 *    => SanitizeResult`, `wrapAsUntrustedUserInput(parts) => string`, the
 *    `SanitizeField` / `SanitizeResult` types, the `MAX_*` per-field caps,
 *    and the `UNTRUSTED_OPEN` / `UNTRUSTED_CLOSE` delimiter constants.
 *
 * Both `sanitizeUntrustedString` and `wrapAsUntrustedUserInput` are
 * overloaded so each historical call shape resolves to its original
 * behaviour. The second argument discriminates `sanitizeUntrustedString`
 * (an options object => string form; a `SanitizeField` string => result
 * form); the first argument discriminates `wrapAsUntrustedUserInput`
 * (a string `field` => XML form; a string array `parts` => joined form).
 * Existing consumers (sogni-api's URL/rubric primitives are unaffected;
 * any caller of the string/XML forms keeps its types) are not broken.
 *
 * Both creative-agent and sogni-api should import from here and delete
 * their local copies.
 *
 * Naming convention follows the rest of `workflows/primitives/*` — the
 * helpers are pure and stateless; LLM IO lives in the consumer.
 *
 * Audit follow-up: 2026-05-21.
 */

/**
 * Typed error thrown when `sanitizeUntrustedString` exceeds the
 * caller-supplied length cap. The message names the field + cap but
 * never echoes the offending content (so log scraping doesn't leak it).
 * Dispatchers SHOULD map this to a `WORKFLOW_VALIDATION_FAILED` envelope.
 */
export class SanitizerError extends Error {
  readonly code: 'input_too_long';
  readonly field?: string;
  readonly maxLength: number;
  readonly actualLength: number;

  constructor(args: {
    code: 'input_too_long';
    maxLength: number;
    actualLength: number;
    field?: string;
  }) {
    const fieldClause = args.field ? ` "${args.field}"` : '';
    super(
      `sanitizer: input${fieldClause} exceeds ${args.maxLength} characters (got ${args.actualLength})`,
    );
    this.name = 'SanitizerError';
    this.code = args.code;
    this.maxLength = args.maxLength;
    this.actualLength = args.actualLength;
    if (args.field !== undefined) {
      this.field = args.field;
    }
  }
}

// The four strip patterns that are quadratic under String.prototype.replace,
// named so `stripPattern` can apply them in linear time (see
// LINEAR_STRIP_SCANS below).
const UNTRUSTED_USER_INPUT_OPEN_PATTERN = /<UNTRUSTED_USER_INPUT(?:\s[^>]*)?>/gi;
const UNTRUSTED_USER_BRIEF_OPEN_PATTERN = /<UNTRUSTED_USER_BRIEF(?:\s[^>]*)?>/gi;
const SYSTEM_BLOCK_PATTERN = /<system>[\s\S]*?<\/system>/gi;
const TOOL_CALL_BLOCK_PATTERN = /<tool_call>[\s\S]*?<\/tool_call>/gi;

/**
 * Untrusted-block delimiter tags this sanitizer knows about. Both the
 * `UNTRUSTED_USER_INPUT` form (used by sogni-api) and the
 * `UNTRUSTED_USER_BRIEF` form (used by sogni-creative-agent storyboard
 * expansion) are stripped so neither vocabulary can be forged from the
 * inside.
 */
const DELIMITER_PATTERNS: readonly RegExp[] = [
  UNTRUSTED_USER_INPUT_OPEN_PATTERN,
  /<\/UNTRUSTED_USER_INPUT>/gi,
  UNTRUSTED_USER_BRIEF_OPEN_PATTERN,
  /<\/UNTRUSTED_USER_BRIEF>/gi,
];

/**
 * Chat-template / role-marker tokens that have no legitimate place in
 * a user field. Same vocabulary as
 * `sogni-creative-agent-v2/src/workflows/primitives/expandStoryboardScript.ts`
 * keeps the two paths speaking the same hard-strip contract.
 */
const CHAT_TEMPLATE_PATTERNS: readonly RegExp[] = [
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<\|user\|>/gi,
  /<\|system\|>/gi,
  /<\|assistant\|>/gi,
  /<\|tool\|>/gi,
  /<\|tool_call\|>/gi,
  /<\|begin▁of▁sentence\|>/gi,
  /<\|end▁of▁sentence\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
  SYSTEM_BLOCK_PATTERN,
  TOOL_CALL_BLOCK_PATTERN,
];

/**
 * Patterns the sanitizer ALWAYS strips, in order. Exposed as a frozen
 * tuple so consumers can audit the list (and add to it via a wrapper)
 * without re-importing the per-pattern arrays.
 *
 * Concatenation order: chat-template/role markers first (least
 * ambiguous), then delimiter forgeries. Control-char stripping happens
 * separately in `sanitizeUntrustedString` because it's a character-class
 * regex applied byte-by-byte, not a tag matcher.
 *
 * Four of these patterns (the `<system>` and `<tool_call>` blocks and
 * the two attribute-bearing delimiter openings) take quadratic time
 * under `String.prototype.replace` when the text holds many openings
 * without a terminator. `sanitizeUntrustedString` applies them in linear
 * time with identical output; apply this list yourself only to input of
 * bounded length.
 */
export const HARD_STRIP_PATTERNS: readonly RegExp[] = Object.freeze([
  ...CHAT_TEMPLATE_PATTERNS,
  ...DELIMITER_PATTERNS,
]);

/**
 * Linear-time stand-ins for the four quadratic entries above. Each
 * original scans to the end of the text for its terminator (a closing
 * tag, or the `>` that ends an opening with attributes) and fails when
 * there is none, once per opening. A long run of unterminated openings,
 * such as a pasted chat message, therefore costs O(n²) in a call that
 * runs on every turn.
 *
 * A stand-in starts matching wherever its original could. When the
 * terminator is missing it consumes the rest of the text in one pass
 * instead of failing, and {@link stripPattern} hands that text back
 * unchanged. That is exactly what the original does: if no terminator
 * follows one opening, none follows any later opening either, so the
 * original leaves the rest of the text alone. Group 1 is non-empty
 * precisely when the original pattern matches, so the output is
 * identical for every input.
 */
const LINEAR_STRIP_SCANS: ReadonlyMap<RegExp, RegExp> = new Map([
  [SYSTEM_BLOCK_PATTERN, /<system>(?:[\s\S]*?(<\/system>)|[\s\S]*)/gi],
  [TOOL_CALL_BLOCK_PATTERN, /<tool_call>(?:[\s\S]*?(<\/tool_call>)|[\s\S]*)/gi],
  [UNTRUSTED_USER_INPUT_OPEN_PATTERN, /<UNTRUSTED_USER_INPUT(?:\s[^>]*)?(>?)/gi],
  [UNTRUSTED_USER_BRIEF_OPEN_PATTERN, /<UNTRUSTED_USER_BRIEF(?:\s[^>]*)?(>?)/gi],
]);

/**
 * `text.replace(pattern, '')` for any pattern in
 * {@link HARD_STRIP_PATTERNS}, in linear time for the four entries
 * that would otherwise be quadratic.
 */
function stripPattern(text: string, pattern: RegExp): string {
  const scan = LINEAR_STRIP_SCANS.get(pattern);
  if (!scan) return text.replace(pattern, '');
  return text.replace(scan, (match: string, terminator: string | undefined) => (terminator ? '' : match));
}

// ---------------------------------------------------------------------------
// Field-tag surface (creative-agent planner / classifier / storyboard)
// ---------------------------------------------------------------------------
//
// The string/throw primitives above are the dispatch-path API. The
// surface below is the field-tag-driven API the creative-agent planner,
// shadow classifier, and storyboard primitive consume: a per-field length
// cap keyed by a `SanitizeField` tag, a result object (`{ ok, value?,
// reason?, field }`) instead of a throw, and the literal
// `<UNTRUSTED_USER_INPUT>` delimiter constants those callers hard-code
// into their system prompts. Both surfaces live in this one canonical
// module so the ecosystem has a single sanitizer of record.

/**
 * Delimiter markers for the field-tag `wrapAsUntrustedUserInput(parts)`
 * form. Stable so the system prompts produced by callers can hard-code
 * the same strings. The string/XML `wrapAsUntrustedUserInput(field,
 * content)` form emits the same `UNTRUSTED_USER_INPUT` tag name with an
 * attribute; both are stripped on the way in by the delimiter-forgery
 * patterns above.
 */
export const UNTRUSTED_OPEN = '<UNTRUSTED_USER_INPUT>';
export const UNTRUSTED_CLOSE = '</UNTRUSTED_USER_INPUT>';

/**
 * Per-field length caps. Generous enough for every legitimate creative
 * brief / planner field observed in the workflow fixtures while still
 * capping a hostile producer's leverage in the LLM context. A field that
 * exceeds its cap is rejected (the caller falls back to a safe default),
 * not silently truncated. Exported as named constants so callers can
 * compose their own caps.
 */
export const MAX_BRIEF_LENGTH = 8000;
export const MAX_STYLE_LENGTH = 200;
export const MAX_ASPECT_RATIO_LENGTH = 32;
export const MAX_NOTES_LENGTH = 1000;
export const MAX_LATEST_USER_TEXT_LENGTH = 12_000;
export const MAX_PRIOR_USER_TEXT_LENGTH = 3600;
export const MAX_PRIOR_ASSISTANT_TEXT_LENGTH = 6000;
export const MAX_CURRENT_MESSAGE_LENGTH = 12_000;
export const MAX_RECENT_TURN_LENGTH = 6000;
export const MAX_CONVERSATION_SUMMARY_LENGTH = 6000;

/**
 * Field tags recognised by the field-tag `sanitizeUntrustedString(raw,
 * field)` form. The tag picks the length cap and is echoed back in the
 * result for logging.
 */
export type SanitizeField =
  | 'brief'
  | 'style'
  | 'aspectRatio'
  | 'notes'
  | 'latestUserText'
  | 'priorUserText'
  | 'priorAssistantText'
  | 'currentMessage'
  | 'recentTurn'
  | 'conversationSummary';

const FIELD_CAPS: Record<SanitizeField, number> = {
  brief: MAX_BRIEF_LENGTH,
  style: MAX_STYLE_LENGTH,
  aspectRatio: MAX_ASPECT_RATIO_LENGTH,
  notes: MAX_NOTES_LENGTH,
  latestUserText: MAX_LATEST_USER_TEXT_LENGTH,
  priorUserText: MAX_PRIOR_USER_TEXT_LENGTH,
  priorAssistantText: MAX_PRIOR_ASSISTANT_TEXT_LENGTH,
  currentMessage: MAX_CURRENT_MESSAGE_LENGTH,
  recentTurn: MAX_RECENT_TURN_LENGTH,
  conversationSummary: MAX_CONVERSATION_SUMMARY_LENGTH,
};

const SANITIZE_FIELD_VALUES = new Set<SanitizeField>([
  'brief',
  'style',
  'aspectRatio',
  'notes',
  'latestUserText',
  'priorUserText',
  'priorAssistantText',
  'currentMessage',
  'recentTurn',
  'conversationSummary',
]);

function isSanitizeField(value: unknown): value is SanitizeField {
  return typeof value === 'string' && SANITIZE_FIELD_VALUES.has(value as SanitizeField);
}

/**
 * Result of the field-tag `sanitizeUntrustedString(raw, field)` form. On
 * success `{ ok: true, value, field }`; on failure `{ ok: false, reason,
 * field }` with `value` omitted. `reason` is developer-facing (logs,
 * telemetry) and MUST NOT be surfaced to the LLM or the end user.
 */
export interface SanitizeResult {
  ok: boolean;
  value?: string;
  /** Developer-facing reason; never surfaced to the LLM. */
  reason?: 'too-long' | 'forbidden-control-character' | 'not-a-string';
  field: SanitizeField;
}

/**
 * Reject (do NOT strip) input carrying null bytes or non-whitespace
 * control characters (C0 / DEL / C1). Whitespace (`\t \n \v \f \r`) is
 * allowed. The field-tag form rejects so the caller sees an auditable
 * reason; the string/throw form above strips control bytes instead (it
 * keeps a narrower class and never rejects on them). Both behaviours are
 * intentional and preserved.
 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;

/**
 * Field-tag implementation. Validates + normalises a single untrusted
 * string against the cap for `field`. Pure — never mutates inputs, never
 * throws, never logs. Strips the same chat-template / delimiter-forgery
 * vocabulary as {@link HARD_STRIP_PATTERNS}, trims, then applies the
 * per-field cap.
 */
function sanitizeFieldTagged(raw: unknown, field: SanitizeField): SanitizeResult {
  if (typeof raw !== 'string') {
    return { ok: false, field, reason: 'not-a-string' };
  }
  if (FORBIDDEN_CONTROL_CHARS.test(raw)) {
    return { ok: false, field, reason: 'forbidden-control-character' };
  }
  let cleaned = raw;
  for (const pattern of HARD_STRIP_PATTERNS) {
    cleaned = stripPattern(cleaned, pattern);
  }
  cleaned = cleaned.trim();
  if (cleaned.length > FIELD_CAPS[field]) {
    return { ok: false, field, reason: 'too-long' };
  }
  return { ok: true, field, value: cleaned };
}

// C0 control chars (0x00-0x1F) minus the whitespace ones we keep:
// \t (0x09), \n (0x0A), \r (0x0D). Plus DEL (0x7F). C1 chars
// (0x80-0x9F) excluded — they're routinely produced by legitimate
// non-Latin text encodings; if a caller wants to drop them too they
// can call a stricter wrapper.
//
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Options accepted by {@link sanitizeUntrustedString}.
 */
export interface SanitizeUntrustedStringOptions {
  /**
   * When `true` (default), strip delimiter-forgery tags so an attacker
   * can't close the untrusted block early. Set to `false` only when
   * the caller will wrap the string in a non-XML delimiter that
   * doesn't suffer from forgery (rare — leave default).
   */
  stripDelimiters?: boolean;
  /**
   * Maximum character length. When exceeded, throws
   * {@link SanitizerError} so the dispatcher can return a structured
   * `WORKFLOW_VALIDATION_FAILED` envelope. Length is checked AFTER
   * stripping so trailing forgery padding can't sneak past a length
   * gate.
   */
  maxLength?: number;
  /**
   * Optional field name. Surfaced in the {@link SanitizerError} message
   * so logs name which field tripped the cap, but never echoed.
   */
  field?: string;
}

/**
 * String/throw form (dispatch path): strip C0 + DEL control chars (keep
 * `\n \r \t`), strip chat-template / role markers, and (by default) strip
 * delimiter-forgery tags so an attacker can't break out of
 * `<UNTRUSTED_USER_INPUT>` / `<UNTRUSTED_USER_BRIEF>`. Returns the
 * sanitized string; throws {@link SanitizerError} when `maxLength` is set
 * and the post-strip length still exceeds it.
 */
export function sanitizeUntrustedString(
  input: string,
  opts?: SanitizeUntrustedStringOptions,
): string;
/**
 * Field-tag form (creative-agent planner / classifier / storyboard):
 * validate + normalise `raw` against the per-field cap for `field`.
 * Returns a {@link SanitizeResult} (`{ ok, value?, reason?, field }`)
 * instead of throwing — the caller substitutes a safe default on failure.
 */
export function sanitizeUntrustedString(
  raw: unknown,
  field: SanitizeField,
): SanitizeResult;
export function sanitizeUntrustedString(
  input: unknown,
  optsOrField?: SanitizeUntrustedStringOptions | SanitizeField,
): string | SanitizeResult {
  // Discriminate the two call shapes on the second argument: a
  // `SanitizeField` string selects the field-tag/result form; anything
  // else (an options object or nothing) selects the string/throw form.
  if (isSanitizeField(optsOrField)) {
    return sanitizeFieldTagged(input, optsOrField);
  }

  if (typeof input !== 'string') {
    throw new TypeError('sanitizeUntrustedString: input must be a string');
  }
  const opts = optsOrField;
  const stripDelimiters = opts?.stripDelimiters ?? true;

  // Drop non-whitespace control bytes first so a delimiter pattern
  // can't be split across a stray \x01.
  let cleaned = input.replace(CONTROL_CHARS_RE, '');

  for (const pattern of CHAT_TEMPLATE_PATTERNS) {
    cleaned = stripPattern(cleaned, pattern);
  }
  if (stripDelimiters) {
    for (const pattern of DELIMITER_PATTERNS) {
      cleaned = stripPattern(cleaned, pattern);
    }
  }

  if (opts?.maxLength !== undefined && cleaned.length > opts.maxLength) {
    throw new SanitizerError({
      code: 'input_too_long',
      maxLength: opts.maxLength,
      actualLength: cleaned.length,
      ...(opts.field !== undefined ? { field: opts.field } : {}),
    });
  }

  return cleaned;
}

/**
 * XML-safe escape for an attribute value. Escapes `&`, `<`, `>`, `"`,
 * and `'` so a hostile field name (or value) can't break out of the
 * attribute. Caller passes the raw value; the result is suitable for
 * dropping into a double-quoted attribute. Pure.
 */
export function escapeAttribute(value: string): string {
  if (typeof value !== 'string') {
    throw new TypeError('escapeAttribute: value must be a string');
  }
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape XML content (text node). Only `&`, `<`, `>` need escaping
 * here; attribute-only quote escapes are unnecessary inside a text
 * node and would actively hurt readability for the LLM consumer.
 */
function escapeContent(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * XML form: wrap a sanitized content string in a canonical
 * `<UNTRUSTED_USER_INPUT field="...">...</UNTRUSTED_USER_INPUT>` block.
 *
 * - `field` is escaped via {@link escapeAttribute} so a hostile field
 *   name (e.g. `brief" onmouseover="..."`) can't inject extra
 *   attributes.
 * - `content` is escaped as XML text. The caller is expected to have
 *   already passed `content` through {@link sanitizeUntrustedString};
 *   double-stripping here would be redundant.
 *
 * Returns the formatted block string. Pure.
 */
export function wrapAsUntrustedUserInput(field: string, content: string): string;
/**
 * Parts form (creative-agent planner / classifier / storyboard): join one
 * or more already-sanitised parts inside `UNTRUSTED_OPEN` ...
 * `UNTRUSTED_CLOSE`, each part on its own line. The caller is expected to
 * have ALREADY run {@link sanitizeUntrustedString} (field-tag form) on
 * every embedded user value — this form does NOT re-sanitise or escape.
 */
export function wrapAsUntrustedUserInput(parts: readonly string[]): string;
export function wrapAsUntrustedUserInput(
  fieldOrParts: string | readonly string[],
  content?: string,
): string {
  // Discriminate on the first argument: a string array selects the parts
  // form; a string `field` selects the XML form.
  if (Array.isArray(fieldOrParts)) {
    return [UNTRUSTED_OPEN, ...fieldOrParts, UNTRUSTED_CLOSE].join('\n');
  }

  const field = fieldOrParts as string;
  if (typeof field !== 'string' || field.length === 0) {
    throw new TypeError('wrapAsUntrustedUserInput: field must be a non-empty string');
  }
  if (typeof content !== 'string') {
    throw new TypeError('wrapAsUntrustedUserInput: content must be a string');
  }
  return `<UNTRUSTED_USER_INPUT field="${escapeAttribute(field)}">${escapeContent(content)}</UNTRUSTED_USER_INPUT>`;
}
