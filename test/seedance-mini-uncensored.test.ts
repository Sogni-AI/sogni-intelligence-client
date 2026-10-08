import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MODEL_CONSENT_REQUIRED_ERROR,
  MODEL_CONSENT_REQUIRED_MESSAGE,
  MODEL_NOT_YET_AVAILABLE_ERROR,
  SEEDANCE_MINI_UNCENSORED_CONSENT_REQUIRED_MESSAGE,
  SogniClientWrapper,
  SogniModelConsentRequiredError,
  isSeedance25UncensoredVideoModelId,
  isSeedance25VideoModelId,
  isSeedanceMiniUncensoredVideoModelId,
  isSeedanceMiniVideoModelId,
  isSeedanceVideoModelId,
  modelConsentRequiredPayloadFromError,
  modelNotYetAvailablePayloadFromError,
  resolveSeedanceVideoModelId,
  validateProjectConfig,
  type VideoProjectConfig,
} from '../src/index.js';
import {
  buildStoryboardVideoHostedToolSequenceInput,
  classifySkillError,
  compileForModel,
  getBuiltinVideoModelConfig,
  resolveVideoModelAlias,
} from '../src/public-skill-runtime/index.js';
import {
  MODELS_BY_TOOL,
  SEEDANCE_MINI_UNCENSORED_MODEL_DESCRIPTION,
  SEEDANCE_PROVIDER_CONTENT_POLICY_MESSAGE,
  SEEDANCE_REAL_PERSON_PRIVACY_MESSAGE,
  seedanceSocketContentRefusalMessage,
  seedanceTerminalPolicyPayloadFromError,
  animatePhotoDefinition,
  extendVideoDefinition,
  generateVideoDefinition,
  getSeedanceReferenceLimits,
  replaceVideoSegmentDefinition,
  seedanceTerminalGenerationFailurePayloadFromError,
  soundToVideoDefinition,
  videoToVideoDefinition,
} from '../src/tools/index.js';
import { getVideoModelConfig } from '../src/media/index.js';

const MINI_UNCENSORED_ID = 'seedance-2-0-mini-uncensored';
const MINI_SOCKET_MESSAGE =
  'Seedance 2.0 Mini Uncensored requires a one-time likeness and consent agreement. Review and accept it in the Sogni app, then try again.';
// One agreement covers both uncensored Seedance models; the refusal names the requested model.
const CONSENT = { key: 'seedance-2-5-uncensored', version: 2, modelId: MINI_UNCENSORED_ID };

test('every Seedance Mini tool enum lists seedance2-mini-uncensored right after seedance2-mini', () => {
  for (const definition of [
    generateVideoDefinition,
    soundToVideoDefinition,
    videoToVideoDefinition,
    extendVideoDefinition,
    replaceVideoSegmentDefinition,
  ]) {
    const values = definition.function.parameters.properties.videoModel.enum as string[];
    const index = values.indexOf('seedance2-mini');
    assert.ok(index >= 0, definition.function.name);
    assert.equal(values[index + 1], 'seedance2-mini-uncensored', definition.function.name);
  }
  const animateValues = animatePhotoDefinition.function.parameters.properties.videoModel.enum as string[];
  assert.equal(animateValues.includes('seedance2-mini-uncensored'), false);
  // The shared wording is exported from ./tools so downstream patch layers quote it exactly.
  for (const definition of [generateVideoDefinition, soundToVideoDefinition, videoToVideoDefinition]) {
    const description = definition.function.parameters.properties.videoModel.description as string;
    assert.ok(description.includes(SEEDANCE_MINI_UNCENSORED_MODEL_DESCRIPTION), definition.function.name);
  }
  assert.match(SEEDANCE_MINI_UNCENSORED_MODEL_DESCRIPTION, /error 4103/);
  assert.match(SEEDANCE_MINI_UNCENSORED_MODEL_DESCRIPTION, /never swap it in for "seedance2-mini" or "seedance2-5-uncensored"/);
});

test('Seedance 2.0 Mini Uncensored is named Seedance 2.0 Mini Uncensored, never Spicy', () => {
  for (const tool of ['generate_video', 'sound_to_video', 'video_to_video']) {
    const options = MODELS_BY_TOOL[tool] ?? [];
    const index = options.findIndex(candidate => candidate.key === 'seedance2-mini-uncensored');
    assert.ok(index > 0, tool);
    assert.equal(options[index - 1]?.key, 'seedance2-mini', tool);
    assert.match(options[index]!.displayName, /^Seedance 2\.0 Mini Uncensored/);
    assert.doesNotMatch(options[index]!.displayName, /spicy/i);
  }
});

test('Mini Uncensored names resolve to their own id and never to Mini or Seedance 2.5 Uncensored', () => {
  for (const name of [
    MINI_UNCENSORED_ID,
    'seedance2-mini-uncensored',
    'seedance2-mini-uncensored-t2v',
    'seedance-mini-uncensored',
    'seedance-mini-spicy',
    'Seedance2-Mini-Uncensored',
  ]) {
    assert.equal(resolveSeedanceVideoModelId(name), MINI_UNCENSORED_ID, name);
    assert.equal(resolveVideoModelAlias(name, 't2v'), MINI_UNCENSORED_ID, name);
    assert.equal(isSeedanceVideoModelId(name), true, name);
    assert.equal(isSeedanceMiniVideoModelId(name), true, name);
    assert.equal(isSeedanceMiniUncensoredVideoModelId(name), true, name);
    assert.equal(isSeedance25VideoModelId(name), false, name);
    assert.equal(isSeedance25UncensoredVideoModelId(name), false, name);
  }
  // The plain Mini selector and the Seedance 2.5 Uncensored names keep their own ids.
  assert.equal(resolveSeedanceVideoModelId('seedance2-mini'), 'seedance-2-0-mini');
  assert.equal(isSeedanceMiniVideoModelId('seedance2-mini'), true);
  assert.equal(isSeedanceMiniUncensoredVideoModelId('seedance2-mini'), false);
  for (const name of ['seedance-uncensored', 'seedance-spicy', 'seedance2-5-uncensored']) {
    assert.equal(resolveSeedanceVideoModelId(name), 'seedance-2-5-uncensored', name);
    assert.equal(isSeedanceMiniVideoModelId(name), false, name);
  }
  assert.equal(resolveSeedanceVideoModelId('seedance-2-0-mini-uncensored-ultra'), null);
});

test('Seedance 2.0 Mini Uncensored keeps its own id with the Seedance 2.0 Mini limits', () => {
  const config = getVideoModelConfig('seedance2-mini-uncensored');
  const mini = getVideoModelConfig('seedance2-mini');
  assert.equal(config.model, MINI_UNCENSORED_ID);
  assert.equal(config.maxDimension, mini.maxDimension);
  assert.equal(config.fps, mini.fps);
  // Mini has no built-in runtime config, and neither does its uncensored variant.
  assert.equal(getBuiltinVideoModelConfig(MINI_UNCENSORED_ID), getBuiltinVideoModelConfig('seedance-2-0-mini'));

  assert.deepEqual(getSeedanceReferenceLimits(MINI_UNCENSORED_ID), getSeedanceReferenceLimits('seedance-2-0-mini'));
  assert.deepEqual(getSeedanceReferenceLimits('seedance2-mini-uncensored'), { images: 9, videos: 3, audios: 3, assets: 12 });

  const project: VideoProjectConfig = {
    type: 'video',
    modelId: MINI_UNCENSORED_ID,
    positivePrompt: 'A slow dolly through a neon street at night',
    duration: 15,
  };
  assert.doesNotThrow(() => validateProjectConfig(project));
  assert.throws(() => validateProjectConfig({ ...project, duration: 16 }), /between 4 and 15 seconds/);
});

test('the Seedance storyboard adapter keeps the Mini Uncensored selector at 720p and up to 15s', () => {
  const storyline = [
    '| Beat | Time | Purpose | Visual/Action | Camera/Motion | Dialogue/VO | Audio/SFX | Transition |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 01 | 0s-6s | Setup | A dancer under a single spotlight. | Slow push-in. | [no dialogue] | Room tone. | Cut. |',
    '| 02 | 6s-12s | Turn | The dancer spins into the dark. | Orbit. | [no dialogue] | Low strings. | End. |',
  ].join('\n');
  const plan = buildStoryboardVideoHostedToolSequenceInput({
    storyline,
    userIntentText: 'Create a 24-second storyboard video with Seedance 2.0 Mini Uncensored.',
    frameCount: 2,
    videoModel: 'seedance2-mini-uncensored',
    videoDurationSec: 24,
  });
  assert.equal(plan.video.model, 'seedance2-mini-uncensored');
  assert.equal(plan.video.duration, 15);
  assert.equal(plan.input.steps[1]?.arguments.videoModel, 'seedance2-mini-uncensored');
  assert.equal(plan.input.steps[1]?.arguments.targetResolution, 720);
  assert.equal(Math.min(plan.video.width, plan.video.height), 720);

  const clip = compileForModel('seedance2-mini-uncensored', plan.storyboardProject, {
    stage: 'scene_clip',
    scene: { ...plan.storyboardProject.scenes[0], durationSec: 28 },
  });
  assert.equal(clip.args.videoModel, 'seedance2-mini-uncensored');
  assert.equal('targetResolution' in clip.args, false);
  assert.equal(clip.args.duration, 15);
});

test('a Mini Uncensored 4103 names Seedance 2.0 Mini Uncensored and keeps the shared agreement', () => {
  const sdkError = { code: 4103, message: MINI_SOCKET_MESSAGE, consentRequired: CONSENT };
  const payload = modelConsentRequiredPayloadFromError(sdkError);
  assert.ok(payload);
  assert.equal(payload.error, MODEL_CONSENT_REQUIRED_ERROR);
  assert.equal(payload.message, SEEDANCE_MINI_UNCENSORED_CONSENT_REQUIRED_MESSAGE);
  assert.equal(payload.message, MINI_SOCKET_MESSAGE);
  assert.equal(payload.nextAction, 'wait_for_user');
  assert.deepEqual(payload.consentRequired, CONSENT);

  const socketJobError = {
    error: '4103',
    isFromWorker: false,
    jobID: 'job-1',
    error_message: MINI_SOCKET_MESSAGE,
    consentRequired: CONSENT,
  };
  assert.equal(modelConsentRequiredPayloadFromError(socketJobError)?.message, MINI_SOCKET_MESSAGE);

  // A refusal that kept only the socket's text still names the model.
  for (const textOnly of [
    new Error(`All 1 video generation jobs failed: ${MINI_SOCKET_MESSAGE}`),
    { error: 'model_consent_required', message: MINI_SOCKET_MESSAGE },
  ]) {
    assert.equal(modelConsentRequiredPayloadFromError(textOnly)?.message, MINI_SOCKET_MESSAGE);
  }

  // A Seedance 2.5 Uncensored refusal under the same key keeps its own wording.
  assert.equal(
    modelConsentRequiredPayloadFromError({
      code: 4103,
      consentRequired: { ...CONSENT, modelId: 'seedance-2-5-uncensored' },
    })?.message,
    MODEL_CONSENT_REQUIRED_MESSAGE,
  );

  assert.deepEqual(classifySkillError(sdkError), {
    error_type: 'PERMISSION_REQUIRED',
    category: 'permission_required',
    message: MINI_SOCKET_MESSAGE,
    retryable: false,
  });
  const failure = seedanceTerminalGenerationFailurePayloadFromError(
    new Error(`All 1 video generation jobs failed: ${MINI_SOCKET_MESSAGE}`, { cause: sdkError }),
  );
  assert.equal(failure?.error, MODEL_CONSENT_REQUIRED_ERROR);
  assert.equal(failure?.message, MINI_SOCKET_MESSAGE);
});

test('createProject turns a Mini Uncensored 4103 into SogniModelConsentRequiredError and never retries it', async () => {
  const wrapper = new SogniClientWrapper({ username: 'test-user', password: 'test-pass', autoConnect: false });
  let createdModel: string | undefined;
  let created = 0;
  (wrapper as any).client = {
    projects: {
      create: async (params: { modelId: string }) => {
        created++;
        createdModel = params.modelId;
        return {
          id: 'project-mini-consent',
          jobs: [],
          on: () => {},
          // The SDK rejects with its plain ErrorData object, not an Error.
          waitForCompletion: () =>
            Promise.reject({ code: 4103, message: MINI_SOCKET_MESSAGE, consentRequired: CONSENT }),
        };
      },
    },
  };
  (wrapper as any).connectionState = { ...(wrapper as any).connectionState, isConnected: true };

  await assert.rejects(
    wrapper.createProjectWithRetry(
      {
        type: 'video',
        modelId: MINI_UNCENSORED_ID,
        positivePrompt: 'A slow dolly through a neon street at night',
        duration: 5,
        numberOfMedia: 1,
      } as VideoProjectConfig,
      { maxAttempts: 3, retryDelay: 1 },
    ),
    (error: unknown) => {
      assert.ok(error instanceof SogniModelConsentRequiredError);
      assert.equal(error.message, MINI_SOCKET_MESSAGE);
      assert.deepEqual(error.payload.consentRequired, CONSENT);
      return true;
    },
  );
  assert.equal(created, 1);
  assert.equal(createdModel, MINI_UNCENSORED_ID);
});

test('a Mini Uncensored 4104 keeps the socket message and the refused model id', () => {
  const heldMessage = 'This model is not yet available, try Wan 3 Spicy or MiniMax H3 video in the meantime.';
  const payload = modelNotYetAvailablePayloadFromError({
    error: '4104',
    isFromWorker: false,
    modelId: MINI_UNCENSORED_ID,
    error_message: heldMessage,
  });
  assert.ok(payload);
  assert.equal(payload.error, MODEL_NOT_YET_AVAILABLE_ERROR);
  assert.equal(payload.message, heldMessage);
  assert.equal(payload.modelId, MINI_UNCENSORED_ID);
  assert.equal(modelConsentRequiredPayloadFromError({ code: 4104, message: heldMessage }), null);
});

test('Seedance content refusals keep the socket text and the counterpart it suggests', () => {
  const blocked = "Seedance blocked this video because it did not pass the provider's content policy. No video was returned.";
  const realPerson = 'Seedance rejected the input image because it may contain a real person.';
  for (const socketMessage of [
    // Released: the counterpart first (seedance-2-0-mini → Seedance 2.0 Mini Uncensored).
    `${blocked} Try Seedance 2.0 Mini Uncensored, Wan 3 Uncensored or MiniMax H3 instead.`,
    // Held: the socket names only models that run there.
    `${blocked} Try Wan 3 Uncensored or MiniMax H3 instead.`,
    // The uncensored models' own failures carry no suggestion.
    blocked,
  ]) {
    for (const error of [
      { code: 5061, message: socketMessage, vendorFailureCategory: 'content_policy' },
      new Error(`All 1 video generation jobs failed: ${socketMessage}`),
    ]) {
      const payload = seedanceTerminalPolicyPayloadFromError(error);
      assert.equal(payload?.error, 'seedance_content_policy');
      assert.equal(payload?.message, socketMessage);
      assert.equal(payload?.nextAction, 'wait_for_user');
      assert.equal(payload?.recovery, undefined);
      assert.equal(seedanceSocketContentRefusalMessage(error), socketMessage);
    }
  }

  const realPersonMessage = `${realPerson} Try Seedance 2.5 Uncensored, Wan 3 Uncensored or MiniMax H3 instead.`;
  const privacy = seedanceTerminalPolicyPayloadFromError({
    code: 5061,
    message: realPersonMessage,
    vendorFailureCategory: 'content_policy',
    vendorErrorCode: 'InputImageSensitiveContentDetected.PrivacyInformation',
  });
  assert.equal(privacy?.error, 'seedance_input_image_privacy_policy');
  assert.equal(privacy?.message, realPersonMessage);
  assert.equal(privacy?.recovery?.kind, 'stylize_source_then_resubmit');

  // Raw vendor errors without the socket's sentence keep the package wording.
  assert.equal(
    seedanceTerminalPolicyPayloadFromError(new Error('Seedance blocked: content_policy moderation safety violation 5061'))?.message,
    SEEDANCE_PROVIDER_CONTENT_POLICY_MESSAGE,
  );
  assert.equal(
    seedanceTerminalPolicyPayloadFromError(
      new Error('Seedance vendor task status=failed code 5061 InputImageSensitiveContentDetected.PrivacyInformation may contain a real person'),
    )?.message,
    SEEDANCE_REAL_PERSON_PRIVACY_MESSAGE,
  );
  assert.equal(seedanceSocketContentRefusalMessage(new Error('Vendor job failed: timeout')), null);
});
