/**
 * Explicit Seedance model registry.
 *
 * Model capabilities must be added deliberately. Prefix matching would make an
 * unknown future SKU inherit today's duration, reference, FPS, storyboard, and
 * prompt contracts before that SKU has been integrated or validated.
 */
export const SEEDANCE_VIDEO_MODEL_IDS = Object.freeze({
  standard: 'seedance-2-0',
  mini: 'seedance-2-0-mini',
  // Seedance 2.0 Mini Uncensored: the same vendor model as Seedance 2.0 Mini on
  // the uncensored account Seedance 2.5 Uncensored uses. It shares every Mini
  // capability but is its own id: never alias or rewrite it to seedance-2-0-mini.
  miniUncensored: 'seedance-2-0-mini-uncensored',
  v25: 'seedance-2-5',
  // Seedance 2.5 Uncensored: the same vendor model as Seedance 2.5 on a
  // separate uncensored account. It shares every 2.5 capability but is its own
  // id: never alias or rewrite it to seedance-2-5.
  v25Uncensored: 'seedance-2-5-uncensored',
} as const);

export type SeedanceVideoModelId =
  (typeof SEEDANCE_VIDEO_MODEL_IDS)[keyof typeof SEEDANCE_VIDEO_MODEL_IDS];

const SEEDANCE_VIDEO_MODEL_ID_SET: ReadonlySet<string> = new Set(
  Object.values(SEEDANCE_VIDEO_MODEL_IDS),
);

const SEEDANCE_VIDEO_MODEL_ALIASES: Readonly<Record<string, SeedanceVideoModelId>> =
  Object.freeze({
    // Public skill selectors are explicit aliases for the registered vendor
    // contracts. Keep this list aligned with VIDEO_MODEL_ALIASES; do not
    // replace it with a Seedance prefix match.
    seedance2: SEEDANCE_VIDEO_MODEL_IDS.standard,
    'seedance2-t2v': SEEDANCE_VIDEO_MODEL_IDS.standard,
    'seedance2-ia2v': SEEDANCE_VIDEO_MODEL_IDS.standard,
    'seedance2-v2v': SEEDANCE_VIDEO_MODEL_IDS.standard,
    'seedance2-mini': SEEDANCE_VIDEO_MODEL_IDS.mini,
    'seedance2-mini-t2v': SEEDANCE_VIDEO_MODEL_IDS.mini,
    // Seedance 2.0 Mini Uncensored and its friendly names. A name with "mini"
    // never resolves to Seedance 2.5 Uncensored.
    'seedance2-mini-uncensored': SEEDANCE_VIDEO_MODEL_IDS.miniUncensored,
    'seedance2-mini-uncensored-t2v': SEEDANCE_VIDEO_MODEL_IDS.miniUncensored,
    'seedance-mini-uncensored': SEEDANCE_VIDEO_MODEL_IDS.miniUncensored,
    'seedance-mini-spicy': SEEDANCE_VIDEO_MODEL_IDS.miniUncensored,
    'seedance2-5': SEEDANCE_VIDEO_MODEL_IDS.v25,
    'seedance2-5-t2v': SEEDANCE_VIDEO_MODEL_IDS.v25,
    'seedance2-5-ia2v': SEEDANCE_VIDEO_MODEL_IDS.v25,
    'seedance2-5-v2v': SEEDANCE_VIDEO_MODEL_IDS.v25,
    'seedance2-5-uncensored': SEEDANCE_VIDEO_MODEL_IDS.v25Uncensored,
    'seedance2-5-uncensored-t2v': SEEDANCE_VIDEO_MODEL_IDS.v25Uncensored,
    'seedance2-5-uncensored-ia2v': SEEDANCE_VIDEO_MODEL_IDS.v25Uncensored,
    'seedance2-5-uncensored-v2v': SEEDANCE_VIDEO_MODEL_IDS.v25Uncensored,
    'seedance-uncensored': SEEDANCE_VIDEO_MODEL_IDS.v25Uncensored,
    'seedance-spicy': SEEDANCE_VIDEO_MODEL_IDS.v25Uncensored,
    // Retired backend id retained as an explicit compatibility alias. Mini is
    // its supported replacement; this is not a family-prefix fallback.
    'seedance-2-0-fast': SEEDANCE_VIDEO_MODEL_IDS.mini,
    'seedance2-fast': SEEDANCE_VIDEO_MODEL_IDS.mini,
    'seedance2-fast-t2v': SEEDANCE_VIDEO_MODEL_IDS.mini,
  });

export function resolveSeedanceVideoModelId(
  modelId: string | null | undefined,
): SeedanceVideoModelId | null {
  if (!modelId) return null;
  const normalized = modelId.trim().toLowerCase();
  if (SEEDANCE_VIDEO_MODEL_ID_SET.has(normalized)) {
    return normalized as SeedanceVideoModelId;
  }
  return SEEDANCE_VIDEO_MODEL_ALIASES[normalized] ?? null;
}

export function isSeedanceVideoModelId(modelId: string | null | undefined): boolean {
  return resolveSeedanceVideoModelId(modelId) !== null;
}

/**
 * True for Seedance 2.5 and Seedance 2.5 Uncensored, which share every 2.5
 * capability (4-30s, 1080p, the 30/10/10/50 reference budget, MOV, last frame).
 */
export function isSeedance25VideoModelId(modelId: string | null | undefined): boolean {
  const resolved = resolveSeedanceVideoModelId(modelId);
  return resolved === SEEDANCE_VIDEO_MODEL_IDS.v25 || resolved === SEEDANCE_VIDEO_MODEL_IDS.v25Uncensored;
}

/** True only for Seedance 2.5 Uncensored (`seedance-2-5-uncensored`). */
export function isSeedance25UncensoredVideoModelId(modelId: string | null | undefined): boolean {
  return resolveSeedanceVideoModelId(modelId) === SEEDANCE_VIDEO_MODEL_IDS.v25Uncensored;
}

/**
 * True for Seedance 2.0 Mini and Seedance 2.0 Mini Uncensored, which share
 * every Mini capability (480p/720p, 4-15s, the 9/3/3/12 reference budget).
 */
export function isSeedanceMiniVideoModelId(modelId: string | null | undefined): boolean {
  const resolved = resolveSeedanceVideoModelId(modelId);
  return resolved === SEEDANCE_VIDEO_MODEL_IDS.mini || resolved === SEEDANCE_VIDEO_MODEL_IDS.miniUncensored;
}

/** True only for Seedance 2.0 Mini Uncensored (`seedance-2-0-mini-uncensored`). */
export function isSeedanceMiniUncensoredVideoModelId(modelId: string | null | undefined): boolean {
  return resolveSeedanceVideoModelId(modelId) === SEEDANCE_VIDEO_MODEL_IDS.miniUncensored;
}
