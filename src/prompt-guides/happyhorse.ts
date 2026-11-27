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
