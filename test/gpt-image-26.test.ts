import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getGptImageCapabilities, getGptImageRequestOptions, getGptImage2ModelOverride, gptImageGifDimensions, normalizeImageOutputFormat } from '../src/media/gptImage.js';
import { getModelOptions } from '../src/tools/shared/modelRegistry.js';
import { definition as generateImage } from '../src/tools/definitions/generate-image/definition.js';
import { getHostedToolDefinition } from '../src/openai-tools/index.js';

test('local and generated image output guidance matches the canonical GIF schema', () => {
  const require = createRequire(`${process.cwd()}/package.json`);
  const schema = JSON.parse(readFileSync(require.resolve('@sogni-ai/sogni-protocol/schemas/tools/generate_image.schema.json'), 'utf8'));
  const canonical = schema.properties.outputFormat;
  assert.match(canonical.description, /GIF requires GPT Image 2\.6 text-to-image/);
  for (const tool of [generateImage, getHostedToolDefinition('generate_image')!]) {
    const field = (tool.function.parameters as { properties: Record<string, { description: string; enum: string[] }> }).properties.outputFormat;
    assert.equal(field.description, canonical.description);
    assert.ok(field.enum.includes('gif'));
  }
});

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
  assert.deepEqual(gptImageGifDimensions(undefined, undefined, 9, '320 × 320'), { width: 320, height: 320 });
  assert.deepEqual(gptImageGifDimensions(undefined, undefined, 9, '320X320'), { width: 320, height: 320 });
  assert.deepEqual(gptImageGifDimensions(640, undefined, 9, '4:3'), { width: 640, height: 480 });
  const wide = gptImageGifDimensions(undefined, undefined, 16, '3:1');
  assert.ok(wide.width / wide.height <= 3 && wide.width * wide.height * 16 <= 8294400);
  assert.ok(gptImageGifDimensions(undefined, undefined, 16).width ** 2 * 16 <= 8294400);
  assert.throws(() => gptImageGifDimensions(undefined, undefined, 64), /2–16/);
  assert.throws(() => gptImageGifDimensions(1024, 1024), /pixel budget/);
  assert.throws(() => getGptImageRequestOptions({ outputFormat: 'gif' }, 'gpt-image-2.5-flare'), /require GPT Image 2.6/);
});

test('inferred GIF dimensions stay valid across supported counts and aspect boundaries', () => {
  for (let count = 2; count <= 16; count++) {
    for (const ratio of ['1:3', '9:16', '3:4', '1:1', '4:3', '16:9', '3:1']) {
      const { width, height } = gptImageGifDimensions(undefined, undefined, count, ratio);
      assert.ok(width > 0 && height > 0 && width % 16 === 0 && height % 16 === 0, `${count} ${ratio}`);
      assert.ok(Math.max(width, height) / Math.min(width, height) <= 3, `${count} ${ratio}`);
      assert.ok(width * height * count <= 8294400, `${count} ${ratio}`);
    }
  }
});
