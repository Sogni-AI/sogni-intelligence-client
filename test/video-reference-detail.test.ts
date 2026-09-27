import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { SogniClientWrapper } from '../src/client/SogniClientWrapper.js';
import type { VideoProjectConfig } from '../src/types/index.js';
import { getVideoDimensionRules, isMiniMaxH3VideoModel } from '../src/utils/helpers.js';

const client = new SogniClientWrapper({ username: 'test', password: 'test', autoConnect: false });
const prepare = (client as unknown as {
  prepareProjectConfig(config: VideoProjectConfig): Promise<VideoProjectConfig>;
}).prepareProjectConfig.bind(client);

async function still(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#9eae6b' } }).png().toBuffer();
}

function config(modelId: string, referenceImage: Buffer, referenceImageEnd?: Buffer): VideoProjectConfig {
  return { type: 'video', modelId, positivePrompt: 'A kayaker splashes through a wave.',
    width: 672, height: 384, numberOfMedia: 1, referenceImage, referenceImageEnd } as VideoProjectConfig;
}

test('two-stage image and audio-guided variants keep original output-size references', async () => {
  const source = await still(1344, 768);
  for (const mode of ['i2v', 'flf2v', 'ia2v', 'flfa2v']) {
    const end = mode.startsWith('fl') ? source : undefined;
    const prepared = await prepare(config(`minimax-h3-fastvideo-int8_${mode}_turbo_2stage`, source, end));
    assert.equal(prepared.width, 672);
    assert.equal(prepared.height, 384);
    assert.strictEqual(prepared.referenceImage, source);
    assert.strictEqual(prepared.referenceImageEnd, end);
  }
  const lastOnly = await prepare({
    ...config('minimax-h3-fastvideo-int8_i2v_turbo_2stage', source, source),
    referenceImage: undefined,
  });
  assert.equal(lastOnly.width, 672);
  assert.equal(lastOnly.height, 384);
  assert.strictEqual(lastOnly.referenceImageEnd, source);
});

test('two-stage fitting aligns both originals to twice the normalized base canvas', async () => {
  const source = await still(1472, 1024);
  const end = await still(1344, 768);
  const prepared = await prepare(config('minimax-h3-fastvideo-int8_flf2v_turbo_2stage', source, end));
  assert.equal(prepared.width! % 32, 0);
  assert.equal(prepared.height! % 32, 0);
  for (const image of [prepared.referenceImage, prepared.referenceImageEnd]) {
    const metadata = await sharp(image as Buffer).metadata();
    assert.equal(metadata.width, prepared.width! * 2);
    assert.equal(metadata.height, prepared.height! * 2);
  }
});

test('one-stage references retain the existing canvas-size behavior', async () => {
  const source = await still(1344, 768);
  const prepared = await prepare(config('minimax-h3-fastvideo-int8_i2v_turbo', source));
  const metadata = await sharp(prepared.referenceImage as Buffer).metadata();
  assert.equal(metadata.width, prepared.width);
  assert.equal(metadata.height, prepared.height);
});

test('automatic reference resizing does not write into JSON stdout', async () => {
  const source = await still(1344, 768);
  const messages: unknown[][] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => { messages.push(args); };
  try {
    await prepare(config('minimax-h3-fastvideo-int8_i2v_turbo', source));
  } finally {
    console.log = original;
  }
  assert.deepEqual(messages, []);
});

test('two-stage and Balanced reference-to-video references never define the canvas', async () => {
  const portrait = await still(768, 1344);
  for (const modelId of [
    'minimax-h3-ref2va-fp8_r2v_2stage',
    'minimax-h3-ref2va-fp8_r2v_balanced_2stage',
    'minimax-h3-ref2va-fp8_r2v_balanced',
    'minimax-h3-r2v-2stage',
  ]) {
    const prepared = await prepare(config(modelId, portrait));
    assert.equal(prepared.width, 672, modelId);
    assert.equal(prepared.height, 384, modelId);
    assert.strictEqual(prepared.referenceImage, portrait, modelId);
  }
});

test('MiniMax H3 Balanced ids are sized on the H3 grid', async () => {
  for (const modelId of ['minimax-h3-fl2va-fp8_i2v_balanced', 'minimax-h3-fl2va-fp8_flf2v_balanced', 'minimax-h3-ref2va-fp8_r2v_balanced']) {
    assert.equal(isMiniMaxH3VideoModel(modelId), true, modelId);
    assert.deepEqual(getVideoDimensionRules(modelId).dimensionMultiple, 32, modelId);
  }
  const source = await still(1344, 768);
  const prepared = await prepare(config('minimax-h3-fl2va-fp8_i2v_balanced', source));
  assert.equal(prepared.width, 672);
  assert.equal(prepared.height, 384);
});

async function size(image: unknown) {
  const metadata = await sharp(image as Buffer).metadata();
  return `${metadata.width}x${metadata.height}`;
}

test('MiniMax H3 keyframes are cover-cropped to the canvas like the closing frame', async () => {
  const source = await still(1344, 768);
  const portrait = await still(768, 1344);
  const square = await still(1000, 1000);
  const oneStage = await prepare({
    ...config('minimax-h3-fastvideo-int8_flf2v_turbo', source, source),
    keyframes: [{ image: portrait, frameIndex: 30 }, { image: square, frameIndex: 90 }],
  } as VideoProjectConfig);
  assert.deepEqual(oneStage.keyframes?.map(keyframe => keyframe.frameIndex), [30, 90]);
  assert.deepEqual(await Promise.all(oneStage.keyframes!.map(keyframe => size(keyframe.image))), ['672x384', '672x384']);

  const twoStage = await prepare({
    ...config('minimax-h3-fastvideo-int8_i2v_turbo_2stage', source),
    keyframes: [{ image: portrait, frameIndex: 48 }],
  } as VideoProjectConfig);
  assert.equal(twoStage.width, 672);
  assert.equal(await size(twoStage.keyframes![0].image), '1344x768');
});

test('MiniMax H3 audio-only and reference-to-video keyframes follow the requested canvas', async () => {
  const portrait = await still(768, 1344);
  const audioOnly = await prepare({
    type: 'video', modelId: 'minimax-h3-fastvideo-int8_a2v_turbo_2stage', positivePrompt: 'A singer on a rooftop.',
    width: 960, height: 544, numberOfMedia: 1, keyframes: [{ image: portrait, frameIndex: 60 }],
  } as VideoProjectConfig);
  assert.equal(await size(audioOnly.keyframes![0].image), '1920x1088');

  for (const modelId of ['minimax-h3-ref2va-fp8_r2v_2stage', 'minimax-h3-ref2va-fp8_r2v_balanced_2stage']) {
    const prepared = await prepare({
      ...config(modelId, portrait),
      keyframes: [{ image: portrait, frameIndex: 60 }],
    } as VideoProjectConfig);
    assert.equal(prepared.width, 672, modelId);
    assert.equal(prepared.height, 384, modelId);
    assert.strictEqual(prepared.referenceImage, portrait, modelId);
    assert.equal(await size(prepared.keyframes![0].image), '1344x768', modelId);
  }
});

test('MiniMax H3 keyframes pass through unchanged when the canvas is unknown or resizing is off', async () => {
  const portrait = await still(768, 1344);
  const keyframes = [{ image: portrait, frameIndex: 60 }];
  const noCanvas = await prepare({
    type: 'video', modelId: 'minimax-h3-ref2va-fp8_r2v', positivePrompt: 'A dancer turns.', numberOfMedia: 1, keyframes,
  } as VideoProjectConfig);
  assert.strictEqual(noCanvas.keyframes, keyframes);
  const resizingOff = await prepare({
    ...config('minimax-h3-fastvideo-int8_i2v_turbo', await still(1344, 768)), keyframes, autoResizeVideoAssets: false,
  } as VideoProjectConfig);
  assert.strictEqual(resizingOff.keyframes, keyframes);
});
