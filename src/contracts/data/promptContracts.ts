import type { ContractRegistry } from '../registry.js';
import type { PromptContract } from '../promptContract.js';

/**
 * Phase 5 PromptContracts — per-tool prompt prose shared across
 * consumers (sogni-chat, sogni-api hosted chat, future SDKs).
 *
 * Promoted from sogni-chat (was
 * `src/services/contractsPromptContracts.ts`). Each contract owns the
 * LLM-visible description for one tool. Cross-cutting prose (role,
 * priorities, voice, output rules, hard safety constraints, product
 * knowledge, context rules) stays in the chat product's
 * CHAT_SYSTEM_PROMPT.
 *
 * One contract per tool. Multiple chat.ts sections that concern the
 * same tool are folded into that tool's single baseDescription.
 */

// ---------------------------------------------------------------------------
// orbit_video
// ---------------------------------------------------------------------------
const ORBIT_VIDEO_CONTRACT: PromptContract = {
  contractId: 'orbit_video_v1',
  version: '1.0.0',
  toolName: 'orbit_video',
  baseDescription: [
    'orbit_video is a self-contained pipeline that handles angle generation, video transitions,',
    'and stitching internally. If the user uploaded an image, call orbit_video directly — it uses',
    'the upload as the front view. If no image exists yet, generate one front-view image first,',
    'then call orbit_video. Avoid pre-generating multiple angles or variations for orbit_video',
    'unless the user explicitly asked to review custom source angles before orbiting.',
    '',
    'ORBIT DIALOGUE: When the user wants spoken dialogue in an orbit video, use the',
    'dialogue parameter rather than prompt. Dialogue goes in the specified segment — put',
    'motion/foley in prompt. If the user says "only in the first segment" or "just at the start",',
    'set dialogueSegment=0 (default). Never put dialogue text in the prompt parameter — it will',
    'be duplicated across all segments.',
    '',
    'ORBIT ANGLES: Do NOT send the angles parameter for standard 360° orbits — omit it entirely.',
    'The default (right side view, back view, left side view at 90° increments) is correct for all',
    'normal orbit requests. Only send angles when the user explicitly asks for specific azimuth',
    'positions (e.g. "show me from the front-right and back-left only") or a partial orbit.',
    '',
    'ORBIT DIALOGUE UPDATE: For dialogue in multiple/every orbit segment, before every 90-degree',
    'turn, or with per-turn sequence numbers, use the dialogues array instead of the single dialogue',
    'parameter. Default 360-degree orbit has 4 transitions, so provide 4 short lines in order; leave',
    'prompt for subject, action, ambient audio, and foley only. Preserve the real names from the',
    'request/prior result; do not invent placeholder speaker tags. For a couple/persona request',
    'phrased as "us", "we", or "my wife and I", each per-turn line should make the named people',
    'speak together. When the user picks a generated image by 1-based number ("number 3",',
    '"use #3"), pass sourceImageIndex as that number minus one (number 3 -> sourceImageIndex=2)',
    'instead of omitting it.',
  ].join('\n'),
  parameterDocs: {
    dialogue: 'Spoken dialogue for the first/default orbit segment. Do NOT put dialogue in prompt — it repeats across all segments.',
    dialogues: 'Per-segment dialogue lines array. Use for multi-segment dialogue (4 lines for full 360° orbit).',
    dialogueSegment: 'Which orbit segment gets the dialogue (0-based). Default 0 = first segment.',
    angles: 'Omit for standard 360° orbits. Only set for explicit azimuth positions or partial orbits.',
    sourceImageIndex: 'Use uploaded image if present. If user picks by 1-based number, subtract 1.',
  },
};

// ---------------------------------------------------------------------------
// animate_photo — video dialogue, duration, batch, and storyboard rules
// ---------------------------------------------------------------------------
const ANIMATE_PHOTO_CONTRACT: PromptContract = {
  contractId: 'animate_photo_v1',
  version: '1.1.0',
  toolName: 'animate_photo',
  baseDescription: [
    'animate_photo produces video from one or more source images using LTX 2.5 by default,',
    'with LTX 2.3 retained as a rollback option and for Persona Voice identity workflows.',
    'Use videoModel="wan3.0-video" when the user explicitly requests Wan 3 first-frame or',
    'first-and-last-frame generation. Wan 3 accepts one start frame and at most one end frame,',
    'renders 2-30 seconds at fixed 30 fps, and supports 480P/720P/1080P output with native audio.',
    '',
    'VIDEO PROMPT QUOTING: In video prompts, ONLY use double quotes for spoken dialogue.',
    'Speaker tags are allowed outside the quotes for screenplay-style dialogue, e.g.',
    'CHARACTER: "We made it." Never put on-screen text, overlay text, titles, captions, signs,',
    'watermarks, or any visual text in quotes — describe them without quotes (e.g. bold white text',
    'reading CONGRATULATIONS overlays the lower third). Quotes signal speech to the model;',
    'quoting non-speech text confuses audio generation.',
    '',
    'DIALOGUE DURATION: Spoken dialogue in video prompts must fit the clip duration. Estimate',
    'at 3 words per second for natural cinematic delivery, plus ~1 second per acting beat',
    '(pauses, gestures, glances between lines). If the user did NOT explicitly request a specific',
    'duration (using default 5s), extend the duration to fit the dialogue (max 20s). If the user',
    'explicitly requested a specific duration, condense the dialogue to fit while preserving meaning.',
    'Check: total dialogue words ÷ 3 + beat count ≤ clip duration.',
    '',
    'LATEST GENERATED IMAGE FOLLOW-UP: When the newest user turn asks to animate, make a video,',
    'or make a clip from a generated image/result (for example "the apple", "this one",',
    '"the latest image"), use animate_photo with that latest generated image. Do not inherit an',
    'older Seedance model, resolution, or duration from an unrelated prior turn unless the newest',
    'user turn explicitly says Seedance or confirms an immediately suggested Seedance video stage.',
    'LTX supports exact 2-20s durations, so honor requests like 3s exactly.',
    '',
    'WORD BUDGET PER CLIP: The handler REJECTS clips whose spoken dialogue exceeds the budget',
    '— there is NO auto-trim, so plan dialogue lengths up-front. Hard maximum is 3.75 spoken',
    'words per second. Ceilings: 5s = 18 words, 6s = 22 words, 8s = 30 words, 10s = 37 words,',
    '15s = 56 words, 20s = 75 words. Aim below these ceilings. If a scene\'s dialogue won\'t fit,',
    'tighten the lines, raise the per-clip duration, or split into two segments — do NOT submit',
    'and hope it works. Spoken words inside double quotes count toward the budget; speaker tags',
    'and visual/action prose are free.',
    '',
    'BATCH VIDEO PER-CLIP DURATION: For a multi-segment animate_photo batch',
    '(sourceImageIndices + prompts) when the user states a TOTAL video length but NO per-clip',
    'length, target 15 seconds per clip when dialogue is involved, and pass that duration',
    'explicitly. Example: 60s total → 4 segments × 15s, NOT 6×10s or 12×5s. There is NO 3-clip',
    'batch cap: sourceImageIndices supports up to 16 clips, so keep one planned batch together',
    'unless the user explicitly wants isolated projects or per-output settings require it.',
    'Do NOT split a planned 15s dialogue scene into multiple',
    'shorter clips just because a retry complains about word budget; keep duration=15 and tighten',
    'the line. Use 5s clips only for single short motion beats or one very short spoken phrase.',
    'If the user explicitly specifies a per-clip duration, honor that instead.',
    '',
    'N-VERSIONS-OF-A-VIDEO PATTERN: Avoid sequential animate_photo calls for N outputs.',
    'Prefer one Dynamic Prompt project when only prompt text varies, and reserve',
    'sourceImageIndices multi-project fan-out for source/end asset differences, isolated retry',
    'lifecycle, or other per-output parameter differences. Flavors:',
    '(A0) SAME SOURCE / PROMPT-ONLY TAKES — use sourceImageIndex, numberOfVariations=N,',
    'and ONE Dynamic Prompt branch in prompt: "{full prompt 1|full prompt 2|...}". This',
    'submits shared settings and source assets once; Sogni socket creates N jobs in one project.',
    '(A) SHARED CONTENT — one edit_image/generate_image call with numberOfVariations=N + {|}',
    'Dynamic Prompts to make N distinct source images, then ONE animate_photo call with',
    'sourceImageIndices=[start..start+N-1] and a single shared prompt.',
    '(B) PER-CLIP ASSET WIRING — when each clip has DIFFERENT source images, end frames,',
    'audio windows, durations, dimensions, or other non-prompt parameters,',
    'pass BOTH sourceImageIndices AND prompts (array of N strings, one per clip) in the SAME',
    'single animate_photo call. The top-level prompt is still required — pass a brief batch summary.',
    'For explicit last/end-frame-only batches, reuse the image through sourceImageIndices but set',
    'frameRole="end" and omit endImageIndex/endImageIndices. This means each listed image is the',
    'last frame for its corresponding clip and no first/start frame is supplied.',
    'If the user explicitly asks for Dynamic Prompt / Dynamic Template syntax, prefer flavor A0',
    'whenever every output uses the same source/end assets and shared settings, even if they also',
    'ask to stitch the completed clips afterward.',
    '',
    'CRITICAL: sourceImageIndices values MUST be read from the latest edit_image/generate_image',
    'tool result\'s startIndex field — if startIndex=3 and 4 images were generated, pass',
    'sourceImageIndices=[3,4,5,6], NOT [0,1,2,3]. Negative indices refer to uploaded images:',
    '-1 first upload, -2 second upload, -3 third upload. Use repeated -1 entries only when',
    'intentionally reusing the primary uploaded image. When prompts is supplied, prompts.length',
    'MUST equal sourceImageIndices.length.',
    '',
    'SEEDANCE UPLOADED STORYBOARD DEFAULT: If the user uploaded a storyboard, shot sheet,',
    'or visual trailer board and asks to make a trailer/video/movie/clip from it, do NOT use',
    'animate_photo on the board image and do NOT split it into four LTX clips. Use generate_video',
    'with Seedance referenceImageIndices for one continuous clip unless the user explicitly asks',
    'for separate LTX clips or first-frame/last-frame animation.',
    '',
    'SCREENPLAY / STORYBOARD ANIMATE RULE: For full storyboard projects, use one',
    'animate_photo batch with sourceImageIndices + prompts so each clip keeps its own exact',
    'scene text, stable cast anchors, and screenplay-style speaker-tagged dialogue, and all video',
    'clips render in parallel. Every speaking clip\'s video prompt must include that clip\'s actual',
    'quoted dialogue, not placeholders such as "while speaking", "dialogue begins", "explaining",',
    'or "final line lands". If each generated scene keyframe should be both the first and last frame',
    'of its own stitched segment, call animate_photo with sourceImageIndices=[start..end],',
    'frameRole="both", prompts=[...], and OMIT endImageIndex/endImageIndices so the handler',
    'uses each source as its own end frame.',
    '',
    'UPLOADED REFERENCE LOOPED PROMPT-ONLY TAKES: When the user supplies one uploaded reference',
    'image and asks for N clips that all reuse that same image as BOTH the first frame and last',
    'frame, with only the action/prompt text varying, do it in ONE Dynamic Prompt project:',
    'sourceImageIndex=-1, frameRole="both", endImageIndex=-1, numberOfVariations=N, and prompt',
    'as ONE branch: "{full prompt 1|full prompt 2|...|full prompt N}". Do NOT use',
    'sourceImageIndices=[-1,-1,...] or prompts=[...] for this prompt-only shape. After the',
    'single animate_photo project completes, call stitch_video with the returned video indices',
    'if the user requested a final stitched video.',
    'Each Dynamic Prompt option must be a complete natural-language motion prompt for the video',
    'model. Do not include orchestration labels such as "clip 1 of N", "overall request context",',
    '"use the uploaded image as the source frame", "follow the user request", or "make this clip',
    'distinct"; the attached first/last-frame image is already wired through arguments.',
    'Keep explicit shared constraints outside the branch before "{...}" and honor them inside every',
    'option: locked/static camera, subtle motion, consistent flames/embers, and silent expression-only',
    'physical performance when requested. Non-speaking expressions such as yawns, smiles, kisses, or shy',
    'mouth-covering gestures are acceptable when they are the requested physical performance; do not',
    'turn them into speech, singing, or dialogue-like lip motion.',
    'If the user gives avoid/no/don\'t constraints for a Dynamic Prompt batch, the shared prefix before',
    'the branch must include their positive equivalents, such as single-subject empty background, clean',
    'blank surfaces, crisp sharp focus, same room/layout continuity, silent expression-only physical',
    'performance, consistent flame/ember motion, and natural anatomically consistent hands. Do not place',
    'those constraints only in negativePrompt or omit them from prompt.',
    'For videoModel="wan22", write motion-only visual prompts. WAN 2.2 does not generate audio,',
    'so omit soundtrack, ambience, room tone, music, hums, sighs, spoken words, voice, and SFX cues.',
    'For videoModel="wan22", "ltx25", and "ltx23", the prompt field is the positive prompt. Translate user',
    'avoid/no/don\'t constraints into affirmative production constraints instead of copying negative',
    'phrasing into prompt. Examples: "no people in background" -> single subject focus with an empty',
    'background; "no text" -> clean blank surfaces; "don\'t make it blurry" -> crisp sharp focus;',
    '"no weird hands" -> natural anatomically consistent hands; "don\'t change the room" -> the same',
    'room and layout remain consistent. Preserve exact quoted visible text or dialogue when the user',
    'explicitly requests it, and keep surrounding surfaces blank.',
    '',
    'UPLOADED REFERENCE LOOPED SCRIPTED SKITS: When the user supplies one uploaded reference image',
    'and asks for several scripted/storyboard/dialogue segments to reuse that same image as BOTH',
    'the first frame and last frame of each segment before stitching, do it in ONE animate_photo call:',
    'sourceImageIndices=[-1,-1,...], frameRole="both", endImageIndex=-1 (or matching',
    'endImageIndices=[-1,-1,...]), duration equal to the requested per-segment duration, and',
    'prompts=[one full scene prompt per segment]. Each prompt must preserve the exact screenplay',
    'speaker tags and quoted dialogue from that scene, e.g. HOST: "..." GUEST: "...". Do not',
    'drop speaker tags, convert them to generic narration, omit the last-frame contract, analyze',
    'the image first, generate new keyframes first, or split the batch into serial calls. After',
    'the single animate_photo batch completes, call stitch_video with the returned video indices.',
    '',
    'For adjacent transition chains: N images create N-1 clips — call animate_photo with',
    'frameRole="both", sourceImageIndices=[start..end-1], endImageIndices=[start+1..end],',
    'prompts=[one transition prompt per adjacent pair], then stitch_video. If 5 uploaded images',
    'are the keyframe sequence, use sourceImageIndices=[-1,-2,-3,-4],',
    'endImageIndices=[-2,-3,-4,-5], frameRole="both", prompts length 4, then stitch_video.',
    'Do NOT set endImageIndex=-1 in generated-keyframe patterns — that means every clip ends',
    'on the primary uploaded image.',
    '',
    'UPLOADED FIRST-FRAME/LAST-FRAME TRANSITION CHAINS: If the user uploads multiple images',
    'and asks for a video that transitions from image to image, changes country/version every',
    'N seconds, or says to use first-frame/last-frame for each pair, call animate_photo directly.',
    'Do not call edit_image, generate_image, analyze_image, or map_assets_for_model first — the',
    'uploaded images are already the keyframes. For N uploaded images, create N-1 adjacent clips',
    'unless the user explicitly asks for a loop back to the first image. Use per-clip duration',
    'from "every N seconds" when present; otherwise divide the requested total by the number of',
    'adjacent clips. After animate_photo returns the batch videos, call stitch_video with',
    'those video indices before finalizing unless the user explicitly asked to keep separate clips only.',
    '',
    'MINIMAX H3 2K OUTPUT: outputScale=2 is available only on the MiniMax H3 selectors. It renders on',
    'the normal H3 canvas and delivers the clip at twice its width and height (1344x768 becomes',
    '2688x1536) with the same length and audio, for +10 Spark per second (+6 at 480p). Set',
    'outputScale=2 only when the user asks for 2K, 1440p-class or extra-sharp H3 output; keep',
    'targetResolution at 768 or omit it, never set 1080p, 1440p or 4K for H3, and leave outputScale',
    'unset otherwise. Do not set it for any other model.',
  ].join('\n'),
  parameterDocs: {
    sourceImageIndices: 'Batch source image indices. Read startIndex from prior generate_image/edit_image result. Negative = uploaded images (-1 = first upload). May be paired with frameRole="end" only for explicit last/end-frame-only fan-out.',
    prompts: 'Per-clip prompt array. Length MUST equal sourceImageIndices.length when both are set.',
    duration: 'Per-clip duration in seconds. Target 15s when dialogue is involved and total length is given without per-clip spec.',
    frameRole: 'Set to "end" for explicit last/end-frame-only fan-out; set to "both" for first+last frame transitions using sourceImageIndices + endImageIndices.',
    endImageIndices: 'End frames for adjacent-chain transitions. N images → N-1 clips.',
    outputScale: 'MiniMax H3 only: 2 = 2K delivery (twice the width and height, same length and audio, +10 Spark/s, +6 at 480p). Set only when the user asks for 2K, 1440p-class or extra-sharp H3 output; otherwise omit.',
  },
};

// ---------------------------------------------------------------------------
// generate_video
// ---------------------------------------------------------------------------
const GENERATE_VIDEO_CONTRACT: PromptContract = {
  contractId: 'generate_video_v1',
  version: '1.3.0',
  toolName: 'generate_video',
  baseDescription: [
    'generate_video produces text-to-video clips and multimodal reference videos.',
    'Use for text-only video generation with no source image input. For Seedance and Wan 3, also',
    'use this tool when uploaded/generated images, videos, or audio are loose references. Use',
    'animate_photo when a source image must become the first frame of an LTX/WAN animation.',
    '',
    'WAN 3: Use videoModel="wan3.0-video" for explicit Wan 3 requests. The same canonical model',
    'supports text, up to 10 reference images, 5 reference videos, and 5 reference audios. Refer',
    'to loose assets in English prompts as Image 1, Video 1, and Audio 1, numbered independently',
    'by type. Do not bracket or @-prefix these identifiers. Wan 3 renders 2-30 seconds at fixed',
    '30 fps, offers 480P/720P/1080P and 16:9/4:3/1:1/3:4/9:16, and can toggle native audio.',
    '',
    'MINIMAX H3 SOURCE AUDIO: Every H3 R2V call with a reference video or audio must set',
    'sourceAudioPolicy. A specific/original/trending song is immutable: use reuse_exact, author',
    'the official audio reuse task plus fully_copy, keep choreography on explicit source times,',
    'and stream-copy/remux the original soundtrack after rendering. Never substitute, recompose,',
    'remix, or add a copyright-avoidance mutation. H3 reference videos must themselves be exactly',
    '24 fps; normalize other rates without changing duration/audio timing before submission.',
    'Ref2VA cannot guarantee edit-level beat sync.',
    '',
    'SEEDANCE UPLOADED STORYBOARD DEFAULT: When the user uploads a storyboard, shot sheet,',
    'mood board, or trailer concept image and asks to make a movie trailer/video/clip from it,',
    'default to one Seedance generate_video call with referenceImageIndices=[-1]. Do not first',
    'extract panels with edit_image, do not generate replacement keyframes, and do not make four',
    'separate LTX animate_photo clips unless the user explicitly asks for separate clips or LTX.',
    'Use seedance2 when premium Spark access is available; if premium access is unavailable,',
    'explain the limitation or use the best non-Seedance fallback the user accepts.',
    '',
    'EXACT / INCLUDED VIDEO PROMPTS: If the user asks for a Seedance video using uploaded or',
    'generated references and says to use a prompt exactly, pass only that literal quoted prompt',
    'to generate_video and set skipPromptProcessing=true plus expandPrompt=false. Do not treat',
    'words inside the literal prompt, such as storyboard, script, thumbnails, or panels, as a',
    'request to create a storyboard image. If the user includes a timecoded script inside a',
    'video request, keep it in the generate_video prompt. Explicit constraints like no storyboard',
    'panels, no subtitles, or no captions are constraints on the video render, not instructions',
    'to call edit_image or generate_image.',
    '',
    'STORYTELLING / COMMERCIAL / TRAILER PROMPTS: For creative video requests, turn the brief',
    'into timed, causally connected visual beats before writing the final prompt. Default social',
    'video is 15s 9:16 with a strong first 1-2s, visible escalation, payoff, and brand/CTA/final',
    'image. Commercials should show audience desire/problem, transformation, proof/benefit, and',
    'CTA. Trailers should follow hook → world → disruption → escalation → reveal → title/CTA.',
    'Every beat must be generatable: subject, setting, action, camera, lighting, audio, and text',
    'role where relevant. Avoid vague "cinematic" filler, feature dumps, and beautiful images with',
    'no visible change.',
    '',
    'VIDEO PROMPT QUOTING: ONLY use double quotes for spoken dialogue in video prompts. Never',
    'quote on-screen text, titles, captions, or visual text elements — describe them without',
    'quotes. Quotes signal speech to the model and confuse audio generation.',
    '',
    'STORYBOARD TEXT: Structural headings, section numbers, slide titles, panel titles, and',
    'captions in storyboard references may become short audio-only narration/VO or',
    'key-message beats, but they are not subtitles, title cards, lower thirds, or visible',
    'overlays unless the user explicitly asks for visible text, on-screen text, a title',
    'card, subtitle, lower third, signage, or CTA. Keep narration as separate brief phrases',
    'with pauses; do not concatenate storyboard labels into run-on voiceover.',
    '',
    'DIALOGUE DURATION: Spoken dialogue must fit the clip. Estimate 3 words per second',
    'natural delivery plus ~1s per acting beat. Hard maximum 3.75 words/second.',
    'Check: dialogue words ÷ 3 + beats ≤ duration. Do not submit oversized dialogue.',
    '',
    'LATEST USER DURATION WINS: In follow-up turns, use the newest duration the user states,',
    'even if a previous assistant message mentioned a longer script/runtime. For example, if',
    'history says "the full script is 66 seconds" but the user now says "do a 30 second version",',
    'generate the 30 second version. Do not ask a clarification question just because history',
    'contains another duration; treat the latest user request as the override.',
    '',
    'SEEDANCE SHORT-DURATION LIMIT: Seedance supports 4-15s clips. If the user explicitly asks',
    'for Seedance below 4s, do not silently round up. Ask whether they prefer a 4s Seedance clip',
    'or an exact-duration LTX clip. If the user did not explicitly ask for Seedance, choose the',
    'model/tool that can satisfy the requested duration exactly.',
    '',
    'MINIMAX H3 2K OUTPUT: outputScale=2 is available only on the MiniMax H3 selectors. It renders on',
    'the normal H3 canvas and delivers the clip at twice its width and height (1344x768 becomes',
    '2688x1536) with the same length and audio, for +10 Spark per second (+6 at 480p). Set',
    'outputScale=2 only when the user asks for 2K, 1440p-class or extra-sharp H3 output; keep',
    'targetResolution at 768 or omit it, never set 1080p, 1440p or 4K for H3, and leave outputScale',
    'unset otherwise. Do not set it for any other model.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'Video prompt. Use double quotes ONLY for spoken dialogue. Describe visual text without quotes.',
    duration: 'Clip duration in seconds. Plan dialogue word count against the 3.75 words/second ceiling.',
    outputScale: 'MiniMax H3 only: 2 = 2K delivery (twice the width and height, same length and audio, +10 Spark/s, +6 at 480p). Set only when the user asks for 2K, 1440p-class or extra-sharp H3 output; otherwise omit.',
  },
};

// ---------------------------------------------------------------------------
// edit_image
// ---------------------------------------------------------------------------
const EDIT_IMAGE_CONTRACT: PromptContract = {
  contractId: 'edit_image_v1',
  version: '1.0.0',
  toolName: 'edit_image',
  baseDescription: [
    'edit_image applies instruction-based edits to uploaded or generated images. Use when',
    'uploaded or reference images must guide identity or likeness.',
    '',
    'Image-to-Image prompt order: [IDENTITY LOCK] → [REQUESTED EDIT] → [REFERENCE ROLE',
    'MAPPING] → [POSE/COMPOSITION] → [STYLE] → [LIGHTING/REALISM] → [PRESERVE ALL',
    'UNMENTIONED DETAILS]. GOLDEN RULE: When editing a person, state which image owns',
    'identity so it is not ambiguous. Describe only the DELTA — what changes. Don\'t',
    'rewrite the entire image; the base image already contains most of the truth. Default to minimal',
    'change. For multi-image edits, assign one primary role per reference image (identity, pose,',
    'outfit, style, environment). Do not let a style/pose/clothing reference silently override the face.',
    'Use positive constraints — "preserve exact facial likeness, face structure, eye shape, nose',
    'shape, mouth shape, jawline, skin tone, hairline, apparent age, and overall recognizability"',
    '— not vague negatives like "don\'t mess up the face".',
    '',
    'KREA IDENTITY EDIT: Use model="krea-identity-edit" whenever an edit of a referenced',
    'person or character must keep likeness or character identity while changing clothing,',
    'hair or makeup, pose or position, face/head/body, background, lighting, or visual style.',
    'Infer that semantic intent in any language; never route from keyword or regex matching.',
    'Also use it for a non-Pro single-character sheet. An explicitly requested model always',
    'wins. Use model="dark-beast-krea2-identity-edit" only when the user explicitly requests',
    'that model, its uncensored/community variant, or dark_beast_krea2_identity_edit_v1_2.',
    'These models require one reference image, accept up to two context images, and work best',
    'at 512-2048 px. Let the model tier and worker choose current execution defaults, and do',
    'not use negative prompts. Put the primary scene/base image first and an optional',
    'person/detail reference second; reference them with context_image_0 and context_image_1',
    'when model_ref tokens are needed.',
    '',
    'KREA 2 IDENTITY EDIT PROMPTING: Use a concise 1-4 sentence delta instruction instead of',
    'the generic 50-200 word expansion. Name the requested change and only the details that',
    'must remain fixed; do not restate the whole image or dump a facial-feature inventory.',
    'With two references, assign their roles compactly: base scene/image first, then the',
    'person/detail/outfit/pose/style reference. Longer structured prompts remain appropriate',
    'for character sheets, grids, editorial layouts, or exact visible text.',
    '',
    'UPLOADED IMAGE VARIANT SETS: When the user supplies a photo/portrait/reference image and',
    'asks for N distinct generated images deriving from that source while changing paired',
    'per-output details, prefer one edit_image call with sourceImageIndex=-1,',
    'numberOfVariations=N, and ONE Dynamic Prompt branch with N complete options. Each option',
    'must be a full concrete image prompt for one output, including the uploaded subject/reference',
    'anchor, requested pose or placement preservation, the specific changed appearance/style/role,',
    'clothing or surface details when relevant, setting/background, and any requested label text or',
    'visual symbol. If one option is a remade original/preserved source and the rest are themed',
    'variants, the original option should explicitly say to preserve the original clothing/wardrobe/outfit',
    'and background/setting, plus any requested added label, flag, logo, symbol, or prop.',
    'Do not call generate_image, analyze_image, or multiple serial edit_image calls first.',
    '',
    'SELECTION-GATED IMAGE STAGES: If the user asks for N image options and says they will pick',
    'one before a later dance/video/animation, prefer one edit_image call with numberOfVariations=N',
    'and one Dynamic Prompt branch. After images are created, stop and ask the user to choose',
    'unless the user explicitly asked to run the later stage immediately.',
    '',
    'MULTI-PERSONA (COMBINED): When multiple personas must appear in the SAME scene, make',
    'one edit_image call with all persona faces in one prompt and omit personaName.',
    'Per-persona splits (one call each with personaName set) are RARE — only when the user',
    'explicitly asks for solo images of each person individually.',
    '',
    'STORYBOARD IMAGE BATCH RULE: When rendering scene keyframes from a screenplay/storyboard,',
    'numberOfVariations is only the count; the prompt should be one Dynamic Prompt branch with one',
    'full keyframe prompt per scene:',
    '{scene 1 full keyframe prompt|scene 2 full keyframe prompt|...|scene N full keyframe prompt}.',
    'Do not set numberOfVariations=N with only the first scene prompt — that creates N versions of',
    'scene 1. For full project requests, one edit_image batch for all scene keyframes, then one',
    'animate_photo batch for all video clips in parallel.',
    'Exception: if the storyboard/shot sheet is already uploaded and the user asks to make a',
    'trailer/video/movie/clip from that uploaded board, do not extract panels or redraw keyframes.',
    'Use generate_video with Seedance references for one continuous clip unless the user explicitly',
    'asks for separate image keyframes or a storyboard sheet output.',
    '',
    'DIRECT UPLOADED GPT IMAGE 2 STORYBOARD SHEETS: If the user uploaded reference images and',
    'asks for one finished GPT Image 2 storyboard/keyframe sheet now, call edit_image directly',
    'with sourceImageIndex=-1, model="gpt-image-2", numberOfVariations=1, and the requested',
    'canvas/aspect settings. If the user did not explicitly specify a storyboard page/canvas/sheet',
    'shape, default the GPT Image 2 storyboard sheet pixel dimensions to a balanced grid that hosts',
    'the target cell aspect ratio natively (e.g., 12 cells with 9:16 portrait video target -> ~3:4',
    'portrait sheet around 1728x2304; 12 cells with 16:9 landscape video target -> ~4:3 landscape',
    'sheet around 2304x1728; 6 cells with 9:16 target -> ~27:32 portrait sheet around 1840x2176). Do',
    'NOT default the sheet to 2560x1440 landscape when cells are portrait — a landscape sheet with',
    'a portrait-cell grid physically forces cells to ~4:3 landscape and the model will not render',
    '9:16 portrait rectangles inside it. Keep individual scene-cell/frame areas at the target video',
    'aspect ratio. Do not call map_assets_for_model, analyze_image, generate_image, or a separate',
    'planning tool first. The uploaded files are already available as references; describe their',
    'roles plainly in the edit_image prompt and generate the sheet in that call.',
    '',
    'DO NOT USE edit_image FOR UPLOADED REFERENCE LOOPED VIDEO SEGMENTS: If the user says the',
    'same uploaded image/reference should be reused as the first frame and last frame of each',
    'scripted segment/scene/clip before stitching, they are explicitly asking to animate the',
    'uploaded image, not to generate new storyboard keyframes. Do not call edit_image for that',
    'request. Call animate_photo once with repeated uploaded source indices and per-scene prompts.',
  ].join('\n'),
  parameterDocs: {
    sourceImageIndex: 'Index of uploaded/generated image. Use -1 for the first uploaded image.',
    numberOfVariations: 'Number of output variants. When > 1, use a Dynamic Prompt branch with one complete prompt per output.',
    prompt: 'Edit instruction. Start with identity lock (who owns the face), then describe only the delta.',
  },
};

// ---------------------------------------------------------------------------
// generate_image
// ---------------------------------------------------------------------------
const GENERATE_IMAGE_CONTRACT: PromptContract = {
  contractId: 'generate_image_v1',
  version: '1.1.0',
  toolName: 'generate_image',
  baseDescription: [
    'generate_image creates images from text descriptions. Use for text-only image generation;',
    'use edit_image when uploaded or reference images must guide identity/likeness.',
    'Exception: Z-image, Z-image Turbo, and Krea 2 Turbo image-to-image/enhancement requests',
    'use generate_image with model="z-turbo", model="z-image", or model="krea-2-turbo",',
    'sourceImageIndex=-1, and starting_image_strength; do not route explicit base-model',
    'Z-image Turbo or Krea 2 Turbo uploaded-image enhancement to edit_image because edit_image',
    'does not expose those base image-to-image models.',
    '',
    'MODEL CHOICE: If the user asks for Krea 2 Turbo, choose model="krea-2-turbo". If they ask',
    'for Dark Beast Krea 2, choose model="dark-beast-krea2". If they ask for Dark Beast Z-Image',
    'Turbo, choose model="dark-beast-z-turbo". If they ask for Chroma 1 HD, choose model="chroma1-hd".',
    'If they ask for anime or anime-style output without naming a model, choose model="one-obsession-v22".',
    'Base Z-image and Krea 2 Turbo image-to-image/enhancement requests stay on generate_image with',
    'sourceImageIndex and starting_image_strength; identity-preserving Krea edits with reference',
    'photos use edit_image instead.',
    '',
    'BATCH FAN-OUT DEFAULT (READ BEFORE ANYTHING ELSE BELOW):',
    'When the user explicitly asks for N images in the CURRENT turn, set numberOfVariations=N',
    'in one call. Avoid multiple serial generate_image calls unless the user explicitly wants',
    'independent projects, isolated approvals, or per-output settings that cannot share one project.',
    'Do not omit numberOfVariations and try to "generate the next one after this finishes".',
    'Trigger phrasings:',
    '"draw N", "make N", "give me N", "show me N", "render N", "create N", "generate N",',
    '"N more", "another N", "N as separate", "N separate images", "N different images",',
    '"N options", "N takes", "N versions", "N variations", "N pictures of",',
    '"all at the same time", "in parallel", "side by side as separate".',
    '',
    'THE PRIOR TURN DOES NOT ANCHOR THE CURRENT TURN. If the prior assistant turn used',
    'numberOfVariations=1 with a composite "N subjects in one image" prompt, and the user',
    'now says "draw N more as separate images" / "as separate" / "separately", DO NOT carry',
    'over numberOfVariations=1 from the prior call. The user is correcting that interpretation;',
    'set numberOfVariations=N for THIS call with one self-contained prompt per image via {|}',
    'Dynamic Prompt branches. The new turn\'s count + separation language always wins over the',
    'previous turn\'s pattern.',
    '',
    'WHEN BATCH FAN-OUT DOES NOT APPLY: numberOfVariations=1 with multiple subjects packed into',
    'ONE prompt is correct only when the user clearly wants a SINGLE composite image (e.g.',
    '"draw 2 goats in a meadow" with no separation language, or explicit "in one image" / "one',
    'picture of N" / "single image" / "composite" / "sheet" / "side-by-side composition").',
    '',
    'IMAGE PROMPT ORDER: [SUBJECT] → [ATTRIBUTES] → [ACTION/POSE] → [CAMERA/FRAMING]',
    '→ [ENVIRONMENT] → [LIGHTING] → [STYLE/MEDIUM] → [MATERIALS/TEXTURES] →',
    '[SECONDARY DETAILS]. By default, start with the main subject and concrete observable',
    'attributes; use mood or atmosphere first only when the user explicitly asks for that shape.',
    'Use concrete nouns and observable adjectives — "soft overcast daylight" not "nice lighting".',
    'Good defaults when user is underspecified: medium shot for portraits, wide shot for',
    'environments, eye-level angle, soft natural light for realism.',
    '',
    'DYNAMIC PROMPTS: When numberOfVariations > 1, use Dynamic Prompt syntax to make each',
    'variation meaningfully different — not just seed-different. Syntax: {a|b|c} cycles',
    'sequentially, {@a|b|c} picks randomly, {~a|b} paired cycling across groups. Rules: (1) Vary',
    'ONLY what the user left unspecified — lock in everything they specified. (2) Match option',
    'count to numberOfVariations so every result is unique. (3) Briefly tell the user what you\'re',
    'varying without exposing raw {|} syntax unless the user asks to inspect the prompt.',
    '(4) Skip when: user wants consistency, prompt is fully',
    'specified, user typed their own {|} syntax, or iterating on a specific result. (5) Do not put',
    'the count or the word "versions"/"variations" inside the prompt — the prompt always describes',
    'a single image. The multiplicity comes ONLY from numberOfVariations + the {|} syntax.',
    'LINKED VARIANTS: when multiple attributes must stay paired per result, use ONE top-level',
    'Dynamic Prompt branch with one complete self-contained prompt per output. Do NOT split',
    'linked fields into separate Dynamic Prompt groups. Treat every batch-wide requirement',
    'quantified as "each", "every", or "all" as a hard per-option invariant: repeat it inside',
    'EVERY option, including identity/pose continuity, clothing/style, the concrete setting, and',
    'literal visible names, labels, captions, flags, logos, or symbols. A shared prefix or another',
    'option is never a substitute for a complete standalone option.',
    'Each option must name its actual styling, setting, accessories, and requested literal text or',
    'symbol. Never emit meta-placeholders such as "variant-specific background", "requested',
    'symbol", "humorous alternate name", or "bake the name and symbol into the image".',
    'When one option remakes/preserves an original and the others are themed variants, make the',
    'original option equally concrete: specify the original clothing and setting plus every',
    'requested label, flag, logo, symbol, or prop; do not write only "the original".',
    '',
    'SELECTION-GATED IMAGE STAGES: If the user asks for N image options and says they will pick',
    'one before a later dance/video/animation, call generate_image once with numberOfVariations=N.',
    'After images are created, stop and ask the user to choose unless the user explicitly asked',
    'to run the later stage immediately.',
    '',
    'IMAGE→VIDEO DIMENSION RULE: When generating an image that will feed into a video tool',
    '(animate_photo, sound_to_video, etc.), the image MUST be generated at the SAME aspect',
    'ratio and dimensions as the target video. Default video aspect ratio is 16:9 landscape —',
    'pass aspectRatio="16:9" (or the user\'s specified/reference ratio) so the source image',
    'matches the video output. Do not generate a square image for a widescreen video. Exception:',
    'a composite GPT Image 2 storyboard/keyframe sheet for a later Seedance video is a board,',
    'not a single source frame; unless the user explicitly specifies a storyboard page/canvas/sheet',
    'shape, default the sheet image dimensions to a balanced grid that hosts the target',
    'scene-cell/frame aspect natively (portrait video target -> portrait or square sheet whose',
    'columns x rows grid produces ~9:16 cells; landscape video target -> landscape sheet whose',
    'rows x columns grid produces ~16:9 cells). Each scene-cell/frame area preserves the target',
    'video aspect ratio.',
    '',
    'STORYBOARD IMAGE BATCH RULE: When rendering scene keyframes from a screenplay/storyboard,',
    'numberOfVariations is only the count; the prompt should be one Dynamic Prompt branch with one',
    'full keyframe prompt per scene:',
    '{scene 1 full keyframe prompt|scene 2 full keyframe prompt|...|scene N full keyframe prompt}.',
    'Do not set numberOfVariations=N with only the first scene prompt — that creates N versions of',
    'scene 1. For full project requests, one generate_image batch for all scene keyframes, then',
    'one animate_photo batch for all video clips in parallel.',
    '',
    'STORYTELLING / BRAND / SOCIAL IMAGE PROMPTS: If generating a storyboard, ad concept,',
    'trailer sheet, meme, creator post, or provocative social concept, make the first frame or',
    'panel immediately legible. Preserve the user\'s requested tone and audience. Use concrete',
    'composition, persona, product/brand role, caption placement, readable required text, and a',
    'clear visual transformation or punchline. For provocative adult social content, keep subjects',
    'clearly adult and consensual, PG-13/non-explicit, and avoid minor-coded styling or school-coded',
    'settings while still optimizing visual magnet, persona, caption bait, and replay/comment value.',
    '',
    'GPT IMAGE 2 STORYBOARD SHEET → SEEDANCE AUTO-PROCEED: If the user asks to run the whole',
    'GPT Image 2 storyboard/keyframe sheet plus Seedance workflow without approval, the FIRST',
    'generate_image call must create ONE composite storyboard/keyframe sheet, not loose concept',
    'art and not separate keyframes. Use model="gpt-image-2", numberOfVariations=1, and a',
    'compiled storyboard prompt that literally includes: "Create exactly N sequential video',
    'storyboard frames as one composite storyboard image", "Target final video aspect ratio: X",',
    'a `SCENES:` section, and exactly N concrete scene entries named `SCENE_01`, `SCENE_02`,',
    'etc. Each scene entry must include `Visual/Action:`, `Camera/Motion:`, `Dialogue/VO:`',
    '(use `[no dialogue]` when silent), `Audio/SFX:`, and any reference/visible-text notes',
    'needed for that scene. Do not send only a source brief, storyboard concept, or generic',
    'layout instructions as the prompt; malformed compiled storyboard prompts are blocked by',
    'quality audit instead of being repaired at runtime. If the user does not explicitly specify',
    'a frame count, choose N with the shared storyboard density default: at least one key visual',
    'beat about every 2 seconds, rounded up and clamped to 6-16 total storyboard frames',
    '(for example, a 60 second commercial defaults to N=16). Unless the user explicitly specifies another',
    'storyboard page/canvas/sheet shape, default the GPT Image 2 storyboard sheet pixel dimensions',
    'to a balanced grid that hosts the target cell aspect natively: for a 9:16 portrait video,',
    'pick a portrait-leaning sheet whose columns x rows grid produces ~9:16 cells (e.g., 12 cells',
    '-> ~3:4 sheet around 1728x2304, 6 cells -> ~27:32 around 1840x2176, 9 cells -> ~9:16 around',
    '1504x2672); for a 16:9 landscape video, pick a landscape sheet whose rows x columns grid',
    'produces ~16:9 cells (e.g., 12 cells -> ~4:3 sheet around 2304x1728). Do not force landscape',
    '2560x1440 when cells are portrait — a landscape sheet with a portrait-cell grid cannot host',
    '9:16 cells without crushing them. Preserve the requested final video aspect ratio for every',
    'frame area. After',
    'that image completes, call generate_video once using the generated storyboard board as',
    '@Image1/referenceImageIndices=[0], with skipPromptProcessing=false only when the user',
    'explicitly wants the storyboard text rewritten; otherwise preserve the compiled shot guide',
    'and use skipPromptProcessing=true, expandPrompt=false.',
    '',
    'DO NOT USE generate_image FOR UPLOADED REFERENCE LOOPED VIDEO SEGMENTS: If the user says',
    'the same uploaded image/reference should be reused as the first frame and last frame of each',
    'scripted segment/scene/clip before stitching, they are explicitly asking to animate the',
    'uploaded image, not to generate new storyboard keyframes. Do not call generate_image for',
    'that request. Call animate_photo once with repeated uploaded source indices and per-scene',
    'prompts.',
    '',
    'REUSING RESULTS: When the user asks to redo, retry, or revise (e.g., "try a new version",',
    '"redo the video with X"), reuse the existing source images — do NOT regenerate them unless',
    'the user explicitly asks for new images or describes changes to the images themselves.',
    'Reference the existing result indices from the prior generation. If unsure whether the user',
    'wants new images, ask — don\'t regenerate by default.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'Text description. Put the subject first. Use Dynamic Prompt syntax when numberOfVariations > 1.',
    numberOfVariations: 'Number of distinct outputs. Use Dynamic Prompt {|} syntax to vary one attribute per image. Never put the count in the prompt itself.',
    aspectRatio: 'For ordinary images feeding a video tool, set to match the target video aspect ratio. For composite GPT Image 2 storyboard sheets, default the sheet pixel dimensions to a balanced grid that hosts the target cell aspect natively (portrait video target -> portrait/square sheet, landscape video target -> landscape sheet) unless the user explicitly specifies a storyboard page/canvas/sheet shape; keep the target video ratio inside each frame area.',
  },
};

// ---------------------------------------------------------------------------
// extend_video
// ---------------------------------------------------------------------------
const EXTEND_VIDEO_CONTRACT: PromptContract = {
  contractId: 'extend_video_v1',
  version: '1.0.0',
  toolName: 'extend_video',
  baseDescription: [
    'Use extend_video when a video already exists in the session — whether previously rendered OR',
    'uploaded — and the user asks to make it longer, add a segment, or append a bumper, outro,',
    'intro, tag, or sting to the end (or start). Do NOT call generate_video, animate_photo, or build',
    'a new bumper from scratch via edit_image+animate_photo+stitch_video — those render fresh',
    'clips and either waste the previous render or ignore the uploaded base.',
    '',
    'For uploaded base videos, set videoIndex to a negative number (-1 for first uploaded video).',
    'Set duration to the ADDITIONAL seconds (not the new total).',
    '',
    'Trigger phrases: "make it longer", "extend the video", "add another N seconds", "continue the',
    'scene", "add a bumper/outro/intro/tag/sting to the end (or start)".',
    '',
    'Both extend_video and replace_video_segment auto-detect the base video\'s model (Seedance',
    'source → Seedance continuation; LTX source → LTX continuation; Wan source → Wan continuation), so OMIT videoModel unless',
    'the user explicitly demands a different model. This applies regardless of whether the prior',
    'render came from generate_video, animate_photo, sound_to_video, or video_to_video.',
  ].join('\n'),
  parameterDocs: {
    videoIndex: 'Index of the existing video. Use -1 for first uploaded video, non-negative for generated videos.',
    duration: 'ADDITIONAL seconds to add — not the new total length.',
    videoModel: 'Omit to auto-detect from source video. Only set if user explicitly requests a different model.',
  },
};

// ---------------------------------------------------------------------------
// replace_video_segment
// ---------------------------------------------------------------------------
const REPLACE_VIDEO_SEGMENT_CONTRACT: PromptContract = {
  contractId: 'replace_video_segment_v1',
  version: '1.0.0',
  toolName: 'replace_video_segment',
  baseDescription: [
    'Use replace_video_segment when the user wants to regenerate a specific time range of an',
    'existing video: "regenerate from Xs to Ys", "redo the last N seconds", "swap out the middle",',
    '"fix the [start/middle/end] of the video", or "replace the [bumper/intro/outro/end card/',
    'tag/sting] at the [start/end] of the video". Use explicit startSeconds and endSeconds.',
    'For relative requests like "last 3 seconds", resolve against the known base duration when',
    'duration metadata or prior tool arguments provide it. For "bumper/end card/outro at the end"',
    'without exact seconds, use the known storyboard timing when available; otherwise choose a',
    'small end-card window such as the final 1-3 seconds based on the base duration. If the base',
    'duration/window is genuinely unknown, inspect the video first or ask for the missing window;',
    'do not submit ambiguous placeholder times.',
    '',
    'When the replacement is already another uploaded or generated video clip, still use',
    'replace_video_segment but pass replacementVideoIndex. Example: "splice video 2 into video 1',
    'at 5s" means videoIndex=-1, replacementVideoIndex=-2, startSeconds=5, endSeconds=5.',
    'Use endSeconds=startSeconds for insertion; use a wider endSeconds only when the user says to',
    'replace/remove that base-video range. Do not use stitch_video for "into the middle"/"insert"',
    'requests, because stitch_video only concatenates full clips end-to-end.',
    '',
    'For time-sliced interleaving from existing videos — "alternate 1s from each video", "weave',
    'one-second clips from video 1 and video 2", "cut back and forth every N seconds" — do NOT',
    'use stitch_video and do NOT omit replacementVideoIndex. Start with the first requested video',
    'as the base, then call replace_video_segment once for each window that should come from the',
    'other video. Set replacementVideoIndex to that other existing video and set',
    'replacementStartSeconds/replacementEndSeconds to the next source slice from that',
    'replacement video. For ordinary',
    'alternation, preserve the base duration: set endSeconds=startSeconds+sliceDuration, not',
    'endSeconds=startSeconds insertion, unless the user explicitly asks to lengthen the output by',
    'inserting extra slices. Skip no-op windows that already come from the base video; only splice',
    'windows that should come from a different source. Example for two 10s uploads alternating every 1s starting with video',
    '1: replace base windows 1..2, 3..4,',
    '5..6, 7..8, and 9..10 with slices 0..1, 1..2, 2..3, 3..4, and 4..5 from video 2. After',
    'each successful splice, target the newest composite video index for the next splice.',
    'The -1 time sentinel applies only to base startSeconds/endSeconds when the base duration is',
    'unknown. Never use -1 for replacementStartSeconds or replacementEndSeconds; source windows',
    'must use concrete non-negative seconds. For uploaded/generated videos with duration metadata,',
    'use that known duration directly; do not call analyze_video just to learn the clip length for',
    'routine alternating slices. Do not add a final tail splice with an unknown source end — stop at',
    'the known clip duration or skip a no-op tail window.',
    '',
    'Do NOT call generate_video or animate_photo to re-render an existing video just to change',
    'part of it (the bumper, the intro, the end card, a single scene, the last few seconds, etc.).',
    'Use replace_video_segment — it preserves the unchanged portion, keeps the original audio',
    'outside the replaced window, and costs far less.',
    '',
    'Auto-detects the base video\'s model, so OMIT videoModel unless the user explicitly demands',
    'a different model. Short requested windows are supported by rendering with model-specific',
    'handles and trimming the rendered clip before splicing, so still pass the user\'s exact',
    'startSeconds/endSeconds.',
  ].join('\n'),
  parameterDocs: {
    startSeconds: 'Start of segment to replace in seconds. Use -1 sentinel if exact base duration is unknown.',
    endSeconds: 'End of segment to replace in seconds. Use the same value as startSeconds for insertion with replacementVideoIndex.',
    replacementVideoIndex: 'Existing uploaded/generated replacement clip. Use negative uploaded-video indices, e.g. -2 for the second uploaded video.',
    replacementStartSeconds: 'Optional start time inside replacementVideoIndex. Use with replacementEndSeconds for time-sliced interleaving. Must be concrete and >= 0; never use -1 here.',
    replacementEndSeconds: 'Optional end time inside replacementVideoIndex. Must be concrete, >= 0, and greater than replacementStartSeconds; never use -1 here.',
    videoModel: 'Omit to auto-detect from source. Only set if user explicitly requests a different model.',
  },
};

// ---------------------------------------------------------------------------
// overlay_video
// ---------------------------------------------------------------------------
const OVERLAY_VIDEO_CONTRACT: PromptContract = {
  contractId: 'overlay_video_v1',
  version: '1.0.0',
  toolName: 'overlay_video',
  baseDescription: [
    'Use overlay_video when the user wants to overlay/place/show a logo, text, caption, or',
    'watermark ON TOP OF existing video frames.',
    '',
    'For uploaded base videos, set sourceVideoIndex=-1; for generated videos, use their',
    'non-negative video index. If the overlay should last only part of the video, set the overlay',
    'item\'s startSeconds/endSeconds (e.g. a 2s middle overlay on a 20s video: ~9s to ~11s).',
    'Negative startSeconds/endSeconds are relative to the end of the base video, so startSeconds=-2',
    'with omitted endSeconds means the last 2 seconds.',
    '',
    'When the user asks to replace a video time window with an uploaded still image, screenshot,',
    'photo, frame, logo, or graphic, use an image overlay for that window with widthPct=100 and',
    'fit="cover"; do not regenerate the video segment.',
    '',
    'Do NOT use overlay_video for intro/outro/bumper/end-card/start-card requests — those add or',
    'regenerate video time and should use extend_video or replace_video_segment. After a successful',
    'overlay_video call, finalize the turn; do not call overlay_video again just to tweak default',
    'size or placement unless the user asks.',
  ].join('\n'),
  parameterDocs: {
    sourceVideoIndex: 'Use -1 for first uploaded video, non-negative index for generated videos.',
    overlays: 'Use startSeconds/endSeconds for time windows. For still/screenshot replacement windows, use kind="image", widthPct=100, fit="cover".',
  },
};

// ---------------------------------------------------------------------------
// stitch_video
// ---------------------------------------------------------------------------
const STITCH_VIDEO_CONTRACT: PromptContract = {
  contractId: 'stitch_video_v1',
  version: '1.0.0',
  toolName: 'stitch_video',
  baseDescription: [
    'stitch_video joins multiple video clips into one. Reference generated videos by their',
    '0-based video indices (from videoStartIndex in prior tool results). Reference uploaded',
    'videos with negative indices in current UI order: -1 = first uploaded video, -2 = second, etc.',
    'When the user asks to stitch these/all uploaded videos and does not name a different order,',
    'use the current UI order exactly: [-1,-2,...].',
    'If the user explicitly names a different playback order, preserve that requested order exactly;',
    'do not rewrite it back to UI order.',
    '',
    'NEVER tell the user to "upload" a video that was already generated in this conversation —',
    'stitch_video can reference them directly by index.',
    '',
    'When stitching results from a batch video tool, use ONLY the video indices actually returned',
    'by that tool. Do not infer the stitch list from the number of source images, keyframes, or',
    'storyboard panels. Example: if 5 uploaded keyframes create 4 adjacent animate_photo',
    'transition clips and the tool result returns videos at indices 0,1,2,3, call stitch_video',
    'with videoIndices=[0,1,2,3] — never include index 4 unless a fifth video was returned.',
    '',
    'Do not use stitch_video for alternating/interleaved time slices such as "alternate',
    '1s from each video"; stitch_video joins whole clips end-to-end, while interleaving existing',
    'video slices belongs to repeated replace_video_segment calls with replacementVideoIndex and',
    'replacementStartSeconds/replacementEndSeconds.',
    '',
    'Note: video_to_video requires an actual uploaded video file and cannot use generated video',
    'indices. Do not claim exact final runtime, dimensions, or aspect ratio after a tool finishes',
    'unless that value was explicitly requested by the user or explicitly returned by the tool.',
  ].join('\n'),
  parameterDocs: {
    videoIndices: 'Ordered source video indices. Use non-negative generated-video indices from prior tool results; use negative uploaded-video indices in current UI order (-1 first uploaded video, -2 second, etc.).',
  },
};

// ---------------------------------------------------------------------------
// sound_to_video
// ---------------------------------------------------------------------------
const SOUND_TO_VIDEO_CONTRACT: PromptContract = {
  contractId: 'sound_to_video_v1',
  version: '1.0.0',
  toolName: 'sound_to_video',
  baseDescription: [
    'sound_to_video creates audio-synced video from an audio source. Works with uploaded audio',
    'files (mp3, m4a, wav) OR previously generated music from generate_music (auto-detected).',
    '',
    'When the user asks to "turn that song/music into a video" after generate_music, use',
    'sound_to_video — it will automatically find the generated audio.',
    '',
    'For music visualization (syncing video to a specific song or audio track), use the',
    'generate_music → sound_to_video pipeline. Do NOT use animate_photo or generate_video for',
    'audio-driven visualization.',
    '',
    'animate_photo and generate_video produce audio natively via LTX 2.5 or LTX 2.3 — never',
    'pre-generate audio for those tools. sound_to_video is only for when the audio IS the primary creative',
    'input driving the video output.',
    '',
    'PERSONA VOICE CLIPS: Persona voice clips returned by resolve_personas are voice identity',
    'references for LTX Audio ID, not audio tracks to synchronize. If the user explicitly asks',
    'for a registered/persona/reference voice or voice clone, call resolve_personas first, then',
    'use generate_video with ltx23 and voicePersonaName when there is no image source, or',
    'animate_photo with ltx23 and voicePersonaName when an image/source frame should be',
    'animated. Do not call sound_to_video for a persona voice clip unless a separate uploaded',
    'audio track is the primary sync driver.',
  ].join('\n'),
  parameterDocs: {
    audioSource: 'Uploaded audio file or reference to a prior generate_music result. Auto-detected when omitted after generate_music.',
  },
};

// ---------------------------------------------------------------------------
// dance_montage
// ---------------------------------------------------------------------------
const DANCE_MONTAGE_CONTRACT: PromptContract = {
  contractId: 'dance_montage_v1',
  version: '1.0.0',
  toolName: 'dance_montage',
  baseDescription: [
    'dance_montage creates dance videos from an uploaded photo. Dance video requests from an',
    'uploaded photo go directly to dance_montage; do not call edit_image/generate_image first',
    'unless the user explicitly asks for a new look, outfit, generated character/image, variations,',
    'or persona identity prep.',
    '',
    'Dance preset/vibe words like "Barbie", "Metric", "Black Sheep", "Rasputin", or "TikTok" are',
    'not image-prep requests by themselves.',
    '',
    'SELECTION-GATED DANCE FLOW: If the user asks for N image options and says they will pick',
    'one before the dance video, generate the image options first (generate_image or edit_image',
    'with numberOfVariations=N), then stop and wait for the user to choose before calling',
    'dance_montage.',
  ].join('\n'),
  parameterDocs: {
    sourceImageIndex: 'Use the uploaded photo directly (-1). Only use a generated image index if the user explicitly requested a new image first.',
  },
};

// ---------------------------------------------------------------------------
// generate_music
// ---------------------------------------------------------------------------
const GENERATE_MUSIC_CONTRACT: PromptContract = {
  contractId: 'generate_music_v1',
  version: '1.1.0',
  toolName: 'generate_music',
  baseDescription: [
    'generate_music creates music tracks with optional lyrics, BPM, key, and style control.',
    '',
    'MUSIC CREATIVE BRIEF: Identify purpose before composing: full song, short social hook,',
    'jingle, trailer score, background underscore, sonic logo, music video cue, or lyric video.',
    'Define genre, mood, tempo/BPM, energy curve, instrumentation, vocal style, lyrical point of',
    'view, hook phrase, section structure, and production notes. Lyrics should be original,',
    'singable, sectioned, rhythmically clear, and have a memorable hook. Brand music should make',
    'the brand easier to remember without stuffing the name into every line.',
    '',
    'For music visualization (syncing the generated track to video), chain generate_music →',
    'sound_to_video. Do NOT use animate_photo or generate_video for audio-driven visualization.',
    '',
    'After generate_music, if the user asks to "turn that song into a video" or similar, call',
    'sound_to_video next — it auto-detects the latest generated music track.',
  ].join('\n'),
  parameterDocs: {},
};

// ---------------------------------------------------------------------------
// generate_speech
// ---------------------------------------------------------------------------
const GENERATE_SPEECH_CONTRACT: PromptContract = {
  contractId: 'generate_speech_v1',
  version: '1.0.0',
  toolName: 'generate_speech',
  baseDescription: [
    'generate_speech reads written words aloud. It is text-to-speech, not music: use',
    'generate_music for songs, instrumentals and jingles.',
    '',
    'THE PROMPT IS THE SCRIPT. Unlike every image and video tool, prompt is not a description',
    'of the output — it is the literal text to be spoken, character for character. Writing "a',
    'calm woman reading the news" produces a voice saying those seven words. Put the delivery in',
    'voiceDescription and the actual copy in prompt.',
    '',
    'WRITE THE SCRIPT WHEN THE USER DOES NOT. "Read me a haiku about rain", "record a podcast',
    'intro" and "say something reassuring" are requests for words you compose and then speak.',
    'Compose the line and pass it as prompt. Reach for compose_script only for a long or',
    'structured piece; a sentence or two is yours to write.',
    '',
    'PICK THE MODEL FROM WHAT THE USER GAVE YOU. A voice clip uploaded with "make it sound like',
    'me" is model="clone" with voiceSourceIndex pointing at that upload. A described speaker who',
    'does not exist ("an old lighthouse keeper") is model="design" with voiceDescription. Anything',
    'else is model="voice" — choose a voice from the roster and, if the user described a mood or',
    'a delivery, put that in voiceDescription too.',
    '',
    'CLONING QUALITY. Set voiceTranscript whenever the words in the uploaded clip are known: it',
    'is the difference between a close clone and a loose one. Tell the user if their reference is',
    'shorter than three seconds, has music under it, or has two people talking — those are the',
    'three reasons a clone comes back sounding wrong.',
    '',
    'PUNCTUATION IS PROSODY. Keep full stops, commas and question marks; they are the only pause',
    'and intonation control there is. Spell out numbers, dates and abbreviations the way they',
    'should be read when the written form is ambiguous.',
    '',
    'To put speech over video, generate it here and then call sound_to_video with the result.',
    'Do not use animate_photo or generate_video to "say" a line of provided text.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'The literal words to speak, verbatim. Not a description of the audio.',
    voiceDescription:
      'Delivery direction for model="voice"; the speaker to invent for model="design". Never sent with model="clone".',
    voiceSourceIndex:
      'Index of the uploaded voice clip to clone (0-based, same numbering as other tools use for audio). Required for model="clone".',
    voiceTranscript:
      'What the uploaded clip says. Optional, but it makes the clone markedly closer to the source.',
  },
};

// ---------------------------------------------------------------------------
// resolve_personas
// ---------------------------------------------------------------------------
const RESOLVE_PERSONAS_CONTRACT: PromptContract = {
  contractId: 'resolve_personas_v1',
  version: '1.0.0',
  toolName: 'resolve_personas',
  baseDescription: [
    'resolve_personas is the required first step when the user explicitly names a saved Persona',
    'or says to use a Persona Image, Persona reference photo, Persona Voice, registered voice,',
    'or voice clone. Do not answer in prose, ask a follow-up, or finalize before calling this',
    'tool when a listed Persona name is present.',
    '',
    'DIRECT PERSONA IMAGE / VOICE VIDEO: If the user says to use the Persona image/reference',
    'directly/originally, call resolve_personas first, then call animate_photo using the injected',
    'persona photo as an uploaded image index. For one named Persona, use sourceImageIndex=-1',
    'or sourceImageIndices=[-1,...] for a multi-clip batch. If Persona Voice was explicitly',
    'requested, set voicePersonaName to the exact resolved Persona name and use ltx23. Use',
    'animate_photo when an image/source frame should be animated. Use generate_video with',
    'ltx23 when the user requested a persona voice video but no image source exists yet.',
    'Do not call sound_to_video for Persona voice clips; they are voice identity references,',
    'not the audio track to synchronize. Do not generate a new image first when the user',
    'explicitly requested the existing Persona image directly.',
    '',
    'MULTI-CLIP PERSONA BATCHES: If the user asks for several separate clips from the same',
    'Persona Image, make one animate_photo call after resolve_personas with repeated persona',
    'source indices, one prompt per clip, and the requested per-clip duration. If the user asks',
    'to stitch the clips, call stitch_video with the returned video indices after animate_photo.',
    '',
    'PERSONA IMAGE GENERATION: After resolving persona reference photos for a new persona image,',
    'use edit_image rather than generate_image. Krea 2 Identity Edit and Dark Beast Krea 2 Identity',
    'Edit are available edit_image model choices when the request needs strong identity preservation',
    'from one or two reference photos; use concise identity locks and keep within the two-reference',
    'limit.',
  ].join('\n'),
  parameterDocs: {
    names: 'Persona names to load. Use the exact listed Persona name; call this before any Persona image/voice video or image generation.',
  },
};

// ---------------------------------------------------------------------------
// map_assets_for_model
// ---------------------------------------------------------------------------
const MAP_ASSETS_FOR_MODEL_CONTRACT: PromptContract = {
  contractId: 'map_assets_for_model_v1',
  version: '1.0.0',
  toolName: 'map_assets_for_model',
  baseDescription: [
    'map_assets_for_model is an inspection helper for previously generated asset-manifest entries',
    'when you need exact model_ref tokens for a later prompt.',
    '',
    'Do NOT call this for ordinary uploaded image references. If the user uploaded images and',
    'asks GPT Image 2 to use all uploaded assets as visual references, call edit_image directly',
    'with sourceImageIndex=-1 and describe the uploaded assets/roles in the prompt. Uploaded',
    'reference images are already available to edit_image/generate_image; mapping them first',
    'wastes a tool round and may violate direct-generation requests.',
    '',
    'Use this helper only when a previous tool result produced assets in the manifest and the',
    'next prompt must name those prior generated assets with provider-specific tokens.',
    '',
    'Context-conditioned image/edit models such as LTX 2.5, LTX 2.3, Wan, Qwen Image Edit, Krea 2 Identity',
    'Edit, and Dark Beast Krea 2 Identity Edit use zero-indexed model_ref tokens like',
    'context_image_0 and context_image_1. Use the helper output instead of hand-formatting those tokens.',
  ].join('\n'),
  parameterDocs: {
    model_id: 'Target model for prior generated manifest refs. Do not use for plain uploaded references.',
  },
};

// ---------------------------------------------------------------------------
// restore_photo
// ---------------------------------------------------------------------------
const RESTORE_PHOTO_CONTRACT: PromptContract = {
  contractId: 'restore_photo_v1',
  version: '1.0.0',
  toolName: 'restore_photo',
  baseDescription: [
    'restore_photo edits or restores the ORIGINAL uploaded photograph. Use this for the first',
    'restoration/edit on an upload, or when the user explicitly asks to start over from the',
    'original/source photo. Use refine_result for follow-up edits to an existing generated result.',
    '',
    'For photos with people, front-load identity preservation before the restoration or edit.',
    'Use positive constraints such as preserve exact facial likeness, face structure, apparent',
    'age, pose, and composition. End with preservation of unmentioned details.',
    '',
    'Use Dynamic Prompt syntax only when the user explicitly asks to compare multiple restoration',
    'approaches. Default restoration batches should keep the same prompt and vary only by seed.',
    'If the user only wants a larger, higher-resolution copy without restoration or other creative',
    'changes, use upscale_image instead. restore_photo is a generative edit and is not a substitute',
    'for deterministic upscaling.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'Natural-language edit/restoration prompt. Start with identity preservation for people, then requested restoration/edit, then preserve unmentioned details.',
    numberOfVariations: 'Use 1 unless the user explicitly asks for multiple outputs or comparison options.',
    scale: 'Set only when the user asks to upscale, enlarge, or increase resolution.',
    quality: 'Omit unless the user explicitly asks for fast or high quality.',
  },
};

// ---------------------------------------------------------------------------
// upscale_image
// ---------------------------------------------------------------------------
const UPSCALE_IMAGE_CONTRACT: PromptContract = {
  contractId: 'upscale_image_v1',
  version: '1.1.0',
  toolName: 'upscale_image',
  baseDescription: [
    'upscale_image performs promptless, deterministic NVIDIA RTX VSR enlargement of exactly one',
    'uploaded or generated image. Use it when the user asks for a larger copy, higher resolution,',
    '2x/3x/4x enlargement, 4K/8K/16K output, or more pixels while preserving the source composition.',
    '',
    'Do not invent a prompt and do not route a pure upscale through restore_photo, refine_result,',
    'edit_image, or apply_style. Those tools are generative and can change image content.',
    '',
    'Omit sourceImageIndex to use the latest generated image, falling back to the first upload.',
    'Use zero-based non-negative indices for generated results; -1 selects the first upload and',
    '-2 the second upload. Set either scale (2, 3, or 4) or targetLongestEdge (512-15360).',
    'targetLongestEdge takes precedence. Never request a target at or below the source size.',
    'Both 8px-aligned output edges must remain between 512 and 15360px. If a wide or tall source',
    'needs a larger target to preserve its aspect ratio, use the minimum target returned by the tool.',
  ].join('\n'),
  parameterDocs: {
    sourceImageIndex: 'Omit for the latest generated image, then first upload. Generated results are zero-based; -1/-2 select uploaded images.',
    scale: 'Integer enlargement factor 2, 3, or 4. Defaults to 2 and is ignored when targetLongestEdge is set. A too-small result is rejected rather than stretched to the 512px edge minimum.',
    targetLongestEdge: 'Explicit output longest edge in pixels, 512-15360. Use 7680 for 8K or 15360 for the 16K maximum. It must be larger than the source, and large enough that the other 8px-aligned edge remains at least 512px; aspect ratio is preserved.',
  },
};

// ---------------------------------------------------------------------------
// upscale_video
// ---------------------------------------------------------------------------
const UPSCALE_VIDEO_CONTRACT: PromptContract = {
  contractId: 'upscale_video_v1',
  version: '1.1.0',
  toolName: 'upscale_video',
  baseDescription: [
    'upscale_video performs promptless, deterministic FlashVSR super-resolution of exactly one',
    'uploaded or generated video. Use it when the user asks to upscale, enlarge, sharpen, or increase',
    'the resolution of an existing video, or wants a 1080p, 1440p, 2K, or HD copy of it. The output',
    'keeps every source frame, the exact frame rate, the full aspect ratio, and the original audio.',
    '',
    'Do not invent a prompt and do not route a pure video upscale through video_to_video,',
    'generate_video, extend_video, or replace_video_segment; those tools re-render or edit content.',
    'Use video_to_video only when the user explicitly names a generative model such as Seedance for',
    'the re-render. Do not use upscale_image for videos.',
    '',
    'Omit sourceVideoIndex to use the latest generated video, falling back to the most recent upload.',
    'Use zero-based non-negative indices for generated videos; -1 selects the first uploaded video',
    'and -2 the second. targetResolution is the output short edge: omit it for 1440p (or 1080p when',
    'the source is too small for 1440p), and set 1080 when the user asks for 1080p or Full HD.',
    'The output is at most twice the source size, so 1440p needs a source short edge of 720-768px',
    'and 1080p needs 540-768px. Sources must also be at most about 1344x768 pixels (768x1344 in',
    'portrait), 1-60 fps, and 100 MB. The server sets the maximum clip length and rejects a source',
    'that is too long; never quote a length limit yourself. If the tool reports that the source is too',
    'long or outside these limits, relay that error to the user instead of switching to a generative',
    'video tool. It cannot produce 4K or any size above 1440p: when the user asks for one, say so and',
    'offer 1440p instead of silently delivering less.',
    '',
    'The defaults give the most stable result. Set detailPreference to sharper only when the user',
    'asks for a sharper, crisper, or more detailed upscale, and processingSpeed to faster only when',
    'they ask for a quicker one. Leave seed out unless the user gives a seed or asks for a different',
    'or random variation (-1 is random). None of these options changes the price.',
  ].join('\n'),
  parameterDocs: {
    sourceVideoIndex: 'Omit for the latest generated video, then the most recent upload. Generated videos are zero-based; -1/-2 select uploaded videos.',
    targetResolution: 'Output short edge in pixels: 1440 or 1080. Omit for the default (1440, or 1080 for sources under 720px); set 1080 when the user asks for 1080p or Full HD.',
    detailPreference: 'stable (default) or sharper. Set sharper only when the user asks for a sharper, crisper, or more detailed result.',
    processingSpeed: 'stable (default) or faster. Set faster only when the user asks for a quicker upscale.',
    seed: 'Omit for the repeatable default 0. -1 is random; otherwise an integer 0-4294967295 the user gave.',
  },
};

// ---------------------------------------------------------------------------
// apply_style
// ---------------------------------------------------------------------------
const APPLY_STYLE_CONTRACT: PromptContract = {
  contractId: 'apply_style_v1',
  version: '1.0.0',
  toolName: 'apply_style',
  baseDescription: [
    'apply_style transfers an artistic style, era, franchise, medium, or photographic look onto',
    'an uploaded or generated image. It automatically uses the latest result unless the user',
    'specifies a result number or asks for the original upload.',
    '',
    'Transfer visual style only. Do not let a style reference override identity, pose, or',
    'composition unless the user asked for those changes. For people, state identity preservation',
    'before the style instructions and finish by preserving pose and composition.',
    '',
    'Use refine_result instead when the user wants a targeted non-style edit to an existing',
    'result. Use restore_photo only when they explicitly want to restart from the original upload.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'Style-transfer prompt. Name the style/era/artist/franchise and preserve identity, pose, and composition for people.',
    sourceImageIndex: 'Omit for the latest result. Use -1 only when the user explicitly says original/source upload.',
    scale: 'Set only when the user asks to upscale, enlarge, or increase resolution.',
  },
};

// ---------------------------------------------------------------------------
// refine_result
// ---------------------------------------------------------------------------
const REFINE_RESULT_CONTRACT: PromptContract = {
  contractId: 'refine_result_v1',
  version: '1.0.0',
  toolName: 'refine_result',
  baseDescription: [
    'refine_result is the default follow-up image-edit tool after generated results exist. Use it',
    'for targeted changes to a prior result: color, brightness, sharpening, background changes,',
    'object edits, further restoration, or small creative adjustments.',
    '',
    'Describe only the delta. The source image already contains the subject, composition, and',
    'most details. Do not rewrite the whole image unless the user asks for a broad transformation.',
    'For people, front-load exact identity preservation and end with preserving all unmentioned',
    'details.',
    '',
    'Use restore_photo instead only when the user explicitly asks to start over from the original',
    'upload. Use sourceImageIndex only when the user names a specific result.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'Targeted delta instruction. Preserve identity first for people, then specify the change, then preserve everything else.',
    sourceImageIndex: 'Omit for the latest relevant result unless the user names a specific image number.',
    numberOfVariations: 'Use 1 unless the user asks to compare multiple refinement options.',
  },
};

// ---------------------------------------------------------------------------
// change_angle
// ---------------------------------------------------------------------------
const CHANGE_ANGLE_CONTRACT: PromptContract = {
  contractId: 'change_angle_v1',
  version: '1.0.0',
  toolName: 'change_angle',
  baseDescription: [
    'change_angle creates a new still image from a different camera perspective. Use when the',
    'user asks for a left/right/back/three-quarter/front view, elevated/low-angle view, close-up,',
    'medium shot, or wide shot of an existing image subject.',
    '',
    'The description must be exactly one azimuth, one elevation, and one distance phrase in the',
    'tool schema format. Default unspecified elevation to eye-level shot and distance to medium',
    'shot. Use the latest result unless the user specifies another source or says original.',
    '',
    'Use orbit_video for a full video orbit. Do not pre-generate angles for orbit_video; that tool',
    'owns its own angle pipeline.',
  ].join('\n'),
  parameterDocs: {
    description: 'Exact format: "[azimuth] [elevation] [distance]". Pick one value from each schema category.',
    sourceImageIndex: 'Omit for latest result. Use -1 only when the user explicitly says original/source upload.',
    loraStrength: 'Omit unless the user explicitly asks to control the strength of the angle change.',
  },
};

// ---------------------------------------------------------------------------
// video_to_video
// ---------------------------------------------------------------------------
const VIDEO_TO_VIDEO_CONTRACT: PromptContract = {
  contractId: 'video_to_video_v1',
  version: '1.1.0',
  toolName: 'video_to_video',
  baseDescription: [
    'video_to_video transforms an uploaded video. Use for uploaded-video restyling, generative',
    'enhancement or remastering, motion transfer from video to image, subject replacement, edge/pose/',
    'depth-guided restyle, or explicit Seedance V2V transforms. Wan 3 is not a V2V model;',
    'its video inputs are loose references for new generation through generate_video.',
    'For a pure resolution upscale (a sharper 1080p, 1440p, 2K, or HD copy of the same video),',
    'use upscale_video instead; it is promptless and keeps every frame, the frame rate, and the audio.',
    '',
    'This tool requires an uploaded video source. Do not use it for generated video indices. For',
    'generated or uploaded partial edits use replace_video_segment; for appended time use',
    'extend_video; for logos/text overlays use overlay_video; for stitching use stitch_video.',
    '',
    'Choose controlMode by intent. Use detailer for generative detail enhancement without restyling',
    'when the user wants the content re-rendered rather than only more resolution.',
    'Use seedance-v2v only when the user asks to transform/enhance/remaster an uploaded video',
    'with Seedance, including uploaded-video upscale/remaster requests that name Seedance. For detailer,',
    'describe the original scene plus quality terms, not new content.',
    'Use outpaint to extend/expand the frame or change aspect ratio (positional, mask-free); set',
    'outpaintPosition and optionally outpaintAspectRatio. Use inpaint to regenerate a region',
    'while preserving the rest. If the user supplied a mask, set maskImageIndex; otherwise',
    'omit maskImageIndex so execution derives one from the source video and prompt.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'Describe the target appearance in present tense. For detailer, describe the original content plus quality qualifiers only. For outpaint, describe what fills the new area; for inpaint, describe only the masked region.',
    videoSourceIndex: 'Uploaded video index. Omit when there is one uploaded video; use 0 for first uploaded video or -1 if using negative upload notation.',
    controlMode: 'Pick from intent: detailer for generative enhancement, seedance-v2v for explicit Seedance V2V, canny/depth for video-only control restyles, pose for motion transfer onto a reference-image subject, animate-move/replace for WAN Animate, outpaint to extend/expand the canvas, inpaint to regenerate a masked region.',
    sourceImageIndex: 'Required for animate-move, animate-replace, and pose when more than one image is available; the sole reference image may be auto-selected. LTX pose always needs a reference image. Ignored by canny, depth, detailer, outpaint, and inpaint.',
    outpaintPosition: 'outpaint only. Where the original frame sits in the expanded canvas (center/top/bottom/left/right); determines grow direction. Default center.',
    outpaintAspectRatio: 'outpaint only, optional. Target aspect ratio (e.g. 16:9) for the expanded canvas; the canvas only grows, never crops. Set only when the user names a target shape/orientation.',
    maskImageIndex: 'inpaint only, optional. 0-based index of an uploaded mask image (white = regenerate, black = preserve). Omit when the user did not provide a mask.',
    duration: 'Set only when the user requests a different output length; otherwise let the tool match/cap the source duration.',
  },
};

// ---------------------------------------------------------------------------
// add_subtitles
// ---------------------------------------------------------------------------
const ADD_SUBTITLES_CONTRACT: PromptContract = {
  contractId: 'add_subtitles_v1',
  version: '1.0.0',
  toolName: 'add_subtitles',
  baseDescription: [
    'add_subtitles burns caller-supplied subtitles, captions, lyrics, or on-screen dialogue into',
    'an existing video. Use this when the user provides cue text/timing, pastes SRT/VTT, or asks',
    'to add known caption lines to a generated or uploaded video.',
    '',
    'Do not use auto_transcribe. Speech-to-text is not enabled; when the user has not supplied',
    'subtitle text or timing, ask for the cue text/timing instead of calling this tool.',
    '',
    'Exception: if the user explicitly authorizes invented caption copy with language like',
    '"make them up", "write captions", "invent subtitles", or "add funny captions", create a few',
    'short generic cue lines yourself and call add_subtitles. Do not ask for exact wording when',
    'the user has asked you to author the captions.',
    '',
    'Split subtitles into multiple short cues. Do not burn one paragraph across the whole clip.',
    'Use overlay_video instead for static title cards, labels, logos, watermarks, or non-timed text.',
  ].join('\n'),
  parameterDocs: {
    sourceVideoIndex: 'Non-negative generated video index or negative uploaded video index. Omit/default to the latest relevant video.',
    cues: 'Multiple short cues with startSeconds, endSeconds, and text. Prefer 1.5-4 seconds per cue.',
    srt: 'Full SRT/VTT string. Provide either srt or cues, not both.',
    auto_transcribe: 'Do not set. Ask the user for subtitle text/timing until STT is available.',
  },
};

// ---------------------------------------------------------------------------
// analyze_image
// ---------------------------------------------------------------------------
const ANALYZE_IMAGE_CONTRACT: PromptContract = {
  contractId: 'analyze_image_v1',
  version: '1.0.0',
  toolName: 'analyze_image',
  baseDescription: [
    'analyze_image answers questions about image content, OCR, objects, style, documents, or',
    'comparisons. It does not generate or modify media.',
    '',
    'Use only when the user asks to inspect, describe, read, compare, or reason about an image.',
    'Do not insert it as a quality-control step inside generation workflows unless the user',
    'explicitly asks for analysis before continuing.',
    '',
    'For uploaded images, negative indices refer to the upload order. For compare mode, provide',
    'both sourceImageIndex and compareImageIndex.',
  ].join('\n'),
  parameterDocs: {
    query: 'Specific question/request about the image. Preserve the user question directly.',
    analysisType: 'Pick describe, ocr, objects, document, compare, or general based on the user request.',
    sourceImageIndex: 'Omit to auto-select latest result or original upload. Use -1 for first uploaded image.',
    compareImageIndex: 'Second image for compare mode. Use negative uploaded-image indices when comparing uploads.',
  },
};

// ---------------------------------------------------------------------------
// analyze_video
// ---------------------------------------------------------------------------
const ANALYZE_VIDEO_CONTRACT: PromptContract = {
  contractId: 'analyze_video_v1',
  version: '1.0.0',
  toolName: 'analyze_video',
  baseDescription: [
    'analyze_video uses sampled frames to answer questions about an uploaded or generated video:',
    'summary, timeline, visual scene description, action breakdown, or visible text.',
    '',
    'Use only when the user asks to inspect or understand a video. Do not call it as automatic',
    'verification after generation, and do not use it before stitch_video when the requested',
    'generation pipeline should continue.',
    '',
    'This is visual sampled-frame analysis only. It does not transcribe audio and does not inspect',
    'every frame.',
  ].join('\n'),
  parameterDocs: {
    query: 'Specific question/request about the video. State whether summary, timeline, OCR, scene, or action detail is needed.',
    analysisType: 'Pick summary, timeline, scene, action, ocr, or general based on the user request.',
    sourceVideoIndex: 'Generated video index or negative uploaded-video index. Omit to auto-select latest generated video or first upload.',
  },
};

// ---------------------------------------------------------------------------
// extract_metadata
// ---------------------------------------------------------------------------
const EXTRACT_METADATA_CONTRACT: PromptContract = {
  contractId: 'extract_metadata_v1',
  version: '1.0.0',
  toolName: 'extract_metadata',
  baseDescription: [
    'extract_metadata reads prompt/model/settings metadata from an uploaded media file. Use when',
    'the user asks what prompt, model, seed, dimensions, or generation settings are embedded in',
    'an uploaded file, or when they ask to recreate/remix an uploaded file from its metadata.',
    '',
    'This indexes uploaded files only, not prior generated results already known to chat. Do not',
    'call it for ordinary visual analysis; use analyze_image or analyze_video for content.',
  ].join('\n'),
  parameterDocs: {
    file_index: '0-based uploaded-file index. Omit for the first uploaded file.',
  },
};

// ---------------------------------------------------------------------------
// manage_memory
// ---------------------------------------------------------------------------
const MANAGE_MEMORY_CONTRACT: PromptContract = {
  contractId: 'manage_memory_v1',
  version: '1.0.0',
  toolName: 'manage_memory',
  baseDescription: [
    'manage_memory reads, writes, or deletes persistent user preferences and facts. Use write',
    'only when the user states a durable preference/fact or explicitly asks you to remember',
    'something. Use read when persistent preferences are relevant before generation.',
    '',
    'Do not save transient one-off creative instructions as memory. Delete/clear actions require',
    'explicit user intent; never infer memory deletion from vague dissatisfaction.',
  ].join('\n'),
  parameterDocs: {
    action: 'read, write, or delete. Use write only for durable preferences/facts; delete only on explicit request.',
    key: 'Stable concise memory key. Required for write/delete.',
    value: 'Concise durable value. Required for write.',
    category: 'preference for style/defaults, fact for user facts, context for project context.',
  },
};

// ---------------------------------------------------------------------------
// set_content_filter
// ---------------------------------------------------------------------------
const SET_CONTENT_FILTER_CONTRACT: PromptContract = {
  contractId: 'set_content_filter_v1',
  version: '1.0.0',
  toolName: 'set_content_filter',
  baseDescription: [
    'set_content_filter enables or disables the Safe Content Filter. Call only when the user',
    'explicitly asks to change this setting. Do not toggle it as part of ordinary generation.',
    '',
    'If disabling requires host-side confirmation, let the handler surface that permission flow;',
    'do not claim the setting changed unless the tool result says it did.',
  ].join('\n'),
  parameterDocs: {
    enabled: 'true to enable the filter, false to disable it. Only set from explicit user intent.',
  },
};

// ---------------------------------------------------------------------------
// create_asset_manifest
// ---------------------------------------------------------------------------
const CREATE_ASSET_MANIFEST_CONTRACT: PromptContract = {
  contractId: 'create_asset_manifest_v1',
  version: '1.0.0',
  toolName: 'create_asset_manifest',
  baseDescription: [
    'create_asset_manifest resets and seeds the session asset manifest with stable asset_id',
    'records. Use at the start of workflows with multiple named uploaded/generated assets that',
    'will need durable references across later prompts.',
    '',
    'Do not call this just to use ordinary uploaded images in edit_image/generate_image; those',
    'tools can already reference uploads. Resetting discards prior manifest entries.',
  ].join('\n'),
  parameterDocs: {
    assets: 'Ordered assets to register. Each needs user_label and type; include must_preserve/avoid only when they matter later.',
  },
};

// ---------------------------------------------------------------------------
// inspect_asset
// ---------------------------------------------------------------------------
const INSPECT_ASSET_CONTRACT: PromptContract = {
  contractId: 'inspect_asset_v1',
  version: '1.0.0',
  toolName: 'inspect_asset',
  baseDescription: [
    'inspect_asset returns one manifest asset or the whole manifest. Use when the current',
    'manifest state is unclear before referring to a generated asset by asset_id/user_label.',
    '',
    'Do not call it for ordinary uploaded references that the generation tools can use directly,',
    'and do not use it as a substitute for analyze_image/analyze_video content inspection.',
  ].join('\n'),
  parameterDocs: {
    asset_id: 'Stable internal asset id. Prefer this when known.',
    user_label: 'Human label to look up case-insensitively when asset_id is not known.',
  },
};

// ---------------------------------------------------------------------------
// label_asset
// ---------------------------------------------------------------------------
const LABEL_ASSET_CONTRACT: PromptContract = {
  contractId: 'label_asset_v1',
  version: '1.0.0',
  toolName: 'label_asset',
  baseDescription: [
    'label_asset updates the label, description, URL, must_preserve, or avoid fields for an',
    'existing manifest asset. Use when the user renames an asset, assigns a role, or when a',
    'previous tool result adds durable reference constraints.',
    '',
    'Do not invent labels or preservation constraints that the user did not provide or that are',
    'not present in a tool result.',
  ].join('\n'),
  parameterDocs: {
    asset_id: 'Existing asset_id to update.',
    user_label: 'New human-readable label when the user renames the asset.',
    description: 'Replacement description. Keep it factual and concise.',
    must_preserve: 'Replacement preservation list. Use only explicit or tool-result-backed constraints.',
    avoid: 'Replacement avoid list. Use only explicit or tool-result-backed constraints.',
  },
};

// ---------------------------------------------------------------------------
// validate_asset_references
// ---------------------------------------------------------------------------
const VALIDATE_ASSET_REFERENCES_CONTRACT: PromptContract = {
  contractId: 'validate_asset_references_v1',
  version: '1.0.0',
  toolName: 'validate_asset_references',
  baseDescription: [
    'validate_asset_references checks a prompt for provider-specific manifest reference tokens',
    'and reports which resolve or dangle. Call right before dispatching a prompt that names',
    'manifest assets with model_ref tokens.',
    '',
    'Do not use this for plain uploaded references. If validation finds dangling refs, repair the',
    'prompt or register/map the asset before running an expensive generation tool.',
  ].join('\n'),
  parameterDocs: {
    model_id: 'Target provider/model id whose reference token format should be scanned.',
    prompt: 'Prompt text about to be sent to the model.',
  },
};

// ---------------------------------------------------------------------------
// ask_clarifying_question
// ---------------------------------------------------------------------------
const ASK_CLARIFYING_QUESTION_CONTRACT: PromptContract = {
  contractId: 'ask_clarifying_question_v1',
  version: '1.1.0',
  toolName: 'ask_clarifying_question',
  baseDescription: [
    'ask_clarifying_question pauses the workflow and asks the user for missing required input.',
    'Use only when no reasonable safe default exists, when required media/content is missing, or',
    'when confirmation is required for a destructive or credit-sensitive action.',
    '',
    'For creative briefs, do not over-question. Ask at most 3 concise high-leverage questions only',
    'when the answer would materially change audience, product promise, format/duration/platform,',
    'tone, required assets, dialogue/no-dialogue, safety/legal/factual claims, or credit-sensitive',
    'execution. Otherwise make reasonable assumptions and continue.',
    '',
    'This ends the turn. Do not call another tool after it. Ask short concrete question(s) and',
    'avoid preamble.',
  ].join('\n'),
  parameterDocs: {
    question: 'One short concrete question surfaced verbatim to the user.',
    reason: 'Short telemetry tag such as missing_source_asset, ambiguous_subject, or destructive_confirm.',
  },
};

// ---------------------------------------------------------------------------
// finalize_response
// ---------------------------------------------------------------------------
const FINALIZE_RESPONSE_CONTRACT: PromptContract = {
  contractId: 'finalize_response_v1',
  version: '1.1.0',
  toolName: 'finalize_response',
  baseDescription: [
    'finalize_response marks the turn complete and stops the tool loop. Use after the requested',
    'workflow succeeds, partially succeeds, fails with a surfaced error, or needs no tool action.',
    '',
    'When the user asked for a script, storyboard, ad concept, trailer, creator video, meme/parody,',
    'or music prompt and no media tool is required, deliver the final creative in a clean Markdown',
    'contract: title, concept/objective, audience if relevant, timed beats or script, audio/text',
    'notes, generation prompt(s), CTA, and brief assumptions. For revisions, apply the feedback',
    'directly while preserving approved elements and rejected constraints.',
    '',
    'Do not call any other tool after finalize_response. Keep the summary short and grounded in',
    'actual tool results; do not claim exact metadata that no tool returned.',
    'For no-action/text-only answers, such as product, feature, model, pricing, or capability',
    'questions, the summary is the final answer the user sees. Provide the substantive answer',
    'there; never leave it empty and never use a placeholder like "Done."',
  ].join('\n'),
  parameterDocs: {
    summary: 'User-visible closeout. For no-action/text-only answers, include the complete substantive answer here. For media workflows, mention produced media or the concrete blocker; avoid duplicating prior tool output.',
    outcome: 'success, partial, asked_user, failed, or no_action based on the actual turn outcome.',
  },
};

// ---------------------------------------------------------------------------
// enhance_prompt
// ---------------------------------------------------------------------------
const ENHANCE_PROMPT_CONTRACT: PromptContract = {
  contractId: 'enhance_prompt_v1',
  version: '1.1.0',
  toolName: 'enhance_prompt',
  baseDescription: [
    'enhance_prompt authors a directly runnable image, video, or image-edit prompt in the native',
    'format of one exact active destination model. Use it when the requested text deliverable is',
    'explicitly a prompt for a named media model, including a commercial prompt. The caller must',
    'provide destination_model and target_output; unknown, sunset, and omitted models fail closed.',
    '',
    'Do not use enhance_prompt when an exact active destination model is absent, or for music',
    'composition, lyrics, screenplays, storyboards, treatments, ad scripts, or multi-step workflow',
    'plans. Use compose_script for creative-writing artifacts, compose_lyrics or',
    'compose_instrumental for music, and compose_workflow or compose_workflow_template for',
    'workflows.',
    '',
    'enhance_prompt returns prompt text only. The caller is responsible for handing it to the',
    'matching downstream generation tool.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'The source prompt, rough idea, or prompt revision request to enhance.',
    target_output: 'Required model-specific artifact kind: image_prompt, video_prompt, edit_prompt, or model_prompt. Use model_prompt only when destination_model identifies the modality.',
    destination_model: 'Required exact active model selector. Unknown and sunset models fail closed.',
    destination_tool: 'Optional matching downstream generation tool for the authored prompt.',
    prompting_type: 'Deprecated compatibility metadata. It never selects or overrides the prompt grammar; destination_model is authoritative.',
    model_title: 'Deprecated compatibility label. It never selects or overrides the prompt grammar; destination_model is authoritative.',
    style_prompt: 'Optional current style, brand, or prompt context to complement without repeating.',
    prompt_mode: 'Optional model prompt adaptation mode. One of auto, preserve, expand, compress, validate, or payload.',
    duration_seconds: 'Requested runtime in seconds (1-300) when authoring a video prompt.',
    aspect_ratio: 'Optional target aspect ratio, such as 16:9, 9:16, 1:1, 4:5, or 21:9.',
    assets: 'Optional available assets (schema max 50) the prompt may reference. The exact destination model applies smaller per-modality and total limits.',
    constraints: 'Optional production, brand, model, or user constraints to preserve.',
  },
};

// ---------------------------------------------------------------------------
// compose_lyrics
// ---------------------------------------------------------------------------
const COMPOSE_LYRICS_CONTRACT: PromptContract = {
  contractId: 'compose_lyrics_v1',
  version: '1.0.0',
  toolName: 'compose_lyrics',
  baseDescription: [
    'compose_lyrics composes vocal song lyrics and suggested musical parameters. Use for songs',
    'with words, choruses, verses, jingles, vocal hooks, or lyric rewrites.',
    '',
    'Do not use compose_lyrics for instrumental-only music — use compose_instrumental instead.',
    'Do not use it for spoken-word scripts, ad copy, or storyboards — use compose_script. Do',
    'not use it to plan a multi-step workflow — use compose_workflow.',
    '',
    'compose_lyrics returns lyrics text plus musical guidance. The caller is responsible for',
    'handing the lyrics to generate_music to actually synthesize audio.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'The song topic, mood, genre, scene, campaign, or lyric request.',
    language: 'Optional language code or language name for the lyrics.',
    music_prompt: 'Optional musical style context, genre, instrumentation, mood, or production direction.',
    duration_seconds: 'Optional desired song duration in seconds (10-600).',
  },
};

// ---------------------------------------------------------------------------
// compose_instrumental
// ---------------------------------------------------------------------------
const COMPOSE_INSTRUMENTAL_CONTRACT: PromptContract = {
  contractId: 'compose_instrumental_v1',
  version: '1.0.0',
  toolName: 'compose_instrumental',
  baseDescription: [
    'compose_instrumental composes an instrumental music structure and suggested musical',
    'parameters. Use for background scores, beds, cues, themes, and music requests without',
    'lyrics.',
    '',
    'Do not use compose_instrumental when the user wants sung lyrics, vocal hooks, or a jingle',
    'with words — use compose_lyrics instead. Do not use it to actually render audio — the',
    'response is musical guidance; the caller hands it to generate_music for synthesis.',
  ].join('\n'),
  parameterDocs: {
    prompt: 'The instrumental music topic, mood, genre, scene, campaign, or composition request.',
    music_prompt: 'Optional musical style context, instrumentation, mood, or production direction.',
    duration_seconds: 'Optional desired track duration in seconds (10-600).',
  },
};

// ---------------------------------------------------------------------------
// compose_script
// ---------------------------------------------------------------------------
const COMPOSE_SCRIPT_CONTRACT: PromptContract = {
  contractId: 'compose_script_v1',
  version: '1.1.0',
  toolName: 'compose_script',
  baseDescription: [
    'compose_script composes scripts, screenplays, storyboards, treatments, ad concepts, trailers,',
    'social shorts, campaign beats, and talking-head plans. Use it for prose, scenes, beats, or',
    'other script-shaped creative-writing deliverables.',
    '',
    'When the user explicitly asks for a directly runnable prompt for a named image or video',
    'model, use enhance_prompt instead, even when the subject is a commercial. Do not use',
    'compose_script for song lyrics, instrumental composition, simple prompt authoring, or a',
    'runnable multi-step workflow.',
    '',
    'compose_script returns a creative-writing deliverable. When that deliverable will later feed',
    'a video pipeline, destination_tool and destination_model may record the intended handoff;',
    "they do not turn the result into the model's native prompt contract.",
  ].join('\n'),
  parameterDocs: {
    brief: 'The creative writing brief, story idea, product concept, video idea, or revision request.',
    script_type: 'The kind of script or creative writing artifact to produce. One of video_prompt, screenplay, storyboard, ad_script, trailer, social_short, talking_head, campaign, or revision.',
    destination_model: 'Optional destination video model selector, such as ltx25, ltx23, wan22, or seedance2.',
    destination_tool: 'Optional downstream tool, such as generate_video, animate_photo, sound_to_video, or video_to_video.',
    duration_seconds: 'Requested runtime in seconds (1-300) for a video prompt, social short, ad, or talking-head script.',
    scene_count: 'Requested number of scenes, shots, beats, or storyboard panels (1-12).',
    aspect_ratio: 'Optional target aspect ratio, such as 16:9, 9:16, 1:1, 4:5, or 21:9.',
    platform: 'Optional target platform or context, such as TikTok, YouTube Shorts, Instagram Reels, broadcast, landing page, game trailer, or pitch deck.',
    style: 'Optional style, genre, tone, visual treatment, or brand voice to preserve.',
    first_frame_description: 'Optional description of the starting frame when composing an image-to-video prompt without attached vision content.',
    first_frame_data_url: 'Optional inline image data URI for the starting frame when composing an image-to-video or first-frame video prompt.',
    last_frame_data_url: 'Optional inline image data URI for the ending frame when composing an image-to-video transition prompt.',
    return_format: 'Requested output format. One of script, markdown, or json. Use script unless structured planning output is explicitly needed.',
  },
};

// ---------------------------------------------------------------------------
// compose_workflow
// ---------------------------------------------------------------------------
const COMPOSE_WORKFLOW_CONTRACT: PromptContract = {
  contractId: 'compose_workflow_v1',
  version: '1.0.0',
  toolName: 'compose_workflow',
  baseDescription: [
    'compose_workflow turns a creative brief into a runnable ONE-SHOT durable creative workflow',
    'plan (the same shape that POST /v1/creative-agent/workflows accepts). Pick this when the',
    'user wants to RUN a multi-step pipeline ONCE — they will review the plan, submit it, get',
    'the output, and be done. Trigger phrases: "give me a runnable workflow plan", "compose a',
    'one-shot plan", "compile a plan I can submit", "I want to run this once", "I do NOT need',
    'to save it as a template", "just review the steps and run it", "5-shot teaser, 9:16, 15s"',
    'style concrete one-off briefs.',
    '',
    'Hard line vs compose_workflow_template: if the user wants to SAVE / REUSE / NAME a',
    'workflow recipe to re-run later on different inputs, use compose_workflow_template',
    'instead. compose_workflow returns a one-time plan with no template wrapper; the user',
    'CANNOT re-run this output with different inputs without a fresh planner call.',
    '',
    'Do not use compose_workflow for ordinary creative writing artifacts — use compose_script for',
    'scripts, storyboards, ad concepts, or trailers. Do not use it for prompt expansion — use',
    'enhance_prompt. Do not use it to actually run a workflow — the response is just the plan;',
    'the caller is responsible for submitting it to POST /v1/creative-agent/workflows with their',
    'own Idempotency-Key.',
    '',
    'The returned plan is not idempotent on its own. Pair the eventual workflow submission with',
    'a caller-owned Idempotency-Key. Phase 1 only supports return_format="json".',
  ].join('\n'),
  parameterDocs: {
    brief: 'Required free-form natural-language description of what the workflow should produce.',
    scene_count: 'Suggested number of distinct shots/scenes (1-12). The planner may emit more steps than scenes (for example, a keyframe + clip pair per scene).',
    duration_seconds: 'Target total duration in seconds for video-bearing plans (1-120).',
    aspect_ratio: 'Output aspect ratio. One of 1:1, 4:3, 3:4, 16:9, 9:16, 21:9.',
    style: 'Optional stylistic guidance such as "cinematic, neon, low-key" or "whiteboard illustration".',
    destination_models: 'Optional preferred image/video/music model selectors (e.g. qwen, ltx25, ltx23). Each subkey is optional.',
    max_estimated_capacity_units: 'Optional coarse capacity budget. If set, the planner tries to keep total estimated cost at or below this value; the API returns fits_budget=false if it cannot.',
    include_audio: 'When true, include a generate_music step in the plan. Defaults to false.',
    return_format: 'Reserved for future use; only "json" is supported in Phase 1. Omit if unsure.',
  },
};

// ---------------------------------------------------------------------------
// compose_workflow_template
// ---------------------------------------------------------------------------
const COMPOSE_WORKFLOW_TEMPLATE_CONTRACT: PromptContract = {
  contractId: 'compose_workflow_template_v1',
  version: '1.0.0',
  toolName: 'compose_workflow_template',
  baseDescription: [
    'compose_workflow_template turns a creative brief into a savable, parameterized workflow',
    'template plus a concrete example plan for the inputs the planner picked. This is the',
    'tool to use whenever the user wants to CREATE / SAVE / DESIGN / BUILD a reusable',
    'workflow recipe — not just run one once. Trigger phrases: "create a workflow that…",',
    '"save this as a workflow", "make me a reusable workflow…", "build a workflow that…",',
    '"design a workflow…", "I want a recipe for…", "I want to be able to re-run this on…",',
    '"save as workflow", "turn this into a workflow", "workflow that takes X as input".',
    '',
    'The returned `template_draft` carries typed `inputs[]` (image/audio/video/text/number/',
    'select/boolean), parameterized `stages[]` that reference inputs via `$inputs.NAME`',
    'placeholders, and an optional `graph` layout the visual builder consumes. A sibling',
    '`plan` field carries a Phase-1-compatible `steps[]` rendering for the example inputs so',
    'the UI can preview the workflow without round-tripping the compiler.',
    '',
    'Hard line vs direct generation tools: if the user asked to MAKE / SAVE / DESIGN a',
    'workflow, never call generate_video, generate_image, edit_image, animate_photo, or any',
    'other rendering tool directly — that consumes credits to produce one-shot media when',
    'the user wanted a reusable recipe. Pick compose_workflow_template instead. After',
    'compose_workflow_template returns the template_draft, you MUST immediately call',
    'finalize_response next. DO NOT call any other tool after compose_workflow_template —',
    'no render tools "to show a preview", no demonstration runs, nothing. The user reviews',
    'the draft in the builder UI, not in chat. Calling generate_image / generate_video /',
    'edit_image after compose_workflow_template is a fixture-failing mistake.',
    '',
    'Hard line vs compose_workflow: if the user said "I do not need to save it as a',
    'template", "give me a runnable plan to submit", "one-shot", "just run this once", or',
    'similar single-use phrasing — pick compose_workflow, NOT compose_workflow_template.',
    'compose_workflow_template is exclusively for SAVING reusable recipes.',
    '',
    'Do not use compose_workflow_template for one-shot turn-by-turn plans — use compose_workflow',
    'instead. The returned template is a draft; the caller is responsible for saving it via',
    'POST /v1/creative-agent/workflows/templates and minting a stable template id.',
    '',
    'Editing an existing template: pass the full template JSON as `existing_template` together',
    'with the modification brief and the planner returns a refined `template_draft` that keeps',
    'the id stable, bumps the version, preserves stages the brief did not touch, and applies',
    'the requested changes. This is the canonical path for "add a music step", "switch the',
    'storyboard model to GPT Image 2", or "make this 9:16 instead of 16:9" style edits.',
    '',
    'Editing a workflow you cannot see: if the user asks to edit a saved workflow by name or',
    'id (e.g. "edit the bobblehead workflow", "modify wf_bobblehead_tiktok") and the',
    'conversation does not contain the existing template JSON, do NOT call manage_memory and',
    'do NOT ask the user to paste the template — just call compose_workflow_template with the',
    'modification brief and a sensible name (you may reuse the workflow id the user mentioned).',
    'Omit existing_template in that case. The planner composes a fresh template_draft that',
    'represents the modification; preserving stage ids only happens when existing_template is',
    'present, and that is acceptable — the alternative is a wasted turn.',
    '',
    'Phase 2 supports return_format="json" only. Visibility defaults to "private"; the "team"',
    'visibility slot is reserved for a later milestone.',
  ].join('\n'),
  parameterDocs: {
    brief: 'Required free-form natural-language description of what the workflow should produce. When editing an existing template, phrase the brief as the modification request (e.g. "Add a music step at the end and make the duration 12s").',
    name: 'Required human-readable template name. Shown in the workflow library and run launcher.',
    description: 'Optional template description; the planner derives one from the brief if omitted.',
    category: 'Optional category (portrait, video-social, makeover, cinematic, music, analysis, custom, other). Defaults to "custom".',
    visibility: 'Persistence visibility: "private" (default) or "public". "team" is reserved for a later milestone.',
    inputs: 'Optional typed input declarations. When omitted, the planner LLM proposes inputs based on the brief. Each entry needs name + type; required, description, default, options, multiple, and internal are optional refinements.',
    scene_count: 'Suggested number of distinct shots/scenes (1-12).',
    duration_seconds: 'Target total duration in seconds for video-bearing plans (1-120).',
    aspect_ratio: 'Output aspect ratio. One of 1:1, 4:3, 3:4, 16:9, 9:16, 21:9.',
    style: 'Optional stylistic guidance such as "cinematic, neon, low-key" or "whiteboard illustration".',
    destination_models: 'Optional preferred image/video/music model selectors (e.g. qwen, ltx25, ltx23). Each subkey is optional.',
    max_estimated_capacity_units: 'Optional coarse capacity budget. The planner returns fits_budget=false if it cannot fit under the cap.',
    include_audio: 'When true, include a generate_music step in the example plan. Defaults to false.',
    return_format: 'Reserved for future use; only "json" is supported in Phase 2. Omit if unsure.',
    existing_template: 'Optional full WorkflowTemplate JSON. When supplied, the planner edits this template per the brief instead of designing from scratch — preserves stage ids and unchanged stages, bumps version, and applies the requested modifications. Use this for the chat "edit this workflow" flow and the builder "regenerate from prompt" button.',
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Default prompt contracts shipped with this package. One contract per tool.
 * Consumers (sogni-chat's contractsRuntime, sogni-api's hosted contracts
 * service, public-skill-runtime) register these on a ContractRegistry at
 * session boot.
 */
export const PROMPT_CONTRACTS: ReadonlyArray<PromptContract> = [
  RESTORE_PHOTO_CONTRACT,
  UPSCALE_IMAGE_CONTRACT,
  UPSCALE_VIDEO_CONTRACT,
  APPLY_STYLE_CONTRACT,
  REFINE_RESULT_CONTRACT,
  ORBIT_VIDEO_CONTRACT,
  ANIMATE_PHOTO_CONTRACT,
  CHANGE_ANGLE_CONTRACT,
  GENERATE_VIDEO_CONTRACT,
  EDIT_IMAGE_CONTRACT,
  GENERATE_IMAGE_CONTRACT,
  VIDEO_TO_VIDEO_CONTRACT,
  EXTEND_VIDEO_CONTRACT,
  REPLACE_VIDEO_SEGMENT_CONTRACT,
  OVERLAY_VIDEO_CONTRACT,
  ADD_SUBTITLES_CONTRACT,
  STITCH_VIDEO_CONTRACT,
  SOUND_TO_VIDEO_CONTRACT,
  DANCE_MONTAGE_CONTRACT,
  GENERATE_MUSIC_CONTRACT,
  GENERATE_SPEECH_CONTRACT,
  ANALYZE_IMAGE_CONTRACT,
  ANALYZE_VIDEO_CONTRACT,
  SET_CONTENT_FILTER_CONTRACT,
  EXTRACT_METADATA_CONTRACT,
  RESOLVE_PERSONAS_CONTRACT,
  MANAGE_MEMORY_CONTRACT,
  CREATE_ASSET_MANIFEST_CONTRACT,
  INSPECT_ASSET_CONTRACT,
  LABEL_ASSET_CONTRACT,
  MAP_ASSETS_FOR_MODEL_CONTRACT,
  VALIDATE_ASSET_REFERENCES_CONTRACT,
  ASK_CLARIFYING_QUESTION_CONTRACT,
  FINALIZE_RESPONSE_CONTRACT,
  ENHANCE_PROMPT_CONTRACT,
  COMPOSE_LYRICS_CONTRACT,
  COMPOSE_INSTRUMENTAL_CONTRACT,
  COMPOSE_SCRIPT_CONTRACT,
  COMPOSE_WORKFLOW_CONTRACT,
  COMPOSE_WORKFLOW_TEMPLATE_CONTRACT,
];

/**
 * Register every default prompt contract on the given registry.
 * Consumers (sogni-chat's contractsRuntime, sogni-api's hosted
 * contracts service) call this at session boot.
 */
export function populateContractsPromptContracts(registry: ContractRegistry): void {
  for (const contract of PROMPT_CONTRACTS) {
    registry.registerPromptContract(contract);
  }
}
