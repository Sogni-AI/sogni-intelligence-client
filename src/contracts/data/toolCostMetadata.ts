/**
 * Per-tool cost + risk metadata.
 *
 * Promoted from chat-side `sideEffectLevel` registry entries (which
 * conflated cost and side-effect into one string) into a typed,
 * cross-consumer contract. Two orthogonal axes:
 *
 *   - costClass: coarse pricing tier the replay viewer / billing
 *     surface can render without consulting per-job sogni-socket
 *     pricing. Maps loosely to BackboneCostEstimate.costClass but is
 *     a fixed table, not a per-request estimate.
 *   - riskLevel: tells the agent loop and the future per-tool
 *     permission gate how much trust each tool needs. Three levels:
 *       'safe'        — read-only, no credits, no destructive state
 *       'paid'        — consumes credits / triggers a worker
 *       'destructive' — mutates persistent user state (delete, push)
 *
 * `userVisibleCost` is a one-line human label the future replay
 * viewer can show next to each tool call without re-deriving the
 * pricing rules.
 */

import type { ContractRegistry } from '../registry.js';

export type ToolCostClass =
  | 'free'
  | 'image.standard'
  | 'image.premium'
  | 'image.external'
  | 'video.standard'
  | 'video.premium'
  | 'video.vendor.standard'
  | 'video.vendor.premium'
  | 'audio.standard'
  | 'audio.speech'
  | 'compose.standard'
  | 'compose.ffmpeg';

export type ToolRiskLevel = 'safe' | 'paid' | 'destructive';

export interface ToolCostMetadata {
  /** Canonical tool name. Matches the OpenAI tool-call function.name. */
  tool: string;
  /** Coarse pricing tier. Stable across model swaps within a tool. */
  costClass: ToolCostClass;
  /** Permission trust level. Drives the future Permission contract. */
  riskLevel: ToolRiskLevel;
  /** One-line human label for the replay viewer / billing surface. */
  userVisibleCost: string;
  /** Short description of what the tool does (for hover / detail). */
  description: string;
}

/**
 * The 30+ tools currently exposed through the contracts dispatcher,
 * each tagged with its cost class + risk level. Tools that hit a
 * worker are 'paid'; analyze_* / inspect_* / asset-manifest tools
 * are 'safe'; manage_memory mutates persistent user state so it's
 * 'destructive'. Free-text-only semantic markers
 * (ask_clarifying_question, finalize_response) are 'safe'.
 */
export const TOOL_COST_METADATA: ReadonlyArray<ToolCostMetadata> = [
  // Image generation/editing
  {
    tool: 'generate_image',
    costClass: 'image.standard',
    riskLevel: 'paid',
    userVisibleCost: '1 credit per image',
    description: 'Text-to-image generation. Multiple variations supported.',
  },
  {
    tool: 'edit_image',
    costClass: 'image.standard',
    riskLevel: 'paid',
    userVisibleCost: '1 credit per output image',
    description: 'Instruction-based edit using uploaded or generated source images.',
  },
  {
    tool: 'restore_photo',
    costClass: 'image.standard',
    riskLevel: 'paid',
    userVisibleCost: '1 credit per restored image',
    description: 'AI photo restoration. Repairs scratches, color, exposure.',
  },
  {
    tool: 'upscale_image',
    costClass: 'image.standard',
    riskLevel: 'paid',
    userVisibleCost: 'Pixel-based image upscaling',
    description: 'Deterministic RTX VSR enlargement without generative changes.',
  },
  {
    tool: 'upscale_video',
    costClass: 'video.standard',
    riskLevel: 'paid',
    userVisibleCost: 'Priced by source video size and length',
    description: 'Promptless FlashVSR 1080p/1440p video upscale that keeps every frame and the audio.',
  },
  {
    tool: 'apply_style',
    costClass: 'image.standard',
    riskLevel: 'paid',
    userVisibleCost: '1 credit per styled image',
    description: 'Artistic style transfer onto an existing image.',
  },
  {
    tool: 'refine_result',
    costClass: 'image.standard',
    riskLevel: 'paid',
    userVisibleCost: '1 credit per refined image',
    description: 'Iterative refinement / upscale on a prior result.',
  },
  {
    tool: 'change_angle',
    costClass: 'image.standard',
    riskLevel: 'paid',
    userVisibleCost: '1 credit per novel view',
    description: 'Novel view synthesis from a single source image.',
  },

  // Video generation
  {
    tool: 'generate_video',
    costClass: 'video.vendor.standard',
    riskLevel: 'paid',
    userVisibleCost: 'Render-second pricing, varies by model',
    description: 'Text-to-video or reference-driven video generation.',
  },
  {
    tool: 'animate_photo',
    costClass: 'video.premium',
    riskLevel: 'paid',
    userVisibleCost: 'Render-second pricing on LTX or WAN',
    description: 'Photo-to-video animation with motion + audio.',
  },
  {
    tool: 'sound_to_video',
    costClass: 'video.premium',
    riskLevel: 'paid',
    userVisibleCost: 'Render-second pricing, audio-synced',
    description: 'Audio-driven video generation with lip sync.',
  },
  {
    tool: 'video_to_video',
    costClass: 'video.premium',
    riskLevel: 'paid',
    userVisibleCost: 'Render-second pricing with ControlNet',
    description: 'Video style transfer / restyling with ControlNet.',
  },

  // Music
  {
    tool: 'generate_music',
    costClass: 'audio.standard',
    riskLevel: 'paid',
    userVisibleCost: 'Per-second audio pricing',
    description: 'Music generation with lyrics, BPM, key, style control.',
  },

  // Speech
  {
    tool: 'generate_speech',
    // Its own class, not audio.standard: music is quoted per requested second,
    // speech is a flat quote per take because the script decides the length.
    costClass: 'audio.speech',
    riskLevel: 'paid',
    userVisibleCost: 'Flat per-take audio pricing',
    description: 'Text to speech with a studio voice, a cloned voice, or a designed one.',
  },

  // Synchronous composition helpers (LLM-side)
  {
    tool: 'enhance_prompt',
    costClass: 'compose.standard',
    riskLevel: 'paid',
    userVisibleCost: 'LLM token pricing',
    description: 'Enhance or adapt a rough prompt into model-ready generation text.',
  },
  {
    tool: 'compose_script',
    costClass: 'compose.standard',
    riskLevel: 'paid',
    userVisibleCost: 'LLM token pricing',
    description: 'Compose scripts, storyboards, campaign beats, or video prompts.',
  },
  {
    tool: 'compose_lyrics',
    costClass: 'compose.standard',
    riskLevel: 'paid',
    userVisibleCost: 'LLM token pricing',
    description: 'Compose vocal song lyrics and suggested musical parameters.',
  },
  {
    tool: 'compose_instrumental',
    costClass: 'compose.standard',
    riskLevel: 'paid',
    userVisibleCost: 'LLM token pricing',
    description: 'Compose instrumental structures and suggested musical parameters.',
  },
  {
    tool: 'compose_workflow',
    costClass: 'compose.standard',
    riskLevel: 'paid',
    userVisibleCost: 'LLM token pricing',
    description: 'Compose a runnable durable creative workflow plan from a brief.',
  },
  {
    tool: 'compose_workflow_template',
    costClass: 'compose.standard',
    riskLevel: 'paid',
    userVisibleCost: 'LLM token pricing',
    description: 'Compose a savable, parameterized workflow template plus a concrete example plan from a brief.',
  },

  // Vision/analysis (no worker dispatch; LLM-side only)
  {
    tool: 'analyze_image',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free (LLM vision only)',
    description: 'Vision analysis of an uploaded or generated image.',
  },
  {
    tool: 'analyze_video',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free (LLM vision only)',
    description: 'Vision/audio analysis of an uploaded or generated video.',
  },
  {
    tool: 'extract_metadata',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Extract metadata from prior generated results.',
  },

  // Composition (ffmpeg, no worker dispatch)
  {
    tool: 'stitch_video',
    costClass: 'compose.ffmpeg',
    riskLevel: 'paid',
    userVisibleCost: 'Small compose fee + render-seconds for transitions',
    description: 'Joins multiple video clips with optional crossfade.',
  },
  {
    tool: 'orbit_video',
    costClass: 'video.premium',
    riskLevel: 'paid',
    userVisibleCost: 'Multiple video renders + compose',
    description: 'Self-contained orbit-around-subject video pipeline.',
  },
  {
    tool: 'dance_montage',
    costClass: 'video.premium',
    riskLevel: 'paid',
    userVisibleCost: 'Multiple video renders + compose',
    description: 'Dance video montage from an uploaded photo.',
  },
  {
    tool: 'extend_video',
    costClass: 'video.vendor.standard',
    riskLevel: 'paid',
    userVisibleCost: 'Render-seconds for the appended segment',
    description: 'Add seconds to the end (or start) of an existing video.',
  },
  {
    tool: 'replace_video_segment',
    costClass: 'video.vendor.standard',
    riskLevel: 'paid',
    userVisibleCost: 'Render-seconds for the replaced window',
    description: 'Regenerate a specific time window of an existing video.',
  },
  {
    tool: 'overlay_video',
    costClass: 'compose.ffmpeg',
    riskLevel: 'paid',
    userVisibleCost: 'Small ffmpeg compose fee',
    description: 'Overlay logo / text / caption / watermark onto video frames.',
  },
  {
    tool: 'add_subtitles',
    costClass: 'compose.ffmpeg',
    riskLevel: 'paid',
    userVisibleCost: 'Small ffmpeg compose fee',
    description: 'Burn subtitles into a video.',
  },

  // Persona + memory (LLM-side state)
  {
    tool: 'resolve_personas',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Match user references to registered personas.',
  },
  {
    tool: 'manage_memory',
    costClass: 'free',
    riskLevel: 'destructive',
    userVisibleCost: 'Free',
    description: 'Persist or delete long-term user memory entries.',
  },

  // App settings
  {
    tool: 'set_content_filter',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Toggle the safe content filter on or off.',
  },

  // Session control markers
  {
    tool: 'ask_clarifying_question',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Ask the user for clarification; ends the turn.',
  },
  {
    tool: 'finalize_response',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Mark the turn complete with a short summary.',
  },

  // Asset manifest management
  {
    tool: 'create_asset_manifest',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Create the session-scoped three-layer asset manifest.',
  },
  {
    tool: 'inspect_asset',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Read one entry from the asset manifest.',
  },
  {
    tool: 'label_asset',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Add or rename a user_label on an asset.',
  },
  {
    tool: 'map_assets_for_model',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Translate asset_ids to per-model_ref tokens.',
  },
  {
    tool: 'validate_asset_references',
    costClass: 'free',
    riskLevel: 'safe',
    userVisibleCost: 'Free',
    description: 'Validate that a prompt only references known assets.',
  },
];

const METADATA_BY_TOOL = new Map<string, ToolCostMetadata>(
  TOOL_COST_METADATA.map((entry) => [entry.tool, entry]),
);

/** Lookup. Returns undefined for unknown tool names. */
export function getToolCostMetadata(toolName: string): ToolCostMetadata | undefined {
  return METADATA_BY_TOOL.get(toolName);
}

/** All paid tools (everything except 'free' costClass). */
export function listPaidTools(): ReadonlyArray<ToolCostMetadata> {
  return TOOL_COST_METADATA.filter((entry) => entry.costClass !== 'free');
}

/** All tools at a given risk level. */
export function listToolsByRiskLevel(
  level: ToolRiskLevel,
): ReadonlyArray<ToolCostMetadata> {
  return TOOL_COST_METADATA.filter((entry) => entry.riskLevel === level);
}

/**
 * Populate a ContractRegistry's `cost_metadata` collection. Idempotent.
 */
export function populateToolCostMetadata(registry: ContractRegistry): void {
  for (const metadata of TOOL_COST_METADATA) {
    registry.registerToolCostMetadata(metadata);
  }
}
