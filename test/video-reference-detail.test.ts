import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { SogniClientWrapper } from '../src/client/SogniClientWrapper.js';
import type { VideoProjectConfig } from '../src/types/index.js';

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
