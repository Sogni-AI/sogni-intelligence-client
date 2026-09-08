/**
 * Phase 4 repair-recipe data shared across consumers.
 *
 * Promoted from sogni-chat (was `src/services/contractsRepairRecipes.ts`)
 * into the shared package. See helper functions below for each family's
 * mode/shape. The dispatcher in `evaluators.ts` consumes these via
 * `ContractRegistry.findRepairRecipe(toolName, errorCode)`.
 */

import type { ContractRegistry } from '../registry.js';
import type { RepairRecipe } from '../repairRecipe.js';
import { MEDIA_TOOL_NAMES } from './gatingPolicies.js';

/**
 * Tools that accept asset indices (uploads, generated results, etc.)
 * and can return ASSET_NOT_FOUND when the indices are out of range or
 * stale. Slightly broader than MEDIA_TOOL_NAMES because vision/audio
 * analysis also resolves asset indices.
 */
const ASSET_CONSUMING_TOOLS: ReadonlyArray<string> = [
  ...MEDIA_TOOL_NAMES,
  'analyze_image',
  'analyze_video',
  'extract_metadata',
];

/**
 * Tools that hit the safety filter on prompt content. SAFETY_REJECTED
 * is suggestFollowup with a soften message — the LLM may rewrite the
 * prompt and try again with the same tool. Bounded at one retry per
 * recipe so the loop cannot spin.
 */
const SAFETY_FILTERED_TOOLS: ReadonlyArray<string> = [
  'generate_image',
  'edit_image',
  'restore_photo',
  'apply_style',
  'refine_result',
  'animate_photo',
  'generate_video',
  'sound_to_video',
  'video_to_video',
  'generate_music',
  'generate_speech',
];

const SPECIFIC_RECIPES: ReadonlyArray<RepairRecipe> = [
  {
    recipeId: 'extend_video.duration_clamp',
    version: '1.0.0',
    toolName: 'extend_video',
    errorCode: 'PARAMETER_INVALID',
    mode: 'autoRepair',
    maxRetries: 1,
    repairNoteTemplate:
      'Seedance video segments cap at 15s; adjusted duration from {{requested}}s to {{clamped}}s.',
    autoRepairFields: ['duration'],
  },
  {
    recipeId: 'animate_photo.all_failed',
    version: '1.0.0',
    toolName: 'animate_photo',
    errorCode: 'GPU_WORKER_FAILED',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      'All animation attempts failed. Want to try a different photo or rewrite the motion prompt?',
  },
  {
    recipeId: 'replace_video_segment.window_invalid',
    version: '1.0.0',
    toolName: 'replace_video_segment',
    errorCode: 'PARAMETER_INVALID',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      'replace_video_segment needs a valid replacement window. {{message}} Please provide a shorter explicit start and end time, for example "replace 5s to 9s" or "redo the last 4 seconds."',
  },
];

function makeUserInputIncompleteRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.user_input_incomplete`,
    version: '1.0.0',
    toolName,
    errorCode: 'USER_INPUT_INCOMPLETE',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      'I need more details before I can run {{toolName}}. {{missingDetail}}',
  };
}

function makeCostLimitExceededRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.cost_limit_exceeded`,
    version: '1.0.0',
    toolName,
    errorCode: 'COST_LIMIT_EXCEEDED',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      'You have hit the credit limit for this turn. Top up credits or wait for the daily refill.',
  };
}

/**
 * ASSET_NOT_FOUND fires when a tool's `sourceImageIndex` /
 * `sourceVideoIndex` / `audioIndex` / similar resolves to nothing.
 * Always stopAndAsk — the model cannot guess which asset the user
 * meant.
 */
function makeAssetNotFoundRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.asset_not_found`,
    version: '1.0.0',
    toolName,
    errorCode: 'ASSET_NOT_FOUND',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      'I cannot find the asset that {{toolName}} needs. {{message}} Which uploaded or generated asset did you want?',
  };
}

/**
 * WORKFLOW_VALIDATION_FAILED fires when arguments are structurally
 * valid but conflict with workflow constraints (transition + uploaded
 * video, mismatched batch lengths, etc.). stopAndAsk with the
 * validator's message so the user can clarify instead of the LLM
 * re-firing with the same args.
 */
function makeWorkflowValidationFailedRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.workflow_validation_failed`,
    version: '1.0.0',
    toolName,
    errorCode: 'WORKFLOW_VALIDATION_FAILED',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate: '{{toolName}} could not run: {{message}}',
  };
}

/**
 * Generic PARAMETER_INVALID stopAndAsk for tools that do not have a
 * more specific auto-repair (extend_video has its own duration clamp).
 */
function makeParameterInvalidRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.parameter_invalid`,
    version: '1.0.0',
    toolName,
    errorCode: 'PARAMETER_INVALID',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate: '{{toolName}} rejected the arguments: {{message}}',
  };
}

/**
 * Generic GPU_WORKER_FAILED for media tools other than animate_photo
 * (which has a more specific all-failed recipe). stopAndAsk because
 * worker failures are rarely the LLM's fault and a fresh prompt is
 * the right escape hatch.
 */
function makeGpuWorkerFailedRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.gpu_worker_failed`,
    version: '1.0.0',
    toolName,
    errorCode: 'GPU_WORKER_FAILED',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      'The {{toolName}} worker failed. {{message}} Want me to try again or change the request?',
  };
}

/**
 * MODEL_UNAVAILABLE means the requested model is offline. Always
 * stopAndAsk so the user picks a replacement; do not let the LLM
 * silently route to a different model that may have different
 * capability semantics.
 */
function makeModelUnavailableRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.model_unavailable`,
    version: '1.0.0',
    toolName,
    errorCode: 'MODEL_UNAVAILABLE',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      'The model {{toolName}} wanted is offline. {{message}} Pick a different model or try again later.',
  };
}

/**
 * PERMISSION_REQUIRED means the user needs to sign in or approve a
 * scope before the tool can run. stopAndAsk — the model has no path
 * to the auth UI.
 */
function makePermissionRequiredRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.permission_required`,
    version: '1.0.0',
    toolName,
    errorCode: 'PERMISSION_REQUIRED',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      '{{toolName}} needs permission you have not granted yet. {{message}}',
  };
}

/**
 * SAFETY_REJECTED on any prompt-driven media tool: suggestFollowup
 * with a soften message. Same shape as the original generate_image
 * recipe; extended here to every tool whose prompt argument is the
 * actual safety surface.
 */
function makeSafetyRejectedRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.safety_rewrite`,
    version: '1.0.0',
    toolName,
    errorCode: 'SAFETY_REJECTED',
    mode: 'suggestFollowup',
    maxRetries: 1,
    repairNoteTemplate:
      'Content filter rejected the prompt for {{toolName}}. Try a softer phrasing or different scene.',
    suggestedFollowupTool: toolName,
  };
}

/**
 * PROVIDER_TIMEOUT means the worker took longer than the allowed
 * window. stopAndAsk so the user decides whether to retry or change
 * the request; do not silently re-fire and burn another worker round.
 */
function makeProviderTimeoutRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.provider_timeout`,
    version: '1.0.0',
    toolName,
    errorCode: 'PROVIDER_TIMEOUT',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      '{{toolName}} timed out. {{message}} Want me to retry, or simplify the request?',
  };
}

/**
 * USER_CANCELLED is a terminal user action, not a model-repair opportunity.
 * Every media tool stops immediately and waits for a fresh user request.
 */
function makeUserCancelledRecipe(toolName: string): RepairRecipe {
  return {
    recipeId: `${toolName}.user_cancelled`,
    version: '1.0.0',
    toolName,
    errorCode: 'USER_CANCELLED',
    mode: 'stopAndAsk',
    maxRetries: 0,
    repairNoteTemplate:
      'The {{toolName}} run was cancelled by the user. I will stop here unless you ask me to try again.',
  };
}

const PARAMETER_INVALID_TOOLS = MEDIA_TOOL_NAMES.filter(
  // already have more specific recipes
  (name) => name !== 'extend_video' && name !== 'replace_video_segment',
);

const GPU_WORKER_FAILED_TOOLS = MEDIA_TOOL_NAMES.filter(
  (name) => name !== 'animate_photo', // already has a more specific recipe
);

export const REPAIR_RECIPES: ReadonlyArray<RepairRecipe> = [
  ...SPECIFIC_RECIPES,
  ...MEDIA_TOOL_NAMES.map(makeUserInputIncompleteRecipe),
  ...MEDIA_TOOL_NAMES.map(makeCostLimitExceededRecipe),
  ...ASSET_CONSUMING_TOOLS.map(makeAssetNotFoundRecipe),
  ...MEDIA_TOOL_NAMES.map(makeWorkflowValidationFailedRecipe),
  ...PARAMETER_INVALID_TOOLS.map(makeParameterInvalidRecipe),
  ...GPU_WORKER_FAILED_TOOLS.map(makeGpuWorkerFailedRecipe),
  ...MEDIA_TOOL_NAMES.map(makeModelUnavailableRecipe),
  ...MEDIA_TOOL_NAMES.map(makePermissionRequiredRecipe),
  ...SAFETY_FILTERED_TOOLS.map(makeSafetyRejectedRecipe),
  ...MEDIA_TOOL_NAMES.map(makeProviderTimeoutRecipe),
  ...MEDIA_TOOL_NAMES.map(makeUserCancelledRecipe),
];

/**
 * Populate a ContractRegistry with the default repair recipes.
 * Idempotent — registering the same recipeId twice overwrites the
 * prior entry because ContractRegistry uses a Map keyed on
 * (toolName, errorCode).
 */
export function populateContractsRepairRecipes(registry: ContractRegistry): void {
  for (const recipe of REPAIR_RECIPES) {
    registry.registerRepairRecipe(recipe);
  }
}
