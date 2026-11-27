/**
 * Secret redaction for RunRecords.
 *
 * Shared best-effort credential filtering for replay writers and readers.
 * This is not anonymization: prompts, responses, and tool data remain
 * part of a replay. Callers must avoid including sensitive information.
 *
 * Pure function — no side effects, no I/O. Safe to run in hot paths.
 */

import type { RunRecord } from './types.js';

const REDACTION_PLACEHOLDER = '[REDACTED]';

const CREDENTIAL_SEP = '(?:[ _-]|%5f|%20)?';
const CREDENTIAL_LABELS = [
  `api${CREDENTIAL_SEP}key`,
  `access${CREDENTIAL_SEP}token`,
  `refresh${CREDENTIAL_SEP}token`,
  `id${CREDENTIAL_SEP}token`,
  `session${CREDENTIAL_SEP}token`,
  `auth${CREDENTIAL_SEP}token`,
  `bearer${CREDENTIAL_SEP}token`,
  `csrf${CREDENTIAL_SEP}token`,
  `security${CREDENTIAL_SEP}token`,
  `client${CREDENTIAL_SEP}token`,
  `api${CREDENTIAL_SEP}token`,
  `access${CREDENTIAL_SEP}key(?:${CREDENTIAL_SEP}id)?`,
  `secret${CREDENTIAL_SEP}key`,
  `private${CREDENTIAL_SEP}key`,
  `signing${CREDENTIAL_SEP}key`,
  `client${CREDENTIAL_SEP}secret`,
  'password',
  'passwd',
  'passphrase',
  'pwd',
  'secret',
  'jwt',
  'jwe',
  'token',
].join('|');

const CREDENTIAL_VALUE_PATTERN =
  '("(?:[^"\\\\\\r\\n]|\\\\.)*"|\'(?:[^\'\\\\\\r\\n]|\\\\.)*\'|`[^`\\r\\n]*`|(?:[^\\s"\'`<>{}\\[\\],;&%]|%(?!26))+)';

const LABELLED_CREDENTIAL = new RegExp(
  `((?:\\b|_|%5f)(?:${CREDENTIAL_LABELS})["']?\\s*(?::|=|%3a|%3d|\\bis\\b)\\s*)${CREDENTIAL_VALUE_PATTERN}`,
  'gi',
);

const COOKIE_ASSIGNMENT = new RegExp(
  `((?:\\b|_|%5f)(?:set${CREDENTIAL_SEP})?cookie["']?\\s*(?::|=|%3a|%3d)\\s*)${CREDENTIAL_VALUE_PATTERN}`,
  'gi',
);

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUES = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

function isBasicAuthBase64(candidate: string): boolean {
  if (candidate.length < 8 || candidate.length % 4 !== 0) return false;
  const pad = candidate.endsWith('==') ? 2 : candidate.endsWith('=') ? 1 : 0;
  const dataLen = candidate.length - pad;
  for (let i = 0; i < dataLen; i += 1) {
    const code = candidate.charCodeAt(i);
    if (code >= 128 || BASE64_VALUES[code] < 0) return false;
  }
  if (pad === 2 && (BASE64_VALUES[candidate.charCodeAt(dataLen - 1)] & 0x0f) !== 0) return false;
  if (pad === 1 && (BASE64_VALUES[candidate.charCodeAt(dataLen - 1)] & 0x03) !== 0) return false;

  const byteLen = (candidate.length / 4) * 3 - pad;
  const bytes = new Uint8Array(byteLen);
  let outIdx = 0;
  for (let i = 0; i < candidate.length; i += 4) {
    const c0 = BASE64_VALUES[candidate.charCodeAt(i)];
    const c1 = BASE64_VALUES[candidate.charCodeAt(i + 1)];
    const c2 = i + 2 < dataLen ? BASE64_VALUES[candidate.charCodeAt(i + 2)] : 0;
    const c3 = i + 3 < dataLen ? BASE64_VALUES[candidate.charCodeAt(i + 3)] : 0;
    bytes[outIdx++] = (c0 << 2) | (c1 >> 4);
    if (outIdx < byteLen) bytes[outIdx++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    if (outIdx < byteLen) bytes[outIdx++] = ((c2 & 0x03) << 6) | c3;
  }

  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  return /^[\x21-\x7e]+:[\x20-\x7e]+$/.test(decoded) || /^[\x21-\x7e]{4,}:$/.test(decoded);
}

/**
 * Keys that always get redacted regardless of value. Lowercase comparison.
 * Includes both Sogni-specific (apiKey, walletAuth) and generic auth
 * (authorization, cookie, sessionId, accessToken, ...) names.
 */
const SECRET_KEY_PATTERNS: ReadonlyArray<RegExp> = [
  /api[_-]?key$/i,
  /access[_-]?token$/i,
  /id[_-]?token$/i,
  /refresh[_-]?token$/i,
  /bearer[_-]?token$/i,
  /(?:session|auth|csrf|security|client|api)[_-]?token$/i,
  /^token$/i,
  /authorization$/i,
  /^cookie$/i,
  /^set[_-]?cookie$/i,
  /session[_-]?(?:id|token|key|secret|cookie)$/i,
  /password$/i,
  /secret$/i,
  /(?:access|secret)[_-]?key(?:[_-]?id)?$/i,
  /private[_-]?key$/i,
  /signing[_-]?key$/i,
  /^(?:jwt|jwe|pwd|passwd|passphrase)$/i,
  /(?:^|[_-])(?:jwt|jwe|pwd|passwd|passphrase)$/i,
  /^pem$/i,
  /walletauth$/i,
  /^x-?api-?key$/i,
  /^credentials?$/i,
  /^(?:x-amz|x-goog)-(?:signature|credential|security-token)$/i,
  /^awsaccesskeyid$/i,
  /^(?:signature|sig|key-pair-id)$/i,
];

/**
 * Substrings inside string values that suggest secrets. Used for
 * value-side scrubbing (e.g. Authorization header value embedded in a
 * free-form note).
 */
const VALUE_SCRUBBERS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // Standard auth headers (plain or JSON-quoted)
  {
    pattern: /(Authorization["']?\s*:\s*["']?)(Bearer|Basic)\s+[^\s"',}`]+/gi,
    replacement: `$1$2 ${REDACTION_PLACEHOLDER}`,
  },
  // HTTP Cookie / Set-Cookie headers (line-delimited or quoted header strings)
  {
    pattern: /(^|[\r\n;])(\s*(?:Set-)?Cookie\s*:\s*)[^\r\n]+/gi,
    replacement: `$1$2${REDACTION_PLACEHOLDER}`,
  },
  {
    pattern: /(")(\s*(?:Set-)?Cookie\s*:\s*)[^"\r\n]+(")/gi,
    replacement: `$1$2${REDACTION_PLACEHOLDER}$3`,
  },
  {
    pattern: /(')(\s*(?:Set-)?Cookie\s*:\s*)[^'\r\n]+(')/gi,
    replacement: `$1$2${REDACTION_PLACEHOLDER}$3`,
  },
  // Standalone bearer tokens
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
    replacement: `Bearer ${REDACTION_PLACEHOLDER}`,
  },
  // Signed S3 / GCS / CloudFront URLs: keep host/path, filter signature & token params
  {
    pattern:
      /((?:[?&]|%(?:26|3f))(?:X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|AWSAccessKeyId|X-Goog-Signature|X-Goog-Credential|X-Goog-Security-Token|Signature|sig|Policy|Key-Pair-Id)(?:=|%3d))(?:[^&\s"'`%]|%(?!26))+/gi,
    replacement: `$1${REDACTION_PLACEHOLDER}`,
  },
  // OpenAI / Anthropic style API keys
  { pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, replacement: REDACTION_PLACEHOLDER },
  // An incomplete private-key block is filtered through the end of the text.
  { pattern: /-----BEGIN [A-Z ]{0,64}PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]{0,64}PRIVATE KEY-----|$)/g, replacement: REDACTION_PLACEHOLDER },
];

/** True when the key (case-insensitive) matches a known secret pattern. */
function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((re) => re.test(key));
}

function replaceQuotedOrRawAssignment(_match: string, prefix: string, credential: string): string {
  const quote = /^["'`]/.test(credential) ? credential[0] : '';
  return `${prefix}${quote}${REDACTION_PLACEHOLDER}${quote}`;
}

/** Apply value-side scrubbers to a string. Returns the same string when
 *  no pattern matched (preserves identity for short-circuit chains). */
export function redactStringValue(value: string): string {
  let out = value;
  for (const { pattern, replacement } of VALUE_SCRUBBERS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }
  out = out.replace(
    /\b(Basic\s+)([A-Za-z0-9+/]{8,}={0,2})(?![A-Za-z0-9+/=])/gi,
    (match, prefix: string, token: string) =>
      isBasicAuthBase64(token) ? `${prefix}${REDACTION_PLACEHOLDER}` : match,
  );
  // Consume each candidate once, including malformed ones, before checking
  // its segments. Repeated token prefixes must not trigger suffix rescans.
  out = out.replace(/\beyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)*/g, (candidate) => {
    const segments = candidate.split('.');
    return segments.length >= 3 && segments[1].length >= 10 && segments[2].length >= 10
      ? REDACTION_PLACEHOLDER : candidate;
  });
  COOKIE_ASSIGNMENT.lastIndex = 0;
  out = out.replace(COOKIE_ASSIGNMENT, replaceQuotedOrRawAssignment);
  // UUIDs alone are also ordinary run/job ids. Filter labelled values,
  // preserving quotes around embedded JSON and configuration values.
  LABELLED_CREDENTIAL.lastIndex = 0;
  return out.replace(LABELLED_CREDENTIAL, replaceQuotedOrRawAssignment);
}

/**
 * Recursively redact a JSON-ish value. Returns a new structure; never
 * mutates the input. Handles primitives, arrays, plain records, and
 * preserves null. Circular references are not expected (RunRecord is
 * JSON-serializable) are filtered without revisiting an ancestor.
 */
export function redactPayload(
  value: unknown,
  depth = 0,
): unknown {
  return redactValue(value, depth, new WeakSet<object>());
}

function redactValue(value: unknown, depth: number, ancestors: WeakSet<object>): unknown {
  if (depth > 32) return REDACTION_PLACEHOLDER;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactStringValue(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    if (ancestors.has(value)) return REDACTION_PLACEHOLDER;
    ancestors.add(value);
    try {
      if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1, ancestors));
      // fromEntries creates own data properties even for __proto__.
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(
        ([key, val]) => {
          const shouldRedactKey =
            isSecretKey(key) || (key.toLowerCase() === 'session' && typeof val === 'string');
          return [key, shouldRedactKey ? REDACTION_PLACEHOLDER : redactValue(val, depth + 1, ancestors)];
        },
      ));
    } finally {
      ancestors.delete(value);
    }
  }
  // Unknown primitive (bigint, symbol, function) — coerce to redacted
  // string rather than risk surfacing it.
  return REDACTION_PLACEHOLDER;
}

/**
 * Apply redaction to a RunRecord. Returns a new record with
 * `redacted: true`. Idempotent — running this twice produces the same
 * output (no values left to scrub after the first pass).
 */
export function redactRunRecord(record: RunRecord): RunRecord {
  return {
    ...redactPayload(record) as RunRecord,
    redacted: true,
  };
}

export { REDACTION_PLACEHOLDER };
