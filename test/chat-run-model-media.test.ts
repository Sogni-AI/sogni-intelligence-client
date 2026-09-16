import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChatRunArtifactRefs,
  extractChatRunMediaFromEventPayload,
  extractChatRunMediaFromRecord,
  isChatRunMediaType,
} from '../src/chatRun/index.js';

test('GLB artifacts survive workflow conversion, streaming, and restored chat snapshots', () => {
  const url = 'https://assets.example.com/object.glb';
  const artifacts = buildChatRunArtifactRefs({
    toolCallId: 'mesh-call',
    workflowId: 'mesh-workflow',
    artifacts: [{ id: 'mesh', kind: 'model', url }],
  });
  assert.equal(artifacts[0].mediaType, 'model');
  assert.deepEqual(extractChatRunMediaFromRecord({ artifacts }), [{ url, mediaType: 'model' }]);
  assert.deepEqual(extractChatRunMediaFromEventPayload({
    toolName: 'image_to_3d', modelDisplayName: 'Pixal3D',
    artifacts,
    mediaUrls: [{ url, mediaType: 'model' }],
  }), [{ url, mediaType: 'model', toolName: 'image_to_3d', modelDisplayName: 'Pixal3D' }]);
  const fallback = buildChatRunArtifactRefs({
    toolCallId: 'mesh-call', mediaUrls: [{ url, mediaType: 'model' }], partial: true,
  });
  assert.deepEqual(fallback, [{ id: 'art_mesh-call_1', url, mediaType: 'model', partial: true }]);
});

test('media validation still rejects unknown kinds and inline or unsafe URLs', () => {
  assert.equal(isChatRunMediaType('model'), true);
  assert.equal(isChatRunMediaType('mesh'), false);
  assert.deepEqual(extractChatRunMediaFromEventPayload({ mediaUrls: [
    { url: 'data:model/gltf-binary;base64,AAAA', mediaType: 'model' },
    { url: 'file:///tmp/model.glb', mediaType: 'model' },
    { url: 'https://assets.example.com/object.glb', mediaType: 'mesh' },
  ] }), []);
});
