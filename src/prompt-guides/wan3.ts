/**
 * Wan 3 prompt rules, including the Wan 3 Screenwriter's step-timing and shot-plan rules.
 *
 * Moved verbatim from @sogni/creative-agent 2.27.8 (src/prompts/video/wan3.ts and
 * wan3Screenwriter.ts). creative-agent now imports these rules and composes its writer prompts from
 * them, byte for byte as before.
 */

import { CREATIVE_INTENT_FIDELITY_GUIDANCE } from './shared.js';
import {
  modelPromptGuide,
  type ModelPromptGuide,
  type ModelPromptGuideMode,
  type ModelPromptGuideRegistry,
} from './types.js';

export const WAN3_REFERENCE_GRAMMAR_GUIDANCE = `REFERENCE GRAMMAR: Name loose media exactly as Image 1, Image 2, Video 1, Video 2, Audio 1, and Audio 2, numbered independently by type and in attachment order. Capitalize the media type and include one space before the number. Do not use square brackets, angle brackets, @-tags, URLs, or asset IDs. Give each named reference an explicit role and state which reference wins if two conflict. Native first_frame and last_frame anchors are not loose Image N references.`;

/** Follows CREATIVE_INTENT_FIDELITY_GUIDANCE in every Wan 3 writer prompt. */
export const WAN3_OUTPUT_CONTRACT_GUIDANCE = `OUTPUT CONTRACT: Write one production-ready English video prompt in present tense. Preserve exact user-provided dialogue in double quotes. Describe subject, action, setting, camera, lighting, timing, dialogue, foley, ambience, and music only when relevant. Use compact timecoded beats for multi-shot or longer clips. Do not add a negative-prompt section because Wan 3 has no negative_prompt request field. Return only the rewritten prompt with no preamble or markdown.`;

// The mode sentences that follow each Wan 3 writer's opening role sentence.
export const WAN3_T2V_GUIDANCE = `Wan 3 renders 2-30 seconds at fixed 30 fps and can generate synchronized audio.`;
export const WAN3_I2V_GUIDANCE = `The supplied first frame fixes the opening composition, subject, wardrobe, environment, and visual style. Describe motion, camera, performance, scene evolution, dialogue, and sound that flow forward from that exact frame. Do not label the native first frame as Image 1.`;
export const WAN3_FLF2V_GUIDANCE = `The supplied opening and closing frames are hard endpoints. Describe one coherent transition whose action, camera, lighting, and subject state begin at the first frame and converge naturally on the last frame. Do not label either native endpoint as an Image N loose reference.`;
export const WAN3_R2V_GUIDANCE = `Preserve the useful appearance, motion, voice, sound, style, and factual/story context in the attached references. A document or webpage is context, not an Image N asset: refer to it naturally as the attached document or linked webpage and turn its useful content into visible, audible, generatable direction.`;
export const WAN3_A2V_GUIDANCE = `Make the supplied audio the timing and performance anchor, describe synchronized visible action and camera direction, and identify audio inputs as Audio 1, Audio 2, and so on.`;

// Wan 3 skips clothing and exposure steps unless each gets its own timed beat
// (measured 2026-10-18, KB docs/wan3-step-following-2026-10-18.md).
export const WAN3_STEP_TIMING_GUIDANCE = `STEP TIMING AND VISIBLE STATE: Wan 3 renders an action reliably only when the prompt gives it its own time and says what it visibly changes. Write the artist's actions as consecutive timecoded beats that cover the clip's full length (for example "0-3 s: ...", "3-7 s: ..."), in the artist's order, each beat long enough for its action to be seen. When an action changes clothing or exposure (pulling fabric aside, lowering or lifting a garment, opening it, putting it back on, letting it snap back), give it its own beat: describe the hand motion, then state the visible result plainly, and keep that result true in every later beat unless the artist undoes it (for example "the crotch of her thong stays held to the side and her bare vulva stays visible"). This holds at every clip length: in a short clip use short beats (one or two seconds is fine), and never fold a clothing or exposure change into the same beat as the action that follows it. Keep your own additions short so the artist's actions get the screen time.`;

// Wan 3 makes its own cuts unless the prompt states how the clip is shot, and the writer left partners outside the
// first frame's framing; the shot plan fixes both in Wan's own syntax (measured 2026-10-19,
// KB docs/wan3-prompting-sources-2026-10.md).
export const WAN3_SHOT_PLAN_GUIDANCE = `SHOTS AND CAMERA: Wan 3 makes its own cuts when the prompt does not say how the clip is shot, so write the shot plan into the prompt and keep the timecoded beats either way. Cut when the artist asks for cuts, when the action moves to another place or a later time, or when a closer angle shows a requested act better; otherwise keep one take. For one take, open the prompt with "One continuous shot, no cuts." For several shots, open with the number of shots (for example "Two shots.") and begin the first beat of every shot after the first with "Hard cut:" followed by that shot's framing; give every shot at least 2 seconds. Name the shot size and one camera move or "fixed camera" for each shot (for example "medium-wide shot, slow push in"); when the artist chose the camera or framing, use exactly theirs. Every person, body part and act the artist asked for appears on screen: describe each one as visible in the shot, inside the artist's framing when they chose one. When the starting frame does not show a requested person, bring them into view in the first beat, by the person stepping into frame or, if the artist did not lock the camera, by a camera move such as a pull back.`;

/** The `wan-3.0` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const WAN3_NOTES: readonly string[] = [
  'Use Image 1, Video 1, and Audio 1 as plain 1-based per-type labels without brackets, angle brackets, or @ prefixes.',
  'Use native first/last-frame endpoints through animate_photo; do not mix those endpoint fields with loose multimodal references in the same request.',
  'Use generate_video for text or loose references and sound_to_video when an audio asset drives timing. A video input is loose conditioning for a new generation, not a provider-backed edit or continuation.',
  'Keep output duration within 2-30 seconds at the fixed 30 fps. When loose video references are present, their combined duration plus output duration must stay at or below 30 seconds.',
  'Use only 480p, 720p, or 1080p and one of 16:9, 4:3, 1:1, 3:4, or 9:16.',
  'Describe native dialogue, ambience, foley, and music directly; audio is enabled by default and can be disabled explicitly.',
  'Translate exclusions into affirmative preservation language because Wan 3 does not accept a separate negative prompt.',
];

function wan3Guide(mode: ModelPromptGuideMode, title: string, modeGuidance: string, referenceGrammar: string | null): ModelPromptGuide {
  return modelPromptGuide({
    family: 'wan-3',
    mode,
    title: `Wan 3 ${title}`,
    models: ['wan3', 'wan3-enhanced'],
    referenceGrammar,
    rules: [
      modeGuidance,
      ...(referenceGrammar ? [referenceGrammar] : []),
      CREATIVE_INTENT_FIDELITY_GUIDANCE,
      WAN3_OUTPUT_CONTRACT_GUIDANCE,
      WAN3_STEP_TIMING_GUIDANCE,
      WAN3_SHOT_PLAN_GUIDANCE,
    ],
    notes: WAN3_NOTES,
  });
}

/** The Wan 3 writer's mode and output rules, then the Wan 3 Screenwriter's step-timing and shot-plan rules. */
export const WAN3_PROMPT_GUIDES: Pick<ModelPromptGuideRegistry, 'wan-3'> = {
  'wan-3': {
    t2v: wan3Guide('t2v', 'text-to-video', WAN3_T2V_GUIDANCE, null),
    i2v: wan3Guide('i2v', 'first-frame image-to-video', WAN3_I2V_GUIDANCE, null),
    flf: wan3Guide('flf', 'first-and-last-frame video', WAN3_FLF2V_GUIDANCE, null),
    r2v: wan3Guide('r2v', 'multimodal reference-to-video', WAN3_R2V_GUIDANCE, WAN3_REFERENCE_GRAMMAR_GUIDANCE),
    a2v: wan3Guide('a2v', 'audio-driven video', WAN3_A2V_GUIDANCE, WAN3_REFERENCE_GRAMMAR_GUIDANCE),
  },
};
