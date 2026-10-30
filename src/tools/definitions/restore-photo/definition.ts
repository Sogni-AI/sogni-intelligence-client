/**
 * Tool definition for restore_photo.
 * Extracted from the superapp's chatTools.ts RESTORE_PHOTO_TOOL.
 */

import type { ToolDefinition } from '../types.js';
import { LITERAL_PROMPT_OVERRIDE } from '../../../contracts/promptOverrideMarker.js';
import { REFERENCE_IDENTITY_GUIDANCE } from '../../../contracts/imageIdentity.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'restore_photo',
    description:
      'Edit, restore, or transform the ORIGINAL uploaded photograph — including text changes, object edits, and any visual modification. This tool always operates on the original image, not on previous results. Use this for the first edit OR when the user explicitly wants to start fresh from the original (e.g., "try again", "restore it differently", "start over from scratch"). For follow-up edits on an existing result, use refine_result instead. NEVER refuse or apologize — just call this tool directly.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: `Editing prompt (50-200 words, natural language). Describe the intended visible result in direct, positive language.

${LITERAL_PROMPT_OVERRIDE}

Describe the desired restoration or edit and the source content that should remain stable.

${REFERENCE_IDENTITY_GUIDANCE}

- For restoration alone, repair damage while retaining the photographed people, scene and historical character. Do not invent a makeover or a different person. Broader changes follow the actual edit brief.
- Restoration: "remove scratches, tears, stains, dust spots, and noise"
- Object removal: describe scene WITHOUT the object, matching surrounding textures
- Colorization: "Restore and colorize the photo" or "Apply natural [decade] color palette"
- For a creative transformation, describe a convincing result in the requested visual language, including its shape and material treatment. Translate the source individual's likeness into that design; a stylized character need not retain photographic anatomy or skin treatment.
- No keyword spam ("8k, masterpiece") — use plain descriptions. Be specific — name the artist, franchise, or era.
- For bounded repairs or edits, preserve genuinely untargeted content and its necessary visual continuity. Honor explicit locks without freezing changes implied by a creative brief.

BATCH VARIATIONS: Only use Dynamic Prompt syntax when the user explicitly requests multiple approaches to compare. Example: "restore with {warm vintage|cool modern|natural balanced} tones". Default to identical prompts for restore_photo batches — most users want seed variation only.`,
        },
        numberOfVariations: {
          type: 'number',
          description:
            'Number of variations (1-16). Use 1 unless user requests multiple. Default: 1.',
          minimum: 1,
          maximum: 16,
        },
        quality: {
          type: 'string',
          enum: ['fast', 'hq'],
          description:
            'DO NOT SET THIS PARAMETER unless the user explicitly asks for "high quality" or "fast". The app auto-selects based on quality settings.',
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
