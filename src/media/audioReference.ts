import { isSeedance25VideoModelId } from '../utils/seedanceModelIds.js';

export type ReferenceAudioFormat = 'mp3' | 'm4a' | 'wav' | 'flac' | 'ogg' | 'unknown';

export interface PreparedReferenceAudio {
  data: Uint8Array;
  mimeType: string;
  sourceFormat: ReferenceAudioFormat;
  transcoded: boolean;
  trimmed: boolean;
  requestedDuration?: number;
  startOffset?: number;
  sourceDuration?: number;
}

export interface ReferenceAudioTranscodeRequest {
  data: Uint8Array;
  filename: string;
  inputMimeType: string;
  sourceFormat: ReferenceAudioFormat;
}

export interface ReferenceAudioTranscodeResult {
  data: Uint8Array;
  mimeType?: string | null;
}

export type ReferenceAudioTranscoder = (
  request: ReferenceAudioTranscodeRequest,
) => Promise<ReferenceAudioTranscodeResult>;

export const SEEDANCE_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS = 15.2;
/** Seedance 2.5 and 2.5 Uncensored accept 30 s of reference audio (BytePlus allows 30.2 s). */
export const SEEDANCE_25_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS = 30.2;

/** The longest reference audio a Seedance model accepts; the 2.0 ceiling for any other id. */
export function getSeedanceReferenceAudioMaxDurationSeconds(modelId?: string | null): number {
  return isSeedance25VideoModelId(modelId)
    ? SEEDANCE_25_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS
    : SEEDANCE_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS;
}

export interface ReferenceAudioTrimRequest {
  data: Uint8Array;
  filename: string;
  inputMimeType: string;
  sourceFormat: ReferenceAudioFormat;
  duration: number;
  start: number;
}

export interface ReferenceAudioTrimResult {
  data: Uint8Array;
  mimeType?: string | null;
}

export type ReferenceAudioTrimmer = (
  request: ReferenceAudioTrimRequest,
) => Promise<ReferenceAudioTrimResult>;

export interface PrepareReferenceAudioOptions {
  /** Preferred adapter for normalizing any supported reference audio to M4A/MP4. */
  transcodeToM4a?: ReferenceAudioTranscoder;
  /** Preferred adapter for normalizing any supported reference audio to MP3. */
  transcodeToMp3?: ReferenceAudioTranscoder;
  /** Backwards-compatible adapter used for MP3 normalization. */
  transcodeMp3?: ReferenceAudioTranscoder;
  trimAudio?: ReferenceAudioTrimmer;
  sourceDurationSeconds?: number;
  maxDurationSeconds?: number;
  startOffsetSeconds?: number;
  /**
   * Normalize supported non-M4A reference audio to M4A before upload.
   * This avoids legacy worker download paths that default reference audio to
   * an M4A object key even when the original upload was WAV/FLAC/MP3.
   */
  normalizeToM4a?: boolean;
  /**
   * Normalize supported non-MP3 reference audio to MP3 before upload.
   * Seedance R2V currently accepts MP3/WAV reference audio but rejects M4A.
   */
  normalizeToMp3?: boolean;
}

function asciiAt(data: Uint8Array, start: number, length: number): string {
  if (data.length < start + length) return '';
  let value = '';
  for (let index = start; index < start + length; index += 1) {
    value += String.fromCharCode(data[index]);
  }
  return value;
}

export function normalizeReferenceAudioMimeType(mimeType?: string | null): string {
  const trimmed = mimeType?.split(';')[0]?.trim().toLowerCase();
  return trimmed || 'application/octet-stream';
}

export function detectReferenceAudioFormat(
  data: Uint8Array,
  mimeType?: string | null,
): ReferenceAudioFormat {
  const normalizedMimeType = normalizeReferenceAudioMimeType(mimeType);
  if (normalizedMimeType === 'audio/mpeg' || normalizedMimeType === 'audio/mp3') {
    return 'mp3';
  }
  if (
    normalizedMimeType === 'audio/mp4'
    || normalizedMimeType === 'audio/m4a'
    || normalizedMimeType === 'audio/x-m4a'
  ) {
    return 'm4a';
  }
  if (
    normalizedMimeType === 'audio/wav'
    || normalizedMimeType === 'audio/x-wav'
    || normalizedMimeType === 'audio/wave'
  ) {
    return 'wav';
  }
  if (normalizedMimeType === 'audio/flac' || normalizedMimeType === 'audio/x-flac') {
    return 'flac';
  }
  if (normalizedMimeType === 'audio/ogg' || normalizedMimeType === 'application/ogg') {
    return 'ogg';
  }

  if (data.length >= 3 && asciiAt(data, 0, 3) === 'ID3') return 'mp3';
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return 'mp3';
  if (data.length >= 12 && asciiAt(data, 4, 4) === 'ftyp') return 'm4a';
  if (data.length >= 12 && asciiAt(data, 0, 4) === 'RIFF' && asciiAt(data, 8, 4) === 'WAVE') {
    return 'wav';
  }
  if (data.length >= 4 && asciiAt(data, 0, 4) === 'fLaC') return 'flac';
  if (data.length >= 4 && asciiAt(data, 0, 4) === 'OggS') return 'ogg';
  return 'unknown';
}

function shouldNormalizeReferenceAudioToM4a(
  sourceFormat: ReferenceAudioFormat,
  options: PrepareReferenceAudioOptions,
): boolean {
  if (sourceFormat === 'mp3') return true;
  return options.normalizeToM4a === true
    && sourceFormat !== 'm4a'
    && sourceFormat !== 'unknown';
}

function shouldNormalizeReferenceAudioToMp3(
  sourceFormat: ReferenceAudioFormat,
  options: PrepareReferenceAudioOptions,
): boolean {
  return options.normalizeToMp3 === true
    && sourceFormat !== 'mp3'
    && sourceFormat !== 'unknown';
}

function finiteNonNegative(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function finitePositive(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function shouldTrimSeedanceReferenceAudio(input: {
  sourceDurationSeconds?: number;
  maxDurationSeconds?: number;
  startOffsetSeconds?: number;
}): boolean {
  const startOffset = finiteNonNegative(input.startOffsetSeconds);
  if (startOffset > 0) return true;

  const maxDuration = finitePositive(
    input.maxDurationSeconds,
    SEEDANCE_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS,
  );
  const sourceDuration = input.sourceDurationSeconds;
  if (typeof sourceDuration !== 'number' || !Number.isFinite(sourceDuration)) {
    return false;
  }
  return sourceDuration > maxDuration;
}

export async function prepareReferenceAudioForVideo(
  data: Uint8Array,
  mimeType?: string | null,
  filename = 'reference-audio',
  options: PrepareReferenceAudioOptions = {},
): Promise<PreparedReferenceAudio> {
  const inputMimeType = normalizeReferenceAudioMimeType(mimeType);
  const sourceFormat = detectReferenceAudioFormat(data, inputMimeType);
  if (shouldNormalizeReferenceAudioToMp3(sourceFormat, options)) {
    const transcode = options.transcodeToMp3;
    if (!transcode) {
      throw new Error('Reference audio must be normalized to MP3 through a host adapter before video generation.');
    }

    const result = await transcode({
      data,
      filename,
      inputMimeType,
      sourceFormat,
    });
    if (!(result.data instanceof Uint8Array) || result.data.length === 0) {
      throw new Error('Reference audio MP3 transcode did not return media bytes.');
    }

    return {
      data: result.data,
      mimeType: normalizeReferenceAudioMimeType(result.mimeType || 'audio/mpeg'),
      sourceFormat,
      transcoded: true,
      trimmed: false,
    };
  }

  if (!shouldNormalizeReferenceAudioToM4a(sourceFormat, options)) {
    return {
      data,
      mimeType: inputMimeType,
      sourceFormat,
      transcoded: false,
      trimmed: false,
    };
  }

  const transcode = options.transcodeToM4a ?? options.transcodeMp3;
  if (!transcode) {
    throw new Error('Reference audio must be normalized through a host adapter before video generation.');
  }

  const result = await transcode({
    data,
    filename,
    inputMimeType,
    sourceFormat,
  });
  if (!(result.data instanceof Uint8Array) || result.data.length === 0) {
    throw new Error('MP3 reference audio transcode did not return media bytes.');
  }

  return {
    data: result.data,
    mimeType: normalizeReferenceAudioMimeType(result.mimeType || 'audio/mp4'),
    sourceFormat,
    transcoded: true,
    trimmed: false,
  };
}

export async function prepareSeedanceReferenceAudioForVideo(
  data: Uint8Array,
  mimeType?: string | null,
  filename = 'reference-audio',
  options: PrepareReferenceAudioOptions = {},
): Promise<PreparedReferenceAudio> {
  const inputMimeType = normalizeReferenceAudioMimeType(mimeType);
  const sourceFormat = detectReferenceAudioFormat(data, inputMimeType);
  const sourceDuration = typeof options.sourceDurationSeconds === 'number'
    && Number.isFinite(options.sourceDurationSeconds)
    ? Math.max(0, options.sourceDurationSeconds)
    : undefined;
  const requestedDuration = finitePositive(
    options.maxDurationSeconds,
    SEEDANCE_R2V_REFERENCE_AUDIO_MAX_DURATION_SECONDS,
  );
  const startOffset = finiteNonNegative(options.startOffsetSeconds);

  if (shouldTrimSeedanceReferenceAudio({
    sourceDurationSeconds: sourceDuration,
    maxDurationSeconds: requestedDuration,
    startOffsetSeconds: startOffset,
  })) {
    if (!options.trimAudio) {
      throw new Error('Seedance reference audio must be trimmed through a host adapter before video generation.');
    }

    const result = await options.trimAudio({
      data,
      filename,
      inputMimeType,
      sourceFormat,
      duration: requestedDuration,
      start: startOffset,
    });
    if (!(result.data instanceof Uint8Array) || result.data.length === 0) {
      throw new Error('Seedance reference audio trim did not return media bytes.');
    }

    return {
      data: result.data,
      mimeType: normalizeReferenceAudioMimeType(result.mimeType || 'audio/mp4'),
      sourceFormat,
      transcoded: options.normalizeToMp3 === true
        ? sourceFormat !== 'mp3'
        : sourceFormat === 'mp3',
      trimmed: true,
      requestedDuration,
      startOffset,
      ...(sourceDuration !== undefined ? { sourceDuration } : {}),
    };
  }

  const prepared = await prepareReferenceAudioForVideo(
    data,
    inputMimeType,
    filename,
    options,
  );
  return {
    ...prepared,
    requestedDuration,
    startOffset,
    ...(sourceDuration !== undefined ? { sourceDuration } : {}),
  };
}
