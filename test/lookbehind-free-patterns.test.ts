import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGptImageModelRefScanRegex,
  GptImageModelRefRegExp,
  removeMatchesNotAfterLetterOrNumber,
  splitAtSentenceBreaks,
  textBeforeFirstClauseBreak,
} from '../src/utils/lookbehindFree.js';
import {
  getModelRefFormat as getRegistryModelRefFormat,
  getModelRefFormatEntries,
} from '../src/skills/asset_reference_management/modelRefRegistry.js';
import { getModelRefFormat as getRuntimeModelRefFormat } from '../src/public-skill-runtime/index.js';

// The lookbehind patterns these helpers replaced. Node can compile lookbehind, so each one is the
// oracle for its replacement: the new code must return exactly what the old pattern returned.
const ORIGINAL_GPT_IMAGE_MODEL_REF =
  String.raw`(?<!@)(?<!\b[Gg][Pp][Tt]\s)(?:\[(?:Image|Video|Audio)\s+\d+\]|\b(?:Image|Video|Audio)\s+\d+\b)`;
const ORIGINAL_SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9])/g;
const ORIGINAL_CLAUSE_BREAK = /(?<=[.!?])\s+|;\s+|\n/;

/** Seeded PRNG (mulberry32) so a failing random case reproduces. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomTexts(seed: number, count: number, fragments: readonly string[], maxFragments: number): string[] {
  const random = seededRandom(seed);
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    let text = '';
    const length = Math.floor(random() * (maxFragments + 1));
    for (let j = 0; j < length; j++) text += fragments[Math.floor(random() * fragments.length)];
    texts.push(text);
  }
  return texts;
}

function describeMatch(match: RegExpExecArray | RegExpMatchArray | null): unknown {
  if (match === null) return null;
  return {
    index: match.index,
    values: [...match],
    groups: match.groups,
    indices: (match as RegExpExecArray & { indices?: unknown }).indices,
  };
}

/** Everything a caller can observe from a regex over one input. */
function observe(regex: RegExp, input: string, startIndexes: readonly number[]): unknown {
  const observed: Record<string, unknown> = {};
  observed.flags = regex.flags;
  for (const start of startIndexes) {
    regex.lastIndex = start;
    const steps: unknown[] = [];
    for (let i = 0; i < 40; i++) {
      const match = regex.exec(input);
      steps.push([describeMatch(match), regex.lastIndex]);
      if (match === null || !(regex.global || regex.sticky)) break;
    }
    observed[`exec@${start}`] = steps;
  }
  regex.lastIndex = 0;
  const matched = input.match(regex);
  observed.match = regex.global ? matched : describeMatch(matched);
  if (regex.global) observed.matchAll = [...input.matchAll(regex)].map(describeMatch);
  regex.lastIndex = 0;
  observed.replace = input.replace(regex, (...args: unknown[]) => `<${String(args[0])}@${String(args[args.length - 2])}>`);
  observed.split = input.split(regex);
  observed.search = input.search(regex);
  regex.lastIndex = 0;
  observed.test = regex.test(input);
  observed.lastIndexAfterTest = regex.lastIndex;
  return observed;
}

const MODEL_REF_CASES = [
  '',
  'Image 1',
  '[Image 1]',
  '@Image 1',
  '@[Image 1]',
  '@@Image 1',
  'GPT Image 2',
  'gpt Image 2',
  'Gpt [Video 2]',
  'GPT  Image 2',
  'GPT\tAudio 4',
  'GPT\u00a0Image 5',
  'GPT\nImage 5',
  'myGPT Image 3',
  'xGPT Image 1',
  '_GPT Image 1',
  '9GPT Image 1',
  '\u{1F600}GPT Image 1',
  '(GPT Image 1)',
  'GPT-Image 1',
  'Image 1Image 2',
  'Image 12b',
  'Image\n1',
  '[Image\t1]',
  'Images 1',
  'ImageImage 1',
  'image 1 IMAGE 2',
  'Put Image 1 next to [Video 2], keep @Audio 3 and GPT Image 4 out, then Image 5.',
  'Use the GPT Image 2 model with Image 1 and Image 2',
  '\u017fGPT Image 1',
  '\u212aGPT Image 1',
];

const MODEL_REF_FRAGMENTS = [
  'Image', 'Video', 'Audio', 'image', 'IMAGE', 'GPT', 'gpt', 'Gpt', 'gPt', 'G', 'P', 'T', '@', '[', ']',
  ' ', '  ', '\t', '\n', '\u00a0', '\u2028', '1', '2', '10', '007', 'x', 'a', '_', '\u017f', '\u212a',
  '\u{1F600}', '\ud800', '.', ',', 'Images', '-',
];

const MODEL_REF_FLAGS = ['g', '', 'y', 'gy', 'gi', 'gu', 'giu', 'gm', 'gs', 'gd'];

function assertSameAsOriginalModelRef(createRegex: (flags: string) => RegExp, inputs: readonly string[]): void {
  for (const flags of MODEL_REF_FLAGS) {
    for (const input of inputs) {
      const startIndexes = [0, 1, 3, Math.floor(input.length / 2), input.length, input.length + 1];
      assert.deepEqual(
        observe(createRegex(flags), input, startIndexes),
        observe(new RegExp(ORIGINAL_GPT_IMAGE_MODEL_REF, flags), input, startIndexes),
        `flags ${JSON.stringify(flags)} input ${JSON.stringify(input)}`,
      );
    }
  }
}

// The fallback scanRegex, as engines without lookbehind (Safari before 16.4) get it.
const FALLBACK_SCAN_REGEX = createGptImageModelRefScanRegex(false);
const fallbackWithFlags = (flags: string): RegExp => new GptImageModelRefRegExp(FALLBACK_SCAN_REGEX.source, flags);

test('fallback GptImageModelRefRegExp matches what the lookbehind pattern matched: hand-picked inputs', () => {
  assert.ok(FALLBACK_SCAN_REGEX instanceof GptImageModelRefRegExp);
  assert.equal(FALLBACK_SCAN_REGEX.flags, 'g');
  assertSameAsOriginalModelRef(fallbackWithFlags, MODEL_REF_CASES);
});

test('fallback GptImageModelRefRegExp matches what the lookbehind pattern matched: 3,000 random inputs', () => {
  const inputs = randomTexts(20261117, 3000, MODEL_REF_FRAGMENTS, 14);
  assertSameAsOriginalModelRef(fallbackWithFlags, inputs);
});

test('fallback copies made through its constructor keep the exclusions', () => {
  const RegExpClass = FALLBACK_SCAN_REGEX.constructor as RegExpConstructor;
  assertSameAsOriginalModelRef(flags => new RegExpClass(FALLBACK_SCAN_REGEX, flags), MODEL_REF_CASES);
  assertSameAsOriginalModelRef(flags => new RegExpClass(FALLBACK_SCAN_REGEX.source, flags), MODEL_REF_CASES);
  assert.equal(new RegExpClass(FALLBACK_SCAN_REGEX.source).flags, '');
});

// The literal both registries shipped before this change.
const originalLiteral = (): RegExp => /(?<!@)(?<!\b[Gg][Pp][Tt]\s)(?:\[(?:Image|Video|Audio)\s+\d+\]|\b(?:Image|Video|Audio)\s+\d+\b)/g;

/** Copies, conversions and odd calls an integration might make on scanRegex, each on a fresh regex. */
const IDENTITY_PROBES: Array<[string, (re: RegExp) => unknown]> = [
  ['source', re => re.source],
  ['flags', re => re.flags],
  ['String(re)', re => String(re)],
  ['constructor is RegExp', re => re.constructor === RegExp],
  ['prototype is RegExp.prototype', re => Object.getPrototypeOf(re) === RegExp.prototype],
  ['constructor.name', re => re.constructor.name],
  ['RegExp(re) === re', re => RegExp(re) === re],
  ['own property names', re => Object.getOwnPropertyNames(re)],
  ['JSON.stringify', re => JSON.stringify({ scanRegex: re })],
  ['Object.prototype.toString', re => Object.prototype.toString.call(re)],
  ['new RegExp(re) match', re => MODEL_REF_PROBE_TEXT.match(new RegExp(re))],
  ['new RegExp(re, "g") match', re => MODEL_REF_PROBE_TEXT.match(new RegExp(re, 'g'))],
  ['RegExp(re) match', re => MODEL_REF_PROBE_TEXT.match(RegExp(re))],
  ['new RegExp(source, flags) match', re => MODEL_REF_PROBE_TEXT.match(new RegExp(re.source, re.flags))],
  ['new re.constructor(re) match', re => MODEL_REF_PROBE_TEXT.match(new (re.constructor as RegExpConstructor)(re))],
  ['new re.constructor(source) flags', re => new (re.constructor as RegExpConstructor)(re.source).flags],
  ['structuredClone match', re => MODEL_REF_PROBE_TEXT.match(structuredClone(re))],
  ['structuredClone prototype', re => Object.getPrototypeOf(structuredClone(re)) === Object.getPrototypeOf(re)],
  ['builtin exec loop', re => {
    const found: string[] = [];
    for (let m = RegExp.prototype.exec.call(re, MODEL_REF_PROBE_TEXT); m; m = RegExp.prototype.exec.call(re, MODEL_REF_PROBE_TEXT)) found.push(m[0]);
    return found;
  }],
  ['compile then match', re => {
    re.compile(re.source, 'g');
    return MODEL_REF_PROBE_TEXT.match(re);
  }],
  ['species constructor', re => (re.constructor as RegExpConstructor)[Symbol.species] === re.constructor],
  ['split with limit', re => MODEL_REF_PROBE_TEXT.split(re, 2)],
  ['replace $& and $`', re => MODEL_REF_PROBE_TEXT.replace(re, '<$&|$`>')],
];
const MODEL_REF_PROBE_TEXT = 'Use Image 1, not @Image 2 or GPT Image 3, and [Video 4].';

function assertIdenticalToOriginalLiteral(createRegex: () => RegExp, label: string): void {
  for (const [probe, run] of IDENTITY_PROBES) {
    assert.deepEqual(run(createRegex()), run(originalLiteral()), `${label}: ${probe}`);
  }
}

test('where lookbehind compiles, scanRegex is the original pattern itself', () => {
  assertIdenticalToOriginalLiteral(() => createGptImageModelRefScanRegex(true), 'createGptImageModelRefScanRegex(true)');
  // Node compiles lookbehind, so the default gets the original here.
  assertIdenticalToOriginalLiteral(() => createGptImageModelRefScanRegex(), 'createGptImageModelRefScanRegex()');
  const gptEntry = getModelRefFormatEntries().find(entry => entry.model_id === 'gpt-image-2');
  assert.ok(gptEntry);
  const shipped = [
    getRegistryModelRefFormat('gpt-image-2').scanRegex,
    getRegistryModelRefFormat('flux').scanRegex,
    getRuntimeModelRefFormat('gpt-image-2').scanRegex,
    gptEntry.format.scanRegex,
  ];
  // Each registry has its own regex, as with the two literals before, so they never share lastIndex.
  assert.notEqual(shipped[0], shipped[2]);
  assert.notEqual(createGptImageModelRefScanRegex(), createGptImageModelRefScanRegex());
  for (const scanRegex of shipped) {
    assert.equal(scanRegex.constructor, RegExp);
    assert.equal(Object.getPrototypeOf(scanRegex), RegExp.prototype);
    assert.equal(RegExp(scanRegex), scanRegex);
    assert.equal(String(scanRegex), String(originalLiteral()));
  }
});

test('building scanRegex leaves the legacy RegExp statics alone, as the literal did', () => {
  'seed text'.match(/seed/);
  createGptImageModelRefScanRegex();
  createGptImageModelRefScanRegex(false);
  assert.equal(RegExp.lastMatch, 'seed');
  assert.equal(RegExp.input, 'seed text');
});

test('the fallback differs from the original only in how it reads and copies through RegExp', () => {
  const differing = IDENTITY_PROBES
    .filter(([, run]) => JSON.stringify(run(createGptImageModelRefScanRegex(false))) !== JSON.stringify(run(originalLiteral())))
    .map(([probe]) => probe);
  assert.deepEqual(differing, [
    'source',
    'String(re)',
    'constructor is RegExp',
    'prototype is RegExp.prototype',
    'constructor.name',
    'RegExp(re) === re',
    'new RegExp(re) match',
    'new RegExp(re, "g") match',
    'RegExp(re) match',
    'new RegExp(source, flags) match',
    'structuredClone match',
    'structuredClone prototype',
    'builtin exec loop',
  ]);
});

const SENTENCE_CASES = [
  '',
  'Hello. World',
  'Hello.World',
  'a.  B',
  'a. b',
  'a!\nB',
  'a?\t\t9',
  'a. . B',
  'a.  .  B',
  '"Hi." Then',
  'End.',
  ' . A',
  '.A',
  '. A',
  'e.g. The',
  'x.\u00a0Y',
  'x.\u2028Y',
  'Fin. Été',
  'One. Two! Three? 4 five. Six',
  'a;\nb',
  'a. ;b',
  'x?\u00a0y',
  'x!',
  ';',
  '; ',
  '\n',
  'a.\n',
  'One; two',
  'One\ntwo',
  'One;two',
];

const SENTENCE_FRAGMENTS = [
  '.', '!', '?', ';', ' ', '  ', '\t', '\n', '\r\n', '\u00a0', '\u2028', 'A', 'Z', '0', '9', 'a', 'z',
  'Hello', 'world', '"', '…', ',', ':', 'É', '\u{1F600}', '...',
];

test('splitAtSentenceBreaks returns what the lookbehind split returned', () => {
  for (const input of [...SENTENCE_CASES, ...randomTexts(42, 5000, SENTENCE_FRAGMENTS, 16)]) {
    assert.deepEqual(splitAtSentenceBreaks(input), input.split(ORIGINAL_SENTENCE_BREAK), JSON.stringify(input));
  }
});

test('textBeforeFirstClauseBreak returns the first piece of the lookbehind split', () => {
  for (const input of [...SENTENCE_CASES, ...randomTexts(43, 5000, SENTENCE_FRAGMENTS, 16)]) {
    assert.equal(textBeforeFirstClauseBreak(input), input.split(ORIGINAL_CLAUSE_BREAK)[0], JSON.stringify(input));
  }
});

// The same escaping as escapeStoryboardRegExp in src/public-skill-runtime/index.ts.
function escapeLabel(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** How removeStoryboardMetadataLabelsFromPromptText removed one label before this change. */
function removeLabelWithLookbehind(text: string, label: string): string {
  const escaped = escapeLabel(label);
  const leadingBoundary = /^[\p{L}\p{N}_]/u.test(label) ? '(?<![\\p{L}\\p{N}_])' : '';
  const trailingBoundary = /[\p{L}\p{N}_]$/u.test(label) ? '(?![\\p{L}\\p{N}_])' : '';
  return text.replace(new RegExp(`${leadingBoundary}${escaped}${trailingBoundary}`, 'giu'), '');
}

/** How removeStoryboardMetadataLabelsFromPromptText removes one label now. */
function removeLabelWithoutLookbehind(text: string, label: string): string {
  const escaped = escapeLabel(label);
  const trailingBoundary = /[\p{L}\p{N}_]$/u.test(label) ? '(?![\\p{L}\\p{N}_])' : '';
  const labelPattern = new RegExp(`${escaped}${trailingBoundary}`, 'giu');
  return /^[\p{L}\p{N}_]/u.test(label)
    ? removeMatchesNotAfterLetterOrNumber(text, labelPattern)
    : text.replace(labelPattern, '');
}

const LABEL_CASES: Array<[label: string, text: string]> = [
  ['a-', 'a-a-'],
  ['a-a', 'xa-a-a'],
  ['Hero', 'Superhero Hero heroic HERO_1 (Hero) hero.'],
  ['Beat 1', 'Beat 1: Beat 10, xBeat 1 and BEAT 1'],
  ['\u{1D400}b', '\u{1D400}\u{1D400}b \u{1D400}b'],
  ['ι', '\u0345ι ι Ι'],
  ['s', '\u017fs s S'],
  ['k', '\u212ak k'],
  ['_x', 'a_x _x _x_x'],
  ['(Hero)', 'x(Hero) (Hero)'],
  ['Visible text', 'Visible text: Visible textual Visible text'],
  ['٣', '٢٣ ٣'],
  ['x', '\ud800x \udc00x \u{10000}x'],
];

const LABEL_FRAGMENTS = [
  'Hero', 'hero', 'HERO', 'a', 'A', '1', '_', '-', '(', ')', '[', ']', '.', '*', '+', '?', '$', '^', '{',
  '}', '|', '\\', ' ', '\u017f', 'S', 's', 'K', '\u212a', 'k', '\u{1D400}', '\u{1F600}', 'é', 'É',
  '\u0345', 'ι', 'Ι', '٣', 'x-y', 'Beat 1', '\ud800', '\udc00',
];

test('removeMatchesNotAfterLetterOrNumber removes the same label text the lookbehind replace removed', () => {
  for (const [label, text] of LABEL_CASES) {
    assert.equal(removeLabelWithoutLookbehind(text, label), removeLabelWithLookbehind(text, label), JSON.stringify([label, text]));
  }
  const random = seededRandom(8247);
  const labels = randomTexts(7, 400, LABEL_FRAGMENTS, 3).filter(Boolean);
  for (const label of labels) {
    const pieces = [...LABEL_FRAGMENTS, label, label, label.toUpperCase(), label.toLowerCase()];
    for (let i = 0; i < 15; i++) {
      let text = '';
      const length = Math.floor(random() * 12);
      for (let j = 0; j < length; j++) text += pieces[Math.floor(random() * pieces.length)];
      assert.equal(removeLabelWithoutLookbehind(text, label), removeLabelWithLookbehind(text, label), JSON.stringify([label, text]));
    }
  }
});
