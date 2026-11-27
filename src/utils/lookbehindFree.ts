/**
 * Text matching that used to rely on regex lookbehind, without lookbehind
 * syntax that a bundler could turn into code that throws at load.
 *
 * Safari before 16.4 (iOS 15, iOS 16.0-16.3 and every iOS browser built on
 * them) cannot compile a lookbehind assertion. Bundlers that target those
 * browsers turn a lookbehind regex literal into a `new RegExp(...)` call, which
 * then throws "invalid group specifier name" wherever the literal stood. In a
 * module-level object that stops the whole app from loading. Each helper here
 * returns exactly what the lookbehind pattern it replaced returned;
 * `test/lookbehind-free-patterns.test.ts` keeps those patterns as oracles,
 * `test/loads-without-lookbehind.test.ts` loads every export subpath the way
 * Safari 15 would, and `test/no-lookbehind-in-src.test.ts` fails if lookbehind
 * syntax appears anywhere in src except the one string below.
 */

// The GPT Image model-ref pattern exactly as it shipped as a regex literal. It
// is kept as a string and compiled only inside originalGptImageModelRefRegExp's
// try. This is the only lookbehind allowed in src (see
// test/no-lookbehind-in-src.test.ts).
const ORIGINAL_GPT_IMAGE_MODEL_REF_SOURCE = String.raw`(?<!@)(?<!\b[Gg][Pp][Tt]\s)(?:\[(?:Image|Video|Audio)\s+\d+\]|\b(?:Image|Video|Audio)\s+\d+\b)`;
const MODEL_REF_TOKEN_SOURCE = String.raw`(?:\[(?:Image|Video|Audio)\s+\d+\]|\b(?:Image|Video|Audio)\s+\d+\b)`;
const GPT_WORD_AND_SPACE_SOURCE = String.raw`\b[Gg][Pp][Tt]\s`;
const AT_SIGN = 0x40;

interface ModelRefScanners {
  /** Searches for the next token from `lastIndex`. */
  token: RegExp;
  /** Sticky check for a standalone `GPT` word plus one whitespace character. */
  gptPrefix: RegExp;
}

const modelRefScanners = new WeakMap<RegExp, ModelRefScanners>();

function scannersFor(regex: GptImageModelRefRegExp): ModelRefScanners {
  let scanners = modelRefScanners.get(regex);
  if (!scanners) {
    const searchFlags = regex.global || regex.sticky ? regex.flags : `${regex.flags}g`;
    scanners = {
      token: new RegExp(regex.source, searchFlags),
      gptPrefix: new RegExp(GPT_WORD_AND_SPACE_SOURCE, `${regex.flags.replace(/[gy]/g, '')}y`),
    };
    modelRefScanners.set(regex, scanners);
  }
  return scanners;
}

function startsAfterExcludedPrefix(input: string, index: number, gptPrefix: RegExp): boolean {
  if (input.charCodeAt(index - 1) === AT_SIGN) return true;
  if (index < 4) return false;
  gptPrefix.lastIndex = index - 4;
  return gptPrefix.test(input);
}

/**
 * The GPT Image model-ref scanner for engines that cannot compile lookbehind:
 * matches `[Image 1]` or a bare `Image 1` (also Video and Audio), except where
 * the token starts right after `@` or right after a standalone `GPT`/`gpt` word
 * plus one whitespace character.
 *
 * `source` holds only the token pattern. `exec()` skips a token that starts
 * after one of those prefixes and resumes the search one character later, as
 * the regex engine did when the exclusions were lookbehind assertions. The
 * RegExp methods (`test`, `match`, `matchAll`, `replace`, `split`, `search`)
 * run through `exec()` and build copies through this class, so they return what
 * the original pattern returned. A copy made through `RegExp` itself or a
 * structured clone gets the token pattern alone; copy it with
 * `new re.constructor(re.source, re.flags)`.
 */
export class GptImageModelRefRegExp extends RegExp {
  exec(string: string): RegExpExecArray | null {
    const input = String(string);
    const usesLastIndex = this.global || this.sticky;
    const { token, gptPrefix } = scannersFor(this);
    token.lastIndex = usesLastIndex ? this.lastIndex : 0;
    let match = token.exec(input);
    while (match !== null && startsAfterExcludedPrefix(input, match.index, gptPrefix)) {
      if (this.sticky) {
        match = null;
        break;
      }
      // Tokens start with "[" or a letter, never a surrogate pair, so one code unit is one character.
      token.lastIndex = match.index + 1;
      match = token.exec(input);
    }
    if (usesLastIndex) this.lastIndex = match === null ? 0 : token.lastIndex;
    return match;
  }
}

/**
 * The original pattern as a new global RegExp, or null where the engine cannot
 * compile lookbehind (Safari before 16.4).
 *
 * The constructor is reached through `globalThis` on purpose. A minifier that
 * sees `new RegExp(<constant string>)` may fold it into a regex literal: swc
 * does that for simple patterns, and uglify-js with `compress.unsafe` did it
 * to this lookbehind pattern when the string had a single use. A lookbehind
 * literal fails to parse on old Safari and takes its whole chunk down. None of
 * the tools tested (esbuild, terser, swc, oxc, uglify-js, rolldown) folds
 * `new globalThis.RegExp(...)`; they treat it as a call through a property,
 * not the known builtin.
 */
function originalGptImageModelRefRegExp(): RegExp | null {
  try {
    return new globalThis.RegExp(ORIGINAL_GPT_IMAGE_MODEL_REF_SOURCE, 'g');
  } catch {
    return null;
  }
}

/**
 * Builds the GPT Image `scanRegex`, a new instance per call. Where the engine
 * compiles lookbehind (Node, Chrome, Firefox, Safari 16.4+) it is a plain
 * RegExp with the same source and flags as the literal it replaced. Elsewhere
 * it is a `GptImageModelRefRegExp` with the same matches. Tests pass
 * `tryOriginal = false` to reach the fallback on an engine with lookbehind.
 */
export function createGptImageModelRefScanRegex(tryOriginal = true): RegExp {
  return (tryOriginal ? originalGptImageModelRefRegExp() : null)
    ?? new GptImageModelRefRegExp(MODEL_REF_TOKEN_SOURCE, 'g');
}

/**
 * Splits `text` at each whitespace run that follows `.`, `!` or `?` and comes
 * before a capital letter or a digit. The punctuation stays with the sentence
 * before the break.
 */
export function splitAtSentenceBreaks(text: string): string[] {
  const parts: string[] = [];
  let partStart = 0;
  for (const match of text.matchAll(/[.!?](\s+)(?=[A-Z0-9])/g)) {
    const breakStart = match.index! + 1;
    parts.push(text.slice(partStart, breakStart));
    partStart = breakStart + match[1]!.length;
  }
  parts.push(text.slice(partStart));
  return parts;
}

/**
 * Returns the text before the first clause break: whitespace after `.`, `!` or
 * `?` (the punctuation is kept), a semicolon followed by whitespace, or a line
 * break. Returns all of `text` when there is no break.
 */
export function textBeforeFirstClauseBreak(text: string): string {
  const match = /([.!?])\s|;\s|\n/.exec(text);
  if (!match) return text;
  return text.slice(0, match[1] === undefined ? match.index : match.index + 1);
}

const LETTER_NUMBER_OR_UNDERSCORE = /^[\p{L}\p{N}_]$/iu;

function codePointBefore(text: string, index: number): string {
  const trail = text.charCodeAt(index - 1);
  if (trail >= 0xdc00 && trail <= 0xdfff && index >= 2) {
    const lead = text.charCodeAt(index - 2);
    if (lead >= 0xd800 && lead <= 0xdbff) return text.slice(index - 2, index);
  }
  return text.slice(Math.max(0, index - 1), index);
}

function codePointLengthAt(text: string, index: number): number {
  const lead = text.charCodeAt(index);
  if (lead >= 0xd800 && lead <= 0xdbff) {
    const trail = text.charCodeAt(index + 1);
    if (trail >= 0xdc00 && trail <= 0xdfff) return 2;
  }
  return 1;
}

/**
 * Removes every match of `pattern` that does not start right after a letter,
 * number or underscore (compared case-insensitively, as with the `iu` flags).
 * `pattern` must have the `g` and `u` flags and must not match empty text.
 */
export function removeMatchesNotAfterLetterOrNumber(text: string, pattern: RegExp): string {
  let result = '';
  let keptFrom = 0;
  pattern.lastIndex = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    const start = match.index;
    if (LETTER_NUMBER_OR_UNDERSCORE.test(codePointBefore(text, start))) {
      pattern.lastIndex = start + codePointLengthAt(text, start);
    } else {
      result += text.slice(keptFrom, start);
      keptFrom = pattern.lastIndex;
    }
    match = pattern.exec(text);
  }
  return result + text.slice(keptFrom);
}
