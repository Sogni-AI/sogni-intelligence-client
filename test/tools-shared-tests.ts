/**
 * Unit tests for the public-safe tool-arg normalization helpers.
 */
import {
  animatePhotoDefinition,
  editImageDefinition,
  generateVideoDefinition,
  generateImageDefinition,
  generateSpeechDefinition,
  soundToVideoDefinition,
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
    'model registry: generate_video includes H3 LightX2V, FastH3, two-stage, and R2V Turbo selectors',
    {
      t2vTurbo: generateVideoModelKeys.includes('minimax-h3-t2v-turbo'),
      fastH3T2vTurbo: generateVideoModelKeys.includes('minimax-h3-fasth3-t2v-turbo'),
      fastH3T2vTwoStage: generateVideoModelKeys.includes('minimax-h3-fasth3-t2v-turbo-2stage'),
      r2vTurbo: generateVideoModelKeys.includes('minimax-h3-r2v-turbo'),
      r2vTwoStage: generateVideoModelKeys.includes('minimax-h3-r2v-2stage'),
      r2vBalancedTwoStage: generateVideoModelKeys.includes('minimax-h3-r2v-balanced-2stage'),
    },
    { t2vTurbo: true, fastH3T2vTurbo: true, fastH3T2vTwoStage: true, r2vTurbo: true, r2vTwoStage: true, r2vBalancedTwoStage: true },
  );
  expect(
    'model registry: animate_photo includes H3 I2V and FLF2V Turbo selectors',
    {
      i2vTurbo: animatePhotoModelKeys.includes('minimax-h3-i2v-turbo'),
      flf2vTurbo: animatePhotoModelKeys.includes('minimax-h3-flf2v-turbo'),
      fastH3I2vTurbo: animatePhotoModelKeys.includes('minimax-h3-fasth3-i2v-turbo'),
      fastH3Flf2vTurbo: animatePhotoModelKeys.includes('minimax-h3-fasth3-flf2v-turbo'),
      fastH3I2vTwoStage: animatePhotoModelKeys.includes('minimax-h3-fasth3-i2v-turbo-2stage'),
      fastH3Flf2vTwoStage: animatePhotoModelKeys.includes('minimax-h3-fasth3-flf2v-turbo-2stage'),
      r2vTurbo: animatePhotoModelKeys.includes('minimax-h3-r2v-turbo'),
    },
    {
      i2vTurbo: true,
      flf2vTurbo: true,
      fastH3I2vTurbo: true,
      fastH3Flf2vTurbo: true,
      fastH3I2vTwoStage: true,
      fastH3Flf2vTwoStage: true,
      r2vTurbo: false,
    },
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
    ['generate_video', generateVideoDefinition, ['minimax-h3-t2v', 'minimax-h3-t2v-turbo', 'minimax-h3-fasth3-t2v-turbo', 'minimax-h3-fasth3-t2v-turbo-2stage', 'minimax-h3-r2v', 'minimax-h3-r2v-turbo', 'minimax-h3-r2v-2stage', 'minimax-h3-r2v-balanced-2stage']],
    ['animate_photo', animatePhotoDefinition, ['minimax-h3-i2v', 'minimax-h3-i2v-turbo', 'minimax-h3-fasth3-i2v-turbo', 'minimax-h3-fasth3-i2v-turbo-2stage', 'minimax-h3-flf2v', 'minimax-h3-flf2v-turbo', 'minimax-h3-fasth3-flf2v-turbo', 'minimax-h3-fasth3-flf2v-turbo-2stage']],
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
  // MiniMax H3 2K is the two-stage FastH3 selectors, not a request option: the
  // outputScale argument is gone from both video tools, and each two-stage
  // selector validates (with LoRAs) only on the tool that owns its mode.
  expect(
    'generate_video and animate_photo no longer declare outputScale',
    [generateVideoDefinition, animatePhotoDefinition].map(
      definition => 'outputScale' in (definition.function.parameters.properties ?? {}),
    ),
    [false, false],
  );
  for (const definition of [generateVideoDefinition, animatePhotoDefinition]) {
    const toolName = definition.function.name;
    const baseModel = toolName === 'generate_video'
      ? 'minimax-h3-fasth3-t2v-turbo'
      : 'minimax-h3-fasth3-i2v-turbo';
    for (const videoModel of [baseModel, `${baseModel}-2stage`, 'ltx25']) {
      for (const stripUnknownProperties of [false, true]) {
        for (const outputScale of [undefined, null, 0, 1, 2, '2']) {
          const result = validateAndNormalizeHostedToolArguments([definition], toolName, {
            prompt: 'A lighthouse keeper watches the storm roll in.',
            videoModel,
            outputScale,
          }, { stripUnknownProperties });
          expect(
            `${toolName} refuses retired outputScale ${String(outputScale)} on ${videoModel} with cleanup ${stripUnknownProperties}`,
            !result.ok && result.errors.some(error => error.includes('"outputScale" is no longer supported')),
            true,
          );
        }
        expect(
          `${toolName} accepts ${videoModel} without outputScale with cleanup ${stripUnknownProperties}`,
          validateAndNormalizeHostedToolArguments([definition], toolName, {
            prompt: 'A lighthouse keeper watches the storm roll in.',
            videoModel,
          }, { stripUnknownProperties }).ok,
          true,
        );
      }
    }
  }
  expect(
    'two-stage targetResolution docs name the delivered classes and keep 768p on the base FastH3 selector',
    [generateVideoDefinition, animatePhotoDefinition].map(definition => {
      const properties = definition.function.parameters.properties ?? {};
      const targetResolution = String(properties.targetResolution?.description ?? '');
      const videoModel = String(properties.videoModel?.description ?? '');
      return [
        targetResolution.includes('targetResolution names the delivered short-edge class'),
        ['384px canvas', '544px canvas', 'omit it for 2K'].every(text => targetResolution.includes(text)),
        videoModel.includes('for ordinary 768p FastH3 output keep the regular FastH3 selector at targetResolution 768'),
      ];
    }),
    [[true, true, true], [true, true, true]],
  );
  // Two-stage is priced by GPU time: 1080p 10, 2K 16, and 720p FastH3's own 4
  // Spark per second (socket, 2026-09-13).
  expect(
    'two-stage videoModel docs quote the 720p, 1080p and 2K prices',
    [generateVideoDefinition, animatePhotoDefinition].map(definition => {
      const videoModel = String(definition.function.parameters.properties?.videoModel?.description ?? '');
      return [
        videoModel.includes('(960x544 is delivered at 1920x1088) for 10 Spark per second'),
        videoModel.includes('(1344x768 is delivered at 2688x1536) for 16 Spark per second'),
        videoModel.includes('(672x384 is delivered at 1344x768) for the regular FastH3 price of 4 Spark per second'),
        videoModel.includes('14 Spark per second'),
      ];
    }),
    [[true, true, true, false], [true, true, true, false]],
  );
  expect(
    'generate_video accepts the FastH3 two-stage T2V selector with an H3 LoRA',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: 'r34l1sm, a lighthouse keeper watches the storm roll in.',
      videoModel: 'minimax-h3-fasth3-t2v-turbo-2stage',
      loras: ['h3-realism-people'],
      loraStrengths: [0.8],
    }).ok,
    true,
  );
  expect(
    'generate_video rejects the image-conditioned two-stage selectors',
    ['minimax-h3-fasth3-i2v-turbo-2stage', 'minimax-h3-fasth3-flf2v-turbo-2stage'].map(videoModel =>
      validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
        prompt: 'A lighthouse keeper watches the storm roll in.',
        videoModel,
      }).ok),
    [false, false],
  );
  expect(
    'animate_photo accepts the FastH3 two-stage I2V and FLF2V selectors',
    ['minimax-h3-fasth3-i2v-turbo-2stage', 'minimax-h3-fasth3-flf2v-turbo-2stage'].map(videoModel =>
      validateAndNormalizeHostedToolArguments([animatePhotoDefinition], 'animate_photo', {
        prompt: 'She turns to the window as the rain starts.',
        videoModel,
      }).ok),
    [true, true],
  );
  expect(
    'animate_photo rejects the two-stage T2V selector',
    validateAndNormalizeHostedToolArguments([animatePhotoDefinition], 'animate_photo', {
      prompt: 'She turns to the window as the rain starts.',
      videoModel: 'minimax-h3-fasth3-t2v-turbo-2stage',
    }).ok,
    false,
  );
  // Two-stage reference-to-video: the Standard and Balanced R2V tiers get their
  // own selector on generate_video only, with the references, LoRAs, retired
  // outputScale refusal and source-audio rule of their one-stage forms. The
  // source-audio gate mirrors the base exactly: minimax-h3-r2v is gated, so
  // minimax-h3-r2v-2stage is; minimax-h3-r2v-balanced is not (it is a
  // patch-layer selector, absent from this raw enum), so
  // minimax-h3-r2v-balanced-2stage is not either.
  const h3TwoStageSourceAudio = (videoModel: string, sourceAudioPolicy?: string) =>
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: h3ExactAudioPrompt,
      videoModel,
      referenceVideoIndices: [-1],
      ...(sourceAudioPolicy === undefined ? {} : { sourceAudioPolicy }),
    }).ok;
  expect(
    'generate_video requires sourceAudioPolicy on the Standard two-stage R2V selector with a reference video',
    h3TwoStageSourceAudio('minimax-h3-r2v-2stage'),
    false,
  );
  expect(
    'generate_video accepts typed exact source-audio reuse on the Standard two-stage R2V selector',
    h3TwoStageSourceAudio('minimax-h3-r2v-2stage', 'reuse_exact'),
    true,
  );
  expect(
    'generate_video accepts the Balanced two-stage R2V selector with a reference video and no sourceAudioPolicy, like its ungated base',
    h3TwoStageSourceAudio('minimax-h3-r2v-balanced-2stage'),
    true,
  );
  // Not REQUIRING the policy on Balanced mirrors its base. Refusing it did not:
  // Balanced is an H3 R2V model, the host applies the policy to it, and the tool
  // description tells callers every H3 R2V call takes one. Until 2026-09 this was
  // refused as "only supported by MiniMax H3 R2V models".
  expect(
    'generate_video accepts typed exact source-audio reuse on the Balanced two-stage R2V selector',
    h3TwoStageSourceAudio('minimax-h3-r2v-balanced-2stage', 'reuse_exact'),
    true,
  );
  expect(
    'generate_video holds a Balanced call that names a policy to the same prompt contract as Standard',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: 'A dancer turns under warm stage light.',
      videoModel: 'minimax-h3-r2v-balanced-2stage',
      referenceVideoIndices: [-1],
      sourceAudioPolicy: 'reuse_exact',
    }).ok,
    false,
  );
  expect(
    'generate_video still rejects sourceAudioPolicy on an H3 model that is not reference to video',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: 'A dancer turns under warm stage light.',
      videoModel: 'minimax-h3-t2v',
      sourceAudioPolicy: 'replace',
    }).ok,
    false,
  );
  for (const videoModel of ['minimax-h3-r2v-2stage', 'minimax-h3-r2v-balanced-2stage']) {
    expect(
      `generate_video accepts ${videoModel} with image references and an H3 LoRA`,
      validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
        prompt: h3ExactAudioPrompt,
        videoModel,
        referenceImageIndices: [-1],
        loras: ['h3-realism-people'],
        loraStrengths: [0.8],
      }).ok,
      true,
    );
    expect(
      `generate_video refuses retired outputScale on ${videoModel}`,
      validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
        prompt: h3ExactAudioPrompt,
        videoModel,
        referenceImageIndices: [-1],
        outputScale: 2,
      }).ok,
      false,
    );
    expect(
      `animate_photo rejects ${videoModel}`,
      validateAndNormalizeHostedToolArguments([animatePhotoDefinition], 'animate_photo', {
        prompt: 'She turns to the window as the rain starts.',
        videoModel,
      }).ok,
      false,
    );
  }
  // MiniMax H3 FastH3 audio guide on sound_to_video: six selectors, never the
  // default, with endImageIndex for the first/last-frame mode and refusals for
  // argument sets the socket would refuse.
  const audioGuideSelectors = [
    'minimax-h3-fasth3-ia2v-turbo',
    'minimax-h3-fasth3-ia2v-turbo-2stage',
    'minimax-h3-fasth3-flfa2v-turbo',
    'minimax-h3-fasth3-flfa2v-turbo-2stage',
    'minimax-h3-fasth3-a2v-turbo',
    'minimax-h3-fasth3-a2v-turbo-2stage',
  ];
  const soundToVideoProperties = soundToVideoDefinition.function.parameters.properties ?? {};
  const soundToVideoModelEnum = (soundToVideoProperties.videoModel?.enum ?? []) as string[];
  expect(
    'sound_to_video lists the six MiniMax H3 audio selectors after the existing models',
    soundToVideoModelEnum.slice(-6),
    audioGuideSelectors,
  );
  expect(
    'model registry: sound_to_video options match its videoModel enum',
    getModelOptions('sound_to_video').map(option => option.key),
    soundToVideoModelEnum,
  );
  const soundToVideoModelDescription = String(soundToVideoProperties.videoModel?.description ?? '');
  const soundToVideoFunctionDescription = soundToVideoDefinition.function.description;
  expect(
    'sound_to_video keeps LTX 2.5 as the default and names H3 audio only on request',
    [
      soundToVideoModelDescription.includes('"ltx25-ia2v" (default with image)'),
      soundToVideoModelDescription.includes('never pick them in place of the LTX 2.5 defaults'),
      soundToVideoFunctionDescription.includes('use ltx25-ia2v by default'),
      soundToVideoFunctionDescription.includes('only when the user asks for MiniMax H3 or FastH3'),
      soundToVideoModelDescription.includes('124-362 frames'),
      soundToVideoModelDescription.includes('audioStart picks the window'),
      soundToVideoModelDescription.includes('have no 720p price class'),
    ],
    [true, true, true, true, true, true, true],
  );
  expect(
    'sound_to_video declares endImageIndex as a number',
    soundToVideoProperties.endImageIndex?.type,
    'number',
  );
  const soundToVideoResult = (args: Record<string, unknown>) => {
    const result = validateAndNormalizeHostedToolArguments([soundToVideoDefinition], 'sound_to_video', {
      prompt: 'She reads the line to camera.',
      ...args,
    });
    return result.ok ? 'ok' : result.errors.join(' | ');
  };
  expect(
    'sound_to_video accepts each H3 audio mode with the frames it takes',
    [
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-ia2v-turbo', sourceImageIndex: -1, audioStart: 2 }),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-ia2v-turbo-2stage', targetResolution: 1080 }),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-flfa2v-turbo', sourceImageIndex: -1, endImageIndex: -2 }),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-flfa2v-turbo-2stage', sourceImageIndex: 0, endImageIndex: 1 }),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-a2v-turbo', duration: 15 }),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-a2v-turbo-2stage', generateAudio: true }),
    ],
    ['ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
  );
  expect(
    'sound_to_video refuses H3 audio argument sets the socket would refuse',
    [
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-flfa2v-turbo', sourceImageIndex: -1 }).includes('needs both "sourceImageIndex" (first frame) and "endImageIndex"'),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-flfa2v-turbo-2stage', endImageIndex: -2 }).includes('needs both'),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-ia2v-turbo', sourceImageIndex: -1, endImageIndex: -2 }).includes('"endImageIndex" is only supported'),
      soundToVideoResult({ videoModel: 'ltx25-ia2v', sourceImageIndex: 0, endImageIndex: 1 }).includes('"endImageIndex" is only supported'),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-a2v-turbo', sourceImageIndex: -1 }).includes('is audio only'),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-a2v-turbo-2stage', endImageIndex: -1 }).includes('"endImageIndex" is only supported'),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-ia2v-turbo', generateAudio: false }).includes('always delivers the uploaded audio'),
      soundToVideoResult({ videoModel: 'minimax-h3-fasth3-a2v-turbo', negativePrompt: 'blur' }).includes('no negative-prompt input'),
    ],
    [true, true, true, true, true, true, true, true],
  );
  expect(
    'sound_to_video leaves non-H3 audio models unchanged',
    [
      soundToVideoResult({ videoModel: 'ltx25-a2v', generateAudio: false, negativePrompt: 'blur' }),
      soundToVideoResult({ videoModel: 'ltx25-ia2v', sourceImageIndex: 0 }),
    ],
    ['ok', 'ok'],
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
