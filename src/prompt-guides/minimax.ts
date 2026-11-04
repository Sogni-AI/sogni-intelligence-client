/**
 * MiniMax H3 prompt rules (Base Context-IR and Ref2VA contracts).
 *
 * Moved verbatim from @sogni/creative-agent 2.27.8 (src/prompts/video/minimax.ts). creative-agent
 * now imports these rules and composes its writer prompts from them, byte for byte as before.
 */

import { CREATIVE_INTENT_FIDELITY_GUIDANCE } from './shared.js';
import {
  modelPromptGuide,
  type ModelPromptGuide,
  type ModelPromptGuideMode,
  type ModelPromptGuideRegistry,
} from './types.js';

export const MINIMAX_H3_MAX_PROMPT_CHARACTERS = 7000;

export const MINIMAX_H3_REF2VA_TASK_TYPES = [
  'keyframe completion',
  'reference generation',
  'video editing',
  'video continuation',
  'audio reuse',
  'audio reference',
] as const;

export const MINIMAX_H3_I2V_ALIGNMENT_LINE =
  'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.';

export const MINIMAX_H3_OUTPUT_CONTRACT_GUIDANCE = `BASE OUTPUT CONTRACT: output exactly three lowercase field headings, once each, in this order:
integrated_multimodal_description: [Shot 1] ...
overall_soundscape: ...
non_diegetic_music: ...
Do not output JSON, YAML, markdown, bullets, code fences, a preamble, or commentary. Do not add any other field. Structural prose is English; preserve dialogue, lyrics, and visible text in their original language.`;

export const MINIMAX_H3_REF2VA_SUMMARY_SYNTAX_GUIDANCE = `REF2VA SUMMARY SYNTAX: the summary value starts with one bracket pair containing exact lowercase task names, followed by a space and a nonempty description. Allowed names: ${MINIMAX_H3_REF2VA_TASK_TYPES.join(', ')}. Join multiple names inside that same pair with exactly " + ". For example, identity/style references use "summary: [reference generation] ..."; assigned keyframes use "summary: [keyframe completion] ..."; identity references plus immutable source audio use "summary: [reference generation + audio reuse] ...". These are syntax examples, not task assignments: choose only the actual reference jobs and write the full description instead of the ellipsis. Keep the brackets in the output; do not replace the prefix with prose, a task label, separate bracket pairs, or an empty bracket.`;

export const MINIMAX_H3_REF2VA_OUTPUT_CONTRACT_GUIDANCE = `REF2VA OUTPUT CONTRACT: output exactly six lowercase field headings, once each, in this order:
subject_definitions:
summary:
retention_analysis:
detailed_description:
overall_soundscape:
non_diegetic_music:
Do not output JSON, YAML, markdown, bullets, code fences, a preamble, or commentary. Do not add any other field. Keep the same <Subject N>, <Picture N>, <Video N>, and <Audio N> meaning in all six sections. In retention_analysis, put each binding on its own line using exactly "<Label N>: relationship - explanation"; do not substitute "is" for the colon. For video editing, the summary description opens with the complete sentence "The target video is an edited version of <Video 1>." Keep that period before describing the changes.
${MINIMAX_H3_REF2VA_SUMMARY_SYNTAX_GUIDANCE}`;

export const MINIMAX_H3_CONTEXT_PLANNING_GUIDANCE = `${CREATIVE_INTENT_FIDELITY_GUIDANCE}\n\nCONTEXT PLANNING: before drafting, account for every subject, visible reference, audio reference, user constraint, exact quoted string, shot, sound cue, and music instruction. Resolve conflicts in favor of explicit user wording and state the winning source when attached references conflict. Do not invent brands, references, absences, or story facts. Preserve supplied dialogue character-for-character. If the user explicitly requests speaking, dialogue, lyrics, or a vocal performance but supplies no words, author one concise line that realizes that request. Otherwise do not invent speech.`;

export const MINIMAX_H3_FINAL_ASSESSMENT_GUIDANCE = `FINAL ASSESSMENT: silently verify the exact field order, required alignment line, reference-label consistency, shot syntax, speaker IDs, dialogue markup, visible-text spelling, duration, source-audio policy, sound ownership, and character limit. Output only the typed prompt after every check passes.`;

export const MINIMAX_H3_TIMED_SHOT_LIST_GUIDANCE = `SHOT GRAMMAR: [Shot 1] has no timestamp. Every later cut starts exactly "[Shot N] At MM:SS.mmm, ..." using contiguous chronological times within the effective duration. Clock times exist only on cut markers: inside a shot, order events with words (early in the shot, as the doors part, toward the end) and never write "From 00:02.000 to 00:04.000" ranges or per-event clock times. Cut only when the cut adds new subject, space, viewpoint, or time information; otherwise carry the change with camera motion. Put a visual-style preface before [Shot 1] only in Ref2VA detailed_description. For each shot describe subject, action, setting, lighting, composition, and camera movement in filmable prose; add amplitude and speed when they are meaningful.`;

export const MINIMAX_H3_SCENE_GUIDANCE = `SCENE: describe only visible or audible facts. [Shot 1] opens with the medium and look as concrete facts (Live-action; 2D-animated; 3D CG; claymation; watercolor; vintage film) and the initial composition; in frame-anchored modes derive that look from the supplied picture. Genre, mood, audience, and intent labels (horror, eerie, romantic, adult, tense, jump scare) are not visible, so never write them: write the light, surfaces, distances, movements, and sounds that produce them. Establish subject appearance and position, environment, props, action, light, weather, and continuity. Keep identity, wardrobe, colors, objects, and spatial relationships stable unless the request changes them.`;

// Mark, 2026-10-22: stock phrasing renders as stock imagery (a "thick white" ejaculation came
// back as opaque paint from the wrong place), so physical events are written as the observable
// physics a model that has never seen them can draw.
export const MINIMAX_H3_PHYSICAL_PRECISION_GUIDANCE = `PHYSICAL PRECISION: the video model reads words literally and may never have seen the action, so describe anatomy, contact, and physical interactions in plain, concrete, almost scientific terms. Say which body part moves, where it starts and ends, how fast and how far it travels, and what touches what. Say how materials look (color, opacity, texture, amount, consistency) and how they behave (flow, drip, stretch, bounce); honey poured from a jar, for example, is a slow, glossy amber ribbon that folds onto itself where it lands. Replace euphemisms, slang, idioms, and genre stock phrases with the literal visible event they stand for, in as much detail as the action needs. Prefer precise everyday words over clinical jargon the model may not know. Keep every specific the user asked for.`;

export const MINIMAX_H3_PACING_GUIDANCE = `PACING: in most cases one continuous shot is preferred, and the shot count stays as low as the content allows. When the user leaves pacing open, prefer a purposeful development every 1.5 to 2.5 seconds: an action, a reaction, a reveal, a line. Preserve requested walking, waiting, stillness, pauses, and sustained actions for their requested duration; do not invent a new event or dialogue just to meet a pacing target. Beats and multi-shot sequences are available when the context calls for them (a chase, a reveal that needs a new viewpoint, an exchange of lines, a jump in space or time): then cut with "[Shot N] At MM:SS.mmm, the camera cuts to ..." and keep continuous motion inside each shot; never cut a simple movement into pieces. Write physical acts as acts, never as suggestions: a fall is the rail giving, the wall streaking upward, the ground rushing in; a bite is the jaws snapping shut; a shove is two palms filling the frame. Place dialogue after the action that motivates it.`;

export const MINIMAX_H3_DEPICTION_GUIDANCE = `DEPICTION ONLY: the prompt is a depiction, not a note to the model. Never write production instructions or meta-commentary (preserve believable anatomy, keep the foley prominent, hard cut with no morph or dissolve, this shot is excluded from the presentation, hold six frames only) and never use capital letters for emphasis. Say what is seen and heard at each moment instead.`;

export const MINIMAX_H3_KEYFRAME_PATH_GUIDANCE = `KEYFRAME PATHS: the model sees every supplied picture, so never describe a picture back at length and never invent objects, text, fluids, or figures that are not in it. I2VA: first-frame anchor, then action onset, continuous development, and a result or reaction. FL2VA: prefer one continuous shot; write the first-frame state, the observable intermediate changes, the progressively narrowing differences, and the last-frame state; begin "in the position and framing established by Picture 1", carry the identity anchors that must stay fixed into the motion sentences, and reach "the composition established by Picture 2" inside the final shot named by the alignment line. When the context calls for beats (see PACING), cut, and let the final shot cut to the Picture 2 composition and hold with a live action, which lands cleanly where a long interpolation would crossfade. If both pictures share one camera position, the camera does not move at all. L2VA: a plausible preceding state, an explicit action and transition path, gradual convergence in the final shot, and the last-frame landing on <Picture 1>. Apply exact composition matching only at a picture's assigned timestamp.`;

export const MINIMAX_H3_AUDIO_GUIDANCE = `AUDIO SECTIONS: overall_soundscape is one to four sentences covering diegetic ambience, effects, and spatial continuity; do not repeat dialogue or music there. Use overall_soundscape: N/A only when the requested video is totally silent. non_diegetic_music is one to three sentences describing audience-only score through instrumentation, tempo, rhythm, timing, and dynamic development rather than abstract mood labels; use non_diegetic_music: N/A when there is no score.`;

export const MINIMAX_H3_SOURCE_AUDIO_GUIDANCE = `SOURCE-LOCKED AUDIO: decide semantically whether supplied audio is immutable before drafting. When the user asks for the same, exact, original, specific, or trending song/soundtrack, or asks to recreate choreography tied to that audio, the source signal and its timeline are immutable. Never invent a replacement track, request a loose imitation, or add a copyright-avoidance melody/lyric substitution unless the user explicitly asks for different music. In Ref2VA use the official audio reuse task, assign every immutable <Audio N> fully_copy, name it directly in the relevant audio section, and preserve its original timing. Ref2VA reference videos must themselves be exactly 24fps; normalize other rates without changing duration or audio timing before submission. Audio reference means a new signal is generated and is valid only when the user explicitly wants loose style/timbre/rhythm guidance. A generative prompt cannot guarantee waveform identity: an exact-song deliverable must stream-copy/remux the original audio after rendering. Choreography lock is separate from soundtrack lock; use explicit action times from the source, and never represent loose Ref2VA conditioning as guaranteed edit-level beat synchronization. If exact choreography timing is mandatory and the chosen workflow cannot guarantee it, stop before paid generation or use a pose/edit-controlled workflow.`;

export const MINIMAX_H3_DIALOGUE_GUIDANCE = `DIALOGUE: give every vocal source a stable identifier such as (S1), assigned in order of first vocal event and reused across shots. Put the speaker's identity, ID, action, and delivery outside <d>; put only the language tag and spoken words inside <d>[Language] ...</d>. Preserve user-supplied words, language, and punctuation character-for-character, and speak each supplied line exactly as often as the request does, never again to fill a later shot. If the user explicitly requests speech, dialogue, lyrics, or a vocal performance without supplying words, author one concise line that serves that intent; without vocal intent, do not invent speech. Put combined speakers outside the tag as (S1,S2). Bind every line to its speaker in the same sentence, as in: The young woman with a quiet, breathy voice (S1) says: <d>[English] I get off at the next station.</d> and: The two children (S1,S2) shout together, <d>[English] Wait for us!</d> When a speaker first vocalizes, describe the voice itself with its accent, pitch, timbre, and speaking rate (for example "speaking in a plain American accent with a light, mid-pitched voice at a quick, breathless pace"); an unstated accent lets the model pick one, and a voice described only by mood drifts between takes. For voiceover, use the exact phrase "says in an off-screen voiceover" and state immediately after the </d> tag that the on-screen character's lips remain closed. When one line of dialogue or lyrics crosses a cut, place <scenetrans> at the connecting point in both parts (the end of the first <d> block and the start of the next) and explicitly state that the audio continues across the cut; <scenetrans> never appears unpaired. Use <cutoff> when the video ending truncates speech. These are the author-facing spellings from MiniMax's prompt guide; do not emit tokenizer-internal <|...|> markers. Never fix an internal marker by merely deleting its pipe characters: caption markers become exact visible text in double quotes, lyrics markers become an ordinary <d>[Language] ...</d> singing block with the singer and delivery outside it, and <|cutoff|> becomes plain <cutoff>. Visible text is not dialogue: keep it in exact double quotes inside the visual description.`;

export const MINIMAX_H3_DESIRED_ABSENCE_GUIDANCE = `ABSENCES: H3 has no negative-prompt input, and its contract describes only what is visible or audible, so a negation names the very thing it tries to remove. State every exclusion as a positive fact: "the hall is empty and still" instead of "no people", "the walls are bare" instead of "no text or signs", "the air is clear and sharply lit" instead of "no haze", and "non_diegetic_music: N/A" instead of "no music". Never add exclusions the user did not supply and never add a negative_prompt field. Keep a user-supplied exclusion only when it cannot be stated positively, phrased once as a plain statement.`;

export const MINIMAX_H3_IDENTITY_GUIDANCE = `IDENTITY: use concrete visible identity anchors and keep them stable across shots. For frame-anchored modes, preserve the supplied frame's identity, wardrobe, setting, lighting direction, and composition without redundantly cataloguing every pixel.`;

export const MINIMAX_H3_REFERENCE_GRAMMAR_GUIDANCE = `REF2VA REFERENCE GRAMMAR: <Subject N> is reusable visible content abstracted from source assets. An image used only for identity or style belongs inside a Subject definition; do not also create a standalone Picture entry for it. Use <Picture N> only as a concrete keyframe, composition, or shot-planning anchor; <Video N> for a whole-video editing, continuation, motion, or temporal-structure relationship; and <Audio N> for a copied or referenced audio signal. Labels are 1-based per type and must remain semantically identical in every section. Give every attached reference one explicit job and use its correctly typed label. When sources conflict, state which source wins for the conflicting attribute.`;

export const MINIMAX_H3_REFERENCE_JOB_GUIDANCE = `REF2VA SUMMARY AND RETENTION: summary begins with one square-bracketed task prefix chosen from ${MINIMAX_H3_REF2VA_TASK_TYPES.join(', ')}. Join multiple task types with exactly " + ", without duplicates, and choose them from the actual assigned jobs rather than file presence. For direct video editing, begin the body exactly "The target video is an edited version of <Video 1>." Choose video editing when the user asks to transform the supplied source shot. Ref2VA carries that source through its ordinary video reference input; no separate SDK edit flag is required. Choose reference generation when the clip only supplies inspiration or motion for a new shot. Neither task label guarantees pixel-exact preservation or exact choreography. Keep video continuation conditional on an actual continuation workflow. retention_analysis states where every reusable subject or reference applies and uses only the official relationships. Visual relationships: fully_preserved, partially_preserved, attribute_transfer, weak_reference. Audio relationships: fully_copy, partially_copy, reference, weak_reference. State exactly which identity, style, composition, motion, temporal structure, signal, voice character, or other attribute is retained; never leave a reference's job ambiguous. Bind a reference voice to its target subject by reusing that subject's (Sx) in subject_definitions, not in retention_analysis. When audio is only a timbre, rhythm, emotion, or delivery reference, do not import its source words. When words are explicitly reused or reperformed, preserve their wording and language; mark unintelligible spans [unclear] instead of guessing. A verbal cue embedded in copied background music may use <Audio N> without an invented speaker ID. Put copied ambience/effects in overall_soundscape and audience-only score in non_diegetic_music; use both when the source contains both.`;

export const MINIMAX_H3_SOURCE_EDIT_GUIDANCE = `SOURCE-SHOT EDITS: resolve the requested replacement and retained content before writing. For an appearance replacement, mark the edited <Video N> partially_preserved: explicitly list retained camera, scene, positions, action and timing, then the appearance attributes that change. Never mark the whole source fully_preserved merely because motion or framing is retained. Define the replacement <Subject N> from its assigned image references, keeping separate face and wardrobe pictures assigned to the correct person. A replaced source performer supplies performance, not a second retained visible identity; retain original clothing only when the user requests it. Define untouched performers separately from the replaced performer. If a replacement resembles an existing performer, state the final number of subjects and their distinct positions so the reference does not bind only to the existing match. For motion transfer into a new shot, specify which motion attributes transfer and let the requested reference identity and setting govern the target. Keep all user-requested attributes; do not turn a local replacement into a whole-scene restyle.`;

export const MINIMAX_H3_CAMERA_GUIDANCE = `CAMERA: state shot size and lens when useful. Write camera movement as natural prose from the official vocabulary (Zoom In/Out, Push In/Pull Out, Pan Left/Right, Truck Left/Right, Tilt Up/Down, Pedestal Up/Down, Arc Shot, Tracking Shot, Static Shot, Shake Slightly/Strongly, POV, Roll Clockwise/Counterclockwise), adding "with small amplitude" / "with large amplitude" and "at slow speed" / "at fast speed" only when they matter. Keep one primary move per shot unless the request clearly requires a compound move. First-person coverage is a POV shot; write "handheld" only when the user wants visible shake, because it reads as Shake Slightly or Shake Strongly.`;

export const MINIMAX_H3_ONSCREEN_TEXT_GUIDANCE = `VISIBLE TEXT: place every sign, label, title, or other text that must appear on screen in exact double quotes, preserving the user's spelling, capitalization, punctuation, and language.`;

export const MINIMAX_H3_TIMEBASE_GUIDANCE = `TIMEBASE: H3 renders at a fixed 24 fps, 124 to 362 frames on a 17-frame grid (5.17 to 15.08 seconds). Never write frame counts, frame rates, steps, samplers, or a resolution such as 1080p or 2K in the prompt: delivery size is the caller's setting, not something the prompt can ask for.`;

export const MINIMAX_H3_AUDIO_GUIDE_USER_GUIDANCE = 'Uploaded audio guide: the attached audio track drives this video from its first frame and becomes its soundtrack unchanged. Describe what is heard in it as it is: bind any speech it contains to its visible speaker with an (S1) ID and the exact words inside <d>[Language] ...</d> when the request supplies them (otherwise describe the vocal delivery without inventing quoted words), match the visible action and mouth movement to its timing, and make overall_soundscape and non_diegetic_music describe that same audio (non_diegetic_music: N/A when it carries no score). Never add other dialogue, singing, or music.';

/**
 * Sound to Video with keyframes: the uploaded audio plays through the whole
 * clip, so its words belong to the shots in time order rather than to the
 * opening shot the writer would otherwise front-load them into.
 */
export const MINIMAX_H3_AUDIO_GUIDE_KEYFRAME_GUIDANCE = 'Uploaded audio with keyframes: the uploaded audio plays through the whole clip, so unless the request says the words stop early, its supplied words are heard in time order across the shots: give each shot only the words heard while it is on screen, split a line that runs through a cut at that cut, and let any shot after the last word carry no <d> block. Every supplied word appears exactly once; a line is never repeated to give a later shot something to say.';

export const MINIMAX_H3_LENGTH_GUIDANCE = `LENGTH: keep every result under ${MINIMAX_H3_MAX_PROMPT_CHARACTERS} characters. For Ref2VA, target 350-500 words in detailed_description; do not pad the other five sections. If compression is needed, preserve required fields, user-authored exact text, reference labels and jobs, retention relationships, and shot timing first; shorten redundant adjectives and audio prose. Never silently truncate.`;

// The mode paragraph that follows MINIMAX_H3_ROLE_INTRO in each writer prompt.
const MINIMAX_H3_T2V_MODE_GUIDANCE = `This is T2VA: establish the complete video from text with no reference labels or alignment line.`;
const MINIMAX_H3_T2V_CONTINUATION_MODE_GUIDANCE = `This is T2VA written as a seamless continuation, with no reference labels or alignment line: the render carries straight on from the source video's closing frames, so the people, clothes, place, light and framing already exist. Never invent or change them.`;
const MINIMAX_H3_FLF2V_MODE_GUIDANCE = `This is FL2VA. Picture 1 is the opening frame and Picture 2 is the closing frame. The first output line must use the exact official "How the reference pictures align with the target video — ..." sentence supplied in the user message, including the actual final Shot N and effective end time. Then emit the three Base fields. The whole job is the path between the two pictures, which the model already sees: prefer one continuous shot, name the observable intermediate states in order, and reach the composition established by Picture 2 inside the final shot. Beats and cuts are available when the context calls for them; then the final shot may cut to the Picture 2 composition and hold with a live action.`;
const MINIMAX_H3_L2V_MODE_GUIDANCE = `This is L2VA. <Picture 1> is the fully referenced final frame and belongs to the actual final [Shot N], not inherently to Shot 1. The first output line must use the exact official "How the reference pictures align with the target video — ..." sentence supplied in the user message, including the actual final [Shot N] and effective end time. Then emit the three Base fields. Infer a plausible preceding state from the request and final frame, then describe an explicit, physically coherent path (action, object states, camera, light) that gradually converges on <Picture 1> in the final shot.`;
const MINIMAX_H3_I2V_KEYFRAME_MODE_GUIDANCE = `This is I2VA with intermediate keyframes. <Picture 1> is the fully referenced first frame, and each keyframe is a later <Picture N> that the video is pinned to at its time. The first output line must be the exact official "How the reference pictures align with the target video — ..." sentence supplied in the user message, listing every picture at its mark with the actual Shot N. Then emit the three Base fields. Anchor the first picture's style, subjects, wardrobe, colors, objects, and composition in a few concrete facts, then develop forward through observable action to each keyframe in turn.`;
const MINIMAX_H3_T2V_KEYFRAME_MODE_GUIDANCE = `This is T2VA with intermediate keyframes: no first or last frame is supplied, and each keyframe is a <Picture N> that the video is pinned to at its time. The first output line must be the exact official "How the reference pictures align with the target video — ..." sentence supplied in the user message, listing every keyframe at its mark with the actual Shot N. Then emit the three Base fields, establishing everything before, between, and after the keyframes from the request.`;
const MINIMAX_H3_R2V_MODE_GUIDANCE = `This is Ref2VA on the separate reference checkpoint. It requires at least one visual reference: one or more images and/or videos. A video can be the only visual input; audio cannot be the sole input. References are not locked first or last frames.`;
const MINIMAX_H3_I2V_MODE_GUIDANCE = `This is I2VA. <Picture 1> is the fully referenced first frame. The first output line must be exactly:
${MINIMAX_H3_I2V_ALIGNMENT_LINE}
Then emit the three Base fields. Anchor the picture's style, subjects, wardrobe, colors, objects, and composition in a few concrete facts, then develop forward through observable action: onset, continuous development, result or reaction.`;

/** The `minimax-h3` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const MINIMAX_H3_NOTES: readonly string[] = [
  'T2V, I2V, FLF2V, and L2V use exactly three ordered fields: integrated_multimodal_description, overall_soundscape, non_diegetic_music.',
  'I2V, FLF2V, and L2V prepend MiniMax\'s exact mode-specific image-alignment line. L2V uses the existing I2V selector with only a typed last-frame asset; minimax-h3-l2v is not a hosted model selector.',
  'Use [Shot 1] without a timestamp; every later shot uses [Shot N] At MM:SS.mmm, ... .',
  'Use stable (S1) speaker IDs and wrap exact spoken words in <d>[Language] ...</d>; keep visible text in exact double quotes.',
  'overall_soundscape owns diegetic ambience and effects; non_diegetic_music owns audience-only score and is N/A when there is none.',
  'Standard runs 20 steps with res_multistep/simple. Balanced uses fixed 8-step Euler/simple acceleration: LightX2V for FL2VA and Larry v4 for Ref2VA. FL2VA Turbo runs 4 steps with simple scheduling; er_sde is the default sampler, with euler and sa_solver available as explicit A/B variants. Ref2VA Turbo uses the exact upstream 4-step euler/simple recipe. All run at fixed 24 fps and guidance 1.',
  'Default MiniMax reference-to-video to Balanced R2V (minimax-h3-r2v-balanced), or minimax-h3-r2v-balanced-2stage for two-stage, 1080p or 2K output. Preserve an explicitly requested Standard, LightX2V Turbo, or FastH3 Omni R2V tier.',
  'Standard, Balanced, and Turbo Ref2VA use exactly six ordered fields: subject_definitions, summary, retention_analysis, detailed_description, overall_soundscape, non_diegetic_music. The two-stage Ref2VA selectors (minimax-h3-r2v-2stage at 20 steps, minimax-h3-r2v-balanced-2stage at 8 steps) write the same six-field contract with the same references; only the delivered size changes. FastH3 Reference (minimax-h3-fasth3-r2v-turbo and its -2stage form, the FastH3 tier\'s reference-to-video) writes the same six-field contract.',
  'Ref2VA uses <Subject N> for reusable visible content, <Picture N> only for concrete keyframe/composition anchors, <Video N> for whole-video relationships, and <Audio N> for copied or referenced signals. It requires at least one image or video; audio alone is invalid.',
  'The FastH3 audio guide on sound_to_video (minimax-h3-fasth3-ia2v-turbo, minimax-h3-fasth3-flfa2v-turbo, minimax-h3-fasth3-a2v-turbo and their -2stage forms) writes the Base contract of its mode: image + audio as I2V, first/last frame + audio as FLF2V, audio only as T2V. The uploaded audio drives the picture from frame 0 and is the soundtrack, so describe what it contains and never add other dialogue or music. Use these selectors only when the user asks for MiniMax H3 or FastH3.',
];

/** The Base (T2VA, I2VA, FL2VA, L2VA) rule sections that follow each mode paragraph. */
const MINIMAX_H3_BASE_RULES = [
  MINIMAX_H3_CONTEXT_PLANNING_GUIDANCE,
  MINIMAX_H3_OUTPUT_CONTRACT_GUIDANCE,
  MINIMAX_H3_TIMED_SHOT_LIST_GUIDANCE,
  MINIMAX_H3_SCENE_GUIDANCE,
  MINIMAX_H3_PHYSICAL_PRECISION_GUIDANCE,
  MINIMAX_H3_DEPICTION_GUIDANCE,
  MINIMAX_H3_PACING_GUIDANCE,
  MINIMAX_H3_KEYFRAME_PATH_GUIDANCE,
  MINIMAX_H3_AUDIO_GUIDANCE,
  MINIMAX_H3_SOURCE_AUDIO_GUIDANCE,
  MINIMAX_H3_DIALOGUE_GUIDANCE,
  MINIMAX_H3_DESIRED_ABSENCE_GUIDANCE,
  MINIMAX_H3_IDENTITY_GUIDANCE,
  MINIMAX_H3_CAMERA_GUIDANCE,
  MINIMAX_H3_ONSCREEN_TEXT_GUIDANCE,
  MINIMAX_H3_TIMEBASE_GUIDANCE,
  MINIMAX_H3_LENGTH_GUIDANCE,
  MINIMAX_H3_FINAL_ASSESSMENT_GUIDANCE,
];

const MINIMAX_H3_R2V_RULES = [
  MINIMAX_H3_R2V_MODE_GUIDANCE,
  MINIMAX_H3_REF2VA_OUTPUT_CONTRACT_GUIDANCE,
  MINIMAX_H3_REFERENCE_GRAMMAR_GUIDANCE,
  MINIMAX_H3_REFERENCE_JOB_GUIDANCE,
  MINIMAX_H3_SOURCE_EDIT_GUIDANCE,
  MINIMAX_H3_CONTEXT_PLANNING_GUIDANCE,
  MINIMAX_H3_TIMED_SHOT_LIST_GUIDANCE,
  MINIMAX_H3_SCENE_GUIDANCE,
  MINIMAX_H3_PHYSICAL_PRECISION_GUIDANCE,
  MINIMAX_H3_DEPICTION_GUIDANCE,
  MINIMAX_H3_PACING_GUIDANCE,
  MINIMAX_H3_AUDIO_GUIDANCE,
  MINIMAX_H3_SOURCE_AUDIO_GUIDANCE,
  MINIMAX_H3_DIALOGUE_GUIDANCE,
  MINIMAX_H3_DESIRED_ABSENCE_GUIDANCE,
  MINIMAX_H3_CAMERA_GUIDANCE,
  MINIMAX_H3_ONSCREEN_TEXT_GUIDANCE,
  MINIMAX_H3_TIMEBASE_GUIDANCE,
  MINIMAX_H3_LENGTH_GUIDANCE,
  MINIMAX_H3_FINAL_ASSESSMENT_GUIDANCE,
];

function minimaxGuide(
  mode: ModelPromptGuideMode,
  title: string,
  models: readonly string[],
  rules: readonly string[],
): ModelPromptGuide {
  return modelPromptGuide({
    family: 'minimax-h3',
    mode,
    title: `MiniMax H3 ${title}`,
    models,
    referenceGrammar: mode === 'r2v' ? MINIMAX_H3_REFERENCE_GRAMMAR_GUIDANCE : null,
    rules,
    notes: MINIMAX_H3_NOTES,
  });
}

const MINIMAX_H3_T2V_MODELS = ['minimax-h3', 'minimax-h3-t2v', 'minimax-h3-t2v-balanced', 'minimax-h3-fasth3-t2v-turbo'];
const MINIMAX_H3_I2V_MODELS = ['minimax-h3-i2v', 'minimax-h3-i2v-balanced', 'minimax-h3-fasth3-i2v-turbo'];
const MINIMAX_H3_FLF2V_MODELS = ['minimax-h3-flf2v', 'minimax-h3-flf2v-balanced', 'minimax-h3-fasth3-flf2v-turbo'];

/**
 * The FastH3 audio-guide modes (ia2v, flfa2v, a2v) write the Base contract of their picture mode and
 * add the uploaded-audio rule creative-agent gives them in the request.
 */
export const MINIMAX_PROMPT_GUIDES: Pick<ModelPromptGuideRegistry, 'minimax-h3'> = {
  'minimax-h3': {
    t2v: minimaxGuide('t2v', 'text-to-video (T2VA)', MINIMAX_H3_T2V_MODELS, [MINIMAX_H3_T2V_MODE_GUIDANCE, ...MINIMAX_H3_BASE_RULES]),
    extend: minimaxGuide('extend', 'video continuation (T2VA)', MINIMAX_H3_T2V_MODELS, [
      MINIMAX_H3_T2V_CONTINUATION_MODE_GUIDANCE,
      ...MINIMAX_H3_BASE_RULES,
    ]),
    i2v: minimaxGuide('i2v', 'first-frame image-to-video (I2VA)', MINIMAX_H3_I2V_MODELS, [MINIMAX_H3_I2V_MODE_GUIDANCE, ...MINIMAX_H3_BASE_RULES]),
    l2v: minimaxGuide('l2v', 'last-frame image-to-video (L2VA)', MINIMAX_H3_I2V_MODELS, [MINIMAX_H3_L2V_MODE_GUIDANCE, ...MINIMAX_H3_BASE_RULES]),
    flf: minimaxGuide('flf', 'first-and-last-frame video (FL2VA)', MINIMAX_H3_FLF2V_MODELS, [
      MINIMAX_H3_FLF2V_MODE_GUIDANCE,
      ...MINIMAX_H3_BASE_RULES,
    ]),
    'i2v-keyframes': minimaxGuide('i2v-keyframes', 'image-to-video with intermediate keyframes (I2VA)', MINIMAX_H3_I2V_MODELS, [
      MINIMAX_H3_I2V_KEYFRAME_MODE_GUIDANCE,
      ...MINIMAX_H3_BASE_RULES,
    ]),
    r2v: minimaxGuide(
      'r2v',
      'reference-to-video (Ref2VA)',
      ['minimax-h3-r2v', 'minimax-h3-r2v-balanced', 'minimax-h3-r2v-balanced-2stage', 'minimax-h3-fasth3-r2v-turbo'],
      MINIMAX_H3_R2V_RULES,
    ),
    ia2v: minimaxGuide('ia2v', 'FastH3 Sound to Video with a first frame (I2VA)', ['minimax-h3-fasth3-ia2v-turbo'], [
      MINIMAX_H3_I2V_MODE_GUIDANCE,
      ...MINIMAX_H3_BASE_RULES,
      MINIMAX_H3_AUDIO_GUIDE_USER_GUIDANCE,
    ]),
    flfa2v: minimaxGuide('flfa2v', 'FastH3 Sound to Video with first and last frames (FL2VA)', ['minimax-h3-fasth3-flfa2v-turbo'], [
      MINIMAX_H3_FLF2V_MODE_GUIDANCE,
      ...MINIMAX_H3_BASE_RULES,
      MINIMAX_H3_AUDIO_GUIDE_USER_GUIDANCE,
    ]),
    a2v: minimaxGuide('a2v', 'FastH3 Sound to Video from audio only (T2VA)', ['minimax-h3-fasth3-a2v-turbo'], [
      MINIMAX_H3_T2V_MODE_GUIDANCE,
      ...MINIMAX_H3_BASE_RULES,
      MINIMAX_H3_AUDIO_GUIDE_USER_GUIDANCE,
    ]),
    'a2v-keyframes': minimaxGuide('a2v-keyframes', 'FastH3 Sound to Video from audio with intermediate keyframes (T2VA)', ['minimax-h3-fasth3-a2v-turbo'], [
      MINIMAX_H3_T2V_KEYFRAME_MODE_GUIDANCE,
      ...MINIMAX_H3_BASE_RULES,
      MINIMAX_H3_AUDIO_GUIDE_USER_GUIDANCE,
      MINIMAX_H3_AUDIO_GUIDE_KEYFRAME_GUIDANCE,
    ]),
  },
};
