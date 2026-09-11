import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getGptImage2ModelOverride, getGptImageCapabilities, isGptImageModel,
  normalizeGptImageModelAlias, normalizeGptImageQuality,
} from '../src/media/gptImage.js';
import { resolveImageEditModelForProfile } from '../src/media/imageEditRouting.js';
import { applyGenerationJobOverridesToArgs } from '../src/media/generationJob.js';
import { resolveImagePromptAuthoringProfile } from '../src/contracts/imagePrompt.js';
import { resolveRegisteredImageReferenceModelId } from '../src/utils/imageReferenceModelIds.js';
import { getModelOptions } from '../src/tools/shared/modelRegistry.js';
import { definition as generate } from '../src/tools/definitions/generate-image/definition.js';
import { definition as edit } from '../src/tools/definitions/edit-image/definition.js';
import { buildStoryboardProject, compileForModel, storyboardAdapterRegistry } from '../src/public-skill-runtime/index.js';

const sunburst = 'gpt-image-2.5-sunburst';
const flare = 'gpt-image-2.5-flare';
const baseline = 'gpt-image-2';

test('exact GPT variants survive aliases, model preferences, prompt profiles and storyboards', () => {
  const script = [
    '| Beat | Time | Purpose | Visual/Action | Camera/Motion | Dialogue/VO | Audio/SFX | Transition |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 01 | 0s-2s | Setup | Ivory mug on a wooden table. | Static close-up. | [no dialogue] | Silence. | Cut. |',
    '| 02 | 2s-4s | Product | Artist holds the mug. | Medium portrait. | [no dialogue] | Silence. | End. |',
  ].join('\n');
  const storyboard = buildStoryboardProject({
    prompt: script,
    userIntentText: 'Create exactly two storyboard panels for a ceramic mug commercial.',
    approvedScriptContext: script,
    frameCount: 2,
    promptAuthorship: 'assistant',
  });
  for (const model of [baseline, sunburst, flare] as const) {
    assert.equal(normalizeGptImageModelAlias(model.toUpperCase()), model);
    assert.equal(getGptImage2ModelOverride('edit_image', model, 'Edit the portrait'), null);
    assert.equal(resolveImageEditModelForProfile({ imageEditProfile: 'identity_sensitive_portrait', explicitModelPreference: model }), model);
    assert.equal(resolveRegisteredImageReferenceModelId(model), 'gpt-image-2');
    assert.equal(resolveImagePromptAuthoringProfile(model, 'edit')?.id, `${model}-edit`);
    assert.equal(storyboardAdapterRegistry.getAdapter(model)?.modelId, model);
    assert.equal(compileForModel(model, storyboard, { stage: 'storyboard_image' }).args.model, model);
    assert.equal(compileForModel(model, storyboard, { stage: 'keyframe' }).args.model, model);
    for (const tool of ['generate_image', 'edit_image']) {
      assert.ok(getModelOptions(tool).some(option => option.key === model));
    }
  }
  assert.equal(normalizeGptImageModelAlias('Sunburst'), sunburst);
  assert.equal(normalizeGptImageModelAlias('GPT Image 2.5 Flare'), flare);
  assert.equal(normalizeGptImageModelAlias('GPT Image 2.5'), flare);
  assert.equal(normalizeGptImageModelAlias('OpenAI'), baseline);
  assert.equal(normalizeGptImageModelAlias('GPT Image 2.0'), baseline);
  assert.equal(storyboardAdapterRegistry.getAdapter('gpt_image_2.5_sunburst')?.modelId, sunburst);
  assert.equal(isGptImageModel('gpt-image-3'), false);
});

test('requested variants override stale selections while existing defaults stay intact', () => {
  assert.equal(getGptImage2ModelOverride('generate_image', baseline, 'Create an image with GPT Image 2.5 Sunburst'), sunburst);
  assert.equal(getGptImage2ModelOverride('edit_image', sunburst, 'Edit with GPT Image 2.5 Flare'), flare);
  assert.equal(getGptImage2ModelOverride('edit_image', flare, 'Edit with GPT Image 2.0'), baseline);
  assert.equal(getGptImage2ModelOverride('generate_image', undefined, 'Create with GPT Image 2.5'), flare);
  assert.equal(getGptImage2ModelOverride('generate_image', baseline, 'Render it with GPT Image 2.5 (Sunburst)'), sunburst);
  assert.equal(getGptImage2ModelOverride('generate_image', sunburst, 'Use the Sunburst variant of GPT Image 2.5'), null);
  assert.equal(getGptImage2ModelOverride('generate_video', undefined, 'Use GPT Image 2.5 Sunburst'), null);
  assert.equal(getGptImage2ModelOverride('generate_image', 'krea-2-turbo', 'Create a cat with Krea 2 Turbo'), null);
  assert.equal(getGptImage2ModelOverride('generate_image', 'krea-2-turbo', 'Create a sunset portrait with flare'), null);
});

test('2.5 qualities survive, auto is rejected, and baseline gains no 2.5 controls', () => {
  for (const model of [sunburst, flare] as const) {
    for (const quality of ['low', 'medium', 'high', 'xhigh', 'max'] as const) {
      assert.equal(normalizeGptImageQuality(quality, model), quality);
    }
    assert.equal(getGptImageCapabilities(model).supportsTransparency, true);
  }
  // Provider-chosen quality is never accepted, on any GPT Image model.
  for (const model of [baseline, sunburst, flare] as const) assert.equal(normalizeGptImageQuality('auto', model), undefined);
  assert.throws(() => normalizeGptImageQuality('max', baseline), /requires GPT Image 2.5/);
  assert.throws(() => normalizeGptImageQuality('xhigh', baseline), /requires GPT Image 2.5/);
  assert.equal(getGptImageCapabilities(baseline).supportsTransparency, false);
  assert.equal(normalizeGptImageQuality('nonsense'), undefined);
});

test('both executable tool definitions expose all variants and new output controls', () => {
  for (const definition of [generate, edit]) {
    const props = definition.function.parameters.properties as Record<string, any>;
    for (const model of [baseline, sunburst, flare]) assert.ok(props.model.enum.includes(model));
    assert.deepEqual(props.gptImageQuality.enum, ['low', 'medium', 'high', 'xhigh', 'max']);
    assert.ok(props.gptImageBackground.enum.includes('transparent'));
    assert.equal(props.gptImageOutputCompression.minimum, 0);
    assert.equal(props.gptImageOutputCompression.maximum, 100);
  }
});

test('a model switch keeps only the GPT Image options the new model supports', () => {
  const args = {
    model: sunburst,
    gptImageQuality: 'max',
    gptImageBackground: 'transparent',
    gptImageOutputCompression: 0,
    mask_image_url: 'https://example.com/mask.png',
  };
  assert.deepEqual(applyGenerationJobOverridesToArgs(args, { modelKey: flare }), { ...args, model: flare });
  assert.deepEqual(applyGenerationJobOverridesToArgs(args, { modelKey: baseline }), {
    model: baseline,
    gptImageOutputCompression: 0,
    mask_image_url: 'https://example.com/mask.png',
  });
  assert.deepEqual(applyGenerationJobOverridesToArgs(args, { modelKey: 'qwen-lightning' }), { model: 'qwen-lightning' });
});
