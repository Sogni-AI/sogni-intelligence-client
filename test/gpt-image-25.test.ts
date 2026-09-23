import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getGptImage2ModelOverride, getGptImageCapabilities, isGptImageModel,
  normalizeGptImageModelAlias, normalizeGptImageQuality,
  textRequestedGptImage25Variant, textRequestsGptImage2ImageModel,
} from '../src/media/gptImage.js';
import { resolveImageEditModelForProfile } from '../src/media/imageEditRouting.js';
import { applyGenerationJobOverridesToArgs } from '../src/media/generationJob.js';
import { resolveImagePromptAuthoringProfile } from '../src/contracts/imagePrompt.js';
import { resolveRegisteredImageReferenceModelId } from '../src/utils/imageReferenceModelIds.js';
import { getModelOptions } from '../src/tools/shared/modelRegistry.js';
import { definition as generate } from '../src/tools/definitions/generate-image/definition.js';
import { definition as edit } from '../src/tools/definitions/edit-image/definition.js';
import {
  buildStoryboardProject,
  buildStoryboardVideoHostedToolSequenceInput,
  compileForModel,
  storyboardAdapterRegistry,
} from '../src/public-skill-runtime/index.js';

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

test('abbreviated GPT 2.5 names keep their version and variant', () => {
  for (const [name, model] of [
    ['GPT 2.5 Sunburst', sunburst],
    ['gpt-2.5-sunburst', sunburst],
    ['GPT2.5 Sunburst', sunburst],
    ['GPT 2.5 Flare', flare],
    ['gpt_2.5_flare', flare],
    ['GPT 2.5', flare],
  ]) {
    assert.equal(normalizeGptImageModelAlias(name), model, name);
    const request = `Edit these photos with ${name.replaceAll('_', ' ')}.`;
    assert.equal(textRequestedGptImage25Variant(request), name.endsWith('2.5') ? 'unspecified' : model, name);
    assert.equal(textRequestsGptImage2ImageModel(`Use ${name.replaceAll('_', ' ')}.`), true, name);
    for (const tool of ['generate_image', 'edit_image']) {
      assert.equal(getGptImage2ModelOverride(tool, baseline, request), model, `${tool}: ${name}`);
      assert.equal(getGptImage2ModelOverride(tool, model, request), null, `${tool}: ${name}`);
    }
  }
  assert.equal(textRequestedGptImage25Variant('Edit with GPT 2.5 (Sunburst)'), sunburst);
  assert.equal(getGptImage2ModelOverride('edit_image', 'qwen', 'Do not use GPT 2.5 Sunburst for this photo'), null);
  for (const name of ['GPT 2.50 Sunburst', 'GPT Image 2.5.1', 'GPT 2 Sunburst', 'a sunburst with lens flare']) {
    assert.equal(textRequestedGptImage25Variant(name), null, name);
  }
});

test('excluded GPT variants never override another selection', () => {
  for (const model of ['qwen', 'krea-identity-edit']) {
    for (const exclusion of ['instead of', 'rather than', 'not', 'without', 'do not use']) {
      const request = `Use ${model} ${exclusion} GPT 2.5 Sunburst.`;
      assert.equal(textRequestedGptImage25Variant(request), null, request);
      assert.equal(textRequestsGptImage2ImageModel(request), false, request);
      assert.equal(getGptImage2ModelOverride('edit_image', model, request), null, request);
    }
  }
  for (const request of [
    'Use GPT 2.5 Sunburst instead of GPT 2.5 Flare.',
    'Use GPT 2.5 Sunburst, not GPT 2.5 Flare.',
    'Do not use GPT 2.5 Flare; use GPT 2.5 Sunburst.',
    'Not GPT 2.5 Flare but use GPT 2.5 Sunburst.',
    'Use GPT2.5 Sunburst rather than Qwen.',
    'Use Sunburst model instead of GPT 2.5 Flare.',
  ]) {
    assert.equal(textRequestedGptImage25Variant(request), sunburst, request);
    assert.equal(getGptImage2ModelOverride('edit_image', baseline, request), sunburst, request);
  }
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

test('storyboard production defaults to Sunburst reference stills and Seedance 2.5 at 1080p', () => {
  const storyline = [
    '| Beat | Time | Purpose | Visual/Action | Camera/Motion | Dialogue/VO | Audio/SFX | Transition |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 01 | 0s-10s | Setup | Ivory mug on a wooden table. | Slow push-in. | [no dialogue] | Room tone. | Cut. |',
    '| 02 | 10s-20s | Product | Artist lifts the mug. | Medium portrait. | [no dialogue] | Gentle music. | End. |',
  ].join('\n');
  const plan = buildStoryboardVideoHostedToolSequenceInput({
    storyline,
    userIntentText: 'Create a 20-second vertical storyboard video from these two approved scenes.',
    frameCount: 2,
  });

  assert.equal(plan.image.model, sunburst);
  assert.equal(plan.video.model, 'seedance2-5');
  assert.deepEqual([plan.video.width, plan.video.height, plan.video.duration], [1080, 1920, 20]);
  assert.equal(plan.input.steps[0]?.arguments.model, sunburst);
  assert.equal(plan.input.steps[1]?.arguments.videoModel, 'seedance2-5');
  assert.equal(plan.input.steps[1]?.arguments.targetResolution, 1080);
  assert.equal('width' in plan.input.steps[1]!.arguments, false);
  assert.equal('height' in plan.input.steps[1]!.arguments, false);

  const genericSeedance = compileForModel('seedance', plan.storyboardProject, {
    stage: 'scene_clip',
    scene: plan.storyboardProject.scenes[0],
  });
  assert.equal(genericSeedance.args.videoModel, 'seedance2-5');
  assert.equal(genericSeedance.args.targetResolution, 1080);
  assert.equal(genericSeedance.args.duration, 10);

  const legacySeedance = compileForModel('seedance2', plan.storyboardProject, {
    stage: 'scene_clip',
    scene: { ...plan.storyboardProject.scenes[0], durationSec: 20 },
  });
  assert.equal(legacySeedance.args.videoModel, 'seedance2');
  assert.equal(legacySeedance.args.targetResolution, undefined);
  assert.equal(legacySeedance.args.duration, 15);
});
