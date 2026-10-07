/**
 * Tool definition for extend_video.
 *
 * Adds time to the end of an existing rendered video clip. The tool extracts
 * the final frame (LTX) or trailing reference segment (Seedance) of the base
 * video, renders a continuation through the appropriate model, and splices
 * the new segment onto the original. Returns BOTH the standalone new segment
 * and the spliced composite so the user can choose to keep, regenerate, or
 * download either.
 */

import type { ToolDefinition } from '../types.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'extend_video',
    description:
      'Extend a video by adding new time to the end. Works on BOTH videos previously rendered in this session AND user-uploaded videos — set videoIndex to a negative number (e.g. -1) to target an uploaded video when no prior render exists. The base video is auto-selected from the most recent video in this session unless videoIndex is set. ' +
      'For LTX 2.5/2.3 base clips, the tool extracts the last frame and renders an image-to-video continuation; new non-Seedance continuations default to LTX 2.5. ' +
      'For Seedance base clips, the tool extracts a trailing reference segment and renders a video-to-video continuation. ' +
      'Returns both the standalone new segment and a spliced composite (base + new segment).' +
      ' Use when the user asks to "make it longer", "extend the video", "add another N seconds", "continue the scene", "add an outro/bumper to the end", etc.' +
      ' Prefer this over generate_image+animate_photo+stitch_video for "add a bumper/outro to this video" — extend_video preserves the original base bytes, audio, and timing instead of re-encoding them.' +
      ' Do not use this tool to render fresh videos from scratch — call generate_video or animate_photo for that.' +
      ' Output durations follow each model\'s native limits (LTX 2-20s, Seedance 4-15s) for the new segment alone.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'What should happen during the extension — describe motion, action, dialogue, and audio for the appended seconds, NOT the entire video. ' +
            'For LTX continuations, preserve user-provided spoken dialogue in double quotes; if speech is requested without exact words, describe the delivery without inventing quoted dialogue. ' +
            'If the user did not specify what should happen, write a brief continuation that preserves the existing tone (e.g. "the scene continues with the same camera and pacing").',
        },
        duration: {
          type: 'number',
          description:
            'Length in seconds of the new appended segment (NOT total final length). LTX 2-20, Seedance 2.0/Mini/Mini Uncensored 4-15, Seedance 2.5 4-30. Default: 5.',
          minimum: 2,
          maximum: 30,
        },
        videoIndex: {
          type: 'number',
          description:
            'Which video result to extend. Default: -1 (most recent video in this session). ' +
            'Use 0-based non-negative indices for prior tool result videos. Use negative indices for uploaded videos: -1 = most recent video result OR first uploaded video when no prior render exists.',
        },
        videoModel: {
          type: 'string',
          enum: ['auto', 'ltx25', 'ltx23', 'seedance2', 'seedance2-mini', 'seedance2-mini-uncensored', 'seedance2-5', 'seedance2-5-uncensored'],
          description:
            'Which model to use for the new segment. Default: "auto" — preserve Seedance for a Seedance base and otherwise use LTX 2.5. Use ltx23 only for explicit rollback. "seedance2-5-uncensored" is Seedance 2.5 Uncensored and "seedance2-mini-uncensored" is Seedance 2.0 Mini Uncensored (the same 480p/720p and 4-15s of new footage as "seedance2-mini"); use either only when the user asks for it. Override only when the user explicitly requests a different model.',
        },
        keepOriginalAudio: {
          type: 'boolean',
          description:
            'Has no effect for extend_video (the new segment is appended after the base, so the base audio is always preserved through the original portion and the new segment carries its own audio). Reserved for parity with replace_video_segment.',
        },
      },
      required: ['duration'],
    },
  },
};
