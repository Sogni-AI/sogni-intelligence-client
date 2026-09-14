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
