import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MODEL_CONSENT_REQUIRED_ERROR,
  MODEL_CONSENT_REQUIRED_MESSAGE,
  SEEDANCE_MINI_UNCENSORED_CONSENT_REQUIRED_MESSAGE,
  SEEDREAM_5_PRO_UNCENSORED_CONSENT_REQUIRED_MESSAGE,
  getMaxContextImages,
  modelConsentRequiredPayloadFromError,
  validateProjectConfig,
  type ImageProjectConfig,
} from '../src/index.js';
import {
  IMAGE_EDITING_SKILL,
  IMAGE_GENERATION_SKILL,
  classifySkillError,
} from '../src/public-skill-runtime/index.js';
import {
  MODELS_BY_TOOL,
  SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION,
  editImageDefinition,
  generateImageDefinition,
} from '../src/tools/index.js';
import {
  SEEDREAM_5_PRO_UNCENSORED_DISPLAY_NAME,
  SEEDREAM_5_PRO_UNCENSORED_MODEL_ID,
  getSeedreamImageSizeRefusal,
  isSeedreamImageModel,
  normalizeSeedreamModelAlias,
  vendorModelPremiumPayloadFromError,
} from '../src/media/index.js';
import { resolveImagePromptAuthoringProfile } from '../src/contracts/imagePrompt.js';

const MODEL_ID = 'seedream-5-0-pro-uncensored';
const AGREEMENT = { key: 'seedance-2-5-uncensored', version: 2, modelId: MODEL_ID };
const SOCKET_MESSAGE =
  'Seedream 5 Pro Uncensored requires a one-time likeness and consent agreement. Review and accept it in the Sogni app, then try again.';

test('the model id is the selector on generate_image and edit_image', () => {
  assert.equal(SEEDREAM_5_PRO_UNCENSORED_MODEL_ID, MODEL_ID);
  assert.equal(SEEDREAM_5_PRO_UNCENSORED_DISPLAY_NAME, 'Seedream 5.0 Pro Uncensored');
  for (const definition of [generateImageDefinition, editImageDefinition]) {
    const model = definition.function.parameters.properties.model as { enum: string[]; description: string };
    assert.ok(model.enum.includes(MODEL_ID), definition.function.name);
    assert.ok(model.description.includes(SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION), definition.function.name);
    const option = MODELS_BY_TOOL[definition.function.name]?.find(candidate => candidate.key === MODEL_ID);
    assert.equal(option?.displayName, 'Seedream 5.0 Pro Uncensored');
  }
});

test('the tool wording picks it only on request and explains 4103', () => {
  assert.match(SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION, /Choose it only when the user asks for Seedream 5\.0 Pro Uncensored/);
  assert.match(SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION, /never swap it in for another image model otherwise/);
  assert.match(SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION, /error 4103/);
  assert.match(SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION, /1-10 reference images/);
  // No markup multiple or percentage in agent-facing copy.
  assert.doesNotMatch(SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION, /\d(?:\.\d+)?x\b|%|markup/i);
  for (const skill of [IMAGE_GENERATION_SKILL, IMAGE_EDITING_SKILL]) {
    assert.ok(skill.constraints?.some(line => line.includes(MODEL_ID) && line.includes('4103')), skill.id);
  }
});

test('Seedream takes up to ten context images', () => {
  assert.equal(getMaxContextImages(MODEL_ID), 10);
  const project = {
    type: 'image',
    modelId: MODEL_ID,
    positivePrompt: 'Put the jacket from Image 2 on the person in Image 1.',
    contextImages: Array.from({ length: 10 }, () => true),
  } as ImageProjectConfig;
  assert.doesNotThrow(() => validateProjectConfig(project));
  assert.throws(
    () => validateProjectConfig({ ...project, contextImages: Array.from({ length: 11 }, () => true) } as ImageProjectConfig),
    /at most 10 images/,
  );
});

test('exact names resolve to the id and nothing else does', () => {
  for (const name of [
    MODEL_ID,
    'Seedream 5.0 Pro Uncensored',
    'Seedream 5 Pro Uncensored',
    'seedream_5_pro_spicy',
    'Seedream 5.0 Pro Spicy',
    'seedream-uncensored',
  ]) {
    assert.equal(normalizeSeedreamModelAlias(name), MODEL_ID, name);
  }
  for (const name of ['seedream', 'seedream-5-0-pro', 'seedream-5-0-flash-uncensored', 'seedance-2-5-uncensored']) {
    assert.equal(normalizeSeedreamModelAlias(name), name, name);
  }
  assert.equal(isSeedreamImageModel(MODEL_ID), true);
  assert.equal(isSeedreamImageModel('seedream-uncensored'), false);
});

test('sizes inside 921,600-4,194,304 pixels and 16:1 render; others are refused', () => {
  for (const [width, height] of [[1536, 1536], [1280, 720], [3024, 1296], [2048, 2048], [1440, 2560]]) {
    assert.equal(getSeedreamImageSizeRefusal(width, height), null, `${width}x${height}`);
  }
  assert.match(getSeedreamImageSizeRefusal(1024, 768)!, /786,432 pixels/);
  assert.match(getSeedreamImageSizeRefusal(4096, 4096)!, /cannot render 4096x4096/);
  assert.match(getSeedreamImageSizeRefusal(4096, 240)!, /wider than 16:1/);
  assert.match(getSeedreamImageSizeRefusal(1536.5, 1536)!, /whole-pixel/);
});

test('a Seedream 4103 refusal names Seedream and opens its agreement page', () => {
  const payload = modelConsentRequiredPayloadFromError({ code: 4103, message: SOCKET_MESSAGE, consentRequired: AGREEMENT });
  assert.ok(payload);
  assert.equal(payload.error, MODEL_CONSENT_REQUIRED_ERROR);
  assert.equal(payload.message, SEEDREAM_5_PRO_UNCENSORED_CONSENT_REQUIRED_MESSAGE);
  assert.equal(payload.retryPolicy, 'manual_user_confirmation');
  assert.equal(payload.nextAction, 'wait_for_user');
  assert.equal(payload.consentUrl, `https://app.sogni.ai/account/model-consents/${MODEL_ID}`);
  assert.match(payload.consentInstructions!, /covers Seedream 5\.0 Pro Uncensored and both Uncensored Seedance models/);
  assert.deepEqual(payload.consentRequired, AGREEMENT);

  // The socket's sentence alone still identifies the model.
  assert.equal(modelConsentRequiredPayloadFromError(new Error(SOCKET_MESSAGE))?.message, SEEDREAM_5_PRO_UNCENSORED_CONSENT_REQUIRED_MESSAGE);
  assert.deepEqual(classifySkillError({ code: 4103, message: SOCKET_MESSAGE, consentRequired: AGREEMENT }), {
    error_type: 'PERMISSION_REQUIRED',
    category: 'permission_required',
    message: SEEDREAM_5_PRO_UNCENSORED_CONSENT_REQUIRED_MESSAGE,
    retryable: false,
  });
});

test('Seedance consent refusals are unchanged', () => {
  const v25 = modelConsentRequiredPayloadFromError({
    code: 4103,
    consentRequired: { key: 'seedance-2-5-uncensored', version: 2, modelId: 'seedance-2-5-uncensored' },
  });
  assert.equal(v25?.message, MODEL_CONSENT_REQUIRED_MESSAGE);
  assert.equal(v25?.consentUrl, 'https://app.sogni.ai/account/model-consents/seedance-2-5-uncensored');
  assert.match(v25!.consentInstructions!, / One agreement covers both Uncensored Seedance models\. Nothing was charged/);
  const mini = modelConsentRequiredPayloadFromError({
    code: 4103,
    consentRequired: { key: 'seedance-2-5-uncensored', version: 2, modelId: 'seedance-2-0-mini-uncensored' },
  });
  assert.equal(mini?.message, SEEDANCE_MINI_UNCENSORED_CONSENT_REQUIRED_MESSAGE);
  assert.equal(modelConsentRequiredPayloadFromError(4103)?.message, MODEL_CONSENT_REQUIRED_MESSAGE);
});

test("the socket's Premium Spark refusal for Seedream maps to the vendor payload", () => {
  const payload = vendorModelPremiumPayloadFromError(new Error('Seedream 5.0 Pro Uncensored requires Premium Spark Points'));
  assert.equal(payload?.error, 'vendor_model_premium_required');
  assert.match(payload!.message, /Seedream/);
});

test('Seedream has its own generation and edit prompt contracts', () => {
  const generate = resolveImagePromptAuthoringProfile(MODEL_ID, 'generate');
  assert.equal(generate?.promptingType, 'seedream');
  assert.equal(generate?.outputFormat, 'prompt');
  const edit = resolveImagePromptAuthoringProfile(MODEL_ID, 'edit');
  assert.equal(edit?.promptingType, 'seedream-edit');
  assert.equal(edit?.maxReferenceImages, 10);
});
