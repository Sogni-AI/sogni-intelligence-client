/**
 * Cost-approval helpers shared between the durable cloud executor
 * (`sogni-api`) and the chat-side popup (`sogni-chat`). Lifted out of
 * the API so the popup's allowlist matches the dispatch surface exactly
 * — if the popup lets the user adjust `qualityTier` but the API silently
 * drops the override, the user pays at the old tier without knowing.
 *
 * Anything in this file is part of the contract between
 * `runtimeConfig.requireJobConfirmation === true` and the chat popup.
 * Adding a new allowed override key here must be coordinated with the
 * popup that surfaces it.
 */

import { getToolCostMetadata } from '../contracts/index.js';

/**
 * True when this tool requires a cost-approval pause before dispatch.
 *
 * Derives from the canonical cost metadata so the gate stays in sync
 * with the cross-consumer contract (chat-side popup, replay viewer,
 * billing surface). We pause for anything that hits a worker, vendor
 * pipeline, or ffmpeg composer — i.e. anything with non-zero credit
 * spend.
 *
 * Excluded by design:
 *   - `costClass: 'free'` — analyze, inspect, asset-manifest, markers.
 *   - `costClass: 'compose.standard'` — pure LLM-token spend (enhance
 *     prompt, compose script, etc.); not Sogni-credit spend, and the
 *     chat popup does not gate them.
 *
 * Fail-closed for known creative tools: callers should pass a non-empty
 * `knownCreativeToolNames` set so that a missing metadata entry for a
 * known durable creative tool is treated as paid (catalog drift caught
 * loudly rather than silently dispatching unpaid).
 */
export function isCostApprovalGatedTool(
  toolName: string,
  options: { knownCreativeToolNames?: ReadonlySet<string> } = {},
): boolean {
  const metadata = getToolCostMetadata(toolName);
  if (!metadata) {
    if (options.knownCreativeToolNames?.has(toolName)) {
      return true;
    }
    return false;
  }
  if (metadata.costClass === 'free') return false;
  if (metadata.costClass === 'compose.standard') return false;
  return true;
}

/**
 * Allowlist of override keys the cost-approval popup is permitted to
 * adjust. The shared chat-run contract documents quality tier as the
 * canonical example. We deliberately exclude anything that can inflate
 * spend after a single approval (model, dimensions, variation count,
 * duration, steps) — those have to be picked by the LLM at request
 * time so the cost gate evaluates the correct cost class.
 *
 * `prompt` / `prompts` are allowed because a prompt edit is
 * cost-neutral: the cost class is a function of model, dimensions,
 * duration, and variation count, never of prompt content. So the user
 * may correct the prompt on the approval screen and have it applied to
 * the tool args before dispatch without re-evaluating the cost gate.
 *
 * Unknown / unsafe keys must be stripped by the API rather than
 * rejected with a 400 so a buggy client cannot wedge a run that
 * already paused; the user can still confirm or cancel.
 */
export const COST_APPROVAL_OVERRIDE_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  'qualityTier',
  'quality_tier',
  'safeContentFilter',
  'safe_content_filter',
  'prompt',
  'prompts',
]);

/**
 * Narrow a single override value to the expected enum / type. Returns
 * `undefined` for unsafe values so callers can drop the override
 * rather than persisting a freeform string.
 */
export function sanitizeCostApprovalOverride(key: string, value: unknown): unknown {
  if (key === 'qualityTier' || key === 'quality_tier') {
    return value === 'fast' || value === 'hq' || value === 'pro' ? value : undefined;
  }
  if (key === 'safeContentFilter' || key === 'safe_content_filter') {
    return typeof value === 'boolean' ? value : undefined;
  }
  if (key === 'prompt') {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  }
  if (key === 'prompts') {
    return Array.isArray(value)
      && value.length > 0
      && value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
      ? value
      : undefined;
  }
  return undefined;
}

/**
 * Apply user-provided override args from the confirmation popup onto a
 * raw LLM-emitted arguments JSON string. Only keys in
 * `COST_APPROVAL_OVERRIDE_ALLOWLIST` are merged, and each value is
 * narrowed via `sanitizeCostApprovalOverride`. Rejected keys are
 * returned for the caller to log.
 */
export function applyCostApprovalOverridesToToolArguments(
  argumentsJson: string,
  overrides: Record<string, unknown> | undefined,
): { result: string; rejected: string[] } {
  if (!overrides || Object.keys(overrides).length === 0) {
    return { result: argumentsJson, rejected: [] };
  }
  let parsed: Record<string, unknown>;
  try {
    const candidate: unknown = JSON.parse(argumentsJson || '{}');
    parsed = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      ? (candidate as Record<string, unknown>)
      : {};
  } catch {
    parsed = {};
  }
  const rejected: string[] = [];
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!COST_APPROVAL_OVERRIDE_ALLOWLIST.has(key)) {
      rejected.push(key);
      continue;
    }
    const narrowed = sanitizeCostApprovalOverride(key, value);
    if (narrowed === undefined) {
      rejected.push(key);
      continue;
    }
    sanitized[key] = narrowed;
  }
  if (Object.keys(sanitized).length === 0) {
    return { result: argumentsJson, rejected };
  }
  return { result: JSON.stringify({ ...parsed, ...sanitized }), rejected };
}
