import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MCP_TOOLS, routeMcpCall, validateMcpArguments } from '../src/mcp/index.js';

const base = { prompt: 'Preserve exactly: a red door at dusk.', model: 'test-model', request_id: 'one' };
const image = 'https://media.example/image.webp';
const audio = 'https://media.example/voice.wav';
const video = 'https://media.example/video.mp4';

test('contract contains twelve named, annotated tools with typed output', () => {
  assert.equal(MCP_TOOLS.length, 12);
  assert.equal(new Set(MCP_TOOLS.map(tool => tool.name)).size, 12);
  for (const tool of MCP_TOOLS) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.deepEqual(tool.outputSchema.required, ['kind', 'data']);
    assert.equal(typeof tool.annotations.readOnlyHint, 'boolean');
  }
});

test('image routing preserves prompts, concrete settings, LoRAs and billing', () => {
  const input = { ...base, width: 1920, height: 1080, count: 3, billing_mode: 'subscription', token_type: 'auto',
    parameters: { loras: ['style'], loraStrengths: [0.8] } };
  const routed = routeMcpCall('generate_image', input);
  assert.deepEqual(routed.arguments, { prompt: base.prompt, width: 1920, height: 1080, numberOfVariations: 3,
    model: base.model, loras: ['style'], loraStrengths: [0.8] });
  assert.equal(routed.billingMode, 'subscription');
  assert.deepEqual(input.parameters, { loras: ['style'], loraStrengths: [0.8] });
});

test('image references select edit without changing image identity or order', () => {
  const routed = routeMcpCall('generate_image', { ...base, reference_images: [image, `${image}?second=1`] });
  assert.equal(routed.toolName, 'edit_image');
  assert.equal(routed.arguments.sourceImageIndex, 0);
  assert.deepEqual(routed.mediaReferences.map(ref => ref.url), [image, `${image}?second=1`]);
});

for (const [mode, fields, tool, expected] of [
  ['t2v', {}, 'generate_video', {}],
  ['i2v', { first_frame: image }, 'animate_photo', { sourceImageIndex: 0 }],
  ['flf', { first_frame: image, last_frame: `${image}?end=1` }, 'animate_photo', { sourceImageIndex: 0, endImageIndex: 1 }],
  ['a2v', { audio }, 'sound_to_video', { audioSourceIndex: 0 }],
  ['ia2v', { first_frame: image, audio }, 'sound_to_video', { sourceImageIndex: 0, audioSourceIndex: 0 }],
  ['flfa2v', { first_frame: image, last_frame: `${image}?end=1`, audio }, 'sound_to_video', { sourceImageIndex: 0, endImageIndex: 1, audioSourceIndex: 0 }],
  ['v2v', { source_video: video }, 'video_to_video', { videoSourceIndex: 0 }],
  ['r2v', { reference_images: [image], reference_videos: [video], reference_audios: [audio] }, 'generate_video',
    { referenceImageIndices: [0], referenceVideoIndices: [0], referenceAudioIndices: [0] }],
] as const) {
  test(`video ${mode} maps concrete fields to ${tool}`, () => {
    const routed = routeMcpCall('generate_video', { ...base, duration: 6, ...fields });
    assert.equal(routed.toolName, tool);
    assert.deepEqual(routed.arguments, { prompt: base.prompt, videoModel: base.model, duration: 6, ...expected });
    const explicit = routeMcpCall('generate_video', { ...base, duration: 6, ...fields, mode });
    assert.deepEqual(explicit, routed);
  });
}

test('speech clone and music preserve native settings', () => {
  assert.deepEqual(routeMcpCall('generate_audio', { ...base, kind: 'speech', voice_sample: audio }).arguments,
    { prompt: base.prompt, model: base.model, voiceSourceIndex: 0 });
  assert.deepEqual(routeMcpCall('generate_audio', { ...base, kind: 'music', duration: 60, parameters: { lyrics: 'Exact words' } }).arguments,
    { prompt: base.prompt, model: base.model, duration: 60, lyrics: 'Exact words' });
});

test('stitch uses all videos in order and supplied soundtrack', () => {
  const routed = routeMcpCall('transform_media', { operation: 'stitch_video', request_id: 'stitch', reference_videos: [video, `${video}?two=1`], reference_audios: [audio] });
  assert.deepEqual(routed.arguments, { videoIndices: [0, 1], audioIndex: 0 });
});

test('frame-driven exact dimensions and explicit content preferences survive routing', () => {
  const routed = routeMcpCall('generate_video', { ...base, duration: 5, first_frame: image,
    width: 1920, height: 1080, safe_content_filter: false });
  assert.equal(routed.arguments.aspectRatio, '1920x1080');
  assert.equal(routed.safeContentFilter, false);
  assert.throws(() => routeMcpCall('generate_video', { ...base, duration: 5, mode: 'r2v' }));
});

test('invalid routing fails before a job can be created', () => {
  for (const input of [
    { ...base, duration: 5, last_frame: image },
    { ...base, duration: 5, first_frame: image, mode: 't2v' },
    { ...base, duration: 5, first_frame: image, reference_images: [image] },
    { ...base, duration: 5, parameters: { duration: 7 } },
    { ...base, duration: 'auto' },
    { ...base, duration: 5, reference_images: ['file:///tmp/image.png'] },
    { ...base, duration: 5, reference_images: ['https://name:secret@example.com/a'] },
    { ...base, duration: 5, unknown: 'must not disappear' },
  ]) assert.throws(() => routeMcpCall('generate_video', input));
  assert.throws(() => validateMcpArguments('get_balance', { account_id: 'someone-else' }));
  assert.throws(() => routeMcpCall('transform_media', { operation: 'extend_video', request_id: 'x' }));
  assert.throws(() => routeMcpCall('generate_image', { ...base, parameters: { prompt: 'replace intent' } }));
});
