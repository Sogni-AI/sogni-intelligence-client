/**
 * Public request geometry for promptless FlashVSR and RelayVSR video upscaling
 * (`upscale_video`).
 *
 * These helpers derive the output size a caller must request from a source
 * video's dimensions and explain the public source limits before a job is
 * submitted. They are not admission control: the server probes the uploaded
 * source itself and remains the authority on what it accepts and charges.
 */

/** Sogni model id of the FlashVSR v1.1 video upscaler (matches the SDK's FLASHVSR_VIDEO_UPSCALE_MODEL_ID). */
export const VIDEO_UPSCALE_MODEL_ID = 'flashvsr_v1.1_tiny_long_bf16';

/** Sogni model ids of the RelayVSR upscalers (match the SDK's RELAYVSR_*_VIDEO_UPSCALE_MODEL_ID). */
export const RELAYVSR_X2_MODEL_ID = 'relayvsr_x2_lightx2v_int8_convrot';
export const RELAYVSR_X4_MODEL_ID = 'relayvsr_x4_int8_convrot';

/** upscale_video `model` selectors; omitted means `flashvsr`. */
export const VIDEO_UPSCALE_MODELS = ['flashvsr', 'relayvsr'] as const;
export type VideoUpscaleModel = (typeof VIDEO_UPSCALE_MODELS)[number];

/** Output short-edge resolutions accepted by FlashVSR, the upscale_video default. */
export const VIDEO_UPSCALE_TARGET_RESOLUTIONS = [1080, 1440] as const;
export type VideoUpscaleTargetResolution = (typeof VIDEO_UPSCALE_TARGET_RESOLUTIONS)[number];

/** Output short-edge resolutions accepted by RelayVSR. */
export const RELAYVSR_TARGET_RESOLUTIONS = [1080, 1440, 2160] as const;
export type RelayVsrTargetResolution = (typeof RELAYVSR_TARGET_RESOLUTIONS)[number];

/** FlashVSR detail preferences; `stable` is the default recipe every worker serves. */
export const VIDEO_UPSCALE_DETAIL_PREFERENCES = ['stable', 'sharper'] as const;
export type VideoUpscaleDetailPreference = (typeof VIDEO_UPSCALE_DETAIL_PREFERENCES)[number];

/** FlashVSR processing speeds; `stable` is the default recipe every worker serves. */
export const VIDEO_UPSCALE_PROCESSING_SPEEDS = ['stable', 'faster'] as const;
export type VideoUpscaleProcessingSpeed = (typeof VIDEO_UPSCALE_PROCESSING_SPEEDS)[number];

/** Seed sentinel the worker resolves to a random seed and reports back. */
export const VIDEO_UPSCALE_RANDOM_SEED = -1;
/** Largest explicit FlashVSR seed. Omitted means the repeatable default 0. */
export const VIDEO_UPSCALE_MAX_SEED = 4294967295;

/** Resolution used when the caller does not choose one and the source supports it. */
export const VIDEO_UPSCALE_DEFAULT_RESOLUTION: VideoUpscaleTargetResolution = 1440;

/**
 * Public source limits, as documented for the upscale_video tool. There is
 * deliberately no frame-count or duration limit: the server's admission check
 * is the one place the maximum clip length lives, and it refuses a source that
 * is too long with a clear error.
 */
export const VIDEO_UPSCALE_SOURCE_LIMITS = Object.freeze({
  maxShortEdge: 768,
  /** Largest source area, counted in 64-pixel blocks: about 1344×768, or 768×1344 in portrait. */
  maxBlockPixels: 1344 * 768,
  minFps: 1,
  maxFps: 60,
  maxBytes: 100 * 1024 * 1024,
});

/** Largest output the upscaler delivers (landscape; portrait mirrors it). */
export const VIDEO_UPSCALE_MAX_OUTPUT = Object.freeze({
  longEdge: 2560,
  pixels: 2560 * 1440,
});

/** RelayVSR source limits per fixed scale; portrait mirrors them. */
export const RELAYVSR_SOURCE_LIMITS = Object.freeze({
  x2: Object.freeze({ scale: 2, maxShortEdge: 1080, maxLongEdge: 1920 }),
  x4: Object.freeze({ scale: 4, maxShortEdge: 768, maxLongEdge: 1344 }),
});

/** Largest output RelayVSR delivers (landscape; portrait mirrors it). */
export const RELAYVSR_MAX_OUTPUT = Object.freeze({ longEdge: 3840 });

export interface VideoUpscaleOutput {
  resolution: VideoUpscaleTargetResolution;
  width: number;
  height: number;
}

/** A resolved upscale: the model that serves it and the output it delivers. */
export interface VideoUpscaleRequest {
  modelId: string;
  resolution: RelayVsrTargetResolution;
  width: number;
  height: number;
}

/** A source or requested resolution the upscaler cannot serve; `message` is user-facing. */
export class VideoUpscaleRequestError extends Error {
  readonly code = 'VIDEO_UPSCALE_UNSUPPORTED_SOURCE';

  constructor(message: string) {
    super(message);
    this.name = 'VideoUpscaleRequestError';
  }
}

export function isVideoUpscaleTargetResolution(value: unknown): value is VideoUpscaleTargetResolution {
  return value === 1080 || value === 1440;
}

export function isVideoUpscaleModelSelector(value: unknown): value is VideoUpscaleModel {
  return value === 'flashvsr' || value === 'relayvsr';
}

export function isRelayVsrModelId(modelId: unknown): boolean {
  return modelId === RELAYVSR_X2_MODEL_ID || modelId === RELAYVSR_X4_MODEL_ID;
}

export function isVideoUpscaleModelId(modelId: unknown): boolean {
  return modelId === VIDEO_UPSCALE_MODEL_ID || isRelayVsrModelId(modelId);
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function sourceFitsBlockArea(sourceWidth: number, sourceHeight: number): boolean {
  const blockWidth = Math.ceil(sourceWidth / 64) * 64;
  const blockHeight = Math.ceil(sourceHeight / 64) * 64;
  return blockWidth * blockHeight <= VIDEO_UPSCALE_SOURCE_LIMITS.maxBlockPixels;
}

function outputFor(
  sourceWidth: number,
  sourceHeight: number,
  resolution: VideoUpscaleTargetResolution,
): VideoUpscaleOutput | string {
  const shortEdge = Math.min(sourceWidth, sourceHeight);
  const ratio = resolution / shortEdge;
  if (ratio > 2) {
    return `${resolution}p needs a source at least ${resolution / 2}px on its short edge; `
      + `this video is ${sourceWidth}×${sourceHeight}.`;
  }
  if (ratio <= 1) {
    return `This ${sourceWidth}×${sourceHeight} video is already ${resolution}p or larger.`;
  }
  const width = Math.round((sourceWidth * ratio) / 2) * 2;
  const height = Math.round((sourceHeight * ratio) / 2) * 2;
  if (Math.max(width, height) > VIDEO_UPSCALE_MAX_OUTPUT.longEdge || width * height > VIDEO_UPSCALE_MAX_OUTPUT.pixels) {
    return `At ${resolution}p this ${sourceWidth}×${sourceHeight} video would be ${width}×${height}, `
      + 'larger than the 2560×1440 upscale output limit.';
  }
  return { resolution, width, height };
}

/**
 * Choose the default resolution for a source: 1440p when the source allows
 * it, otherwise 1080p. Returns null when neither fits.
 */
export function defaultVideoUpscaleResolution(
  sourceWidth: number,
  sourceHeight: number,
): VideoUpscaleTargetResolution | null {
  if (!sourceFitsBlockArea(sourceWidth, sourceHeight)) return null;
  for (const resolution of [VIDEO_UPSCALE_DEFAULT_RESOLUTION, 1080] as const) {
    if (typeof outputFor(sourceWidth, sourceHeight, resolution) !== 'string') return resolution;
  }
  return null;
}

/**
 * Derive the output width/height for an upscale. The aspect ratio is kept and
 * both edges are rounded to even pixels, matching the server's derivation.
 * When `targetResolution` is omitted, 1440p is used if the source allows it and
 * 1080p otherwise. Throws VideoUpscaleRequestError with a user-facing message.
 */
export function resolveVideoUpscaleOutput(input: {
  sourceWidth: number;
  sourceHeight: number;
  targetResolution?: number | null;
}): VideoUpscaleOutput {
  const { sourceWidth, sourceHeight } = input;
  if (!positiveInteger(sourceWidth) || !positiveInteger(sourceHeight)) {
    throw new VideoUpscaleRequestError('The source video dimensions could not be read.');
  }
  if (Math.min(sourceWidth, sourceHeight) > VIDEO_UPSCALE_SOURCE_LIMITS.maxShortEdge) {
    throw new VideoUpscaleRequestError(
      `This video is ${sourceWidth}×${sourceHeight}; video upscaling accepts sources up to `
        + `${VIDEO_UPSCALE_SOURCE_LIMITS.maxShortEdge}px on the short edge.`,
    );
  }
  if (!sourceFitsBlockArea(sourceWidth, sourceHeight)) {
    throw new VideoUpscaleRequestError(
      `This video is ${sourceWidth}×${sourceHeight}; video upscaling accepts sources up to about `
        + '1344×768 pixels, or 768×1344 in portrait.',
    );
  }
  const requested = input.targetResolution ?? undefined;
  if (requested !== undefined && !isVideoUpscaleTargetResolution(requested)) {
    throw new VideoUpscaleRequestError('Choose 1080p or 1440p for video upscaling.');
  }
  const candidates: VideoUpscaleTargetResolution[] = requested !== undefined
    ? [requested]
    : [VIDEO_UPSCALE_DEFAULT_RESOLUTION, 1080];
  let lastProblem = '';
  for (const resolution of candidates) {
    const output = outputFor(sourceWidth, sourceHeight, resolution);
    if (typeof output !== 'string') return output;
    lastProblem = output;
  }
  throw new VideoUpscaleRequestError(lastProblem);
}

function relayVsrRequestFor(
  sourceWidth: number,
  sourceHeight: number,
  resolution: RelayVsrTargetResolution,
): VideoUpscaleRequest | string {
  const shortEdge = Math.min(sourceWidth, sourceHeight);
  const longEdge = Math.max(sourceWidth, sourceHeight);
  const { x2, x4 } = RELAYVSR_SOURCE_LIMITS;
  const ratio = resolution / shortEdge;
  if (ratio <= 1) {
    return `This ${sourceWidth}×${sourceHeight} video is already ${resolution}p or larger.`;
  }
  if (ratio > x4.scale) {
    return `${resolution}p needs a source at least ${Math.ceil(resolution / x4.scale)}px on its short edge; `
      + `this video is ${sourceWidth}×${sourceHeight}.`;
  }
  const useX2 = ratio <= x2.scale;
  if (!useX2 && (shortEdge > x4.maxShortEdge || longEdge > x4.maxLongEdge)) {
    return `${resolution}p is more than twice the size of this ${sourceWidth}×${sourceHeight} video; `
      + `RelayVSR goes past twice the size only for sources up to ${x4.maxLongEdge}×${x4.maxShortEdge} pixels, `
      + `or ${x4.maxShortEdge}×${x4.maxLongEdge} in portrait.`;
  }
  const width = Math.round((sourceWidth * ratio) / 2) * 2;
  const height = Math.round((sourceHeight * ratio) / 2) * 2;
  if (Math.max(width, height) > RELAYVSR_MAX_OUTPUT.longEdge) {
    return `At ${resolution}p this ${sourceWidth}×${sourceHeight} video would be ${width}×${height}, `
      + `past the ${RELAYVSR_MAX_OUTPUT.longEdge}px long-edge upscale output limit.`;
  }
  return { modelId: useX2 ? RELAYVSR_X2_MODEL_ID : RELAYVSR_X4_MODEL_ID, resolution, width, height };
}

/**
 * Resolve the `relayvsr` selector: X2 when the target is at most twice the
 * source's short edge, otherwise X4. When `targetResolution` is omitted, 1440p
 * is used if the source allows it and 1080p otherwise, as with FlashVSR.
 * Throws VideoUpscaleRequestError with a user-facing message.
 */
export function resolveRelayVsrRequest(input: {
  sourceWidth: number;
  sourceHeight: number;
  targetResolution?: number | null;
}): VideoUpscaleRequest {
  const { sourceWidth, sourceHeight } = input;
  if (!positiveInteger(sourceWidth) || !positiveInteger(sourceHeight)) {
    throw new VideoUpscaleRequestError('The source video dimensions could not be read.');
  }
  const { x2 } = RELAYVSR_SOURCE_LIMITS;
  if (
    Math.min(sourceWidth, sourceHeight) > x2.maxShortEdge
    || Math.max(sourceWidth, sourceHeight) > x2.maxLongEdge
  ) {
    throw new VideoUpscaleRequestError(
      `This video is ${sourceWidth}×${sourceHeight}; RelayVSR accepts sources up to `
        + `${x2.maxLongEdge}×${x2.maxShortEdge} pixels, or ${x2.maxShortEdge}×${x2.maxLongEdge} in portrait.`,
    );
  }
  const requested = input.targetResolution ?? undefined;
  if (requested !== undefined && !RELAYVSR_TARGET_RESOLUTIONS.includes(requested as RelayVsrTargetResolution)) {
    throw new VideoUpscaleRequestError('Choose 1080p, 1440p, or 2160p for RelayVSR video upscaling.');
  }
  const candidates: RelayVsrTargetResolution[] = requested !== undefined
    ? [requested as RelayVsrTargetResolution]
    : [VIDEO_UPSCALE_DEFAULT_RESOLUTION, 1080];
  let lastProblem = '';
  for (const resolution of candidates) {
    const request = relayVsrRequestFor(sourceWidth, sourceHeight, resolution);
    if (typeof request !== 'string') return request;
    lastProblem = request;
  }
  throw new VideoUpscaleRequestError(lastProblem);
}

/**
 * Resolve an upscale_video `model` selector and target into the model id and
 * output to request. An omitted selector is FlashVSR, with the same limits and
 * messages as resolveVideoUpscaleOutput.
 */
export function resolveVideoUpscaleRequest(input: {
  sourceWidth: number;
  sourceHeight: number;
  targetResolution?: number | null;
  model?: string | null;
}): VideoUpscaleRequest {
  const { model, ...source } = input;
  if (model === 'relayvsr') return resolveRelayVsrRequest(source);
  if (model !== undefined && model !== null && model !== 'flashvsr') {
    throw new VideoUpscaleRequestError('Choose flashvsr or relayvsr for video upscaling.');
  }
  return { modelId: VIDEO_UPSCALE_MODEL_ID, ...resolveVideoUpscaleOutput(source) };
}

/**
 * Check that a source's frame count and frame rate are readable and within the
 * public 1-60 fps range, and its optional byte size within the file limit.
 * Throws VideoUpscaleRequestError with a user-facing message. It sets no
 * frame-count or duration limit: the server enforces the maximum clip length.
 */
export function validateVideoUpscaleSourceTiming(input: {
  frames: number;
  fps: number;
  sizeBytes?: number;
}): void {
  const { frames, fps, sizeBytes } = input;
  const limits = VIDEO_UPSCALE_SOURCE_LIMITS;
  if (!positiveInteger(frames) || !Number.isFinite(fps) || fps <= 0) {
    throw new VideoUpscaleRequestError('The source video frame count or frame rate could not be read.');
  }
  if (fps < limits.minFps || fps > limits.maxFps) {
    throw new VideoUpscaleRequestError(
      `This video runs at ${Number(fps.toFixed(3))} fps; video upscaling accepts ${limits.minFps}-${limits.maxFps} fps.`,
    );
  }
  if (sizeBytes !== undefined && sizeBytes > limits.maxBytes) {
    throw new VideoUpscaleRequestError('Video upscaling accepts source files up to 100 MB.');
  }
}
