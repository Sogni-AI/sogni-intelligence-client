/**
 * Tool-definition prompt markers.
 *
 */
import { LITERAL_PROMPT_OVERRIDE } from './promptOverrideMarker.js';

export const LITERAL_VIDEO_PROMPT_OVERRIDE =
  `${LITERAL_PROMPT_OVERRIDE} Set skipPromptProcessing=true; for Seedance or Wan 3 also set expandPrompt=false.`;

export const SEEDANCE_EXPAND_PROMPT_DESCRIPTION =
  'Seedance and Wan 3 only. Whether to run Sogni\'s exact-model prompt shaper before dispatch. Defaults to true. Set false when the supplied prompt is already model-ready and must remain exact.';

export const GENERATE_VIDEO_SKIP_PROMPT_PROCESSING_DESCRIPTION =
  'Bypass automatic prompt shaping/refinement and voice-identity prompt formatting so the prompt text is sent unchanged to the video model. Set true ONLY when the user explicitly says not to modify/rewrite/enhance/expand/change/improve the prompt, or to use/send it exactly, verbatim, or as-is, AND the provided prompt already satisfies the tool requirements. Continue to set non-prompt parameters such as model, duration, count, aspect ratio, and seed. For Seedance or Wan 3 literal prompt requests, also set expandPrompt=false. Do not set for ordinary underspecified requests.';

export const ANIMATE_PHOTO_SKIP_PROMPT_PROCESSING_DESCRIPTION =
  'Bypass automatic prompt shaping/refinement, image-description anchoring, transition-prompt rewriting, and voice-identity prompt formatting so the prompt text is sent unchanged to the video model. Set true ONLY when the user explicitly says not to modify/rewrite/enhance/expand/change/improve the prompt, or to use/send it exactly, verbatim, or as-is, AND the provided prompt already satisfies the tool requirements. Continue to set non-prompt parameters such as source indices, frameRole, model, duration, count, and aspect ratio. For Seedance or Wan 3 literal prompt requests, also set expandPrompt=false. Do not set for ordinary underspecified requests.';

export const LITERAL_SEEDANCE_PROMPT_OVERRIDE =
  `${LITERAL_PROMPT_OVERRIDE} For Seedance or Wan 3, set expandPrompt=false.`;

export const SEEDANCE_TOOL_MULTIMODAL_REFERENCE_GUIDANCE = `Seedance supports multimodal loose reference assets: images (up to 9), videos (up to 3), and audios (up to 3), with no more than 12 asset files total. Use @Image1/@Video1/@Audio1 style references in creative briefs when assigning roles. Assign every useful reference asset a role and prefer positive preservation constraints. If an uploaded video is the source clip to transform, upscale, enhance, restyle, or remaster, use video_to_video with controlMode="seedance-v2v" instead of generate_video referenceVideoIndices.`;

export const SEEDANCE_TOOL_V2V_REFERENCE_GUIDANCE = `Seedance V2V reads @Video1 holistically. Use it for restyling, motion transfer, extension, subject replacement, or scene transformation, and assign @Video1 a clear role such as source clip, camera movement, action timing, edit rhythm, or continuation anchor.`;

// Seedance 2.5 Uncensored (seedance-2-5-uncensored): Seedance 2.5 on a separate
// uncensored account, gated by a one-time likeness and consent agreement.
export const SEEDANCE_25_UNCENSORED_MODEL_DESCRIPTION =
  '"seedance2-5-uncensored": Seedance 2.5 Uncensored — the uncensored variant of Seedance 2.5, with every mode, resolution, duration, reference limit, and output option described for "seedance2-5". Choose it only when the user asks for Seedance 2.5 Uncensored (including "Seedance Uncensored" or "Seedance Spicy") or for uncensored Seedance output; never swap it in for "seedance2-5" otherwise. Each account must accept a one-time likeness and consent agreement in the Sogni app before its first render; until then the job fails with error 4103, so tell the user to accept it in the Sogni app instead of retrying.';

export const SEEDANCE_TOOL_AUDIO_REFERENCE_GUIDANCE = `For Seedance audio-reference prompts, preserve exact spoken dialogue when the user supplied it, and assign @Image1/@Audio1 roles. If the user asks for speech without words, describe the vocal performance without inventing quoted dialogue. Treat lip-sync, voice cloning, and real-human reference behavior as provider-sensitive rather than guaranteed.`;

export const HAPPYHORSE_TOOL_REFERENCE_GUIDANCE = `HappyHorse 1.1 takes image references only and renders a native synchronized audio track (always on; do not set generateAudio or a negative prompt). Pick the model by mode: happyhorse-1.1-t2v for text-to-video (no reference image), happyhorse-1.1-i2v for image-to-video from a single first frame, and happyhorse-1.1-r2v for reference-to-video with 1 to 9 reference images. For r2v, tag the images in the prompt as [Image 1]…[Image 9] and assign each a clear role. HappyHorse does not accept reference videos or reference audios.`;

export const HAPPYHORSE_GENERATE_VIDEO_MODEL_DESCRIPTION =
  'Alibaba HappyHorse 1.1 video models (third-party vendor — requires Premium Spark). Select by mode: "happyhorse-1.1-t2v" for text-to-video, "happyhorse-1.1-i2v" for image-to-video from one first-frame image, and "happyhorse-1.1-r2v" for reference-to-video with up to 9 reference images. Resolutions 720P and 1080P; duration 3-15 seconds at 24 fps; native synchronized audio is always generated (do not set generateAudio or negativePrompt). Supported aspect ratios: 16:9, 9:16, 1:1, 4:3, 3:4, 4:5, 5:4, 9:21, 21:9. ' +
  HAPPYHORSE_TOOL_REFERENCE_GUIDANCE;

// MiniMax H3 FastH3 audio guide on sound_to_video (Comfy worker 1.0.217+). The
// uploaded audio drives the picture from frame 0 and is muxed into the output.
// Socket ids minimax-h3-fastvideo-int8_{ia2v,flfa2v,a2v}_turbo[_2stage]; each
// bills the FastH3 per-second price of i2v / flf2v / t2v, and the two-stage ids
// bill the FastH3 two-stage 1080p / 2K classes (they have no 720p class).
export const MINIMAX_H3_AUDIO_GUIDE_SOUND_TO_VIDEO_FUNCTION_DESCRIPTION =
  'MINIMAX H3 AUDIO: only when the user asks for MiniMax H3 or FastH3 audio-driven video, use videoModel="minimax-h3-fasth3-ia2v-turbo" with a first-frame image (sourceImageIndex), "minimax-h3-fasth3-flfa2v-turbo" with a first and a last frame (sourceImageIndex and endImageIndex), or "minimax-h3-fasth3-a2v-turbo" with no image; add "-2stage" only for 1080p, 1440p or 2K H3 output. Without an explicit MiniMax H3 or FastH3 request keep the LTX 2.5 defaults. The MiniMax H3 selectors on generate_video and animate_photo cannot take an uploaded audio track; send uploaded-audio H3 requests here.';

export const MINIMAX_H3_AUDIO_GUIDE_SOUND_TO_VIDEO_MODEL_DESCRIPTION =
  'MiniMax H3 FastH3 audio guide: "minimax-h3-fasth3-ia2v-turbo" (first-frame image from sourceImageIndex plus the audio), "minimax-h3-fasth3-flfa2v-turbo" (first frame from sourceImageIndex, last frame from endImageIndex, plus the audio) and "minimax-h3-fasth3-a2v-turbo" (audio only; set neither sourceImageIndex nor endImageIndex) run the four-step FastH3 engine with the uploaded audio driving the picture from frame 0, and the output keeps that audio as its soundtrack. Choose them only when the user asks for MiniMax H3 or FastH3; never pick them in place of the LTX 2.5 defaults. They render 124-362 frames on the H3 17-frame grid at a fixed 24 fps (about 5.2-15.1 seconds) on a 32px grid within 1344x768, so use targetResolution 768 or omit it. audioStart picks the window of the upload. MiniMax H3 catalog and Personal LoRAs are supported, including across audio modes and tiers. generateAudio=false and negativePrompt are not supported. Each costs the FastH3 price of its image-to-video, first-and-last-frame or text-to-video mode, 4 Spark per second. "minimax-h3-fasth3-ia2v-turbo-2stage", "minimax-h3-fasth3-flfa2v-turbo-2stage" and "minimax-h3-fasth3-a2v-turbo-2stage" are the two-stage forms: the same inputs rendered on the FastH3 canvas, then enlarged 2x and refined, delivered at twice the canvas with the same length and audio. For them targetResolution names the delivered class: 1080 renders a 544px short-edge canvas (960x544 is delivered at 1920x1088) for 10 Spark per second, and 1440 or omitted renders the 768p canvas for 2K (1344x768 is delivered at 2688x1536) for 16 Spark per second. The audio two-stage selectors have no 720p price class (720 would render a 384px canvas at the 1080p rate), so for 720p or 768p audio-guided H3 output use the regular selector. The estimate prices every request.';

export const MINIMAX_H3_AUDIO_GUIDE_END_IMAGE_INDEX_DESCRIPTION =
  'Which image to use as the LAST frame, indexed like animate_photo\'s endImageIndex: negative indices for uploaded images (-1 = first upload, -2 = second upload) and 0-based non-negative indices for generated results. Only "minimax-h3-fasth3-flfa2v-turbo" and "minimax-h3-fasth3-flfa2v-turbo-2stage" take it, and they require it together with sourceImageIndex (for two uploaded images use sourceImageIndex=-1 and endImageIndex=-2). Omit it for every other videoModel.';

export const MINIMAX_H3_AUDIO_GUIDE_SOURCE_IMAGE_INDEX_DESCRIPTION =
  'MiniMax H3 FastH3 audio guide: "minimax-h3-fasth3-ia2v-turbo" and "minimax-h3-fasth3-flfa2v-turbo" (and their -2stage forms) require this first frame; "minimax-h3-fasth3-a2v-turbo" and its -2stage form take no image, so omit it for them.';

export const MINIMAX_H3_AUDIO_GUIDE_AUDIO_START_DESCRIPTION =
  'The MiniMax H3 FastH3 audio selectors take audioStart too: the clip uses the upload from audioStart for its own length.';

export const MINIMAX_H3_AUDIO_GUIDE_DURATION_DESCRIPTION =
  'MiniMax H3 FastH3 audio selectors render 124-362 frames on a 17-frame grid at a fixed 24 fps, so the clip runs about 5.2-15.1 seconds and a length outside that window snaps to it; for longer audio pick the window with audioStart.';

export const MINIMAX_H3_AUDIO_GUIDE_GENERATE_AUDIO_DESCRIPTION =
  'MiniMax H3 FastH3 audio selectors always deliver the uploaded audio: omit generateAudio for them (false is refused).';

export const MINIMAX_H3_AUDIO_GUIDE_NEGATIVE_PROMPT_DESCRIPTION =
  'MiniMax H3 has no negative-prompt input; do not set this for the MiniMax H3 FastH3 audio selectors and state exclusions positively in prompt.';

// MiniMax H3 intermediate keyframes (Comfy worker 1.0.226+, SDK 5.58.0+) on
// animate_photo, sound_to_video and generate_video. The `keyframes` argument
// carries MINIMAX_H3_KEYFRAMES_DESCRIPTION word for word on every tool, followed
// by one sentence naming which of that tool's selectors take it; the prompt
// contracts, skill manifests and tool descriptions add
// MINIMAX_H3_KEYFRAMES_GUIDANCE. Validation lives in hostedToolValidation and
// the frame math in media/minimaxH3Keyframes.
export const MINIMAX_H3_KEYFRAMES_DESCRIPTION =
  'MiniMax H3 only. Pin up to 8 images at exact moments inside the video, in addition to the first/last frame. Each item is {imageIndex, atSeconds}: imageIndex uses the endImageIndex convention (negative = uploads, 0+ = generated results); atSeconds is when the video should land on that image. Keyframes must fall strictly inside the clip (not on the first or last frame) and at distinct times. Describe what each keyframe shows in the prompt at its time; a keyframe with a new angle, place or light starts a new shot. Two keyframes are included in the price; each additional keyframe adds a little.';

export const MINIMAX_H3_KEYFRAME_IMAGE_INDEX_DESCRIPTION =
  'The image the video lands on, indexed like endImageIndex: -1 = first upload, -2 = second upload, 0 and up = generated image results.';

export const MINIMAX_H3_KEYFRAME_AT_SECONDS_DESCRIPTION =
  'Seconds from the start of the video at which it lands on this image (0.1 s precision is enough). Must be after the first frame and before the last one.';

export const MINIMAX_H3_KEYFRAMES_ANIMATE_PHOTO_DESCRIPTION =
  `${MINIMAX_H3_KEYFRAMES_DESCRIPTION} On animate_photo every MiniMax H3 image-to-video and first-and-last-frame selector takes keyframes, with any frameRole; the first and last frames stay in sourceImageIndex and endImageIndex. When one continuous H3 clip should pass through extra images, pass them here on that single call instead of chaining sourceImageIndices clips.`;

export const MINIMAX_H3_KEYFRAMES_SOUND_TO_VIDEO_DESCRIPTION =
  `${MINIMAX_H3_KEYFRAMES_DESCRIPTION} On sound_to_video every MiniMax H3 audio selector takes keyframes (image + audio, first and last frame + audio, and audio only, each one- and two-stage). imageIndex follows endImageIndex here too (-1 = first upload), not the 0-based upload numbering of sourceImageIndex. Set duration whenever you pass keyframes: the clip is then the shortest MiniMax H3 length that covers it (duration 6 renders 6.58 s), and every keyframe must fall inside that. Without duration the host sizes the clip itself (to the audio from audioStart, or a 5.17 s default) and refuses keyframes that fall outside it.`;

export const MINIMAX_H3_KEYFRAMES_GENERATE_VIDEO_DESCRIPTION =
  `${MINIMAX_H3_KEYFRAMES_DESCRIPTION} On generate_video only the MiniMax H3 reference-to-video selectors (minimax-h3-r2v and its turbo, balanced and two-stage forms) take keyframes; text-to-video never does, and reference-to-video has no first or last frame to pin. Keyframes are not references: they do not go in referenceImageIndices or count toward the reference limits, and R2V still needs its own image or video reference. The prompt names each keyframe <Picture N>, numbered after the reference pictures in time order.`;

export const MINIMAX_H3_KEYFRAMES_GUIDANCE =
  'MINIMAX H3 KEYFRAMES: when the user wants one MiniMax H3 clip to pass through extra images at chosen moments, pass keyframes=[{imageIndex, atSeconds}] (up to 8; imageIndex indexed like endImageIndex) on that one call, and make the clip long enough that every keyframe falls strictly inside it (set duration when the default would end too soon). Say in the prompt what each keyframe shows at its time, and start a new shot at a keyframe that changes the angle, place or light. Keyframes add to the first and last frame and are not references, but the prompt names each one <Picture N>, numbered after the first/last-frame or reference pictures in time order. Two are included in the price; each additional keyframe adds a little. Only MiniMax H3 selectors take them (see the keyframes argument for which).';

export const MINIMAX_H3_AUDIO_GUIDE_PROMPT_DESCRIPTION =
  'MINIMAX H3 AUDIO SELECTORS: write the request plainly (subject, action, camera, the voice or sound heard in the upload and any exact words spoken in it); the MiniMax H3 prompt shaper turns it into the H3 contract for the matching image-to-video, first-and-last-frame or text-to-video mode. Describe the uploaded audio as it is, and do not invent other dialogue or music.';
