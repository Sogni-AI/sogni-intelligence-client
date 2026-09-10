/**
 * Tool-surface category locks.
 *
 * Modern agent harnesses (Anthropic Tool Search Tool, OpenAI deferred
 * tool loading, MCP `notifications/tools/list_changed`) treat the per-
 * turn tool surface as something to *narrow* before each LLM call, not
 * a fixed set of every registered tool. The chat product has ~30 tools
 * registered; shipping all of them on every turn means a ~170 KB
 * `tools` array on the wire, most of which is irrelevant to a given
 * request ("draw a lobster" never needs `extend_video` or
 * `dance_montage`).
 *
 * These policies express that narrowing as **category locks**: the
 * unlock signals come from `runtime`/`session_state` (uploaded or
 * generated media, active persona), and a lock fires when *none* of
 * the unlock signals are present. The existing `GATING_POLICIES`
 * (media routing, persona, video-modification) layer on top — locks
 * narrow the surface, then routing policies forbid specific tools
 * within the still-visible set when the planner has identified a
 * specific path.
 *
 * Locks use the exclusion-shaped trigger form (`allOf: []` with a
 * non-empty `noneOf`) so the policy fires by default and is suppressed
 * by any unlock signal.
 *
 * Tier 1 (always visible — not gated by anything here):
 *   - `ask_clarifying_question`, `finalize_response`
 *   - `generate_image`, `generate_video`, `generate_music`
 *   - `analyze_image`, `analyze_video`
 *   - `resolve_personas`, `manage_memory`
 *   - `extract_metadata`, `set_content_filter`
 *   - asset-manifest helpers (`create_asset_manifest`, `inspect_asset`,
 *     `label_asset`, `map_assets_for_model`, `validate_asset_references`)
 *
 * Tier 2 (image-context tools): unlock when an image is in scope,
 * either uploaded, generated this session, or implied by an active
 * persona that the model will need to edit a portrait of.
 *
 * Tier 3 (video-manipulation tools): unlock when a video is in scope.
 *
 * `sound_to_video` and `animate_photo` belong to Tier 2 (image- or
 * audio-driven). The signals that unlock them are a superset of the
 * pure-image set, expressed as a separate noneOf list.
 */

import type { ContractRegistry } from '../registry.js';
import type { ToolGatingPolicy } from '../toolGatingPolicy.js';

/**
 * Image-context tool category — requires a source image to operate on.
 * Includes image-to-video tools (animate_photo / dance_montage /
 * orbit_video) because their input is a still image, not an existing
 * video.
 */
export const IMAGE_CONTEXT_TOOL_NAMES: ReadonlyArray<string> = [
  'edit_image',
  'restore_photo',
  'upscale_image',
  'apply_style',
  'refine_result',
  'change_angle',
  'animate_photo',
  'dance_montage',
  'orbit_video',
];

/**
 * Video-manipulation tool category — requires an existing video to
 * operate on.
 *
 * `stitch_video` is intentionally *not* in this list. The chat
 * orchestrator queues `stitch_video` mid-round as the natural follow-up
 * to image-batch → `animate_photo` chains, before the next round's
 * `classifyTurn` recomputes signals — so locking it on the round-start
 * "no video in scope yet" snapshot causes false rejects for an
 * intra-round queue that the orchestrator has already decided is
 * correct. Its definition is small (~4 KB) and the path is common, so
 * keeping it Tier 1 (always visible) is the lower-risk default; the
 * dispatcher's normal argument validation still ensures the call is
 * sound when invoked.
 */
export const VIDEO_CONTEXT_TOOL_NAMES: ReadonlyArray<string> = [
  'video_to_video',
  'upscale_video',
  'extend_video',
  'replace_video_segment',
  'overlay_video',
  'add_subtitles',
];

/** Signals that indicate an image is in scope for this turn. */
const IMAGE_UNLOCK_SIGNALS: ReadonlyArray<string> = [
  'has_uploaded_image',
  'has_generated_image',
  'has_active_persona',
];

/** Signals that indicate a video is in scope for this turn. */
const VIDEO_UNLOCK_SIGNALS: ReadonlyArray<string> = [
  'has_uploaded_video',
  'has_generated_video',
];

export const TOOL_SURFACE_GATING_POLICIES: ReadonlyArray<ToolGatingPolicy> = [
  {
    policyId: 'LOCK_IMAGE_CONTEXT_TOOLS_WHEN_NO_IMAGE_SCOPE',
    version: '1.0.0',
    trigger: {
      allOf: [],
      noneOf: [...IMAGE_UNLOCK_SIGNALS],
    },
    effect: { forbid: [...IMAGE_CONTEXT_TOOL_NAMES] },
    rationale:
      'No image is in scope (no uploaded image, no generated image, no active persona). ' +
      'Hide image-edit / iteration / animation tools so the model picks generate_image ' +
      'instead of an edit variant it cannot supply a source for.',
  },
  {
    policyId: 'LOCK_VIDEO_CONTEXT_TOOLS_WHEN_NO_VIDEO_SCOPE',
    version: '1.0.0',
    trigger: {
      allOf: [],
      noneOf: [...VIDEO_UNLOCK_SIGNALS],
    },
    effect: { forbid: [...VIDEO_CONTEXT_TOOL_NAMES] },
    rationale:
      'No video is in scope. Hide video post-production / transformation tools — they ' +
      'cannot operate without an existing video.',
  },
  // NOTE: There is intentionally no `sound_to_video` lock here. The chat
  // orchestrator queues sound_to_video mid-round as the natural follow-up to
  // `generate_music` (round 1 emits generate_music + sound_to_video back-to-
  // back), so a round-start lock against "no audio in scope" rejects the
  // queued sound_to_video before the music has even completed. Same shape as
  // the `stitch_video` carve-out above. Keeping `sound_to_video` Tier 1 also
  // matches the tool's own description, which explicitly steers the model
  // toward an "after generate_music" usage pattern.
];

export function populateContractsToolSurfaceGatingPolicies(
  registry: ContractRegistry,
): void {
  for (const policy of TOOL_SURFACE_GATING_POLICIES) {
    registry.registerGatingPolicy(policy);
  }
}
