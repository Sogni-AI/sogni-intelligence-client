/**
 * Tool definition for apply_style.
 * Extracted from the superapp's chatTools.ts APPLY_STYLE_TOOL.
 */

import type { ToolDefinition } from '../types.js';
import { LITERAL_PROMPT_OVERRIDE } from '../../../contracts/promptOverrideMarker.js';
import { REFERENCE_IDENTITY_GUIDANCE } from '../../../contracts/imageIdentity.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'apply_style',
    description:
      'Apply an artistic style, era-specific look, or creative transformation to a photo. Use when the user wants to change the visual style (e.g., "make it look like the 70s", "oil painting style", "vintage polaroid look"). Can handle any creative transformation. One style per call. IMPORTANT: When previous results exist, this tool automatically uses the LATEST result image unless you specify a different sourceImageIndex or the user explicitly says "original". So just call it without sourceImageIndex for follow-up requests.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: `Style prompt for Qwen Image Edit 2511 (50-200 words, natural language sentences).

${LITERAL_PROMPT_OVERRIDE}

Describe the requested visual treatment and identify the source subject when its identity should carry into the result.

${REFERENCE_IDENTITY_GUIDANCE}

Rules:
- Describe the intended visible result in direct, positive language.
- A palette or photographic finish change keeps genuinely untargeted content stable. A character or medium transformation may require new shape language, proportions, anatomy, surface treatment or composition to realize the requested design.
- Reference known art styles, artists, and franchises BY NAME to anchor the style — be specific, never generic.
- Describe specific visual characteristics: brushstrokes, color palette, texture, composition approach, mood.
- For era looks: describe the photographic qualities of that era (e.g., "warm faded Kodachrome tones with soft vignette, typical of 1970s amateur photography").
- Go bold with pop culture and iconic styles: "Andy Warhol pop art with bold neon screen-print colors", "Banksy stencil street art with gritty urban textures", "Studio Ghibli watercolor with soft pastoral warmth", "Pixar 3D render with glossy skin and exaggerated features", "Tim Burton gothic with pale skin and dark spiraling backgrounds", "Van Gogh Starry Night with thick impasto swirls and vibrant blues", "Takashi Murakami superflat with psychedelic flowers and bold outlines".
- Preserve explicitly fixed elements and use a compact preservation clause only where it helps this particular transformation.`,
        },
        sourceImageIndex: {
          type: 'number',
          description:
            'Which result image to apply the style to (0-based index). Omit to use the latest result automatically (or the original if no results exist). Only set explicitly when the user specifies a particular image number or explicitly says "original" (use -1 for original).',
        },
        scale: {
          type: 'number',
          enum: [1, 1.5, 2, 3, 4],
          description:
            'Output scale multiplier relative to the source image size. 1 = same resolution as source (default). Use higher values when user asks to upscale, enlarge, make bigger, or increase resolution. Small images (<480px) are automatically upscaled to at least 480px regardless of this setting. Default: 1.',
        },
        aspectRatio: {
          type: 'string',
          description: ASPECT_RATIO_DESCRIPTION,
        },
      },
      required: ['prompt'],
    },
  },
};
