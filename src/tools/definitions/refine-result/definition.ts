/**
 * Tool definition for refine_result.
 * Extracted from the superapp's chatTools.ts REFINE_RESULT_TOOL.
 */

import type { ToolDefinition } from '../types.js';
import { LITERAL_PROMPT_OVERRIDE } from '../../../contracts/promptOverrideMarker.js';
import { REFERENCE_IDENTITY_GUIDANCE } from '../../../contracts/imageIdentity.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'refine_result',
    description:
      'Make ANY edit to an existing result image. This is the DEFAULT tool for follow-up requests after results exist. Use whenever the user wants to modify, adjust, or build upon a previous result — including brightness, color, sharpening, object removal, background changes, further restoration, or any other edit. If the user does not specify which image, use the most recent result (index 0 if only one result, or the last result the user referenced). Only use restore_photo instead if the user explicitly wants to start over from the original upload.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: `Targeted refinement prompt for Qwen Image Edit 2511 (50-150 words, natural language sentences).

${LITERAL_PROMPT_OVERRIDE}

For a targeted refinement, state the requested change, its necessary consequences, and what should remain stable.

${REFERENCE_IDENTITY_GUIDANCE}

Rules:
- Describe the intended visible result in direct, positive language.
- For a bounded change, use a concise delta instruction and preserve genuinely untargeted content. Keep the existing result as the basis rather than inventing a different image.
- Be specific about what to change: "warmer skin tones", "cooler shadows", "sharper facial features", "more natural greens".
- For creative refinements, realize the full implied transformation: "add more dramatic Rembrandt lighting", "push the colors more toward Warhol neon pop", "make the anime eyes larger and more expressive", "add more superhero energy with glowing effects". Do not countermand that direction with a blanket physical-feature or composition lock.
- Use a compact preservation clause for genuinely untargeted content or explicitly fixed requirements, without freezing changes the brief calls for.

BATCH VARIATIONS: Only use Dynamic Prompt syntax when the user explicitly asks to explore different refinement directions. Example: "refine with {more contrast|softer lighting|richer colors}". Default to identical prompts for refine_result batches.`,
        },
        sourceImageIndex: {
          type: 'number',
          description:
            'Which result image to refine (0-based index). If the user specifies an image number, use that index. If omitted, the latest result is used automatically. When multiple results exist and the user previously referenced a specific one, use that one.',
        },
        numberOfVariations: {
          type: 'number',
          description:
            'Number of variations (1-16). Use 1 unless user requests multiple. Default: 1.',
          minimum: 1,
          maximum: 16,
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
