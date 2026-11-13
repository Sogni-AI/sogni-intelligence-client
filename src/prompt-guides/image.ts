/**
 * Image prompt guides. The per-family guide text already lives in this package
 * (`contracts/imagePrompt.ts`, the guide every Sogni image prompt writer reads); the notes below are
 * the image creative-planning profiles' guidance, moved verbatim from @sogni/creative-agent 2.27.8
 * (src/prompts/creativePlanning.ts).
 */

import { PROMPTING_GUIDES, type ImagePromptingType } from '../contracts/imagePrompt.js';
import {
  modelPromptGuide,
  type ImagePromptGuideFamily,
  type ModelPromptGuide,
  type ModelPromptGuideRegistry,
} from './types.js';

/** The `qwen-image-edit` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const QWEN_IMAGE_EDIT_NOTES: readonly string[] = [
  'Describe the intended edit directly and preserve unmentioned composition, identity, lighting, and scene details.',
  'When multiple reference images are supplied, identify their roles in order and state which traits should transfer from each one.',
];

/** The `sdxl` creative-planning profile's guidance (enhance_prompt model assumptions), verbatim. */
const SDXL_NOTES: readonly string[] = [
  'Keep positive and negative prompt concepts separated.',
  'Use concrete visual descriptors instead of long prose when targeting classic diffusion models.',
];

function imageGuide(
  family: ImagePromptGuideFamily,
  operation: 'generate' | 'edit',
  modelTitle: string,
  promptingType: ImagePromptingType,
  models: readonly string[],
  notes: readonly string[] = [],
): ModelPromptGuide {
  return modelPromptGuide({
    family,
    mode: operation,
    title: `${modelTitle} ${operation === 'edit' ? 'image editing' : 'text-to-image'}`,
    models,
    referenceGrammar: null,
    rules: [PROMPTING_GUIDES[promptingType]],
    notes,
  });
}

export const IMAGE_PROMPT_GUIDES: Pick<ModelPromptGuideRegistry, ImagePromptGuideFamily> = {
  chroma: { generate: imageGuide('chroma', 'generate', 'Chroma', 'chroma', ['chroma1-hd', 'chroma-v46-flash']) },
  'flux1-schnell': { generate: imageGuide('flux1-schnell', 'generate', 'FLUX.1 Schnell', 'flux1-schnell', ['flux1-schnell']) },
  sdxl: { generate: imageGuide('sdxl', 'generate', 'Stable Diffusion XL', 'sdxl', ['sdxl', 'dreamshaper-xl'], SDXL_NOTES) },
  sd15: { generate: imageGuide('sd15', 'generate', 'Stable Diffusion 1.5', 'sd15', ['sd15']) },
  pony: { generate: imageGuide('pony', 'generate', 'Pony Diffusion XL', 'pony', ['pony', 'pony-v7']) },
  fast: { generate: imageGuide('fast', 'generate', 'Fast distilled Stable Diffusion', 'fast', ['sdxl-turbo', 'sdxl-lightning', 'lcm']) },
  sd3: { generate: imageGuide('sd3', 'generate', 'Stable Diffusion 3', 'sd3', ['sd3']) },
  krea2: {
    generate: imageGuide('krea2', 'generate', 'Krea 2', 'krea2', ['krea-2', 'krea2-turbo', 'dark-beast-krea2']),
    edit: imageGuide('krea2', 'edit', 'Krea 2 Identity Edit', 'krea2-edit', ['krea2-identity-edit', 'dark-beast-krea2-identity-edit']),
  },
  'moss-image': { generate: imageGuide('moss-image', 'generate', 'MOSS-Image', 'moss-image', ['moss-image', 'moss-image-8step']) },
  'flux3-klein': {
    generate: imageGuide('flux3-klein', 'generate', 'FLUX 3 Image Klein', 'flux3-klein', ['flux-3-klein']),
    edit: imageGuide('flux3-klein', 'edit', 'FLUX 3 Image Klein', 'flux3-klein-edit', ['flux-3-klein']),
  },
  qwen: {
    generate: imageGuide('qwen', 'generate', 'Qwen Image 2512', 'qwen', ['qwen-image-2512', 'qwen-image-2512-lightning']),
    edit: imageGuide('qwen', 'edit', 'Qwen Image Edit 2511', 'qwen-edit', ['qwen', 'qwen-image-edit-2511'], QWEN_IMAGE_EDIT_NOTES),
  },
  'z-image': { generate: imageGuide('z-image', 'generate', 'Z-Image', 'z-image', ['z-image', 'z-image-turbo', 'dark-beast-z-image-turbo']) },
  'gpt-image': {
    generate: imageGuide('gpt-image', 'generate', 'GPT Image 2', 'gpt-image', ['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2.6-sunburst', 'gpt-image-2.6-flare']),
    edit: imageGuide('gpt-image', 'edit', 'GPT Image 2', 'gpt-image-edit', ['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2.6-sunburst', 'gpt-image-2.6-flare']),
  },
  seedream: {
    generate: imageGuide('seedream', 'generate', 'Seedream 5.0 Pro Uncensored', 'seedream', ['seedream-5-pro-uncensored']),
    edit: imageGuide('seedream', 'edit', 'Seedream 5.0 Pro Uncensored', 'seedream-edit', ['seedream-5-pro-uncensored']),
  },
  'seedream-5.5': {
    generate: imageGuide('seedream-5.5', 'generate', 'Seedream 5.5 Uncensored', 'seedream-5-5', ['seedream-5-5-uncensored']),
    edit: imageGuide('seedream-5.5', 'edit', 'Seedream 5.5 Uncensored', 'seedream-5-5-edit', ['seedream-5-5-uncensored']),
  },
};

/**
 * The guide each image prompting type resolves to. A new prompting type fails to compile here until
 * it is given a guide or explicitly none ('editing' and 'video' are not model families; 'flux' is the
 * legacy key that shares the Chroma guide).
 */
export const IMAGE_PROMPT_GUIDE_KEYS: Readonly<Record<ImagePromptingType, readonly [ImagePromptGuideFamily, 'generate' | 'edit'] | null>> = {
  flux: ['chroma', 'generate'],
  'flux1-schnell': ['flux1-schnell', 'generate'],
  chroma: ['chroma', 'generate'],
  sdxl: ['sdxl', 'generate'],
  sd15: ['sd15', 'generate'],
  pony: ['pony', 'generate'],
  fast: ['fast', 'generate'],
  sd3: ['sd3', 'generate'],
  editing: null,
  krea2: ['krea2', 'generate'],
  'moss-image': ['moss-image', 'generate'],
  'flux3-klein': ['flux3-klein', 'generate'],
  qwen: ['qwen', 'generate'],
  'z-image': ['z-image', 'generate'],
  'gpt-image': ['gpt-image', 'generate'],
  'qwen-edit': ['qwen', 'edit'],
  'krea2-edit': ['krea2', 'edit'],
  'flux3-klein-edit': ['flux3-klein', 'edit'],
  'gpt-image-edit': ['gpt-image', 'edit'],
  seedream: ['seedream', 'generate'],
  'seedream-edit': ['seedream', 'edit'],
  'seedream-5-5': ['seedream-5.5', 'generate'],
  'seedream-5-5-edit': ['seedream-5.5', 'edit'],
  video: null,
};
