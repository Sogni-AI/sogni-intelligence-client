/**
 * Shared My Personas reference rules: naming, upload order, default reference
 * selection for reference-to-video models, voice selection and the reference
 * description. Chat, sogni-api, the Sogni app and the skill rely on these
 * agreeing, so a negative upload index means the same file in every host.
 */
import {
  defaultPersonaSheetModel,
  personaSheetModel,
  personaSheetContentRequest,
  personaSheetModelUnavailableReason,
  personaSheetModels,
  personaSheetPhotos,
  personaSheetPrompt,
  PERSONA_SHEET_CONTENT_PHOTOS,
  PERSONA_SHEET_MODELS,
  readPersonaSheetContent,
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
    'persona-mark.sheet.png',
    'persona-mark.portrait.png',
    'persona-mark.profile.png',
    'persona-mark.back.png',
    'persona-mark.expression.png',
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
  // view per persona in turn, sheets first; Mark's expression is the one that doesn't fit.
  const images = uploads.filter((file) => file.type === 'image');
  const chosen = defaultReferenceImageOrdinals(images, 9).map((ordinal) => images[ordinal].filename);
  expect('default selection budgets views fairly, in upload order', chosen, [
    'beach.png',
    'persona-mark.jpg',
    'persona-alex.jpg',
    'persona-mark.sheet.png',
    'persona-mark.portrait.png',
    'persona-mark.profile.png',
    'persona-mark.back.png',
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

  // One-pass character sheets.
  // Mark, 2026-10-22: FLUX 3 Image Klein by default; it dresses nude characters.
  expect('a photo starts on FLUX 3 Image Klein', defaultPersonaSheetModel(1).id, 'flux3_image_klein_sd_int8_convrot');
  expect('a description starts on FLUX 3 Image Klein', defaultPersonaSheetModel(0).id, 'flux3_image_klein_sd_int8_convrot');
  expect('a nude persona with photos starts on Dark Beast with the filter off',
    defaultPersonaSheetModel(1, { nude: true, safeContentFilter: false }).id, 'dark_beast_krea2_identity_edit_v1_2');
  expect('a nude persona from a description starts on MOSS-Image with the filter off',
    defaultPersonaSheetModel(0, { nude: true, safeContentFilter: false }).id, 'moss_image_sft_int8_convrot');
  expect('the filter keeps a nude persona on FLUX 3 Image Klein',
    defaultPersonaSheetModel(1, { nude: true, safeContentFilter: true }).id, 'flux3_image_klein_sd_int8_convrot');
  expect('every listed sheet model, default first', PERSONA_SHEET_MODELS.map((model) => model.id), [
    'flux3_image_klein_sd_int8_convrot',
    'gpt-image-2.5-sunburst',
    'qwen_image_edit_2511_fp8_lightning',
    'krea2_identity_edit_v1_2',
    'dark_beast_krea2_identity_edit_v1_2',
    'moss_image_sft_int8_convrot',
  ]);
  expect('the filter leaves out Dark Beast only', personaSheetModels(true).map((model) => model.id).includes('dark_beast_krea2_identity_edit_v1_2'), false);
  expect('the filter keeps the other five', personaSheetModels(true).length, 5);
  expect('filter off offers all six', personaSheetModels(false).length, 6);
  expect('nude-keeping models are Dark Beast and MOSS-Image',
    PERSONA_SHEET_MODELS.filter((model) => model.keepsNudity).map((model) => model.id),
    ['dark_beast_krea2_identity_edit_v1_2', 'moss_image_sft_int8_convrot']);
  const check = personaSheetContentRequest({ name: 'Lilith', description: 'A succubus queen.' }, ['data:image/jpeg;base64,AAAA']);
  const checkContent = check.messages[1].content as Array<{ type: string; text?: string }>;
  expect('the check sends each photo then the notes', checkContent.map((part) => part.type), ['image_url', 'text']);
  expect('the check names the character', checkContent[1].text, 'Character notes: Lilith A succubus queen.');
  expect('the check asks for one boolean', check.response_format.json_schema.schema.required, ['nude']);
  expect('the check reads the same photos as a two-photo sheet', PERSONA_SHEET_CONTENT_PHOTOS.maxPhotos, 2);
  expect('the reply is read as a boolean', [readPersonaSheetContent('{"nude": true}'), readPersonaSheetContent('{ "nude": false }')], [true, false]);
  expect('an unreadable reply is unknown', [readPersonaSheetContent('yes'), readPersonaSheetContent(null), readPersonaSheetContent('{"nude":"yes"}')], [null, null, null]);
  const krea = personaSheetModel('krea2_identity_edit_v1_2')!;
  const moss = personaSheetModel('moss_image_sft_int8_convrot')!;
  expect('Krea renders sheets square', [krea.width, krea.height], [1024, 1024]);
  expect('photo models need a photo', personaSheetModelUnavailableReason(krea, 0), 'Add a photo first');
  expect('description models never do', personaSheetModelUnavailableReason(moss, 0), null);
  const saved = [
    { id: 'face', role: 'portrait' },
    { id: 'old-body', role: 'front' },
    { id: 'side', role: 'profile' },
    { id: 'body', role: 'front' },
    { id: 'old-sheet', role: 'sheet' },
  ];
  expect('body first, face second for two-photo models', personaSheetPhotos(saved, 'face', krea).map((photo) => photo.id), ['body', 'face']);
  expect('description-only models take no photos', personaSheetPhotos(saved, 'face', moss), []);
  expect('an earlier sheet never feeds a new one',
    personaSheetPhotos([{ id: 'old-sheet', role: 'sheet' }], 'old-sheet', krea), []);
  expect('the chosen identity is the face', personaSheetPhotos(saved, 'side', krea).map((photo) => photo.id), ['body', 'side']);
  expect('two photos are named in order', personaSheetPrompt({}, 2).includes('Image 1 shows their body and outfit, Image 2 shows their face'), true);
  expect('a description sheet uses the brief and no likeness line',
    [personaSheetPrompt({ appearance: 'Silver hair' }, 0).includes('Appearance: Silver hair.'), personaSheetPrompt({}, 0).includes('likeness')],
    [true, false]);
  expect('long briefs stay bounded', personaSheetPrompt({ description: 'x'.repeat(5000) }, 1).length < 2000, true);

  console.log(`\npersonaReferences: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}

const isMain = process.argv[1]?.includes('persona-references-tests');
if (isMain) {
  const { failed } = runPersonaReferencesTests();
  process.exit(failed > 0 ? 1 : 0);
}
