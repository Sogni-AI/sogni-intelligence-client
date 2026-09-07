/**
 * Utility helper functions
 */

import type {
  ProjectConfig,
  SogniClientConfig,
  ImageProjectConfig,
  VideoProjectConfig,
  AudioProjectConfig,
} from '../types/index.js';
import { SogniValidationError } from './errors.js';
import { VIDEO_UPSCALE_MAX_OUTPUT, VIDEO_UPSCALE_MODEL_ID } from '../media/videoUpscale.js';
import {
  getSeedanceReferenceLimits,
} from '../tools/shared/seedanceReferences.js';
import {
  isSeedance25VideoModelId,
  isSeedanceVideoModelId,
} from './seedanceModelIds.js';
import {
  isRegisteredHappyHorseVideoModelId,
  isRegisteredLtxVideoModelId,
  isRegisteredLooseReferenceVideoModelId,
  isRegisteredMiniMaxH3VideoModelId,
  isRegisteredWanVideoModelId,
} from './videoModelIds.js';

/**
 * Generate a unique app ID. Uses the universal `globalThis.crypto`
 * (available in modern browsers and Node >= 18) so this package works
 * in both runtimes without bundlers externalizing a node:crypto import.
 */
export function generateAppId(): string {
  const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoLike?.randomUUID) return cryptoLike.randomUUID();
  throw new SogniValidationError(
    'generateAppId requires globalThis.crypto.randomUUID (Node >= 18 / modern browsers).',
  );
}

/**
 * Type guard to check if config is for an image project
 */
export function isImageProjectConfig(config: ProjectConfig): config is ImageProjectConfig {
  return config.type === 'image';
}

/**
 * Type guard to check if config is for a video project
 */
export function isVideoProjectConfig(config: ProjectConfig): config is VideoProjectConfig {
  return config.type === 'video';
}

/**
 * Type guard to check if config is for an audio project
 */
export function isAudioProjectConfig(config: ProjectConfig): config is AudioProjectConfig {
  return config.type === 'audio';
}

export function isWanVideoModel(modelId: string): boolean {
  return isRegisteredWanVideoModelId(modelId);
}

export function isLtxVideoModel(modelId: string): boolean {
  return isRegisteredLtxVideoModelId(modelId);
}

export function isSeedanceVideoModel(modelId: string): boolean {
  return isSeedanceVideoModelId(modelId);
}

/** Seedance 2.5 renders 4-30s and carries the larger reference budget. */
export function isSeedance25VideoModel(modelId: string): boolean {
  return isSeedance25VideoModelId(modelId);
}

export function isHappyHorseVideoModel(modelId: string): boolean {
  return isRegisteredHappyHorseVideoModelId(modelId);
}

export function isMiniMaxH3VideoModel(modelId: string): boolean {
  return isRegisteredMiniMaxH3VideoModelId(modelId);
}

/** True when reference images are loose context rather than frame anchors. */
export function isLooseReferenceVideoModel(modelId: string): boolean {
  return isRegisteredLooseReferenceVideoModelId(modelId);
}

/**
 * Last-resort video dimension envelope used by the wrapper when it normalizes
 * a project's requested width/height and resizes reference media to match.
 */
export interface VideoDimensionRules {
  minDimension: number;
  maxDimension: number;
  dimensionMultiple: number;
  maxPixels?: number;
}

/**
 * Per-family video dimension rules for the wrapper's final normalization pass.
 *
 * These mirror the Supernet model tiers (the socket remains authoritative)
 * instead of one legacy ceiling: the historical blanket 480–1536 clamp
 * silently downscaled every LTX-2.5 1920x1088 request to 1536x864 before the
 * job ever left the client. Finer per-model defaults (aspect presets, exact
 * divisors) belong to callers — the hosted-tool registry and CLI model cards —
 * this layer only keeps the request inside the family's valid envelope.
 */
export function getVideoDimensionRules(modelId?: string): VideoDimensionRules {
  if (modelId) {
    if (isMiniMaxH3VideoModel(modelId)) {
      // H3 validates both axes on a 32px grid and caps the whole canvas at
      // 1344x768 pixels. The pixel cap matters independently of the per-axis
      // ceiling: 1344x1344 is on-grid but is still not a valid H3 canvas.
      return {
        minDimension: 32,
        maxDimension: 1344,
        dimensionMultiple: 32,
        maxPixels: 1_032_192,
      };
    }
    if (isLtxVideoModel(modelId)) {
      // LTX-2.x tiers accept 640–3840 (step 8 server-side); multiples of 16
      // keep every emitted size on the tier grid, 1920x1088 included.
      return { minDimension: 640, maxDimension: 3840, dimensionMultiple: 16 };
    }
    if (isHappyHorseVideoModel(modelId)) {
      // HappyHorse registers exact 720P/1080P geometries (1920 ceiling, no
      // divisor) — rounding to multiples of 16 would corrupt 1080.
      return { minDimension: 480, maxDimension: 1920, dimensionMultiple: 1 };
    }
    if (isSeedanceVideoModel(modelId)) {
      // The Seedance vendor path validates its own named resolutions (up to
      // native 4K on 2.0); never shrink the request on its behalf.
      return { minDimension: 1, maxDimension: 8192, dimensionMultiple: 1 };
    }
  }
  // Legacy envelope for WAN and unrecognized models — matches the 1536-class
  // WAN tiers this clamp was originally written for.
  return { minDimension: 480, maxDimension: 1536, dimensionMultiple: 16 };
}

/**
 * Get the maximum number of context images supported by a model
 */
export function getMaxContextImages(modelId: string): number {
  if (
    modelId === 'krea2_identity_edit_v1_2' ||
    modelId === 'krea2_identity_edit_sogni_v0_3_alpha' ||
    modelId === 'dark_beast_krea2_identity_edit_v1_2'
  ) {
    return 2;
  }
  if (modelId.includes('qwen_image_edit')) {
    return 3;
  }
  if (modelId.includes('kontext')) {
    return 2;
  }
  if (modelId.includes('flux')) {
    return 6;
  }
  return 0; // Model doesn't support context images
}

/**
 * Check if a model supports context images
 */
export function supportsContextImages(modelId: string): boolean {
  return getMaxContextImages(modelId) > 0;
}

/**
 * Check if using cookie-based authentication
 */
export function isCookieAuth(config: SogniClientConfig): boolean {
  return config.authType === 'cookies';
}

/**
 * Validate client configuration
 */
export function validateClientConfig(config: SogniClientConfig): void {
  // Validate authType if provided
  if (config.authType !== undefined && !['token', 'cookies', 'apiKey'].includes(config.authType)) {
    throw new SogniValidationError('authType must be one of: "token", "cookies", "apiKey"');
  }

  const authType = config.authType ?? (config.apiKey ? 'apiKey' : 'token');

  if (authType === 'apiKey') {
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new SogniValidationError('apiKey is required and must be a string for apiKey auth');
    }

    if (config.username !== undefined && typeof config.username !== 'string') {
      throw new SogniValidationError('Username must be a string if provided');
    }
    if (config.password !== undefined && typeof config.password !== 'string') {
      throw new SogniValidationError('Password must be a string if provided');
    }
  } else if (authType !== 'cookies') {
    // For token auth (default), username and password are required
    if (!config.username || typeof config.username !== 'string') {
      throw new SogniValidationError('Username is required and must be a string');
    }

    if (!config.password || typeof config.password !== 'string') {
      throw new SogniValidationError('Password is required and must be a string');
    }
  }

  // For cookie auth, username/password are optional but must be strings if provided
  if (authType === 'cookies') {
    if (config.username !== undefined && typeof config.username !== 'string') {
      throw new SogniValidationError('Username must be a string if provided');
    }
    if (config.password !== undefined && typeof config.password !== 'string') {
      throw new SogniValidationError('Password must be a string if provided');
    }
  }

  if (config.network && !['fast', 'relaxed'].includes(config.network)) {
    throw new SogniValidationError('Network must be either "fast" or "relaxed"');
  }

  if (config.appSource !== undefined && typeof config.appSource !== 'string') {
    throw new SogniValidationError('appSource must be a string');
  }

  if (config.testnet !== undefined && typeof config.testnet !== 'boolean') {
    throw new SogniValidationError('testnet must be a boolean');
  }

  if (config.socketEndpoint !== undefined && typeof config.socketEndpoint !== 'string') {
    throw new SogniValidationError('socketEndpoint must be a string');
  }

  if (config.restEndpoint !== undefined && typeof config.restEndpoint !== 'string') {
    throw new SogniValidationError('restEndpoint must be a string');
  }

  if (config.disableSocket !== undefined && typeof config.disableSocket !== 'boolean') {
    throw new SogniValidationError('disableSocket must be a boolean');
  }

  if (config.multiInstance !== undefined && typeof config.multiInstance !== 'boolean') {
    throw new SogniValidationError('multiInstance must be a boolean');
  }

  if (config.allowInsecureTLS !== undefined && typeof config.allowInsecureTLS !== 'boolean') {
    throw new SogniValidationError('allowInsecureTLS must be a boolean');
  }

  if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    throw new SogniValidationError('Timeout must be a positive number');
  }

  if (config.reconnectInterval !== undefined && (typeof config.reconnectInterval !== 'number' || config.reconnectInterval <= 0)) {
    throw new SogniValidationError('Reconnect interval must be a positive number');
  }
}

/**
 * Validate project configuration
 */
export function validateProjectConfig(config: ProjectConfig): void {
  if (!config.modelId || typeof config.modelId !== 'string') {
    throw new SogniValidationError('Model ID is required and must be a string');
  }

  if (config.positivePrompt === undefined || config.positivePrompt === null || typeof config.positivePrompt !== 'string') {
    throw new SogniValidationError('Positive prompt is required and must be a string');
  }

  if (!config.type || !['image', 'video', 'audio'].includes(config.type)) {
    throw new SogniValidationError('Project type must be one of: "image", "video", "audio"');
  }

  if (config.numberOfMedia !== undefined) {
    if (typeof config.numberOfMedia !== 'number' || config.numberOfMedia < 1) {
      throw new SogniValidationError(`Number of ${config.type}s must be at least 1`);
    }
  }

  if (config.steps !== undefined) {
    if (typeof config.steps !== 'number' || config.steps < 1 || config.steps > 100) {
      throw new SogniValidationError('Steps must be between 1 and 100');
    }
  }

  if (config.guidance !== undefined) {
    if (typeof config.guidance !== 'number' || config.guidance < 0 || config.guidance > 30) {
      throw new SogniValidationError('Guidance must be between 0 and 30');
    }
  }

  if (isImageProjectConfig(config) || isVideoProjectConfig(config)) {
    // FlashVSR delivers up to 2560 px on the long edge; other models keep the 2048 px bound.
    const maxDimension = config.modelId === VIDEO_UPSCALE_MODEL_ID ? VIDEO_UPSCALE_MAX_OUTPUT.longEdge : 2048;
    if (config.width !== undefined) {
      if (typeof config.width !== 'number' || config.width < 256 || config.width > maxDimension) {
        throw new SogniValidationError(`Width must be between 256 and ${maxDimension}`);
      }
    }

    if (config.height !== undefined) {
      if (typeof config.height !== 'number' || config.height < 256 || config.height > maxDimension) {
        throw new SogniValidationError(`Height must be between 256 and ${maxDimension}`);
      }
    }
  }

  if (config.tokenType && !['sogni', 'spark'].includes(config.tokenType)) {
    throw new SogniValidationError('Token type must be either "sogni" or "spark"');
  }

  // Type-specific validations
  if (isImageProjectConfig(config)) {
    if (config.outputFormat && !['png', 'jpg'].includes(config.outputFormat)) {
      throw new SogniValidationError('Image output format must be either "png" or "jpg"');
    }

    if (config.startingImageStrength !== undefined) {
      if (typeof config.startingImageStrength !== 'number' || config.startingImageStrength < 0 || config.startingImageStrength > 1) {
        throw new SogniValidationError('Starting image strength must be between 0 and 1');
      }
    }

    // Context images validation
    if (config.contextImages !== undefined) {
      if (!Array.isArray(config.contextImages)) {
        throw new SogniValidationError('contextImages must be an array');
      }

      const maxImages = 6; // Maximum across all models
      if (config.contextImages.length > maxImages) {
        throw new SogniValidationError(
          `contextImages can have at most ${maxImages} images`
        );
      }

      // Validate each item is valid InputMedia type
      for (let i = 0; i < config.contextImages.length; i++) {
        const img = config.contextImages[i];
        const isValid = img === true ||
                        Buffer.isBuffer(img) ||
                        (typeof Blob !== 'undefined' && img instanceof Blob);
        if (!isValid && img !== undefined) {
          throw new SogniValidationError(
            `contextImages[${i}] must be a Buffer, Blob, or true (for pre-uploaded)`
          );
        }
      }
    }
  }

  if (isVideoProjectConfig(config)) {
    const validateHttpsUrlArray = (fieldName: string, values: unknown): string[] => {
      if (!Array.isArray(values)) {
        throw new SogniValidationError(`${fieldName} must be an array`);
      }

      const normalizedValues = values as unknown[];
      for (let i = 0; i < normalizedValues.length; i++) {
        const value = normalizedValues[i];
        if (typeof value !== 'string') {
          throw new SogniValidationError(`${fieldName}[${i}] must be a string`);
        }

        let parsedUrl: URL;
        try {
          parsedUrl = new URL(value);
        } catch {
          throw new SogniValidationError(`${fieldName}[${i}] must be a valid HTTPS URL`);
        }

        if (parsedUrl.protocol !== 'https:') {
          throw new SogniValidationError(`${fieldName}[${i}] must be a valid HTTPS URL`);
        }
      }

      return normalizedValues as string[];
    };

    if (config.outputFormat && config.outputFormat !== 'mp4') {
      throw new SogniValidationError('Video output format must be "mp4"');
    }

    if (config.frames !== undefined) {
      if (config.modelId === VIDEO_UPSCALE_MODEL_ID) {
        // FlashVSR keeps the source's own frame count and has no client-side
        // length cap: the server's admission check alone refuses a long source.
        if (typeof config.frames !== 'number' || !Number.isInteger(config.frames) || config.frames < 1) {
          throw new SogniValidationError('Frames must be a whole number of at least 1');
        }
      } else if (typeof config.frames !== 'number' || config.frames < 1 || config.frames > 2001) {
        throw new SogniValidationError('Frames must be between 1 and 2001');
      }
    }

    if (config.fps !== undefined) {
      if (typeof config.fps !== 'number' || config.fps < 1 || config.fps > 60) {
        throw new SogniValidationError('FPS must be between 1 and 60');
      }
    }

    if (config.shift !== undefined) {
      if (typeof config.shift !== 'number' || config.shift < 0 || config.shift > 10) {
        throw new SogniValidationError('Shift must be between 0 and 10');
      }
    }

    if (config.detailerStrength !== undefined) {
      if (typeof config.detailerStrength !== 'number' || config.detailerStrength < 0 || config.detailerStrength > 1) {
        throw new SogniValidationError('detailerStrength must be between 0 and 1');
      }
    }

    if (config.generateAudio !== undefined && typeof config.generateAudio !== 'boolean') {
      throw new SogniValidationError('generateAudio must be a boolean');
    }

    if (config.audioIdentityStrength !== undefined) {
      if (
        typeof config.audioIdentityStrength !== 'number' ||
        config.audioIdentityStrength < 0 ||
        config.audioIdentityStrength > 10
      ) {
        throw new SogniValidationError('audioIdentityStrength must be between 0 and 10');
      }
    }

    const referenceImageUrls =
      config.referenceImageUrls !== undefined
        ? validateHttpsUrlArray('referenceImageUrls', config.referenceImageUrls)
        : [];
    const referenceVideoUrls =
      config.referenceVideoUrls !== undefined
        ? validateHttpsUrlArray('referenceVideoUrls', config.referenceVideoUrls)
        : [];
    const referenceAudioUrls =
      config.referenceAudioUrls !== undefined
        ? validateHttpsUrlArray('referenceAudioUrls', config.referenceAudioUrls)
        : [];

    if (isSeedanceVideoModel(config.modelId)) {
      if (config.fps !== undefined && config.fps !== 24) {
        throw new SogniValidationError('Seedance video models require fps to be 24');
      }

      // Seedance 2.5 renders 4-30s and accepts 30 images / 10 videos / 10 audios
      // (50 total); the 2.0 family renders 4-15s and accepts 9 / 3 / 3 (12 total).
      // Caps are read from the protocol catalog rather than re-hard-coded here.
      const isSeedance25 = isSeedance25VideoModel(config.modelId);
      const maxSeedanceDuration = isSeedance25 ? 30 : 15;
      const seedanceLimits = getSeedanceReferenceLimits(config.modelId);

      if (config.duration !== undefined) {
        if (typeof config.duration !== 'number' || config.duration < 4 || config.duration > maxSeedanceDuration) {
          throw new SogniValidationError(
            `Seedance video duration must be between 4 and ${maxSeedanceDuration} seconds`
          );
        }
      }

      const imageAssetCount =
        (config.referenceImage ? 1 : 0) +
        (config.referenceImageEnd ? 1 : 0) +
        referenceImageUrls.length;
      const videoAssetCount = (config.referenceVideo ? 1 : 0) + referenceVideoUrls.length;
      const audioAssetCount =
        (config.referenceAudio ? 1 : 0) +
        (config.referenceAudioIdentity ? 1 : 0) +
        referenceAudioUrls.length;

      if (imageAssetCount > seedanceLimits.images) {
        throw new SogniValidationError(`Seedance supports at most ${seedanceLimits.images} image assets per request`);
      }
      if (videoAssetCount > seedanceLimits.videos) {
        throw new SogniValidationError(`Seedance supports at most ${seedanceLimits.videos} video assets per request`);
      }
      if (audioAssetCount > seedanceLimits.audios) {
        throw new SogniValidationError(`Seedance supports at most ${seedanceLimits.audios} audio assets per request`);
      }
      if (imageAssetCount + videoAssetCount + audioAssetCount > seedanceLimits.assets) {
        throw new SogniValidationError(`Seedance supports at most ${seedanceLimits.assets} total assets per request`);
      }

      if (referenceAudioUrls.length > 0 && imageAssetCount === 0 && videoAssetCount === 0) {
        throw new SogniValidationError(
          'Seedance audio URL references require at least one image or video reference'
        );
      }
    }

    if (isHappyHorseVideoModel(config.modelId)) {
      if (config.fps !== undefined && config.fps !== 24) {
        throw new SogniValidationError('HappyHorse video models require fps to be 24');
      }

      if (config.duration !== undefined) {
        if (typeof config.duration !== 'number' || config.duration < 3 || config.duration > 15) {
          throw new SogniValidationError('HappyHorse video duration must be between 3 and 15 seconds');
        }
      }

      const imageAssetCount =
        (config.referenceImage ? 1 : 0) +
        (config.referenceImageEnd ? 1 : 0) +
        referenceImageUrls.length;
      const videoAssetCount = (config.referenceVideo ? 1 : 0) + referenceVideoUrls.length;
      const audioAssetCount =
        (config.referenceAudio ? 1 : 0) +
        (config.referenceAudioIdentity ? 1 : 0) +
        referenceAudioUrls.length;

      // HappyHorse takes image references only (i2v: 1 first_frame, r2v: up to 9
      // reference_image); it has native always-on synchronized audio and does
      // not accept reference videos or audios.
      if (imageAssetCount > 9) {
        throw new SogniValidationError('HappyHorse supports at most 9 image references per request');
      }
      if (videoAssetCount > 0) {
        throw new SogniValidationError('HappyHorse does not support reference videos');
      }
      if (audioAssetCount > 0) {
        throw new SogniValidationError('HappyHorse does not support reference audios; audio is generated natively');
      }
    }
  }

  if (isAudioProjectConfig(config)) {
    if (config.outputFormat && !['mp3', 'flac', 'wav'].includes(config.outputFormat)) {
      throw new SogniValidationError('Audio output format must be one of: "mp3", "flac", "wav"');
    }

    if (config.duration !== undefined) {
      if (typeof config.duration !== 'number' || config.duration < 10 || config.duration > 600) {
        throw new SogniValidationError('Audio duration must be between 10 and 600 seconds');
      }
    }

    if (config.bpm !== undefined) {
      if (typeof config.bpm !== 'number' || config.bpm < 30 || config.bpm > 300) {
        throw new SogniValidationError('Audio BPM must be between 30 and 300');
      }
    }

    if (config.promptStrength !== undefined) {
      if (typeof config.promptStrength !== 'number' || config.promptStrength < 0 || config.promptStrength > 10) {
        throw new SogniValidationError('promptStrength must be between 0 and 10');
      }
    }

    if (config.creativity !== undefined) {
      if (typeof config.creativity !== 'number' || config.creativity < 0 || config.creativity > 2) {
        throw new SogniValidationError('creativity must be between 0 and 2');
      }
    }
  }
}

/**
 * Create a promise that rejects after a timeout
 */
export function createTimeoutPromise<T>(timeoutMs: number, errorMessage: string = 'Operation timed out'): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const { timeout = 30000, interval = 100, timeoutMessage = 'Wait condition timed out' } = options;

  const startTime = Date.now();

  while (true) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }

    if (Date.now() - startTime >= timeout) {
      throw new Error(timeoutMessage);
    }

    await sleep(interval);
  }
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is a plain object
 */
export function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && value.constructor === Object;
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;

  const source = sources.shift();
  if (!source) return target;

  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key in source) {
      if (isPlainObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key] as any);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Sanitize string for logging (hide sensitive data)
 */
export function sanitizeForLog(str: string, keysToHide: string[] = ['password', 'apiKey', 'token']): string {
  let sanitized = str;
  
  keysToHide.forEach(key => {
    const regex = new RegExp(`(${key}["\']?\\s*[:=]\\s*["\']?)([^"',}\\s]+)`, 'gi');
    sanitized = sanitized.replace(regex, '$1***');
  });
  
  return sanitized;
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, waitMs);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limitMs);
    }
  };
}
