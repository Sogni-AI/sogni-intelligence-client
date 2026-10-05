import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MODEL_CONSENT_REQUIRED_ERROR,
  MODEL_CONSENT_REQUIRED_ERROR_CODE,
  MODEL_CONSENT_REQUIRED_MESSAGE,
  MODEL_NOT_YET_AVAILABLE_ERROR,
  MODEL_NOT_YET_AVAILABLE_ERROR_CODE,
  SogniClientWrapper,
  SogniModelConsentRequiredError,
  SogniModelNotYetAvailableError,
  modelConsentRequiredPayloadFromError,
  modelNotYetAvailablePayloadFromError,
  validateProjectConfig,
  type VideoProjectConfig,
} from '../src/index.js';
import {
  buildStoryboardVideoHostedToolSequenceInput,
  classifySkillError,
  compileForModel,
  getBuiltinVideoModelConfig,
} from '../src/public-skill-runtime/index.js';
import {
  MODELS_BY_TOOL,
  SEEDANCE_25_UNCENSORED_MODEL_DESCRIPTION,
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

const UNCENSORED_ID = 'seedance-2-5-uncensored';
const SOCKET_MESSAGE =
  'Seedance 2.5 Uncensored requires a one-time likeness and consent agreement. Review and accept it in the Sogni app, then try again.';
const CONSENT = { key: UNCENSORED_ID, version: 1, modelId: UNCENSORED_ID };

test('every Seedance 2.5 tool enum lists seedance2-5-uncensored right after seedance2-5', () => {
  for (const definition of [
    generateVideoDefinition,
    soundToVideoDefinition,
    videoToVideoDefinition,
    extendVideoDefinition,
    replaceVideoSegmentDefinition,
  ]) {
    const values = definition.function.parameters.properties.videoModel.enum as string[];
    const index = values.indexOf('seedance2-5');
    assert.ok(index >= 0, definition.function.name);
    assert.equal(values[index + 1], 'seedance2-5-uncensored', definition.function.name);
  }
  const animateValues = animatePhotoDefinition.function.parameters.properties.videoModel.enum as string[];
  assert.equal(animateValues.includes('seedance2-5-uncensored'), false);
  // The shared wording is exported from ./tools so downstream patch layers quote it exactly.
  for (const definition of [generateVideoDefinition, soundToVideoDefinition, videoToVideoDefinition]) {
    const description = definition.function.parameters.properties.videoModel.description as string;
    assert.ok(description.includes(SEEDANCE_25_UNCENSORED_MODEL_DESCRIPTION), definition.function.name);
  }
  assert.match(SEEDANCE_25_UNCENSORED_MODEL_DESCRIPTION, /error 4103/);
});

test('Seedance 2.5 Uncensored is named Seedance 2.5 Uncensored, never Spicy', () => {
  for (const tool of ['generate_video', 'sound_to_video', 'video_to_video']) {
    const option = MODELS_BY_TOOL[tool]?.find(candidate => candidate.key === 'seedance2-5-uncensored');
    assert.ok(option, tool);
    assert.match(option.displayName, /^Seedance 2\.5 Uncensored/);
    assert.doesNotMatch(option.displayName, /spicy/i);
  }
});

test('Seedance 2.5 Uncensored keeps its own id with the Seedance 2.5 limits', () => {
  const config = getVideoModelConfig('seedance2-5-uncensored');
  assert.equal(config.model, UNCENSORED_ID);
  assert.equal(config.maxFrames, getVideoModelConfig('seedance2-5').maxFrames);
  assert.equal(config.maxDimension, getVideoModelConfig('seedance2-5').maxDimension);

  const builtin = getBuiltinVideoModelConfig(UNCENSORED_ID);
  assert.ok(builtin);
  assert.equal(builtin.maxFrames, 721);

  assert.deepEqual(getSeedanceReferenceLimits(UNCENSORED_ID), getSeedanceReferenceLimits('seedance-2-5'));
  assert.deepEqual(getSeedanceReferenceLimits('seedance2-5-uncensored'), { images: 30, videos: 10, audios: 10, assets: 50 });

  const project: VideoProjectConfig = {
    type: 'video',
    modelId: UNCENSORED_ID,
    positivePrompt: 'A slow dolly through a neon street at night',
    duration: 30,
  };
  assert.doesNotThrow(() => validateProjectConfig(project));
  assert.throws(() => validateProjectConfig({ ...project, duration: 31 }), /between 4 and 30 seconds/);
});

test('the Seedance storyboard adapter keeps the uncensored selector at 1080p and up to 30s', () => {
  const storyline = [
    '| Beat | Time | Purpose | Visual/Action | Camera/Motion | Dialogue/VO | Audio/SFX | Transition |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 01 | 0s-12s | Setup | A dancer under a single spotlight. | Slow push-in. | [no dialogue] | Room tone. | Cut. |',
    '| 02 | 12s-24s | Turn | The dancer spins into the dark. | Orbit. | [no dialogue] | Low strings. | End. |',
  ].join('\n');
  const plan = buildStoryboardVideoHostedToolSequenceInput({
    storyline,
    userIntentText: 'Create a 24-second storyboard video with Seedance 2.5 Uncensored.',
    frameCount: 2,
    videoModel: 'seedance2-5-uncensored',
    videoDurationSec: 24,
  });
  assert.equal(plan.video.model, 'seedance2-5-uncensored');
  assert.equal(plan.video.duration, 24);
  assert.equal(plan.input.steps[1]?.arguments.videoModel, 'seedance2-5-uncensored');
  assert.equal(plan.input.steps[1]?.arguments.targetResolution, 1080);

  const clip = compileForModel('seedance2-5-uncensored', plan.storyboardProject, {
    stage: 'scene_clip',
    scene: { ...plan.storyboardProject.scenes[0], durationSec: 28 },
  });
  assert.equal(clip.args.videoModel, 'seedance2-5-uncensored');
  assert.equal(clip.args.targetResolution, 1080);
  assert.equal(clip.args.duration, 28);
});

test('4103 refusals map to the typed, non-retryable consent payload', () => {
  const sdkError = { code: 4103, message: SOCKET_MESSAGE, consentRequired: CONSENT };
  const payload = modelConsentRequiredPayloadFromError(sdkError);
  assert.ok(payload);
  assert.equal(payload.error, MODEL_CONSENT_REQUIRED_ERROR);
  assert.equal(payload.errorCode, MODEL_CONSENT_REQUIRED_ERROR_CODE);
  assert.equal(payload.errorCode, 4103);
  assert.equal(payload.message, MODEL_CONSENT_REQUIRED_MESSAGE);
  assert.match(payload.message, /accept it in the Sogni app/);
  assert.equal(payload.retryPolicy, 'manual_user_confirmation');
  assert.equal(payload.nextAction, 'wait_for_user');
  assert.deepEqual(payload.consentRequired, CONSENT);

  const socketJobError = {
    error: '4103',
    isFromWorker: false,
    jobID: 'job-1',
    error_message: SOCKET_MESSAGE,
    consentRequired: CONSENT,
  };
  assert.deepEqual(modelConsentRequiredPayloadFromError(socketJobError)?.consentRequired, CONSENT);
  assert.equal(modelConsentRequiredPayloadFromError(4103)?.error, MODEL_CONSENT_REQUIRED_ERROR);
  assert.equal(modelConsentRequiredPayloadFromError('4103')?.error, MODEL_CONSENT_REQUIRED_ERROR);
  assert.equal(modelConsentRequiredPayloadFromError(new Error(SOCKET_MESSAGE))?.error, MODEL_CONSENT_REQUIRED_ERROR);

  const wrapped = new Error('All 1 video generation jobs failed', { cause: sdkError });
  assert.deepEqual(modelConsentRequiredPayloadFromError(wrapped)?.consentRequired, CONSENT);

  for (const unrelated of [
    null,
    4102,
    { code: 4102, message: 'This prompt is too long for the model.' },
    new Error('Vendor job failed: timeout'),
    { error: 'seedance_generation_failed', message: 'Seedance hit a snag' },
  ]) {
    assert.equal(modelConsentRequiredPayloadFromError(unrelated), null);
  }
});

test('the public skill classifier reports 4103 as a non-retryable permission', () => {
  for (const error of [
    { code: 4103, message: SOCKET_MESSAGE, consentRequired: CONSENT },
    new Error(SOCKET_MESSAGE),
  ]) {
    assert.deepEqual(classifySkillError(error), {
      error_type: 'PERMISSION_REQUIRED',
      category: 'permission_required',
      message: MODEL_CONSENT_REQUIRED_MESSAGE,
      retryable: false,
    });
  }
});

test('Seedance failure mapping reports 4103 as consent, not a retryable vendor failure', () => {
  const payload = seedanceTerminalGenerationFailurePayloadFromError(
    new Error(`All 1 video generation jobs failed: ${SOCKET_MESSAGE}`, {
      cause: { code: 4103, message: SOCKET_MESSAGE, consentRequired: CONSENT },
    }),
  );
  assert.ok(payload);
  assert.equal(payload.error, MODEL_CONSENT_REQUIRED_ERROR);
  assert.equal('reportIssue' in payload, false);
  assert.equal(payload.nextAction, 'wait_for_user');
});

test('the wrapper throws a typed consent error and never retries it', async () => {
  const wrapper = new SogniClientWrapper({ username: 'test-user', password: 'test-pass', autoConnect: false });
  let attempts = 0;
  (wrapper as any).createProject = async () => {
    attempts++;
    throw new SogniModelConsentRequiredError(
      modelConsentRequiredPayloadFromError({ code: 4103, message: SOCKET_MESSAGE, consentRequired: CONSENT })!,
    );
  };
  await assert.rejects(
    wrapper.createProjectWithRetry(
      { type: 'video', modelId: UNCENSORED_ID, positivePrompt: 'test' } as VideoProjectConfig,
      { maxAttempts: 3, retryDelay: 1 },
    ),
    (error: unknown) => {
      assert.ok(error instanceof SogniModelConsentRequiredError);
      assert.equal(error.code, 'MODEL_CONSENT_REQUIRED');
      assert.deepEqual(error.payload.consentRequired, CONSENT);
      assert.deepEqual(error.details.consentRequired, CONSENT);
      return true;
    },
  );
  assert.equal(attempts, 1);
});

test('createProject turns the SDK 4103 job error into SogniModelConsentRequiredError', async () => {
  const wrapper = new SogniClientWrapper({ username: 'test-user', password: 'test-pass', autoConnect: false });
  let createdModel: string | undefined;
  (wrapper as any).client = {
    projects: {
      create: async (params: { modelId: string }) => {
        createdModel = params.modelId;
        return {
          id: 'project-consent',
          jobs: [],
          on: () => {},
          // The SDK rejects with its plain ErrorData object, not an Error.
          waitForCompletion: () => Promise.reject({ code: 4103, message: SOCKET_MESSAGE, consentRequired: CONSENT }),
        };
      },
    },
  };
  (wrapper as any).connectionState = { ...(wrapper as any).connectionState, isConnected: true };

  await assert.rejects(
    wrapper.createProject({
      type: 'video',
      modelId: UNCENSORED_ID,
      positivePrompt: 'A slow dolly through a neon street at night',
      duration: 5,
      numberOfMedia: 1,
    } as VideoProjectConfig),
    (error: unknown) => {
      assert.ok(error instanceof SogniModelConsentRequiredError);
      assert.equal(error.message, MODEL_CONSENT_REQUIRED_MESSAGE);
      assert.deepEqual(error.payload.consentRequired, CONSENT);
      return true;
    },
  );
  assert.equal(createdModel, UNCENSORED_ID);
});

const HELD_MESSAGE =
  'This model is not yet available, try Wan 3 Spicy or MiniMax H3 video in the meantime.';

test('4104 refusals map to a non-retryable payload with the socket message verbatim', () => {
  const sdkError = { code: 4104, message: HELD_MESSAGE };
  const payload = modelNotYetAvailablePayloadFromError(sdkError);
  assert.ok(payload);
  assert.equal(payload.error, MODEL_NOT_YET_AVAILABLE_ERROR);
  assert.equal(payload.errorCode, MODEL_NOT_YET_AVAILABLE_ERROR_CODE);
  assert.equal(payload.errorCode, 4104);
  assert.equal(payload.message, HELD_MESSAGE);
  assert.equal(payload.retryPolicy, 'manual_user_confirmation');
  assert.equal(payload.nextAction, 'wait_for_user');
  assert.equal('consentRequired' in payload, false);
  // Not a consent refusal.
  assert.equal(modelConsentRequiredPayloadFromError(sdkError), null);

  // The raw socket jobError, the REST estimate ApiError body, and wrapped causes
  // all keep the socket's own wording, not the wrapper's.
  const socketJobError = {
    error: '4104',
    isFromWorker: false,
    modelId: UNCENSORED_ID,
    error_message: HELD_MESSAGE,
  };
  assert.deepEqual(modelNotYetAvailablePayloadFromError(socketJobError), {
    error: MODEL_NOT_YET_AVAILABLE_ERROR,
    errorCode: 4104,
    message: HELD_MESSAGE,
    retryPolicy: 'manual_user_confirmation',
    nextAction: 'wait_for_user',
    modelId: UNCENSORED_ID,
  });
  const estimateError = Object.assign(new Error(HELD_MESSAGE), {
    status: 403,
    payload: { status: 'error', errorCode: 4104, message: HELD_MESSAGE },
  });
  assert.equal(modelNotYetAvailablePayloadFromError(estimateError)?.message, HELD_MESSAGE);
  const wrapped = new Error(`All 1 video generation jobs failed: ${HELD_MESSAGE}`, { cause: sdkError });
  assert.equal(modelNotYetAvailablePayloadFromError(wrapped)?.message, HELD_MESSAGE);
  assert.equal(modelNotYetAvailablePayloadFromError(4104)?.error, MODEL_NOT_YET_AVAILABLE_ERROR);

  // The estimate endpoint answers HTTP 400 with the plain-text message, which
  // the SDK turns into ApiError { errorCode: 400, message }; and a wrapper may
  // keep only the text. Both still map, with the socket's sentence verbatim.
  const plainTextEstimateError = Object.assign(new Error(HELD_MESSAGE), {
    status: 400,
    payload: { status: 'error', errorCode: 400, message: HELD_MESSAGE },
  });
  assert.equal(modelNotYetAvailablePayloadFromError(plainTextEstimateError)?.message, HELD_MESSAGE);
  assert.equal(
    modelNotYetAvailablePayloadFromError(new Error(`All 1 video generation jobs failed: ${HELD_MESSAGE}`))?.message,
    HELD_MESSAGE,
  );

  for (const unrelated of [
    null,
    4103,
    { code: 4103, message: SOCKET_MESSAGE, consentRequired: CONSENT },
    { code: 4102, message: 'This prompt is too long for the model.' },
    new Error('Vendor job failed: timeout'),
  ]) {
    assert.equal(modelNotYetAvailablePayloadFromError(unrelated), null);
  }
});

test('the public skill classifier reports 4104 as non-retryable with the socket message', () => {
  for (const error of [{ code: 4104, message: HELD_MESSAGE }, new Error(HELD_MESSAGE)]) {
    assert.deepEqual(classifySkillError(error), {
      error_type: 'MODEL_UNAVAILABLE',
      category: 'model_unavailable',
      message: HELD_MESSAGE,
      retryable: false,
    });
  }
});

test('Seedance failure mapping reports 4104 as a held model, not a retryable vendor failure', () => {
  const payload = seedanceTerminalGenerationFailurePayloadFromError(
    new Error(`All 1 video generation jobs failed: ${HELD_MESSAGE}`, {
      cause: { code: 4104, message: HELD_MESSAGE },
    }),
  );
  assert.ok(payload);
  assert.equal(payload.error, MODEL_NOT_YET_AVAILABLE_ERROR);
  assert.equal(payload.message, HELD_MESSAGE);
  assert.equal('reportIssue' in payload, false);
  assert.equal(payload.nextAction, 'wait_for_user');
});

test('createProject turns the SDK 4104 job error into SogniModelNotYetAvailableError, never retried', async () => {
  const wrapper = new SogniClientWrapper({ username: 'test-user', password: 'test-pass', autoConnect: false });
  let created = 0;
  (wrapper as any).client = {
    projects: {
      create: async () => {
        created++;
        return {
          id: 'project-held',
          jobs: [],
          on: () => {},
          // The SDK rejects with its plain ErrorData object, not an Error.
          waitForCompletion: () => Promise.reject({ code: 4104, message: HELD_MESSAGE }),
        };
      },
    },
  };
  (wrapper as any).connectionState = { ...(wrapper as any).connectionState, isConnected: true };

  await assert.rejects(
    wrapper.createProjectWithRetry(
      {
        type: 'video',
        modelId: UNCENSORED_ID,
        positivePrompt: 'A slow dolly through a neon street at night',
        duration: 5,
        numberOfMedia: 1,
      } as VideoProjectConfig,
      { maxAttempts: 3, retryDelay: 1 },
    ),
    (error: unknown) => {
      assert.ok(error instanceof SogniModelNotYetAvailableError);
      assert.equal(error.code, 'MODEL_NOT_YET_AVAILABLE');
      assert.equal(error.message, HELD_MESSAGE);
      assert.equal(error.payload.message, HELD_MESSAGE);
      assert.equal(modelNotYetAvailablePayloadFromError(error)?.message, HELD_MESSAGE);
      return true;
    },
  );
  assert.equal(created, 1);
});
