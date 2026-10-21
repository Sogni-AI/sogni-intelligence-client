/**
 * Shared My Personas reference rules: naming, upload order, default reference
 * selection for reference-to-video models, voice selection and the reference
 * description. Chat, sogni-api, the Sogni app and the skill rely on these
 * agreeing, so a negative upload index means the same file in every host.
 */
import {
  defaultReferenceImageOrdinals,
  describePersonaReferences,
  findPersonaVoiceReference,
  isPersonaExtraView,
  isPersonaPrimaryImage,
  isPersonaVoiceFile,
  parsePersonaFilename,
  preferFullPersonaRecording,
  withPersonaUploads,
  type PersonaReferenceRole,
  type PersonaReferenceSet,
} from '../src/media/index';

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

type Payload = { url: string; mimeType: string; duration?: number };

function persona(id: string, name: string, roles: PersonaReferenceRole[], voiceTranscript?: string): PersonaReferenceSet<Payload> {
  return {
    id,
    name,
    voiceTranscript,
    references: roles.map((role, index) => {
      const audio = role === 'voice' || role === 'voice-video';
      return {
        role,
        kind: audio ? 'audio' as const : 'image' as const,
        isIdentity: index === 0,
        url: `https://media.test/${id}/${role}`,
        mimeType: audio ? 'audio/wav' : 'image/png',
        ...(audio ? { duration: role === 'voice' ? 15 : 5 } : {}),
      };
    }),
  };
}

export function runPersonaReferencesTests(): { passed: number; failed: number } {
  console.log('\n--- My Personas shared reference rules ---');

  const userImage = { type: 'image', filename: 'beach.png' };
  const userAudio = { type: 'audio', filename: 'music.wav', duration: 8 };
  const stale = { type: 'image', filename: 'persona-old.jpg' };
  const uploads = withPersonaUploads([userImage, stale, userAudio], [
    persona('mark', 'Mark', ['front', 'portrait', 'profile', 'back', 'expression', 'sheet', 'voice', 'voice-video'], 'The exact words.'),
    persona('alex', 'Alex', ['portrait', 'front', 'profile']),
  ]);

  expect('upload order: user files, main images, extra views, voices', uploads.map((file) => file.filename), [
    'beach.png',
    'music.wav',
    'persona-mark.jpg',
    'persona-alex.jpg',
    'persona-mark.portrait.png',
    'persona-mark.profile.png',
    'persona-mark.back.png',
    'persona-mark.expression.png',
    'persona-mark.sheet.png',
    'persona-alex.front.png',
    'persona-alex.profile.png',
    'persona-voiceclip-mark',
    'persona-voice-video-mark',
  ]);
  expect('the chosen identity is the main image, whatever its role',
    uploads.find((file) => file.filename === 'persona-mark.jpg')?.personaRole, 'front');
  expect('only the full recording carries the transcript',
    uploads.filter((file) => file.type === 'audio').map((file) => (file as { voiceTranscript?: string }).voiceTranscript ?? null),
    [null, 'The exact words.', null]);

  // Hosts that only kept filenames (sogni-api) classify the same way.
  expect('filename-only main image', isPersonaPrimaryImage({ type: 'image', filename: 'persona-mark.jpg' }), true);
  expect('filename-only extra view', isPersonaExtraView({ type: 'image', filename: 'persona-mark.front.png' }), true);
  expect('filename-only voice excerpt', isPersonaVoiceFile({ type: 'audio', filename: 'persona-voice-video-mark' }), true);
  expect('dotted names keep their slug', parsePersonaFilename('persona-dr.-who.jpg', 'image'), { kind: 'image', slug: 'dr.-who' });
  expect('extra view slug and role', parsePersonaFilename('persona-mark.sheet.jpg', 'image'), { kind: 'image', slug: 'mark', role: 'sheet' });

  // Seedance 2.0 takes 9 images: the user's upload, both identities, then one
  // view per persona in turn; Mark's sheet is the one that doesn't fit.
  const images = uploads.filter((file) => file.type === 'image');
  const chosen = defaultReferenceImageOrdinals(images, 9).map((ordinal) => images[ordinal].filename);
  expect('default selection budgets views fairly, in upload order', chosen, [
    'beach.png',
    'persona-mark.jpg',
    'persona-alex.jpg',
    'persona-mark.portrait.png',
    'persona-mark.profile.png',
    'persona-mark.back.png',
    'persona-mark.expression.png',
    'persona-alex.front.png',
    'persona-alex.profile.png',
  ]);
  expect('a larger cap takes every view', defaultReferenceImageOrdinals(images, 30).length, images.length);
  expect('excluded ordinals stay out', defaultReferenceImageOrdinals(images, 30, new Set([0])).includes(0), false);

  const excerpt = findPersonaVoiceReference(uploads, 'mark', 'video');
  expect('video purpose picks the excerpt', excerpt?.filename, 'persona-voice-video-mark');
  expect('speech purpose picks the full recording', findPersonaVoiceReference(uploads, 'Mark', 'speech')?.filename, 'persona-voiceclip-mark');
  expect('no voice for Alex', findPersonaVoiceReference(uploads, 'Alex', 'video'), null);
  expect('cloning from the excerpt uses the full recording', preferFullPersonaRecording(excerpt!, uploads).filename, 'persona-voiceclip-mark');
  expect('a user recording is left alone', preferFullPersonaRecording(userAudio, uploads).filename, 'music.wav');
  expect('filename-only excerpt resolves to the full recording',
    preferFullPersonaRecording({ type: 'audio', filename: 'persona-voice-video-mark' },
      [{ type: 'audio', filename: 'persona-voiceclip-mark' }, { type: 'audio', filename: 'persona-voice-video-mark' }]).filename,
    'persona-voiceclip-mark');

  expect('description names every reference with its index', describePersonaReferences(uploads)[1],
    'Alex: main identity image -3; full body, front image -9; side profile image -10');
  expect('description marks the saved transcript', describePersonaReferences(uploads)[0].endsWith(
    'voice recording audio -2, 15s, transcript saved; video voice excerpt audio -3, 5s'), true);

  console.log(`\npersonaReferences: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}

const isMain = process.argv[1]?.includes('persona-references-tests');
if (isMain) {
  const { failed } = runPersonaReferencesTests();
  process.exit(failed > 0 ? 1 : 0);
}
