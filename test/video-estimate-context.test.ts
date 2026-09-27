import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { dirname, join } from 'node:path';
import { SogniClientWrapper } from '../src/client/SogniClientWrapper.js';
import type { VideoCostEstimateParams } from '../src/types/index.js';

const cases: Array<[string, Partial<VideoCostEstimateParams>]> = [
  ['explicit video input', { hasVideoInput: true }],
  ['local video reference', { referenceVideo: Buffer.from('video-reference') }],
  ['hosted video references', { referenceVideoUrls: ['https://example.com/reference.mp4'] }],
  ['image-only input', { hasVideoInput: false, referenceVideoUrls: [] }],
  ['reference counts and duration', { referenceImageCount: 2, referenceVideoCount: 1, referenceVideoDurationSeconds: 8.5 }],
  ['source dimensions', { sourceWidth: 1280, sourceHeight: 720 }],
  ['MiniMax H3 keyframe count', { keyframeCount: 8 }],
];

for (const [name, context] of cases) {
  test(`video estimates preserve ${name} through the wrapper`, async () => {
    const wrapper = new SogniClientWrapper({ username: 'test-user', password: 'test-pass', autoConnect: false });
    let forwarded: Record<string, unknown> | undefined;
    const quote = { token: '5', usd: '0.025', spark: '5', sogni: '5' };
    (wrapper as any).client = {
      projects: { estimateVideoCost: async (params: Record<string, unknown>) => { forwarded = params; return quote; } },
    };
    (wrapper as any).connectionState = { isConnected: true };

    assert.deepEqual(await wrapper.estimateVideoCost({
      modelId: 'seedance-2-5', width: 1920, height: 1080, duration: 30, tokenType: 'spark', ...context,
    }), quote);
    assert.ok(forwarded);
    for (const [key, value] of Object.entries(context)) assert.deepEqual(forwarded[key], value, key);
    assert.equal(forwarded.model, 'seedance-2-5');
    assert.equal(forwarded.modelId, undefined);
    assert.equal(forwarded.fps, 24);
    assert.equal(forwarded.duration, 30);
    assert.equal(forwarded.numberOfMedia, 1);
  });
}

test('wrapper and installed SDK reproduce both production quote shapes', async () => {
  const require = createRequire(import.meta.url);
  const ProjectsApi = require(join(dirname(require.resolve('@sogni-ai/sogni-client')), 'Projects/index.js')).default;
  const requests: string[] = [];
  const socket = Object.assign(new EventEmitter(), {
    get: async (path: string) => {
      requests.push(path);
      const withVideo = new URL(path, 'https://socket.example').searchParams.get('hasVideoInput') === '1';
      return { quote: { project: {
        costInToken: withVideo ? '5307.12' : '4435.236',
        costInSpark: withVideo ? '5307.12' : '4435.236',
        costInUSD: withVideo ? '26.5356' : '22.17618',
        costInSogni: '0',
      } } };
    },
  });
  const client = Object.assign(new EventEmitter(), { socket, logger: { info() {}, warn() {}, error() {}, debug() {} } });
  const wrapper = new SogniClientWrapper({ username: 'test-user', password: 'test-pass', autoConnect: false });
  (wrapper as any).client = { projects: new ProjectsApi({ client, eip712: {} }) };
  (wrapper as any).connectionState = { isConnected: true };
  const params = { modelId: 'seedance-2-5', width: 1920, height: 1080, duration: 30, tokenType: 'spark' as const };
  assert.equal((await wrapper.estimateVideoCost(params)).usd, '22.17618');
  for (const input of [
    { hasVideoInput: true },
    { referenceVideo: Buffer.from('local reference') },
    { referenceVideoUrls: ['https://example.com/source.mp4'] },
  ]) {
    assert.equal((await wrapper.estimateVideoCost({ ...params, ...input })).usd, '26.5356');
    assert.equal(new URL(requests.at(-1)!, 'https://socket.example').searchParams.get('hasVideoInput'), '1');
  }
});

test('video estimates refuse a MiniMax H3 keyframe count the job cannot have', async () => {
  const wrapper = new SogniClientWrapper({ username: 'test-user', password: 'test-pass', autoConnect: false });
  let calls = 0;
  (wrapper as any).client = { projects: { estimateVideoCost: async () => { calls += 1; return {}; } } };
  (wrapper as any).connectionState = { isConnected: true };
  const params = { modelId: 'minimax-h3-fastvideo-int8_i2v_turbo', width: 1344, height: 768, duration: 8, tokenType: 'spark' as const };
  for (const context of [{ keyframeCount: 9 }, { keyframeCount: 1.5 }, { keyframeCount: -1 }, { keyframes: Array.from({ length: 9 }, () => ({})) }]) {
    await assert.rejects(
      wrapper.estimateVideoCost({ ...params, ...context } as VideoCostEstimateParams),
      /Keyframe count must be a whole number from 0 to 8/,
    );
  }
  assert.equal(calls, 0);
});

test('a MiniMax H3 keyframe count reaches the socket estimate query through the installed SDK', async () => {
  const require = createRequire(import.meta.url);
  const ProjectsApi = require(join(dirname(require.resolve('@sogni-ai/sogni-client')), 'Projects/index.js')).default;
  const requests: string[] = [];
  const socket = Object.assign(new EventEmitter(), {
    get: async (path: string) => {
      requests.push(path);
      return { quote: { project: { costInToken: '50', costInSpark: '50', costInUSD: '0.25', costInSogni: '0' } } };
    },
  });
  const client = Object.assign(new EventEmitter(), { socket, logger: { info() {}, warn() {}, error() {}, debug() {} } });
  const wrapper = new SogniClientWrapper({ username: 'test-user', password: 'test-pass', autoConnect: false });
  (wrapper as any).client = { projects: new ProjectsApi({ client, eip712: {} }) };
  (wrapper as any).connectionState = { isConnected: true };
  await wrapper.estimateVideoCost({
    modelId: 'minimax-h3-fastvideo-int8_i2v_turbo', width: 1344, height: 768, duration: 8, tokenType: 'spark', keyframeCount: 8,
  });
  assert.equal(new URL(requests.at(-1)!, 'https://socket.example').searchParams.get('keyframeCount'), '8');
});
