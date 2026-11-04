/**
 * LTX 2.5 and LTX 2.3 prompt rules.
 *
 * Moved verbatim from @sogni/creative-agent 2.27.8 (src/prompts/video/ltx.ts). creative-agent now
 * imports these rules and composes its writer prompts from them, byte for byte as before.
 */

import { DYNAMIC_PROMPT_BRANCH_GUIDANCE } from './shared.js';
import {
  modelPromptGuide,
  type ModelPromptGuide,
  type ModelPromptGuideMode,
  type ModelPromptGuideRegistry,
} from './types.js';

// LTX 2.5 caption contract sections (TextGenerateLTX2Prompt recipe).

const LTX25_OBJECTIVE_OPENING_GUIDANCE = `Begin immediately with action or visual detail. Never begin with "The scene opens", "We see", or "There is". Describe only objective, visible, and audible facts; express emotion through observable face, posture, gesture, performance, and voice rather than inferred intent.`;
const LTX25_T2V_DETAIL_GUIDANCE = `Include the visual details needed to identify the subject, setting, action, continuity, and requested style. Prefer concrete nouns and motion verbs. Faithfully enrich an underspecified request with observable motion, weather or environmental interaction, key material cues, and visible identity anchors, but never replace or bury a requested beat. When a human appears, preserve their distinguishing visible features consistently. Never infer ethnicity, nationality, religion, or culture.`;
const LTX25_T2V_SHOT_GUIDANCE = `Give every requested shot one sentence and exactly one clear shot type (extreme wide shot, wide shot, medium shot, medium close-up, close-up, or extreme close-up). Add at most one camera motion or subject-relative viewpoint when it materially clarifies that shot. Read the request in whatever language and wording it uses. If it specifies multiple shots, scenes, or cuts, preserve all of them in order and begin every sentence after the first with an explicit transition such as "At exactly 2.5 seconds, a hard cut switches to..." Preserve requested transition types and copy every requested timestamp verbatim in numeric notation; never spell a numeric timestamp out as words. When no cut time was supplied but clip duration is known, place simple numeric cut times that divide the requested shots evenly enough for every shot to be seen. When the user does not explicitly request multiple shots, scenes, or cuts, or asks for one continuous take in any wording, write one continuous shot and do not invent a cut.`;
const LTX25_SOUND_GUIDANCE = `Keep sound concise: preserve exact quoted dialogue in its original language plus the one or two most important environmental, foley, or requested music cues. If the request asks, in any language or wording, for silence, a muted clip, or no sound, describe that silence and add no sound; otherwise include the sounds the scene makes. Never invent dialogue when the request does not imply speech, talking, singing, or conversation. Preserve exact quoted dialogue, visible text, proper nouns, and product or brand spelling.`;
const LTX25_T2V_LENGTH_GUIDANCE = `Describe strict chronological, real-time flow and keep every requested action in motion. Use detailed but bounded prose with one sentence per shot; a single newline between shot sentences is allowed. Do not use bullets, headings, labels, JSON, preamble, or Markdown. Target 35-65 words per shot, usually 60-100 words for a single-shot request, and stay under 70 words per shot (under 140 words for one or two shots) so every cut still reads. When the request itself is longer than that, keep all of it: never drop, merge, or shorten a requested detail to meet a length target, and trim only your own additions. If the user wrote in another language, write the visual prompt in English while retaining exact dialogue and visible text in the requested language.`;
const LTX25_T2V_STYLE_GUIDANCE = `Preserve requested visual style and production value without adding new objects, people, actions, dialogue, shots, or story events. When the user did not specify a rendering style, describe the look the request implies (for example phone footage, home video, documentary, animation, or film) in concrete terms, and do not add generic quality words.`;
const LTX25_I2V_OPENING_FRAME_GUIDANCE = `The opening must match the reference image exactly: the same subjects, identity, appearance, clothing, setting, lighting, spatial composition, camera framing, and viewpoint. Describe that grounded opening faithfully, then narrate only consistent changes as the requested action unfolds. Never invent anything inconsistent with the image. Use one continuous take with no hard cuts.`;
const LTX25_I2V_DETAIL_GUIDANCE = `Mention only image-grounded details needed to preserve subject identity, setting, action, continuity, and requested style. Prefer concrete motion over static description. Never infer ethnicity, nationality, religion, or culture.`;
const LTX25_I2V_SHOT_GUIDANCE = `Use exactly one shot type (extreme wide shot, wide shot, medium shot, medium close-up, close-up, or extreme close-up) matching the opening image. Add at most one camera motion or viewpoint when useful. Keep the shot continuous.`;
const LTX25_I2V_LENGTH_GUIDANCE = `Describe strict chronological, real-time flow and keep the requested motion central. Use one or two short sentences with no bullets, headings, labels, JSON, preamble, or Markdown. Target 40-100 words and stay under 120 words. When the request itself is longer than that, keep all of it: never drop, merge, or shorten a requested detail to meet a length target, and trim only your own additions. If the user wrote in another language, write the visual prompt in English while retaining exact dialogue and visible text in the requested language.`;
const LTX25_I2V_STYLE_GUIDANCE = `Preserve requested visual style and production value without adding new objects, people, actions, dialogue, shots, or story events.`;

export const LTX25_LAST_FRAME_OVERRIDE_GUIDANCE = `LAST-FRAME OVERRIDE: One reference image is attached as the exact ending frame. Describe a single continuous action that resolves naturally into that locked image. The conclusion must match its subjects, identity, appearance, clothing, setting, lighting, spatial composition, camera framing, and viewpoint exactly. Do not describe the image as the opening frame, and do not introduce a cut, replacement shot, or discontinuous jump to reach it.`;
export const LTX25_FIRST_LAST_FRAME_OVERRIDE_GUIDANCE = `FIRST/LAST-FRAME OVERRIDE: Two reference images are attached. The first is the exact opening frame and the second is the exact ending frame. Ground the opening in the first image and the conclusion in the second image, preserving identity, appearance, setting, lighting, composition, and viewpoint wherever each endpoint establishes them. Describe a physically coherent continuous transition between both locked endpoints. Do not introduce a cut, replacement shot, or discontinuous jump to reach the ending frame.`;

export const LTX_AUDIO_REFERENCE_GUIDANCE = `AUDIO-REFERENCE OPERATION: A separate reference soundtrack will drive the final video's timing. Treat that audio as timing truth. Preserve any audio content, dialogue, lyrics, rhythm, or sync points the user explicitly described, but never invent or claim to hear content that was not supplied to this text-authoring call. Describe visible action and camera timing that can synchronize to the reference audio.`;

export const LTX_VIDEO_REFERENCE_GUIDANCE = `VIDEO-REFERENCE OPERATION: A source video will be attached to the final generation. Treat its subjects, motion timing, camera path, framing, lighting, occlusion, and audio continuity as source truth unless the user explicitly changes one. Write the requested transformation as a concrete visual delta on top of that source; do not replace it with a fresh unrelated scene description.`;

export const LTX_IMAGE_REFERENCE_GUIDANCE = `IMAGE-REFERENCE OPERATION: The reference image is the exact opening visual anchor. Preserve its identity, composition, setting, and lighting; describe motion, performance, camera, and sound that flow forward from it.`;

// LTX 2.x first/last-frame and single-frame sections (the LTX 2.3 rollback path).

const LTX_FRAME_FORMAT_GUIDANCE = `FORMAT: Write a single paragraph in present tense, made of short sentences. Do NOT use bullets, numbered lists, headers, labels, markdown, or segmented formatting.`;
const LTX_TRANSITION_I2V_RULES_GUIDANCE = `I2V RULES: The video model receives both frames. Do NOT spend the prompt re-describing static image contents. Focus on what changes: subject motion, object transformations, foreground occlusion and reveal, lighting shifts, perspective changes, and the continuous camera movement that carries the starting view into the ending view.`;
const LTX_TRANSITION_PRESERVE_INTENT_GUIDANCE = `PRESERVE INTENT: Keep the user's base request, creative style, constraints, requested objects, character actions, and exact quoted dialogue. If the base request gives no action, choose the most natural way to get from the starting view to the ending view, at a pace that fits what the frames show: for example a match cut, foreground elements passing close to the lens, parallax, a physical reveal, or a camera move.`;
const LTX_PROPER_NOUN_GUIDANCE = `PROPER NOUNS: Preserve exact spelling and punctuation of brand/product names and proper nouns from the base request, especially dotted names such as Sogni.ai.`;
const LTX_TRANSITION_NEGATIVE_CONSTRAINT_GUIDANCE = `NEGATIVE CONSTRAINT TRANSLATION: LTX receives only this positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. For translated constraints, the output prompt must not use words such as "no", "not", "without", "avoid", or "never" except inside exact quoted user-requested text. Examples: "no people in background" becomes single subject focus with an empty background; "no text" becomes clean blank surfaces; "don't make it blurry" becomes crisp sharp focus; "no weird hands" becomes natural anatomically consistent hands; "no mouth movement, no talking, no lip syncing" becomes silent expression-only physical performance with facial motion independent of speech timing; "don't change the room" becomes the same room and layout remain consistent. If the user asks for exact quoted visible text, preserve that quoted text exactly and keep any other legible text in the frames unchanged.`;
const LTX_TRANSITION_CAMERA_GUIDANCE = `CAMERA: Use explicit camera language at the pace the request implies, such as dolly in, tracking shot, whip pan, crash zoom, pull back, orbit, handheld follow, tilt upward, or a static frame. Describe how the subject and environment appear as that movement resolves.`;
const LTX_TRANSITION_BLOCKING_GUIDANCE = `BLOCKING: Treat layout as direction. Explicitly state important left/right placement, foreground/background relationships, facing direction, occlusion/reveal, and relative distance when those details affect the transition.`;
const LTX_MOTION_VERBS_GUIDANCE = `MOTION VERBS: Specify who moves, what moves, how it moves, and what the camera does. Prefer clear sequential verbs over abstract phrases like "comes alive." Each action sentence should target one character, object, or camera move. Split simultaneous changes into separate consecutive sentences.`;
const LTX_PERFORMANCE_GUIDANCE = `PERFORMANCE: Use physical action cues, not abstract emotions. For dialogue, keep spoken lines in double quotes and place short acting beats between lines.`;
const LTX_AUDIO_REQUIRED_GUIDANCE = `AUDIO IS REQUIRED: LTX generates synchronized audio. Add foley and ambient sound in simple sentences. Use environmental ambience, movement sounds, fabric rustle, footsteps, object sounds, room tone, wind, water, traffic, reverb, or muffled distance. Add music or soundtrack only when the user explicitly requests it. If the request asks, in any language or wording, for silence, a muted clip, or no sound, describe that silence instead of adding sound.`;
const LTX_TRANSITION_OUTPUT_CONSTRAINTS_GUIDANCE = `OUTPUT CONSTRAINTS: Use simple sentence structure and physically coherent action at the pace the request implies, and keep legible text from the frames unchanged.`;
const LTX_TRANSITION_LENGTH_GUIDANCE = `Your prompt MUST be 80-160 words, maintain identity and visual consistency, and not reference "first image" or "second image."`;
const LTX_I2V_FORWARD_RULES_GUIDANCE = `I2V RULES: The video model receives the anchor frame. Do NOT spend the prompt re-describing static image contents. Focus on what HAPPENS NEXT: subject motion, action, environmental change, lighting evolution, and the continuous camera move that carries the scene forward from the anchor.`;
const LTX_I2V_FORWARD_PRESERVE_INTENT_GUIDANCE = `PRESERVE INTENT: Keep the user's base request, creative style, constraints, requested objects, character actions, and exact quoted dialogue. If the base request gives no action, choose the most natural next action for what the frame shows, at a pace that fits it.`;
const LTX_I2V_FORWARD_NEGATIVE_CONSTRAINT_GUIDANCE = `NEGATIVE CONSTRAINT TRANSLATION: LTX receives only this positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. For translated constraints, the output prompt must not use words such as "no", "not", "without", "avoid", or "never" except inside exact quoted user-requested text. Examples: "no people in background" becomes single subject focus with an empty background; "no text" becomes clean blank surfaces; "don't make it blurry" becomes crisp sharp focus; "no weird hands" becomes natural anatomically consistent hands; "no mouth movement, no talking, no lip syncing" becomes silent expression-only physical performance with facial motion independent of speech timing; "don't change the room" becomes the same room and layout remain consistent. If the user asks for exact quoted visible text, preserve that quoted text exactly and keep any other legible text in the frame unchanged.`;
const LTX_I2V_FORWARD_CAMERA_GUIDANCE = `CAMERA: Use explicit camera language at the pace the request implies, such as dolly in, tracking shot, whip pan, crash zoom, pull back, orbit, handheld follow, tilt upward, or a static frame. Describe how the subject and environment appear as that movement resolves forward from the anchor frame.`;
const LTX_I2V_FORWARD_BLOCKING_GUIDANCE = `BLOCKING: Treat layout as direction. Explicitly state important left/right placement, foreground/background relationships, facing direction, occlusion/reveal, and relative distance when those details affect the motion.`;
const LTX_I2V_FORWARD_OUTPUT_CONSTRAINTS_GUIDANCE = `OUTPUT CONSTRAINTS: Use simple sentence structure, physically coherent action at the pace the request implies, and a forward-only single-frame animation, and keep legible text from the frame unchanged.`;
const LTX_I2V_FORWARD_LENGTH_GUIDANCE = `LENGTH: 80-160 words. Maintain identity and visual consistency. Do not refer to the input by ordinal position.`;

/** PRESERVE INTENT and PROPER NOUNS share one paragraph, separated by a single newline. */
const LTX_TRANSITION_PRESERVE_GUIDANCE = `${LTX_TRANSITION_PRESERVE_INTENT_GUIDANCE}\n${LTX_PROPER_NOUN_GUIDANCE}`;
const LTX_I2V_FORWARD_PRESERVE_GUIDANCE = `${LTX_I2V_FORWARD_PRESERVE_INTENT_GUIDANCE}\n${LTX_PROPER_NOUN_GUIDANCE}`;

/** The `ltx-2.5` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const LTX25_NOTES: readonly string[] = [
  'Keep LTX 2.5 prompts detailed but bounded: preserve production-ready input, faithfully enrich observable identity, motion, and environment, describe the look the request implies rather than adding generic quality words, target 35-65 words per shot, and stay under 70 words per shot (under 140 words for one or two shots) without dropping any requested detail.',
  'Give every requested shot one sentence and one clear shot type; preserve every requested transition and copy exact cut times in numeric notation, and do not invent cuts when the request asks, in any language or wording, for one continuous take.',
  'Preserve exact quoted dialogue and visible text, retain only the most important synchronized ambience and foley, describe silence when the request asks for silence or no sound, and never invent dialogue unless speech, talking, singing, or conversation is requested.',
  'For I2V, match the attached first frame exactly and use one continuous take. For FLF, ground both endpoint images and describe a physically coherent continuous transition between them.',
  'Use the standard T2V, I2V/FLF, A2V, or IA2V workflow that matches the supplied assets.',
  'FLF uses the I2V public model ID with a separate first/last-frame template.',
  'Fast, HQ, and Pro currently use the release-validated official Distilled/Turbo workflow. Dev checkpoints are withheld from public routing until upstream publishes and Sogni validates an official ComfyUI Dev recipe.',
  'V2V supports canny, depth, pose, detailer, inpaint, and outpaint through the validated Distilled path. LTX 2.5 pose requires both a source video and a still reference image for the subject appearance.',
  'The pinned official control templates supply their compatible Union Control or In/Outpainting IC-LoRA internally.',
  'Do not attach LTX 2.3-only voice ID-LoRA, community transition LoRA, or 10Eros assets.',
];

/** The `ltx-2.3` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const LTX23_NOTES: readonly string[] = [
  'For first/last-frame generation, focus on what changes instead of redescribing static frame contents.',
  'Use short present-tense sentences with concrete camera, action, lighting, and audio cues.',
  'Keep quoted dialogue within the clip duration budget.',
];

/** The LTX 2.5 caption contract, text-to-video. LTX 2.3 text-to-video uses the same rules. */
const LTX25_T2V_RULES = [
  LTX25_OBJECTIVE_OPENING_GUIDANCE,
  LTX25_T2V_DETAIL_GUIDANCE,
  LTX25_T2V_SHOT_GUIDANCE,
  LTX25_SOUND_GUIDANCE,
  LTX25_T2V_LENGTH_GUIDANCE,
  LTX25_T2V_STYLE_GUIDANCE,
];

const LTX25_I2V_RULES = [
  LTX25_I2V_OPENING_FRAME_GUIDANCE,
  LTX25_OBJECTIVE_OPENING_GUIDANCE,
  LTX25_I2V_DETAIL_GUIDANCE,
  LTX25_I2V_SHOT_GUIDANCE,
  LTX25_SOUND_GUIDANCE,
  LTX25_I2V_LENGTH_GUIDANCE,
  LTX25_I2V_STYLE_GUIDANCE,
];

/** LTX 2.x first/last-frame transition prompt (the LTX 2.3 rollback path). */
const LTX_TRANSITION_RULES = [
  LTX_FRAME_FORMAT_GUIDANCE,
  LTX_TRANSITION_I2V_RULES_GUIDANCE,
  LTX_TRANSITION_PRESERVE_GUIDANCE,
  LTX_TRANSITION_NEGATIVE_CONSTRAINT_GUIDANCE,
  DYNAMIC_PROMPT_BRANCH_GUIDANCE,
  LTX_TRANSITION_CAMERA_GUIDANCE,
  LTX_TRANSITION_BLOCKING_GUIDANCE,
  LTX_MOTION_VERBS_GUIDANCE,
  LTX_PERFORMANCE_GUIDANCE,
  LTX_AUDIO_REQUIRED_GUIDANCE,
  LTX_TRANSITION_OUTPUT_CONSTRAINTS_GUIDANCE,
  LTX_TRANSITION_LENGTH_GUIDANCE,
];

/** LTX 2.x single-frame prompt that animates forward from the anchor frame (the LTX 2.3 rollback path). */
const LTX_I2V_FORWARD_RULES = [
  LTX_FRAME_FORMAT_GUIDANCE,
  LTX_I2V_FORWARD_RULES_GUIDANCE,
  LTX_I2V_FORWARD_PRESERVE_GUIDANCE,
  LTX_I2V_FORWARD_NEGATIVE_CONSTRAINT_GUIDANCE,
  DYNAMIC_PROMPT_BRANCH_GUIDANCE,
  LTX_I2V_FORWARD_CAMERA_GUIDANCE,
  LTX_I2V_FORWARD_BLOCKING_GUIDANCE,
  LTX_MOTION_VERBS_GUIDANCE,
  LTX_PERFORMANCE_GUIDANCE,
  LTX_AUDIO_REQUIRED_GUIDANCE,
  LTX_I2V_FORWARD_OUTPUT_CONSTRAINTS_GUIDANCE,
  LTX_I2V_FORWARD_LENGTH_GUIDANCE,
];

function ltxGuide(
  family: 'ltx-2.5' | 'ltx-2.3',
  mode: ModelPromptGuideMode,
  title: string,
  rules: readonly string[],
): ModelPromptGuide {
  return modelPromptGuide({
    family,
    mode,
    title: `${family === 'ltx-2.5' ? 'LTX 2.5' : 'LTX 2.3'} ${title}`,
    models: family === 'ltx-2.5' ? ['ltx25'] : ['ltx23'],
    referenceGrammar: null,
    rules,
    notes: family === 'ltx-2.5' ? LTX25_NOTES : LTX23_NOTES,
  });
}

/**
 * LTX 2.3 has no last-frame-only guide: creative-agent writes an LTX 2.3 last-frame clip with the
 * forward single-frame prompt, which treats the image as the opening frame.
 */
export const LTX_PROMPT_GUIDES: Pick<ModelPromptGuideRegistry, 'ltx-2.5' | 'ltx-2.3'> = {
  'ltx-2.5': {
    t2v: ltxGuide('ltx-2.5', 't2v', 'text-to-video', LTX25_T2V_RULES),
    i2v: ltxGuide('ltx-2.5', 'i2v', 'first-frame image-to-video', LTX25_I2V_RULES),
    l2v: ltxGuide('ltx-2.5', 'l2v', 'last-frame image-to-video', [...LTX25_T2V_RULES, LTX25_LAST_FRAME_OVERRIDE_GUIDANCE]),
    flf: ltxGuide('ltx-2.5', 'flf', 'first-and-last-frame video', [...LTX25_I2V_RULES, LTX25_FIRST_LAST_FRAME_OVERRIDE_GUIDANCE]),
    a2v: ltxGuide('ltx-2.5', 'a2v', 'audio-to-video', [...LTX25_T2V_RULES, LTX_AUDIO_REFERENCE_GUIDANCE]),
    ia2v: ltxGuide('ltx-2.5', 'ia2v', 'image-and-audio-to-video', [...LTX25_I2V_RULES, LTX_AUDIO_REFERENCE_GUIDANCE, LTX_IMAGE_REFERENCE_GUIDANCE]),
    v2v: ltxGuide('ltx-2.5', 'v2v', 'video-to-video', [...LTX25_T2V_RULES, LTX_VIDEO_REFERENCE_GUIDANCE]),
  },
  'ltx-2.3': {
    t2v: ltxGuide('ltx-2.3', 't2v', 'text-to-video', LTX25_T2V_RULES),
    i2v: ltxGuide('ltx-2.3', 'i2v', 'first-frame image-to-video', LTX_I2V_FORWARD_RULES),
    flf: ltxGuide('ltx-2.3', 'flf', 'first-and-last-frame video', LTX_TRANSITION_RULES),
    a2v: ltxGuide('ltx-2.3', 'a2v', 'audio-to-video', [...LTX25_T2V_RULES, LTX_AUDIO_REFERENCE_GUIDANCE]),
    ia2v: ltxGuide('ltx-2.3', 'ia2v', 'image-and-audio-to-video', [...LTX_I2V_FORWARD_RULES, LTX_AUDIO_REFERENCE_GUIDANCE, LTX_IMAGE_REFERENCE_GUIDANCE]),
    v2v: ltxGuide('ltx-2.3', 'v2v', 'video-to-video', [...LTX25_T2V_RULES, LTX_VIDEO_REFERENCE_GUIDANCE]),
  },
};
