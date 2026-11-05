import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getGptImageCapabilities, getGptImageRequestOptions, getGptImage2ModelOverride, gptImageGifDimensions, normalizeImageOutputFormat } from '../src/media/gptImage.js';
import { getModelOptions } from '../src/tools/shared/modelRegistry.js';

test('2.6 selections and animation options survive shared routing and validation', () => {
  for (const model of ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'] as const) {
    assert.ok(getModelOptions('generate_image').some(option => option.key === model));
    assert.ok(getGptImageCapabilities(model).outputFormats.includes('gif'));
    assert.equal(getGptImage2ModelOverride('generate_image', model, 'Create a GIF with GPT Image 2.6'), null);
    assert.deepEqual(getGptImageRequestOptions({ outputFormat: 'gif', gptImageFrameCount: 9, gptImageFrameDurationMs: 200, gptImageComplexity: 'low' }, model), { gptImageFrameCount: 9, gptImageFrameDurationMs: 200, gptImageComplexity: 'low' });
  }
  assert.equal(normalizeImageOutputFormat('gif'), 'gif');
  assert.deepEqual(gptImageGifDimensions(), { width: 896, height: 896 });
  assert.deepEqual(gptImageGifDimensions(320, 320), { width: 320, height: 320 });
  assert.ok(gptImageGifDimensions(undefined, undefined, 16).width ** 2 * 16 <= 8294400);
  assert.throws(() => gptImageGifDimensions(undefined, undefined, 64), /2–16/);
  assert.throws(() => gptImageGifDimensions(1024, 1024), /pixel budget/);
  assert.throws(() => getGptImageRequestOptions({ outputFormat: 'gif' }, 'gpt-image-2.5-flare'), /require GPT Image 2.6/);
});
