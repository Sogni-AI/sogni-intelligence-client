/**
 * Unit tests for speech-to-text transcription settings and formatters
 * (src/media/transcriptionSettings.ts).
 */
import {
  DEFAULT_TRANSCRIPTION_ENGINE,
  TRANSCRIPTION_ENGINE_OPTIONS,
  TRANSCRIPTION_MODELS,
  TRANSCRIPTION_MODEL_IDS,
  TRANSCRIPTION_OUTPUT_FORMATS,
  TRANSCRIPTION_TIMESTAMP_GRANULARITIES,
  TranscriptionModel,
  formatTranscriptAsSrt,
  formatTranscriptAsText,
  formatTranscriptAsVtt,
  getTranscriptionEngine,
  getTranscriptionModel,
  isTranscriptionModel,
  normalizeTranscriptArtifact,
  parseWorkerTranscriptArtifact,
  resolveTranscriptionEngineSelector,
  validateTranscriptionRequest,
} from '../src/media/transcriptionSettings';
import { parseWorkerTranscriptArtifact as rootParseWorkerTranscriptArtifact } from '../src/index';

let testsPassed = 0;
let testsFailed = 0;

function expect<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`✅ PASS: ${label}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${label}`);
    console.error(`   expected: ${JSON.stringify(expected)}`);
    console.error(`   actual:   ${JSON.stringify(actual)}`);
    testsFailed++;
  }
}

export function runTranscriptionSettingsTests(): { passed: number; failed: number } {
  console.log('\n🧪 media/transcriptionSettings — Parakeet & Nemotron STT contract\n');

  expect('two STT model IDs', [...TRANSCRIPTION_MODEL_IDS], [
    'parakeet_tdt_0.6b_v3_bf16',
    'nemotron_3.5_transcribe_30b_a4b_nvfp4',
  ]);
  expect('default engine is parakeet', DEFAULT_TRANSCRIPTION_ENGINE, 'parakeet');
  expect('timestamp granularities', [...TRANSCRIPTION_TIMESTAMP_GRANULARITIES], [
    'none',
    'sentence',
    'word',
  ]);
  expect('output formats', [...TRANSCRIPTION_OUTPUT_FORMATS], ['json', 'txt', 'srt', 'vtt']);
  expect('engine options count', TRANSCRIPTION_ENGINE_OPTIONS.length, 2);

  // Routing & aliases
  expect('parakeet model ID', getTranscriptionModel('parakeet'), TranscriptionModel.parakeet);
  expect('nemotron model ID', getTranscriptionModel('nemotron'), TranscriptionModel.nemotron);
  expect('reverse lookup parakeet', getTranscriptionEngine(TranscriptionModel.parakeet), 'parakeet');
  expect('reverse lookup nemotron', getTranscriptionEngine(TranscriptionModel.nemotron), 'nemotron');
  expect('isTranscriptionModel positive', isTranscriptionModel(TranscriptionModel.nemotron), true);
  expect('isTranscriptionModel negative', isTranscriptionModel('fish_drama_3_nvfp4'), false);
  expect('selector whisper-1 -> parakeet', resolveTranscriptionEngineSelector('whisper-1'), 'parakeet');
  expect(
    'selector whisper-1 + diarize -> nemotron',
    resolveTranscriptionEngineSelector('whisper-1', { diarize: true }),
    'nemotron',
  );
  expect(
    'selector whisper-1 + hotwords -> nemotron',
    resolveTranscriptionEngineSelector('whisper-1', { hotwords: 'Sogni' }),
    'nemotron',
  );
  expect(
    'selector whisper-1 + prompt -> nemotron',
    resolveTranscriptionEngineSelector('whisper-1', { prompt: 'Keynote' }),
    'nemotron',
  );
  expect(
    'selector gpt-4o-mini-transcribe -> parakeet',
    resolveTranscriptionEngineSelector('gpt-4o-mini-transcribe'),
    'parakeet',
  );
  expect(
    'selector gpt-4o-transcribe -> nemotron',
    resolveTranscriptionEngineSelector('gpt-4o-transcribe'),
    'nemotron',
  );
  expect(
    'selector gpt-4o-transcribe-diarize -> nemotron',
    resolveTranscriptionEngineSelector('gpt-4o-transcribe-diarize'),
    'nemotron',
  );
  expect(
    'selector canonical nemotron ID -> nemotron',
    resolveTranscriptionEngineSelector('nemotron_3.5_transcribe_30b_a4b_nvfp4'),
    'nemotron',
  );
  expect('unknown selector -> undefined', resolveTranscriptionEngineSelector('unknown-stt'), undefined);

  // Capabilities & validation
  expect('parakeet maxDurationSec', TRANSCRIPTION_MODELS.parakeet.maxDurationSec, 7200);
  expect('parakeet minimumBilledDurationSeconds', TRANSCRIPTION_MODELS.parakeet.minimumBilledDurationSeconds, 10);
  expect('nemotron maxDurationSec', TRANSCRIPTION_MODELS.nemotron.maxDurationSec, 3600);
  expect('nemotron minimumBilledDurationSeconds', TRANSCRIPTION_MODELS.nemotron.minimumBilledDurationSeconds, 10);
  expect(
    'whisper-1 with diarize auto-upgrades to nemotron in validateTranscriptionRequest',
    validateTranscriptionRequest({ engine: 'whisper-1', hasAudio: true, diarize: true, durationSec: 120 }),
    null,
  );
  expect('missing audio refused', validateTranscriptionRequest({ hasAudio: false }), 'Transcription needs an audio or video recording');
  expect('valid parakeet request passes', validateTranscriptionRequest({ engine: 'parakeet', hasAudio: true, durationSec: 7200 }), null);
  expect(
    'parakeet over 7200s refused',
    validateTranscriptionRequest({ engine: 'parakeet', hasAudio: true, durationSec: 7201 }),
    'Parakeet TDT 0.6B v3 supports recordings up to 7200 seconds; this one is 7201 seconds',
  );
  expect(
    'parakeet diarization refused',
    validateTranscriptionRequest({ engine: 'parakeet', hasAudio: true, diarize: true }),
    'Parakeet TDT 0.6B v3 does not support speaker diarization; use nemotron instead',
  );
  expect(
    'omitted engine with diarize auto-selects nemotron and passes',
    validateTranscriptionRequest({ hasAudio: true, diarize: true, durationSec: 1800, hotwords: 'Sogni, Spark' }),
    null,
  );
  expect(
    'nemotron over 3600s refused',
    validateTranscriptionRequest({ engine: 'nemotron', hasAudio: true, durationSec: 3601 }),
    'NVIDIA Nemotron 3.5 Transcribe 30B supports recordings up to 3600 seconds; this one is 3601 seconds',
  );
  expect(
    'nemotron over 1000-char hotwords refused',
    validateTranscriptionRequest({ engine: 'nemotron', hasAudio: true, hotwords: 'a'.repeat(1001) }),
    'Vocabulary hotwords are limited to 1000 characters; got 1001',
  );

  // Normalization & formatters (TXT, SRT, VTT)
  const artifact = normalizeTranscriptArtifact({
    version: 1,
    model: TranscriptionModel.nemotron,
    duration: 5.5,
    diarized: true,
    segments: [
      { id: 0, start: 0, end: 2.25, text: 'Welcome back to Sogni Studio.', speaker: 'S01' },
      { id: 1, start: 2.5, end: 5.5, text: 'Thanks for having me!', speaker: 'S02' },
    ],
    words: [
      { word: 'Welcome', start: 0, end: 0.4, speaker: 'S01' },
    ],
  });

  expect('normalized granularity inferred from words', artifact.timestampGranularity, 'word');
  expect(
    'parseWorkerTranscriptArtifact aliases normalizeTranscriptArtifact on media and root',
    parseWorkerTranscriptArtifact === normalizeTranscriptArtifact &&
      rootParseWorkerTranscriptArtifact === normalizeTranscriptArtifact,
    true,
  );
  expect(
    'formatTranscriptAsText with speakers',
    formatTranscriptAsText(artifact),
    '[S01] Welcome back to Sogni Studio.\n[S02] Thanks for having me!',
  );
  expect(
    'formatTranscriptAsText without speakers',
    formatTranscriptAsText(artifact, { includeSpeakers: false }),
    'Welcome back to Sogni Studio.\nThanks for having me!',
  );
  expect(
    'formatTranscriptAsSrt produces valid SRT cues',
    formatTranscriptAsSrt(artifact),
    '1\n00:00:00,000 --> 00:00:02,250\n[S01] Welcome back to Sogni Studio.\n\n2\n00:00:02,500 --> 00:00:05,500\n[S02] Thanks for having me!',
  );
  expect(
    'formatTranscriptAsVtt produces valid WebVTT cues',
    formatTranscriptAsVtt(artifact),
    'WEBVTT\n\n00:00:00.000 --> 00:00:02.250\n<v S01>Welcome back to Sogni Studio.\n\n00:00:02.500 --> 00:00:05.500\n<v S02>Thanks for having me!\n',
  );

  console.log(`\ntranscriptionSettings: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}

const isMain = process.argv[1]?.includes('transcription-settings-tests');
if (isMain) {
  const { failed } = runTranscriptionSettingsTests();
  process.exit(failed > 0 ? 1 : 0);
}
