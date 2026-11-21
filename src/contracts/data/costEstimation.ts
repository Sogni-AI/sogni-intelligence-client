/**
 * Coarse capacity-unit weights per tool cost class.
 *
 * These weights are deliberately approximate. They are NOT currency, NOT
 * per-job pricing, and NOT a substitute for the live worker-side billing
 * computation. They exist so the synchronous `compose_workflow` planner can
 * stamp a coarse total on the plan it returns ("≈ 22 units") and so the
 * `max_estimated_capacity_units` budget check has a number to compare
 * against without consulting sogni-socket pricing.
 *
 * Tune freely. Changing a weight here is a behavioural change for the
 * planner's `fits_budget` check, but it does not affect real billing.
 *
 * One unit very roughly corresponds to "one standard 1-credit image render".
 * Video is more expensive per output because it consumes render-seconds.
 *
 * Cost-class hierarchy (lowest to highest weight in each family):
 * - `free` (0): zero-cost utility tools.
 * - `compose.*` (1): planning / FFmpeg composition; near-free.
 * - `image.standard` (1) < `image.premium` (2) < `image.external` (3):
 *   standard internal < internal premium < third-party API.
 * - `audio.standard` (3): music generation tier, weighted per second.
 * - `audio.speech` (1): one text-to-speech take. Weighted per render rather
 *   than per second, and roughly the cost of one standard image.
 * - `video.standard` (5) < `video.vendor.standard` (6) < `video.premium` (8)
 *   < `video.vendor.premium` (10). Note the deliberate interleave:
 *   `video.vendor.standard` is a third-party API at the standard tier
 *   (slightly pricier than internal `video.standard`) but still cheaper
 *   than internal `video.premium`. Vendor-premium tops the table.
 */

import type { ToolCostClass } from './toolCostMetadata.js';

/**
 * Per-cost-class numeric weights used by capacity-units estimation.
 * Approximate. Values are unitless and only meaningful relative to each
 * other; treat one unit as "one standard image render".
 */
export const COST_CLASS_NUMERIC_WEIGHTS: Readonly<Record<ToolCostClass, number>> = {
  'free': 0,
  'image.standard': 1,
  'image.premium': 2,
  'image.external': 3,
  'video.standard': 5,
  'video.premium': 8,
  'video.vendor.standard': 6,
  'video.vendor.premium': 10,
  'audio.standard': 3,
  'audio.speech': 1,
  'compose.standard': 1,
  'compose.ffmpeg': 1,
};

/**
 * Fallback weight applied when a step references a tool with a cost class
 * we do not recognize. Conservative non-zero default so an unknown tool
 * never silently inflates `fits_budget=true`. Surfaced through the
 * estimator's `warnings[]` so the caller can log the gap.
 */
export const UNKNOWN_COST_CLASS_FALLBACK_WEIGHT = 1;

/** Return the numeric weight for a known cost class. */
export function getCostClassNumericWeight(costClass: ToolCostClass): number {
  return COST_CLASS_NUMERIC_WEIGHTS[costClass];
}
