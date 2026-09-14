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
  'MiniMax H3 FastH3 audio guide: "minimax-h3-fasth3-ia2v-turbo" (first-frame image from sourceImageIndex plus the audio), "minimax-h3-fasth3-flfa2v-turbo" (first frame from sourceImageIndex, last frame from endImageIndex, plus the audio) and "minimax-h3-fasth3-a2v-turbo" (audio only; set neither sourceImageIndex nor endImageIndex) run the four-step FastH3 engine with the uploaded audio driving the picture from frame 0, and the output keeps that audio as its soundtrack. Choose them only when the user asks for MiniMax H3 or FastH3; never pick them in place of the LTX 2.5 defaults. They render 124-362 frames on the H3 17-frame grid at a fixed 24 fps (about 5.2-15.1 seconds) on a 32px grid within 1344x768, so use targetResolution 768 or omit it. audioStart picks the window of the upload. generateAudio=false, LoRAs and negativePrompt are not supported. Each costs the FastH3 price of its image-to-video, first-and-last-frame or text-to-video mode, 4 Spark per second. "minimax-h3-fasth3-ia2v-turbo-2stage", "minimax-h3-fasth3-flfa2v-turbo-2stage" and "minimax-h3-fasth3-a2v-turbo-2stage" are the two-stage forms: the same inputs rendered on the FastH3 canvas, then enlarged 2x and refined, delivered at twice the canvas with the same length and audio. For them targetResolution names the delivered class: 1080 renders a 544px short-edge canvas (960x544 is delivered at 1920x1088) for 10 Spark per second, and 1440 or omitted renders the 768p canvas for 2K (1344x768 is delivered at 2688x1536) for 16 Spark per second. The audio two-stage selectors have no 720p price class (720 would render a 384px canvas at the 1080p rate), so for 720p or 768p audio-guided H3 output use the regular selector. The estimate prices every request.';

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

export const MINIMAX_H3_AUDIO_GUIDE_PROMPT_DESCRIPTION =
  'MINIMAX H3 AUDIO SELECTORS: write the request plainly (subject, action, camera, the voice or sound heard in the upload and any exact words spoken in it); the MiniMax H3 prompt shaper turns it into the H3 contract for the matching image-to-video, first-and-last-frame or text-to-video mode. Describe the uploaded audio as it is, and do not invent other dialogue or music.';
