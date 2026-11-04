/**
 * Wan 2.2 prompt rules.
 *
 * Moved verbatim from @sogni/creative-agent 2.27.8 (src/prompts/video/wan.ts). creative-agent now
 * imports these rules and composes its writer prompts from them, byte for byte as before.
 */

import { DYNAMIC_PROMPT_BRANCH_GUIDANCE } from './shared.js';
import {
  modelPromptGuide,
  type ModelPromptGuide,
  type ModelPromptGuideMode,
  type ModelPromptGuideRegistry,
} from './types.js';

const WAN_T2V_CONTENT_GUIDANCE = `Preserve the original subjects, actions, setting, requested style, visible text, proper nouns, and constraints. Add only observable details that make the requested scene filmable. Order the prompt as: requested style if any; shot scale and composition; subject identity and appearance; environment and named light sources; action described as a concrete physical sequence; then one camera behavior. When the request specifies motion, preserve it exactly and explain how it unfolds at the pace it implies, showing fast action through what rushes past the camera and the ground covered rather than the word "fast" alone. When it lacks motion, add one small physically plausible subject or environmental movement without inventing a new story event.`;
const WAN_T2V_ATTRIBUTE_GUIDANCE = `Choose at most four useful cinematic attributes such as time of day, light source, light quality, color temperature, shot scale, camera angle, or composition. Do not dump camera vocabulary or stack movements. Do not add people, animals, props, logos, labels, dialogue, or a visual style the user did not request. Describe objective visible facts rather than abstract claims about feeling or meaning.`;
const WAN_T2V_LENGTH_GUIDANCE = `Write 60-200 words as one cohesive prompt. No headings, bullets, labels, Markdown, preamble, explanation, or negative-prompt list. Output ONLY the prompt.`;
const WAN_S2V_PERFORMANCE_GUIDANCE = `Treat the reference portrait as visual truth for identity, face, hair, clothing, framing, and background. Treat the audio as timing truth for speech and vocal performance. Describe only the visible performance that should synchronize to it, as still and intimate or as full-body and energetic as the request implies: natural lip articulation, facial expression changes, gaze, breathing, head, body and hand motion, and one camera behavior. The audio track already carries every spoken or sung word: quote dialogue only when the user wrote it, and never invent lyrics, speech, language, voice qualities, or audio content that you cannot hear.`;
const WAN_S2V_STABILITY_GUIDANCE = `Keep identity and the source composition stable. Do not redescribe a complete static portrait, invent scene changes, or add cuts. Use one concise English paragraph under 100 words with no headings, labels, Markdown, preamble, explanation, or negative-prompt list. Output ONLY the prompt.`;
const WAN_NEGATIVE_CONSTRAINT_GUIDANCE = `NEGATIVE CONSTRAINT TRANSLATION: WAN receives only this positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. For translated constraints, the output prompt must not use words such as "no", "not", "without", "avoid", or "never" except inside exact quoted user-requested text. Examples: "no people in background" becomes single subject focus with an empty background; "no text" becomes clean blank surfaces; "don't make it blurry" becomes crisp sharp focus; "no weird hands" becomes natural anatomically consistent hands; "no mouth movement, no talking, no lip syncing" becomes silent expression-only physical performance with facial motion independent of speech timing; "don't change the room" becomes the same room and layout remain consistent. If the user asks for exact quoted visible text, preserve that quoted text exactly.`;
const WAN_L2V_PATH_GUIDANCE = `Write one concise present-tense video prompt describing a physically coherent action and camera path that arrive naturally at that exact ending composition. Preserve the user's subjects, requested action, style, constraints, exact quoted dialogue, visible text, and proper nouns. Treat the supplied image as ending-frame truth for identity, appearance, setting, lighting, spatial composition, framing, and viewpoint. Infer only the earlier motion needed to reach it; never describe the image as the opening frame.`;
const WAN_L2V_CONSTRAINT_GUIDANCE = `Translate negative constraints into affirmative production constraints. Use one continuous shot unless the request asks for a cut, with at most one primary camera movement per shot, at the pace the request calls for. Keep subject motion separate from camera motion. Do not add unrelated people, objects, dialogue, cuts, headings, labels, Markdown, preamble, explanation, or input-ordinal language.`;
const WAN_ANIMATE_MOVE_GUIDANCE = `Describe how the reference character performs the driving video's motion while preserving the character's identity, appearance, clothing, and proportions. Keep the source motion timing, pose sequence, facial performance, and camera trajectory intact unless the user explicitly changes one. Do not invent a new setting or describe unrelated cinematography. Return one concise direct instruction only, with no wrapper or explanation.`;
const WAN_ANIMATE_REPLACE_GUIDANCE = `Describe replacing the source performer with the reference character while preserving the source video's motion, timing, camera, framing, lighting, occlusion, and background unless the user explicitly requests a change. State only the requested identity/appearance transfer and preservation constraints. Return one concise direct instruction only, with no wrapper or explanation.`;

// The "Your prompt MUST" and "OUTPUT CONSTRAINTS" lists of the frame prompts, line for line.
const WAN_TRANSITION_REQUIREMENTS_GUIDANCE = `Your prompt MUST:
- Preserve the user's base request, style, constraints, transition instructions, motion/action beats, and exact quoted dialogue if any is present
- Only invent a default practical transition when the base request lacks transition motion or action. Keep explicit user instructions rather than replacing them with generic morphing, dissolves, or wardrobe transformations.
- Identify the important visible subjects, objects, poses, background elements, lighting, and perspective differences
- Describe how each key element moves, shifts, transforms, or becomes occluded/revealed between frames
- Specify camera motion with directional language such as dolly in, tracking shot, orbit, pan, tilt, push in, pull back, or whip pan
- Maintain subject identity and visual continuity
- Use a concise present-tense paragraph with short sentences`;
const WAN_TRANSITION_OUTPUT_CONSTRAINTS_GUIDANCE = `OUTPUT CONSTRAINTS:
- Single concise paragraph only: no preamble, explanations, bullets, markdown, labels, or image ordinal references
- Motion-focused prose: static details appear only when they affect the transition
- Physically coherent motion at the pace the request calls for, showing fast action through what rushes past the camera and the ground covered
- Lettering already in the frames stays exactly as it reads`;
const WAN_I2V_REQUIREMENTS_GUIDANCE = `Your prompt MUST:
- Preserve the user's base request, style, constraints, motion/action beats, and exact quoted dialogue if any is present
- Only invent a default practical action when the base request lacks motion. Keep explicit user instructions rather than replacing them with generic morphing, dissolves, or wardrobe transformations.
- Identify the important visible subjects, objects, poses, background elements, lighting, and perspective from the anchor only as needed to plan motion — do not redescribe static details
- Describe how each key element moves, shifts, transforms, or becomes occluded/revealed forward from the anchor
- Specify camera motion with directional language such as dolly in, tracking shot, orbit, pan, tilt, push in, pull back, or whip pan
- Maintain subject identity and visual continuity
- Use a concise present-tense paragraph with short sentences`;
const WAN_I2V_OUTPUT_CONSTRAINTS_GUIDANCE = `OUTPUT CONSTRAINTS:
- Single concise paragraph only: no preamble, explanations, bullets, markdown, labels, second-keyframe language, target-frame language, interpolation language, or input ordinal references
- Motion-focused prose: static details appear only when they affect the forward motion
- Physically coherent motion at the pace the request calls for, showing fast action through what rushes past the camera and the ground covered
- Lettering already in the anchor frame stays exactly as it reads`;

/** The `wan-2.2` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const WAN22_NOTES: readonly string[] = [
  'Use compact motion-first prompts for animate and transition workflows.',
  'Avoid crowded simultaneous actions and rigid numerical camera constraints.',
];

function wanGuide(mode: ModelPromptGuideMode, title: string, rules: readonly string[]): ModelPromptGuide {
  return modelPromptGuide({
    family: 'wan-2.2',
    mode,
    title: `Wan 2.2 ${title}`,
    models: ['wan22'],
    referenceGrammar: null,
    rules,
    notes: WAN22_NOTES,
  });
}

export const WAN_PROMPT_GUIDES: Pick<ModelPromptGuideRegistry, 'wan-2.2'> = {
  'wan-2.2': {
    t2v: wanGuide('t2v', 'text-to-video', [WAN_T2V_CONTENT_GUIDANCE, WAN_T2V_ATTRIBUTE_GUIDANCE, WAN_T2V_LENGTH_GUIDANCE]),
    i2v: wanGuide('i2v', 'first-frame image-to-video', [
      WAN_I2V_REQUIREMENTS_GUIDANCE,
      WAN_NEGATIVE_CONSTRAINT_GUIDANCE,
      DYNAMIC_PROMPT_BRANCH_GUIDANCE,
      WAN_I2V_OUTPUT_CONSTRAINTS_GUIDANCE,
    ]),
    l2v: wanGuide('l2v', 'last-frame image-to-video', [WAN_L2V_PATH_GUIDANCE, WAN_L2V_CONSTRAINT_GUIDANCE]),
    flf: wanGuide('flf', 'first-and-last-frame video', [
      WAN_TRANSITION_REQUIREMENTS_GUIDANCE,
      WAN_NEGATIVE_CONSTRAINT_GUIDANCE,
      DYNAMIC_PROMPT_BRANCH_GUIDANCE,
      WAN_TRANSITION_OUTPUT_CONSTRAINTS_GUIDANCE,
    ]),
    s2v: wanGuide('s2v', 'speech-to-video', [WAN_S2V_PERFORMANCE_GUIDANCE, WAN_S2V_STABILITY_GUIDANCE]),
    'animate-move': wanGuide('animate-move', 'Animate movement transfer', [WAN_ANIMATE_MOVE_GUIDANCE]),
    'animate-replace': wanGuide('animate-replace', 'Animate character replacement', [WAN_ANIMATE_REPLACE_GUIDANCE]),
  },
};
