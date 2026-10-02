/**
 * Tool definition for replace_video_segment.
 *
 * Re-renders a [startSeconds, endSeconds] window inside an existing video and
 * splices the new clip in place of the original segment. It can also splice an
 * existing uploaded/generated video clip into that window via
 * replacementVideoIndex, optionally trimming a source window from that
 * replacement clip first. By default the regenerated segment's own audio
 * replaces the base video's audio in that window; existing replacement clips
 * also keep their own audio. Pass keepOriginalAudio=true to mux the base
 * video's audio over the regenerated window when the user explicitly asks
 * to preserve the existing audio.
 *
 * Model dispatch:
 *   - LTX 2.5/2.3 / Wan 2.2 base → extract boundary frames, render animate_photo
 *     with both as keyframes (frameRole="both"), trim handles when needed.
 *   - Seedance base → extract a reference clip around the requested window,
 *     render video_to_video (controlMode="seedance-v2v"), trim handles when
 *     needed.
 */

import type { ToolDefinition } from '../types.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'replace_video_segment',
    description:
      'Modify a portion of an existing video while keeping the rest intact — either by regenerating that slice fresh or by splicing in another existing clip. Operates on a [startSeconds, endSeconds] window inside a base video; everything outside the window stays exactly as it was. Works on BOTH videos previously rendered in this session AND user-uploaded videos (set videoIndex to a negative number to target an uploaded video when no prior render exists). ' +
      'WHEN TO USE: any request to change part of one video while keeping the rest, to put another clip inside another video at a specific position, or to interleave time slices of multiple videos. Plain language: "regenerate from 5s to 10s", "redo the last 3 seconds", "swap out the middle", "replace the bumper at the end", "swap the end card", "change the outro / intro / ending / last clip", "replace 2s-4s with a stronger expression", "splice video 2 into video 1", "stitch video 2 into the middle of video 1", "insert the second clip at 5s", "alternate 1 second from each video". The word "stitch" in the user request does not by itself mean stitch_video — when the user clearly wants insertion or in-place replacement, this tool is the right one. ' +
      'WHEN NOT TO USE — prefer stitch_video instead: the user wants to concatenate whole clips end-to-end without modifying their interiors ("stitch these together", "play A then B", "add a bumper before / after"). ' +
      'SPLICING EXISTING CLIPS: pass replacementVideoIndex when the replacement already exists as an uploaded or generated video — do not call generate_video / animate_photo / video_to_video in that case. Set endSeconds=startSeconds when the user asks for an insertion that should not remove time from the base video. ' +
      'TIME-SLICED INTERLEAVING ("alternate 1 second from each video"): pass replacementStartSeconds and replacementEndSeconds to cut the next source slice out of the replacement video before splicing it into the base. Repeat this call for each alternating window. By default use replacement windows (endSeconds = startSeconds + sliceDuration); use insertion windows (endSeconds = startSeconds) only when the user explicitly asks to lengthen the output by inserting extra slices. replacementStartSeconds and replacementEndSeconds must be concrete non-negative seconds; never use -1 as an end-of-source sentinel. ' +
      'PREFER this over re-running generate_video / animate_photo on the original prompt when the user only wants part of the video changed — re-rendering wastes credits, loses the unchanged sections, and breaks the original timing. ' +
      'If the user does not specify the exact start/end seconds (e.g. "replace the bumper at the end"), call analyze_video first to identify the correct window, OR derive it from the storyboard timing already in the conversation (e.g. last beat\'s time range). Do not guess wildly — pick a sensible bumper/end-card window such as the final 1-3 seconds when the storyboard says scene_07 is 14-15s. ' +
      'Returns both the standalone replacement clip and the spliced composite. ' +
      'For LTX 2.5/2.3 and Wan 2.2 base videos the tool locks both ends with first/last-frame keyframes for seamless edges; new non-Seedance LTX segments default to 2.5. ' +
      'For Seedance base videos the tool uses the original window as a reference for video-to-video transformation. If a requested window is shorter than the selected model\'s native render minimum, the handler renders a slightly larger handled clip, trims the result back to the requested seconds, then splices exactly that requested range. ' +
      'By default the regenerated segment\'s audio replaces the original audio in the [startSeconds, endSeconds] window, so new motion stays in sync with new sound. Pass keepOriginalAudio=true only when the user explicitly asks to keep the existing audio — phrasings like "keep the audio", "leave the original audio", "preserve the music/score/dialogue", "don\'t change the audio". If the user uses an ambiguous phrasing such as "with the audio" (which could mean either "with the original audio kept" or "with new audio"), DO NOT call this tool yet — first ask the user whether to preserve or replace the original audio in the replaced window. When replacementVideoIndex is set, the existing replacement clip\'s own audio is used; pass keepOriginalAudio=true only when the user explicitly wants the base video audio to stay over the replacement window.',
    parameters: {
      type: 'object',
      properties: {
        startSeconds: {
          type: 'number',
          description:
            'Start of the window (in seconds) inside the base video that should be regenerated. Must be ≥ 0 and < endSeconds. For "the last N seconds" requests, set startSeconds = max(0, baseDuration - N). When unsure of the exact base duration, you may pass a sentinel value of -1 to mean "from the end of the base video"; the handler will resolve it after probing.',
        },
        endSeconds: {
          type: 'number',
          description:
            'End of the window (in seconds) inside the base video. For regenerated segments it must be > startSeconds and ≤ base video duration. When replacementVideoIndex is set, endSeconds may equal startSeconds to insert the replacement clip at that timestamp without removing any base-video time. For alternating/interleaved time-slice edits, use endSeconds=startSeconds+sliceDuration so the source slice replaces that base window; do not use insertion unless the user explicitly asks to lengthen the output. Pass -1 to mean "until the end of the base video". Windows shorter than the selected model\'s native render minimum are rendered with handles and trimmed before splicing; windows longer than the model maximum must be split.',
        },
        prompt: {
          type: 'string',
          description:
            'What should happen in the replaced window — motion, action, dialogue, audio. For LTX include exact spoken words in double quotes when speech is requested. For Seedance V2V describe the transformation relative to the existing visuals (the original window is provided as a reference clip).',
        },
        videoIndex: {
          type: 'number',
          description:
            'Which video to edit. Default: -1 (most recent video in this session, falling back to the first uploaded video when no prior render exists). Use 0-based non-negative indices for prior tool result videos. For uploaded videos with no prior render, leave this absent or pass -1 — the handler will pick the uploaded base automatically.',
        },
        replacementVideoIndex: {
          type: 'number',
          description:
            'Optional existing video clip to splice into the base video instead of regenerating a segment. Non-negative values reference prior generated videos; negative values reference uploaded videos (-1 = first uploaded video, -2 = second, etc.). Use for requests like "splice video 2 into video 1", "replace 5s to 15s with uploaded clip 2", or alternating/interleaved edits that pull timed slices from another existing clip. When this is set, the operation is pure ffmpeg post-production and keeps the replacement clip audio unless keepOriginalAudio=true.',
        },
        replacementStartSeconds: {
          type: 'number',
          minimum: 0,
          description:
            'Optional start time, in seconds, inside replacementVideoIndex. Must be a concrete non-negative source time; do not use -1 sentinels for replacement source windows. Use with replacementEndSeconds when only a slice of the replacement clip should be spliced. Example: alternating 1-second clips from video 1 and video 2 should replace base window 1..2 with the first replacement slice by setting replacementVideoIndex=-2, replacementStartSeconds=0, replacementEndSeconds=1.',
        },
        replacementEndSeconds: {
          type: 'number',
          minimum: 0,
          description:
            'Optional end time, in seconds, inside replacementVideoIndex. Must be a concrete non-negative source time greater than replacementStartSeconds. Do not pass -1 to mean "end of replacement video"; use the known uploaded/generated clip duration from metadata for routine time-sliced edits, or omit both replacementStartSeconds and replacementEndSeconds to use the whole replacement clip. Do not call analyze_video just to learn duration.',
        },
        videoModel: {
          type: 'string',
          enum: ['auto', 'ltx25', 'ltx23', 'wan22', 'seedance2', 'seedance2-mini', 'seedance2-5', 'seedance2-5-spicy'],
          description:
            'Which model to use for the new segment. Default: "auto" — preserve Seedance or WAN for matching base clips and otherwise use LTX 2.5. Use ltx23 only for explicit rollback. "seedance2-5-spicy" is Seedance 2.5 Uncensored; use it only when the user asks for it. Override only when the user explicitly requests a different model.',
        },
        keepOriginalAudio: {
          type: 'boolean',
          description:
            'When true, the audio from the original [startSeconds, endSeconds] window is muxed onto the regenerated visuals so the user keeps the original dialogue/score. When false (default), the new clip\'s own audio is used (LTX renders fresh audio; Seedance V2V depends on generateAudio). Default: false. Set true only when the user explicitly asks to preserve the existing audio; if the user uses an ambiguous phrasing like "with the audio", ask the user to clarify rather than guessing.',
        },
      },
      required: ['startSeconds', 'endSeconds'],
    },
  },
};
