import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PROMPT_TOO_LONG_ERROR_CODE,
  PromptTooLongError,
  assertGenerationPromptWithinLimits,
  checkGenerationPromptLimits,
  promptLengthAdvisory,
  promptLimitInstruction,
  promptLimitRepairInstruction,
  resolveGenerationPromptLimits,
  resolvePromptLimitFamily,
} from '../src/contracts/promptLimits.js';
import {
  buildLyricsMessages,
  buildMusicCompositionLengthRepairMessage,
  checkMusicCompositionLimits,
} from '../src/contracts/musicComposition.js';
import { definition as generateVideo } from '../src/tools/definitions/generate-video/definition.js';
import { definition as animatePhoto } from '../src/tools/definitions/animate-photo/definition.js';
import { definition as soundToVideo } from '../src/tools/definitions/sound-to-video/definition.js';
import { definition as videoToVideo } from '../src/tools/definitions/video-to-video/definition.js';
import { definition as generateMusic } from '../src/tools/definitions/generate-music/definition.js';
import { definition as segmentImage } from '../src/tools/definitions/segment-image/definition.js';

const words = (count: number, word = 'cat') => Array.from({ length: count }, () => word).join(' ');

test('model ids resolve to their prompt-limit family; uncapped models have none', () => {
  const cases: Array<[string, string | null]> = [
    ['wan_v2.2-14b-fp8_i2v_lightx2v', 'wan2.2'],
    ['wan_v2.2-14b-fp8_animate-replace_lightx2v', 'wan2.2'],
    ['wan22', 'wan2.2'],
    ['wan3.0-video', 'wan3'],
    ['wan3.0-spicy-video', 'wan3'],
    ['minimax-h3-fl2va-fp8_t2v_turbo', 'minimax-h3'],
    ['minimax-h3-fasth3-t2v-turbo-2stage', 'minimax-h3'],
    ['happyhorse-1.1-r2v', 'happyhorse'],
    ['seedance-2-5', 'seedance'],
    ['seedance2-mini', 'seedance'],
    ['gpt-image-2', 'gpt-image'],
    ['gpt-image-2.5-sunburst', 'gpt-image'],
    ['flux1-schnell-fp8', 'flux1'],
    ['flux-schnell', 'flux1'],
    ['flux1-dev-kontext_fp8_scaled', 'flux1'],
    ['flux1-krea-dev_fp8_scaled', 'flux1'],
    ['chroma-v46-flash', 'chroma'],
    ['zavychroma-xl', null],
    ['wan22-animate', 'wan2.2'],
    ['wan-s2v', 'wan2.2'],
    ['chroma1-hd_fp8_scaled', 'chroma'],
    ['chroma-v.46-flash_fp8', 'chroma'],
    ['ace_step_1.5_xl_turbo', 'ace-step'],
    ['minimax_music3', 'minimax-music3'],
    ['music3', 'minimax-music3'],
    ['sam3-segment', 'sam3'],
    ['coreml-zavychromaxl_v80', null],
    ['ltx25-t2v', null],
    ['krea2', null],
    ['z_image_turbo_bf16', null],
    ['qwen_image_edit_2511_fp8', null],
    ['flux2_dev_fp8', null],
    ['', null],
  ];
  for (const [modelId, family] of cases) {
    assert.equal(resolvePromptLimitFamily(modelId), family, modelId);
  }
  assert.equal(resolveGenerationPromptLimits('ltx25-t2v'), null);
  assert.deepEqual(checkGenerationPromptLimits('ltx25-t2v', { prompt: 'x'.repeat(100_000) }), []);
});

test('MiniMax H3 counts characters exactly and refuses one over 7,000', () => {
  assert.deepEqual(checkGenerationPromptLimits('minimax-h3-t2v-turbo', { prompt: 'x'.repeat(7000) }), []);
  const [violation] = checkGenerationPromptLimits('minimax-h3-t2v-turbo', { prompt: 'x'.repeat(7001) });
  assert.equal(violation.field, 'prompt');
  assert.equal(violation.measured, 7001);
  assert.equal(violation.exact, true);
  assert.equal(violation.message, 'Your prompt is 7,001 characters; MiniMax H3 accepts at most 7,000. Shorten it and submit again.');
  assert.throws(
    () => assertGenerationPromptWithinLimits('minimax-h3-t2v-turbo', { prompt: 'x'.repeat(7001) }),
    (error: unknown) =>
      error instanceof PromptTooLongError
      && error.code === PROMPT_TOO_LONG_ERROR_CODE
      && error.message.startsWith('This prompt is too long for the model. Your prompt is 7,001 characters'),
  );
});

test('HappyHorse counts each Chinese (Han) character twice, as the Supernet does', () => {
  assert.deepEqual(checkGenerationPromptLimits('happyhorse-1.1-t2v', { prompt: '猫'.repeat(2500) }), []);
  const [over] = checkGenerationPromptLimits('happyhorse-1.1-t2v', { prompt: '猫'.repeat(2501) });
  assert.equal(over.measured, 5002);
  assert.equal(over.exact, true);
  assert.equal(over.message, 'Your prompt is 5,002 characters long, counting each Chinese character twice; HappyHorse accepts at most 5,000. Shorten it and submit again.');
  // English, kana and Hangul count once per character.
  assert.deepEqual(checkGenerationPromptLimits('happyhorse-1.1-t2v', { prompt: 'x'.repeat(5000) }), []);
  assert.deepEqual(checkGenerationPromptLimits('happyhorse-1.1-t2v', { prompt: 'カ'.repeat(5000) }), []);
  assert.equal(checkGenerationPromptLimits('happyhorse-1.1-t2v', { prompt: `${'猫'.repeat(2499)}カカカ` }).length, 1);
});

test('character limits count code points and the appended style prompt, like the Supernet', () => {
  // An emoji is one character, not two UTF-16 units.
  assert.deepEqual(checkGenerationPromptLimits('minimax-h3-t2v', { prompt: '🙂'.repeat(7000) }), []);
  assert.equal(checkGenerationPromptLimits('minimax-h3-t2v', { prompt: '🙂'.repeat(7001) })[0].measured, 7001);
  // prompt + ", " + style = 6,990 + 2 + 9 = 7,001.
  const [styled] = checkGenerationPromptLimits('minimax-h3-t2v', { prompt: 'x'.repeat(6990), stylePrompt: 'film noir' });
  assert.equal(styled.measured, 7001);
});

test('Wan 2.2 refuses only prompts certainly over 4,096 UMT5 tokens, style prompt included', () => {
  // 4,095 words + the end token = 4,096: not certainly over.
  assert.deepEqual(checkGenerationPromptLimits('wan_v2.2-14b-fp8_t2v_lightx2v', { prompt: words(4095) }), []);
  const [over] = checkGenerationPromptLimits('wan_v2.2-14b-fp8_t2v_lightx2v', { prompt: words(4096) });
  assert.equal(over.unit, 'tokens');
  assert.equal(over.measured, 4097);
  assert.equal(over.exact, false);
  assert.match(over.message, /^Your prompt is at least 4,097 tokens \(16,383 characters\); Wan 2\.2 reads at most 4,096 tokens/);
  // The style prompt is appended as ", <style>" before encoding.
  const [styled] = checkGenerationPromptLimits('wan_v2.2-14b-fp8_t2v_lightx2v', {
    prompt: words(4094),
    stylePrompt: 'film noir',
  });
  assert.equal(styled.field, 'prompt');
  // The negative prompt has its own limit.
  const [negative] = checkGenerationPromptLimits('wan_v2.2-14b-fp8_t2v_lightx2v', {
    prompt: 'a cat',
    negativePrompt: words(5000, 'blurry'),
  });
  assert.equal(negative.field, 'negativePrompt');
  // Long English that is plausibly within the tokenizer limit is left to the Supernet.
  assert.deepEqual(checkGenerationPromptLimits('wan22', { prompt: words(3000, 'magnificent') }), []);
  // The 2026-09-26 Animate Replace incident (~17,000 tokens) is refused here.
  assert.equal(checkGenerationPromptLimits('wan_v2.2-14b-fp8_animate-replace_lightx2v', { prompt: words(12_000) }).length, 1);
});

test('SAM 3 counts its start and end tokens toward 32', () => {
  assert.deepEqual(checkGenerationPromptLimits('sam3-segment', { prompt: words(30, 'red') }), []);
  const [over] = checkGenerationPromptLimits('sam3-segment', { prompt: words(31, 'red') });
  assert.equal(over.measured, 33);
  assert.deepEqual(checkGenerationPromptLimits('sam3-segment', { prompt: 'the red suitcase on the left' }), []);
});

test('ACE-Step and MiniMax Music 3 limit lyrics; composition results are checked, never cut', () => {
  assert.deepEqual(checkGenerationPromptLimits('ace_step_1.5_turbo', { prompt: 'x'.repeat(4096), lyrics: 'y'.repeat(4096) }), []);
  const aceOver = checkGenerationPromptLimits('ace_step_1.5_turbo', { prompt: 'x'.repeat(4097), lyrics: 'y'.repeat(4097) });
  assert.deepEqual(aceOver.map(v => v.field), ['prompt', 'lyrics']);
  assert.equal(aceOver[1].message, 'Your lyrics are 4,097 characters; ACE-Step accepts at most 4,096. Shorten it and submit again.');

  const lyrics = 'x'.repeat(4097);
  const [composed] = checkMusicCompositionLimits({ lyrics, caption: null });
  assert.equal(composed.field, 'lyrics');
  assert.deepEqual(checkMusicCompositionLimits({ lyrics, caption: 'caption' }, { model: 'music3' }), []);
  const longSheet = words(5000, 'la');
  const [music3] = checkMusicCompositionLimits({ lyrics: longSheet, caption: 'caption' }, { model: 'music3' });
  assert.equal(music3.field, 'promptWithLyrics');
  assert.equal(music3.measured, 5008);

  const repair = buildMusicCompositionLengthRepairMessage([composed]);
  assert.equal(repair.role, 'user');
  assert.match(String(repair.content), /LENGTH REPAIR REQUIRED: the lyrics came to 4,097 characters; ACE-Step accepts at most 4,096, so aim under 3,270/);
  assert.match(String(repair.content), /Do not cut it off mid-sentence/);
});

test('LLM instructions carry each limit with headroom', () => {
  assert.match(promptLimitInstruction('minimax-h3-t2v') ?? '', /at most 7,000 characters; keep the whole prompt under 6,000/);
  assert.match(promptLimitInstruction('happyhorse-1.1-i2v') ?? '', /counts as 2/);
  assert.match(promptLimitInstruction('wan_v2.2-14b-fp8_i2v') ?? '', /4,096 text tokens/);
  assert.equal(promptLimitInstruction('ltx25'), null);
  const aceSystem = String(buildLyricsMessages('a song about rain', 'en', 'lofi')[0].content);
  assert.match(aceSystem, /ACE-Step accepts at most 4,096 characters of caption\/tags and at most 4,096 characters of lyrics/);
  const music3System = String(buildLyricsMessages('a song about rain', 'en', 'lofi', undefined, { model: 'music3' })[0].content);
  assert.match(music3System, /MiniMax Music 3 reads at most 5,000 tokens of caption and lyrics together/);
  const repair = promptLimitRepairInstruction('minimax-h3-t2v', checkGenerationPromptLimits('minimax-h3-t2v', { prompt: 'x'.repeat(7500) }));
  assert.match(repair, /came to 7,500 characters; MiniMax H3 accepts at most 7,000, so aim under 5,600/);
});

test('tool schemas tell the LLM the prompt limits', () => {
  const property = (definition: typeof generateVideo, name: string) =>
    String((definition.function.parameters.properties as Record<string, { description?: string }>)[name]?.description);
  for (const definition of [generateVideo, animatePhoto, soundToVideo, videoToVideo]) {
    assert.match(property(definition, 'prompt'), /MiniMax H3 at most 7,000 characters; HappyHorse at most 5,000 \(each Chinese character counts as 2\)/, definition.function.name);
  }
  assert.match(property(generateMusic, 'prompt'), /ACE-Step accepts at most 4,096 characters of prompt/);
  assert.match(property(generateMusic, 'lyrics'), /at most 4,096 characters of lyrics/);
  assert.match(property(segmentImage, 'text'), /SAM 3 reads at most 32 tokens/);
});

test('Seedance length guidance is advisory only', () => {
  assert.deepEqual(checkGenerationPromptLimits('seedance-2-5', { prompt: words(5000) }), []);
  assert.match(promptLengthAdvisory('seedance-2-5', words(1001)) ?? '', /1,001 words; Seedance keeps the most detail under 1,000/);
  assert.match(promptLengthAdvisory('seedance-2-5', '猫'.repeat(501)) ?? '', /501 Chinese characters/);
  assert.equal(promptLengthAdvisory('seedance-2-5', words(200)), null);
  assert.equal(promptLengthAdvisory('minimax-h3-t2v', words(5000)), null);
});

test('hosted tool validation returns over-limit prompts to the LLM as argument errors', async () => {
  const { validateAndNormalizeHostedToolArguments } = await import('../src/contracts/hostedToolValidation.js');
  const { checkToolArgumentPromptLimits } = await import('../src/contracts/promptLimits.js');
  const tools = [generateVideo, animatePhoto, generateMusic, segmentImage];

  const h3 = validateAndNormalizeHostedToolArguments(tools, 'generate_video', {
    prompt: 'x'.repeat(7001),
    videoModel: 'minimax-h3-t2v-turbo',
  });
  assert.equal(h3.ok, false);
  assert.ok(h3.errors.some(error => error.startsWith(
    'Argument "prompt" is too long for videoModel/model "minimax-h3-t2v-turbo": Your prompt is 7,001 characters; MiniMax H3 accepts at most 7,000. Rewrite it shorter',
  )), h3.errors.join('\n'));
  // The argument is returned unchanged, never cut.
  assert.equal((h3.cleaned.prompt as string).length, 7001);

  assert.equal(validateAndNormalizeHostedToolArguments(tools, 'generate_video', {
    prompt: 'x'.repeat(7000),
    videoModel: 'minimax-h3-t2v-turbo',
  }).ok, true);
  // LTX has no cap.
  assert.equal(validateAndNormalizeHostedToolArguments(tools, 'generate_video', {
    prompt: 'x'.repeat(50_000),
    videoModel: 'ltx25',
  }).ok, true);

  const perClip = checkToolArgumentPromptLimits('animate_photo', {
    videoModel: 'happyhorse-1.1-i2v',
    prompts: ['a short clip', '猫'.repeat(2600)],
  });
  assert.deepEqual(perClip.map(v => v.argument), ['prompts[1]']);

  const lyrics = checkToolArgumentPromptLimits('generate_music', { model: 'turbo', prompt: 'lofi', lyrics: 'y'.repeat(5000) });
  assert.deepEqual(lyrics.map(v => [v.argument, v.modelId]), [['lyrics', 'ace-step']]);
  assert.deepEqual(checkToolArgumentPromptLimits('generate_music', { prompt: 'lofi', lyrics: 'y'.repeat(5000) }), []);

  const sam = validateAndNormalizeHostedToolArguments(tools, 'segment_image', { text: words(31, 'red') });
  assert.equal(sam.ok, false);
  assert.ok(sam.errors.some(error => error.startsWith('Argument "text" is too long for videoModel/model "sam3"')));

  // Authoring tools take a brief, not a model prompt.
  assert.deepEqual(checkToolArgumentPromptLimits('enhance_prompt', { prompt: 'x'.repeat(9000), videoModel: 'minimax-h3-t2v' }), []);
});

test('every model refuses a prompt, negative prompt or lyrics over 200,000 characters', async () => {
  const { UNIVERSAL_MAX_PROMPT_CHARACTERS, checkToolArgumentPromptLimits } = await import('../src/contracts/promptLimits.js');
  assert.equal(UNIVERSAL_MAX_PROMPT_CHARACTERS, 200_000);
  for (const model of ['krea2', 'z_image_turbo_bf16', 'qwen_image_edit_2511_fp8', 'coreml-zavychromaxl_v80', 'ltx25-t2v', null]) {
    assert.deepEqual(checkGenerationPromptLimits(model, { prompt: 'x'.repeat(200_000) }), [], String(model));
    const [over] = checkGenerationPromptLimits(model, { prompt: 'x'.repeat(199_995), stylePrompt: 'noir' });
    assert.equal(over.measured, 200_001, String(model));
    assert.equal(over.message, 'Your prompt is 200,001 characters; Every Sogni model accepts at most 200,000. Shorten it and submit again.');
  }
  const fields = checkGenerationPromptLimits('krea2', { negativePrompt: 'n'.repeat(200_001), lyrics: 'l'.repeat(200_001) });
  assert.deepEqual(fields.map(v => v.field), ['negativePrompt', 'lyrics']);
  // A model limit that already refused the field is not repeated.
  assert.equal(checkGenerationPromptLimits('minimax-h3-t2v', { prompt: 'x'.repeat(250_000) }).length, 1);
  // Tool calls that name no model still get the backstop.
  const [noModel] = checkToolArgumentPromptLimits('generate_image', { prompt: 'x'.repeat(200_001) });
  assert.equal(noModel.argument, 'prompt');
  assert.equal(noModel.modelId, null);
});
