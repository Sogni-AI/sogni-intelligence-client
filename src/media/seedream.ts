/**
 * Seedream 5.0 Pro Uncensored (`seedream-5-0-pro-uncensored`).
 *
 * BytePlus Seedream 5.0 Pro on Sogni's uncensored BytePlus account, an
 * external-API image model for text-to-image and image edits with 1-10
 * reference images. It is premium (Spark only, like GPT Image) and needs the
 * same one-time likeness and consent agreement as Seedance 2.5 Uncensored
 * (agreement key `seedance-2-5-uncensored`): until the account accepts it the
 * socket refuses every job with error 4103 (see modelConsentRequired.ts).
 *
 * There is no filtered Seedream model on Sogni, and the uncensored model is
 * chosen only when the user asks for it, exactly as Seedance 2.5 Uncensored is.
 * The model id is the tool selector too: it is byte-identical everywhere.
 */

export const SEEDREAM_5_PRO_UNCENSORED_MODEL_ID = 'seedream-5-0-pro-uncensored';
export const SEEDREAM_5_PRO_UNCENSORED_DISPLAY_NAME = 'Seedream 5.0 Pro Uncensored';

/** Seedream edits take one to ten reference images. */
export const SEEDREAM_MAX_REFERENCE_IMAGES = 10;

/** Total output pixels Seedream accepts (1280x720 through 2048x2048). */
export const SEEDREAM_MIN_PIXELS = 921_600;
export const SEEDREAM_MAX_PIXELS = 4_194_304;
/** Widest aspect ratio either way (1:16 through 16:1). */
export const SEEDREAM_MAX_ASPECT_RATIO = 16;

export const SEEDREAM_DEFAULT_WIDTH = 1536;
export const SEEDREAM_DEFAULT_HEIGHT = 1536;

/** BytePlus's recommended Seedream sizes, lower price tier first. */
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

// Exact names a caller may pass instead of the id (CLI flags, config files).
// Separators are normalized first, so "Seedream 5.0 Pro Uncensored" and
// "seedream_5_pro_spicy" match. Never a substring or prefix match.
const SEEDREAM_MODEL_ALIASES: ReadonlySet<string> = new Set([
  SEEDREAM_5_PRO_UNCENSORED_MODEL_ID,
  'seedream-5-pro-uncensored',
  'seedream-5-0-pro-spicy',
  'seedream-5-pro-spicy',
  'seedream-uncensored',
]);

function normalizeSeedreamAliasKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s._]+/g, '-').replace(/-+/g, '-');
}

export function isSeedreamImageModel(value: unknown): boolean {
  return value === SEEDREAM_5_PRO_UNCENSORED_MODEL_ID;
}

/**
 * `seedream-5-0-pro-uncensored` for one of its exact names, otherwise the value
 * unchanged.
 */
export function normalizeSeedreamModelAlias(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return SEEDREAM_MODEL_ALIASES.has(normalizeSeedreamAliasKey(value))
    ? SEEDREAM_5_PRO_UNCENSORED_MODEL_ID
    : value;
}

/**
 * Why Seedream cannot render a requested size, or null when it can. Use it on a
 * size someone asked for before paying for a render the vendor would refuse.
 */
export function getSeedreamImageSizeRefusal(width: number, height: number): string | null {
  const w = Number(width);
  const h = Number(height);
  const fmt = (value: number) => value.toLocaleString('en-US');
  const valid =
    `Use ${fmt(SEEDREAM_MIN_PIXELS)}-${fmt(SEEDREAM_MAX_PIXELS)} total pixels (1280x720 through 2048x2048) ` +
    `with an aspect ratio no wider than ${SEEDREAM_MAX_ASPECT_RATIO}:1, for example ${SEEDREAM_IMAGE_SIZES.join(', ')}.`;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) {
    return `${SEEDREAM_5_PRO_UNCENSORED_DISPLAY_NAME} needs a whole-pixel width and height. ${valid}`;
  }
  const pixels = w * h;
  if (pixels < SEEDREAM_MIN_PIXELS || pixels > SEEDREAM_MAX_PIXELS) {
    return `${SEEDREAM_5_PRO_UNCENSORED_DISPLAY_NAME} cannot render ${w}x${h} (${fmt(pixels)} pixels). ${valid}`;
  }
  if (Math.max(w, h) / Math.min(w, h) > SEEDREAM_MAX_ASPECT_RATIO) {
    return `${SEEDREAM_5_PRO_UNCENSORED_DISPLAY_NAME} cannot render ${w}x${h}; its aspect ratio is wider than ${SEEDREAM_MAX_ASPECT_RATIO}:1. ${valid}`;
  }
  return null;
}
