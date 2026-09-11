/**
 * Video Generation Settings
 */

import { parseAspectRatio } from "./imageDimensions.js";

// ============================================================================
// Model IDs & Types
// ============================================================================

export type VideoModelId =
  | "wan22"
  | "ltx23"
  | "ltx25"
  | Ltx25ConcreteModelId
  | "minimax-h3-t2v"
  | "minimax-h3-i2v"
  | "minimax-h3-flf2v"
  | "minimax-h3-r2v"
  | "minimax-h3-t2v-turbo"
  | "minimax-h3-i2v-turbo"
  | "minimax-h3-flf2v-turbo"
  | "minimax-h3-r2v-turbo"
  | "minimax-h3-fasth3-t2v-turbo"
  | "minimax-h3-fasth3-i2v-turbo"
  | "minimax-h3-fasth3-flf2v-turbo"
  | "seedance2"
  | "seedance2-mini"
  | "seedance2-5"
  | "happyhorse-1.1-t2v"
  | "happyhorse-1.1-i2v"
  | "happyhorse-1.1-r2v"
  | "wan3.0-video"
  | "wan3.0-spicy-video";
export type VideoQualityTier = "fast" | "hq" | "pro";
export type Ltx23Workflow = "t2v" | "i2v" | "a2v" | "ia2v";
export type Ltx25Workflow = "t2v" | "i2v" | "a2v" | "ia2v" | "v2v";
export type Ltx25ConcreteModelId =
  | "ltx25-22b-int8_t2v_distilled"
  | "ltx25-22b-int8_i2v_distilled"
  | "ltx25-22b-int8_a2v_distilled"
  | "ltx25-22b-int8_ia2v_distilled"
  | "ltx25-22b-int8_t2v_dev"
  | "ltx25-22b-int8_i2v_dev"
  | "ltx25-22b-int8_a2v_dev"
  | "ltx25-22b-int8_ia2v_dev"
  | "ltx25-22b-int8_v2v_distilled"
  | "ltx25-22b-int8_v2v_dev";

export interface VideoModelConfig {
  model: string;
  /** Output fps sent to the worker. For WAN this is the interpolated playback rate. */
  fps: number;
  /**
   * Native generation fps used for frame-count math. When omitted, falls back to `fps`.
   * WAN 2.2 generates at 16fps internally and the worker interpolates up to `fps`.
   */
  internalFps?: number;
  steps?: number;
  guidance?: number;
  dimensionDivisor: number;
  minDimension: number;
  maxDimension: number;
  sampler?: string;
  scheduler?: string;
  /** WAN-specific: shift parameter */
  shift?: number;
  /** LTX 2.3-specific: I2V conditioning strength */
  strength?: number;
  /** Fixed shorter-side resolution tiers (e.g. LTX 2.3 snaps to 1088 or 768) */
  resolutionTiers?: number[];
  /** Source image shorter-side threshold: below this -> use lower tier */
  resolutionThreshold?: number;
  /** First valid frame count on the model's sampling grid. */
  frameBase?: number;
  /** Distance between valid frame counts. */
  frameStep?: number;
  minFrames?: number;
  maxFrames?: number;
  /** Maximum width × height accepted by the model. */
  maxPixels?: number;
  /** Whether the model produces a native audio track. */
  nativeAudio?: boolean;
  /** Whether callers can request a returned video without an audio track. */
  supportsAudioToggle?: boolean;
  /** Whether the model accepts a separate negative prompt. */
  supportsNegativePrompt?: boolean;
  /** Whether the vendor can derive output shape from source media. */
  supportsAdaptiveRatio?: boolean;
  /**
   * Whether Sogni lets the vendor choose output duration dynamically.
   * @deprecated Wan 3 smartDuration was retired on 2026-08-29 (the server and SDK
   * reject it); no model sets this to true. Send an explicit duration instead.
   */
  supportsSmartDuration?: boolean;
  /** Whether the vendor exposes prompt expansion control. */
  supportsPromptExtend?: boolean;
  /** Whether the vendor exposes a visible watermark option. */
  supportsWatermark?: boolean;
  /** Whether a public document URL can be used as context. */
  supportsDocumentReference?: boolean;
  /** Whether a public webpage URL can be used as context. */
  supportsWebpageReference?: boolean;
}

export const LTX23_DISTILLED_MODEL_IDS: Record<Ltx23Workflow, string> = {
  t2v: "ltx23-22b-fp8_t2v_distilled",
  i2v: "ltx23-22b-fp8_i2v_distilled",
  a2v: "ltx23-22b-fp8_a2v_distilled",
  ia2v: "ltx23-22b-fp8_ia2v_distilled",
};

export const LTX23_DEV_MODEL_IDS: Record<Ltx23Workflow, string> = {
  t2v: "ltx23-22b-fp8_t2v_dev",
  i2v: "ltx23-22b-fp8_i2v_dev",
  a2v: "ltx23-22b-fp8_a2v_dev",
  ia2v: "ltx23-22b-fp8_ia2v_dev",
};

export function getLtx23WorkflowModelIdForQuality(
  workflow: Ltx23Workflow,
  qualityTier: VideoQualityTier | undefined = "fast",
): string {
  return qualityTier === "pro"
    ? LTX23_DEV_MODEL_IDS[workflow]
    : LTX23_DISTILLED_MODEL_IDS[workflow];
}

export function getLtx23ModelNameForQuality(
  workflowName: string,
  qualityTier: VideoQualityTier | undefined = "fast",
): string {
  return qualityTier === "pro"
    ? `LTX 2.3 22B ${workflowName} Dev`
    : `LTX 2.3 22B ${workflowName} Distilled`;
}

export function getLtx23StepsForQuality(
  qualityTier: VideoQualityTier | undefined = "fast",
): number {
  return qualityTier === "pro" ? 20 : 8;
}

export const LTX25_DISTILLED_WORKFLOW_MODELS: Record<Ltx25Workflow, Ltx25ConcreteModelId> = {
  t2v: "ltx25-22b-int8_t2v_distilled",
  i2v: "ltx25-22b-int8_i2v_distilled",
  a2v: "ltx25-22b-int8_a2v_distilled",
  ia2v: "ltx25-22b-int8_ia2v_distilled",
  v2v: "ltx25-22b-int8_v2v_distilled",
};

export const LTX25_DEV_WORKFLOW_MODELS: Record<Ltx25Workflow, Ltx25ConcreteModelId> = {
  t2v: "ltx25-22b-int8_t2v_dev",
  i2v: "ltx25-22b-int8_i2v_dev",
  a2v: "ltx25-22b-int8_a2v_dev",
  ia2v: "ltx25-22b-int8_ia2v_dev",
  v2v: "ltx25-22b-int8_v2v_dev",
};

export function getLtx25WorkflowModelIdForQuality(
  workflow: Ltx25Workflow,
  _qualityTier: VideoQualityTier | undefined = "fast",
): Ltx25ConcreteModelId {
  // LTX 2.5 Dev checkpoints remain registered for internal validation, but
  // upstream has not published a supported ComfyUI Dev recipe. Keep every
  // public quality selector on the release-validated Distilled workflow.
  return LTX25_DISTILLED_WORKFLOW_MODELS[workflow];
}

export function getLtx25ModelNameForQuality(
  workflowName: string,
  _qualityTier: VideoQualityTier | undefined = "fast",
): string {
  return `LTX 2.5 22B ${workflowName} Distilled`;
}

export function getLtx25StepsForQuality(
  _qualityTier: VideoQualityTier | undefined = "fast",
): number {
  return 8;
}

export const VIDEO_MODEL_CONFIGS: Record<VideoModelId, VideoModelConfig> = {
  wan22: {
    model: "wan_v2.2-14b-fp8_i2v_lightx2v",
    fps: 32,
    internalFps: 16,
    steps: 6,
    guidance: 5.0,
    dimensionDivisor: 16,
    minDimension: 480,
    maxDimension: 1536,
    sampler: "euler",
    scheduler: "simple",
    shift: 8.0,
  },
  ltx23: {
    model: LTX23_DISTILLED_MODEL_IDS.i2v,
    fps: 24,
    steps: getLtx23StepsForQuality("fast"),
    guidance: 1.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler",
    scheduler: "simple",
    strength: 0.9,
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
  },
  ltx25: {
    model: LTX25_DISTILLED_WORKFLOW_MODELS.i2v,
    fps: 24,
    steps: getLtx25StepsForQuality("fast"),
    guidance: 1.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    strength: 0.7,
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_t2v_distilled": {
    model: LTX25_DISTILLED_WORKFLOW_MODELS.t2v,
    fps: 24,
    steps: 8,
    guidance: 1.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_i2v_distilled": {
    model: LTX25_DISTILLED_WORKFLOW_MODELS.i2v,
    fps: 24,
    steps: 8,
    guidance: 1.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    strength: 0.7,
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_a2v_distilled": {
    model: LTX25_DISTILLED_WORKFLOW_MODELS.a2v,
    fps: 24,
    steps: 8,
    guidance: 1.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_ia2v_distilled": {
    model: LTX25_DISTILLED_WORKFLOW_MODELS.ia2v,
    fps: 24,
    steps: 8,
    guidance: 1.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    strength: 0.7,
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_t2v_dev": {
    model: LTX25_DEV_WORKFLOW_MODELS.t2v,
    fps: 24,
    steps: 30,
    guidance: 3.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_i2v_dev": {
    model: LTX25_DEV_WORKFLOW_MODELS.i2v,
    fps: 24,
    steps: 30,
    guidance: 3.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    strength: 0.7,
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_a2v_dev": {
    model: LTX25_DEV_WORKFLOW_MODELS.a2v,
    fps: 24,
    steps: 30,
    guidance: 3.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_ia2v_dev": {
    model: LTX25_DEV_WORKFLOW_MODELS.ia2v,
    fps: 24,
    steps: 30,
    guidance: 3.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    strength: 0.7,
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_v2v_distilled": {
    model: LTX25_DISTILLED_WORKFLOW_MODELS.v2v,
    fps: 24,
    steps: 8,
    guidance: 1.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    strength: 0.85,
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "ltx25-22b-int8_v2v_dev": {
    model: LTX25_DEV_WORKFLOW_MODELS.v2v,
    fps: 24,
    steps: 30,
    guidance: 3.0,
    dimensionDivisor: 64,
    minDimension: 640,
    maxDimension: 3840,
    sampler: "euler_ancestral",
    scheduler: "manual_sigmas",
    strength: 0.85,
    resolutionTiers: [1088, 768],
    resolutionThreshold: 720,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: true,
  },
  "minimax-h3-t2v": {
    model: "minimax-h3-fl2va-fp8_t2v",
    fps: 24,
    steps: 20,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    sampler: "res_multistep",
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  "minimax-h3-i2v": {
    model: "minimax-h3-fl2va-fp8_i2v",
    fps: 24,
    steps: 20,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    sampler: "res_multistep",
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  "minimax-h3-flf2v": {
    model: "minimax-h3-fl2va-fp8_flf2v",
    fps: 24,
    steps: 20,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    sampler: "res_multistep",
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  "minimax-h3-r2v": {
    model: "minimax-h3-ref2va-fp8_r2v",
    fps: 24,
    steps: 20,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    sampler: "res_multistep",
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  // MiniMax H3 Turbo uses LightX2V four-step LoRAs. The FL2VA worker graphs own
  // ER-SDE sampling, while Ref2VA Turbo follows its upstream Euler recipe.
  "minimax-h3-t2v-turbo": {
    model: "minimax-h3-fl2va-fp8_t2v_turbo",
    fps: 24,
    steps: 4,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  "minimax-h3-i2v-turbo": {
    model: "minimax-h3-fl2va-fp8_i2v_turbo",
    fps: 24,
    steps: 4,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  "minimax-h3-flf2v-turbo": {
    model: "minimax-h3-fl2va-fp8_flf2v_turbo",
    fps: 24,
    steps: 4,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  "minimax-h3-r2v-turbo": {
    model: "minimax-h3-ref2va-fp8_r2v_turbo",
    fps: 24,
    steps: 4,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    sampler: "euler",
    scheduler: "simple",
    resolutionTiers: [544],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  // FastH3 is the FastVideo VSA four-step recipe. It is separate from the
  // existing LightX2V Turbo selectors and is qualified only with Euler/simple.
  "minimax-h3-fasth3-t2v-turbo": {
    model: "minimax-h3-fastvideo-int8_t2v_turbo",
    fps: 24,
    steps: 4,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    sampler: "euler",
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  "minimax-h3-fasth3-i2v-turbo": {
    model: "minimax-h3-fastvideo-int8_i2v_turbo",
    fps: 24,
    steps: 4,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    sampler: "euler",
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  "minimax-h3-fasth3-flf2v-turbo": {
    model: "minimax-h3-fastvideo-int8_flf2v_turbo",
    fps: 24,
    steps: 4,
    guidance: 1,
    dimensionDivisor: 32,
    minDimension: 32,
    maxDimension: 1344,
    sampler: "euler",
    scheduler: "simple",
    resolutionTiers: [768],
    frameBase: 124,
    frameStep: 17,
    minFrames: 124,
    maxFrames: 362,
    maxPixels: 1_032_192,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsNegativePrompt: false,
  },
  // Seedance 2.0 routes through Sogni Socket's vendor-job path to BytePlus.
  // The socket re-derives ratio from width/height and duration from
  // frames/fps for vendor models, so we use permissive constraints here
  // (dimensionDivisor: 1, generous min/max). The mapped SDK model ID is
  // the canonical Seedance socket tier.
  seedance2: {
    model: "seedance-2-0",
    fps: 24,
    dimensionDivisor: 1,
    minDimension: 1,
    maxDimension: 99999,
  },
  "seedance2-mini": {
    model: "seedance-2-0-mini",
    fps: 24,
    dimensionDivisor: 1,
    minDimension: 1,
    maxDimension: 1280,
  },
  // Seedance 2.5 is 480p/720p only (maxDimension 1280) but renders up to 30s
  // per call, so its frame ceiling is double the 2.0 family's.
  "seedance2-5": {
    model: "seedance-2-5",
    fps: 24,
    dimensionDivisor: 1,
    minDimension: 1,
    maxDimension: 1280,
    minFrames: 97,
    maxFrames: 721,
  },
  // Alibaba HappyHorse 1.1 routes through Sogni Socket's vendor-job path to
  // Alibaba DashScope (Singapore). The socket re-derives ratio from
  // width/height and duration from frames/fps for vendor models, so we use
  // permissive constraints here. Unlike Seedance there is no mini tier —
  // each mode (t2v/i2v/r2v) is its own canonical model id. 1080P is the upper
  // bound, so maxDimension is capped at 1920.
  "happyhorse-1.1-t2v": {
    model: "happyhorse-1.1-t2v",
    fps: 24,
    dimensionDivisor: 1,
    minDimension: 1,
    maxDimension: 1920,
  },
  "happyhorse-1.1-i2v": {
    model: "happyhorse-1.1-i2v",
    fps: 24,
    dimensionDivisor: 1,
    minDimension: 1,
    maxDimension: 1920,
  },
  "happyhorse-1.1-r2v": {
    model: "happyhorse-1.1-r2v",
    fps: 24,
    dimensionDivisor: 1,
    minDimension: 1,
    maxDimension: 1920,
  },
  "wan3.0-video": {
    model: "wan3.0-video",
    fps: 30,
    dimensionDivisor: 1,
    minDimension: 480,
    maxDimension: 1920,
    frameBase: 1,
    frameStep: 1,
    minFrames: 61,
    maxFrames: 901,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsAdaptiveRatio: true,
    supportsSmartDuration: false,
    supportsPromptExtend: true,
    supportsWatermark: true,
    supportsDocumentReference: true,
    supportsWebpageReference: true,
  },
  "wan3.0-spicy-video": {
    model: "wan3.0-spicy-video",
    fps: 30,
    dimensionDivisor: 1,
    minDimension: 480,
    maxDimension: 1920,
    frameBase: 1,
    frameStep: 1,
    minFrames: 61,
    maxFrames: 901,
    nativeAudio: true,
    supportsAudioToggle: true,
    supportsAdaptiveRatio: true,
    supportsSmartDuration: false,
    supportsPromptExtend: true,
  },
};

// Wan 3 unified multimodal capability contract (provider APIs, 2026-08).
export const WAN3_VIDEO_MODEL_ID = "wan3.0-video" as const;
export const WAN3_ENHANCED_VIDEO_MODEL_ID = "wan3.0-spicy-video" as const;
export type Wan3Resolution = "480P" | "720P" | "1080P";
export const WAN3_SUPPORTED_RATIOS: readonly string[] = Object.freeze([
  "adaptive", "16:9", "4:3", "1:1", "3:4", "9:16",
]);
export const WAN3_RESOLUTIONS: readonly Wan3Resolution[] = Object.freeze([
  "480P", "720P", "1080P",
]);
export const WAN3_REFERENCE_LIMITS = Object.freeze({
  firstFrames: 1,
  lastFrames: 1,
  images: 10,
  videos: 5,
  audios: 5,
  files: 1,
  links: 1,
});

// ============================================================================
// HappyHorse 1.1 capability contract (canonical source of truth)
// ============================================================================
//
// Downstream consumers (creative-agent, sogni-chat, the CLI skill) read this to
// gate duration/resolution/ratio/reference inputs before dispatch. It captures
// the per-mode capabilities that VideoModelConfig (a worker-dimension shape)
// cannot express. Mirrors the role of the Seedance reference-limit catalog.

export type HappyHorseMode = "t2v" | "i2v" | "r2v";
export type HappyHorseResolution = "720P" | "1080P";

export interface HappyHorseModelSettings {
  /** Canonical vendor model id (matches the socket tier and Alibaba `model`). */
  readonly model: string;
  readonly mode: HappyHorseMode;
  /** HappyHorse always renders at 24 fps. */
  readonly fps: 24;
  /** Inclusive duration bounds in whole seconds. */
  readonly minDuration: 3;
  readonly maxDuration: 15;
  /** Resolutions sent in the request as the strings "720P"/"1080P". */
  readonly resolutions: readonly HappyHorseResolution[];
  /**
   * HappyHorse renders a native synchronized audio track; it is always on and
   * is NOT user-toggleable (no `generateAudio`/`audio` parameter is sent).
   */
  readonly nativeAudio: true;
  readonly supportedRatios: readonly string[];
  /** Max image references for this mode (i2v: first_frame, r2v: reference_image). */
  readonly maxReferenceImages: number;
  /** HappyHorse does not accept reference videos. */
  readonly maxReferenceVideos: 0;
  /** HappyHorse does not accept reference audios (audio is native). */
  readonly maxReferenceAudios: 0;
  /** Third-party vendor model — requires Premium Spark. */
  readonly premium: true;
}

/** Aspect ratios accepted by HappyHorse 1.1 (verified against the live API). */
export const HAPPYHORSE_SUPPORTED_RATIOS: readonly string[] = Object.freeze([
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
  "9:21",
  "21:9",
]);

export const HAPPYHORSE_RESOLUTIONS: readonly HappyHorseResolution[] = Object.freeze([
  "720P",
  "1080P",
]);

export const HAPPYHORSE_VIDEO_MODELS: Readonly<Record<string, HappyHorseModelSettings>> =
  Object.freeze({
    "happyhorse-1.1-t2v": Object.freeze({
      model: "happyhorse-1.1-t2v",
      mode: "t2v",
      fps: 24,
      minDuration: 3,
      maxDuration: 15,
      resolutions: HAPPYHORSE_RESOLUTIONS,
      nativeAudio: true,
      supportedRatios: HAPPYHORSE_SUPPORTED_RATIOS,
      maxReferenceImages: 0,
      maxReferenceVideos: 0,
      maxReferenceAudios: 0,
      premium: true,
    }),
    "happyhorse-1.1-i2v": Object.freeze({
      model: "happyhorse-1.1-i2v",
      mode: "i2v",
      fps: 24,
      minDuration: 3,
      maxDuration: 15,
      resolutions: HAPPYHORSE_RESOLUTIONS,
      nativeAudio: true,
      supportedRatios: HAPPYHORSE_SUPPORTED_RATIOS,
      maxReferenceImages: 1,
      maxReferenceVideos: 0,
      maxReferenceAudios: 0,
      premium: true,
    }),
    "happyhorse-1.1-r2v": Object.freeze({
      model: "happyhorse-1.1-r2v",
      mode: "r2v",
      fps: 24,
      minDuration: 3,
      maxDuration: 15,
      resolutions: HAPPYHORSE_RESOLUTIONS,
      nativeAudio: true,
      supportedRatios: HAPPYHORSE_SUPPORTED_RATIOS,
      maxReferenceImages: 9,
      maxReferenceVideos: 0,
      maxReferenceAudios: 0,
      premium: true,
    }),
  });

/** All three HappyHorse 1.1 model ids, in t2v/i2v/r2v order. */
export const HAPPYHORSE_MODEL_IDS: readonly string[] = Object.freeze([
  "happyhorse-1.1-t2v",
  "happyhorse-1.1-i2v",
  "happyhorse-1.1-r2v",
]);

export function getHappyHorseModelSettings(
  modelId: string | null | undefined,
): HappyHorseModelSettings | null {
  if (!modelId) return null;
  return HAPPYHORSE_VIDEO_MODELS[modelId] ?? null;
}

/** Switch this to change the default video model everywhere */
export const DEFAULT_VIDEO_MODEL: VideoModelId = "ltx25";

// legacy alias: Seedance 2.0 Fast was retired 2026-08; Mini replaced it
function resolveLegacyVideoModelId(modelId: string): VideoModelId {
  return modelId === "seedance2-fast" ? "seedance2-mini" : (modelId as VideoModelId);
}

// ============================================================================
// Derived Convenience Exports (use default model)
// ============================================================================

export function getVideoModelConfig(
  modelId: VideoModelId = DEFAULT_VIDEO_MODEL,
  qualityTier: VideoQualityTier | undefined = "fast",
): VideoModelConfig {
  const config = VIDEO_MODEL_CONFIGS[resolveLegacyVideoModelId(modelId)];
  if (modelId === "ltx25") {
    return {
      ...config,
      model: getLtx25WorkflowModelIdForQuality("i2v", qualityTier),
      steps: getLtx25StepsForQuality(qualityTier),
      guidance: 1.0,
    };
  }
  if (modelId !== "ltx23") return config;
  return {
    ...config,
    model: getLtx23WorkflowModelIdForQuality("i2v", qualityTier),
    steps: getLtx23StepsForQuality(qualityTier),
  };
}

/** Backward-compatible VIDEO_CONFIG using the default model */
export const VIDEO_CONFIG = {
  get defaultFps() {
    return getVideoModelConfig().fps;
  },
  get defaultDuration() {
    return 5;
  },
  get dimensionDivisor() {
    return getVideoModelConfig().dimensionDivisor;
  },
  get minDimension() {
    return getVideoModelConfig().minDimension;
  },
  get maxDimension() {
    return getVideoModelConfig().maxDimension;
  },
  get defaultFrames() {
    return calculateVideoFrames(5);
  },
};

export const VIDEO_QUALITY_PRESETS = {
  fast: {
    get model() {
      return getVideoModelConfig().model;
    },
    get steps() {
      return getVideoModelConfig().steps;
    },
    label: "Fast",
    description: "Quick generation (~15-30s)",
  },
} as const;

export type VideoQualityPreset = keyof typeof VIDEO_QUALITY_PRESETS;

// ============================================================================
// Dimension & Frame Calculations
// ============================================================================

export function calculateVideoDimensions(
  imageWidth: number,
  imageHeight: number,
  targetResolution?: number,
  modelId: VideoModelId = DEFAULT_VIDEO_MODEL,
  aspectRatio?: string,
): { width: number; height: number } {
  const config = VIDEO_MODEL_CONFIGS[resolveLegacyVideoModelId(modelId)];
  const divisor = config.dimensionDivisor;
  const minDim = config.minDimension;
  const maxDim = config.maxDimension;

  // Aspect ratio override -- compute effective source dimensions from the target ratio
  const parsed = parseAspectRatio(aspectRatio);
  let effectiveW = imageWidth;
  let effectiveH = imageHeight;

  if (parsed?.type === "exact") {
    effectiveW = parsed.width;
    effectiveH = parsed.height;
  } else if (parsed?.type === "ratio") {
    // Preserve approximate pixel area while adopting the new ratio
    const srcArea = imageWidth * imageHeight;
    const ratio = parsed.ratioW / parsed.ratioH;
    effectiveW = Math.sqrt(srcArea * ratio);
    effectiveH = srcArea / effectiveW;
  }

  // Resolution tier logic: snap shorter side to a fixed tier (e.g. LTX 2.3:
  // 1088/768 and MiniMax H3: 768). Explicit supported tiers use this same
  // path so their canonical landscape/portrait dimensions remain exact.
  const roundedTarget = targetResolution === undefined
    ? undefined
    : Math.round(targetResolution / divisor) * divisor;
  if (
    parsed?.type !== "exact" &&
    config.resolutionTiers &&
    config.resolutionTiers.length > 0 &&
    (roundedTarget === undefined || config.resolutionTiers.includes(roundedTarget))
  ) {
    const srcShorter = Math.min(effectiveW, effectiveH);
    const threshold =
      config.resolutionThreshold ??
      config.resolutionTiers[config.resolutionTiers.length - 1];
    // Pick tier: use highest tier unless source is below threshold
    const tier = roundedTarget ?? (
      srcShorter < threshold
        ? config.resolutionTiers[config.resolutionTiers.length - 1]
        : config.resolutionTiers[0]
    );

    let w: number, h: number;
    if (effectiveW <= effectiveH) {
      w = tier;
      h = Math.round((effectiveH * tier) / effectiveW / divisor) * divisor;
    } else {
      h = tier;
      w = Math.round((effectiveW * tier) / effectiveH / divisor) * divisor;
    }

    // Clamp longer side to maxDimension
    w = Math.min(maxDim, w);
    h = Math.min(maxDim, h);

    return constrainVideoDimensions(w, h, config);
  }

  // General logic for models without resolution tiers (WAN 2.2)
  let w = effectiveW;
  let h = effectiveH;

  // If a target resolution is specified, set the shorter side to it
  if (targetResolution !== undefined) {
    const roundedTarget = Math.round(targetResolution / divisor) * divisor;
    if (w <= h) {
      h = Math.round((h * roundedTarget) / w / divisor) * divisor;
      w = roundedTarget;
    } else {
      w = Math.round((w * roundedTarget) / h / divisor) * divisor;
      h = roundedTarget;
    }
  }

  // Scale down proportionally if the larger dimension exceeds max
  const larger = Math.max(w, h);
  if (larger > maxDim) {
    const scale = maxDim / larger;
    w *= scale;
    h *= scale;
  }

  // Scale up proportionally if the smaller dimension is below min
  const smaller = Math.min(w, h);
  if (smaller < minDim) {
    const scale = minDim / smaller;
    w *= scale;
    h *= scale;
  }

  // Round to nearest divisor
  w = Math.round(w / divisor) * divisor;
  h = Math.round(h / divisor) * divisor;

  // Final clamp
  w = Math.max(minDim, Math.min(maxDim, w));
  h = Math.max(minDim, Math.min(maxDim, h));

  return constrainVideoDimensions(w, h, config);
}

function constrainVideoDimensions(
  width: number,
  height: number,
  config: VideoModelConfig,
): { width: number; height: number } {
  const divisor = config.dimensionDivisor;
  const minDim = config.minDimension;
  const maxDim = config.maxDimension;
  let w = Math.max(minDim, Math.min(maxDim, Math.round(width / divisor) * divisor));
  let h = Math.max(minDim, Math.min(maxDim, Math.round(height / divisor) * divisor));

  if (config.maxPixels && w * h > config.maxPixels) {
    const scale = Math.sqrt(config.maxPixels / (w * h));
    w = Math.max(minDim, Math.floor((w * scale) / divisor) * divisor);
    h = Math.max(minDim, Math.floor((h * scale) / divisor) * divisor);

    // Floating-point rounding at the boundary can still leave a grid point one
    // step over budget. Reduce the axis that removes the most pixels first.
    while (w * h > config.maxPixels && (w > minDim || h > minDim)) {
      if ((h >= w && h > minDim) || w <= minDim) h -= divisor;
      else w -= divisor;
    }
  }

  return { width: w, height: h };
}

export function calculateVideoFrames(
  duration: number = 5,
  modelId: VideoModelId = DEFAULT_VIDEO_MODEL,
  qualityTier: VideoQualityTier | undefined = "fast",
): number {
  const config = getVideoModelConfig(modelId, qualityTier);
  // Use the native generation fps for frame counts. For WAN, output `fps` is
  // the interpolated playback rate while `internalFps` (16) is what the model
  // actually generates — counting frames against the output fps would double
  // the request beyond the worker's frame budget.
  const generationFps = config.internalFps ?? config.fps;
  const frameBase = config.frameBase ?? 1;
  const frameStep = config.frameStep ?? 8;
  const rawFrames = generationFps * duration + (frameBase === 1 ? 1 : 0);
  const snapped = frameBase + Math.round((rawFrames - frameBase) / frameStep) * frameStep;
  const capped = Math.min(config.maxFrames ?? snapped, snapped);
  return Math.max(config.minFrames ?? capped, capped);
}
