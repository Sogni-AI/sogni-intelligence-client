/**
 * Shared My Personas contracts for reference-to-video models and persona voice.
 *
 * MiniMax H3 reference-to-video, Seedance and Wan 3 take a persona's reference
 * images directly, so the persona gating policy, the resolve_personas and
 * generate_video prompt contracts, and the tool descriptions must route those
 * renders straight to generate_video while LTX and animate_photo keep the
 * image-first default. Persona voice reaches those models as an audio
 * reference, and generate_speech clones a persona's full voice recording.
 */
import {
  ContractRegistry,
  PROMPT_CONTRACTS,
  classifyTurn,
  populateContractsDefaults,
  validateAndNormalizeHostedToolArguments,
} from '../src/contracts/index';
import {
  animatePhotoDefinition,
  generateSpeechDefinition,
  generateVideoDefinition,
} from '../src/tools/index';
import { VIDEO_GENERATION_SKILL } from '../src/public-skill-runtime/index';

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

function contractText(toolName: string): string {
  return PROMPT_CONTRACTS.find((contract) => contract.toolName === toolName)?.baseDescription ?? '';
}

function propertyDescription(
  definition: { function: { parameters: Record<string, unknown> } },
  name: string,
): string {
  const properties = definition.function.parameters.properties as Record<string, { description?: string }>;
  return properties[name]?.description ?? '';
}

function propertyEnum(
  definition: { function: { parameters: Record<string, unknown> } },
  name: string,
): string[] {
  const properties = definition.function.parameters.properties as Record<string, { enum?: string[] }>;
  return properties[name]?.enum ?? [];
}

export function runPersonaReferenceVideoTests(): { passed: number; failed: number } {
  testsPassed = 0;
  testsFailed = 0;

  // --- Gating: a persona video turn starts with resolve_personas, keeps
  // generate_video available, and tells the model which models skip the still.
  const registry = new ContractRegistry();
  populateContractsDefaults(registry);
  const personaVideoTurn = classifyTurn({
    messages: [],
    assetManifest: { items: [] },
    sessionState: { hasGeneratedVideo: false, hasUploadedVideo: false, repairCount: 0 },
    availableTools: ['resolve_personas', 'edit_image', 'generate_video', 'animate_photo'],
    registry,
    signals: [
      { kind: 'has_active_persona', source: 'session_state' },
      { kind: 'requests_persona_video_generation', source: 'planner' },
      { kind: 'no_persona_image_in_session', source: 'session_state' },
    ],
  });
  expect(
    'persona video policy fires for an explicit persona video turn',
    personaVideoTurn.appliedPolicies.includes('HAS_PERSONA_AND_REQUESTS_VIDEO'),
    true,
  );
  expect(
    'persona video policy requires only resolve_personas',
    personaVideoTurn.requiredTools,
    ['resolve_personas'],
  );
  expect(
    'persona video policy keeps generate_video visible for reference-to-video models',
    personaVideoTurn.visibleTools.includes('generate_video'),
    true,
  );
  expect(
    'persona video rationale sends H3 r2v, Seedance and Wan 3 references straight to generate_video',
    personaVideoTurn.rationale.includes(
      'On MiniMax H3 reference-to-video, Seedance or Wan 3, pass the resolved persona reference images straight to generate_video',
    ),
    true,
  );
  expect(
    'persona video rationale keeps the image-first default on LTX',
    personaVideoTurn.rationale.includes('On LTX and every other video model, render the persona with edit_image first'),
    true,
  );

  // --- resolve_personas: reference-to-video carve-out, model tokens, real-person
  // note, and the LTX direct-image path.
  const resolvePersonas = contractText('resolve_personas');
  expect(
    'resolve_personas passes persona references straight to reference-to-video models',
    resolvePersonas.includes('straight to generate_video as referenceImageIndices')
      && resolvePersonas.includes('with no edit_image step'),
    true,
  );
  expect(
    'resolve_personas names every persona reference role',
    ['identity portrait', 'full-body front', 'profile', 'back', 'expression', 'character sheet']
      .every((role) => resolvePersonas.includes(role)),
    true,
  );
  expect(
    'resolve_personas binds personas with each model\'s own tokens',
    ['@Image1 on Seedance', '<Picture 1> on MiniMax H3', 'Image 1 on Wan 3']
      .every((token) => resolvePersonas.includes(token)),
    true,
  );
  expect(
    'resolve_personas says each clip carries its own references',
    resolvePersonas.includes('Every clip or scene carries'),
    true,
  );
  expect(
    // Every regular Seedance model takes real people after the likeness agreement (2026-10-21).
    'resolve_personas no longer steers real people away from regular Seedance',
    resolvePersonas.includes('Regular Seedance rejects'),
    false,
  );
  expect(
    'resolve_personas keeps the LTX direct-image path on animate_photo',
    resolvePersonas.includes('DIRECT PERSONA IMAGE: On LTX')
      && resolvePersonas.includes('animate_photo using the injected persona photo'),
    true,
  );

  // --- generate_video: contract and definition carry the same carve-out.
  const generateVideoContract = contractText('generate_video');
  expect(
    'generate_video contract carries the persona reference-to-video rule',
    generateVideoContract.includes('MY PERSONAS:')
      && generateVideoContract.includes('reference images straight in as referenceImageIndices'),
    true,
  );
  const generateVideoDescription = generateVideoDefinition.function.description;
  expect(
    'generate_video definition no longer limits personas to Seedance',
    generateVideoDescription.includes('Do NOT use for My Personas'),
    false,
  );
  expect(
    'generate_video definition keeps LTX and WAN 2.2 image-first',
    generateVideoDescription.includes('On LTX and WAN 2.2, persona videos use resolve_personas → edit_image → animate_photo'),
    true,
  );
  expect(
    'generate_video offers the reference-to-video selectors the persona rule names',
    ['minimax-h3-r2v', 'seedance2-5-uncensored', 'wan3.0-video', 'wan3.0-spicy-video']
      .every((model) => propertyEnum(generateVideoDefinition, 'videoModel').includes(model)),
    true,
  );

  // --- Persona voice: generate_video takes it on ltx23, H3 r2v, Seedance and Wan 3.
  const generateVideoVoice = propertyDescription(generateVideoDefinition, 'voicePersonaName');
  expect(
    'generate_video voicePersonaName is Audio ID on ltx23',
    generateVideoVoice.includes('On ltx23 it is Audio ID'),
    true,
  );
  expect(
    'generate_video voicePersonaName is an audio reference on H3 r2v, Seedance and Wan 3',
    generateVideoVoice.includes('On MiniMax H3 r2v, Seedance and Wan 3')
      && generateVideoVoice.includes('attached as an audio reference')
      && generateVideoVoice.includes('counts against the model\'s audio reference limit'),
    true,
  );
  expect(
    'generate_video voicePersonaName keeps the sample as identity, not soundtrack',
    generateVideoVoice.includes('The sample is the voice, not the soundtrack'),
    true,
  );
  expect(
    'generate_video voicePersonaName no longer requires ltx23',
    generateVideoVoice.includes('Requires ltx23'),
    false,
  );
  expect(
    'H3 r2v with persona references, a persona voice and reference_only audio policy validates',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: '<Picture 1> walks into the cafe and says "Morning, everyone."',
      videoModel: 'minimax-h3-r2v',
      referenceImageIndices: [-1, -2],
      voicePersonaName: 'Mark',
      sourceAudioPolicy: 'reference_only',
    }).ok,
    true,
  );
  expect(
    'Seedance Uncensored with persona references and a persona voice validates',
    validateAndNormalizeHostedToolArguments([generateVideoDefinition], 'generate_video', {
      prompt: 'Use @Image1 as Mark\'s identity reference. Mark waves and says "Hi."',
      videoModel: 'seedance2-5-uncensored',
      referenceImageIndices: [-1, -2, -3],
      voicePersonaName: 'Mark',
    }).ok,
    true,
  );

  // animate_photo stays LTX 2.3 for persona voice and points elsewhere for R2V.
  const animateVoice = propertyDescription(animatePhotoDefinition, 'voicePersonaName');
  expect(
    'animate_photo voicePersonaName stays ltx23-only',
    animateVoice.includes('On animate_photo it requires ltx23'),
    true,
  );
  expect(
    'animate_photo voicePersonaName points reference-to-video persona voice at generate_video',
    animateVoice.includes('For a persona voice on MiniMax H3 r2v, Seedance or Wan 3, use generate_video'),
    true,
  );
  expect(
    'animate_photo keeps the persona image-first pipeline',
    animatePhotoDefinition.function.description.includes('The standard pipeline is: resolve_personas → edit_image → animate_photo'),
    true,
  );

  const soundToVideo = contractText('sound_to_video');
  expect(
    'sound_to_video routes persona voice to voicePersonaName on every supporting model',
    soundToVideo.includes('a voice reference on MiniMax H3 reference-to-video, Seedance and Wan 3'),
    true,
  );

  // --- generate_speech: a persona's full voice recording is a clone source and
  // its saved transcript is supplied by the runtime.
  const speech = contractText('generate_speech');
  expect(
    'generate_speech clones a persona voice recording from the resolve_personas index',
    speech.includes('use model="clone" with voiceSourceIndex set to the full voice recording index it reports'),
    true,
  );
  expect(
    'generate_speech leaves a persona transcript to the runtime',
    speech.includes('Leave it out for a persona recording'),
    true,
  );
  const speechContract = PROMPT_CONTRACTS.find((contract) => contract.toolName === 'generate_speech');
  expect(
    'generate_speech parameter docs name the persona recording index and transcript auto-fill',
    Boolean(speechContract?.parameterDocs.voiceSourceIndex?.includes('resolve_personas reports'))
      && Boolean(speechContract?.parameterDocs.voiceTranscript?.includes('filled in automatically')),
    true,
  );
  expect(
    'generate_speech definition offers clone for a saved persona voice',
    propertyDescription(generateSpeechDefinition, 'model').includes('a resolved persona\'s voice recording'),
    true,
  );
  expect(
    'generate_speech clone of a persona recording without a transcript validates',
    validateAndNormalizeHostedToolArguments([generateSpeechDefinition], 'generate_speech', {
      prompt: 'Thanks for watching, see you next week.',
      model: 'clone',
      voiceSourceIndex: -2,
    }).ok,
    true,
  );

  // --- Public skill runtime carries the same carve-out.
  expect(
    'public video skill sends persona references straight to reference-to-video models',
    VIDEO_GENERATION_SKILL.constraints?.some((constraint) =>
      constraint.includes('For My Personas video requests on MiniMax H3 reference-to-video, Seedance or Wan 3'),
    ) ?? false,
    true,
  );

  console.log(`\npersonaReferenceVideo: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}

const isMain = process.argv[1]?.includes('persona-reference-video-tests');
if (isMain) {
  const { failed } = runPersonaReferenceVideoTests();
  process.exit(failed > 0 ? 1 : 0);
}
