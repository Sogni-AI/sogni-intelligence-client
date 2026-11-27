/**
 * Pure helpers for the validate_with_rubric primitive.
 *
 * The primitive runs an LLM judge over an artifact (text or image) and
 * a list of rubric items. It returns ToolErr when validation fails, so
 * a workflow stage with `condition: { type: 'if_error_in', stageId:
 * 'validate_X' }` will fire on failure and re-run the prior render
 * stage with the judge's feedback baked into its prompt.
 *
 * This file is pure — no LLM calls — so a regression can pin the
 * rubric-prompt construction and the PASS/FAIL parsing without
 * spinning up a model.
 */

import { escapeAttribute, sanitizeUntrustedString } from './sanitizer.js';

export interface ValidateRubricInput {
  /** Free-text criteria, one per line. Each becomes a separate gate. */
  rubric: readonly string[];
  /** What is being validated. Used for prompt framing. */
  artifactKind: 'text' | 'image' | 'video';
  /**
   * The artifact contents inline (for text) or a public URL (for
   * image / video — the LLM judge fetches the URL).
   */
  artifactInline?: string;
  artifactUrl?: string;
  /** Optional human-facing description of what good output looks like. */
  successDescription?: string;
}

export interface RubricJudgement {
  pass: boolean;
  failedCriteria: string[];
  notes: string;
  /** Suggested guidance for the retry render stage. */
  suggestedRetryNotes: string;
}

const PASS_TOKEN = '__PASS__';
const FAIL_TOKEN = '__FAIL__';

const THINK_BLOCK_SCAN = /<think>(?:[\s\S]*?(<\/think>)|[\s\S]*)/gi;

function sanitizeRubricField(raw: string): string {
  let out = sanitizeUntrustedString(raw);
  while (/__PASS__|__FAIL__/i.test(out)) {
    out = out.replace(/__PASS__/gi, '[PASS]').replace(/__FAIL__/gi, '[FAIL]');
  }
  return out;
}

/**
 * Build the system + user prompt the judge LLM will see. The judge is
 * forced to emit either `__PASS__` or `__FAIL__: <reasons>` so the
 * parser can deterministically classify the output.
 */
export function buildRubricPrompts(input: ValidateRubricInput): {
  system: string;
  user: string;
} {
  const kind: ValidateRubricInput['artifactKind'] =
    input.artifactKind === 'text' || input.artifactKind === 'image' || input.artifactKind === 'video'
      ? input.artifactKind
      : 'image';
  const cleanedSuccess = input.successDescription
    ? sanitizeRubricField(input.successDescription).replace(/[\r\n]+/g, ' ').trim()
    : '';
  const successLine = cleanedSuccess
    ? `Good output looks like: ${cleanedSuccess}`
    : 'Good output satisfies every rubric item completely.';
  const rubricList = input.rubric
    .map((line, i) => `${i + 1}. ${sanitizeRubricField(line).replace(/[\r\n]+/g, ' ').trim()}`)
    .join('\n');

  const system = [
    `You are a strict creative quality judge for ${kind} artifacts.`,
    successLine,
    'Evaluate the artifact against EACH rubric item one at a time.',
    `If ALL items pass, your ENTIRE response must be exactly: ${PASS_TOKEN}`,
    `Otherwise, your ENTIRE response must start with: ${FAIL_TOKEN}: `,
    'followed by a short comma-separated list of the failed item numbers and',
    'a one-sentence summary of what the next render attempt should change.',
    `Example fail response: ${FAIL_TOKEN}: items 1, 3 — subject identity is `
    + 'inconsistent across panels; next attempt must lock the face shape from '
    + 'the reference photo.',
    'Do not output anything else. No preamble. No analysis.',
  ].join('\n');

  let artifactBlock: string;
  if (kind === 'text') {
    const inlineText = sanitizeRubricField(input.artifactInline ?? '')
      .replace(/<\s*(\/?)\s*text-artifact\b/gi, '&lt;$1text-artifact')
      .trim();
    artifactBlock = `<text-artifact>\n${inlineText}\n</text-artifact>`;
  } else if (input.artifactUrl) {
    const safeSrc = escapeAttribute(
      sanitizeRubricField(input.artifactUrl).replace(/[\r\n\t]+/g, ''),
    );
    artifactBlock = `<${kind}-artifact src="${safeSrc}"/>`;
  } else {
    artifactBlock = '<artifact missing/>';
  }

  const user = [
    'Rubric:',
    rubricList,
    '',
    'Artifact to evaluate:',
    artifactBlock,
  ].join('\n');

  return { system, user };
}

/**
 * Parse the judge's response. Returns a structured RubricJudgement.
 * Recognises a leading `__PASS__` or `__FAIL__: …` after stripping any
 * reasoning `<think>` blocks, and accepts a fallback pass only when
 * `__PASS__` appears as a standalone verdict rather than quoted inside
 * commentary. Items mentioned by number in a fail response are mapped
 * back to rubric strings.
 */
export function parseJudgeResponse(
  raw: string,
  rubric: readonly string[],
): RubricJudgement {
  const cleaned = (raw ?? '')
    .replace(THINK_BLOCK_SCAN, (match, close: string | undefined) => (close ? '' : match))
    .trim();
  if (cleaned.startsWith(PASS_TOKEN) && !cleaned.includes(FAIL_TOKEN)) {
    return { pass: true, failedCriteria: [], notes: cleaned, suggestedRetryNotes: '' };
  }
  if (cleaned.startsWith(FAIL_TOKEN)) {
    const afterToken = cleaned.slice(FAIL_TOKEN.length).replace(/^\s*:?\s*/, '');
    return {
      pass: false,
      failedCriteria: extractFailedCriteria(afterToken, rubric),
      notes: afterToken,
      suggestedRetryNotes: afterToken,
    };
  }
  if (
    !cleaned.includes(FAIL_TOKEN) &&
    (/^(?:sure[!.,]?\s+|ok(?:ay)?[!.,]?\s+|(?:final\s+)?verdict\s*:\s*|result\s*:\s*)?__PASS__\.?$/i.test(cleaned) ||
      (/^\s*(?:(?:final\s+)?verdict\s*:\s*)?__PASS__\.?\s*$/m.test(cleaned) &&
        /__PASS__\.?$/.test(cleaned) &&
        !/\b(?:fail(?:ed|s|ure)?|cannot|not|said|quote[ds]?|instruction|ignore)\b/i.test(cleaned)))
  ) {
    return { pass: true, failedCriteria: [], notes: cleaned, suggestedRetryNotes: '' };
  }
  return {
    pass: false,
    failedCriteria: extractFailedCriteria(cleaned, rubric),
    notes: cleaned || 'Judge returned an empty or unparseable response.',
    suggestedRetryNotes: cleaned || 'Re-render with more attention to the rubric items above.',
  };
}

function extractFailedCriteria(text: string, rubric: readonly string[]): string[] {
  const matches: string[] = [];
  const numberRegex = /\bitems?\s+([\d,\s]+)/i;
  const m = text.match(numberRegex);
  if (m) {
    const nums = m[1]
      .split(',')
      .map((s) => s.trim())
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= rubric.length);
    for (const n of nums) matches.push(rubric[n - 1]);
  }
  return matches;
}

export { PASS_TOKEN, FAIL_TOKEN };

// ---------------------------------------------------------------------------
// Static URL host validation for artifactUrl
// ---------------------------------------------------------------------------

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::',
  '::1',
]);

const INTERNAL_EXACT_HOSTS: ReadonlySet<string> = new Set([
  'metadata',
  'metadata.goog',
  'metadata.google.internal',
  'instance-data',
]);

const INTERNAL_HOST_SUFFIXES: readonly string[] = [
  '.localhost',
  '.local',
  '.internal',
  '.cluster.local',
  '.consul',
  '.localdomain',
  '.home.arpa',
];

// eslint-disable-next-line no-control-regex
const URL_CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/**
 * Synchronous static URL check for the `artifactUrl` argument of
 * `wf:validate_with_rubric` (and other remote media reference helpers).
 * Returns `{ ok: false, reason }` for URLs targeting internal,
 * cloud-metadata, link-local, or loopback hosts.
 *
 * Pure and synchronous: performs string and URL inspection only (no DNS
 * resolution or network I/O). Server-side HTTP fetchers MUST also
 * validate resolved DNS addresses and redirect targets at connection
 * time before opening a socket.
 */
export function assertArtifactUrlIsSafe(
  url: string,
): { ok: true } | { ok: false; reason: string } {
  if (typeof url !== 'string' || URL_CONTROL_CHARS.test(url)) {
    return { ok: false, reason: 'artifactUrl is not a valid URL' };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'artifactUrl is not a valid URL' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      reason: `artifactUrl protocol "${parsed.protocol}" is not supported (http/https only)`,
    };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'artifactUrl must not contain userinfo credentials' };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) return { ok: false, reason: 'artifactUrl host is empty' };

  // URL parsers leave IPv6 hosts wrapped in brackets — strip before matching.
  const bareHost =
    host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  let normalizedHost = bareHost.replace(/\.+$/, '');
  if (!normalizedHost) return { ok: false, reason: 'artifactUrl host is empty' };

  // Re-canonicalize when trailing dots hid a shorthand/hex/decimal IPv4 host.
  if (normalizedHost !== bareHost && !normalizedHost.includes(':')) {
    try {
      normalizedHost = new URL(`http://${normalizedHost}`).hostname.toLowerCase();
    } catch {
      return { ok: false, reason: 'artifactUrl is not a valid URL' };
    }
  }

  if (LOOPBACK_HOSTS.has(normalizedHost)) {
    return { ok: false, reason: `artifactUrl host "${normalizedHost}" is a loopback address` };
  }
  if (INTERNAL_EXACT_HOSTS.has(normalizedHost)) {
    return {
      ok: false,
      reason: `artifactUrl host "${normalizedHost}" is a reserved internal hostname`,
    };
  }
  if (INTERNAL_HOST_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix))) {
    return {
      ok: false,
      reason: `artifactUrl host "${normalizedHost}" is on a local or internal network suffix`,
    };
  }
  // IPv4-mapped (::ffff:0:0/96), IPv4-compatible (::/96, e.g. ::127.0.0.1 ->
  // ::7f00:1 after URL canonicalization), and NAT64 (64:ff9b::/96) IPv6
  // addresses route to their embedded IPv4 destination. Reject them outright.
  if (/^(?:::ffff:|64:ff9b:|::(?:[0-9a-f]{1,4}:)?[0-9a-f]{1,4}$)/i.test(normalizedHost)) {
    return {
      ok: false,
      reason: `artifactUrl host "${normalizedHost}" is an IPv4-embedded IPv6 address`,
    };
  }
  if (PRIVATE_IPV4_PATTERNS.some((re) => re.test(normalizedHost))) {
    return {
      ok: false,
      reason: `artifactUrl host "${normalizedHost}" is in a private/link-local IPv4 range`,
    };
  }
  if (PRIVATE_IPV6_PATTERNS.some((re) => re.test(normalizedHost))) {
    return {
      ok: false,
      reason: `artifactUrl host "${normalizedHost}" is in a private/link-local IPv6 range`,
    };
  }
  return { ok: true };
}

const PRIVATE_IPV4_PATTERNS: readonly RegExp[] = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // link-local incl. cloud metadata 169.254.169.254
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/, // CGNAT / metadata 100.64.0.0/10
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
];

const PRIVATE_IPV6_PATTERNS: readonly RegExp[] = [
  /^fe[89ab][0-9a-f]?:/i, // link-local fe80::/10
  /^f[cd][0-9a-f]{0,2}:/i, // unique local fc00::/7
];
