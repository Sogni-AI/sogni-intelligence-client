import type { SogniChatMessage } from '../runtime/chatTypes.js';
import type { WorkflowTemplate } from '../workflows/types.js';
import type { ComposeWorkflowDestinationModels } from './composeWorkflowTypes.js';
import { imagePromptTargetCanvasRatio } from './imagePrompt.js';
import type { ImagePromptingType, ImagePromptTargetCanvas } from './imagePrompt.js';
import { getRandomLyricsTheme, getRandomTheme } from './randomThemes.js';
import type { GenerateWanPromptParams, VideoFramePromptOptions } from './videoComposition.js';

export type HostedCompositionToolName =
  | 'enhance_prompt'
  | 'compose_lyrics'
  | 'compose_instrumental'
  | 'compose_script'
  | 'compose_workflow'
  | 'compose_workflow_template';

export interface HostedCompositionToolRequest {
  toolName: HostedCompositionToolName;
  arguments: Record<string, unknown>;
}

export const HOSTED_COMPOSITION_ROUTER_MAX_TOKENS = 512;

export interface BuildEnhancePromptToolArgsInput {
  prompt: string;
  /** Exact registered model selector whose native prompt contract must be used. */
  destinationModel: string;
  destinationTool?: string;
  targetOutput?: string;
  stylePrompt?: string;
  /** The output image's shape, sent as `aspect_ratio` in lowest terms. */
  targetCanvas?: ImagePromptTargetCanvas;
  /** @deprecated Compatibility metadata only; destinationModel selects the contract. */
  promptingType?: ImagePromptingType;
  /** @deprecated Compatibility label only; destinationModel selects the contract. */
  modelTitle?: string;
  randomTheme?: string;
}

export interface BuildLyricsCompositionToolArgsInput {
  prompt: string;
  language?: string;
  musicPrompt?: string;
  randomTheme?: string;
  /** Target music model id (e.g. 'minimax_music3'); server routes to the matching prompt format. */
  destinationModel?: string;
  /** Requested song length in seconds so the composer sizes the lyric sheet. */
  durationSeconds?: number;
}

export interface BuildInstrumentalCompositionToolArgsInput {
  prompt: string;
  musicPrompt?: string;
  randomTheme?: string;
  /** Target music model id (e.g. 'minimax_music3'); server routes to the matching prompt format. */
  destinationModel?: string;
  /** Requested track length in seconds so the composer sizes the structure. */
  durationSeconds?: number;
}

export interface BuildScriptCompositionToolArgsInput extends VideoFramePromptOptions {
  brief?: string;
  prompt?: string;
  scriptType?: string;
  destinationTool?: string;
  destinationModel?: string;
  durationSeconds?: number;
  firstFrameDescription?: string;
}

export interface BuildComposeWorkflowToolArgsInput {
  brief: string;
  sceneCount?: number;
  durationSeconds?: number;
  aspectRatio?: string;
  style?: string;
  destinationModels?: ComposeWorkflowDestinationModels;
  maxEstimatedCapacityUnits?: number;
  includeAudio?: boolean;
  returnFormat?: 'json';
}

export type ComposeWorkflowTemplateInputDeclArg = {
  name: string;
  type: 'image' | 'audio' | 'video' | 'text' | 'number' | 'select' | 'boolean';
  required?: boolean;
  description?: string;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  multiple?: { min: number; max: number };
  internal?: boolean;
};

export interface BuildComposeWorkflowTemplateToolArgsInput
  extends BuildComposeWorkflowToolArgsInput {
  name: string;
  description?: string;
  category?:
    | 'portrait'
    | 'video-social'
    | 'makeover'
    | 'cinematic'
    | 'music'
    | 'analysis'
    | 'custom'
    | 'other';
  visibility?: 'private' | 'public';
  inputs?: ComposeWorkflowTemplateInputDeclArg[];
  /**
   * Optional existing template the planner should edit. When supplied,
   * the helper serializes it under the schema field
   * `existing_template`; the api-side dispatcher passes it to
   * `buildComposeWorkflowTemplatePlannerMessages()` which adds the
   * edit-rules section to the system prompt.
   */
  existingTemplate?: WorkflowTemplate;
}

export function buildEnhancePromptToolArgs(
  input: BuildEnhancePromptToolArgsInput,
): Record<string, unknown> {
  return {
    prompt: input.prompt.trim() || `Come up with a unique, creative image inspired by: ${input.randomTheme || getRandomTheme()}. Be original and surprising.`,
    target_output: input.targetOutput ?? 'image_prompt',
    destination_tool: input.destinationTool ?? 'generate_image',
    destination_model: input.destinationModel,
    ...(input.promptingType ? { prompting_type: input.promptingType } : {}),
    ...(input.modelTitle ? { model_title: input.modelTitle } : {}),
    ...(input.stylePrompt?.trim() ? { style_prompt: input.stylePrompt.trim() } : {}),
    ...(input.targetCanvas ? { aspect_ratio: imagePromptTargetCanvasRatio(input.targetCanvas) } : {}),
  };
}

export function buildLyricsCompositionToolArgs(
  input: BuildLyricsCompositionToolArgsInput,
): Record<string, unknown> {
  return {
    prompt: input.prompt.trim() || `Come up with a unique, original song about: ${input.randomTheme || getRandomLyricsTheme()}. Be creative and surprising.`,
    language: input.language ?? 'unknown',
    ...(input.musicPrompt?.trim() ? { music_prompt: input.musicPrompt.trim() } : {}),
    ...(input.destinationModel ? { destination_model: input.destinationModel } : {}),
    ...(input.durationSeconds ? { duration_seconds: input.durationSeconds } : {}),
  };
}

export function buildInstrumentalCompositionToolArgs(
  input: BuildInstrumentalCompositionToolArgsInput,
): Record<string, unknown> {
  return {
    prompt: input.prompt.trim() || `Come up with a unique, original instrumental piece inspired by: ${input.randomTheme || getRandomLyricsTheme()}. Be creative and surprising.`,
    ...(input.musicPrompt?.trim() ? { music_prompt: input.musicPrompt.trim() } : {}),
    ...(input.destinationModel ? { destination_model: input.destinationModel } : {}),
    ...(input.durationSeconds ? { duration_seconds: input.durationSeconds } : {}),
  };
}

export function buildScriptCompositionToolArgs(
  input: BuildScriptCompositionToolArgsInput,
): Record<string, unknown> {
  const brief = input.brief ?? input.prompt ?? '';
  return {
    brief: brief.trim() || input.firstFrameDescription?.trim() || `Come up with a unique, original video scene inspired by: ${input.randomTheme || getRandomTheme()}. Be creative and surprising.`,
    script_type: input.scriptType ?? 'video_prompt',
    destination_tool: input.destinationTool ?? 'generate_video',
    ...(input.destinationModel ? { destination_model: input.destinationModel } : {}),
    ...(input.durationSeconds ? { duration_seconds: input.durationSeconds } : {}),
    ...(input.firstFrameDescription?.trim()
      ? { first_frame_description: input.firstFrameDescription.trim() }
      : {}),
    ...(input.firstFrameDataUrl ? { first_frame_data_url: input.firstFrameDataUrl } : {}),
    ...(input.lastFrameDataUrl ? { last_frame_data_url: input.lastFrameDataUrl } : {}),
  };
}

/**
 * Build the schema-shaped (snake_case) arguments for compose_workflow.
 *
 * The brief is required by the schema; this helper does NOT inject a fallback
 * theme — empty briefs are passed through trimmed so the upstream schema
 * validator surfaces the error. That mirrors the spec for the new tool, which
 * is invoked by the agent only when the caller already knows what they want.
 */
export function buildComposeWorkflowToolArgs(
  input: BuildComposeWorkflowToolArgsInput,
): Record<string, unknown> {
  const destinationModels = input.destinationModels ? {
    ...(input.destinationModels.image ? { image: input.destinationModels.image } : {}),
    ...(input.destinationModels.video ? { video: input.destinationModels.video } : {}),
    ...(input.destinationModels.music ? { music: input.destinationModels.music } : {}),
  } : undefined;

  return {
    brief: input.brief.trim(),
    ...(typeof input.sceneCount === 'number' && Number.isFinite(input.sceneCount)
      ? { scene_count: input.sceneCount }
      : {}),
    ...(typeof input.durationSeconds === 'number' && Number.isFinite(input.durationSeconds)
      ? { duration_seconds: input.durationSeconds }
      : {}),
    ...(input.aspectRatio?.trim() ? { aspect_ratio: input.aspectRatio.trim() } : {}),
    ...(input.style?.trim() ? { style: input.style.trim() } : {}),
    ...(destinationModels && Object.keys(destinationModels).length > 0
      ? { destination_models: destinationModels }
      : {}),
    ...(typeof input.maxEstimatedCapacityUnits === 'number'
      && Number.isFinite(input.maxEstimatedCapacityUnits)
      ? { max_estimated_capacity_units: input.maxEstimatedCapacityUnits }
      : {}),
    ...(typeof input.includeAudio === 'boolean' ? { include_audio: input.includeAudio } : {}),
    ...(input.returnFormat ? { return_format: input.returnFormat } : {}),
  };
}

/**
 * Build the schema-shaped (snake_case) arguments for compose_workflow_template.
 *
 * Mirrors `buildComposeWorkflowToolArgs` but adds the template-only fields:
 * `name` (required), `description`, `category`, `visibility`, and the optional
 * `inputs[]` declaration block. Empty / blank values are dropped so the
 * payload stays compact and the upstream schema validator surfaces missing
 * required fields rather than passing empty strings through.
 */
export function buildComposeWorkflowTemplateToolArgs(
  input: BuildComposeWorkflowTemplateToolArgsInput,
): Record<string, unknown> {
  const base = buildComposeWorkflowToolArgs(input);
  const out: Record<string, unknown> = { ...base, name: input.name.trim() };
  const description = input.description?.trim();
  if (description) out.description = description;
  if (input.category) out.category = input.category;
  if (input.visibility) out.visibility = input.visibility;
  if (input.inputs && input.inputs.length > 0) {
    out.inputs = input.inputs.map((decl) => {
      const entry: Record<string, unknown> = { name: decl.name, type: decl.type };
      if (decl.required !== undefined) entry.required = decl.required;
      if (decl.description?.trim()) entry.description = decl.description.trim();
      if (decl.default !== undefined) entry.default = decl.default;
      if (decl.options && decl.options.length > 0) entry.options = decl.options;
      if (decl.multiple) entry.multiple = decl.multiple;
      if (decl.internal !== undefined) entry.internal = decl.internal;
      return entry;
    });
  }
  if (input.existingTemplate) {
    out.existing_template = input.existingTemplate;
  }
  return out;
}

export function buildWanScriptCompositionToolArgs(
  params: GenerateWanPromptParams,
): Record<string, unknown> {
  return buildScriptCompositionToolArgs({
    brief: params.prompt,
    destinationModel: 'wan22',
    durationSeconds: params.duration,
    firstFrameDescription: params.firstFrameDescription,
    firstFrameDataUrl: params.firstFrameDataUrl,
    lastFrameDataUrl: params.lastFrameDataUrl,
    randomTheme: params.randomTheme,
  });
}

export function buildHostedCompositionToolMessages(
  request: HostedCompositionToolRequest,
): SogniChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a strict dispatcher for Sogni synchronous creative tools. Call the requested tool exactly once with the exact JSON arguments supplied by the user. Do not rewrite, summarize, or add creative content in this dispatch step.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        tool: request.toolName,
        arguments: request.arguments,
      }),
    },
  ];
}
