import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

// Safari before 16.4 (iOS 15, iOS 16.0-16.3) cannot compile regex lookbehind. In November 2026 one
// lookbehind in a module-level object stopped app.sogni.ai from loading on those devices, because the
// web build turns such a literal into `new RegExp(...)`, which throws as soon as the module loads.
// This scan catches lookbehind syntax written out anywhere in src: regex literals, strings and comments.
// test/loads-without-lookbehind.test.ts catches a lookbehind compiled at module level, however its
// pattern is built. A pattern assembled from pieces inside a function gets past both, and still throws
// on old Safari when that function runs.
//
// One line is allowed: the original GPT Image model-ref pattern in src/utils/lookbehindFree.ts. It is a
// string that is compiled only inside a try (originalGptImageModelRefRegExp).
const LOOKBEHIND = /\(\?<[=!]/;
const SRC = join(__dirname, '..', 'src');
const ALLOWED = [
  'utils/lookbehindFree.ts: const ORIGINAL_GPT_IMAGE_MODEL_REF_SOURCE = String.raw`(?<!@)(?<!\\b[Gg][Pp][Tt]\\s)(?:\\[(?:Image|Video|Audio)\\s+\\d+\\]|\\b(?:Image|Video|Audio)\\s+\\d+\\b)`;',
];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

test('src has no regex lookbehind syntax except the one guarded original', () => {
  const found: string[] = [];
  for (const file of filesUnder(SRC)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (LOOKBEHIND.test(line)) found.push(`${relative(SRC, file).split('\\').join('/')}: ${line.trim()}`);
    }
  }
  assert.deepEqual(found, ALLOWED);
});
