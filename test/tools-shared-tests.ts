/**
 * Unit tests for the public-safe tool-arg normalization helpers.
 */
import {
  animatePhotoDefinition,
  editImageDefinition,
  generateVideoDefinition,
  generateImageDefinition,
  generateSpeechDefinition,
  extractDynamicPromptBranches,
  getModelOptions,
  isStoryboardKeyframeBatchPrompt,
  maybeAlignNumberOfVariationsToDynamicBranchCount,
  textExplicitlyRequestsMultipleImageOutputs,
} from '../src/tools/index';
import { validateAndNormalizeHostedToolArguments } from '../src/contracts/index';

let testsPassed = 0;
let testsFailed = 0;

function expect<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`✅ PASS: ${label}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${label}`);
    console.error(`   expected: ${JSON.stringify(expected)}`);
    console.error(`   actual:   ${JSON.stringify(actual)}`);
    testsFailed++;
  }
}

export function runToolsSharedTests(): { passed: number; failed: number } {
  console.log('\n🧪 tools/shared helpers\n');

  // extractDynamicPromptBranches
  expect(
    'extractDynamicPromptBranches: 2-option branch',
    extractDynamicPromptBranches('a {pickle | cucumber} on a plate').map(b => b.options),
    [['pickle', 'cucumber']],
  );
  expect(
    'extractDynamicPromptBranches: no branch returns []',
    extractDynamicPromptBranches('just plain text'),
    [],
  );

  // isStoryboardKeyframeBatchPrompt
  expect(
    'isStoryboardKeyframeBatchPrompt: matching keyframe pattern',
    isStoryboardKeyframeBatchPrompt(
      '{scene 1 keyframe, single full-frame still, no storyboard grid | scene 2 keyframe, single full-frame still, no storyboard grid}',
    ),
    true,
  );
  expect(
    'isStoryboardKeyframeBatchPrompt: plain dynamic prompt is false',
    isStoryboardKeyframeBatchPrompt('{pickle | cucumber}'),
    false,
  );

  // textExplicitlyRequestsMultipleImageOutputs
  expect(
    'multiImageIntent: "draw 2 more"',
    textExplicitlyRequestsMultipleImageOutputs('draw 2 more'),
    true,
  );
  expect(
    'multiImageIntent: "another 3"',
    textExplicitlyRequestsMultipleImageOutputs('another 3'),
    true,
  );
  expect(
    'multiImageIntent: "two more"',
    textExplicitlyRequestsMultipleImageOutputs('two more'),
    true,
  );
  expect(
    'multiImageIntent: "give me 5 more variations"',
    textExplicitlyRequestsMultipleImageOutputs('give me 5 more variations'),
    true,
  );
  expect(
    'multiImageIntent: "make it bigger" (no multi-image signal)',
    textExplicitlyRequestsMultipleImageOutputs('make it bigger'),
    false,
  );

  expect(
    'model registry: edit_image includes Krea identity edit models',
    getModelOptions('edit_image').map(option => option.key).includes('krea-identity-edit')
      && getModelOptions('edit_image').map(option => option.key).includes('dark-beast-krea2-identity-edit'),
    true,
  );
  expect(
    'model registry: generate_image includes Dark Beast Krea 2',
    getModelOptions('generate_image').map(option => option.key).includes('dark-beast-krea2'),
    true,
  );
  const generateVideoModelKeys = getModelOptions('generate_video').map(option => option.key);
  const animatePhotoModelKeys = getModelOptions('animate_photo').map(option => option.key);
  expect(
    'model registry: generate_video includes H3 LightX2V, FastH3, and R2V Turbo selectors',
    {
      t2vTurbo: generateVideoModelKeys.includes('minimax-h3-t2v-turbo'),
      fastH3T2vTurbo: generateVideoModelKeys.includes('minimax-h3-fasth3-t2v-turbo'),
      r2vTurbo: generateVideoModelKeys.includes('minimax-h3-r2v-turbo'),
    },
    { t2vTurbo: true, fastH3T2vTurbo: true, r2vTurbo: true },
  );
  expect(
    'model registry: animate_photo includes H3 I2V and FLF2V Turbo selectors',
    {
      i2vTurbo: animatePhotoModelKeys.includes('minimax-h3-i2v-turbo'),
      flf2vTurbo: animatePhotoModelKeys.includes('minimax-h3-flf2v-turbo'),
      fastH3I2vTurbo: animatePhotoModelKeys.includes('minimax-h3-fasth3-i2v-turbo'),
      fastH3Flf2vTurbo: animatePhotoModelKeys.includes('minimax-h3-fasth3-flf2v-turbo'),
      r2vTurbo: animatePhotoModelKeys.includes('minimax-h3-r2v-turbo'),
    },
    { i2vTurbo: true, flf2vTurbo: true, fastH3I2vTurbo: true, fastH3Flf2vTurbo: true, r2vTurbo: false },
  );
  const generateImageProperties = generateImageDefinition.function.parameters.properties ?? {};
  expect(
    'generate_image exposes ordered LoRA arrays',
    {
      loras: generateImageProperties.loras?.maxItems,
      loraStrengths: generateImageProperties.loraStrengths?.maxItems,
    },
    { loras: 8, loraStrengths: 8 },
  );
  const mismatchedLoras = validateAndNormalizeHostedToolArguments(
    [generateImageDefinition],
    'generate_image',
    {
      prompt: 'portrait',
      model: 'krea-2-turbo',
      loras: ['krea2-detail-enhancer', 'krea2-amateur'],
      loraStrengths: [-2],
    },
  );
  expect('generate_image rejects mismatched LoRA arrays', mismatchedLoras.ok, false);
  const bipolarLoras = validateAndNormalizeHostedToolArguments(
    [generateImageDefinition],
    'generate_image',
    {
      prompt: 'portrait',
      model: 'krea-2-turbo',
      loras: ['krea2-detail-enhancer', 'krea2-amateur'],
      loraStrengths: [3, -2],
    },
  );
  expect('generate_image accepts ordered bipolar LoRA strengths', bipolarLoras.ok, true);

  // MiniMax H3 video LoRAs. The two tools split the H3 modes between them, so
  // each must carry the arrays and name only its own selectors.
  for (const [toolName, definition, expectedSelectors] of [
    ['generate_video', generateVideoDefinition, ['minimax-h3-t2v', 'minimax-h3-t2v-turbo', 'minimax-h3-fasth3-t2v-turbo', 'minimax-h3-r2v', 'minimax-h3-r2v-turbo']],
    ['animate_photo', animatePhotoDefinition, ['minimax-h3-i2v', 'minimax-h3-i2v-turbo', 'minimax-h3-fasth3-i2v-turbo', 'minimax-h3-flf2v', 'minimax-h3-flf2v-turbo', 'minimax-h3-fasth3-flf2v-turbo']],
  ] as const) {
    const properties = definition.function.parameters.properties ?? {};
    expect(
      `${toolName} exposes ordered LoRA arrays`,
      { loras: properties.loras?.maxItems, loraStrengths: properties.loraStrengths?.maxItems },
      { loras: 8, loraStrengths: 8 },
    );
    // Every selector the description tells the LLM to set must be a real enum
    // member, or the model follows the advice into a validation error.
    const videoModelEnum = (properties.videoModel?.enum ?? []) as string[];
    expect(
      `${toolName} LoRA selectors are all videoModel enum members`,
      expectedSelectors.filter(selector => !videoModelEnum.includes(selector)),
      [],
    );
    expect(
      `${toolName} names its own H3 LoRA selectors and not the other tool's`,
      expectedSelectors.every(selector => properties.loras?.description?.includes(`"${selector}"`)),
      true,
    );
    expect(
      `${toolName} names the LoRA and its trigger word`,
      Boolean(properties.loras?.description?.includes('h3-realism-people') && properties.loras?.description?.includes('r34l1sm')),
      true,
    );
  }
  expect(
    'generate_video rejects mismatched LoRA arrays',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: 'r34l1sm, a fisherman mending nets',
      videoModel: 'minimax-h3-t2v',
      loras: ['h3-realism-people'],
      loraStrengths: [0.8, 0.8],
    }).ok,
    false,
  );
  expect(
    'generate_video accepts an H3 LoRA request',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: 'r34l1sm, a fisherman mending nets',
      videoModel: 'minimax-h3-t2v',
      loras: ['h3-realism-people'],
      loraStrengths: [0.8],
    }).ok,
    true,
  );
  const h3ExactAudioPrompt = `subject_definitions:
<Video 1> supplies the dance. <Audio 1> is its immutable soundtrack.

summary:
[reference generation + audio reuse] Recreate <Video 1> on the original timeline.

retention_analysis:
<Video 1>: fully_preserved - preserve choreography timing.
<Audio 1>: fully_copy - reuse the complete source signal unchanged.

detailed_description:
[Shot 1] Keep the opening pause and timed dance from <Video 1>.

overall_soundscape:
Reuse the source signal.

non_diegetic_music:
Directly reuse <Audio 1> unchanged.`;
  expect(
    'generate_video rejects implicit H3 source-audio intent',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: h3ExactAudioPrompt,
      videoModel: 'minimax-h3-r2v',
      referenceVideoIndices: [-1],
    }).ok,
    false,
  );
  expect(
    'generate_video still rejects sourceAudioPolicy on a non-R2V model',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: 'a plain clip',
      videoModel: 'minimax-h3-t2v',
      sourceAudioPolicy: 'replace',
    }).ok,
    false,
  );
  expect(
    'generate_video accepts typed exact H3 source-audio reuse',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: h3ExactAudioPrompt,
      videoModel: 'minimax-h3-r2v',
      referenceVideoIndices: [-1],
      sourceAudioPolicy: 'reuse_exact',
    }).ok,
    true,
  );
  expect(
    'generate_video rejects replacement prose under exact H3 source-audio reuse',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: h3ExactAudioPrompt
        .replace('audio reuse', 'audio reference')
        .replace('<Audio 1>: fully_copy', '<Audio 1>: reference'),
      videoModel: 'minimax-h3-r2v',
      referenceVideoIndices: [-1],
      sourceAudioPolicy: 'reuse_exact',
    }).ok,
    false,
  );
  expect(
    'animate_photo rejects loraStrengths without loras',
    validateAndNormalizeHostedToolArguments([animatePhotoDefinition], 'animate_photo', {
      prompt: 'r34l1sm, she turns to the window',
      videoModel: 'minimax-h3-i2v',
      loraStrengths: [0.8],
    }).ok,
    false,
  );
  // MiniMax H3 2K delivery is an integer enum, so 2 passes on both video tools
  // and anything else is rejected before a host forwards it to the SDK.
  expect(
    'generate_video accepts outputScale 2 for MiniMax H3',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: 'A lighthouse keeper watches the storm roll in.',
      videoModel: 'minimax-h3-t2v',
      outputScale: 2,
    }).ok,
    true,
  );
  expect(
    'generate_video rejects outputScale 3',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: 'A lighthouse keeper watches the storm roll in.',
      videoModel: 'minimax-h3-t2v',
      outputScale: 3,
    }).ok,
    false,
  );
  expect(
    'animate_photo accepts outputScale 2 for MiniMax H3',
    validateAndNormalizeHostedToolArguments([animatePhotoDefinition], 'animate_photo', {
      prompt: 'She turns to the window as the rain starts.',
      videoModel: 'minimax-h3-i2v',
      outputScale: 2,
    }).ok,
    true,
  );
  // edit_image gained LoRAs after the parity check was written against
  // generate_image by name, so it went unchecked until the check moved onto the
  // schema. Guard the regression rather than the one tool.
  expect(
    'edit_image rejects mismatched LoRA arrays',
    validateAndNormalizeHostedToolArguments([editImageDefinition], 'edit_image', {
      prompt: 'make her older',
      model: 'krea-identity-edit',
      loras: ['krea2-age'],
      loraStrengths: [2, 1],
    }).ok,
    false,
  );

  const openNestedPayload = {
    id: 'wf_existing',
    version: 7,
    stages: [{ id: 'storyboard', tool: 'generate_image' }],
    nullableNote: null,
  };
  const openNestedResult = validateAndNormalizeHostedToolArguments(
    [{
      function: {
        name: 'compose_workflow_template',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            brief: { type: 'string' },
            existing_template: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      },
    }],
    'compose_workflow_template',
    {
      brief: 'Change the saved template to portrait.',
      existing_template: openNestedPayload,
      invented_top_level_field: 'strip me',
    },
    { stripUnknownProperties: true },
  );
  expect(
    'hosted validation preserves explicitly open nested objects while stripping closed parent fields',
    openNestedResult.cleaned,
    {
      brief: 'Change the saved template to portrait.',
      existing_template: openNestedPayload,
    },
  );

  // maybeAlignNumberOfVariationsToDynamicBranchCount
  expect(
    'align: generate_image with 2-branch + N=1 aligns to N=2',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_image',
      { prompt: '{a pickle | a cucumber}', numberOfVariations: 1 },
      'draw 2 more',
    ),
    { prompt: '{a pickle | a cucumber}', numberOfVariations: 2 },
  );
  expect(
    'align: aligned prompt + N=2 returns null',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_image',
      { prompt: '{a | b}', numberOfVariations: 2 },
      'draw 2 more',
    ),
    null,
  );
  expect(
    'align: random-pick phrasing skips alignment',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_image',
      { prompt: '{a | b}', numberOfVariations: 1 },
      'pick one randomly',
    ),
    null,
  );
  expect(
    'align: non-image tool returns null',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_video',
      { prompt: '{a | b}', numberOfVariations: 1 },
      'draw 2 more',
    ),
    null,
  );
  expect(
    'align: prompt with multiple branches returns null',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_image',
      { prompt: '{a | b} on a {table | shelf}', numberOfVariations: 1 },
      'draw 2 more',
    ),
    null,
  );

  // generate_speech voiceSourceIndex addresses media the same way every other
  // tool does: negatives are uploads. A `minimum: 0` here used to reject the only
  // index a clone can realistically use — the recording the user just uploaded —
  // and the rejected call ended the whole turn.
  expect(
    'generate_speech accepts an uploaded voiceSourceIndex',
    validateAndNormalizeHostedToolArguments([generateSpeechDefinition], 'generate_speech', {
      prompt: 'Read this aloud.',
      model: 'clone',
      voiceSourceIndex: -1,
    }).ok,
    true,
  );
  expect(
    'generate_speech accepts a generated voiceSourceIndex',
    validateAndNormalizeHostedToolArguments([generateSpeechDefinition], 'generate_speech', {
      prompt: 'Read this aloud.',
      model: 'clone',
      voiceSourceIndex: 0,
    }).ok,
    true,
  );
  expect(
    'generate_speech rejects a non-numeric voiceSourceIndex',
    validateAndNormalizeHostedToolArguments([generateSpeechDefinition], 'generate_speech', {
      prompt: 'Read this aloud.',
      model: 'clone',
      voiceSourceIndex: 'first',
    }).ok,
    false,
  );

  console.log(`\ntools/shared: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}
