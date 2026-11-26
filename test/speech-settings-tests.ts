/**
 * Unit tests for the speech synthesis contract (src/media/speechSettings.ts)
 * covering Qwen3-TTS 1.7B modes and Fish Drama 3.
 */
import {
  DEFAULT_SPEECH_LANGUAGE,
  DEFAULT_SPEECH_MODE,
  DEFAULT_SPEECH_VOICE,
  DRAMA3_DIRECTION_TAG_EXAMPLES,
  DRAMA3_MAX_REFERENCE_TEXT_CHARS,
  DRAMA3_OUTPUT_SAMPLE_RATE,
  DRAMA3_REFERENCE_SECONDS,
  SPEECH_LANGUAGES,
  SPEECH_LANGUAGE_OPTIONS,
  SPEECH_MAX_INSTRUCT_CHARS,
  SPEECH_MAX_REFERENCE_TEXT_CHARS,
  SPEECH_MAX_SCRIPT_CHARS,
  SPEECH_MODELS,
  SPEECH_MODEL_IDS,
  SPEECH_MODE_OPTIONS,
  SPEECH_OUTPUT_SAMPLE_RATE,
  SPEECH_REFERENCE_SECONDS,
  SPEECH_VOICES,
  SpeechModel,
  getSpeechMode,
  getSpeechModel,
  isSpeechModel,
  validateSpeechRequest,
  type SpeechMode,
  type SpeechRequest,
} from '../src/media/speechSettings';

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

const SCRIPT = 'Good evening. This is a test of the emergency broadcast system.';

function request(mode: SpeechMode, overrides: Partial<SpeechRequest> = {}): SpeechRequest {
  return { mode, script: SCRIPT, ...overrides };
}

export function runSpeechSettingsTests(): { passed: number; failed: number } {
  console.log('\n🧪 media/speechSettings — Qwen3-TTS + Fish Drama 3 speech contract\n');

  // --- catalogue ---------------------------------------------------------
  expect('four checkpoints', SPEECH_MODEL_IDS.length, 4);
  expect(
    'ids match the socket catalogue byte for byte',
    [...SPEECH_MODEL_IDS],
    [
      'qwen3_tts_1.7b_custom_voice_bf16',
      'qwen3_tts_1.7b_voice_clone_bf16',
      'qwen3_tts_1.7b_voice_design_bf16',
      'fish_drama_3_nvfp4',
    ],
  );
  expect('nine studio voices', SPEECH_VOICES.length, 9);
  expect('default voice is one of them', SPEECH_VOICES.some((v) => v.id === DEFAULT_SPEECH_VOICE), true);
  expect('twelve language choices including auto and arabic', SPEECH_LANGUAGES.length, 12);
  expect('arabic is included', SPEECH_LANGUAGES.includes('arabic'), true);
  expect('auto is the default', DEFAULT_SPEECH_LANGUAGE, 'auto');
  expect('every language has a label', SPEECH_LANGUAGE_OPTIONS.every((o) => Boolean(o.label)), true);
  expect('qwen codec output rate', SPEECH_OUTPUT_SAMPLE_RATE, 24000);
  expect('drama3 codec output rate', DRAMA3_OUTPUT_SAMPLE_RATE, 44100);
  expect('qwen reference clip bounds', SPEECH_REFERENCE_SECONDS, { min: 3, max: 30 });
  expect('drama3 reference clip bounds', DRAMA3_REFERENCE_SECONDS, { min: 1, max: 30 });
  expect('drama3 max reference transcript chars', DRAMA3_MAX_REFERENCE_TEXT_CHARS, 2000);
  expect('drama3 inline direction examples', DRAMA3_DIRECTION_TAG_EXAMPLES.length, 5);
  expect('a mode option per checkpoint', SPEECH_MODE_OPTIONS.length, 4);
  expect('default mode needs no upload', SPEECH_MODELS[DEFAULT_SPEECH_MODE].referenceAudio, 'unsupported');
  const drama3Option = SPEECH_MODE_OPTIONS.find((option) => option.value === 'drama3');
  expect(
    'drama3 mode option exposes expected fields',
    Object.keys(drama3Option ?? {}).sort(),
    ['description', 'label', 'value'],
  );
  expect(
    'drama3 mode option has no creativity property',
    (drama3Option as Record<string, unknown> | undefined)?.creativity,
    undefined,
  );
  expect(
    'drama3 capability keys match contract',
    Object.keys(SPEECH_MODELS.drama3).sort(),
    [
      'creativity',
      'inlineDirections',
      'instruct',
      'maxReferenceTextChars',
      'referenceAudio',
      'referenceSeconds',
      'referenceText',
      'voices',
    ],
  );

  // --- routing -----------------------------------------------------------
  expect('voice resolves to CustomVoice', getSpeechModel('voice'), SpeechModel.voice);
  expect('clone resolves to Base', getSpeechModel('clone'), SpeechModel.clone);
  expect('design resolves to VoiceDesign', getSpeechModel('design'), SpeechModel.design);
  expect('drama3 resolves to Fish Drama 3', getSpeechModel('drama3'), SpeechModel.drama3);
  expect('round trip voice', getSpeechMode(getSpeechModel('voice')), 'voice');
  expect('round trip clone', getSpeechMode(getSpeechModel('clone')), 'clone');
  expect('round trip design', getSpeechMode(getSpeechModel('design')), 'design');
  expect('round trip drama3', getSpeechMode(getSpeechModel('drama3')), 'drama3');
  expect('music is not speech', isSpeechModel('minimax_music3'), false);
  expect('speech is speech', isSpeechModel(SpeechModel.clone), true);
  expect('drama3 is speech', isSpeechModel(SpeechModel.drama3), true);
  expect('unknown id has no mode', getSpeechMode('ace_step_1.5_sft'), undefined);

  // --- capability shape ---------------------------------------------------
  expect('only the voice mode picks one from the roster', SPEECH_MODELS.voice.voices, true);
  expect('cloning does not pick a voice', SPEECH_MODELS.clone.voices, false);
  expect('designing does not pick a voice', SPEECH_MODELS.design.voices, false);
  expect('drama3 does not pick a preset voice', SPEECH_MODELS.drama3.voices, false);
  expect('clone requires an upload', SPEECH_MODELS.clone.referenceAudio, 'required');
  expect('drama3 accepts optional reference audio', SPEECH_MODELS.drama3.referenceAudio, 'optional');
  expect('drama3 disables creativity control', SPEECH_MODELS.drama3.creativity, false);
  expect('drama3 supports inline directions', SPEECH_MODELS.drama3.inlineDirections, true);
  expect('designing requires a description', SPEECH_MODELS.design.instruct, 'required');
  expect('cloning takes no style direction', SPEECH_MODELS.clone.instruct, 'unsupported');
  expect('drama3 takes no separate style direction', SPEECH_MODELS.drama3.instruct, 'unsupported');

  // --- validation: the script --------------------------------------------
  expect('a valid studio-voice request passes', validateSpeechRequest(request('voice')), null);
  expect(
    'an empty script is refused',
    validateSpeechRequest(request('voice', { script: '   ' })),
    'Speech generation needs the words to speak',
  );
  expect(
    'a script at the limit passes',
    validateSpeechRequest(request('voice', { script: 'a'.repeat(SPEECH_MAX_SCRIPT_CHARS) })),
    null,
  );
  expect(
    'an over-long script is refused rather than truncated',
    validateSpeechRequest(request('voice', { script: 'a'.repeat(SPEECH_MAX_SCRIPT_CHARS + 1) })),
    `Speech scripts are limited to ${SPEECH_MAX_SCRIPT_CHARS} characters; this one is ${SPEECH_MAX_SCRIPT_CHARS + 1}`,
  );

  // --- validation: voices and directions ----------------------------------
  expect('a real voice passes', validateSpeechRequest(request('voice', { voice: 'ryan' })), null);
  expect(
    'an invented voice is refused',
    validateSpeechRequest(request('voice', { voice: 'morgan_freeman' as never })),
    'Unknown voice: morgan_freeman',
  );
  expect(
    'a voice on the clone mode is refused',
    validateSpeechRequest(request('clone', { voice: 'ryan', hasReferenceAudio: true })),
    'This speech mode does not use preset voices',
  );
  expect(
    'a style direction on the clone mode is refused',
    validateSpeechRequest(request('clone', { hasReferenceAudio: true, instruct: 'whispering' })),
    'This speech mode takes no style direction',
  );
  expect(
    'an over-long direction is refused',
    validateSpeechRequest(request('design', { instruct: 'x'.repeat(SPEECH_MAX_INSTRUCT_CHARS + 1) })),
    `The voice direction is limited to ${SPEECH_MAX_INSTRUCT_CHARS} characters; this one is ${SPEECH_MAX_INSTRUCT_CHARS + 1}`,
  );

  // --- validation: required inputs & Drama 3 ------------------------------
  expect(
    'cloning without a recording is refused',
    validateSpeechRequest(request('clone')),
    'Cloning a voice needs a reference recording of it',
  );
  expect(
    'cloning with a recording passes',
    validateSpeechRequest(request('clone', { hasReferenceAudio: true })),
    null,
  );
  expect(
    'cloning with a transcript passes',
    validateSpeechRequest(
      request('clone', { hasReferenceAudio: true, referenceText: 'the reference line' }),
    ),
    null,
  );
  expect(
    'an over-long clone transcript is refused at 1024 chars',
    validateSpeechRequest(
      request('clone', {
        hasReferenceAudio: true,
        referenceText: 'x'.repeat(SPEECH_MAX_REFERENCE_TEXT_CHARS + 1),
      }),
    ),
    `The reference transcript is limited to ${SPEECH_MAX_REFERENCE_TEXT_CHARS} characters; this one is ${SPEECH_MAX_REFERENCE_TEXT_CHARS + 1}`,
  );
  expect(
    'drama3 without reference audio passes',
    validateSpeechRequest(request('drama3', { script: '[sighs] Finally quiet.' })),
    null,
  );
  expect(
    'drama3 with optional reference audio and 2000-char transcript passes',
    validateSpeechRequest(
      request('drama3', {
        hasReferenceAudio: true,
        referenceText: 'x'.repeat(DRAMA3_MAX_REFERENCE_TEXT_CHARS),
      }),
    ),
    null,
  );
  expect(
    'drama3 over 2000-char transcript is refused',
    validateSpeechRequest(
      request('drama3', {
        hasReferenceAudio: true,
        referenceText: 'x'.repeat(DRAMA3_MAX_REFERENCE_TEXT_CHARS + 1),
      }),
    ),
    `The reference transcript is limited to ${DRAMA3_MAX_REFERENCE_TEXT_CHARS} characters; this one is ${DRAMA3_MAX_REFERENCE_TEXT_CHARS + 1}`,
  );
  expect(
    'drama3 reference transcript without reference audio is refused',
    validateSpeechRequest(request('drama3', { referenceText: 'spoken words' })),
    'A reference transcript requires a reference recording',
  );
  expect(
    'drama3 ignores caller-supplied creativity without failing',
    validateSpeechRequest(request('drama3', { creativity: 99 })),
    null,
  );
  expect(
    'arabic language passes',
    validateSpeechRequest(request('drama3', { language: 'arabic' })),
    null,
  );
  expect(
    'a recording on a mode that cannot use it is refused',
    validateSpeechRequest(request('voice', { hasReferenceAudio: true })),
    'This speech mode takes no reference recording',
  );
  expect(
    'a transcript with nothing to transcribe is refused',
    validateSpeechRequest(request('voice', { referenceText: 'anything' })),
    'This speech mode has nothing to transcribe',
  );
  expect(
    'designing without a description is refused',
    validateSpeechRequest(request('design')),
    'Designing a voice needs a description of the speaker',
  );
  expect(
    'designing with a description passes',
    validateSpeechRequest(request('design', { instruct: 'a gravelly night-radio host' })),
    null,
  );
  expect(
    'an unsupported language is refused',
    validateSpeechRequest(request('voice', { language: 'klingon' as never })),
    'Unsupported language: klingon',
  );

  console.log(`\nspeechSettings: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}

const isMain = process.argv[1]?.includes('speech-settings-tests');
if (isMain) {
  const { failed } = runSpeechSettingsTests();
  process.exit(failed > 0 ? 1 : 0);
}
