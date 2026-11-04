/**
 * HappyHorse 1.1 prompt rules.
 *
 * Moved verbatim from @sogni/creative-agent 2.27.8 (src/prompts/video/happyhorse.ts).
 * creative-agent now imports these rules and composes its writer prompts from them, byte for byte
 * as before.
 */

import { DYNAMIC_PROMPT_BRANCH_GUIDANCE } from './shared.js';
import {
  modelPromptGuide,
  type ModelPromptGuide,
  type ModelPromptGuideMode,
  type ModelPromptGuideRegistry,
} from './types.js';

export const HAPPYHORSE_REFERENCE_GRAMMAR_GUIDANCE = `REFERENCE GRAMMAR: HappyHorse reference images are labeled with square-bracket ordinal tags written exactly as [Image 1], [Image 2], … up to [Image 9] — one space after "Image", 1-indexed, in attachment order. If the base request uses aliases such as Image 1, @Image1, picture 2, or "the second photo", rewrite them as [Image 1], [Image 2]. Never use Seedance-style @-tags, never mention reference URLs or asset IDs.`;

export const HAPPYHORSE_REFERENCE_ROLE_GUIDANCE = `REFERENCE ROLE DISCIPLINE: Give every reference image a clear creative role tied to its [Image N] tag — character identity, wardrobe, setting, prop, or style — and keep that subject consistent across the shot. Use role language such as "keep the character's face, hair, and outfit consistent with [Image 1]" or "match the room and lighting from [Image 2]". Do not write vague phrases like "use the attached images", and do not re-describe in full what a reference already shows.`;

export const HAPPYHORSE_AUDIO_GUIDANCE = `AUDIO: HappyHorse renders a native synchronized audio track — always on, with multilingual lip-sync. Weave foley and ambient sound into plain sentences (footsteps, fabric, wind, water, room tone, environmental ambience). When the scene involves speech or the user supplies dialogue, keep the spoken lines in double quotes and state that the subject speaks on camera with mouth movements matched to the words. Do not invent songs or a musical score unless the user asks for them.`;

export const HAPPYHORSE_NEGATIVE_TRANSLATION_GUIDANCE = `NEGATIVE CONSTRAINT TRANSLATION: HappyHorse has no negative-prompt input and receives only this positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. The output prompt must not use words such as "no", "not", "without", "avoid", or "never" except inside exact quoted user-requested text. Examples: "no people in background" becomes single subject focus with an empty background; "no text" becomes clean blank surfaces; "don't make it blurry" becomes crisp sharp focus; "no music" becomes only natural ambient sound and foley. If the user asks for exact quoted visible text, preserve that quoted text exactly.`;

export const HAPPYHORSE_DYNAMIC_BRANCH_GUIDANCE = DYNAMIC_PROMPT_BRANCH_GUIDANCE;

const HAPPYHORSE_CINEMATOGRAPHY_GUIDANCE = `CINEMATOGRAPHY: Write like a concise director's shot brief. Use one continuous shot unless the request asks for cuts, a montage or separate shots; then open each shot with its own time-coded beat that names the cut. Weave together the subjects with rich physical detail, the environment and the light sources the scene implies, and one primary thread of physically filmable motion using temporal connectors ("as", "then", "while"). Add a lens, color grade or film-stock note only when the request names a look or style. Express emotion through visible behavior — posture, gesture, breathing — never emotional labels. Match the pace to the action: calm words for calm moments, and for fast action show the speed through what rushes past the camera and the ground covered within a beat, because the word "fast" alone renders slower than intended.`;
const HAPPYHORSE_CAMERA_GUIDANCE = `CAMERA: One primary camera move per shot — dolly in, slow pan, tracking shot, orbital arc, crane up, push-in, or pull-back. Stacking multiple moves causes jitter. Keep the camera move in its own clause, separate from subject motion.`;
const HAPPYHORSE_FORMAT_GUIDANCE = `FORMAT: A single present-tense paragraph of flowing, visually specific prose. No bullets, headers, markdown, preamble, or labels. Avoid vague words ("beautiful", "nice"); avoid semicolons, em dashes, and parentheticals.`;
const HAPPYHORSE_TIME_CODED_BEATS_GUIDANCE = `TIME-CODED BEATS: For clips longer than 5 seconds, segment the action with compact time-coded beats such as "0-3s: …, 3-6s: …, 6-10s: …" so the motion reads in order.`;
const HAPPYHORSE_PROPER_NOUN_GUIDANCE = `PROPER NOUNS: Preserve exact spelling and punctuation of brand or product names from the base request, including dotted names such as Sogni.ai.`;
const HAPPYHORSE_LENGTH_GUIDANCE = `LENGTH: About 80–160 words for a single-beat shot, plus about 30 words for each further time-coded beat. Never drop a requested detail to fit. Output ONLY the rewritten prompt — no explanations, no labels.`;
const HAPPYHORSE_I2V_ANCHOR_GUIDANCE = `ANCHOR DISCIPLINE: The first frame already defines the subject, wardrobe, setting, and composition — do NOT re-describe or restyle it, and do NOT add any [Image N] tag. Describe only the motion, action, performance, and camera that flow forward from the first frame, plus how the scene evolves over the clip.`;

/** The `happyhorse-1.1` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const HAPPYHORSE_NOTES: readonly string[] = [
  'Use one flowing, present-tense director brief: one continuous shot with one primary camera move, or time-coded shots when the request asks for cuts or a montage.',
  'For I2V, treat the single image as the locked first frame and describe only the motion that follows; do not add a reference tag.',
  'For R2V, label image references exactly [Image 1] through [Image 9] and assign each image a concrete identity, wardrobe, setting, prop, or style role.',
  'Describe synchronized dialogue, ambience, and foley in the prompt because native audio is always enabled.',
  'Translate exclusions into affirmative visual constraints because HappyHorse does not accept a separate negative prompt.',
  'Keep clips within the validated 3-15 second, 720p/1080p operating range.',
];

/** The sections every HappyHorse writer prompt ends with, after its mode-specific opening sections. */
const HAPPYHORSE_SHARED_RULES = [
  HAPPYHORSE_CINEMATOGRAPHY_GUIDANCE,
  HAPPYHORSE_CAMERA_GUIDANCE,
  HAPPYHORSE_AUDIO_GUIDANCE,
  HAPPYHORSE_NEGATIVE_TRANSLATION_GUIDANCE,
  HAPPYHORSE_DYNAMIC_BRANCH_GUIDANCE,
  HAPPYHORSE_FORMAT_GUIDANCE,
  HAPPYHORSE_TIME_CODED_BEATS_GUIDANCE,
  HAPPYHORSE_PROPER_NOUN_GUIDANCE,
  HAPPYHORSE_LENGTH_GUIDANCE,
];

function happyhorseGuide(
  mode: ModelPromptGuideMode,
  title: string,
  models: readonly string[],
  openingRules: readonly string[],
  referenceGrammar: string | null,
): ModelPromptGuide {
  return modelPromptGuide({
    family: 'happyhorse-1.1',
    mode,
    title: `HappyHorse 1.1 ${title}`,
    models,
    referenceGrammar,
    rules: [...openingRules, ...HAPPYHORSE_SHARED_RULES],
    notes: HAPPYHORSE_NOTES,
  });
}

export const HAPPYHORSE_PROMPT_GUIDES: Pick<ModelPromptGuideRegistry, 'happyhorse-1.1'> = {
  'happyhorse-1.1': {
    t2v: happyhorseGuide('t2v', 'text-to-video', ['happyhorse-1.1', 'happyhorse-1.1-t2v'], [], null),
    i2v: happyhorseGuide('i2v', 'first-frame image-to-video', ['happyhorse-1.1-i2v'], [HAPPYHORSE_I2V_ANCHOR_GUIDANCE], null),
    r2v: happyhorseGuide(
      'r2v',
      'reference-to-video',
      ['happyhorse-1.1-r2v'],
      [HAPPYHORSE_REFERENCE_GRAMMAR_GUIDANCE, HAPPYHORSE_REFERENCE_ROLE_GUIDANCE],
      HAPPYHORSE_REFERENCE_GRAMMAR_GUIDANCE,
    ),
  },
};
