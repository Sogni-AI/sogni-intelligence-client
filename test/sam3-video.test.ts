import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { SogniClientWrapper } from '../src/client/SogniClientWrapper.js';
import { validateProjectConfig } from '../src/utils/helpers.js';

const selection = {
  type: 'video' as const, modelId: 'sam3_video_segment_fp16', positivePrompt: '', numberOfMedia: 1,
  width: 2160, height: 1080, frames: 160, fps: 30, referenceVideo: Buffer.from('original source bytes'),
  sam3VideoPrompt: { text: 'unicorn', frameIndex: 80 },
  autoResizeVideoAssets: false, waitForCompletion: false,
};

test('video selection retains the full source-size envelope through wrapper validation', () => {
  for (const width of [1, 64, 2160, 2560]) validateProjectConfig({ ...selection, width });
  for (const width of [0, 2561, NaN, 1.5]) assert.throws(() => validateProjectConfig({ ...selection, width }), /between 1 and 2560/);
  assert.throws(() => validateProjectConfig({ ...selection, modelId: 'ltx25-22b-int8_t2v_distilled' }), /between 256 and 2048/);
});

test('the actual video wrapper forwards native bytes, prompt and fractional timing to the SDK', async () => {
  let forwarded: Record<string, unknown> | undefined;
  const project = Object.assign(new EventEmitter(), { id: 'sam3-video-wrapper', jobs: [] });
  const wrapper = Object.assign(Object.create(SogniClientWrapper.prototype) as SogniClientWrapper, {
    config: { timeout: 1000 },
    ensureConnected: async () => {}, log: () => {}, emit: () => true,
    client: { projects: { create: async (params: Record<string, unknown>) => { forwarded = params; return project; } } },
  });
  const result = await wrapper.createVideoProject({ ...selection, fps: 30000 / 1001 });
  assert.equal(result.completed, false);
  assert.equal(forwarded?.type, 'video');
  assert.equal(forwarded?.referenceVideo, selection.referenceVideo);
  assert.deepEqual(forwarded?.sam3VideoPrompt, selection.sam3VideoPrompt);
  assert.equal(forwarded?.width, 2160);
  assert.equal(forwarded?.fps, 30000 / 1001);
});
