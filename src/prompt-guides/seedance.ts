/**
 * Seedance 2.0 and 2.5 prompt rules.
 *
 * Moved verbatim from @sogni/creative-agent 2.27.8 (src/prompts/video/seedance.ts). creative-agent
 * now imports these rules and composes its writer prompts from them, byte for byte as before.
 */

import { modelPromptGuide, type ModelPromptGuide, type ModelPromptGuideRegistry } from './types.js';

export const SEEDANCE_25_CAPABILITY_GUIDANCE = `TARGET CAPABILITIES: Seedance 2.5 uses the same director-style prompt grammar and per-modality @Image / @Video / @Audio reference syntax as the Seedance 2.0 series. Its capability envelope is larger: 4-30 second clips and up to 30 image references, 10 video references, and 10 audio references, with 50 files total across those per-modality caps. For new footage longer than 15 seconds, use a coherent chronology with time-coded beats that cover the requested duration; do not split the request into multiple clips.`;

export const SEEDANCE_REFERENCE_GRAMMAR_GUIDANCE = `REFERENCE GRAMMAR: Use BytePlus-style @ tags as the canonical prompt-visible reference labels. Refer to attached assets by 1-indexed counters per modality, written exactly as @Image1, @Video1, or @Audio1 with no brackets and no spaces. Counting is independent per modality and follows attachment order. If the base request uses aliases such as Image 1, Video 2, Audio 1, @Image 1, or @Video 2, normalize them to @Image1, @Video2, or @Audio1 in the rewritten prompt. Never mention reference URLs or asset IDs.`;

export const SEEDANCE_REFERENCE_ROLE_GUIDANCE = `REFERENCE ROLE DISCIPLINE: Assign every useful reference asset a clear creative role. Do not write vague phrases like "use the attached files." State whether each useful file is an edit target or only a reference. Use role language such as "Use @Image1 as the character identity reference," "Use @Image2 for wardrobe and color palette," "Use @Video1 for camera movement and action timing only," or "Use @Audio1 as the rhythm and background music guide."`;

export const SEEDANCE_DIRECTORIAL_GUIDANCE = `DIRECTORIAL BRIEF: Write like a concise director's shot brief, not a static image caption. Include concrete physical interactions, motion timing, mood, lighting, and sound cues that help the model understand both what the scene looks like and how it changes over time. Turn each quality the shot must convey, such as speed, size, weight, danger or feeling, into what a camera and microphone would capture at real-world proportions, because the model renders what it can see and hear, not a number or an adjective.`;

export const SEEDANCE_CAMERA_PHYSICS_GUIDANCE = `CAMERA AND PHYSICS: Prefer one primary camera move. Separate subject motion from camera motion. Describe pace in words that match the shot instead of technical camera settings: slow, smooth, gradual, or controlled for calm moments; for fast action, show the speed through what rushes past the camera, the ground covered within a beat, and impacts with their consequences, because a stated speed or the word "fast" alone renders slower than intended. Ground action in physical details such as fabric movement, reflections, dust, water, contact, momentum, and object interaction when relevant.`;

export const SEEDANCE_POSITIVE_CONSTRAINT_GUIDANCE = `POSITIVE CONSTRAINTS: Prefer positive preservation language over negative-only phrasing. Say "Keep the logo crisp and readable," "Maintain the same face structure, outfit, silhouette, and proportions from @Image1," and "Keep every person, prop and color consistent from the first frame to the last."`;

const SEEDANCE_SPEECH_LINE_GUIDANCE = `SPEECH: Write every spoken line in double quotes with who says it, and state plainly that an on-screen speaker's lips move with the words.`;

/** Speech rules for the reference modes. The export keeps its historical name. */
export const SEEDANCE_LIMITATION_GUIDANCE = `${SEEDANCE_SPEECH_LINE_GUIDANCE} When the request gives an @Audio reference the role of a person's voice, keep that role: it is the character's voice identity, not background music or the soundtrack.`;

const SEEDANCE_VISIBLE_TEXT_GUIDANCE = `VISIBLE TEXT: Put every word that must appear on screen in double quotes after "reads", such as a sign that reads "OPEN 24H", with the request's exact spelling.`;

const SEEDANCE_SHOT_GUIDANCE = `SHOTS: Use one continuous shot when the request describes one continuous action, place or camera move, and separate shots when it asks for cuts or a montage or moves between places, viewpoints or moments. Open each new shot with its own time-coded beat that names the cut, such as "4-7s: Cut to a close-up of ...".`;

const SEEDANCE_FRAME_SHOT_GUIDANCE = `SHOTS: Keep one continuous shot unless the request asks for a cut; then open the new shot with its own time-coded beat that names the cut, such as "3-5s: Cut to a close-up of ...".`;

const SEEDANCE_LENGTH_GUIDANCE = `LENGTH: About 80–150 words for a single-beat shot, plus about 30–50 words for each further time-coded beat. Never drop a detail, beat, quoted line or reference role from the request to save words.`;

// Sections that were written inline in creative-agent's Seedance system prompts.

const SEEDANCE_FRAME_PROMPT_ANATOMY_GUIDANCE = `PROMPT ANATOMY: Include task intent, subject/action, scene, camera, style/lighting, requested audio behavior, continuity, and any final message only when needed. For multi-beat clips, use compact time-coded beats or shot-script phrasing instead of a dense unordered list.`;
const SEEDANCE_FRAME_POSITIVE_CONSTRAINT_GUIDANCE = `POSITIVE CONSTRAINTS: Prefer positive preservation language over negative-only phrasing. Describe consistent temporal continuity, motion at the pace the request calls for, and preservation of the supplied frame's face structure, outfit, silhouette, proportions, and composition when relevant.`;
const SEEDANCE_PROMPT_ANATOMY_GUIDANCE = `PROMPT ANATOMY: Include task intent, reference-role assignments, subject/action, scene, camera, style/lighting, audio behavior, continuity, and any final message only when needed. For multi-beat clips, use compact time-coded beats or shot-script phrasing instead of a dense unordered list.`;
const SEEDANCE_FORMAT_GUIDANCE = `FORMAT: Single present-tense paragraph of short sentences. No bullets, headers, markdown, preamble, or labels. Output ONLY the rewritten prompt.`;
const SEEDANCE_CAMERA_GUIDANCE = `CAMERA: Choose one primary camera behavior for the shot or beat in concrete cinematographic language, matched to scene geometry, subject motion, and mood. The camera may move, hold a POV, or stay locked/static when stillness best serves the shot. Keep camera motion separate from subject motion and do not stack multiple camera moves in one sentence.`;
const SEEDANCE_TIME_CODED_BEATS_GUIDANCE = `TIME-CODED BEATS: For clips longer than 5 seconds, segment the action with time-coded beats such as "0-2s: ..., 2-4s: ..., 4-6s: ...".`;
const SEEDANCE_FRAME_DIALOGUE_AUDIO_GUIDANCE = `DIALOGUE & AUDIO: Preserve quoted dialogue verbatim. Foley and ambience belong in plain sentences. Do not invent music when none was requested.`;
const SEEDANCE_FRAME_DISCIPLINE_GUIDANCE = `FRAME DISCIPLINE: Treat the supplied images as locked native frame parameters. Do not emit @Image tags. Rather than re-describing the frames, name the few visible traits that must hold through the motion, such as hair, outfit and colors.`;
const SEEDANCE_PROPER_NOUN_GUIDANCE = `PROPER NOUNS: Preserve exact spelling and punctuation of brand or product names from the base request, including dotted names such as Sogni.ai.`;
const SEEDANCE_AVOID_GUIDANCE = `AVOID: Contradictions, semicolons, em dashes, parentheticals.`;
const SEEDANCE_I2V_ANCHOR_GUIDANCE = `ANCHOR DISCIPLINE: Treat the supplied image as the locked first-frame anchor. Do not emit an @Image tag. Describe motion, action, and camera that flow forward from it, naming only the few visible traits that must hold as things move, such as hair, outfit and colors, rather than re-describing the frame.`;
const SEEDANCE_I2V_AVOID_GUIDANCE = `AVOID: Contradictions, semicolons, em dashes, parentheticals, and any reference to a second frame, target frame, or interpolation toward another input.`;
const SEEDANCE_L2V_ANCHOR_GUIDANCE = `ANCHOR DISCIPLINE: Treat the supplied image as the locked last-frame anchor. Do not emit an @Image tag. Describe motion, action, and camera that naturally arrive at it, naming only the few visible traits that must hold as things move, such as hair, outfit and colors, rather than re-describing the frame. Never claim the supplied image is the opening frame.`;
const SEEDANCE_L2V_CAMERA_GUIDANCE = `CAMERA: Choose one primary camera behavior for the shot or beat in concrete cinematographic language, matched to scene geometry, subject motion, and mood. Keep camera motion separate from subject motion and do not stack multiple camera moves in one sentence.`;
const SEEDANCE_L2V_AVOID_GUIDANCE = `AVOID: Contradictions, semicolons, em dashes, parentheticals, and phrasing that treats the supplied ending frame as an opening image.`;
const SEEDANCE_V2V_ANCHOR_GUIDANCE = `ANCHOR DISCIPLINE: When the request edits or restyles @Video1, write it as an edit: open with "Edit @Video1.", say what changes (for example "Replace the red car with the blue pickup from @Image1"), then name in one short line what stays the same, such as camera path, timing, people and setting. Do not retell the source clip shot by shot. When the request extends @Video1 or uses it only for motion, camera or timing, give it that role and describe the new footage.`;
const SEEDANCE_V2V_CAMERA_GUIDANCE = `CAMERA: When the camera should change, choose one primary camera behavior for the shot or beat in concrete cinematographic language, matched to scene geometry, subject motion, and mood. The camera may move, hold a POV, or stay locked/static when stillness best serves the shot. Keep camera motion separate from subject motion and do not stack multiple camera moves in one sentence. When the transform is restyle-only, call out that the camera mirrors @Video1.`;
const SEEDANCE_V2V_TIME_CODED_BEATS_GUIDANCE = `TIME-CODED BEATS: For an extension or new footage longer than 5 seconds, segment the action with time-coded beats such as "0-2s: ..., 2-4s: ..., 4-6s: ...". An edit of @Video1 takes no timeline: @Video1 supplies the timing, and a timeline makes Seedance treat the edit as an extension.`;
const SEEDANCE_V2V_DIALOGUE_AUDIO_GUIDANCE = `DIALOGUE & AUDIO: Preserve quoted dialogue verbatim. When an audio reference is present, assign the relevant @Audio tag its role as background music, rhythm guide, sound bed, or speech reference based on the request. Foley and ambience belong in plain sentences. Do not invent music when none was requested.`;
const SEEDANCE_V2V_SUBJECT_IDENTITY_GUIDANCE = `SUBJECT IDENTITY: When image references are present alongside the reference video, anchor identity by reference (for example "the woman from @Image1") and add the few visible traits that must hold, such as hair, outfit and colors, when they matter to the shot.`;
const SEEDANCE_V2V_AVOID_GUIDANCE = `AVOID: Contradictions, semicolons, em dashes, parentheticals, and any phrasing that treats the reference video as a still image or pair of frames.`;
const SEEDANCE_T2V_REFERENCE_MEDIA_GUIDANCE = `When reference videos are listed, use them only for the role requested, such as camera movement, action timing, edit rhythm, or visual effects. When audio references are listed, assign them as soundtrack, rhythm guide, speech reference, or ambience based on the request.`;
const SEEDANCE_T2V_DIALOGUE_AUDIO_GUIDANCE = `DIALOGUE & AUDIO: Seedance generates synchronized audio natively. Preserve quoted dialogue verbatim. Add foley and ambience as plain sentences. Do not invent music when none was requested.`;

/** The `seedance-2.5` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const SEEDANCE_25_NOTES: readonly string[] = [
  'Use @Image1, @Video1, and @Audio1 tags without brackets or spaces.',
  'Assign every useful reference asset a concrete role.',
  'Use one 4-30 second call for a continuous clip when the requested duration fits.',
  'Prefer positive preservation constraints and concise time-coded beats for longer clips.',
  'Write each spoken line in double quotes with its speaker, keeping the user\'s words exactly, and on-screen text in double quotes after "reads".',
];

/** The `seedance-2.0` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const SEEDANCE_20_NOTES: readonly string[] = [
  'Use @Image1, @Video1, and @Audio1 tags without brackets or spaces.',
  'Assign every useful reference asset a concrete role.',
  'Prefer positive preservation constraints and concise time-coded beats for longer clips.',
  'Write each spoken line in double quotes with its speaker, keeping the user\'s words exactly, and on-screen text in double quotes after "reads".',
];

const SEEDANCE_FRAME_CREATIVE_RULES = [
  SEEDANCE_DIRECTORIAL_GUIDANCE,
  SEEDANCE_FRAME_PROMPT_ANATOMY_GUIDANCE,
  SEEDANCE_CAMERA_PHYSICS_GUIDANCE,
  SEEDANCE_FRAME_POSITIVE_CONSTRAINT_GUIDANCE,
  SEEDANCE_FRAME_SHOT_GUIDANCE,
  SEEDANCE_SPEECH_LINE_GUIDANCE,
  SEEDANCE_VISIBLE_TEXT_GUIDANCE,
];

const SEEDANCE_COMMON_CREATIVE_RULES = [
  SEEDANCE_REFERENCE_GRAMMAR_GUIDANCE,
  SEEDANCE_REFERENCE_ROLE_GUIDANCE,
  SEEDANCE_DIRECTORIAL_GUIDANCE,
  SEEDANCE_PROMPT_ANATOMY_GUIDANCE,
  SEEDANCE_CAMERA_PHYSICS_GUIDANCE,
  SEEDANCE_POSITIVE_CONSTRAINT_GUIDANCE,
  SEEDANCE_SHOT_GUIDANCE,
  SEEDANCE_LIMITATION_GUIDANCE,
  SEEDANCE_VISIBLE_TEXT_GUIDANCE,
];

type SeedanceMode = 't2v' | 'i2v' | 'l2v' | 'flf' | 'v2v';

/** The Seedance 2.0 writer's rule block for each mode; Seedance 2.5 adds its capability rule. */
const SEEDANCE_RULES: Readonly<Record<SeedanceMode, readonly string[]>> = {
  t2v: [
    ...SEEDANCE_COMMON_CREATIVE_RULES,
    SEEDANCE_T2V_REFERENCE_MEDIA_GUIDANCE,
    SEEDANCE_FORMAT_GUIDANCE,
    SEEDANCE_CAMERA_GUIDANCE,
    SEEDANCE_TIME_CODED_BEATS_GUIDANCE,
    SEEDANCE_T2V_DIALOGUE_AUDIO_GUIDANCE,
    SEEDANCE_PROPER_NOUN_GUIDANCE,
    SEEDANCE_AVOID_GUIDANCE,
    SEEDANCE_LENGTH_GUIDANCE,
  ],
  i2v: [
    ...SEEDANCE_FRAME_CREATIVE_RULES,
    SEEDANCE_I2V_ANCHOR_GUIDANCE,
    SEEDANCE_FORMAT_GUIDANCE,
    SEEDANCE_CAMERA_GUIDANCE,
    SEEDANCE_TIME_CODED_BEATS_GUIDANCE,
    SEEDANCE_FRAME_DIALOGUE_AUDIO_GUIDANCE,
    SEEDANCE_PROPER_NOUN_GUIDANCE,
    SEEDANCE_I2V_AVOID_GUIDANCE,
    SEEDANCE_LENGTH_GUIDANCE,
  ],
  l2v: [
    ...SEEDANCE_FRAME_CREATIVE_RULES,
    SEEDANCE_L2V_ANCHOR_GUIDANCE,
    SEEDANCE_FORMAT_GUIDANCE,
    SEEDANCE_L2V_CAMERA_GUIDANCE,
    SEEDANCE_TIME_CODED_BEATS_GUIDANCE,
    SEEDANCE_FRAME_DIALOGUE_AUDIO_GUIDANCE,
    SEEDANCE_PROPER_NOUN_GUIDANCE,
    SEEDANCE_L2V_AVOID_GUIDANCE,
    SEEDANCE_LENGTH_GUIDANCE,
  ],
  flf: [
    ...SEEDANCE_FRAME_CREATIVE_RULES,
    SEEDANCE_FORMAT_GUIDANCE,
    SEEDANCE_CAMERA_GUIDANCE,
    SEEDANCE_TIME_CODED_BEATS_GUIDANCE,
    SEEDANCE_FRAME_DIALOGUE_AUDIO_GUIDANCE,
    SEEDANCE_FRAME_DISCIPLINE_GUIDANCE,
    SEEDANCE_PROPER_NOUN_GUIDANCE,
    SEEDANCE_AVOID_GUIDANCE,
    SEEDANCE_LENGTH_GUIDANCE,
  ],
  v2v: [
    ...SEEDANCE_COMMON_CREATIVE_RULES,
    SEEDANCE_V2V_ANCHOR_GUIDANCE,
    SEEDANCE_FORMAT_GUIDANCE,
    SEEDANCE_V2V_CAMERA_GUIDANCE,
    SEEDANCE_V2V_TIME_CODED_BEATS_GUIDANCE,
    SEEDANCE_V2V_DIALOGUE_AUDIO_GUIDANCE,
    SEEDANCE_V2V_SUBJECT_IDENTITY_GUIDANCE,
    SEEDANCE_PROPER_NOUN_GUIDANCE,
    SEEDANCE_V2V_AVOID_GUIDANCE,
    SEEDANCE_LENGTH_GUIDANCE,
  ],
};

const SEEDANCE_MODE_TITLES: Readonly<Record<SeedanceMode, string>> = {
  t2v: 'text-to-video and loose references',
  i2v: 'first-frame image-to-video',
  l2v: 'last-frame image-to-video',
  flf: 'first-and-last-frame video',
  v2v: 'video-to-video: edit, extend or reference a source video',
};

function seedanceGuides(
  family: 'seedance-2.0' | 'seedance-2.5',
  models: readonly string[],
  notes: readonly string[],
): Record<SeedanceMode, ModelPromptGuide> {
  const modelTitle = family === 'seedance-2.5' ? 'Seedance 2.5' : 'Seedance 2.0';
  const guide = (mode: SeedanceMode): ModelPromptGuide => modelPromptGuide({
    family,
    mode,
    title: `${modelTitle} ${SEEDANCE_MODE_TITLES[mode]}`,
    models,
    referenceGrammar: mode === 't2v' || mode === 'v2v' ? SEEDANCE_REFERENCE_GRAMMAR_GUIDANCE : null,
    rules: family === 'seedance-2.5' ? [...SEEDANCE_RULES[mode], SEEDANCE_25_CAPABILITY_GUIDANCE] : SEEDANCE_RULES[mode],
    notes,
  });
  return { t2v: guide('t2v'), i2v: guide('i2v'), l2v: guide('l2v'), flf: guide('flf'), v2v: guide('v2v') };
}

export const SEEDANCE_PROMPT_GUIDES: Pick<ModelPromptGuideRegistry, 'seedance-2.0' | 'seedance-2.5'> = {
  'seedance-2.0': seedanceGuides('seedance-2.0', ['seedance2', 'seedance2-mini', 'seedance2-mini-uncensored'], SEEDANCE_20_NOTES),
  'seedance-2.5': seedanceGuides('seedance-2.5', ['seedance2-5', 'seedance2-5-uncensored'], SEEDANCE_25_NOTES),
};
