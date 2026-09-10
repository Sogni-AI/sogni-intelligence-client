/**
 * Public request geometry for promptless FlashVSR video upscaling
 * (`upscale_video`).
 *
 * These helpers derive the output size a caller must request from a source
 * video's dimensions and explain the public source limits before a job is
 * submitted. They are not admission control: the server probes the uploaded
 * source itself and remains the authority on what it accepts and charges.
 */

/** Sogni model id of the FlashVSR v1.1 video upscaler (matches the SDK's FLASHVSR_VIDEO_UPSCALE_MODEL_ID). */
export const VIDEO_UPSCALE_MODEL_ID = 'flashvsr_v1.1_tiny_long_bf16';

/** Output short-edge resolutions accepted by upscale_video. */
export const VIDEO_UPSCALE_TARGET_RESOLUTIONS = [1080, 1440] as const;
export type VideoUpscaleTargetResolution = (typeof VIDEO_UPSCALE_TARGET_RESOLUTIONS)[number];

/** Resolution used when the caller does not choose one and the source supports it. */
export const VIDEO_UPSCALE_DEFAULT_RESOLUTION: VideoUpscaleTargetResolution = 1440;

/** Public source limits, as documented for the upscale_video tool. */
export const VIDEO_UPSCALE_SOURCE_LIMITS = Object.freeze({
  maxShortEdge: 768,
  maxFrames: 362,
  maxDurationSeconds: 362 / 24,
  minFps: 1,
  maxFps: 60,
  maxBytes: 100 * 1024 * 1024,
});

/** Largest output the upscaler delivers (landscape; portrait mirrors it). */
export const VIDEO_UPSCALE_MAX_OUTPUT = Object.freeze({
  longEdge: 2560,
  pixels: 2560 * 1440,
});

export interface VideoUpscaleOutput {
  resolution: VideoUpscaleTargetResolution;
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

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
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

/**
 * Check a source's frame count, frame rate, and optional byte size against
 * the public limits. Throws VideoUpscaleRequestError with a user-facing message.
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
  if (frames > limits.maxFrames || frames / fps > limits.maxDurationSeconds + 0.001) {
    throw new VideoUpscaleRequestError(
      `This video is ${frames} frames (${(frames / fps).toFixed(2)} s); video upscaling accepts up to `
        + `${limits.maxFrames} frames and about ${Math.floor(limits.maxDurationSeconds)} seconds.`,
    );
  }
  if (sizeBytes !== undefined && sizeBytes > limits.maxBytes) {
    throw new VideoUpscaleRequestError('Video upscaling accepts source files up to 100 MB.');
  }
}
