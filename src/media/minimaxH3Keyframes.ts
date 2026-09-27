/**
 * MiniMax H3 intermediate keyframes (Comfy worker 1.0.226+, SDK 5.58.0+).
 *
 * The agent tools take `keyframes: [{ imageIndex, atSeconds }]`; the SDK takes
 * `keyframes: [{ image, frameIndex }]`. This module is the frame math between
 * the two, shared by hosted-tool validation and the executors (sogni-chat,
 * sogni-api, the skill CLI) that resolve each `imageIndex` to image bytes.
 *
 * H3 renders at a fixed 24 fps on the 124 + 17n frame grid (124-362 frames).
 * A keyframe lands on frame `Math.round(atSeconds * 24)`, an integer from 1 to
 * `frames - 2`: frame 0 and the last frame belong to the first/last frame
 * inputs, never to keyframes. No two keyframes may share a frame. Nothing here
 * clamps, snaps or drops a keyframe: an entry that does not fit is an error that
 * says what to change.
 */

import { calculateVideoFrames, isMinimaxH3AudioGuideModelId } from './videoSettings.js';

/** Most keyframes one MiniMax H3 job pins (the `keyframeImage1..8` upload slots). */
export const MINIMAX_H3_MAX_KEYFRAMES = 8;

/** MiniMax H3's fixed generation rate, which turns `atSeconds` into a frame. */
export const MINIMAX_H3_KEYFRAME_FPS = 24;

// The MiniMax H3 frame grid: 124 + 17n frames, 124 (5.17 s) to 362 (15.08 s).
const MINIMAX_H3_SHORTEST_CLIP_FRAMES = 124;
const MINIMAX_H3_FRAME_STEP = 17;
const MINIMAX_H3_LONGEST_CLIP_FRAMES = 362;

/**
 * The workflow of a MiniMax H3 id that pins keyframes: image-to-video,
 * first/last frame, the three FastH3 audio modes, and reference to video.
 */
export type MinimaxH3KeyframeWorkflow = 'i2v' | 'flf2v' | 'ia2v' | 'flfa2v' | 'a2v' | 'r2v';

const KEYFRAME_WORKFLOWS: ReadonlySet<string> = new Set<MinimaxH3KeyframeWorkflow>([
  'i2v',
  'flf2v',
  'ia2v',
  'flfa2v',
  'a2v',
  'r2v',
]);

/**
 * The keyframe workflow of a MiniMax H3 tool selector or socket id (any `_`/`-`
 * spelling, every tier and two-stage form), or null when the id cannot pin
 * keyframes: text-to-video, the FastH3 family alias that picks its workflow
 * later, and every other model family.
 */
export function minimaxH3KeyframeWorkflow(
  modelId: string | null | undefined,
): MinimaxH3KeyframeWorkflow | null {
  if (typeof modelId !== 'string') return null;
  const normalized = modelId.trim().toLowerCase().replace(/[\s_.]+/g, '-').replace(/-+/g, '-');
  if (!normalized.startsWith('minimax-h3-')) return null;
  const workflow = normalized.split('-').find(token => KEYFRAME_WORKFLOWS.has(token));
  return (workflow as MinimaxH3KeyframeWorkflow | undefined) ?? null;
}

/**
 * True for every MiniMax H3 id that pins keyframes: `i2v` and `flf2v` on every
 * tier, the FastH3 audio modes (`ia2v`, `flfa2v`, `a2v`) and Reference to Video
 * (`r2v`). Mirrors the SDK's `isMinimaxH3KeyframeModel`, extended to the tool
 * selectors. Which of these a given tool offers is `supportsMinimaxH3Keyframes`.
 */
export function isMinimaxH3KeyframeModelId(modelId: string | null | undefined): boolean {
  return minimaxH3KeyframeWorkflow(modelId) !== null;
}

/** The frame a keyframe at `atSeconds` lands on: `Math.round(atSeconds * 24)`. */
export function minimaxH3KeyframeFrameIndex(atSeconds: number): number {
  return Math.round(atSeconds * MINIMAX_H3_KEYFRAME_FPS);
}

/** Seconds from the start of a frame index, `frameIndex / 24` (round-trips exactly). */
export function minimaxH3KeyframeSeconds(frameIndex: number): number {
  return frameIndex / MINIMAX_H3_KEYFRAME_FPS;
}

/**
 * The frame count a MiniMax H3 job renders for `durationSeconds`, exactly as the
 * SDK resolves `duration` for an H3 model: `duration * 24` snapped to the
 * nearest 124 + 17n value within 124-362 (`6` renders 141 frames, not 144).
 * The FastH3 audio-guide routes round up instead
 * (`minimaxH3AudioGuideFramesForDuration`); `minimaxH3JobFramesForDuration`
 * picks the rule for a model. Pass the result as `frames` so keyframes are
 * checked against the count the job really renders.
 */
export function minimaxH3FramesForDuration(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError(
      `MiniMax H3 duration must be a finite number of seconds greater than 0; received ${String(durationSeconds)}`,
    );
  }
  return calculateVideoFrames(durationSeconds, 'minimax-h3-i2v');
}

/**
 * The frame count a MiniMax H3 FastH3 audio-guide job (`ia2v`, `flfa2v`, `a2v`,
 * one- or two-stage) renders for `durationSeconds`: the smallest 124 + 17n
 * count that covers `durationSeconds * 24`, clamped to 124-362 (`6` renders
 * 158 frames, 6.58 s). The audio guide rounds up rather than to the nearest
 * count so the clip holds the whole requested audio window. This is the SDK's
 * `getMinimaxH3FramesForAudioDuration`, which sogni-api and the creative-agent
 * estimate submit and price as `frames`.
 */
export function minimaxH3AudioGuideFramesForDuration(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError(
      `MiniMax H3 duration must be a finite number of seconds greater than 0; received ${String(durationSeconds)}`,
    );
  }
  // The epsilon keeps exact grid durations (141/24 s) from rounding up a step.
  const neededFrames = Math.ceil(durationSeconds * MINIMAX_H3_KEYFRAME_FPS - 1e-6);
  const steps = Math.max(0, Math.ceil((neededFrames - MINIMAX_H3_SHORTEST_CLIP_FRAMES) / MINIMAX_H3_FRAME_STEP));
  return Math.min(MINIMAX_H3_LONGEST_CLIP_FRAMES, MINIMAX_H3_SHORTEST_CLIP_FRAMES + steps * MINIMAX_H3_FRAME_STEP);
}

/**
 * The frame count a MiniMax H3 job on `modelId` renders for `durationSeconds`:
 * the covering count on the FastH3 audio-guide ids
 * (`minimaxH3AudioGuideFramesForDuration`, 6 s -> 158) and the nearest count on
 * every other H3 id (`minimaxH3FramesForDuration`, 6 s -> 141). Keyframe times
 * are checked against this count.
 */
export function minimaxH3JobFramesForDuration(modelId: string | null | undefined, durationSeconds: number): number {
  return isMinimaxH3AudioGuideModelId(modelId)
    ? minimaxH3AudioGuideFramesForDuration(durationSeconds)
    : minimaxH3FramesForDuration(durationSeconds);
}

/** The tool argument: one image pinned at a moment of the clip. */
export interface MinimaxH3KeyframeArgument {
  /** Uploads are negative (-1 first upload), generated results 0 and up (the endImageIndex convention). */
  imageIndex: number;
  /** Seconds from the start of the clip where the video lands on the image. */
  atSeconds: number;
}

/** A checked keyframe, ready to pair with its image for the SDK. */
export interface MinimaxH3KeyframeTime extends MinimaxH3KeyframeArgument {
  /** Position in the caller's `keyframes` array; error text names entries by it. */
  argumentIndex: number;
  /** 0-based pixel frame at 24 fps, `Math.round(atSeconds * 24)`: the SDK `frameIndex`. */
  frameIndex: number;
}

export interface CheckMinimaxH3KeyframesOptions {
  /**
   * The job's exact H3 frame count (124-362). Leave it out only while the count
   * is not known yet (a Sound to Video clip sized by its audio window): times
   * are then checked against the longest H3 clip, and the caller must check
   * again with the real count before submitting.
   */
  frames?: number;
  /** Where `frames` came from, e.g. "duration 8 renders 192 frames"; added to a past-the-end error. */
  framesSource?: string;
  /**
   * How this route sets its first and last frames, said when a keyframe aims at
   * one of them (`minimaxH3KeyframeEdgeHint`).
   */
  edgeHint?: string;
  /** Suggest a longer `duration` when a keyframe falls past the end of the clip. */
  suggestDuration?: boolean;
  /**
   * The job's model, which decides how a suggested `duration` becomes frames
   * (`minimaxH3JobFramesForDuration`); the nearest-count rule when omitted.
   */
  modelId?: string;
}

export interface MinimaxH3KeyframesCheck {
  ok: boolean;
  errors: string[];
  /** The keyframes sorted by time; every entry is valid when `ok`. Empty for an empty list. */
  keyframes: MinimaxH3KeyframeTime[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Seconds for messages: two decimals at most, one at least (8 -> "8.0", 124/24 -> "5.17"). */
function formatClipSeconds(seconds: number): string {
  const rounded = Math.round(seconds * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}

/** Earliest and latest `atSeconds` to offer, to 0.1 s, each of which lands on a pinnable frame. */
function keyframeWindow(frames: number): { earliest: string; latest: string } {
  const latest = Math.floor(((frames - 2) / MINIMAX_H3_KEYFRAME_FPS) * 10 + 1e-9) / 10;
  return { earliest: '0.1', latest: latest.toFixed(1) };
}

/**
 * Shortest whole-second duration whose clip on `modelId` has `frameIndex`
 * strictly inside it, or null when even the longest H3 clip is too short. Whole
 * seconds, so an executor that rounds `duration` to an integer still renders at
 * least that many frames.
 */
function shortestDurationFor(frameIndex: number, modelId: string | undefined): number | null {
  const neededFrames = frameIndex + 2;
  if (neededFrames > MINIMAX_H3_LONGEST_CLIP_FRAMES) return null;
  let seconds = Math.max(1, Math.floor(neededFrames / MINIMAX_H3_KEYFRAME_FPS));
  while (minimaxH3JobFramesForDuration(modelId, seconds) < neededFrames) seconds += 1;
  return seconds;
}

/**
 * What a keyframe error says when an entry aims at the first or last frame,
 * which only the route's own frame inputs can set.
 */
export function minimaxH3KeyframeEdgeHint(modelId: string | null | undefined): string {
  switch (minimaxH3KeyframeWorkflow(modelId)) {
    case 'i2v':
    case 'flf2v':
    case 'flfa2v':
      return 'the first and last frames come from sourceImageIndex and endImageIndex';
    case 'ia2v':
      return 'the first frame comes from sourceImageIndex, and the last frame cannot be pinned';
    case 'a2v':
      return 'audio-only clips cannot pin their first or last frame';
    case 'r2v':
      return 'reference-to-video cannot pin its first or last frame';
    default:
      return 'the first and last frames are never keyframes';
  }
}

/**
 * Check a `keyframes` tool argument against a MiniMax H3 job: at most 8
 * entries, each `{ imageIndex, atSeconds }` with a whole-number index and a
 * finite time, every time landing strictly inside the clip (frames 1 to
 * `frames - 2`) and no two on the same frame. Returns the entries sorted by
 * time with their SDK `frameIndex`; nothing is clamped or dropped. Whether the
 * model takes keyframes at all is `supportsMinimaxH3Keyframes`; whether each
 * `imageIndex` resolves to an image is the executor's check.
 */
export function checkMinimaxH3Keyframes(
  keyframes: unknown,
  options: CheckMinimaxH3KeyframesOptions = {},
): MinimaxH3KeyframesCheck {
  const errors: string[] = [];
  if (keyframes === undefined || keyframes === null) {
    return { ok: true, errors, keyframes: [] };
  }
  if (!Array.isArray(keyframes)) {
    errors.push('"keyframes" must be a list of {imageIndex, atSeconds} items.');
    return { ok: false, errors, keyframes: [] };
  }
  if (keyframes.length > MINIMAX_H3_MAX_KEYFRAMES) {
    const extra = keyframes.length - MINIMAX_H3_MAX_KEYFRAMES;
    errors.push(
      `"keyframes" has ${keyframes.length} items; MiniMax H3 pins at most ${MINIMAX_H3_MAX_KEYFRAMES}. Remove ${extra} of them.`,
    );
  }

  const frames = options.frames;
  if (frames !== undefined && (!Number.isInteger(frames) || frames < 3)) {
    throw new RangeError(`MiniMax H3 keyframes need the job's frame count; received ${String(frames)}`);
  }
  const lastPinnable = (frames ?? MINIMAX_H3_LONGEST_CLIP_FRAMES) - 2;
  const window = keyframeWindow(lastPinnable + 2);
  const keep = `keep keyframes between ${window.earliest} s and ${window.latest} s`;
  const edge = options.edgeHint ? ` (${options.edgeHint})` : '';

  const checked: MinimaxH3KeyframeTime[] = [];
  keyframes.forEach((entry, argumentIndex) => {
    const label = `keyframes[${argumentIndex}]`;
    if (!isRecord(entry)) {
      errors.push(`${label} must be an object {imageIndex, atSeconds}.`);
      return;
    }
    const { imageIndex, atSeconds } = entry;
    let wellFormed = true;
    if (typeof imageIndex !== 'number' || !Number.isInteger(imageIndex)) {
      errors.push(
        `${label}.imageIndex must be a whole-number image index (-1 = first upload, -2 = second upload, 0 and up = generated results).`,
      );
      wellFormed = false;
    }
    if (typeof atSeconds !== 'number' || !Number.isFinite(atSeconds)) {
      errors.push(`${label}.atSeconds must be a number of seconds from the start of the video.`);
      wellFormed = false;
    }
    if (!wellFormed) return;

    const seconds = atSeconds as number;
    const frameIndex = minimaxH3KeyframeFrameIndex(seconds);
    if (seconds < 0) {
      errors.push(`${label} at ${seconds} s is before the video starts; ${keep}.`);
      return;
    }
    if (frameIndex < 1) {
      errors.push(`${label} at ${seconds} s lands on the first frame, which is never a keyframe${edge}; ${keep}.`);
      return;
    }
    if (frames !== undefined && frameIndex === frames - 1) {
      errors.push(
        `${label} at ${seconds} s lands on the last frame of the ${formatClipSeconds(frames / MINIMAX_H3_KEYFRAME_FPS)} s clip, which is never a keyframe${edge}; ${keep}.`,
      );
      return;
    }
    if (frameIndex > lastPinnable) {
      if (frames === undefined) {
        errors.push(
          `${label} at ${seconds} s is at or past the end of the longest MiniMax H3 clip (${formatClipSeconds(MINIMAX_H3_LONGEST_CLIP_FRAMES / MINIMAX_H3_KEYFRAME_FPS)} s); ${keep}.`,
        );
        return;
      }
      const source = options.framesSource ? ` (${options.framesSource})` : '';
      const longer = options.suggestDuration ? shortestDurationFor(frameIndex, options.modelId) : null;
      errors.push(
        `${label} at ${seconds} s is past the ${formatClipSeconds(frames / MINIMAX_H3_KEYFRAME_FPS)} s clip${source}; ${keep}${longer ? `, or set duration to at least ${longer} s` : ''}.`,
      );
      return;
    }
    checked.push({ imageIndex: imageIndex as number, atSeconds: seconds, argumentIndex, frameIndex });
  });

  const byFrame = new Map<number, MinimaxH3KeyframeTime>();
  for (const keyframe of checked) {
    const earlier = byFrame.get(keyframe.frameIndex);
    if (earlier) {
      errors.push(
        `keyframes[${earlier.argumentIndex}] and keyframes[${keyframe.argumentIndex}] both land on frame ${keyframe.frameIndex} (${formatClipSeconds(minimaxH3KeyframeSeconds(keyframe.frameIndex))} s); give each keyframe its own time, at least 0.1 s apart.`,
      );
      continue;
    }
    byFrame.set(keyframe.frameIndex, keyframe);
  }

  const sorted = [...checked].sort((left, right) => left.frameIndex - right.frameIndex);
  return errors.length === 0
    ? { ok: true, errors, keyframes: sorted }
    : { ok: false, errors, keyframes: [] };
}
