import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHARACTER_REFERENCE_VIDEO_COMPOSITION_SYSTEM_PROMPT,
  PROMPT_CONTRACTS,
  SEEDANCE_TOOL_AUDIO_REFERENCE_GUIDANCE,
  buildIdLoRaConversionMessages,
  buildLtxScriptMessages,
  buildWanScriptMessages,
} from '../src/contracts/index.js';
import {
  animatePhotoDefinition,
  extendVideoDefinition,
  generateVideoDefinition,
  soundToVideoDefinition,
  videoToVideoDefinition,
} from '../src/tools/index.js';
import {
  SEEDANCE_STORYBOARD_REFERENCE_PROMPT,
  SEEDANCE_WORKFLOW_MODELS,
  buildStoryboardVideoHostedToolSequenceInput,
  formatAudioIdPrompt,
  planCliVideoBrain,
  planSeedanceStoryboardFallback,
} from '../src/public-skill-runtime/index.js';

function toolText(definition: { function: { description?: string; parameters?: unknown } }): string {
  return `${definition.function.description ?? ''}\n${JSON.stringify(definition.function.parameters ?? {})}`;
}

function contractText(toolName: string): string {
  const contract = PROMPT_CONTRACTS.find(candidate => candidate.toolName === toolName);
  assert.ok(contract, `missing ${toolName} contract`);
  return `${contract.baseDescription}\n${JSON.stringify(contract.parameterDocs)}`;
}

function systemText(messages: Array<{ role: string; content: unknown }>): string {
  return String(messages.find(message => message.role === 'system')?.content ?? '');
}

test('IC-11: a storyboard request keeps every word the user wrote', () => {
  const prompts = [
    "Turn this storyboard into a 10 second Seedance video. Make the knight's armor gold, and add rolling thunder and a dragon roar at the end.",
    'Animate this storyboard as a fast, violent sword fight with handheld whip pans.',
  ];
  for (const prompt of prompts) {
    const plan = planCliVideoBrain({ video: true, prompt, refImage: 'board.png', cliSet: {} });
    assert.equal(plan.storyboard?.reason, 'text_mentions_storyboard');
    assert.ok(plan.prompt?.startsWith(SEEDANCE_STORYBOARD_REFERENCE_PROMPT));
    assert.ok(plan.prompt?.includes(prompt), `user prompt dropped: ${plan.prompt}`);
    // The model and workflow switch is unchanged; that default is a separate decision.
    assert.equal(plan.model, SEEDANCE_WORKFLOW_MODELS.t2v);
    assert.equal(plan.workflow, 't2v');
  }

  const multiline = 'Use the uploaded storyboard.\nMake the hero\'s cape red.';
  const fallback = planSeedanceStoryboardFallback({ userIntentText: multiline, uploadedImageCount: 1 });
  assert.ok(fallback?.prompt.endsWith(multiline), 'user line breaks must survive');
});

const LONG_SCENE = 'A woman runs through a moonlit cornfield, her breath fogging, as three more scarecrows closing in from the rows behind her twitch to life one by one. She trips over an irrigation pipe and loses her flashlight, which spins away into the stalks, its beam strobing across burlap faces. She scrambles up on her hands and knees while a scarecrow with a burlap face and rusted sickle lurches behind her, and the sickle slices the stalks inches above her head as she ducks and keeps crawling toward the farmhouse lights.';

function compileHarvestStoryboard(userIntentText: string) {
  return buildStoryboardVideoHostedToolSequenceInput({
    storyline: [
      'Project Title: Harvest',
      'Total Duration: 10 seconds',
      'SCENE 01 - Chase',
      'TIME: 0-5s',
      LONG_SCENE,
      'DIALOGUE/VO: "Get away from me!"',
      'SCENE 02 - Barn',
      'TIME: 5-10s',
      'VISUAL: She slams the barn door.',
      'MUSIC: every cut lands on a snare hit; cuts sync perfectly to the snare hits of the drum break.',
      'DIALOGUE/VO: [no dialogue]',
    ].join('\n'),
    userIntentText,
    frameCount: 2,
    videoModel: 'seedance2-5',
  });
}

test('IC-3: the storyboard compiler sends whole scenes and takes the aspect only from a written ratio', () => {
  for (const intent of [
    'Make a horror storyboard video that tells the story of a farmer fleeing scarecrows.',
    'Make a storyboard video of a surfer in board shorts who wipes out.',
  ]) {
    const plan = compileHarvestStoryboard(intent);
    assert.equal(plan.storyboardProject.targetVideoAspectRatio, '16:9', intent);
    assert.ok(plan.video.width > plan.video.height, intent);
    assert.ok(plan.seedanceVideoPrompt.includes(LONG_SCENE), 'the scene was cut');
    assert.doesNotMatch(plan.seedanceVideoPrompt, /clean readable|Visual style:/);
    // The scene's dialogue line is parsed into its own field, not repeated as visual.
    assert.doesNotMatch(plan.seedanceVideoPrompt, /VISUAL:[^\n]*Get away from me/);
  }

  const portrait = compileHarvestStoryboard('Make a 9:16 horror storyboard video of a farmer fleeing scarecrows.');
  assert.equal(portrait.storyboardProject.targetVideoAspectRatio, '9:16');
});

test('IC-4 and IC-5: Seedance storyboard prompts state the result positively and keep music direction', () => {
  const plan = compileHarvestStoryboard('Make a storyboard video of a farmer fleeing scarecrows, without gore.');
  const prompt = plan.seedanceVideoPrompt;
  assert.doesNotMatch(prompt, /NEGATIVE \/ AVOID|collage|split-screen|panel dividers/);
  assert.match(prompt, /Each shot fills the whole frame as moving footage of its scene, in the look the storyboard shows\./);
  assert.match(prompt, /without gore\./, 'the user\'s own avoid direction is kept');
  assert.match(prompt, /cuts sync perfectly to the snare hits of the drum break/);
  assert.doesNotMatch(prompt, /generated music bed/);
});

test('speech with no words given: every writer is told to write the words', () => {
  const texts = {
    generate_video: toolText(generateVideoDefinition),
    animate_photo: toolText(animatePhotoDefinition),
    extend_video: toolText(extendVideoDefinition),
    seedance_audio_reference: SEEDANCE_TOOL_AUDIO_REFERENCE_GUIDANCE,
    character_reference: CHARACTER_REFERENCE_VIDEO_COMPOSITION_SYSTEM_PROMPT,
    id_lora: systemText(buildIdLoRaConversionMessages('She talks about her day.')),
  };
  for (const [name, text] of Object.entries(texts)) {
    assert.match(text, /write short lines that fit the speaker/, name);
    assert.doesNotMatch(text, /without inventing|Do not invent words/, name);
  }
});

test('video tools quote on-screen text, allow logos, and keep the requested pace', () => {
  for (const definition of [generateVideoDefinition, animatePhotoDefinition, soundToVideoDefinition, videoToVideoDefinition]) {
    const text = toolText(definition);
    const name = definition.function.name;
    assert.doesNotMatch(text, /QUOTING RULE|Never quote on-screen|readable text or logos|surrounding surfaces blank/, name);
    assert.doesNotMatch(text, /subtle natural movements|flame|ember|slow paw wave|transition from stillness|Smooth cinematic camera/, name);
    assert.doesNotMatch(text, /too many (?:actions|characters)|<=6s: 1 main/, name);
  }
  for (const definition of [generateVideoDefinition, animatePhotoDefinition, soundToVideoDefinition]) {
    assert.match(toolText(definition), /reads \\"OPEN 24H\\"/, definition.function.name);
  }
  assert.match(toolText(animatePhotoDefinition), /whip pan/);
  assert.match(toolText(generateVideoDefinition), /whip pan/);
});

test('prompt contracts keep the user\'s dialogue, defer the rating to the session policy, and add no CTA', () => {
  const animate = contractText('animate_photo');
  assert.doesNotMatch(animate, /condense the dialogue|tighten the line|flames\/embers|flame\/ember|surrounding surfaces blank/);
  assert.match(animate, /keep every word: tell the user the line\nneeds about N seconds/);
  assert.match(animate, /reads "OPEN 24H"/);

  const image = contractText('generate_image');
  assert.match(image, /PG-13\/non-explicit unless a CONTENT POLICY section in the system prompt states that Unrestricted\nmode is active/);
  assert.match(image, /clearly adult and consensual, avoid minor-coded styling or school-coded settings/);

  const video = contractText('generate_video');
  assert.doesNotMatch(video, /15s 9:16|brand\/CTA|title\/CTA|ONLY use double quotes/);
  assert.match(contractText('finalize_response'), /a CTA only when the user asked for one/);
});

test('IC-1 and IC-2: the LTX 2.3 and Wan 2.2 composers follow the requested pace and content', () => {
  const ltx = systemText(buildLtxScriptMessages('she sprints through a burning warehouse', 8));
  assert.doesNotMatch(ltx, /stabilized footage|ONE movement only|stability anchor|Clean blank surfaces unless/);
  assert.match(ltx, /whip pan/);
  for (const messages of [
    buildWanScriptMessages({ prompt: 'two boxers trade jabs under a sign that reads "OPEN"' }),
    buildWanScriptMessages({ prompt: 'the storm hits', firstFrameDescription: 'a pier at dusk' }),
  ]) {
    const wan = systemText(messages);
    assert.doesNotMatch(wan, /No on-screen text|One primary subject|80-120 words|60-100 words|Keep subtle|stabilized footage|5-7 well-chosen/);
    assert.match(wan, /explosively/);
  }
});

test('IC-12: Audio ID prompts add no fixed sound direction', () => {
  const formatted = formatAudioIdPrompt('A choir sings in a cathedral', 'NARRATOR');
  assert.ok(formatted.endsWith('[SOUNDS]'));
  assert.doesNotMatch(formatted, /natural ambient sound/);
});
