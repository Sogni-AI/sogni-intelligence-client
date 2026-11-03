import { isSeedance25VideoModelId } from '../utils/seedanceModelIds.js';

/** Seedance 2.0-family ceiling for a video-to-video source, and the default when no model is named. */
export const SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS = 15;
/**
 * Seedance 2.5 and Seedance 2.5 Uncensored accept 30 seconds of reference video (BytePlus refuses more
 * than 30.2 s). Trimming their sources to the 2.0 ceiling silently halved 30-second edits.
 */
export const SEEDANCE_25_V2V_REFERENCE_MAX_DURATION_SECONDS = 30;

/** The longest video-to-video source a Seedance model accepts; the 2.0 ceiling for any other id. */
export function getSeedanceV2VReferenceMaxDurationSeconds(modelId?: string | null): number {
  return isSeedance25VideoModelId(modelId)
    ? SEEDANCE_25_V2V_REFERENCE_MAX_DURATION_SECONDS
    : SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS;
}
const TRIM_TOLERANCE_SECONDS = 0.15;

export interface PreparedReferenceVideo {
  data: Uint8Array;
  mimeType: string;
  sourceDuration: number | null;
  trimmed: boolean;
  trimStart: number;
  trimDuration: number | null;
}

export interface ReferenceVideoTrimRequest {
  data: Uint8Array;
  filename: string;
  inputMimeType: string;
  start: number;
  duration: number;
  sourceDuration: number | null;
  requestedDuration: number | null;
}

export interface ReferenceVideoTrimResult {
  data: Uint8Array;
  mimeType?: string | null;
}

export type ReferenceVideoTrimmer = (
  request: ReferenceVideoTrimRequest,
) => Promise<ReferenceVideoTrimResult>;

export interface PrepareSeedanceV2VSourceVideoOptions {
  trimVideo?: ReferenceVideoTrimmer;
  /** Target Seedance model. Seedance 2.5 sources keep up to 30 s; omitted keeps the 2.0 ceiling. */
  modelId?: string | null;
}

export interface ShouldTrimSeedanceV2VSourceVideoInput {
  sourceDurationSeconds?: number | null;
  requestedDurationSeconds?: number | null;
  startOffsetSeconds?: number | null;
  maxDurationSeconds?: number;
}

function normalizeReferenceVideoMimeType(mimeType?: string | null): string {
  const trimmed = mimeType?.split(';')[0]?.trim().toLowerCase();
  return trimmed || 'application/octet-stream';
}

function finiteNonNegative(value: number | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function shouldTrimSeedanceV2VSourceVideo({
  sourceDurationSeconds,
  requestedDurationSeconds,
  startOffsetSeconds = 0,
  maxDurationSeconds = SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS,
}: ShouldTrimSeedanceV2VSourceVideoInput): boolean {
  const maxDuration = finiteNonNegative(maxDurationSeconds, SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS)
    || SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS;
  const sourceDuration = finiteNonNegative(sourceDurationSeconds, Number.NaN);
  const requestedDuration = finiteNonNegative(requestedDurationSeconds, maxDuration);
  const startOffset = finiteNonNegative(startOffsetSeconds, 0);
  if (startOffset > 0) return true;
  const effectiveDuration = Math.min(requestedDuration || maxDuration, maxDuration);
  return Number.isFinite(sourceDuration) && sourceDuration > effectiveDuration + TRIM_TOLERANCE_SECONDS;
}

export async function prepareSeedanceV2VSourceVideo(
  data: Uint8Array,
  mimeType?: string | null,
  filename = 'source-video.mp4',
  sourceDurationSeconds?: number | null,
  requestedDurationSeconds?: number | null,
  startOffsetSeconds = 0,
  options: PrepareSeedanceV2VSourceVideoOptions = {},
): Promise<PreparedReferenceVideo> {
  const normalizedMimeType = normalizeReferenceVideoMimeType(mimeType);
  const sourceDuration = Number.isFinite(Number(sourceDurationSeconds))
    ? Math.max(0, Number(sourceDurationSeconds))
    : null;
  const requestedDuration = Number.isFinite(Number(requestedDurationSeconds))
    ? Math.max(0, Number(requestedDurationSeconds))
    : null;
  const trimStart = finiteNonNegative(startOffsetSeconds, 0);
  const maxDuration = getSeedanceV2VReferenceMaxDurationSeconds(options.modelId);
  const trimDuration = Math.min(
    requestedDuration && requestedDuration > 0 ? requestedDuration : maxDuration,
    maxDuration,
  );

  if (!shouldTrimSeedanceV2VSourceVideo({
    sourceDurationSeconds: sourceDuration,
    requestedDurationSeconds: requestedDuration,
    startOffsetSeconds: trimStart,
    maxDurationSeconds: maxDuration,
  })) {
    return {
      data,
      mimeType: normalizedMimeType,
      sourceDuration,
      trimmed: false,
      trimStart: 0,
      trimDuration: null,
    };
  }

  if (!options.trimVideo) {
    throw new Error('Seedance 2.0 video-to-video references must be trimmed through a host adapter.');
  }

  const result = await options.trimVideo({
    data,
    filename,
    inputMimeType: normalizedMimeType,
    start: trimStart,
    duration: trimDuration,
    sourceDuration,
    requestedDuration,
  });
  if (!(result.data instanceof Uint8Array) || result.data.length === 0) {
    throw new Error('Seedance 2.0 source video trim did not return media bytes.');
  }

  return {
    data: result.data,
    mimeType: normalizeReferenceVideoMimeType(result.mimeType || 'video/mp4'),
    sourceDuration,
    trimmed: true,
    trimStart,
    trimDuration,
  };
}
