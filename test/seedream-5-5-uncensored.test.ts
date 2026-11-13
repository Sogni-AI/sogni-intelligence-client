import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SEEDREAM_5_5_UNCENSORED_CONSENT_REQUIRED_MESSAGE,
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
  SEEDREAM_5_5_UNCENSORED_MODEL_DESCRIPTION,
  SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION,
  editImageDefinition,
  generateImageDefinition,
} from '../src/tools/index.js';
import {
  SEEDREAM_5_5_IMAGE_SIZES,
  SEEDREAM_5_5_MAX_PIXELS,
  SEEDREAM_5_5_UNCENSORED_DISPLAY_NAME,
  SEEDREAM_5_5_UNCENSORED_MODEL_ID,
  SEEDREAM_5_PRO_UNCENSORED_MODEL_ID,
  SEEDREAM_IMAGE_SIZES,
  getSeedreamImageSizeRefusal,
  getSeedreamMaxPixels,
  isSeedreamImageModel,
  normalizeSeedreamModelAlias,
  vendorModelPremiumPayloadFromError,
} from '../src/media/index.js';
import { PROMPTING_GUIDES, resolveImagePromptAuthoringProfile } from '../src/contracts/imagePrompt.js';
import { getModelPromptGuide, renderModelPromptGuide } from '../src/prompt-guides/index.js';

const MODEL_ID = 'seedream-5-5-uncensored';
const PRO_ID = 'seedream-5-0-pro-uncensored';
const AGREEMENT = { key: 'seedance-2-5-uncensored', version: 2, modelId: MODEL_ID };
// The socket's sentence: ERROR_CODES[4103] with "This model" replaced by the tier name.
const SOCKET_MESSAGE =
  'Seedream 5.5 Uncensored requires a one-time likeness and consent agreement. Review and accept it in the Sogni app, then try again.';

test('5.5 is its own selector on generate_image and edit_image, listed after 5.0 Pro', () => {
  assert.equal(SEEDREAM_5_5_UNCENSORED_MODEL_ID, MODEL_ID);
  assert.equal(SEEDREAM_5_5_UNCENSORED_DISPLAY_NAME, 'Seedream 5.5 Uncensored');
  for (const definition of [generateImageDefinition, editImageDefinition]) {
    const model = definition.function.parameters.properties.model as { enum: string[]; description: string };
    assert.equal(model.enum.indexOf(MODEL_ID), model.enum.indexOf(PRO_ID) + 1, definition.function.name);
    assert.ok(
      model.description.includes(`${SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION} ${SEEDREAM_5_5_UNCENSORED_MODEL_DESCRIPTION}`),
      definition.function.name,
    );
    const option = MODELS_BY_TOOL[definition.function.name]?.find(candidate => candidate.key === MODEL_ID);
    assert.equal(option?.displayName, 'Seedream 5.5 Uncensored');
    assert.equal(
      MODELS_BY_TOOL[definition.function.name]?.find(candidate => candidate.key === PRO_ID)?.displayName,
      'Seedream 5.0 Pro Uncensored',
    );
  }
});

test('the 5.5 wording picks it only when 5.5 is named and leaves the existing names on 5.0 Pro', () => {
  assert.equal(
    SEEDREAM_5_5_UNCENSORED_MODEL_DESCRIPTION,
    '"seedream-5-5-uncensored": Seedream 5.5 Uncensored, as "seedream-5-0-pro-uncensored" but up to 4,624,220 pixels. Use it only when the user names Seedream 5.5; Seedream Uncensored without 5.5 stays on 5.0 Pro.',
  );
  // It follows the 5.0 Pro text on both tools, so "as seedream-5-0-pro-uncensored"
  // carries the shared rules (references, no seed or steps, the agreement and 4103).
  for (const definition of [generateImageDefinition, editImageDefinition]) {
    const { description } = definition.function.parameters.properties.model as { description: string };
    assert.ok(description.indexOf(SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION) < description.indexOf(SEEDREAM_5_5_UNCENSORED_MODEL_DESCRIPTION));
  }
  // Short enough for sogni-api's hosted 32,768-token requests (test/unit/hosted-request-overhead).
  assert.ok(SEEDREAM_5_5_UNCENSORED_MODEL_DESCRIPTION.length <= 230);
  assert.doesNotMatch(SEEDREAM_5_5_UNCENSORED_MODEL_DESCRIPTION, /\b4K\b|8\.29|\d(?:\.\d+)?x\b|%|markup/i);
  for (const skill of [IMAGE_GENERATION_SKILL, IMAGE_EDITING_SKILL]) {
    assert.ok(skill.constraints?.some(line => line.includes(MODEL_ID) && line.includes('4103')), skill.id);
    assert.ok(skill.constraints?.some(line => line.startsWith('Seedream 5.0 Pro Uncensored uses model seedream-5-0-pro-uncensored')), skill.id);
  }
});

test('5.0 Pro wording is byte-identical to the released text', () => {
  assert.equal(
    SEEDREAM_5_PRO_UNCENSORED_MODEL_DESCRIPTION,
    '"seedream-5-0-pro-uncensored": Seedream 5.0 Pro Uncensored — the uncensored variant of ByteDance\'s Seedream 5.0 Pro image model (third-party vendor model, requires Premium Spark). It generates from text and edits or composes from 1-10 reference images. Choose it only when the user asks for Seedream 5.0 Pro Uncensored (including "Seedream 5 Pro Uncensored", "Seedream Uncensored", or "Seedream Spicy") or for uncensored Seedream output; never swap it in for another image model otherwise. Sizes: 921,600-4,194,304 total pixels with an aspect ratio up to 16:1, such as 1024x1024, 1280x720, 720x1280, 1536x1536 (the default), 2048x2048, 2560x1440, 1440x2560, or 3024x1296. It takes no seed, steps, guidance, LoRAs, or negative prompt. Each account must accept the one-time likeness and consent agreement it shares with Seedance 2.5 Uncensored in the Sogni app before its first render; until then the job fails with error 4103, so tell the user to accept it in the Sogni app instead of retrying.',
  );
  assert.equal(
    PROMPTING_GUIDES.seedream.split('\n')[0],
    'Seedream 5.0 Pro follows clear natural-language art direction.',
  );
  assert.equal(
    PROMPTING_GUIDES['seedream-edit'].split('\n')[0],
    'Seedream 5.0 Pro edits and composes from one to ten ordered reference images with a natural-language instruction.',
  );
});

test('every existing Seedream name still resolves to 5.0 Pro; only 5.5 names resolve to 5.5', () => {
  for (const name of [
    PRO_ID,
    'Seedream 5.0 Pro Uncensored',
    'Seedream 5 Pro Uncensored',
    'seedream_5_pro_spicy',
    'Seedream 5.0 Pro Spicy',
    'seedream-uncensored',
    'Seedream Uncensored',
  ]) {
    assert.equal(normalizeSeedreamModelAlias(name), PRO_ID, name);
  }
  for (const name of [MODEL_ID, 'Seedream 5.5 Uncensored', 'Seedream 5.5', 'seedream_5.5_spicy', 'Seedream 5.5 Spicy']) {
    assert.equal(normalizeSeedreamModelAlias(name), MODEL_ID, name);
  }
  for (const name of ['seedream', 'seedream-5-0-pro', 'seedream-5', 'seedream-5-5-pro', 'seedream-5-5-flash']) {
    assert.equal(normalizeSeedreamModelAlias(name), name, name);
  }
  assert.equal(isSeedreamImageModel(MODEL_ID), true);
  assert.equal(isSeedreamImageModel(PRO_ID), true);
  assert.equal(isSeedreamImageModel('Seedream 5.5'), false);
});

test('5.5 takes up to ten context images', () => {
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

test('5.5 sizes: the native table, 921,600-4,624,220 pixels, 16:1', () => {
  assert.equal(SEEDREAM_5_5_MAX_PIXELS, 4_624_220);
  assert.equal(SEEDREAM_5_5_IMAGE_SIZES.length, 24);
  assert.equal(getSeedreamMaxPixels(MODEL_ID), 4_624_220);
  assert.equal(getSeedreamMaxPixels(PRO_ID), 4_194_304);
  assert.equal(getSeedreamMaxPixels(), 4_194_304);
  for (const size of SEEDREAM_5_5_IMAGE_SIZES) {
    const [width, height] = size.split('x').map(Number);
    assert.equal(getSeedreamImageSizeRefusal(width, height, MODEL_ID), null, size);
  }
  // Newly allowed on 5.5 only: above 5.0 Pro's 4,194,304.
  assert.equal(getSeedreamImageSizeRefusal(2816, 1584, MODEL_ID), null);
  assert.match(getSeedreamImageSizeRefusal(2816, 1584)!, /Seedream 5\.0 Pro Uncensored cannot render 2816x1584/);
  assert.match(getSeedreamImageSizeRefusal(2160, 2160, MODEL_ID)!, /Seedream 5\.5 Uncensored cannot render 2160x2160 \(4,665,600 pixels\)\. Use 921,600-4,624,220 total pixels with/);
  assert.match(getSeedreamImageSizeRefusal(1024, 768, MODEL_ID)!, /786,432 pixels/);
  assert.match(getSeedreamImageSizeRefusal(4096, 240, MODEL_ID)!, /wider than 16:1/);
  assert.match(getSeedreamImageSizeRefusal(1536.5, 1536, MODEL_ID)!, /Seedream 5\.5 Uncensored needs a whole-pixel/);
});

test('5.0 Pro size checks are unchanged with and without a model id', () => {
  assert.equal(SEEDREAM_IMAGE_SIZES.length, 17);
  for (const modelId of [undefined, PRO_ID]) {
    const refusal = modelId ? getSeedreamImageSizeRefusal(4096, 4096, modelId) : getSeedreamImageSizeRefusal(4096, 4096);
    assert.equal(
      refusal,
      'Seedream 5.0 Pro Uncensored cannot render 4096x4096 (16,777,216 pixels). Use 921,600-4,194,304 total pixels (1280x720 through 2048x2048) with an aspect ratio no wider than 16:1, for example ' +
        `${SEEDREAM_IMAGE_SIZES.join(', ')}.`,
    );
  }
  assert.equal(getSeedreamImageSizeRefusal(2048, 2048, PRO_ID), null);
});

test('a 5.5 4103 refusal names 5.5 and opens its agreement page', () => {
  const payload = modelConsentRequiredPayloadFromError({ code: 4103, message: SOCKET_MESSAGE, consentRequired: AGREEMENT });
  assert.ok(payload);
  assert.equal(payload.message, SEEDREAM_5_5_UNCENSORED_CONSENT_REQUIRED_MESSAGE);
  assert.equal(payload.consentUrl, `https://app.sogni.ai/account/model-consents/${MODEL_ID}`);
  assert.match(
    payload.consentInstructions!,
    /One agreement covers Seedream 5\.5 Uncensored, Seedream 5\.0 Pro Uncensored and both Uncensored Seedance models\. Nothing was charged/,
  );
  assert.deepEqual(payload.consentRequired, AGREEMENT);
  // The socket's sentence alone still identifies the model.
  assert.equal(modelConsentRequiredPayloadFromError(new Error(SOCKET_MESSAGE))?.message, SEEDREAM_5_5_UNCENSORED_CONSENT_REQUIRED_MESSAGE);
  assert.deepEqual(classifySkillError({ code: 4103, message: SOCKET_MESSAGE, consentRequired: AGREEMENT }), {
    error_type: 'PERMISSION_REQUIRED',
    category: 'permission_required',
    message: SEEDREAM_5_5_UNCENSORED_CONSENT_REQUIRED_MESSAGE,
    retryable: false,
  });
});

test('a 5.0 Pro 4103 refusal is unchanged', () => {
  const payload = modelConsentRequiredPayloadFromError({
    code: 4103,
    consentRequired: { key: 'seedance-2-5-uncensored', version: 2, modelId: SEEDREAM_5_PRO_UNCENSORED_MODEL_ID },
  });
  assert.equal(payload?.message, SEEDREAM_5_PRO_UNCENSORED_CONSENT_REQUIRED_MESSAGE);
  assert.equal(payload?.consentUrl, `https://app.sogni.ai/account/model-consents/${PRO_ID}`);
  assert.match(payload!.consentInstructions!, / One agreement covers Seedream 5\.0 Pro Uncensored and both Uncensored Seedance models\. Nothing was charged/);
});

test("the socket's Premium Spark refusal for 5.5 maps to the vendor payload", () => {
  const payload = vendorModelPremiumPayloadFromError(new Error('Seedream 5.5 Uncensored requires Premium Spark Points'));
  assert.equal(payload?.error, 'vendor_model_premium_required');
  assert.match(payload!.message, /Seedream/);
});

test('5.5 has its own generation and edit prompt contracts and guides', () => {
  const generate = resolveImagePromptAuthoringProfile(MODEL_ID, 'generate');
  assert.equal(generate?.promptingType, 'seedream-5-5');
  assert.equal(generate?.outputFormat, 'prompt');
  const edit = resolveImagePromptAuthoringProfile(MODEL_ID, 'edit');
  assert.equal(edit?.promptingType, 'seedream-5-5-edit');
  assert.equal(edit?.maxReferenceImages, 10);
  assert.match(PROMPTING_GUIDES['seedream-5-5'], /^Seedream 5\.5 follows clear natural-language art direction\./);
  assert.match(PROMPTING_GUIDES['seedream-5-5-edit'], /^Seedream 5\.5 edits and composes from one to ten ordered reference images/);
  // Same rules as 5.0 Pro apart from the model name.
  assert.equal(PROMPTING_GUIDES['seedream-5-5'].replace('Seedream 5.5', 'Seedream 5.0 Pro'), PROMPTING_GUIDES.seedream);
  assert.equal(PROMPTING_GUIDES['seedream-5-5-edit'].replace('Seedream 5.5', 'Seedream 5.0 Pro'), PROMPTING_GUIDES['seedream-edit']);

  const guide = getModelPromptGuide(MODEL_ID, 'edit');
  assert.equal(guide?.family, 'seedream-5.5');
  assert.equal(guide?.title, 'Seedream 5.5 Uncensored image editing');
  assert.match(renderModelPromptGuide(guide!, { audience: 'agent' }), /Models: seedream-5-5-uncensored/);
  // 5.0 Pro's guide is untouched.
  const proGuide = getModelPromptGuide(PRO_ID, 'generate');
  assert.equal(proGuide?.family, 'seedream');
  assert.equal(proGuide?.title, 'Seedream 5.0 Pro Uncensored text-to-image');
  assert.deepEqual(proGuide?.models, ['seedream-5-pro-uncensored']);
});
