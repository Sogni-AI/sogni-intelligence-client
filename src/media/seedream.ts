/**
 * Seedream 5.0 Pro Uncensored (`seedream-5-0-pro-uncensored`) and Seedream 5.5
 * Uncensored (`seedream-5-5-uncensored`).
 *
 * BytePlus Seedream 5.0 Pro and Seedream 5.5 on Sogni's uncensored BytePlus
 * account, external-API image models for text-to-image and image edits with
 * 1-10 reference images. Both are premium (Spark only, like GPT Image) and need
 * the same one-time likeness and consent agreement as Seedance 2.5 Uncensored
 * (agreement key `seedance-2-5-uncensored`): until the account accepts it the
 * socket refuses every job with error 4103 (see modelConsentRequired.ts).
 *
 * There is no filtered Seedream model on Sogni, and the uncensored models are
 * chosen only when the user asks for them, exactly as Seedance 2.5 Uncensored
 * is. Every existing Seedream name keeps meaning 5.0 Pro; 5.5 is chosen only
 * when the user names 5.5. Each model id is the tool selector too: it is
 * byte-identical everywhere.
 */

export const SEEDREAM_5_PRO_UNCENSORED_MODEL_ID = 'seedream-5-0-pro-uncensored';
export const SEEDREAM_5_PRO_UNCENSORED_DISPLAY_NAME = 'Seedream 5.0 Pro Uncensored';

export const SEEDREAM_5_5_UNCENSORED_MODEL_ID = 'seedream-5-5-uncensored';
export const SEEDREAM_5_5_UNCENSORED_DISPLAY_NAME = 'Seedream 5.5 Uncensored';

export type SeedreamImageModelId =
  | typeof SEEDREAM_5_PRO_UNCENSORED_MODEL_ID
  | typeof SEEDREAM_5_5_UNCENSORED_MODEL_ID;

/** Seedream edits take one to ten reference images (5.0 Pro and 5.5). */
export const SEEDREAM_MAX_REFERENCE_IMAGES = 10;

/** Total output pixels Seedream 5.0 Pro accepts (1280x720 through 2048x2048). */
export const SEEDREAM_MIN_PIXELS = 921_600;
export const SEEDREAM_MAX_PIXELS = 4_194_304;
/** Widest aspect ratio either way (1:16 through 16:1), for both models. */
export const SEEDREAM_MAX_ASPECT_RATIO = 16;

/** Seedream 5.5 accepts the same minimum and up to 2048 x 2048 x 1.1025 pixels. */
export const SEEDREAM_5_5_MIN_PIXELS = SEEDREAM_MIN_PIXELS;
export const SEEDREAM_5_5_MAX_PIXELS = 4_624_220;

/** Both models default to 1536x1536. */
export const SEEDREAM_DEFAULT_WIDTH = 1536;
export const SEEDREAM_DEFAULT_HEIGHT = 1536;

/** BytePlus's recommended Seedream 5.0 Pro sizes, lower price tier first. */
export const SEEDREAM_IMAGE_SIZES = Object.freeze([
  '1024x1024',
  '1152x864',
  '864x1152',
  '1280x720',
  '720x1280',
  '1248x832',
  '832x1248',
  '1512x648',
  '1536x1536',
  '2048x2048',
  '2304x1728',
  '1728x2304',
  '2560x1440',
  '1440x2560',
  '2496x1664',
  '1664x2496',
  '3024x1296',
] as const);

/** BytePlus's native Seedream 5.5 sizes (1K, 1.5K and 2K), lower price tier first. */
export const SEEDREAM_5_5_IMAGE_SIZES = Object.freeze([
  '1024x1024',
  '1152x864',
  '864x1152',
  '1424x800',
  '800x1424',
  '1248x832',
  '832x1248',
  '1568x672',
  '1536x1536',
  '1792x1344',
  '1344x1792',
  '2048x1152',
  '1152x2048',
  '1872x1248',
  '1248x1872',
  '2352x1008',
  '2048x2048',
  '2368x1776',
  '1776x2368',
  '2816x1584',
  '1584x2816',
  '2496x1664',
  '1664x2496',
  '3136x1344',
] as const);

// Exact names a caller may pass instead of the id (CLI flags, config files).
// Separators are normalized first, so "Seedream 5.0 Pro Uncensored" and
// "seedream_5_pro_spicy" match. Never a substring or prefix match. Every name
// that meant 5.0 Pro before 5.5 existed (including "Seedream Uncensored") still
// means 5.0 Pro.
const SEEDREAM_MODEL_ALIASES: ReadonlySet<string> = new Set([
  SEEDREAM_5_PRO_UNCENSORED_MODEL_ID,
  'seedream-5-pro-uncensored',
  'seedream-5-0-pro-spicy',
  'seedream-5-pro-spicy',
  'seedream-uncensored',
]);

// Seedream 5.5's exact names ("Seedream 5.5", "Seedream 5.5 Uncensored",
// "Seedream 5.5 Spicy"), the names the socket's model tier lists for it.
const SEEDREAM_5_5_MODEL_ALIASES: ReadonlySet<string> = new Set([
  SEEDREAM_5_5_UNCENSORED_MODEL_ID,
  'seedream-5-5-spicy',
  'seedream-5-5',
]);

interface SeedreamSizeLimits {
  readonly displayName: string;
  readonly minPixels: number;
  readonly maxPixels: number;
  readonly sizes: readonly string[];
  /** Words after the pixel range in the refusal; 5.0 Pro keeps its original wording. */
  readonly rangeNote: string;
}

const SEEDREAM_SIZE_LIMITS: Readonly<Record<SeedreamImageModelId, SeedreamSizeLimits>> = {
  [SEEDREAM_5_PRO_UNCENSORED_MODEL_ID]: {
    displayName: SEEDREAM_5_PRO_UNCENSORED_DISPLAY_NAME,
    minPixels: SEEDREAM_MIN_PIXELS,
    maxPixels: SEEDREAM_MAX_PIXELS,
    sizes: SEEDREAM_IMAGE_SIZES,
    rangeNote: ' (1280x720 through 2048x2048)',
  },
  [SEEDREAM_5_5_UNCENSORED_MODEL_ID]: {
    displayName: SEEDREAM_5_5_UNCENSORED_DISPLAY_NAME,
    minPixels: SEEDREAM_5_5_MIN_PIXELS,
    maxPixels: SEEDREAM_5_5_MAX_PIXELS,
    sizes: SEEDREAM_5_5_IMAGE_SIZES,
    rangeNote: '',
  },
};

function normalizeSeedreamAliasKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s._]+/g, '-').replace(/-+/g, '-');
}

/** Whether `value` is a Seedream model id (5.0 Pro Uncensored or 5.5 Uncensored). Ids only, never aliases. */
export function isSeedreamImageModel(value: unknown): value is SeedreamImageModelId {
  return value === SEEDREAM_5_PRO_UNCENSORED_MODEL_ID || value === SEEDREAM_5_5_UNCENSORED_MODEL_ID;
}

/**
 * The Seedream model id for one of its exact names (`seedream-5-0-pro-uncensored`
 * for the 5.0 Pro names, `seedream-5-5-uncensored` for the 5.5 names), otherwise
 * the value unchanged.
 */
export function normalizeSeedreamModelAlias(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const key = normalizeSeedreamAliasKey(value);
  if (SEEDREAM_MODEL_ALIASES.has(key)) return SEEDREAM_5_PRO_UNCENSORED_MODEL_ID;
  if (SEEDREAM_5_5_MODEL_ALIASES.has(key)) return SEEDREAM_5_5_UNCENSORED_MODEL_ID;
  return value;
}

/** The largest total pixel count a Seedream model id renders; 5.0 Pro's limit for any other value. */
export function getSeedreamMaxPixels(modelId: unknown = SEEDREAM_5_PRO_UNCENSORED_MODEL_ID): number {
  return isSeedreamImageModel(modelId) ? SEEDREAM_SIZE_LIMITS[modelId].maxPixels : SEEDREAM_MAX_PIXELS;
}

/**
 * Why a Seedream model cannot render a requested size, or null when it can.
 * Use it on a size someone asked for before paying for a render the vendor
 * would refuse. `modelId` defaults to Seedream 5.0 Pro Uncensored, so a call
 * without it checks 5.0 Pro's limits exactly as before; pass
 * `seedream-5-5-uncensored` for 5.5's larger limit.
 */
export function getSeedreamImageSizeRefusal(
  width: number,
  height: number,
  modelId: string = SEEDREAM_5_PRO_UNCENSORED_MODEL_ID,
): string | null {
  const limits = SEEDREAM_SIZE_LIMITS[isSeedreamImageModel(modelId) ? modelId : SEEDREAM_5_PRO_UNCENSORED_MODEL_ID];
  const w = Number(width);
  const h = Number(height);
  const fmt = (value: number) => value.toLocaleString('en-US');
  const valid =
    `Use ${fmt(limits.minPixels)}-${fmt(limits.maxPixels)} total pixels${limits.rangeNote} ` +
    `with an aspect ratio no wider than ${SEEDREAM_MAX_ASPECT_RATIO}:1, for example ${limits.sizes.join(', ')}.`;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) {
    return `${limits.displayName} needs a whole-pixel width and height. ${valid}`;
  }
  const pixels = w * h;
  if (pixels < limits.minPixels || pixels > limits.maxPixels) {
    return `${limits.displayName} cannot render ${w}x${h} (${fmt(pixels)} pixels). ${valid}`;
  }
  if (Math.max(w, h) / Math.min(w, h) > SEEDREAM_MAX_ASPECT_RATIO) {
    return `${limits.displayName} cannot render ${w}x${h}; its aspect ratio is wider than ${SEEDREAM_MAX_ASPECT_RATIO}:1. ${valid}`;
  }
  return null;
}
