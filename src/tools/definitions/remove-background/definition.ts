import type { ToolDefinition } from '../types.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'remove_background',
    description: 'Remove an image background with BiRefNet while preserving the original foreground. Returns a transparent PNG cutout by default, or a soft foreground mask. Uses the original source image without generative repainting; takes no prompt.',
    parameters: {
      type: 'object',
      properties: {
        sourceImageIndex: { type: 'integer', description: 'Original source image: negative indices select uploads (-1 is the first), non-negative indices select generated images. Omit to use the latest image.' },
        source_image_url: { type: 'string', description: 'REST alternative to sourceImageIndex: retrievable source image URL.' },
        applyMask: { type: 'boolean', description: 'True (default) returns a transparent cutout; false returns the soft mask.' },
      },
      required: [],
    },
  },
};
