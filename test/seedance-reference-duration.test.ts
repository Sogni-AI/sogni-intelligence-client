import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SEEDANCE_25_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS,
  SEEDANCE_25_V2V_REFERENCE_MAX_DURATION_SECONDS,
  SEEDANCE_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS,
  SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS,
  getSeedanceReferenceAudioMaxDurationSeconds,
  getSeedanceV2VReferenceMaxDurationSeconds,
  prepareSeedanceV2VSourceVideo,
  type ReferenceVideoTrimRequest,
} from '../src/media/index.js';

const source = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);

function recordingTrimmer() {
  const calls: ReferenceVideoTrimRequest[] = [];
  return {
    calls,
    trimVideo: async (request: ReferenceVideoTrimRequest) => {
      calls.push(request);
      return { data: new Uint8Array([1, 2, 3]), mimeType: 'video/mp4' };
    },
  };
}

test('Seedance 2.5 video-to-video sources keep up to 30 seconds; other models keep the 2.0 ceiling', () => {
  assert.equal(SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS, 15);
  assert.equal(SEEDANCE_25_V2V_REFERENCE_MAX_DURATION_SECONDS, 30);
  for (const id of ['seedance-2-5', 'seedance-2-5-uncensored', 'seedance2-5-v2v', 'seedance2-5-uncensored-v2v']) {
    assert.equal(getSeedanceV2VReferenceMaxDurationSeconds(id), 30, id);
  }
  for (const id of ['seedance-2-0', 'seedance-2-0-mini', 'seedance-2-0-mini-uncensored', 'seedance2-v2v', undefined, null, 'unknown']) {
    assert.equal(getSeedanceV2VReferenceMaxDurationSeconds(id), 15, String(id));
  }
});

test('a 30-second Seedance 2.5 edit source is passed through untrimmed', async () => {
  const trimmer = recordingTrimmer();
  const prepared = await prepareSeedanceV2VSourceVideo(source, 'video/mp4', 'storm.mp4', 30, 30, 0, {
    trimVideo: trimmer.trimVideo,
    modelId: 'seedance-2-5',
  });
  assert.equal(prepared.trimmed, false);
  assert.equal(prepared.data, source);
  assert.equal(trimmer.calls.length, 0);
});

test('a Seedance 2.5 source longer than 30 seconds is trimmed to 30, not 15', async () => {
  const trimmer = recordingTrimmer();
  const prepared = await prepareSeedanceV2VSourceVideo(source, 'video/mp4', 'long.mp4', 45, 30, 0, {
    trimVideo: trimmer.trimVideo,
    modelId: 'seedance-2-5-uncensored',
  });
  assert.equal(prepared.trimmed, true);
  assert.equal(prepared.trimDuration, 30);
  assert.equal(trimmer.calls[0]?.duration, 30);
});

test('without a model the existing 15-second behaviour is unchanged', async () => {
  const trimmer = recordingTrimmer();
  const prepared = await prepareSeedanceV2VSourceVideo(source, 'video/mp4', 'clip.mp4', 30, 30, 0, {
    trimVideo: trimmer.trimVideo,
  });
  assert.equal(prepared.trimmed, true);
  assert.equal(prepared.trimDuration, 15);
  assert.equal(trimmer.calls[0]?.duration, 15);
});

test('Seedance 2.5 reference audio keeps up to 30.2 seconds; other models keep 15.2', () => {
  assert.equal(SEEDANCE_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS, 15.2);
  assert.equal(SEEDANCE_25_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS, 30.2);
  assert.equal(getSeedanceReferenceAudioMaxDurationSeconds('seedance-2-5'), 30.2);
  assert.equal(getSeedanceReferenceAudioMaxDurationSeconds('seedance2-5-uncensored'), 30.2);
  assert.equal(getSeedanceReferenceAudioMaxDurationSeconds('seedance-2-0'), 15.2);
  assert.equal(getSeedanceReferenceAudioMaxDurationSeconds(undefined), 15.2);
});
