import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildImagePromptAuthoringMessages,
  buildImagePromptMessages,
  PROMPT_CONTRACTS,
  resolveImagePromptAuthoringProfile,
} from '../src/contracts/index.js';
import { REFERENCE_IDENTITY_GUIDANCE } from '../src/contracts/imageIdentity.js';
import { LITERAL_PROMPT_OVERRIDE } from '../src/contracts/promptOverrideMarker.js';
import { definition as editImage } from '../src/tools/definitions/edit-image/definition.js';
import { definition as applyStyle } from '../src/tools/definitions/apply-style/definition.js';
import { definition as refineResult } from '../src/tools/definitions/refine-result/definition.js';
import { definition as restorePhoto } from '../src/tools/definitions/restore-photo/definition.js';

const briefs = [
  'Change only the shirt to cobalt blue. Keep the face, pose, framing and light unchanged.',
  'Put this person on a glamour magazine cover with a new pose, closer crop and professional retouching.',
  'Turn the person into a chibi character with an oversized head and huge expressive eyes.',
  'Make the same individual a nonhuman Doodles NFT character with abstract facial forms.',
  'Make them a neon samurai; interpret costume and facial exposure to convey their identity.',
  'Make a Pixar character. Keep the glasses, even while exaggerating the face and proportions.',
  'Use the first image for the person and the second only for the drawing style. Show one person.',
  'Replace the person with a different robot character; use the first image only for the room.',
  'Use this prompt exactly: A {red|blue} toy. The sign reads "A | B".\nNo added text.',
  '把这个人变成可爱的玩偶，夸大头部比例，保留她独特的个人辨识度。',
];

for (const model of ['flux-3-klein', 'krea-identity-edit', 'qwen-image-edit-2511', 'gpt-image-2', 'seedream-5-pro-uncensored']) {
  test(`${model}: native and legacy writers receive task-aware identity guidance without rewriting the request`, () => {
    const profile = resolveImagePromptAuthoringProfile(model, 'edit');
    assert.ok(profile, `Missing edit profile for ${model}`);
    for (const prompt of briefs) {
      const messages = buildImagePromptAuthoringMessages({ prompt, profile });
      assert.ok(String(messages[0].content).includes(REFERENCE_IDENTITY_GUIDANCE));
      assert.ok(String(messages[1].content).endsWith(`<request>\n${prompt}\n</request>`));
      const legacy = buildImagePromptMessages(prompt, '', profile.promptingType, profile.modelTitle);
      assert.ok(String(legacy[0].content).includes(REFERENCE_IDENTITY_GUIDANCE));
      assert.equal(legacy[1].content, prompt);
    }
  });
}

test('the published edit contract and tool schema share the same identity reasoning', () => {
  const contract = PROMPT_CONTRACTS.find(entry => entry.toolName === 'edit_image');
  assert.ok(contract?.baseDescription.includes(REFERENCE_IDENTITY_GUIDANCE));
  const promptDoc = editImage.function.parameters.properties.prompt.description;
  assert.ok(String(promptDoc).includes(REFERENCE_IDENTITY_GUIDANCE));
  assert.ok(!String(promptDoc).includes('IDENTITY LOCK (required when a person is in any reference image)'));
  assert.ok(!String(promptDoc).includes('PRESERVE clause — always end'));
  assert.ok(!contract.parameterDocs?.prompt.includes('describe only the delta'));
});

test('creative-capable schema descriptions do not reintroduce a mandatory facial inventory', () => {
  for (const definition of [editImage, applyStyle, refineResult, restorePhoto]) {
    const promptDoc = String(definition.function.parameters.properties.prompt.description);
    assert.ok(promptDoc.includes(LITERAL_PROMPT_OVERRIDE), definition.function.name);
    assert.ok(!promptDoc.includes('face structure, eye shape, nose shape, mouth shape, jawline'), definition.function.name);
    assert.ok(!promptDoc.includes('maintain realistic anatomy'), definition.function.name);
  }
});

test('Klein preserves ordered sources, literal user locks and the bounded canvas grammar', () => {
  const profile = resolveImagePromptAuthoringProfile('flux-3-klein', 'edit')!;
  const messages = buildImagePromptAuthoringMessages({
    prompt: briefs[0], profile, targetCanvas: { width: 1152, height: 1728 },
    referenceImageUrls: ['data:image/jpeg;base64,FIRST', 'data:image/png;base64,SECOND'],
  });
  const system = String(messages[0].content);
  assert.ok(system.includes('For a bounded edit that retains the source scene'));
  assert.ok(!system.includes('preserving the first image exactly as the canvas'));
  assert.ok(system.includes('without repeating its label, ratio or dimensions'));
  assert.ok(system.includes('genuinely untargeted details'));
  assert.ok(system.includes('when the brief calls for retaining the source composition'));
  assert.ok(!system.includes('Transferred people keep their identity, face, and accessories unless the request changes them.'));
  assert.deepEqual(messages[1].content, [
    { type: 'text', text: 'The first image:' },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,FIRST', detail: 'auto' } },
    { type: 'text', text: 'The second image:' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,SECOND', detail: 'auto' } },
    { type: 'text', text: `TARGET CANVAS: 2:3\nTarget model: FLUX 3 Image Klein\nOperation: edit\n<request>\n${briefs[0]}\n</request>` },
  ]);
});
