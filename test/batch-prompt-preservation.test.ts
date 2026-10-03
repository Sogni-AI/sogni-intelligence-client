import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeBatchPrompt } from '../src/tools/index.js';
import { sanitizeBatchPrompt as sanitizePublicPrompt } from '../src/public-skill-runtime/index.js';

test('batch prompt exports preserve scene instructions, exact copy, and subject counts', () => {
  const prompts = [
    'A portrait of two people standing side-by-side in front of a tiled wall.',
    'Three portraits hang on the wall. A triptych and a collage lie on a grid-patterned rug.',
    'Do not create a collage or a grid. Keep the caption "4 different poses" exactly.',
    'A 9:16 portrait; 1024 x 1536. A lineup of six diverse faces with different expressions.',
    'A {red|blue} robot in {a tiled kitchen|a side-by-side train}, with a 16:9 frame.',
    'Create 4 scenes featuring the same person in {a forest|a cafe}.',
    '  Preserve\nline breaks, commas, and a final period.  ',
    '两个人并排站在瓷砖墙前。',
    '',
  ];
  for (const prompt of prompts) {
    assert.equal(sanitizeBatchPrompt(prompt), prompt);
    assert.equal(sanitizePublicPrompt(prompt), prompt);
  }
});

test('both public entry points share the same compatibility helper', () => {
  assert.equal(sanitizeBatchPrompt, sanitizePublicPrompt);
});
