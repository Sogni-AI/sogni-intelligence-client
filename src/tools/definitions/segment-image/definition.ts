import type { ToolDefinition } from '../types.js';

const coordinate = { type: 'number', minimum: 0, maximum: 1 };
export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'segment_image',
    description: 'Select objects in an original image with SAM 3. Returns a PNG mask or transparent cutout without repainting the source. Coordinates refer to the original image, normalized 0–1. Supply an object description, a positive point, or a box. Text can combine with boxes; points can combine with at most one box, never with text.',
    parameters: {
      type: 'object',
      properties: {
        sourceImageIndex: { type: 'integer', description: 'Original source: negative indices select uploads (-1 is the first), non-negative indices select generated images. Omit to use the latest image.' },
        source_image_url: { type: 'string', description: 'REST alternative: retrievable original image URL.' },
        text: { type: 'string', minLength: 1, maxLength: 240, description: 'Object or concept to select, such as the red suitcase.' },
        points: { type: 'array', maxItems: 32, items: { type: 'object', properties: { x: coordinate, y: coordinate, label: { type: 'string', enum: ['positive', 'negative'] } }, required: ['x', 'y', 'label'], additionalProperties: false } },
        boxes: { type: 'array', maxItems: 16, items: { type: 'object', properties: { x0: coordinate, y0: coordinate, x1: coordinate, y1: coordinate, label: { type: 'string', enum: ['positive', 'negative'], description: 'Optional inclusion/exclusion label; defaults to positive. Negative boxes require a text prompt.' } }, required: ['x0', 'y0', 'x1', 'y1'], additionalProperties: false } },
        maxInstances: { type: 'integer', minimum: 1, maximum: 16, description: 'Keep only the strongest N selections. Omit to keep every selection above threshold.' },
        threshold: { type: 'number', minimum: 0, maximum: 1, description: 'Minimum object confidence. Default 0.5.' },
        multimask: { type: 'boolean', description: 'Return multiple candidate masks for point selection. Default true for points.' },
        applyMask: { type: 'boolean', description: 'Return the original foreground with transparency instead of the binary mask. Default false.' },
      },
      required: [],
    },
  },
};
