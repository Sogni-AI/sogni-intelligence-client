import type { MediaDimensionBounds } from './aspectRatio.js';
import { textRequestsProfessionalCharacterSheetImage } from './characterSheet.js';

// Sogni never uses provider-chosen ('auto') quality; it is rejected like any
// unsupported value.
export type GptImageQuality = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type GptImageQualityArg = GptImageQuality;
export type ImageOutputFormat = 'png' | 'jpg' | 'webp';

export const GPT_IMAGE_MODEL_KEY = 'gpt-image-2';
export const GPT_IMAGE_MODEL_IDS = ['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'] as const;
export type GptImageModelId = (typeof GPT_IMAGE_MODEL_IDS)[number];
export const GPT_IMAGE_25_SUNBURST_MODEL_KEY = 'gpt-image-2.5-sunburst';
export const GPT_IMAGE_25_FLARE_MODEL_KEY = 'gpt-image-2.5-flare';

export function isGptImageModel(value: unknown): value is GptImageModelId {
  return typeof value === 'string' && (GPT_IMAGE_MODEL_IDS as readonly string[]).includes(value);
}

export function isGptImage25Model(value: unknown): boolean {
  return value === GPT_IMAGE_25_SUNBURST_MODEL_KEY || value === GPT_IMAGE_25_FLARE_MODEL_KEY;
}

/** Sogni capabilities based on provider docs (2026-09-10); retain the 2.0 integration defaults. */
export function getGptImageCapabilities(modelId: GptImageModelId) {
  const is25 = isGptImage25Model(modelId);
  return {
    modelId,
    qualities: (is25 ? ['low', 'medium', 'high', 'xhigh', 'max'] : ['low', 'medium', 'high']) as readonly GptImageQuality[],
    defaultQuality: 'medium' as const,
    supportsTransparency: is25,
    outputFormats: ['png', 'jpg', 'webp'] as const,
    dimensionStep: 16,
    experimentalAbovePixels: 3_686_400,
  };
}
export const GPT_IMAGE_MIN_PIXELS = 655_360;
export const GPT_IMAGE_MAX_PIXELS = 8_294_400;

export const GPT_IMAGE_DIMENSION_BOUNDS: MediaDimensionBounds = {
  minDimension: 256,
  maxDimension: 3840,
  maxAspectRatio: 3,
  minPixels: GPT_IMAGE_MIN_PIXELS,
  maxPixels: GPT_IMAGE_MAX_PIXELS,
  label: 'GPT Image',
};

export const GPT_IMAGE_QUALITY_BY_TIER: Record<string, GptImageQuality> = {
  fast: 'low',
  hq: 'medium',
  pro: 'high',
};

const GPT_IMAGE_MODEL_ALIAS_VALUES = [
  'chatgpt',
  'chatgpt-image',
  'chat-gpt',
  'chat-gpt-image',
  'openai',
  'openai-image',
  'open-ai',
  'open-ai-image',
  'gpt',
  'gpt-image',
  'gpt2',
  'gpt-2',
  'gpt2-image',
  'gpt-2-image',
  'gptimage2',
  'gpt-image2',
  'gpt-image-2.0',
  GPT_IMAGE_MODEL_KEY,
] as const;

export const GPT_IMAGE_MODEL_ALIASES: ReadonlySet<string> = new Set(GPT_IMAGE_MODEL_ALIAS_VALUES);

const GPT_IMAGE_25_ALIASES: Readonly<Record<string, GptImageModelId>> = {
  'gpt-image-2.5-sunburst': GPT_IMAGE_25_SUNBURST_MODEL_KEY,
  'gpt-image-2.5-flare': GPT_IMAGE_25_FLARE_MODEL_KEY,
  'gpt-image-2.5': GPT_IMAGE_25_FLARE_MODEL_KEY,
  'gpt-image2.5': GPT_IMAGE_25_FLARE_MODEL_KEY,
  sunburst: GPT_IMAGE_25_SUNBURST_MODEL_KEY,
  flare: GPT_IMAGE_25_FLARE_MODEL_KEY,
};

const VERSIONED_NON_GPT_IMAGE_MODEL_NAME_PATTERN = String.raw`(?:flux(?:[\s.-]?(?:1|2|one|two|krea))|qwen(?:[\s.-]?(?:image|2512|edit|lightning))|krea(?:[\s.-]?(?:2|two))?(?:[\s.-]?(?:turbo|identity|edit|lora|v?1\.?2))*|dark[\s.-]?beast(?:[\s.-]?(?:krea(?:[\s.-]?2|2)?|z(?:[-\s]?image)?|identity|edit|turbo))*|z[-\s]?image|z[-\s]?turbo|chroma[-\s]?(?:1[-\s]?hd|detail|flash|v?\.?46)|one[-\s]?obsession(?:[-\s]?v?2\.?2)?|pony[-\s]?v?\d+|sdxl|albedo(?:[-\s]?xl)?|animagine(?:[-\s]?xl)?|anima\s*pencil(?:[-\s]?xl)?|art\s*universe(?:[-\s]?xl)?|hyphoria|analog\s*madness(?:[-\s]?xl)?|cyberrealistic(?:[-\s]?xl)?|real\s*dream(?:[-\s]?xl)?|faetastic(?:[-\s]?xl)?|zavychroma(?:[-\s]?xl)?|pony[-\s]?faetality|dreamshaper(?:[-\s]?xl)?)`;
const FAMILY_NON_GPT_IMAGE_MODEL_NAME_PATTERN = String.raw`(?:flux|qwen|chroma|krea|dark[\s.-]?beast)`;
const EXPLICIT_ADULT_IMAGE_REQUEST_PATTERN = /\b(?:nude|nudity|naked|topless|porn|pornographic|explicit\s+sex|hardcore|nsfw)\b/i;
const GPT_IMAGE_TOOL_NAMES = new Set(['generate_image', 'edit_image']);

export function normalizeGptImageModelAlias(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (Object.prototype.hasOwnProperty.call(GPT_IMAGE_25_ALIASES, normalized)) return GPT_IMAGE_25_ALIASES[normalized];
  if (GPT_IMAGE_MODEL_ALIASES.has(normalized)) return GPT_IMAGE_MODEL_KEY;
  return value;
}

export function textRequestsGptImage2ImageModel(text: string): boolean {
  if (!text) return false;
  const hasGptImageTerm = /\b(?:chat\s*gpt|chatgpt|open\s*ai|openai|gpt(?:[-\s]?2)?|gpt\s*image(?:\s*2)?|gpt-image-2)\b/i.test(text);
  if (!hasGptImageTerm) return false;
  return /\b(?:images?|pictures?|photos?|portraits?|illustrations?|artwork|graphics?|renders?|text[-\s]?to[-\s]?image|generate|create|draw|render|make)\b/i.test(text);
}

export function textExplicitlyAvoidsGptImageModel(text: string): boolean {
  return /\b(?:do\s+not|don't|dont|never|avoid|without|no|not)\s+(?:use\s+)?(?:chat\s*gpt|chatgpt|open\s*ai|openai|gpt(?:[-\s]?2)?|gpt\s*image(?:\s*2)?|gpt-image-2)\b/i.test(text)
    || /\b(?:anything|any\s+model)\s+(?:but|except)\s+(?:chat\s*gpt|chatgpt|open\s*ai|openai|gpt(?:[-\s]?2)?|gpt\s*image(?:\s*2)?|gpt-image-2)\b/i.test(text);
}

export function textExplicitlyRequestsNonGptImageModel(text: string): boolean {
  if (!text || textRequestsGptImage2ImageModel(text)) return false;

  const versionedModel = new RegExp(
    String.raw`\b(?:use|using|with|via|through|choose|select|switch\s+to|model|renderer)\b[\s\S]{0,60}\b${VERSIONED_NON_GPT_IMAGE_MODEL_NAME_PATTERN}\b|\b${VERSIONED_NON_GPT_IMAGE_MODEL_NAME_PATTERN}\b[\s\S]{0,40}\b(?:model|renderer)\b`,
    'i',
  );
  if (versionedModel.test(text)) return true;

  const familyModel = new RegExp(
    String.raw`\b(?:use|using|with|via|through|choose|select|switch\s+to)\s+(?:the\s+)?${FAMILY_NON_GPT_IMAGE_MODEL_NAME_PATTERN}\b(?=\s*(?:to|for|as|(?:image\s+)?(?:model|renderer)\b|$|[.,;:]))|\b${FAMILY_NON_GPT_IMAGE_MODEL_NAME_PATTERN}\s+(?:image\s+)?(?:model|renderer)\b`,
    'i',
  );
  if (familyModel.test(text)) return true;

  return /\b(?:use|using|with|via|through|choose|select|switch\s+to)\b[\s\S]{0,80}\b(?:default|standard|regular|usual|current|existing|native|original|legacy|classic|another|different|alternate|non[-\s]?gpt|non[-\s]?openai|not\s+(?:gpt|openai))\s+(?:image\s+)?(?:model|renderer)\b/i.test(text);
}

function textMentionsImageRenderIntent(text: string): boolean {
  return /\b(?:generate|create|make|render|produce|design|build|develop|draw)\b[\s\S]{0,180}\b(?:images?|pictures?|photos?|portraits?|posters?|artwork|illustrations?|graphics?|renders?|story\s*board|storyboard|contact\s*sheet|mood\s*board|moodboard|shot\s*sheet|sequence\s*sheet|panel\s*(?:layout|grid|sheet))\b/i.test(text)
    || /\b(?:images?|pictures?|photos?|portraits?|posters?|artwork|illustrations?|graphics?|renders?|story\s*board|storyboard|contact\s*sheet|mood\s*board|moodboard|shot\s*sheet|sequence\s*sheet|panel\s*(?:layout|grid|sheet))\b[\s\S]{0,120}\b(?:generate|create|make|render|produce|design|build|draw)\b/i.test(text)
    || textRequestsProfessionalCharacterSheetImage(text);
}

function textRequestsVideoFromStoryboardReference(text: string): boolean {
  return /\b(?:generate|create|make|render|produce|turn|animate|convert|transform)\b[\s\S]{0,100}\b(?:videos?|clips?|animations?|movies?|films?)\b[\s\S]{0,140}\b(?:using|with|from|based\s+on|following)\b[\s\S]{0,100}\b(?:story\s*board|storyboard)(?:\s+(?:image|photo|picture|reference))?\b/i.test(text)
    || /\b(?:turn|convert|transform|animate)\b[\s\S]{0,120}\b(?:story\s*board|storyboard)\b[\s\S]{0,80}\b(?:into|to|as)\s+(?:a\s+|the\s+)?(?:videos?|clips?|animations?|movies?|films?)\b/i.test(text);
}

export function textSuggestsGptImage2DefaultImageModel(text: string): boolean {
  if (!text || textRequestsVideoFromStoryboardReference(text)) return false;

  const hasImageIntent = textMentionsImageRenderIntent(text);
  if (!hasImageIntent) return false;

  const asksForStoryboardImage =
    /\b(?:story\s*board|storyboard|shot\s*sheet|sequence\s*sheet|thumbnail\s*sequence|panel\s*(?:layout|grid|sheet)|multi[-\s]?panel|contact\s*sheet|mood\s*board|moodboard)\b/i.test(text)
    && /\b(?:images?|render|sheet|layout|grid|panel|panels|poster|illustration|artwork|design|board|sequence|production[-\s]?ready|timing|shot labels?|foley|captions?|model|first)\b/i.test(text);
  const asksForCharacterSheetImage = textRequestsProfessionalCharacterSheetImage(text);
  const asksForVideoStoryboardImage =
    /\b(?:generate|create|make|render|produce|design|build|develop|draw)\b[\s\S]{0,180}\b(?:video\s+)?(?:story\s*board|storyboard)(?:\s+(?:sequence|sheet|layout|panel|panels|board))?\b/i.test(text)
    || /\b(?:turn|convert|transform)\b[\s\S]{0,80}\binto\b[\s\S]{0,120}\b(?:video\s+)?(?:story\s*board|storyboard)(?:\s+(?:sequence|sheet|layout|panel|panels|board))?\b/i.test(text)
    || /\b(?:story\s*board|storyboard)\b[\s\S]{0,80}\bfirst\b/i.test(text)
    || /\bfirst\b[\s\S]{0,80}\b(?:story\s*board|storyboard)\b/i.test(text);
  const asksForComplexRender =
    /\b(?:very|highly|extremely|especially|super)\s+(?:complex|detailed|intricate|elaborate)\b[\s\S]{0,80}\b(?:images?|renders?|illustrations?|artwork|posters?|graphics?|story\s*boards?|storyboards?|contact\s*sheet|mood\s*board|moodboard|shot\s*sheet|sequence\s*sheet|panel\s*(?:layout|grid|sheet))\b/i.test(text)
    || /\b(?:images?|renders?|illustrations?|artwork|posters?|graphics?|story\s*boards?|storyboards?|contact\s*sheet|mood\s*board|moodboard|shot\s*sheet|sequence\s*sheet|panel\s*(?:layout|grid|sheet))\b[\s\S]{0,80}\b(?:very|highly|extremely|especially|super)\s+(?:complex|detailed|intricate|elaborate)\b/i.test(text);
  const asksForTextOrLayoutPrecision =
    /\b(?:crisp|readable|precise|clean)\s+(?:typography|text|labels?|caption|captions|callouts?)\b/i.test(text)
    || /\b(?:timing labels?|foley notes?|shot labels?|scene labels?|captioned panels?|dense labels?|ui callouts?|infographic|diagram|blueprint|technical poster|product spec sheet)\b/i.test(text);

  return asksForStoryboardImage || asksForCharacterSheetImage || asksForVideoStoryboardImage || asksForComplexRender || asksForTextOrLayoutPrecision;
}

const GPT_IMAGE_25_REQUEST_PATTERN = /\bgpt[-\s]*image[-\s]*2\.5(?:[-\s]*\(?\s*(sunburst|flare))?\b/i;
const GPT_IMAGE_25_NAMED_VARIANT_PATTERN = /\b(?:use|using|with)\s+(sunburst|flare)\s+(?:image\s+)?model\b/i;

/**
 * The GPT Image 2.5 variant a message asks for by name: the variant,
 * 'unspecified' when it names GPT Image 2.5 without one, or null when it does
 * not ask for GPT Image 2.5.
 */
export function textRequestedGptImage25Variant(
  text: string | null | undefined,
): typeof GPT_IMAGE_25_SUNBURST_MODEL_KEY | typeof GPT_IMAGE_25_FLARE_MODEL_KEY | 'unspecified' | null {
  if (!text) return null;
  const requested = text.match(GPT_IMAGE_25_REQUEST_PATTERN);
  const named = text.match(GPT_IMAGE_25_NAMED_VARIANT_PATTERN);
  if (!requested && !named) return null;
  const variant = (requested?.[1] ?? named?.[1])?.toLowerCase();
  if (variant === 'sunburst') return GPT_IMAGE_25_SUNBURST_MODEL_KEY;
  if (variant === 'flare') return GPT_IMAGE_25_FLARE_MODEL_KEY;
  return 'unspecified';
}

export function getGptImage2ModelOverride(
  toolName: string,
  currentModel: unknown,
  latestUserText: string,
): string | null {
  if (!GPT_IMAGE_TOOL_NAMES.has(toolName)) return null;
  if (textExplicitlyAvoidsGptImageModel(latestUserText)) return null;

  // Exact version requests take precedence over generic GPT routing and a
  // previously selected model. Avoid interpreting an unspecified variant as 2.0.
  const requested25 = textRequestedGptImage25Variant(latestUserText);
  if (requested25) {
    // A variant named elsewhere in the message ("the Sunburst variant of GPT
    // Image 2.5") is left to the model's own 2.5 selection.
    if (requested25 === 'unspecified' && isGptImage25Model(currentModel)) return null;
    const requested = requested25 === 'unspecified' ? GPT_IMAGE_25_FLARE_MODEL_KEY : requested25;
    return currentModel === requested ? null : requested;
  }
  if (/\bgpt[-\s]*image[-\s]*2(?:\.0)?(?![.\d])\b/i.test(latestUserText)) {
    return currentModel === GPT_IMAGE_MODEL_KEY ? null : GPT_IMAGE_MODEL_KEY;
  }
  const normalizedModel = normalizeGptImageModelAlias(currentModel);
  if (isGptImageModel(normalizedModel)) {
    return currentModel === normalizedModel ? null : normalizedModel;
  }

  const explicitlyRequestedGptImage = textRequestsGptImage2ImageModel(latestUserText);
  const shouldUseComplexRenderDefault =
    !explicitlyRequestedGptImage
    && !textExplicitlyRequestsNonGptImageModel(latestUserText)
    && !EXPLICIT_ADULT_IMAGE_REQUEST_PATTERN.test(latestUserText)
    && textSuggestsGptImage2DefaultImageModel(latestUserText);

  return explicitlyRequestedGptImage || shouldUseComplexRenderDefault
    ? GPT_IMAGE_MODEL_KEY
    : null;
}

export function normalizeGptImageQuality(value: unknown, modelId?: GptImageModelId): GptImageQualityArg | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['low', 'fast', 'draft', 'quick'].includes(normalized)) return 'low';
  if (['medium', 'standard', 'balanced', 'hq'].includes(normalized)) return 'medium';
  if (['high', 'pro', 'best', 'final'].includes(normalized)) return 'high';
  if (normalized === 'xhigh' || normalized === 'max') {
    if (modelId && !isGptImage25Model(modelId)) {
      throw new RangeError(`${normalized} quality requires GPT Image 2.5 Sunburst or Flare`);
    }
    return normalized;
  }
  return undefined;
}

export function normalizeImageOutputFormat(value: unknown): ImageOutputFormat | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'png' || normalized === 'webp') return normalized;
  if (normalized === 'jpg' || normalized === 'jpeg') return 'jpg';
  return undefined;
}

/** Short-side target (in pixels) for GPT Image 2 high-detail renders. */
export const GPT_IMAGE_HIGH_DETAIL_SHORT_SIDE = 1440;

const HIGH_DETAIL_STORYBOARD_PATTERN =
  /\b(?:story\s*board|storyboard|panel|panels|scene\s+cell|caption|captions|timing labels?|shot labels?|foley notes?|text rendering)\b/i;
const HIGH_DETAIL_SMALL_TYPE_PATTERN =
  /\b(?:small type|readable labels?|concise labels?|visible text|scene number|timing|captions?|brand copy|cta|logo|wordmark)\b/i;

/**
 * Detects prompts that benefit from GPT Image 2's high-detail mode
 * (storyboards, panel sheets, brand cards with small type). Both the
 * chat client and the cloud chat-runs executor call this to bump the
 * short-side dimension when the LLM omits an explicit width/height —
 * keeping cloud renders at parity with client renders for the same
 * prompt shape.
 */
export function promptNeedsHighDetailGptImage(prompt: string | null | undefined): boolean {
  const text = prompt ?? '';
  return HIGH_DETAIL_STORYBOARD_PATTERN.test(text) && HIGH_DETAIL_SMALL_TYPE_PATTERN.test(text);
}

/** Preserve explicit advanced options across tool execution, confirmation and replay. */
export function getGptImageRequestOptions(args: Record<string, unknown>, modelId: string): {
  gptImageBackground?: 'auto' | 'opaque' | 'transparent';
  gptImageOutputCompression?: number;
  gptImageMaskUrl?: string;
} {
  const background = args.gptImageBackground ?? args.gpt_image_background;
  const compression = args.gptImageOutputCompression ?? args.gpt_image_output_compression;
  const mask = args.mask_image_url ?? args.gptImageMaskUrl;
  if (background === undefined && compression === undefined && mask === undefined) return {};
  if (!isGptImageModel(modelId)) throw new Error('GPT Image options require a GPT Image model');
  const format = normalizeImageOutputFormat(args.outputFormat ?? args.output_format) ?? 'png';
  if (background !== undefined && !['auto', 'opaque', ...(isGptImage25Model(modelId) ? ['transparent'] : [])].includes(String(background))) throw new Error('Unsupported GPT Image background');
  if (background === 'transparent' && format === 'jpg') throw new Error('Transparent output requires PNG or WebP');
  if (compression !== undefined && (typeof compression !== 'number' || !Number.isInteger(compression) || compression < 0 || compression > 100 || format === 'png')) throw new Error('Output compression requires JPEG/WebP and an integer from 0 to 100');
  if (mask !== undefined && (typeof mask !== 'string' || !mask.trim())) throw new Error('mask_image_url must be a non-empty PNG URL or data URI');
  return {
    ...(background !== undefined ? { gptImageBackground: background as 'auto' | 'opaque' | 'transparent' } : {}),
    ...(compression !== undefined ? { gptImageOutputCompression: compression as number } : {}),
    ...(mask !== undefined ? { gptImageMaskUrl: mask as string } : {}),
  };
}
