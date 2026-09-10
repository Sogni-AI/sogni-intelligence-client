/** Tool definition for promptless FlashVSR video upscaling. */

import { VIDEO_UPSCALE_TARGET_RESOLUTIONS } from '../../../media/videoUpscale.js';
import type { ToolDefinition } from '../types.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'upscale_video',
    description:
      'Upscale an existing video to 1080p or 1440p with FlashVSR video super-resolution. ' +
      'This is promptless, deterministic enhancement, not a generative edit: it keeps every source frame, ' +
      'the exact frame rate, the full aspect ratio, and the original audio, and it never changes content, ' +
      'trims, crops, restyles, or interpolates frames. Use it when the user asks to upscale, enlarge, sharpen, ' +
      'or increase the resolution of an uploaded or previously generated video, or wants an HD, 1080p, 1440p, ' +
      'or 2K copy of it. Do not use it to create, restyle, extend, or edit a video; when the user explicitly ' +
      'asks a generative model such as Seedance to re-render the clip, use video_to_video. The output is at most ' +
      'twice the source size, so 1080p needs a source whose short edge is 540-768px and 1440p needs 720-768px. ' +
      'The source must also be at most 362 frames and about 15 seconds long, 1-60 fps, and 100 MB. ' +
      "Each upscale costs credits based on the source video's size and length.",
    parameters: {
      type: 'object',
      properties: {
        sourceVideoIndex: {
          type: 'number',
          description:
            'Source video to upscale. Non-negative values select a prior generated video result by 0-based index. ' +
            'Negative values select uploaded videos: -1 is the first uploaded video, -2 the second, and so on. ' +
            'If omitted, use the latest generated video, falling back to the most recent uploaded video.',
        },
        targetResolution: {
          type: 'number',
          enum: [...VIDEO_UPSCALE_TARGET_RESOLUTIONS],
          description:
            'Output resolution of the short edge in pixels: 1440 for 1440p/2K or 1080 for 1080p/Full HD. ' +
            'The long edge follows the source aspect ratio, so portrait videos stay portrait. ' +
            "Default: 1440, or 1080 when the source's short edge is below 720px. Set 1080 when the user asks for 1080p or Full HD.",
        },
      },
      required: [],
    },
  },
};
