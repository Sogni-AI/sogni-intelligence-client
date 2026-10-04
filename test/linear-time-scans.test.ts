/**
 * Untrusted user and model text reaches each of these scans on every turn.
 * Each one used a regex that is quadratic (or worse) on crafted input, so
 * one long message could hold the event loop for seconds. Every scan gets
 * a timing bound on 200,000 adversarial characters and a check that its
 * output matches the original regex, on edge cases and on a seeded soup
 * of the tokens the scan looks for.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { HARD_STRIP_PATTERNS, sanitizeUntrustedString } from '../src/workflows/primitives/sanitizer.js';

const ADVERSARIAL_LENGTH = 200_000;
// The fixed scans finish 200,000 characters in about a millisecond; the old
// regexes take 280 ms to many seconds, so the bound fails them with margin.
const TIME_BOUND_MS = 150;
const SOUP_CASES = 3000;

/** `unit` repeated to exactly `length` characters. */
function repeatTo(unit: string, length = ADVERSARIAL_LENGTH): string {
  return unit.repeat(Math.ceil(length / unit.length)).slice(0, length);
}

function assertFast(label: string, run: () => unknown): void {
  const start = process.hrtime.bigint();
  run();
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(
    elapsedMs < TIME_BOUND_MS,
    `${label} took ${elapsedMs.toFixed(0)} ms on ${ADVERSARIAL_LENGTH} adversarial characters (bound ${TIME_BOUND_MS} ms)`,
  );
}

/** Seeded strings of 0-24 tokens, so failures reproduce. */
function tokenSoup(tokens: readonly string[], seed: number, count = SOUP_CASES): string[] {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let text = '';
    const length = Math.floor(next() * 25);
    for (let j = 0; j < length; j += 1) text += tokens[Math.floor(next() * tokens.length)];
    out.push(text);
  }
  return out;
}

// ---------------------------------------------------------------------------
// workflows/primitives/sanitizer.ts
// ---------------------------------------------------------------------------

/** The old implementation: every exported pattern through String.prototype.replace. */
function stripWithExportedPatterns(text: string, patterns: readonly RegExp[] = HARD_STRIP_PATTERNS): string {
  return patterns.reduce((cleaned, pattern) => cleaned.replace(pattern, ''), text);
}

const CHAT_TEMPLATE_COUNT = HARD_STRIP_PATTERNS.findIndex((pattern) => pattern.source.includes('UNTRUSTED_USER'));

const SANITIZER_TOKENS = [
  '<system>', '</system>', '<SYSTEM>', '</System>', '<sYsTeM>', '</SYSTEM>',
  '<tool_call>', '</tool_call>', '<TOOL_CALL>', '</Tool_Call>',
  '<UNTRUSTED_USER_INPUT', '<untrusted_user_input', '</UNTRUSTED_USER_INPUT>', '<UNTRUSTED_USER_BRIEF',
  '<Untrusted_User_Brief', '</UNTRUSTED_USER_BRIEF>', ' field="brief"', '>', '<', '/', ' ', '\t', '\n',
  '\u00a0', '\u2028', 'X', 'text', 'system', '<|im_start|>', '<<SYS>>', '[INST]', '<sys', 'tem>', '</sys',
  // Non-ASCII letters that upper-case to ASCII: /i without /u must not fold them.
  '\u017fystem', '\u212a',
];

const SANITIZER_EDGE_CASES = [
  '',
  '<system>',
  '</system>',
  '<system></system>',
  'a<system>hidden</system>b',
  'a<SYSTEM>hidden</System>b<sYsTeM>more</SYSTEM>c',
  '<system>outer<system>inner</system>tail</system>',
  '<system>closed</system>then<system>unclosed',
  '<system>' + '<system>'.repeat(5),
  'keep<system>unclosed</syste',
  '<tool_call>{"name":"x"}</TOOL_CALL>after',
  '<tool_call>one</tool_call><tool_call>two</tool_call><tool_call>',
  '<sys<|im_start|>tem>made by an earlier strip</system>',
  '<\u017fystem>long s is not s</\u017fystem>',
  '<UNTRUSTED_USER_INPUT>',
  '<UNTRUSTED_USER_INPUT field="a">x</UNTRUSTED_USER_INPUT>',
  '<untrusted_user_input\nfield="a"\n>x',
  '<UNTRUSTED_USER_INPUT\u00a0nbsp>x',
  '<UNTRUSTED_USER_INPUT\u2028sep>x',
  '<UNTRUSTED_USER_INPUT field="never closed',
  '<UNTRUSTED_USER_INPUTX>no space',
  '<UNTRUSTED_USER_INPUT <UNTRUSTED_USER_INPUT> nested',
  '<UNTRUSTED_USER_INPUT a>one<UNTRUSTED_USER_INPUT b',
  '<UNTRUSTED_USER_BRIEF tone="x">brief</UNTRUSTED_USER_BRIEF>',
  '<UNTRUSTED_USER_BRIEF',
  '<UNTRUSTED_USER_BRIEF >',
];

test('workflow sanitizer output equals the exported strip patterns applied in order', () => {
  const inputs = [...SANITIZER_EDGE_CASES, ...tokenSoup(SANITIZER_TOKENS, 0x5a1)];
  for (const input of inputs) {
    const expected = stripWithExportedPatterns(input);
    assert.equal(sanitizeUntrustedString(input), expected, JSON.stringify(input));
    assert.equal(
      sanitizeUntrustedString(input, { stripDelimiters: false }),
      stripWithExportedPatterns(input, HARD_STRIP_PATTERNS.slice(0, CHAT_TEMPLATE_COUNT)),
      JSON.stringify(input),
    );
    assert.deepEqual(
      sanitizeUntrustedString(input, 'brief'),
      { ok: true, field: 'brief', value: expected.trim() },
      JSON.stringify(input),
    );
  }
});

for (const [label, unit] of [
  // A near-miss closing tag after each opening keeps the old scan slow even
  // once V8 has warmed the pattern up.
  ['<system> openings', '<system></syste'],
  ['<tool_call> openings', '<tool_call>'],
  ['<UNTRUSTED_USER_INPUT openings with attributes', '<UNTRUSTED_USER_INPUT\t'],
  ['<UNTRUSTED_USER_BRIEF openings with attributes', '<UNTRUSTED_USER_BRIEF '],
] as const) {
  test(`workflow sanitizer strips unterminated ${label} in linear time`, () => {
    const input = repeatTo(unit);
    assertFast('sanitizeUntrustedString(field)', () => sanitizeUntrustedString(input, 'currentMessage'));
    assertFast('sanitizeUntrustedString(options)', () => sanitizeUntrustedString(input));
  });
}
