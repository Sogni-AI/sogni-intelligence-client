/**
 * Tool definition for add_subtitles.
 *
 * Burns subtitles onto a previously rendered or uploaded video using ffmpeg's
 * `subtitles` filter. The caller may provide cues directly as a structured
 * array, pass a complete SRT/VTT string, or set `auto_transcribe: true` so
 * speech-to-text automatically transcribes spoken speech with word/segment timings.
 */

import type { ToolDefinition } from '../types.js';

export const SUBTITLE_VERTICAL_POSITIONS = ['bottom', 'top', 'center'] as const;

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_subtitles',
    description:
      'Burn subtitles into a video from caller-supplied cues, an SRT/VTT string, or automatic speech-to-text transcription (auto_transcribe=true). ' +
      'Use when the user asks to add captions, subtitles, on-screen dialogue, or burned-in lyrics to a video. ' +
      'Either pass `cues` as an array of {startSeconds, endSeconds, text}, pass a full `srt` string, or set `auto_transcribe=true` when the user wants spoken dialogue in the video subtitled automatically without supplying cue text. ' +
      'Pace caller-authored cues like real subtitles: split the script into multiple short cues (typically 1.5–4 seconds each, ' +
      '~1–8 words per cue, roughly 15–20 characters per second of cue duration). Never burn a single cue that ' +
      'spans the entire clip — even a static image should get progressively revealed lines, not one paragraph ' +
      'held on screen the whole time. ' +
      'If the user explicitly asks you to write, invent, improvise, or make up captions/subtitles, create a few short, ' +
      'generic cue lines yourself and call this tool with cues rather than auto_transcribe; do not ask a follow-up for exact wording in that case.',
    parameters: {
      type: 'object',
      properties: {
        sourceVideoIndex: {
          type: 'number',
          description:
            'Which video to subtitle. Default: -1 (most recent generated or uploaded video). ' +
            'Non-negative values are 0-based indices into prior generated video results. ' +
            'Negative values reference uploaded videos.',
        },
        cues: {
          type: 'array',
          description:
            'Ordered subtitle cues. Each cue has startSeconds, endSeconds, and the line of text to display. ' +
            'Provide `cues`, `srt`, or `auto_transcribe=true`. Aim for multiple short cues (1.5–4s each, ~1–8 words) ' +
            'rather than one long cue spanning the full clip.',
          items: {
            type: 'object',
            properties: {
              startSeconds: { type: 'number', minimum: 0 },
              endSeconds: { type: 'number', minimum: 0 },
              text: { type: 'string' },
            },
            required: ['startSeconds', 'endSeconds', 'text'],
          },
        },
        srt: {
          type: 'string',
          description:
            'Full SRT (or VTT) document as a string, used in place of `cues`. Useful when the user pastes ' +
            'a subtitle file directly. Provide `cues`, `srt`, or `auto_transcribe=true`.',
        },
        auto_transcribe: {
          type: 'boolean',
          description:
            'When true and neither `cues` nor `srt` is supplied, automatically transcribe spoken speech in the source video with word/segment timings and burn paced subtitles onto the video.',
        },
        style: {
          type: 'object',
          description: 'Optional styling overrides for the burned subtitles.',
          properties: {
            fontSizePct: {
              type: 'number',
              minimum: 1,
              maximum: 30,
              description: 'Font size as a percentage of the video height. Default 6.',
            },
            color: {
              type: 'string',
              description: 'Subtitle fill color. Default "#FFFFFF".',
            },
            outlineColor: {
              type: 'string',
              description: 'Subtitle outline color. Default "#000000".',
            },
            position: {
              type: 'string',
              enum: [...SUBTITLE_VERTICAL_POSITIONS],
              description: 'Vertical placement of the subtitle line. Default "bottom".',
            },
          },
        },
      },
    },
  },
};
