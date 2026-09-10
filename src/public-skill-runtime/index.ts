export type SkillVideoWorkflow =
  | 't2v'
  | 'i2v'
  | 's2v'
  | 'ia2v'
  | 'a2v'
  | 'animate-move'
  | 'animate-replace'
  | 'v2v';

import {
  GATING_POLICIES,
  REPAIR_RECIPES,
  PROMPT_CONTRACTS,
} from '../contracts/data/index.js';
import { normalizeSignalSource } from '../contracts/turnPolicy.js';
import {
  isSeedanceVideoModelId,
  SEEDANCE_VIDEO_MODEL_IDS,
} from '../utils/seedanceModelIds.js';
import { resolveRegisteredVideoModelFamily } from '../utils/videoModelIds.js';
import { resolveRegisteredImageReferenceModelId } from '../utils/imageReferenceModelIds.js';

type LtxWorkflow = 't2v' | 'i2v' | 'ia2v' | 'a2v' | 'v2v';
type Ltx25Workflow = LtxWorkflow;

export interface SkillVideoModelConfig {
  workflow: SkillVideoWorkflow;
  family: 'ltx25' | 'ltx23' | 'ltx2' | 'wan22' | 'wan3' | 'seedance2';
  defaultWidth: number;
  defaultHeight: number;
  minDimension: number;
  maxDimension: number;
  dimensionMultiple: number;
  steps?: number;
  guidance?: number;
  fps?: number;
  internalFps?: number;
  frameStep?: number;
  minFrames?: number;
  maxFrames?: number;
  sampler?: string;
  scheduler?: string;
  shift?: number;
  supportsNativeAudio?: boolean;
  minVramGB?: number;
  requiresDisabledSafetyFilter?: boolean;
}

export interface SkillModelDefaults {
  workflow?: SkillVideoWorkflow;
  family?: 'ltx25' | 'ltx23' | 'ltx2' | 'wan22' | 'wan3' | 'seedance2' | 'krea2-identity-edit';
  defaultWidth?: number;
  defaultHeight?: number;
  minDimension?: number;
  maxDimension?: number;
  dimensionMultiple?: number;
  steps?: number;
  guidance?: number;
  fps?: number;
  internalFps?: number;
  frameStep?: number;
  minFrames?: number;
  maxFrames?: number;
  sampler?: string;
  scheduler?: string;
  shift?: number;
  supportsNativeAudio?: boolean;
  minVramGB?: number;
  requiresDisabledSafetyFilter?: boolean;
}

interface SkillQualityTier {
  model: string;
  steps: number | null;
  shortSide: number | null;
  video: {
    steps: number | null;
    shortSide: number | null;
  };
}

export interface SkillRuntimeConfig {
  modelDefaults?: Record<string, SkillModelDefaults>;
  videoModels?: Partial<Record<SkillVideoWorkflow, string>>;
}

interface VideoPromptGuardrailInput {
  prompt?: string | null;
  duration?: number;
  frames?: number | null;
  fps?: number;
  durationExplicit?: boolean;
  referenceAudioIdentity?: unknown;
  voiceName?: string | null;
}

export interface VideoPromptGuardrailWarning {
  type:
    | 'normalized-dialogue-quotes'
    | 'missing-quoted-dialogue'
    | 'duration-extended-for-dialogue'
    | 'dialogue-over-budget';
  message: string;
}

export interface VideoPromptGuardrailPlan {
  prompt: string;
  duration: number;
  warnings: VideoPromptGuardrailWarning[];
}

interface InferVideoWorkflowAssetsInput {
  refVideo?: unknown;
  videoControlNetName?: unknown;
  refAudio?: unknown;
  refImage?: unknown;
  refImageEnd?: unknown;
  prompt?: string | null;
}

export interface SkillCliSetState {
  model?: boolean;
  workflow?: boolean;
  width?: boolean;
  height?: boolean;
  targetResolution?: boolean;
  duration?: boolean;
  frames?: boolean;
}

export interface SkillCliVideoBrainInput {
  video?: boolean;
  prompt?: string | null;
  model?: string | null;
  workflow?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  frames?: number | null;
  targetResolution?: number | null;
  refImage?: unknown;
  refImageEnd?: unknown;
  refAudio?: unknown;
  refVideo?: unknown;
  cliSet?: SkillCliSetState;
}

export interface ExplicitPixelDimensions {
  width: number;
  height: number;
}

export interface ExplicitAspectRatio {
  width: number;
  height: number;
  text: string;
}

export interface SeedanceStoryboardFallbackInput {
  userIntentText: string;
  uploadedImageCount: number;
  uploadedVideoCount?: number;
  uploadedAudioCount?: number;
  storyboardDetected?: boolean;
  storyboardDurationSeconds?: number | null;
  storyboardAspectRatio?: string | null;
  providesLiteralPrompt?: boolean;
  requestedDurationSeconds?: number | null;
  defaultDurationSeconds?: number;
  maxDurationSeconds?: number;
  minDurationSeconds?: number;
  referenceImageIndices?: number[];
}

export interface SeedanceStoryboardFallbackPlan {
  prompt: string;
  duration: number;
  referenceImageIndices: number[];
  skipPromptProcessing: true;
  expandPrompt: false;
  reason: 'text_mentions_storyboard' | 'vision_detected_storyboard';
  aspectRatio?: string;
}

export interface SeedanceStoryboardReferenceModelDefaultInput {
  userIntentText: string;
  promptText?: string | null;
  hasImageReference?: boolean;
  storyboardDetected?: boolean;
}

export interface SkillCliVideoBrainPlan {
  prompt?: string;
  model?: string;
  workflow?: SkillVideoWorkflow;
  width?: number;
  height?: number;
  dimensionSource?: 'exact' | 'aspect';
  aspectRatio?: string;
  targetResolution?: number;
  duration?: number;
  literalPrompt?: boolean;
  storyboard?: SeedanceStoryboardFallbackPlan;
  warnings: string[];
}

function isLtxWorkflow(workflow: string | null | undefined): workflow is LtxWorkflow {
  return workflow === 't2v' || workflow === 'i2v' || workflow === 'ia2v' || workflow === 'a2v' || workflow === 'v2v';
}

export const SKILL_RUNTIME_VERSION = '2026-07-18.1';

export type PublicSkillSignalSource =
  | 'planner'
  | 'runtime'
  | 'session_state'
  | 'classifier'
  | 'fact_extractor'
  | 'regex'
  | 'user'
  | 'system';

export interface PublicSkillSignal {
  kind: string;
  source: PublicSkillSignalSource | string;
  confidence?: number;
  data?: Record<string, unknown>;
}

export interface PublicSkillToolGatingPolicy {
  policyId: string;
  trigger: {
    allOf: string[];
    noneOf?: string[];
    sources?: Record<string, string | string[]>;
  };
  effect: {
    forbid: string[];
    require?: string[];
  };
  rationale?: string;
}

export interface PublicSkillPromptContract {
  toolName: string;
  fragment: string;
}

export interface PublicSkillRepairRecipe {
  toolName: string;
  errorCode: string;
  mode: 'passthrough' | 'execute_with_repair' | 'repair' | 'reject' | 'ask_user';
  message?: string;
  suggestedArgs?: Record<string, unknown>;
}

export interface PublicSkillTurnPolicy {
  visibleTools: string[];
  forbiddenTools: string[];
  requiredTools: string[];
  appliedPolicies: string[];
  signals: PublicSkillSignal[];
  rationale: string;
}

export interface PublicSkillContractRuntime {
  policies: PublicSkillToolGatingPolicy[];
  promptContracts: PublicSkillPromptContract[];
  repairRecipes: PublicSkillRepairRecipe[];
}

export interface PublicSkillContractToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface PublicSkillCompiledToolSurface {
  tools: PublicSkillContractToolDefinition[];
  contextBlock: string;
  turnPolicy: PublicSkillTurnPolicy;
}

export interface PublicSkillDispatchResult {
  allowed: boolean;
  mode: PublicSkillRepairRecipe['mode'] | 'passthrough' | 'reject';
  reason?: string;
  repairRecipe?: PublicSkillRepairRecipe;
  suggestedArgs?: Record<string, unknown>;
}

function publicSkillPromptContractFragment(contract: {
  baseDescription?: string;
  parameterDocs?: Record<string, string>;
  voiceExamples?: string[];
  conditionalNotes?: Record<string, string>;
}): string {
  const parameterDocs = Object.entries(contract.parameterDocs ?? {})
    .map(([name, description]) => `${name}: ${description}`);
  const sections = [
    contract.baseDescription ?? '',
    parameterDocs.length ? `Parameter notes:\n${parameterDocs.join('\n')}` : '',
    contract.voiceExamples?.length ? `Examples:\n${contract.voiceExamples.join('\n')}` : '',
    Object.values(contract.conditionalNotes ?? {}).join('\n'),
  ].filter(Boolean);
  return sections.join('\n\n');
}

function publicSkillRepairMode(mode: string): PublicSkillRepairRecipe['mode'] {
  if (mode === 'autoRepair') return 'execute_with_repair';
  if (mode === 'stopAndAsk') return 'ask_user';
  if (mode === 'suggestFollowup') return 'repair';
  return 'passthrough';
}

export const PUBLIC_SKILL_DEFAULT_POLICIES: PublicSkillToolGatingPolicy[] =
  GATING_POLICIES.map((policy) => ({
    policyId: policy.policyId,
    trigger: {
      allOf: [...policy.trigger.allOf],
      ...(policy.trigger.noneOf ? { noneOf: [...policy.trigger.noneOf] } : {}),
      ...(policy.trigger.sources
        ? { sources: Object.fromEntries(
          Object.entries(policy.trigger.sources).map(([kind, source]) => [
            kind,
            Array.isArray(source) ? [...source] : source,
          ]),
        ) }
        : {}),
    },
    effect: {
      forbid: [...policy.effect.forbid],
      ...(policy.effect.require ? { require: [...policy.effect.require] } : {}),
    },
    rationale: policy.rationale,
  }));

export const PUBLIC_SKILL_DEFAULT_PROMPT_CONTRACTS: PublicSkillPromptContract[] =
  PROMPT_CONTRACTS.map((contract) => ({
    toolName: contract.toolName,
    fragment: publicSkillPromptContractFragment(contract),
  }));

export const PUBLIC_SKILL_DEFAULT_REPAIR_RECIPES: PublicSkillRepairRecipe[] =
  REPAIR_RECIPES.map((recipe) => ({
    toolName: recipe.toolName,
    errorCode: recipe.errorCode,
    mode: publicSkillRepairMode(recipe.mode),
    message: recipe.repairNoteTemplate,
    ...(recipe.suggestedFollowupTool ? { suggestedArgs: { toolName: recipe.suggestedFollowupTool } } : {}),
  }));

export const PUBLIC_SKILL_DEFAULT_TOOL_NAMES: string[] = [
  ...new Set(PROMPT_CONTRACTS.map((contract) => contract.toolName)),
];

export const PUBLIC_SKILL_DEFAULT_TOOL_DEFINITIONS: PublicSkillContractToolDefinition[] =
  PUBLIC_SKILL_DEFAULT_TOOL_NAMES.map((name) => ({
    type: 'function',
    function: {
      name,
      description: name.replace(/_/g, ' '),
    },
  }));

export function createPublicSkillContractRuntime(input: Partial<PublicSkillContractRuntime> = {}): PublicSkillContractRuntime {
  return {
    policies: [...(input.policies ?? [])],
    promptContracts: [...(input.promptContracts ?? [])],
    repairRecipes: [...(input.repairRecipes ?? [])],
  };
}

export function createPublicSkillDefaultContractRuntime(input: Partial<PublicSkillContractRuntime> = {}): PublicSkillContractRuntime {
  return createPublicSkillContractRuntime({
    policies: [
      ...PUBLIC_SKILL_DEFAULT_POLICIES,
      ...(input.policies ?? []),
    ],
    promptContracts: [
      ...PUBLIC_SKILL_DEFAULT_PROMPT_CONTRACTS,
      ...(input.promptContracts ?? []),
    ],
    repairRecipes: [
      ...PUBLIC_SKILL_DEFAULT_REPAIR_RECIPES,
      ...(input.repairRecipes ?? []),
    ],
  });
}

const PUBLIC_SKILL_ADVISORY_SIGNAL_SOURCES = new Set<string>(['regex', 'fact_extractor']);

function normalizePublicSkillSignal(signal: PublicSkillSignal): PublicSkillSignal {
  const source = normalizeSignalSource(String(signal.source));
  if (source === signal.source) return signal;
  return { ...signal, source };
}

function publicSkillSignalSourcesByKind(signals: readonly PublicSkillSignal[]): Map<string, Set<string>> {
  const sourcesByKind = new Map<string, Set<string>>();
  for (const signal of signals) {
    if (PUBLIC_SKILL_ADVISORY_SIGNAL_SOURCES.has(signal.source)) continue;
    const sources = sourcesByKind.get(signal.kind) ?? new Set<string>();
    sources.add(signal.source);
    sourcesByKind.set(signal.kind, sources);
  }
  return sourcesByKind;
}

function publicSkillSignalMatchesSourceConstraint(
  sourcesByKind: Map<string, Set<string>>,
  kind: string,
  allowed?: string | string[],
): boolean {
  const sources = sourcesByKind.get(kind);
  if (!sources) return false;
  if (!allowed) return true;
  const allowedSources = Array.isArray(allowed) ? allowed : [allowed];
  return allowedSources.some((source) => sources.has(source));
}

function publicSkillSessionSignals(sessionState: Record<string, unknown> | undefined): PublicSkillSignal[] {
  if (!sessionState) return [];
  const signalNames: Array<[string, string]> = [
    ['hasUploadedImage', 'has_uploaded_image'],
    ['hasUploadedVideo', 'has_uploaded_video'],
    ['hasUploadedAudio', 'has_uploaded_audio'],
    ['hasGeneratedImage', 'has_generated_image'],
    ['hasGeneratedVideo', 'has_generated_video'],
    ['hasGeneratedAudio', 'has_generated_audio'],
    ['hasActivePersona', 'has_active_persona'],
    ['awaitingImageSelection', 'awaiting_image_selection'],
    ['pendingStitchAfterBatch', 'pending_stitch_after_batch'],
    ['completedWorkflow', 'completed_workflow'],
  ];
  return signalNames
    .filter(([key]) => sessionState[key] === true)
    .map(([, kind]) => ({ kind, source: 'session_state' }));
}

export function classifyPublicSkillTurn(input: {
  availableTools: readonly string[];
  signals?: readonly PublicSkillSignal[];
  sessionState?: Record<string, unknown>;
  policies?: readonly PublicSkillToolGatingPolicy[];
  runtime?: PublicSkillContractRuntime;
}): PublicSkillTurnPolicy {
  const signals = [
    ...(input.signals ?? []),
    ...publicSkillSessionSignals(input.sessionState),
  ].map(normalizePublicSkillSignal);
  const sourcesByKind = publicSkillSignalSourcesByKind(signals);
  const forbidden = new Set<string>();
  const required = new Set<string>();
  const appliedPolicies: string[] = [];
  const rationales: string[] = [];
  const policies = input.policies ?? input.runtime?.policies ?? [];

  for (const policy of policies) {
    const allOfMatch = policy.trigger.allOf.every((kind) =>
      publicSkillSignalMatchesSourceConstraint(sourcesByKind, kind, policy.trigger.sources?.[kind]),
    );
    const noneOfMatch = !policy.trigger.noneOf
      || policy.trigger.noneOf.every((kind) => !sourcesByKind.has(kind));
    if (!allOfMatch || !noneOfMatch) continue;
    appliedPolicies.push(policy.policyId);
    if (policy.rationale) rationales.push(policy.rationale);
    for (const tool of policy.effect.forbid) forbidden.add(tool);
    for (const tool of policy.effect.require ?? []) required.add(tool);
  }

  return {
    visibleTools: input.availableTools.filter((tool) => !forbidden.has(tool)),
    forbiddenTools: [...forbidden],
    requiredTools: [...required],
    appliedPolicies,
    signals,
    rationale: rationales.join(' '),
  };
}

export function compilePublicSkillToolSurface(input: {
  tools: readonly PublicSkillContractToolDefinition[];
  turnPolicy?: PublicSkillTurnPolicy;
  signals?: readonly PublicSkillSignal[];
  sessionState?: Record<string, unknown>;
  policies?: readonly PublicSkillToolGatingPolicy[];
  promptContracts?: readonly PublicSkillPromptContract[];
  runtime?: PublicSkillContractRuntime;
}): PublicSkillCompiledToolSurface {
  const availableTools = input.tools.map((tool) => tool.function.name);
  const turnPolicy = input.turnPolicy ?? classifyPublicSkillTurn({
    availableTools,
    signals: input.signals,
    sessionState: input.sessionState,
    policies: input.policies,
    runtime: input.runtime,
  });
  const promptContracts = input.promptContracts ?? input.runtime?.promptContracts ?? [];
  const contractsByTool = new Map<string, string[]>();
  for (const contract of promptContracts) {
    const fragments = contractsByTool.get(contract.toolName) ?? [];
    fragments.push(contract.fragment.trim());
    contractsByTool.set(contract.toolName, fragments);
  }
  const visible = new Set(turnPolicy.visibleTools);
  const tools = input.tools
    .filter((tool) => visible.has(tool.function.name))
    .map((tool) => {
      const fragments = contractsByTool.get(tool.function.name)?.filter(Boolean) ?? [];
      if (fragments.length === 0) return tool;
      return {
        ...tool,
        function: {
          ...tool.function,
          description: [tool.function.description, ...fragments].filter(Boolean).join('\n\n'),
        },
      };
    });
  const contextLines = [
    turnPolicy.forbiddenTools.length ? `Forbidden tools: ${turnPolicy.forbiddenTools.join(', ')}` : '',
    turnPolicy.requiredTools.length ? `Required tools: ${turnPolicy.requiredTools.join(', ')}` : '',
    turnPolicy.rationale,
  ].filter(Boolean);

  return {
    tools,
    contextBlock: contextLines.join('\n'),
    turnPolicy,
  };
}

export function dispatchPublicSkillToolCall(input: {
  toolName: string;
  errorCode?: string;
  turnPolicy?: PublicSkillTurnPolicy;
  repairRecipes?: readonly PublicSkillRepairRecipe[];
  runtime?: PublicSkillContractRuntime;
}): PublicSkillDispatchResult {
  if (input.turnPolicy?.forbiddenTools.includes(input.toolName)) {
    return {
      allowed: false,
      mode: 'reject',
      reason: `Tool ${input.toolName} is forbidden by the current turn policy.`,
    };
  }
  const recipes = input.repairRecipes ?? input.runtime?.repairRecipes ?? [];
  const recipe = input.errorCode
    ? recipes.find((candidate) =>
      candidate.toolName === input.toolName && candidate.errorCode === input.errorCode,
    )
    : undefined;
  if (!recipe) return { allowed: true, mode: 'passthrough' };
  return {
    allowed: recipe.mode !== 'reject',
    mode: recipe.mode,
    reason: recipe.message,
    repairRecipe: recipe,
    suggestedArgs: recipe.suggestedArgs,
  };
}

export type ToolErrorCode =
  | 'PARAMETER_INVALID'
  | 'USER_INPUT_INCOMPLETE'
  | 'ASSET_NOT_FOUND'
  | 'WORKFLOW_VALIDATION_FAILED'
  | 'MODEL_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'GPU_WORKER_FAILED'
  | 'COST_LIMIT_EXCEEDED'
  | 'SAFETY_REJECTED'
  | 'PERMISSION_REQUIRED'
  | 'USER_CANCELLED'
  | 'UNKNOWN_ERROR';

export type SkillErrorCategory =
  | 'schema_validation'
  | 'user_input_incomplete'
  | 'asset_not_found'
  | 'workflow_validation'
  | 'model_unavailable'
  | 'timeout'
  | 'transient_failure'
  | 'insufficient_credits'
  | 'content_refused'
  | 'permission_required'
  | 'cancelled'
  | 'permanent_failure';

export interface ClassifiedSkillError {
  error_type: ToolErrorCode;
  category: SkillErrorCategory;
  message: string;
  retryable: boolean;
}

function skillErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message || 'Unknown error';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return String(error);
}

function skillErrorCode(error: unknown): string | number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const record = error as Record<string, unknown>;
  const code = record.code ?? record.errorCode ?? record.status ?? record.statusCode;
  if (typeof code === 'string' || typeof code === 'number') return code;
  return undefined;
}

function codeEquals(code: string | number | undefined, expected: string | number): boolean {
  if (code === undefined) return false;
  return String(code).toLowerCase() === String(expected).toLowerCase();
}

/**
 * Map public skill / CLI failures onto the canonical `ToolErrorCode`
 * taxonomy used by the shared creative-agent runtime. This intentionally
 * accepts only broad producer-owned fields (`message`, `error`, `code`,
 * `errorCode`, HTTP status) and otherwise keeps unknown payloads opaque.
 */
export function classifySkillError(error: unknown): ClassifiedSkillError {
  const message = skillErrorMessage(error);
  const lower = message.toLowerCase();
  const code = skillErrorCode(error);

  if (
    codeEquals(code, 4024)
    || codeEquals(code, 'INSUFFICIENT_BALANCE')
    || lower.includes('insufficient balance')
    || lower.includes('insufficient credits')
    || lower.includes('insufficient_credits')
  ) {
    return { error_type: 'COST_LIMIT_EXCEEDED', category: 'insufficient_credits', message, retryable: true };
  }

  if (
    codeEquals(code, 'USER_CANCELLED')
    || codeEquals(code, 'CANCELLED')
    || codeEquals(code, 'ABORT_ERR')
    || lower.includes('cancelled')
    || lower.includes('canceled')
    || lower.includes('aborted')
  ) {
    return { error_type: 'USER_CANCELLED', category: 'cancelled', message, retryable: false };
  }

  if (
    codeEquals(code, 408)
    || codeEquals(code, 'ETIMEDOUT')
    || lower.includes('timed out')
    || lower.includes('timeout')
    || lower.includes('no events received')
    || lower.includes('no activity')
    || lower.includes('inactivity')
  ) {
    return { error_type: 'PROVIDER_TIMEOUT', category: 'timeout', message, retryable: true };
  }

  if (
    codeEquals(code, 401)
    || codeEquals(code, 403)
    || codeEquals(code, 'MISSING_CREDENTIALS')
    || codeEquals(code, 'UNSAFE_API_BASE_URL')
    || lower.includes('api key')
    || lower.includes('credentials')
    || lower.includes('permission')
    || lower.includes('unauthorized')
    || lower.includes('forbidden')
  ) {
    return { error_type: 'PERMISSION_REQUIRED', category: 'permission_required', message, retryable: false };
  }

  if (
    codeEquals(code, 'MODEL_UNAVAILABLE')
    || lower.includes('model unavailable')
    || lower.includes('model not available')
    || lower.includes('no worker')
    || lower.includes('no gpu worker')
  ) {
    return { error_type: 'MODEL_UNAVAILABLE', category: 'model_unavailable', message, retryable: true };
  }

  if (
    codeEquals(code, 'ASSET_NOT_FOUND')
    || codeEquals(code, 'FILE_NOT_FOUND')
    || lower.includes('file not found')
    || lower.includes('asset not found')
    || lower.includes('missing asset')
  ) {
    return { error_type: 'ASSET_NOT_FOUND', category: 'asset_not_found', message, retryable: false };
  }

  if (
    codeEquals(code, 'WORKFLOW_VALIDATION_FAILED')
    || codeEquals(code, 'INVALID_WORKFLOW_INPUT')
    || lower.includes('workflow validation')
    || lower.includes('invalid workflow')
  ) {
    return { error_type: 'WORKFLOW_VALIDATION_FAILED', category: 'workflow_validation', message, retryable: false };
  }

  if (
    codeEquals(code, 'USER_INPUT_INCOMPLETE')
    || codeEquals(code, 'MISSING_WORKFLOW_INPUT')
    || lower.includes('requires a prompt')
    || lower.includes('requires --')
    || lower.includes('missing required input')
  ) {
    return { error_type: 'USER_INPUT_INCOMPLETE', category: 'user_input_incomplete', message, retryable: false };
  }

  if (
    codeEquals(code, 'PARAMETER_INVALID')
    || codeEquals(code, 'INVALID_ARGUMENT')
    || codeEquals(code, 'INVALID_VIDEO_SIZE')
    || codeEquals(code, 'INVALID_PATH')
    || lower.includes('parse')
    || lower.includes('malformed')
    || lower.includes('missing required')
    || lower.includes('must be')
    || lower.includes('invalid ')
  ) {
    return { error_type: 'PARAMETER_INVALID', category: 'schema_validation', message, retryable: false };
  }

  if (
    codeEquals(code, 'SAFETY_REJECTED')
    || lower.includes('content policy')
    || lower.includes('sensitive content')
    || lower.includes('sensitivecontent')
    || lower.includes('nsfw')
    || lower.includes('refused')
    || lower.includes('not appropriate')
    || lower.includes('safety')
  ) {
    return { error_type: 'SAFETY_REJECTED', category: 'content_refused', message, retryable: false };
  }

  if (
    codeEquals(code, 502)
    || codeEquals(code, 503)
    || codeEquals(code, 504)
    || codeEquals(code, 'ECONNRESET')
    || codeEquals(code, 'ECONNREFUSED')
    || lower.includes('network')
    || lower.includes('failed to fetch')
    || lower.includes('websocket')
    || lower.includes('econnreset')
    || lower.includes('econnrefused')
    || lower.includes('socket hang up')
    || lower.includes('server restarting')
    || lower.includes('worker disconnected')
  ) {
    return { error_type: 'GPU_WORKER_FAILED', category: 'transient_failure', message, retryable: true };
  }

  return { error_type: 'UNKNOWN_ERROR', category: 'permanent_failure', message, retryable: false };
}

const TOOL_RESULT_BEGIN = '[[TOOL_RESULT_BEGIN]]';
const TOOL_RESULT_END = '[[TOOL_RESULT_END]]';

const HARD_STRIP_PATTERNS: RegExp[] = [
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<\|user\|>/gi,
  /<\|system\|>/gi,
  /<\|assistant\|>/gi,
  /<\|tool\|>/gi,
  /<\|tool_call\|>/gi,
  /<\|begin\u2581of\u2581sentence\|>/gi,
  /<\|end\u2581of\u2581sentence\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
  /<system>[\s\S]*?<\/system>/gi,
  /<tool_call>[\s\S]*?<\/tool_call>/gi,
  /<\/?(?:user|assistant|tool)>/gi,
];

const SUSPICIOUS_PHRASE_PATTERNS: RegExp[] = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|the\s+above)\s+instructions?\b/gi,
  /\bdisregard\s+(?:all\s+)?(?:previous|prior|the\s+above)\b/gi,
  /\bforget\s+(?:your|the)\s+(?:role|instructions?|rules?|system)\b/gi,
  /\byou\s+are\s+now\s+(?:a|an)\s+/gi,
  /\b(?:override|bypass)\s+(?:safety|content|filter)/gi,
];

export interface SanitizationResult {
  cleaned: string;
  flagged: boolean;
  signals: string[];
}

export interface PublicChatMessage {
  role: string;
  content?: unknown;
  tool_call_id?: string;
  [key: string]: unknown;
}

export interface SanitizeMessagesForLlmSignal {
  tool_call_id?: string;
  signals: string[];
}

export function sanitizeToolMessageContent(input: string): SanitizationResult {
  if (!input) return { cleaned: input, flagged: false, signals: [] };

  let cleaned = input;
  const signals: string[] = [];
  for (const pattern of HARD_STRIP_PATTERNS) {
    if (pattern.test(cleaned)) {
      pattern.lastIndex = 0;
      cleaned = cleaned.replace(pattern, ' ');
      signals.push(`stripped:${pattern.source.replace(/\\\|/g, '|').slice(0, 40)}`);
    }
    pattern.lastIndex = 0;
  }
  for (const pattern of SUSPICIOUS_PHRASE_PATTERNS) {
    if (pattern.test(cleaned)) {
      signals.push(`flagged:${pattern.source.slice(0, 40)}`);
    }
    pattern.lastIndex = 0;
  }
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

  return {
    cleaned,
    flagged: signals.length > 0,
    signals,
  };
}

export function wrapToolResultForLlm(content: string): string {
  if (content.startsWith(TOOL_RESULT_BEGIN)) return content;
  return `${TOOL_RESULT_BEGIN}\n${content}\n${TOOL_RESULT_END}`;
}

export function sanitizeMessagesForLlm<T extends PublicChatMessage>(
  messages: readonly T[],
  onSignal?: (entry: SanitizeMessagesForLlmSignal) => void,
): T[] {
  return messages.map((message) => {
    if (message.role !== 'tool') return message;
    const raw = message.content;
    if (typeof raw !== 'string' || raw.length === 0) return message;
    const { cleaned, flagged, signals } = sanitizeToolMessageContent(raw);
    if (flagged && onSignal) {
      onSignal({
        tool_call_id: message.tool_call_id,
        signals,
      });
    }
    return {
      ...message,
      content: wrapToolResultForLlm(cleaned),
    };
  });
}

export const TOOL_RESULT_DELIMITERS = {
  begin: TOOL_RESULT_BEGIN,
  end: TOOL_RESULT_END,
} as const;

export type AssetType = 'image' | 'video' | 'audio';

export interface ParsedModelRef {
  index: number;
  type?: AssetType;
}

export interface ModelRefFormat {
  format(index: number, type: AssetType): string;
  parse(token: string): ParsedModelRef | null;
  scanRegex: RegExp;
}

const SEEDANCE_MODEL_REF_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `@Video${index}`;
    if (type === 'audio') return `@Audio${index}`;
    return `@Image${index}`;
  },
  parse(token) {
    const m = /^@(Image|Video|Audio)(\d+)$/.exec(token.trim());
    if (!m) return null;
    const index = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(index) || index < 1) return null;
    return {
      index,
      type: m[1] === 'Video' ? 'video' : m[1] === 'Audio' ? 'audio' : 'image',
    };
  },
  scanRegex: /@(?:Image|Video|Audio)\d+/g,
};

const GPT_IMAGE_MODEL_REF_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `Video ${index}`;
    if (type === 'audio') return `Audio ${index}`;
    return `Image ${index}`;
  },
  parse(token) {
    const m = /^(?:\[(Image|Video|Audio)\s+(\d+)\]|(Image|Video|Audio)\s+(\d+))$/.exec(token.trim());
    if (!m) return null;
    const kind = m[1] ?? m[3]!;
    const index = Number.parseInt(m[2] ?? m[4]!, 10);
    if (!Number.isFinite(index) || index < 1) return null;
    return {
      index,
      type: kind === 'Video' ? 'video' : kind === 'Audio' ? 'audio' : 'image',
    };
  },
  scanRegex: /(?<!@)(?<!\b[Gg][Pp][Tt]\s)(?:\[(?:Image|Video|Audio)\s+\d+\]|\b(?:Image|Video|Audio)\s+\d+\b)/g,
};

const CONTEXT_MODEL_REF_FORMAT: ModelRefFormat = {
  format(index, type) {
    const slot = Math.max(0, index - 1);
    if (type === 'video') return `context_video_${slot}`;
    if (type === 'audio') return `context_audio_${slot}`;
    return `context_image_${slot}`;
  },
  parse(token) {
    const m = /^context_(image|video|audio)_(\d+)$/.exec(token.trim());
    if (!m) return null;
    const slot = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(slot) || slot < 0) return null;
    return { index: slot + 1, type: m[1] as AssetType };
  },
  scanRegex: /context_(?:image|video|audio)_\d+/g,
};

/**
 * MiniMax H3 Ref2VA labels references with the literal tags its text encoder
 * splices in front of the prompt — `<Picture 1>`, `<Video 1>`, `<Audio 1>` —
 * 1-based per type, angle brackets included. The image label is Picture, not
 * Image, and a reference video's own soundtrack consumes the next Audio
 * ordinal before standalone audio clips. Mirrors the internal
 * asset_reference_management registry.
 */
const MINIMAX_H3_MODEL_REF_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `<Video ${index}>`;
    if (type === 'audio') return `<Audio ${index}>`;
    return `<Picture ${index}>`;
  },
  parse(token) {
    const m = /^<(Picture|Video|Audio)\s+(\d+)>$/.exec(token.trim());
    if (!m) return null;
    const index = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(index) || index < 1) return null;
    return {
      index,
      type: m[1] === 'Video' ? 'video' : m[1] === 'Audio' ? 'audio' : 'image',
    };
  },
  scanRegex: /<(?:Picture|Video|Audio)\s+\d+>/g,
};

/**
 * HappyHorse r2v tags reference images as bracketed ordinals — `[Image 1]`.
 * Mirrors the internal registry; previously this runtime silently fell back
 * to the bare GPT `Image N` form for HappyHorse ids.
 */
const HAPPYHORSE_MODEL_REF_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `[Video ${index}]`;
    if (type === 'audio') return `[Audio ${index}]`;
    return `[Image ${index}]`;
  },
  parse(token) {
    const m = /^\[(Image|Video|Audio)\s+(\d+)\]$/.exec(token.trim());
    if (!m) return null;
    const index = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(index) || index < 1) return null;
    return {
      index,
      type: m[1] === 'Video' ? 'video' : m[1] === 'Audio' ? 'audio' : 'image',
    };
  },
  scanRegex: /\[(?:Image|Video|Audio)\s+\d+\]/g,
};

/** Wan 3 uses Alibaba's plain, type-local English reference ordinals. */
const WAN3_MODEL_REF_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `Video ${index}`;
    if (type === 'audio') return `Audio ${index}`;
    return `Image ${index}`;
  },
  parse(token) {
    const m = /^(Image|Video|Audio)\s+(\d+)$/.exec(token.trim());
    if (!m) return null;
    const index = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(index) || index < 1) return null;
    return {
      index,
      type: m[1] === 'Video' ? 'video' : m[1] === 'Audio' ? 'audio' : 'image',
    };
  },
  scanRegex: /\b(?:Image|Video|Audio)\s+\d+\b/g,
};

export function getModelRefFormat(modelId: string): ModelRefFormat {
  const trimmed = modelId.trim().toLowerCase().replace(/[_.\s]+/g, '-').replace(/-+/g, '-');
  if (trimmed === 'seedance' || isSeedanceVideoModelId(trimmed)) return SEEDANCE_MODEL_REF_FORMAT;
  const videoFamily = resolveRegisteredVideoModelFamily(trimmed);
  if (videoFamily === 'minimax-h3') return MINIMAX_H3_MODEL_REF_FORMAT;
  if (videoFamily === 'happyhorse-1.1') return HAPPYHORSE_MODEL_REF_FORMAT;
  if (videoFamily === 'wan3') return WAN3_MODEL_REF_FORMAT;
  if (videoFamily === 'ltx25' || videoFamily === 'ltx23' || videoFamily === 'ltx2' || videoFamily === 'wan22') {
    return CONTEXT_MODEL_REF_FORMAT;
  }
  const imageReferenceModelId = resolveRegisteredImageReferenceModelId(trimmed);
  if (imageReferenceModelId === 'gpt-image-2' || imageReferenceModelId === 'flux') {
    return GPT_IMAGE_MODEL_REF_FORMAT;
  }
  if (imageReferenceModelId === 'qwen-image-edit' || imageReferenceModelId === 'krea-identity-edit') {
    return CONTEXT_MODEL_REF_FORMAT;
  }
  console.warn(`[SOGNI RUNTIME] Unknown model_id "${modelId}" fell back to GPT Image model_ref format.`);
  return GPT_IMAGE_MODEL_REF_FORMAT;
}

export function formatModelRef(modelId: string, index: number, type: AssetType): string {
  return getModelRefFormat(modelId).format(index, type);
}

export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  toolNames: readonly string[];
  constraints?: readonly string[];
  alwaysLoaded?: boolean;
}

export const SESSION_CONTROL_SKILL: SkillManifest = {
  id: 'session_control',
  name: 'Session control',
  description: 'Turn-control markers that end the current turn cleanly.',
  toolNames: ['ask_clarifying_question', 'finalize_response'],
  alwaysLoaded: true,
  constraints: ['ask_clarifying_question and finalize_response both end the turn.'],
};

export const ASSET_REFERENCE_MANAGEMENT_SKILL: SkillManifest = {
  id: 'asset_reference_management',
  name: 'Asset reference management',
  description: 'Translate between asset_id, user_label, and per-model model_ref tokens.',
  toolNames: ['create_asset_manifest', 'inspect_asset', 'label_asset', 'map_assets_for_model', 'validate_asset_references'],
  alwaysLoaded: true,
  constraints: ['Use formatModelRef/map assets helpers instead of hand-formatting model reference tokens.'],
};

export const QUALITY_AUDIT_SKILL: SkillManifest = {
  id: 'quality_audit',
  name: 'Quality audit',
  description:
    'Pre-dispatch and post-generation audits that catch parameter / asset / model-range / persona-flow issues before burning a worker round. Findings come back as structured fatal/minor issues with a recommended_action (accept | refine | regenerate | ask_user). Always loaded — cannot be unloaded.',
  toolNames: [],
  alwaysLoaded: true,
  constraints: [
    'When the audit returns recommended_action="ask_user", surface the fatal_issues to the user and wait — do not retry the tool call.',
    'When recommended_action="refine", apply the fix_hint(s) on the next attempt rather than repeating the same call.',
  ],
};

export const IMAGE_GENERATION_SKILL: SkillManifest = {
  id: 'image_generation',
  name: 'Image generation',
  description:
    'Text-to-image synthesis with Sogni image models including Z-Image, Krea 2 Turbo, Dark Beast Krea 2, Chroma, Flux, Qwen image, and GPT Image 2. Use when the user wants a new image generated from a prompt with no source asset.',
  toolNames: ['generate_image'],
  constraints: [
    'For persona-driven requests, defer to image_editing — personas must be conditioned on reference photos, never generated from scratch.',
  ],
};

export const IMAGE_EDITING_SKILL: SkillManifest = {
  id: 'image_editing',
  name: 'Image editing',
  description:
    'Edit, restore, restyle, refine, upscale, or change the camera angle of an existing image. Includes deterministic RTX VSR upscaling plus persona-conditioned edits and Krea 2 Identity Edit models — persona images should use edit_image and reference photos rather than text-to-image.',
  toolNames: ['edit_image', 'restore_photo', 'upscale_image', 'apply_style', 'change_angle', 'refine_result'],
  constraints: [
    'For persona image output, use edit_image with a reference photo rather than generate_image.',
    'Krea 2 Identity Edit and Dark Beast Krea 2 Identity Edit use edit_image with 1-2 context images, context_image_N refs, 512-2048 px output, default steps=10, guidance=1, sampler=euler, and scheduler=simple.',
    'refine_result acts on a prior generation in the session; do not call it before any image has been produced or uploaded.',
    'Use upscale_image for promptless, deterministic enlargement that must preserve the exact image. Do not substitute restore_photo, refine_result, or edit_image when the user only wants more pixels.',
  ],
};

export const VIDEO_GENERATION_SKILL: SkillManifest = {
  id: 'video_generation',
  name: 'Video generation',
  description:
    'Text-to-video synthesis with LTX, Wan, Seedance, HappyHorse, and MiniMax H3, including Wan 3.0 Enhanced through MuleRouter. Use when the user wants a new video clip generated from a prompt or loose reference set.',
  toolNames: ['generate_video'],
  constraints: [
    'For My Personas video requests, default to image_editing first to produce a conditioned scene image before animation. Use direct video only when the user explicitly asks to animate an existing persona image/reference or no source image is available for a voice-only request.',
    'Wan 3.0 Enhanced uses exact Sogni model id wan3.0-spicy-video (MuleRouter provider id w3.0-video): 2-30 seconds or smart duration at 30 fps, 480p/720p/1080p, native audio, prompt expansion, adaptive/fixed ratios, and up to 10 image/5 video/5 audio references. First/last-frame mode and loose-reference mode are mutually exclusive. It has no document/web context, watermark, negative prompt, source-video edit, or extend mode.',
  ],
};

export const VIDEO_EDITING_SKILL: SkillManifest = {
  id: 'video_editing',
  name: 'Video editing',
  description:
    'Convert a still image, audio track, or existing clip into video, plus stitching, orbits, dance-montage compositions, segment extend/replace, promptless FlashVSR video upscaling, and pure-ffmpeg post-production (overlay, subtitles).',
  toolNames: [
    'animate_photo',
    'sound_to_video',
    'video_to_video',
    'upscale_video',
    'stitch_video',
    'orbit_video',
    'dance_montage',
    'extend_video',
    'replace_video_segment',
    'overlay_video',
    'add_subtitles',
  ],
  constraints: [
    'Preserve per-clip retry and batch progress semantics. Use one Dynamic Prompt project for prompt-only fan-out, and avoid serial waterfall calls for independent clips.',
    'animate_photo errors with all_failed must surface to the user; do not auto-retry from inside the chat loop.',
    'Use upscale_video for a promptless 1080p/1440p resolution increase of an existing video; it keeps every frame, the frame rate, and the audio. Do not substitute video_to_video unless the user explicitly asks a generative model such as Seedance to re-render the clip.',
  ],
};

export const MUSIC_GENERATION_SKILL: SkillManifest = {
  id: 'music_generation',
  name: 'Music generation',
  description:
    'Compose music with optional lyrics, BPM, key, and structural hints (Sonic Logos).',
  toolNames: ['generate_music'],
};

export const SPEECH_GENERATION_SKILL: SkillManifest = {
  id: 'speech_generation',
  name: 'Speech generation',
  description:
    'Read written words aloud: narration and voiceover in one of nine studio voices, a voice cloned from an uploaded recording, or a voice invented from a description. Ten languages, cross-lingual cloning.',
  toolNames: ['generate_speech'],
};

export const MEDIA_ANALYSIS_SKILL: SkillManifest = {
  id: 'media_analysis',
  name: 'Media analysis',
  description:
    'Vision analysis of uploaded images / videos and structured extraction of generation metadata from previously rendered results.',
  toolNames: ['analyze_image', 'analyze_video', 'extract_metadata'],
};

export const PERSONA_MANAGEMENT_SKILL: SkillManifest = {
  id: 'persona_management',
  name: 'Persona & memory',
  description:
    "Resolve named personas to their reference photos and read/write the user's long-term creative memory (preferences, named subjects, ongoing projects).",
  toolNames: ['resolve_personas', 'manage_memory'],
  constraints: [
    'For clear My Personas references, call resolve_personas before persona-conditioned image or video tools; do not rely on name text alone for identity.',
  ],
};

export const APP_SETTINGS_SKILL: SkillManifest = {
  id: 'app_settings',
  name: 'App settings',
  description:
    'Toggle user-visible app preferences such as the safe-content filter. Only invoke when the user has explicitly asked to change a setting.',
  toolNames: ['set_content_filter'],
};

export const COMPOSITION_PLANNING_SKILL: SkillManifest = {
  id: 'composition_planning',
  name: 'Composition & planning',
  description:
    'Plan and shape creative work before any media is rendered: prompt enhancement (enhance_prompt), lyric/instrumental composition (compose_lyrics, compose_instrumental), script/storyboard/ad/trailer/talking-head writing (compose_script), and durable workflow plans or savable workflow templates (compose_workflow, compose_workflow_template). These tools return plans, prompts, or text — they do not consume render credits themselves.',
  toolNames: [
    'enhance_prompt',
    'compose_lyrics',
    'compose_instrumental',
    'compose_script',
    'compose_workflow',
    'compose_workflow_template',
  ],
  constraints: [
    'Composition tools return plans, prompts, or text — never assume they produced media. After enhance_prompt / compose_lyrics / compose_instrumental / compose_script, hand the output to the matching generation tool (generate_image, generate_video, generate_music, etc.) only if the user asked you to render.',
    'compose_workflow returns a one-shot durable plan; compose_workflow_template returns a savable, parameterized template. Pick compose_workflow_template only when the user wants to SAVE / NAME / REUSE the recipe; otherwise pick compose_workflow.',
    'After compose_workflow_template returns the template_draft, finalize the turn immediately — do not call render tools "to preview" the template.',
  ],
};

export const ALL_BUILT_IN_SKILLS: readonly SkillManifest[] = [
  QUALITY_AUDIT_SKILL,
  SESSION_CONTROL_SKILL,
  ASSET_REFERENCE_MANAGEMENT_SKILL,
  IMAGE_GENERATION_SKILL,
  IMAGE_EDITING_SKILL,
  VIDEO_GENERATION_SKILL,
  VIDEO_EDITING_SKILL,
  MUSIC_GENERATION_SKILL,
  SPEECH_GENERATION_SKILL,
  MEDIA_ANALYSIS_SKILL,
  PERSONA_MANAGEMENT_SKILL,
  APP_SETTINGS_SKILL,
  COMPOSITION_PLANNING_SKILL,
];

// ---------------------------------------------------------------------------
// Tool result envelope (canonical contract — mirrors @sogni/creative-agent/tools/result)
// `ToolErrorCode` is defined earlier in this bundle; the rest of the
// envelope (interfaces + constructors + type guards) is added here so
// downstream consumers can call `toolOk(...)` / `toolErr(...)`.
// ---------------------------------------------------------------------------

export interface ToolResultAsset {
  asset_id: string;
  type: 'image' | 'video' | 'audio';
  url?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  fps?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolResultCost {
  spark?: number;
  usd?: number;
  internal_cost_usd?: number;
  notes?: string;
}

export interface ToolResultOk<TParams = Record<string, unknown>> {
  ok: true;
  tool: string;
  job_id?: string;
  model_id?: string;
  workflow_id?: string;
  status: 'completed' | 'in_progress' | 'queued';
  output_assets: ToolResultAsset[];
  params?: TParams;
  estimated_cost?: ToolResultCost;
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

export interface ToolResultErr {
  ok: false;
  tool: string;
  error_type: ToolErrorCode;
  message: string;
  retryable: boolean;
  suggested_next_action?: string;
  metadata?: Record<string, unknown>;
}

export type ToolResult<TParams = Record<string, unknown>> =
  | ToolResultOk<TParams>
  | ToolResultErr;

export function toolOk<TParams = Record<string, unknown>>(
  fields: Omit<ToolResultOk<TParams>, 'ok' | 'status' | 'output_assets'> &
    Partial<Pick<ToolResultOk<TParams>, 'status' | 'output_assets'>>,
): ToolResultOk<TParams> {
  return { ok: true, status: 'completed', output_assets: [], ...fields };
}

export function toolErr(fields: Omit<ToolResultErr, 'ok'>): ToolResultErr {
  return { ok: false, ...fields };
}

export function isToolResultOk<T = Record<string, unknown>>(
  result: ToolResult<T>,
): result is ToolResultOk<T> {
  return result.ok === true;
}

export function isToolResultErr(result: ToolResult<unknown>): result is ToolResultErr {
  return result.ok === false;
}

// ---------------------------------------------------------------------------
// Storyboard adapter prompt compiler
// ---------------------------------------------------------------------------

export type PublicStoryboardAdapterStage = 'storyboard_image' | 'keyframe' | 'scene_clip';

export interface PublicStoryboardAdapterCompileInput {
  stage: PublicStoryboardAdapterStage;
  scene?: SceneSpec;
  primaryReferenceTag?: string;
  options?: Readonly<Record<string, unknown>>;
}

export interface PublicStoryboardAdapterCompileResult {
  prompt: string;
  args: Readonly<Record<string, unknown>>;
  stage: PublicStoryboardAdapterStage;
}

export interface PublicStoryboardAdapter {
  modelId: string;
  name: string;
  supportedStages: ReadonlyArray<PublicStoryboardAdapterStage>;
  compile(storyboard: StoryboardProject, input: PublicStoryboardAdapterCompileInput): PublicStoryboardAdapterCompileResult;
  getSystemPromptGuidance?: () => string | null;
}

export class StoryboardAdapterUnsupportedStageError extends Error {
  constructor(public readonly modelId: string, public readonly stage: PublicStoryboardAdapterStage) {
    super(`Adapter "${modelId}" does not support stage "${stage}".`);
    this.name = 'StoryboardAdapterUnsupportedStageError';
  }
}

function requireStoryboardScene(
  adapterId: string,
  input: PublicStoryboardAdapterCompileInput,
): SceneSpec {
  if (!input.scene) throw new Error(`${adapterId} ${input.stage} requires a scene argument.`);
  return input.scene;
}

function compileStoryboardImagePromptFromProject(project: StoryboardProject): string {
  if (project.scenes.length === 0) {
    throw new Error('Storyboard image prompt compile failed: no concrete storyboard scenes were provided.');
  }
  const frameCount = project.scenes.length;
  const layout = storyboardLayoutSpecFromProject(project, frameCount);
  const boardSizeLine = layout.boardDimensions
    ? `Overall storyboard canvas: ${layout.boardDimensions} pixels (${layout.boardAspectRatio}).`
    : `Overall storyboard canvas aspect ratio: ${layout.boardAspectRatio}.`;
  return [
    'CREATE:',
    `Create exactly ${frameCount} sequential video storyboard frames as one production storyboard sheet.`,
    '',
    'PROJECT:',
    `Title: ${project.title}.`,
    `Format: ${layout.targetVideoAspectRatio} video storyboard.`,
    project.durationSec !== null ? `Target duration: ${project.durationSec} seconds.` : 'Target duration: unspecified in source brief.',
    '',
    'LAYOUT CONTRACT:',
    `Create exactly ${frameCount} numbered storyboard panels; do not render fewer or more panels.`,
    `Arrange panels in reading order, left-to-right then top-to-bottom: ${Array.from({ length: frameCount }, (_, index) => {
      const scene = project.scenes[index];
      return `[${index + 1}] ${scene?.id.toUpperCase() ?? `SCENE_${String(index + 1).padStart(2, '0')}`}`;
    }).join(', ')}.`,
    boardSizeLine,
    `Individual scene-cell/frame aspect ratio: ${layout.cellAspectRatio}.`,
    `Target final video aspect ratio: ${layout.targetVideoAspectRatio}.`,
    `Layout preset: ${layout.layoutKind} - ${layout.layoutDescription}.`,
    `Each panel must contain one distinct ${layout.cellAspectRatio} cinematic video-frame rectangle with compact notes outside the frame.`,
    'Keep scene numbers, timecodes, titles, dialogue/VO, audio notes, and production notes outside the video-frame rectangles.',
    'Do not merge panels, create inset thumbnails, make panels square, or overlay storyboard metadata inside the artwork frames.',
    '',
    ...compileStoryboardReferenceSection(project),
    '',
    'STYLE:',
    `${project.creativeBrief.visualQualityBar} with cinematic shot language, coherent art direction, readable labels, and consistent reference usage.`,
    'Reference-driven personality: before drawing, infer concrete visual and behavioral cues from uploaded/reference images, including character attitude, materials, props, palette, brand tone, typography style, and implied world. Let those cues make this storyboard specific to the supplied subject instead of a generic reusable template.',
    'Vary composition within the required grid: keep the exact scene count, layout, and cell geometry, and make each panel intentionally staged with distinct shot scale, pose/action, camera angle, lighting beat, transition idea, and character-specific detail.',
    '',
    ...compileStoryboardStoryContinuitySection(project),
    '',
    'CRITICAL REQUIREMENTS:',
    ...compileStoryboardCriticalRequirements().map((item, index) => `${index + 1}. ${item}`),
    ...project.references
      .filter(ref => ref.preservePriority === 'critical')
      .map((ref, index) => `${compileStoryboardCriticalRequirements().length + index + 1}. Critical reference lock: ${ref.id} (${ref.kind}) must remain bound to its assigned usage scope: ${ref.usageScope}.`),
    '',
    ...compileStoryboardScenesSection(project),
    'TEXT RULES:',
    'Place scene number, timing, scene title, beat title, and compact production labels outside each video frame in a clearly associated header, footer strip, side rail, or table. Do not overlay scene numbers, timecodes, production notes, Dialogue/VO labels, Audio/SFX text, or SFX/action callout words such as Whoosh!, Impact!, Boom!, Thud!, Slash!, Crack!, or Pop! on top of the video-frame artwork. Also do not overlay scene/beat titles on top of the video-frame artwork. Project titles are metadata, not in-frame text. Only listed diegetic or brand text belongs inside a frame. Quote and spell any required visible text exactly.',
    'Visible text listed on a scene belongs only in that scene; repeat visible text only on scenes that list it.',
    ...storyboardRequiredVisibleText(project).map(formatStoryboardRequiredVisibleTextLine),
    project.endCard.logoUsage ? `Logo usage: ${project.endCard.logoUsage}` : '',
    '',
    'NEGATIVE / AVOID:',
    ...compileStoryboardAvoidConstraints(project.creativeBrief.mustAvoid).map(item => `- ${item}`),
  ].join('\n');
}

function scenePromptText(scene: SceneSpec): string {
  return [
    scene.visual,
    scene.action,
    scene.camera,
    scene.lighting,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0).join(' — ');
}

function compileStoryboardKeyframePrompt(project: StoryboardProject, scene: SceneSpec): string {
  const promptText = scenePromptText(scene);
  if (!promptText) {
    throw new Error(`Storyboard keyframe compile failed: ${scene.id} is missing visual/action/camera direction.`);
  }
  return [
    `Create a cinematic keyframe for scene "${scene.title}" in project "${project.title}".`,
    `Visual: ${promptText}.`,
    scene.referenceUsage.length > 0 ? `Reference usage: ${scene.referenceUsage.join('; ')}.` : '',
    scene.textInImage.length > 0 ? `Visible text: ${scene.textInImage.join('; ')}.` : '',
    `Style: ${project.creativeBrief.visualQualityBar}.`,
    'Do not include storyboard panel labels, timecodes, production notes, or metadata labels inside the frame.',
  ].filter(Boolean).join('\n');
}

function compileSeedanceSceneClipPromptFromProject(
  project: StoryboardProject,
  scene: SceneSpec,
  referenceTag: string,
): string {
  const promptText = scenePromptText(scene);
  if (!promptText) {
    throw new Error(`Seedance scene clip compile failed: ${scene.id} is missing visual/action/camera direction.`);
  }
  return [
    `Create a full-screen cinematic video clip from ${referenceTag}.`,
    `Project: ${project.title}.`,
    `Scene: ${scene.title}.`,
    scene.purpose ? `Purpose: ${scene.purpose}` : '',
    `Visual/action/camera: ${promptText}.`,
    scene.transitionIn || scene.transitionOut ? `Transition: ${[scene.transitionIn, scene.transitionOut].filter(Boolean).join('; ')}.` : '',
    scene.dialogue ? `Dialogue/VO: ${scene.dialogue}.` : '',
    scene.audioSfx.length > 0 ? `Audio/SFX: ${scene.audioSfx.join(', ')}.` : '',
    scene.music ? `Music: ${scene.music}.` : '',
    scene.textInImage.length > 0 ? `Required visible text: ${scene.textInImage.join('; ')}.` : '',
    `Style: ${project.creativeBrief.visualQualityBar}.`,
    'Use the reference as identity and composition guidance. Do not render storyboard labels, panel numbers, timecodes, or metadata.',
  ].filter(Boolean).join('\n');
}

function compactSceneVideoPrompt(project: StoryboardProject, scene: SceneSpec, referenceTag: string): string {
  const lines: string[] = [];
  lines.push(`[VISUAL] ${scenePromptText(scene) || scene.purpose || scene.id}`);
  if (scene.audioSfx.length > 0) lines.push(`[SOUNDS] ${scene.audioSfx.join(', ')}`);
  if (scene.music) lines.push(`[MUSIC] ${scene.music}`);
  if (scene.dialogue) lines.push(`[SPEECH] ${scene.dialogue}`);
  lines.push(`Reference: ${referenceTag} (use as keyframe identity).`);
  if (project.creativeBrief.visualQualityBar) lines.push(`Style: ${project.creativeBrief.visualQualityBar}`);
  return lines.join('\n');
}

const PUBLIC_SEEDANCE_ADAPTER: PublicStoryboardAdapter = {
  modelId: 'seedance',
  name: 'Seedance 2.x',
  supportedStages: ['storyboard_image', 'scene_clip'],
  compile(storyboard, input) {
    if (input.stage === 'storyboard_image') {
      return {
        stage: 'storyboard_image',
        prompt: compileStoryboardImagePromptFromProject(storyboard),
        args: {
          videoModel: 'seedance2-mini',
          aspectRatio: storyboard.targetVideoAspectRatio,
          skipPromptProcessing: true,
          expandPrompt: false,
        },
      };
    }
    if (input.stage === 'scene_clip') {
      const scene = requireStoryboardScene('SEEDANCE_ADAPTER', input);
      const referenceTag = input.primaryReferenceTag ?? formatModelRef('seedance', 1, 'image');
      const duration = clampSeedanceStoryboardDuration(scene.durationSec ?? 5);
      return {
        stage: 'scene_clip',
        prompt: compileSeedanceSceneClipPromptFromProject(storyboard, scene, referenceTag),
        args: {
          videoModel: 'seedance2-mini',
          duration,
          aspectRatio: storyboard.targetVideoAspectRatio,
          skipPromptProcessing: true,
          expandPrompt: false,
        },
      };
    }
    throw new StoryboardAdapterUnsupportedStageError('seedance', input.stage);
  },
  getSystemPromptGuidance() {
    return `SEEDANCE STORYBOARD REFERENCES: If exactly one uploaded image is an ordered storyboard/sequence sheet and the user asks for a Seedance video with only a sparse/casual prompt, use generate_video with referenceImageIndices=[-1], prompt="${SEEDANCE_STORYBOARD_REFERENCE_PROMPT}", videoModel="seedance2", skipPromptProcessing=true, and expandPrompt=false. Also use videoModel="seedance2" when a generated storyboard image becomes the Seedance reference, regardless of requested resolution, unless the user explicitly asks for a draft or Mini. Do not use this fallback when the user provides a literal prompt, their own script, shot list, timecoded beats, VO/SFX notes, or other substantive video instructions.`;
  },
};

const PUBLIC_GPT_IMAGE_2_ADAPTER: PublicStoryboardAdapter = {
  modelId: 'gpt-image-2',
  name: 'GPT Image 2',
  supportedStages: ['storyboard_image', 'keyframe'],
  compile(storyboard, input) {
    if (input.stage === 'storyboard_image') {
      return {
        stage: 'storyboard_image',
        prompt: compileStoryboardImagePromptFromProject(storyboard),
        args: {
          model: 'gpt-image-2',
          ...buildStoryboardCanvasArgs(storyboard.outputAspectRatio, true, storyboard.boardDimensions),
          numberOfVariations: 1,
        },
      };
    }
    if (input.stage === 'keyframe') {
      const scene = input.scene ?? storyboard.scenes[0];
      if (!scene) throw new Error('GPT_IMAGE_2_ADAPTER keyframe requires at least one storyboard scene.');
      return {
        stage: 'keyframe',
        prompt: compileStoryboardKeyframePrompt(storyboard, scene),
        args: {
          model: 'gpt-image-2',
          aspectRatio: storyboard.frameAspectRatio,
          numberOfVariations: 1,
          sceneId: scene.id,
        },
      };
    }
    throw new StoryboardAdapterUnsupportedStageError('gpt-image-2', input.stage);
  },
  getSystemPromptGuidance() {
    return 'GPT IMAGE 2 ROUTING: When the user asks for a ChatGPT, OpenAI, GPT, GPT-2, GPT Image, or gpt-image-2 image/model, use model="gpt-image-2". Use generate_image for text-to-image requests. If uploaded/reference/persona images must guide identity, likeness, composition, style, or objects, use edit_image with model="gpt-image-2" instead of forcing generate_image.';
  },
};

const PUBLIC_LTX25_ADAPTER: PublicStoryboardAdapter = {
  modelId: 'ltx25',
  name: 'LTX 2.5',
  supportedStages: ['scene_clip'],
  compile(storyboard, input) {
    if (input.stage !== 'scene_clip') throw new StoryboardAdapterUnsupportedStageError('ltx25', input.stage);
    const scene = requireStoryboardScene('LTX25_ADAPTER', input);
    const referenceTag = input.primaryReferenceTag ?? 'context_image_0';
    return {
      stage: 'scene_clip',
      prompt: compactSceneVideoPrompt(storyboard, scene, referenceTag),
      args: {
        videoModel: 'ltx25',
        duration: clampSeedanceStoryboardDuration(scene.durationSec ?? 5),
        aspectRatio: storyboard.targetVideoAspectRatio,
      },
    };
  },
  getSystemPromptGuidance() {
    return 'LTX 2.5 VIDEO PROMPTING: For image-to-video, describe motion, action, camera, dialogue, and sound not already obvious in the reference frame. Keep recurring character names and visual anchors stable across scenes. Use LTX 2.3 only for explicit rollback or its ID-LoRA/transition/10Eros-only paths.';
  },
};

const PUBLIC_LTX23_ADAPTER: PublicStoryboardAdapter = {
  modelId: 'ltx23',
  name: 'LTX-2.3',
  supportedStages: ['scene_clip'],
  compile(storyboard, input) {
    if (input.stage !== 'scene_clip') throw new StoryboardAdapterUnsupportedStageError('ltx23', input.stage);
    const scene = requireStoryboardScene('LTX23_ADAPTER', input);
    const referenceTag = input.primaryReferenceTag ?? 'context_image_0';
    return {
      stage: 'scene_clip',
      prompt: compactSceneVideoPrompt(storyboard, scene, referenceTag),
      args: {
        videoModel: 'ltx23',
        duration: clampSeedanceStoryboardDuration(scene.durationSec ?? 5),
        aspectRatio: storyboard.targetVideoAspectRatio,
      },
    };
  },
  getSystemPromptGuidance() {
    return 'LTX-2.3 VIDEO PROMPTING: For image-to-video, describe only motion, action, camera, and sound that are not already obvious in the reference frame. Keep recurring character names and visual anchors stable across scenes.';
  },
};

const PUBLIC_WAN_ADAPTER: PublicStoryboardAdapter = {
  modelId: 'wan',
  name: 'WAN 2.x',
  supportedStages: ['scene_clip'],
  compile(storyboard, input) {
    if (input.stage !== 'scene_clip') throw new StoryboardAdapterUnsupportedStageError('wan', input.stage);
    const scene = requireStoryboardScene('WAN_ADAPTER', input);
    const referenceTag = input.primaryReferenceTag ?? 'context_image_0';
    return {
      stage: 'scene_clip',
      prompt: [
        `[VISUAL] ${scenePromptText(scene) || scene.purpose || scene.id}`,
        `Reference: ${referenceTag} (use as the visual identity/keyframe anchor).`,
        scene.dialogue ? '[PERFORMANCE] Show implied speaking beats through expression and body motion; WAN does not render audio.' : '',
        storyboard.creativeBrief.visualQualityBar ? `Style: ${storyboard.creativeBrief.visualQualityBar}` : '',
      ].filter(Boolean).join('\n'),
      args: {
        videoModel: 'wan22',
        duration: clampSeedanceStoryboardDuration(scene.durationSec ?? 5),
        aspectRatio: storyboard.targetVideoAspectRatio,
      },
    };
  },
};

const PUBLIC_STORYBOARD_ADAPTERS = [
  PUBLIC_SEEDANCE_ADAPTER,
  PUBLIC_GPT_IMAGE_2_ADAPTER,
  PUBLIC_LTX25_ADAPTER,
  PUBLIC_LTX23_ADAPTER,
  PUBLIC_WAN_ADAPTER,
];

export function composeAdapterPromptGuidance(adapters: ReadonlyArray<PublicStoryboardAdapter> = PUBLIC_STORYBOARD_ADAPTERS): string {
  return adapters
    .map(adapter => adapter.getSystemPromptGuidance?.())
    .filter((guidance): guidance is string => typeof guidance === 'string' && guidance.trim().length > 0)
    .map(guidance => guidance.trim())
    .join('\n\n');
}

export class SkillRegistry {
  private manifests = new Map<string, SkillManifest>();
  private loaded = new Set<string>();

  register(manifest: SkillManifest): void {
    this.manifests.set(manifest.id, manifest);
    if (manifest.alwaysLoaded) this.loaded.add(manifest.id);
  }

  load(id: string): boolean {
    if (!this.manifests.has(id)) return false;
    this.loaded.add(id);
    return true;
  }

  unload(id: string): boolean {
    const manifest = this.manifests.get(id);
    if (!manifest || manifest.alwaysLoaded) return false;
    return this.loaded.delete(id);
  }

  getActiveToolNames(): string[] {
    const names = new Set<string>();
    for (const id of this.loaded) {
      const manifest = this.manifests.get(id);
      if (!manifest) continue;
      for (const name of manifest.toolNames) names.add(name);
    }
    return [...names];
  }

  getActiveSkills(): SkillManifest[] {
    return [...this.loaded].map((id) => this.manifests.get(id)!).filter(Boolean);
  }
}

export interface StoryboardAdapterRegistryLike {
  getAdapter(modelId: string): PublicStoryboardAdapter | null;
  list(): PublicStoryboardAdapter[];
}

export const storyboardAdapterRegistry: StoryboardAdapterRegistryLike = {
  getAdapter(modelId: string) {
    const trimmed = modelId.trim().toLowerCase();
    const exact = PUBLIC_STORYBOARD_ADAPTERS.find(adapter => adapter.modelId === trimmed);
    if (exact) return exact;
    if (trimmed === 'seedance' || isSeedanceModelSelection(trimmed)) return PUBLIC_SEEDANCE_ADAPTER;
    if (resolveRegisteredImageReferenceModelId(trimmed) === 'gpt-image-2') {
      return PUBLIC_GPT_IMAGE_2_ADAPTER;
    }
    const videoFamily = resolveRegisteredVideoModelFamily(trimmed);
    if (videoFamily === 'ltx25') return PUBLIC_LTX25_ADAPTER;
    if (videoFamily === 'ltx23' || videoFamily === 'ltx2') return PUBLIC_LTX23_ADAPTER;
    if (videoFamily === 'wan22') return PUBLIC_WAN_ADAPTER;
    return null;
  },
  list() {
    return [...PUBLIC_STORYBOARD_ADAPTERS];
  },
};

export function compileForModel(
  modelId: string,
  storyboard: StoryboardProject,
  input: PublicStoryboardAdapterCompileInput,
): PublicStoryboardAdapterCompileResult {
  const adapter = storyboardAdapterRegistry.getAdapter(modelId);
  if (!adapter) throw new Error(`No storyboard adapter registered for model_id "${modelId}".`);
  return adapter.compile(storyboard, input);
}

const PUBLIC_SEEDANCE_PRIMARY_IMAGE_REF = formatModelRef('seedance', 1, 'image');

export const SEEDANCE_STORYBOARD_REFERENCE_PROMPT =
  `Create a full-screen cinematic video from the storyboard in ${PUBLIC_SEEDANCE_PRIMARY_IMAGE_REF}. Treat ${PUBLIC_SEEDANCE_PRIMARY_IMAGE_REF} as the controlling source for shot order and intent, and as a source layout reference: use the thumbnails, timing, Dialogue/VO, Audio/SFX, timecodes, camera/motion notes, transitions, and scene order as instructions, not as a visual board to reproduce. Do not display the storyboard grid, borders, caption bars, storyboard title/footer text, panel numbers, section labels, slide titles, headings, or transcribed narration. Convert the ordered thumbnails into full-screen chronological beats; do not reuse only one or two motifs while skipping panels. When the board has panel titles, captions, section numbers, slide titles, or headings but no formal Dialogue/VO labels, treat those labels as short audio-only narration/voiceover or key-message beats in order unless they are clearly visual-only metadata. Voice each label as its own brief phrase with a pause; do not concatenate labels into run-on sentences and do not speak panel numbers. Show storyboard labels as visible text only when the user explicitly asks for visible text, subtitles, a title card, lower third, signage, or a title/end frame. Preserve the story spine, character/product/reference continuity, and cause-and-effect progression between beats. Treat transitions as motion instructions, not unrelated hard cuts unless the storyboard explicitly asks for hard cuts. Use brand color, lighting, product imagery, and composition instead of invented typography. Keep visible text limited to exact copy the user or storyboard explicitly marks as on-screen text, signage, title text, or end-frame text. Use a music/SFX arc that follows the storyboard audio notes and lands the final beat. Keep unrelated UI, extra logos, microtext, subtitles, and extra scenes out of the frame.`;

export const SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS = 15;

export type ReferenceAudioFormat = 'mp3' | 'm4a' | 'wav' | 'ogg' | 'unknown';

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
  if (normalizedMimeType === 'audio/wav' || normalizedMimeType === 'audio/x-wav') {
    return 'wav';
  }
  if (normalizedMimeType === 'audio/ogg' || normalizedMimeType === 'application/ogg') {
    return 'ogg';
  }
  if (data.length >= 3 && asciiAt(data, 0, 3) === 'ID3') return 'mp3';
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return 'mp3';
  if (data.length >= 12 && asciiAt(data, 4, 4) === 'ftyp') return 'm4a';
  if (data.length >= 12 && asciiAt(data, 0, 4) === 'RIFF' && asciiAt(data, 8, 4) === 'WAVE') return 'wav';
  if (data.length >= 4 && asciiAt(data, 0, 4) === 'OggS') return 'ogg';
  return 'unknown';
}

function finiteNonNegativeMediaValue(value: number | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function shouldTrimSeedanceV2VSourceVideo({
  sourceDurationSeconds,
  requestedDurationSeconds,
  startOffsetSeconds = 0,
  maxDurationSeconds = SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS,
}: {
  sourceDurationSeconds?: number | null;
  requestedDurationSeconds?: number | null;
  startOffsetSeconds?: number | null;
  maxDurationSeconds?: number;
}): boolean {
  const maxDuration = finiteNonNegativeMediaValue(maxDurationSeconds, SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS)
    || SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS;
  const sourceDuration = finiteNonNegativeMediaValue(sourceDurationSeconds, Number.NaN);
  const requestedDuration = finiteNonNegativeMediaValue(requestedDurationSeconds, maxDuration);
  const startOffset = finiteNonNegativeMediaValue(startOffsetSeconds, 0);
  if (startOffset > 0) return true;
  const effectiveDuration = Math.min(requestedDuration || maxDuration, maxDuration);
  return Number.isFinite(sourceDuration) && sourceDuration > effectiveDuration + 0.15;
}

export const GPT_IMAGE_STORYBOARD_DEFAULTS = {
  storyboardLandscape: { width: 2560, height: 1440, aspectRatio: '2560x1440' },
  storyboardPortrait: { width: 1440, height: 2560, aspectRatio: '1440x2560' },
} as const;

export const DEFAULT_STORYBOARD_CANVAS_HINT_MARKER = 'DEFAULT STORYBOARD PAGE LAYOUT:';

export const LTX23_WORKFLOW_MODELS = Object.freeze({
  t2v: 'ltx23-22b-fp8_t2v_distilled',
  i2v: 'ltx23-22b-fp8_i2v_distilled',
  ia2v: 'ltx23-22b-fp8_ia2v_distilled',
  a2v: 'ltx23-22b-fp8_a2v_distilled',
  v2v: 'ltx23-22b-fp8_v2v_distilled'
} satisfies Record<LtxWorkflow, string>);

export const LTX23_EROS_MODEL_ID = 'ltx23-22b-10eros-v1.4-fp8mixed_i2v';

export const LTX23_DEV_WORKFLOW_MODELS = Object.freeze({
  t2v: 'ltx23-22b-fp8_t2v_dev',
  i2v: 'ltx23-22b-fp8_i2v_dev',
  ia2v: 'ltx23-22b-fp8_ia2v_dev',
  a2v: 'ltx23-22b-fp8_a2v_dev'
} satisfies Record<Exclude<LtxWorkflow, 'v2v'>, string>);

export const LTX25_WORKFLOW_MODELS = Object.freeze({
  t2v: 'ltx25-22b-int8_t2v_distilled',
  i2v: 'ltx25-22b-int8_i2v_distilled',
  ia2v: 'ltx25-22b-int8_ia2v_distilled',
  a2v: 'ltx25-22b-int8_a2v_distilled',
  v2v: 'ltx25-22b-int8_v2v_distilled'
} satisfies Record<Ltx25Workflow, string>);

export const LTX25_DEV_WORKFLOW_MODELS = Object.freeze({
  t2v: 'ltx25-22b-int8_t2v_dev',
  i2v: 'ltx25-22b-int8_i2v_dev',
  ia2v: 'ltx25-22b-int8_ia2v_dev',
  a2v: 'ltx25-22b-int8_a2v_dev',
  v2v: 'ltx25-22b-int8_v2v_dev'
} satisfies Record<Ltx25Workflow, string>);

export function resolveLtx25WorkflowModelForQuality(
  workflow: Ltx25Workflow,
  _qualityTier: string | null | undefined,
): string {
  // Dev stays addressable by its exact internal model ID, but public quality
  // tiers must use the upstream-supported and release-validated Distilled path.
  return LTX25_WORKFLOW_MODELS[workflow];
}

export function resolveLtx23WorkflowModelForQuality(
  workflow: LtxWorkflow,
  qualityTier: string | null | undefined,
): string {
  if (qualityTier === 'pro' && workflow !== 'v2v') {
    return LTX23_DEV_WORKFLOW_MODELS[workflow];
  }
  return LTX23_WORKFLOW_MODELS[workflow];
}

export const SEEDANCE_WORKFLOW_MODELS = Object.freeze({
  t2v: SEEDANCE_VIDEO_MODEL_IDS.standard,
  t2vMini: SEEDANCE_VIDEO_MODEL_IDS.mini,
  ia2v: SEEDANCE_VIDEO_MODEL_IDS.standard,
  v2v: SEEDANCE_VIDEO_MODEL_IDS.standard,
  // Seedance 2.5 is a single canonical model id across every workflow it
  // supports (t2v, i2v, flf2v, r2v, ia2v, v2v), like the 2.0 family.
  t2v25: SEEDANCE_VIDEO_MODEL_IDS.v25
});

// Alibaba HappyHorse 1.1 — three discrete vendor models (no mini variant).
// Unlike Seedance, the per-mode model id IS the canonical socket/Alibaba id, so
// the map values double as the values accepted by the generate_video tool.
export const HAPPYHORSE_WORKFLOW_MODELS = Object.freeze({
  t2v: 'happyhorse-1.1-t2v',
  i2v: 'happyhorse-1.1-i2v',
  r2v: 'happyhorse-1.1-r2v'
});

// Wan 3 is one canonical Alibaba model whose media shape selects every mode.
export const WAN3_WORKFLOW_MODEL = 'wan3.0-video';
export const WAN3_ENHANCED_WORKFLOW_MODEL = 'wan3.0-spicy-video';

export const VIDEO_MODEL_REGISTRY = Object.freeze({
  [LTX23_WORKFLOW_MODELS.t2v]: {
    workflow: 't2v',
    family: 'ltx23',
    defaultWidth: 1920,
    defaultHeight: 1088,
    minDimension: 640,
    maxDimension: 2048,
    dimensionMultiple: 64,
    steps: 8,
    guidance: 1.0,
    fps: 24,
    frameStep: 8,
    minFrames: 25,
    maxFrames: 505,
    sampler: 'euler_ancestral',
    scheduler: 'simple',
    supportsNativeAudio: true
  },
  [LTX23_WORKFLOW_MODELS.i2v]: {
    workflow: 'i2v',
    family: 'ltx23',
    defaultWidth: 1920,
    defaultHeight: 1088,
    minDimension: 640,
    maxDimension: 2048,
    dimensionMultiple: 64,
    steps: 8,
    guidance: 1.0,
    fps: 24,
    frameStep: 8,
    minFrames: 25,
    maxFrames: 505,
    sampler: 'euler_ancestral',
    scheduler: 'simple',
    supportsNativeAudio: true
  },
  [LTX23_EROS_MODEL_ID]: {
    workflow: 'i2v',
    family: 'ltx23',
    defaultWidth: 1920,
    defaultHeight: 1088,
    minDimension: 640,
    maxDimension: 2048,
    dimensionMultiple: 64,
    steps: 9,
    guidance: 1.0,
    fps: 24,
    frameStep: 8,
    minFrames: 25,
    maxFrames: 505,
    sampler: 'euler_ancestral',
    scheduler: 'manual_sigmas',
    supportsNativeAudio: true,
    minVramGB: 30,
    requiresDisabledSafetyFilter: true
  },
  [LTX23_WORKFLOW_MODELS.ia2v]: {
    workflow: 'ia2v',
    family: 'ltx23',
    defaultWidth: 1920,
    defaultHeight: 1088,
    minDimension: 640,
    maxDimension: 2048,
    dimensionMultiple: 64,
    steps: 8,
    guidance: 1.0,
    fps: 24,
    frameStep: 8,
    minFrames: 25,
    maxFrames: 505,
    sampler: 'euler_ancestral',
    scheduler: 'simple'
  },
  [LTX23_WORKFLOW_MODELS.a2v]: {
    workflow: 'a2v',
    family: 'ltx23',
    defaultWidth: 1920,
    defaultHeight: 1088,
    minDimension: 640,
    maxDimension: 2048,
    dimensionMultiple: 64,
    steps: 8,
    guidance: 1.0,
    fps: 24,
    frameStep: 8,
    minFrames: 25,
    maxFrames: 505,
    sampler: 'euler_ancestral',
    scheduler: 'simple'
  },
  [LTX23_WORKFLOW_MODELS.v2v]: {
    workflow: 'v2v',
    family: 'ltx23',
    defaultWidth: 1920,
    defaultHeight: 1088,
    minDimension: 640,
    maxDimension: 2048,
    dimensionMultiple: 64,
    steps: 8,
    guidance: 1.0,
    fps: 25,
    frameStep: 8,
    minFrames: 25,
    maxFrames: 505,
    sampler: 'euler_ancestral',
    scheduler: 'simple'
  },
  'wan_v2.2-14b-fp8_t2v_lightx2v': {
    workflow: 't2v',
    family: 'wan22',
    defaultWidth: 640,
    defaultHeight: 640,
    minDimension: 480,
    maxDimension: 1536,
    dimensionMultiple: 16,
    steps: 4,
    guidance: 1.0,
    fps: 32,
    internalFps: 16,
    frameStep: 1,
    minFrames: 17,
    maxFrames: 161,
    sampler: 'euler',
    scheduler: 'simple',
    shift: 5.0
  },
  'wan_v2.2-14b-fp8_i2v_lightx2v': {
    workflow: 'i2v',
    family: 'wan22',
    defaultWidth: 832,
    defaultHeight: 480,
    minDimension: 480,
    maxDimension: 1536,
    dimensionMultiple: 16,
    steps: 4,
    guidance: 1.0,
    fps: 32,
    internalFps: 16,
    frameStep: 1,
    minFrames: 17,
    maxFrames: 321,
    sampler: 'euler',
    scheduler: 'simple',
    shift: 8.0
  },
  'wan_v2.2-14b-fp8_s2v_lightx2v': {
    workflow: 's2v',
    family: 'wan22',
    defaultWidth: 832,
    defaultHeight: 480,
    minDimension: 480,
    maxDimension: 1536,
    dimensionMultiple: 16,
    steps: 4,
    guidance: 1.0,
    fps: 32,
    internalFps: 16,
    frameStep: 1,
    minFrames: 17,
    maxFrames: 321,
    sampler: 'uni_pc',
    scheduler: 'simple',
    shift: 8.0
  },
  'wan_v2.2-14b-fp8_animate-move_lightx2v': {
    workflow: 'animate-move',
    family: 'wan22',
    defaultWidth: 832,
    defaultHeight: 480,
    minDimension: 480,
    maxDimension: 1536,
    dimensionMultiple: 16,
    steps: 4,
    guidance: 1.0,
    fps: 32,
    internalFps: 16,
    frameStep: 1,
    minFrames: 17,
    maxFrames: 321,
    sampler: 'euler',
    scheduler: 'simple',
    shift: 8.0
  },
  'wan_v2.2-14b-fp8_animate-replace_lightx2v': {
    workflow: 'animate-replace',
    family: 'wan22',
    defaultWidth: 832,
    defaultHeight: 480,
    minDimension: 480,
    maxDimension: 1536,
    dimensionMultiple: 16,
    steps: 4,
    guidance: 1.0,
    fps: 32,
    internalFps: 16,
    frameStep: 1,
    minFrames: 17,
    maxFrames: 321,
    sampler: 'euler',
    scheduler: 'simple',
    shift: 8.0
  },
  [SEEDANCE_WORKFLOW_MODELS.t2v]: {
    workflow: 't2v',
    family: 'seedance2',
    defaultWidth: 1920,
    defaultHeight: 1088,
    minDimension: 1,
    maxDimension: 99999,
    dimensionMultiple: 1,
    fps: 24,
    frameStep: 1,
    minFrames: 97,
    maxFrames: 361,
    supportsNativeAudio: true
  },
  // Seedance 2.5: 480p/720p only like Mini, but 4-30s instead of 4-15s,
  // so maxFrames is 30 * 24 + 1 rather than 15 * 24 + 1.
  [SEEDANCE_WORKFLOW_MODELS.t2v25]: {
    workflow: 't2v',
    family: 'seedance2',
    defaultWidth: 1280,
    defaultHeight: 720,
    minDimension: 1,
    maxDimension: 1280,
    dimensionMultiple: 1,
    fps: 24,
    frameStep: 1,
    minFrames: 97,
    maxFrames: 721,
    supportsNativeAudio: true
  },
  [WAN3_WORKFLOW_MODEL]: {
    workflow: 't2v',
    family: 'wan3',
    defaultWidth: 1920,
    defaultHeight: 1080,
    minDimension: 480,
    maxDimension: 1920,
    dimensionMultiple: 1,
    fps: 30,
    frameStep: 1,
    minFrames: 61,
    maxFrames: 901,
    supportsNativeAudio: true
  },
  [WAN3_ENHANCED_WORKFLOW_MODEL]: {
    workflow: 't2v',
    family: 'wan3',
    defaultWidth: 1920,
    defaultHeight: 1080,
    minDimension: 480,
    maxDimension: 1920,
    dimensionMultiple: 1,
    fps: 30,
    frameStep: 1,
    minFrames: 61,
    maxFrames: 901,
    supportsNativeAudio: true
  }
} satisfies Record<string, SkillVideoModelConfig>);

export const EXPANDED_VIDEO_MODEL_REGISTRY = (() => {
  const registry: Record<string, SkillVideoModelConfig> = { ...VIDEO_MODEL_REGISTRY };
  for (const workflow of ['t2v', 'i2v', 'ia2v', 'a2v', 'v2v'] as const) {
    const base = registry[LTX23_WORKFLOW_MODELS[workflow]];
    if (!base) continue;
    const ltx25Base = {
      ...base,
      family: 'ltx25' as const,
      maxDimension: 3840,
      fps: 24,
      sampler: 'euler_ancestral',
      scheduler: 'manual_sigmas',
      supportsNativeAudio: true
    };
    registry[LTX25_WORKFLOW_MODELS[workflow]] = {
      ...ltx25Base,
      steps: 8,
      guidance: 1.0
    };
    registry[LTX25_DEV_WORKFLOW_MODELS[workflow]] = {
      ...ltx25Base,
      steps: 30,
      guidance: 3.0
    };
  }
  for (const workflow of ['t2v', 'i2v', 'ia2v', 'a2v'] as const) {
    const base = registry[LTX23_WORKFLOW_MODELS[workflow]];
    if (!base) continue;
    registry[LTX23_DEV_WORKFLOW_MODELS[workflow]] = {
      ...base,
      steps: 20
    };
  }
  for (const workflow of ['t2v', 'i2v', 'ia2v', 'a2v', 'v2v'] as const) {
    const ltx2Distilled = 'ltx2-19b-fp8_' + workflow + '_distilled';
    const ltx2Quality = 'ltx2-19b-fp8_' + workflow;
    const base = registry[LTX23_WORKFLOW_MODELS[workflow]];
    if (!base) continue;
    registry[ltx2Distilled] = {
      ...base,
      family: 'ltx2',
      defaultWidth: 768,
      defaultHeight: 768,
      minDimension: 480,
      maxDimension: 1536,
      steps: 8,
      supportsNativeAudio: workflow === 't2v' || workflow === 'i2v'
    };
    registry[ltx2Quality] = {
      ...registry[ltx2Distilled],
      steps: 20
    };
  }
  registry['wan_v2.2-14b-fp8_t2v'] = {
    ...registry['wan_v2.2-14b-fp8_t2v_lightx2v'],
    steps: 20
  };
  registry['wan_v2.2-14b-fp8_i2v'] = {
    ...registry['wan_v2.2-14b-fp8_i2v_lightx2v'],
    steps: 20
  };
  return Object.freeze(registry);
})();

export const VIDEO_WORKFLOW_DEFAULT_MODELS = Object.freeze({
  t2v: LTX25_WORKFLOW_MODELS.t2v,
  i2v: LTX25_WORKFLOW_MODELS.i2v,
  s2v: 'wan_v2.2-14b-fp8_s2v_lightx2v',
  ia2v: LTX25_WORKFLOW_MODELS.ia2v,
  a2v: LTX25_WORKFLOW_MODELS.a2v,
  'animate-move': 'wan_v2.2-14b-fp8_animate-move_lightx2v',
  'animate-replace': 'wan_v2.2-14b-fp8_animate-replace_lightx2v',
  v2v: LTX25_WORKFLOW_MODELS.v2v
} satisfies Record<SkillVideoWorkflow, string>);

export const VIDEO_MODEL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ltx25: LTX25_WORKFLOW_MODELS.t2v,
  'ltx25-t2v': LTX25_WORKFLOW_MODELS.t2v,
  'ltx25-i2v': LTX25_WORKFLOW_MODELS.i2v,
  'ltx25-ia2v': LTX25_WORKFLOW_MODELS.ia2v,
  'ltx25-a2v': LTX25_WORKFLOW_MODELS.a2v,
  'ltx25-v2v': LTX25_WORKFLOW_MODELS.v2v,
  ltx23: LTX23_WORKFLOW_MODELS.t2v,
  'ltx23-t2v': LTX23_WORKFLOW_MODELS.t2v,
  'ltx23-i2v': LTX23_WORKFLOW_MODELS.i2v,
  'ltx23-ia2v': LTX23_WORKFLOW_MODELS.ia2v,
  'ltx23-a2v': LTX23_WORKFLOW_MODELS.a2v,
  'ltx23-v2v': LTX23_WORKFLOW_MODELS.v2v,
  'ltx23-eros': LTX23_EROS_MODEL_ID,
  '10eros': LTX23_EROS_MODEL_ID,
  wan22: 'wan_v2.2-14b-fp8_t2v_lightx2v',
  'wan22-t2v': 'wan_v2.2-14b-fp8_t2v_lightx2v',
  'wan22-i2v': 'wan_v2.2-14b-fp8_i2v_lightx2v',
  'wan22-s2v': 'wan_v2.2-14b-fp8_s2v_lightx2v',
  'wan22-animate-move': 'wan_v2.2-14b-fp8_animate-move_lightx2v',
  'wan22-animate-replace': 'wan_v2.2-14b-fp8_animate-replace_lightx2v',
  seedance2: SEEDANCE_WORKFLOW_MODELS.t2v,
  'seedance2-t2v': SEEDANCE_WORKFLOW_MODELS.t2v,
  'seedance2-mini': SEEDANCE_WORKFLOW_MODELS.t2vMini,
  'seedance2-mini-t2v': SEEDANCE_WORKFLOW_MODELS.t2vMini,
  // legacy alias: Seedance 2.0 Fast was retired 2026-08; Mini replaced it
  'seedance2-fast': SEEDANCE_WORKFLOW_MODELS.t2vMini,
  'seedance2-fast-t2v': SEEDANCE_WORKFLOW_MODELS.t2vMini,
  'seedance-2-0-fast': SEEDANCE_WORKFLOW_MODELS.t2vMini,
  'seedance2-ia2v': SEEDANCE_WORKFLOW_MODELS.ia2v,
  'seedance2-v2v': SEEDANCE_WORKFLOW_MODELS.v2v,
  'seedance2-5': SEEDANCE_WORKFLOW_MODELS.t2v25,
  'seedance2-5-t2v': SEEDANCE_WORKFLOW_MODELS.t2v25,
  'seedance2-5-ia2v': SEEDANCE_WORKFLOW_MODELS.t2v25,
  'seedance2-5-v2v': SEEDANCE_WORKFLOW_MODELS.t2v25,
  wan3: WAN3_WORKFLOW_MODEL,
  'wan3.0': WAN3_WORKFLOW_MODEL,
  'wan3-video': WAN3_WORKFLOW_MODEL,
  'wan3.0-video': WAN3_WORKFLOW_MODEL,
  'wan3-enhanced': WAN3_ENHANCED_WORKFLOW_MODEL,
  'wan3.0-enhanced': WAN3_ENHANCED_WORKFLOW_MODEL,
  'wan3-spicy': WAN3_ENHANCED_WORKFLOW_MODEL,
  'wan3.0-spicy': WAN3_ENHANCED_WORKFLOW_MODEL,
  'wan3.0-spicy-video': WAN3_ENHANCED_WORKFLOW_MODEL
} satisfies Record<string, string>);

export const QUALITY_TIERS = Object.freeze({
  fast: {
    model: 'z_image_turbo_bf16',
    steps: 8,
    shortSide: null,
    video: { steps: 8, shortSide: null }
  },
  hq: {
    model: 'z_image_turbo_bf16',
    steps: null,
    shortSide: 768,
    video: { steps: 8, shortSide: 1088 }
  },
  pro: {
    model: 'qwen_image_2512_fp8',
    steps: 20,
    shortSide: 1024,
    video: { steps: 20, shortSide: 1920 }
  }
} satisfies Record<'fast' | 'hq' | 'pro', SkillQualityTier>);

export const IMAGE_MODEL_DEFAULTS: Readonly<Record<string, SkillModelDefaults>> = Object.freeze({
  krea2_identity_edit_v1_2: {
    family: 'krea2-identity-edit',
    defaultWidth: 1024,
    defaultHeight: 1024,
    minDimension: 512,
    maxDimension: 2048,
    dimensionMultiple: 16,
    steps: 10,
    guidance: 1.0,
    sampler: 'euler',
    scheduler: 'simple'
  },
  dark_beast_krea2_identity_edit_v1_2: {
    family: 'krea2-identity-edit',
    defaultWidth: 1024,
    defaultHeight: 1024,
    minDimension: 512,
    maxDimension: 2048,
    dimensionMultiple: 16,
    steps: 10,
    guidance: 1.0,
    sampler: 'euler',
    scheduler: 'simple'
  }
});

export const IMAGE_MODEL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'krea-identity-edit': 'krea2_identity_edit_v1_2',
  'krea-2-identity-edit': 'krea2_identity_edit_v1_2',
  'krea2-identity-edit': 'krea2_identity_edit_v1_2',
  'krea2-identity-edit-v1-2': 'krea2_identity_edit_v1_2',
  'krea-2-identity-edit-v1-2': 'krea2_identity_edit_v1_2',
  'krea-2-identity-edit-lora': 'krea2_identity_edit_v1_2',
  'krea-2-identity-edit-lora-v1-2': 'krea2_identity_edit_v1_2',
  'dark-beast-krea2-identity-edit': 'dark_beast_krea2_identity_edit_v1_2',
  'dark-beast-krea-2-identity-edit': 'dark_beast_krea2_identity_edit_v1_2',
  'dark-beast-krea2-identity-edit-v1-2': 'dark_beast_krea2_identity_edit_v1_2',
  'dark-beast-krea-2-identity-edit-v1-2': 'dark_beast_krea2_identity_edit_v1_2',
  'dark-beast-krea-2-identity-edit-lora': 'dark_beast_krea2_identity_edit_v1_2',
  'dark-beast-krea-2-identity-edit-lora-v1-2': 'dark_beast_krea2_identity_edit_v1_2'
});

export function isLtx2Model(modelId: string | null | undefined): boolean {
  const family = resolveRegisteredVideoModelFamily(modelId);
  return family === 'ltx2' || family === 'ltx23' || family === 'ltx25';
}

export function isWanModel(modelId: string | null | undefined): boolean {
  return resolveRegisteredVideoModelFamily(modelId) === 'wan22';
}

export function isSeedanceModel(modelId: string | null | undefined): boolean {
  return isSeedanceVideoModelId(modelId);
}

export function isHappyHorseModel(modelId: string | null | undefined): boolean {
  return resolveRegisteredVideoModelFamily(modelId) === 'happyhorse-1.1';
}

export function isWan3Model(modelId: string | null | undefined): boolean {
  return resolveRegisteredVideoModelFamily(modelId) === 'wan3';
}

export function resolveVideoControlNetStrength(
  name: string | null | undefined,
  explicitStrength: number | null | undefined,
): number {
  if (explicitStrength !== null && explicitStrength !== undefined) return explicitStrength;
  return name === 'detailer' ? 1.0 : 0.85;
}

export function resolveVideoModelAlias(
  modelId: string | null | undefined,
  workflow?: SkillVideoWorkflow | null,
): string | null | undefined {
  if (!modelId) return modelId;
  const key = String(modelId).trim().toLowerCase();
  if (key === 'ltx25') {
    if (workflow && isLtxWorkflow(workflow)) {
      return LTX25_WORKFLOW_MODELS[workflow];
    }
  }
  if (key === 'ltx23' && isLtxWorkflow(workflow)) {
    return LTX23_WORKFLOW_MODELS[workflow];
  }
  if (key === 'wan22' && workflow) {
    return VIDEO_WORKFLOW_DEFAULT_MODELS[workflow] || VIDEO_MODEL_ALIASES.wan22;
  }
  if (
    key === 'seedance2' &&
    (workflow === 't2v' || workflow === 'ia2v' || workflow === 'v2v')
  ) {
    return SEEDANCE_WORKFLOW_MODELS[workflow];
  }
  return VIDEO_MODEL_ALIASES[key] || modelId;
}

export function resolveImageModelAlias(modelId: string | null | undefined): string | null | undefined {
  if (!modelId) return modelId;
  const key = String(modelId).trim().toLowerCase();
  if (IMAGE_MODEL_DEFAULTS[key]) return key;
  const aliasKey = key.replace(/[_.\s]+/g, '-').replace(/-+/g, '-');
  return IMAGE_MODEL_ALIASES[key] || IMAGE_MODEL_ALIASES[aliasKey] || modelId;
}

export function getBuiltinVideoModelConfig(
  modelId: string | null | undefined,
): SkillVideoModelConfig | null {
  if (!modelId) return null;
  const id = resolveVideoModelAlias(modelId);
  if (!id) return null;
  return EXPANDED_VIDEO_MODEL_REGISTRY[id] || null;
}

export function getBuiltinImageModelDefaults(
  modelId: string | null | undefined,
): SkillModelDefaults | null {
  if (!modelId) return null;
  const id = resolveImageModelAlias(modelId);
  if (!id) return null;
  return IMAGE_MODEL_DEFAULTS[id] || null;
}

export function normalizeVideoWorkflow(value: string | null | undefined): SkillVideoWorkflow | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 't2v' || normalized === 'text-to-video') return 't2v';
  if (normalized === 'i2v' || normalized === 'image-to-video') return 'i2v';
  if (normalized === 's2v' || normalized === 'sound-to-video') return 's2v';
  if (normalized === 'ia2v' || normalized === 'image-audio-to-video' || normalized === 'image+audio-to-video') return 'ia2v';
  if (normalized === 'a2v' || normalized === 'audio-to-video') return 'a2v';
  if (normalized === 'animate-move' || normalized === 'animate_move') return 'animate-move';
  if (normalized === 'animate-replace' || normalized === 'animate_replace') return 'animate-replace';
  if (normalized === 'v2v' || normalized === 'video-to-video') return 'v2v';
  return null;
}

export function inferVideoWorkflowFromModel(modelId: string | null | undefined): SkillVideoWorkflow | null {
  if (!modelId) return null;
  const resolvedModelId = resolveVideoModelAlias(modelId);
  if (!resolvedModelId) return null;
  if (!resolveRegisteredVideoModelFamily(resolvedModelId)) return null;
  const id = resolvedModelId.toLowerCase();
  if (id.includes('animate-move')) return 'animate-move';
  if (id.includes('animate-replace')) return 'animate-replace';
  if (id.includes('_v2v')) return 'v2v';
  if (id.includes('_ia2v')) return 'ia2v';
  if (id.includes('_a2v')) return 'a2v';
  if (id.includes('_t2v') || id.includes('-t2v')) return 't2v';
  if (id.includes('_i2v') || id.includes('-i2v')) return 'i2v';
  if (id.includes('_s2v') || id.includes('-s2v')) return 's2v';
  return null;
}

export function promptExplicitlyDisablesSpeech(prompt: string | null | undefined): boolean {
  return /\b(no dialogue|no speech|without dialogue|without speech|silent|no voiceover|no voice-over)\b/i.test(prompt || '');
}

export function containsQuotedDialogue(prompt: string | null | undefined): boolean {
  return extractQuotedDialogueSegments(prompt).length > 0;
}

export function promptMentionsSpeech(prompt: string | null | undefined): boolean {
  if (!prompt || promptExplicitlyDisablesSpeech(prompt)) return false;
  return /\b(dialogue|speaks?|speaking|says?|said|asks?|asked|whispers?|shouts?|yells?|narrates?|narration|voiceover|voice-over|conversation|monologue|interview|talking|tells? (?:a )?story)\b/i.test(prompt);
}

export function promptMentionsAudio(prompt: string | null | undefined): boolean {
  if (!prompt) return false;
  return /\b(audio|sound|sounds|ambient sound|music|song|singing|sings|voice|voices|dialogue|speech|voiceover|voice-over|narration|foley)\b/i.test(prompt);
}

export function promptLooksLikeLongFormStory(prompt: string | null | undefined): boolean {
  return /\b(story|screenplay|script|scene|episode|short film|commercial|storyboard|chapter|narrative)\b/i.test(prompt || '');
}

export function promptLooksLikeLipSync(prompt: string | null | undefined): boolean {
  return /\b(lip[- ]?sync|lipsync|talking head|mouth movement|sync(?:hronize)? (?:the )?(?:lips|mouth|speech)|face speaks|sing along)\b/i.test(prompt || '');
}

export function promptNeedsLtxNativeAudio(prompt: string | null | undefined): boolean {
  return !promptExplicitlyDisablesSpeech(prompt) && (
    containsQuotedDialogue(prompt) ||
    promptMentionsSpeech(prompt) ||
    promptMentionsAudio(prompt) ||
    promptLooksLikeLongFormStory(prompt)
  );
}

export function normalizeScreenplayDialogueQuotes(prompt: string): string;
export function normalizeScreenplayDialogueQuotes(prompt: null | undefined): null | undefined;
export function normalizeScreenplayDialogueQuotes(
  prompt: string | null | undefined,
): string | null | undefined {
  if (!prompt) return prompt;
  return prompt
    .replace(/^(\s*[A-Za-z][A-Za-z0-9 _.-]{0,48}:\s*)'([^'\n]{1,300})'/gm, '$1"$2"')
    .replace(/([\s(])'([^'\n]{1,180})'(?=[\s).,!?:;]|$)/g, '$1"$2"');
}

export function extractQuotedDialogueSegments(prompt: string | null | undefined): string[] {
  const matches: string[] = [];
  const taggedPattern = /<d>\s*(?:\[[^\]\r\n]{1,40}\]\s*)?([\s\S]{1,800}?)\s*<\/d>/gi;
  const untaggedPrompt = String(prompt || '').replace(taggedPattern, (_block, dialogue: string) => {
    matches.push(dialogue.trim());
    return ' ';
  });
  const quotePatterns = [
    /"([^"\r\n]{1,800})"/g,
    /“([^”\r\n]{1,800})”/g,
    /‘([^’\r\n]{1,800})’/g,
    /«([^»\r\n]{1,800})»/g,
    /「([^」\r\n]{1,800})」/g,
    /『([^』\r\n]{1,800})』/g,
  ];
  for (const pattern of quotePatterns) {
    let match;
    while ((match = pattern.exec(untaggedPrompt)) !== null) {
      matches.push(match[1]);
    }
  }
  return matches;
}

export function countWords(text: string | null | undefined): number {
  const words = String(text || '').trim().match(/\b[\w'-]+\b/g);
  return words ? words.length : 0;
}

export function quotedDialogueWordCount(prompt: string | null | undefined): number {
  return extractQuotedDialogueSegments(prompt).reduce((sum, segment) => sum + countWords(segment), 0);
}

export function suggestedDurationForDialogue(
  prompt: string | null | undefined,
  currentDuration: number | undefined,
): number {
  const words = quotedDialogueWordCount(prompt);
  const baseDuration = currentDuration ?? 0;
  if (words <= 0) return baseDuration;
  const speechSeconds = Math.ceil(words / 3) + 2;
  return Math.max(baseDuration, Math.min(20, speechSeconds));
}

export function formatAudioIdPrompt(prompt: string, voiceName?: string | null): string;
export function formatAudioIdPrompt(
  prompt: null | undefined,
  voiceName?: string | null,
): null | undefined;
export function formatAudioIdPrompt(
  prompt: string | null | undefined,
  voiceName?: string | null,
): string | null | undefined {
  if (!prompt) return prompt;
  if (/\[VISUAL\]|\[SPEECH\]|\[SOUNDS\]/i.test(prompt)) return prompt;
  const dialogue = extractQuotedDialogueSegments(prompt);
  const speechLines = dialogue.length > 0
    ? dialogue.map((line, index) => (voiceName || 'SPEAKER_' + (index + 1)) + ': "' + line + '"').join('\n')
    : '';
  const sections = [
    '[VISUAL]',
    prompt.trim(),
    '',
    '[SPEECH]',
  ];
  if (speechLines) {
    sections.push(speechLines);
  }
  sections.push(
    '',
    '[SOUNDS]',
    'Use natural ambient sound that matches the scene unless the prompt specifies silence.',
  );
  return sections.join('\n');
}

export function getVideoPromptGuardrailPlan({
  prompt,
  duration,
  frames,
  fps,
  durationExplicit,
  referenceAudioIdentity,
  voiceName
}: VideoPromptGuardrailInput = {}): VideoPromptGuardrailPlan {
  let nextPrompt = prompt || '';
  let nextDuration = duration ?? 0;
  const warnings: VideoPromptGuardrailWarning[] = [];

  const normalizedPrompt = normalizeScreenplayDialogueQuotes(nextPrompt);
  if (normalizedPrompt !== nextPrompt) {
    nextPrompt = normalizedPrompt;
    warnings.push({
      type: 'normalized-dialogue-quotes',
      message: 'Normalized screenplay dialogue to double quotes for video prompting.'
    });
  }

  if (promptMentionsSpeech(nextPrompt) && !containsQuotedDialogue(nextPrompt)) {
    warnings.push({
      type: 'missing-quoted-dialogue',
      message: 'Warning: video prompt mentions speech/dialogue but has no exact spoken words in double quotes. LTX native audio works best with concrete quoted dialogue.'
    });
  }

  if (!frames && !durationExplicit) {
    const suggested = suggestedDurationForDialogue(nextPrompt, nextDuration);
    if (suggested > nextDuration) {
      warnings.push({
        type: 'duration-extended-for-dialogue',
        message: 'Auto-extended video duration from ' + nextDuration + 's to ' + suggested + 's to fit quoted dialogue.'
      });
      nextDuration = suggested;
    }
  } else {
    const dialogueWords = quotedDialogueWordCount(nextPrompt);
    const hardBudget = Math.floor((frames ? frames / (fps ?? 24) : nextDuration) * 3.75);
    if (dialogueWords > hardBudget) {
      warnings.push({
        type: 'dialogue-over-budget',
        message: 'Warning: quoted dialogue has about ' + dialogueWords + ' words, which may not fit in ' + (frames ? frames + ' frames' : nextDuration + 's') + '.'
      });
    }
  }

  if (referenceAudioIdentity) {
    nextPrompt = formatAudioIdPrompt(nextPrompt, voiceName || 'SPEAKER');
  }

  return {
    prompt: nextPrompt,
    duration: nextDuration,
    warnings
  };
}

export function inferVideoWorkflowFromAssets(
  opts: InferVideoWorkflowAssetsInput = {},
): SkillVideoWorkflow | null {
  if (opts.refVideo && opts.videoControlNetName) return 'v2v';
  if (opts.refVideo) return 'animate-move';
  if (opts.refAudio && !opts.refImage && !opts.refImageEnd) return 'a2v';
  if (opts.refAudio && opts.refImage) return promptLooksLikeLipSync(opts.prompt) ? 's2v' : 'ia2v';
  if (opts.refAudio) return 's2v';
  if (opts.refImage || opts.refImageEnd) return 'i2v';
  return null;
}

export function workflowRequiresImage(workflow: SkillVideoWorkflow | null | undefined): boolean {
  return workflow === 'i2v' || workflow === 's2v' || workflow === 'ia2v' || workflow === 'animate-move' || workflow === 'animate-replace';
}

export function getModelDefaults(
  modelId: string | null | undefined,
  config?: SkillRuntimeConfig | null,
): SkillModelDefaults | null {
  if (!modelId) return null;
  const normalizedModelId = resolveImageModelAlias(resolveVideoModelAlias(modelId) || modelId) || modelId;
  const builtin =
    getBuiltinVideoModelConfig(normalizedModelId) ||
    getBuiltinImageModelDefaults(normalizedModelId);
  const entry = config?.modelDefaults?.[normalizedModelId] || config?.modelDefaults?.[modelId];
  if (!entry || typeof entry !== 'object') return builtin;
  return { ...(builtin || {}), ...entry };
}

export function selectDefaultVideoModel(
  workflow: SkillVideoWorkflow | null | undefined,
  opts: {
    prompt?: string | null;
    quality?: string | null;
    referenceAudioIdentity?: unknown;
  } = {},
  config?: SkillRuntimeConfig | null,
): string | null {
  if (!workflow) return null;
  const configured = config?.videoModels?.[workflow];
  if (configured) return resolveVideoModelAlias(configured, workflow) || null;
  if (workflow === 'ia2v') return resolveLtx25WorkflowModelForQuality('ia2v', opts.quality);
  if (workflow === 'a2v') return resolveLtx25WorkflowModelForQuality('a2v', opts.quality);
  if (workflow === 'v2v') return resolveLtx25WorkflowModelForQuality('v2v', opts.quality);
  if (workflow === 't2v') return resolveLtx25WorkflowModelForQuality('t2v', opts.quality);
  if (workflow === 'i2v' && (opts.referenceAudioIdentity || promptNeedsLtxNativeAudio(opts.prompt) || opts.quality === 'hq' || opts.quality === 'pro')) {
    return resolveLtx25WorkflowModelForQuality('i2v', opts.quality);
  }
  return VIDEO_WORKFLOW_DEFAULT_MODELS[workflow] || null;
}

export function dimensionsWithShortSide(
  width: number,
  height: number,
  shortSide: number,
): { width: number; height: number } {
  const w = Number(width);
  const h = Number(height);
  const s = Number(shortSide);
  if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(s) || w <= 0 || h <= 0 || s <= 0) {
    return { width, height };
  }
  const currentShort = Math.min(w, h);
  const scale = s / currentShort;
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale)
  };
}

function textMentionsPortraitSocialFormat(text: string): boolean {
  return /\b(?:tiktok|tik\s*tok|reels?|shorts|story)\b/i.test(text);
}

function hasPortraitResolutionHint(text: string): boolean {
  return /\b(?:portrait|vertical)\b/i.test(text) || textMentionsPortraitSocialFormat(text);
}

function hasLandscapeResolutionHint(text: string): boolean {
  return /\b(landscape|horizontal|wide(?:screen)?|cinematic|youtube)\b/i.test(text);
}

function normalizeRequestedPixelDimension(value: number): number | null {
  return Number.isInteger(value) && value > 0 && value <= 10000 ? value : null;
}

function makeLandscapeOrPortraitDimensions(
  landscapeWidth: number,
  landscapeHeight: number,
  text: string,
): ExplicitPixelDimensions {
  return hasPortraitResolutionHint(text)
    ? { width: landscapeHeight, height: landscapeWidth }
    : { width: landscapeWidth, height: landscapeHeight };
}

export function inferNamedVideoResolutionShortSideFromText(text: string): number | null {
  const compact = text.replace(/,/g, '');
  if (/\b4\s*k\b|\buhd\b/i.test(compact)) return 2160;
  if (/\b8\s*k\b/i.test(compact)) return 4320;

  const namedResolution = compact.match(/\b(480|720|1080|1440|2160)\s*p\b/i);
  return namedResolution ? Number(namedResolution[1]) : null;
}

export function inferRequestedVideoResolutionShortSideFromText(text: string): number | null {
  const standardResolution = inferNamedVideoResolutionShortSideFromText(text);
  if (standardResolution) return standardResolution;

  const match = text.match(/\b([1-9]\d{2,3})\s*p\b/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 4320) return null;
  return parsed;
}

export function inferExplicitPixelDimensionsFromText(text: string): ExplicitPixelDimensions | null {
  const compact = text.replace(/,/g, '');
  const exactPair = compact.match(/\b(\d{1,5})\s*(x|by)\s*(\d{1,5})\s*(px|pixels?)?\b/i);
  if (exactPair) {
    const width = normalizeRequestedPixelDimension(Number(exactPair[1]));
    const height = normalizeRequestedPixelDimension(Number(exactPair[3]));
    const hasPixelUnit = Boolean(exactPair[4]);
    if (width && height && (hasPixelUnit || Math.max(width, height) >= 100)) {
      return { width, height };
    }
  }

  const widthThenHeight = compact.match(
    /\b(?:width|wide|w)\s*(?:is|=|:)?\s*(\d{1,5})\s*(?:px|pixels?)?\b[\s\S]{0,80}\b(?:height|tall|high|h)\s*(?:is|=|:)?\s*(\d{1,5})\s*(?:px|pixels?)?\b/i,
  );
  if (widthThenHeight) {
    const width = normalizeRequestedPixelDimension(Number(widthThenHeight[1]));
    const height = normalizeRequestedPixelDimension(Number(widthThenHeight[2]));
    if (width && height) return { width, height };
  }

  const heightThenWidth = compact.match(
    /\b(?:height|tall|high|h)\s*(?:is|=|:)?\s*(\d{1,5})\s*(?:px|pixels?)?\b[\s\S]{0,80}\b(?:width|wide|w)\s*(?:is|=|:)?\s*(\d{1,5})\s*(?:px|pixels?)?\b/i,
  );
  if (heightThenWidth) {
    const height = normalizeRequestedPixelDimension(Number(heightThenWidth[1]));
    const width = normalizeRequestedPixelDimension(Number(heightThenWidth[2]));
    if (width && height) return { width, height };
  }

  if (/\b4\s*k\b|\buhd\b/i.test(compact)) {
    return hasPortraitResolutionHint(compact) || hasLandscapeResolutionHint(compact)
      ? makeLandscapeOrPortraitDimensions(3840, 2160, compact)
      : null;
  }
  if (/\b8\s*k\b/i.test(compact)) {
    return hasPortraitResolutionHint(compact) || hasLandscapeResolutionHint(compact)
      ? makeLandscapeOrPortraitDimensions(7680, 4320, compact)
      : null;
  }

  const namedResolution = compact.match(/\b(480|720|1080|1440|2160)\s*p\b/i);
  if (namedResolution) {
    if (!hasPortraitResolutionHint(compact) && !hasLandscapeResolutionHint(compact)) {
      return null;
    }
    const shortSide = Number(namedResolution[1]);
    const landscapeByShortSide: Record<number, ExplicitPixelDimensions> = {
      480: { width: 854, height: 480 },
      720: { width: 1280, height: 720 },
      1080: { width: 1920, height: 1080 },
      1440: { width: 2560, height: 1440 },
      2160: { width: 3840, height: 2160 },
    };
    const dimensions = landscapeByShortSide[shortSide];
    if (dimensions) {
      return makeLandscapeOrPortraitDimensions(dimensions.width, dimensions.height, compact);
    }
  }

  return null;
}

function ratioMatchLooksLikeMediaTimecodeRange(text: string, match: RegExpMatchArray): boolean {
  const rawWidth = match[1] ?? '';
  const rawHeight = match[2] ?? '';
  if (!/^\d{1,2}$/.test(rawWidth) || !/^\d{2}$/.test(rawHeight)) return false;

  const width = Number(rawWidth);
  const height = Number(rawHeight);
  if (!Number.isInteger(width) || !Number.isInteger(height) || height < 0 || height > 59) return false;

  const start = match.index ?? 0;
  const end = start + match[0].length;
  const before = text.slice(Math.max(0, start - 40), start);
  const after = text.slice(end, Math.min(text.length, end + 40));
  const adjacentRange =
    /^\s*(?:-|–|—|\bto\b)\s*\d{1,2}:[0-5]\d\b/i.test(after)
    || /\b\d{1,2}:[0-5]\d\s*(?:-|–|—|\bto\b)\s*$/i.test(before);
  if (adjacentRange) return true;

  const timeCueContext = `${before} ${after}`;
  return /^0\d$/.test(rawHeight)
    && /\b(?:timecode|timestamp|audio|music|song|track|clip|file|source|window|segment|range)\b/i.test(timeCueContext);
}

export function inferExplicitAspectRatioFromText(text: string): ExplicitAspectRatio | null {
  const ratioPattern = /\b(\d{1,4}(?:\.\d+)?)\s*:\s*(\d{1,4}(?:\.\d+)?)\b/g;
  for (const match of text.matchAll(ratioPattern)) {
    if (ratioMatchLooksLikeMediaTimecodeRange(text, match)) continue;

    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      continue;
    }

    const index = match.index ?? 0;
    const context = text.slice(Math.max(0, index - 48), Math.min(text.length, index + match[0].length + 48));
    const hasExplicitRatioContext = /\b(?:aspect|ratio|format|resolution|size|dimensions?|portrait|landscape|widescreen|horizontal|vertical)\b/i.test(context);
    if (!hasExplicitRatioContext && width <= 3 && height >= 10 && height < 60) {
      continue;
    }
    if (/\b(?:ratio|aspect|format|resolution|size|dimensions?|portrait|landscape|vertical|horizontal|widescreen|frame|image|photo|picture|video|clip|ad|advert|commercial|promo|story\s*board|storyboard|tiktok|tik\s*tok|reels?|shorts?|instagram|output)\b/i.test(context)) {
      return { width, height, text: match[0] };
    }
  }
  return null;
}

function timeRangeLooksLikeSourceMediaWindow(text: string, match: RegExpMatchArray): boolean {
  const start = match.index ?? 0;
  const end = start + match[0].length;
  const context = text.slice(Math.max(0, start - 96), Math.min(text.length, end + 96));
  return /\b(?:audio|music|song|sound|track)\s+(?:file|clip|track|source|upload|reference)\b/i.test(context)
    || /\b(?:file|clip|track|source|upload|reference)\s+(?:audio|music|song|sound|track)\b/i.test(context)
    || /\b(?:from|using|between|inside|within|in)\b[\s\S]{0,60}\b(?:audio|music|song|sound|track|clip|file)\b/i.test(context)
    || /\b(?:audio|music|song|sound|track|clip|file)\b[\s\S]{0,60}\b(?:from|using|between|inside|within|in)\b/i.test(context);
}

const VIDEO_RUNTIME_OUTPUT_CUE_RE =
  /\b(?:video|videos|clip|clips|film|movie|animation|animations|storyboard|storyboards|teaser|promo|commercial|ad|advert|seedance|ltx|wan|render|renders?)\b/i;
const VIDEO_RUNTIME_ACTION_CUE_RE =
  /\b(?:make|create|generate|render|produce|build|compose|turn|convert)\b/i;
const VIDEO_RUNTIME_LABEL_CUE_RE =
  /\b(?:duration|runtime|run\s*time|length|total|overall|final\s+(?:duration|runtime|length))\b/i;

function durationPhraseLooksLikeRequestedVideoRuntime(text: string, match: RegExpMatchArray): boolean {
  const start = match.index ?? 0;
  const end = start + match[0].length;
  const trimmed = text.trim();
  const left = text.slice(Math.max(0, start - 120), start);
  const right = text.slice(end, Math.min(text.length, end + 120));
  const local = `${left}${match[0]}${right}`;
  const leftTail = left.slice(-80);
  const rightHead = right.slice(0, 80);

  if (trimmed.length <= 32 && /^\s*\d{1,3}(?:\.\d+)?\s*[- ]?\s*(?:s|sec|secs|seconds?|minutes?|mins?)\b/i.test(trimmed)) {
    return true;
  }

  if (VIDEO_RUNTIME_LABEL_CUE_RE.test(leftTail) || VIDEO_RUNTIME_LABEL_CUE_RE.test(rightHead)) return true;
  if (VIDEO_RUNTIME_OUTPUT_CUE_RE.test(rightHead)) return true;
  if (
    VIDEO_RUNTIME_OUTPUT_CUE_RE.test(leftTail)
    && (VIDEO_RUNTIME_LABEL_CUE_RE.test(local) || /\b(?:long|total|altogether|in\s+all)\b/i.test(rightHead))
  ) {
    return true;
  }
  if (VIDEO_RUNTIME_ACTION_CUE_RE.test(leftTail) && VIDEO_RUNTIME_OUTPUT_CUE_RE.test(rightHead)) return true;
  if (VIDEO_RUNTIME_ACTION_CUE_RE.test(leftTail) && /\b(?:looping?\s+)?version\b/i.test(rightHead)) {
    return true;
  }
  if (/\b(?:make|set|change|turn|trim|shorten|lengthen)\s+(?:it|this|that|the\s+(?:video|clip|render|animation))\s*(?:to|as|be)?\s*$/i.test(leftTail)) {
    return true;
  }

  return false;
}

export function inferRequestedTotalVideoDurationSeconds(text: string): number | null {
  const explicitDurations: number[] = [];
  for (const match of text.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*[- ]?\s*(?:minutes?|mins?)\b/gi)) {
    if (match.index !== undefined && text[match.index - 1] === '%') continue;
    if (!durationPhraseLooksLikeRequestedVideoRuntime(text, match)) continue;
    const minutes = Number(match[1]);
    if (Number.isFinite(minutes) && minutes > 0) explicitDurations.push(Math.ceil(minutes * 60));
  }
  for (const match of text.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*[- ]?\s*(?:s|sec|secs|seconds?)\b/gi)) {
    if (match.index !== undefined && text[match.index - 1] === '%') continue;
    if (!durationPhraseLooksLikeRequestedVideoRuntime(text, match)) continue;
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) explicitDurations.push(seconds);
  }
  if (explicitDurations.length > 0) return Math.max(...explicitDurations);

  const timeRangeDurations: number[] = [];
  for (const match of text.matchAll(
    /\b(\d{1,2}):([0-5]\d)(?:\.\d+)?\s*(?:-|–|—|\bto\b)\s*(\d{1,2}):([0-5]\d)(?:\.\d+)?\b/gi,
  )) {
    if (match.index !== undefined && text[match.index - 1] === '%') continue;
    const start = (Number(match[1]) * 60) + Number(match[2]);
    const end = (Number(match[3]) * 60) + Number(match[4]);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && end <= 600) {
      timeRangeDurations.push(timeRangeLooksLikeSourceMediaWindow(text, match) ? end - start : end);
    }
  }
  return timeRangeDurations.length > 0 ? Math.max(...timeRangeDurations) : null;
}

export function textProvidesLiteralVideoPrompt(text: string): boolean {
  return /\b(?:full|exact|literal)\s+prompt\b/i.test(text)
    || /\bdo\s+not\s+(?:modify|change|rewrite|alter|enhance|expand|improve)\s+(?:this\s+|the\s+)?prompt\b/i.test(text)
    || /\bprompt\s+to\s+use\b/i.test(text)
    || /\bprompt\s+(?:exactly|verbatim|as[-\s]?is)\b/i.test(text)
    || /\buse\s+(?:this|the)\s+(?:full|exact|literal)\s+prompt\b/i.test(text)
    || /\buse\s+(?:this|the)\s+prompt\s+(?:exactly|verbatim|as[-\s]?is)\b/i.test(text);
}

function stripPromptWrapper(text: string): string {
  let prompt = text.trim();
  const fenced = prompt.match(/^```(?:[\w-]+)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenced?.[1]?.trim()) {
    prompt = fenced[1].trim();
  }

  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
  ];
  for (const [open, close] of quotePairs) {
    if (prompt.startsWith(open) && prompt.endsWith(close)) {
      const unwrapped = prompt.slice(open.length, -close.length).trim();
      if (unwrapped) return unwrapped;
    }
  }

  return prompt;
}

export function extractLiteralVideoPrompt(text: string): string | null {
  const markers = [
    /\b(?:use|using|with)\s+(?:this|the)\s+(?:full\s+|exact\s+|literal\s+)?prompt\s+(?:exactly|verbatim|as[-\s]?is)\s*:?\s*/gi,
    /\b(?:use|using|with)\s+(?:this|the)\s+(?:full|exact|literal)\s+prompt\s*:?\s*/gi,
    /\b(?:full|exact|literal)\s+prompt\s*:?\s*/gi,
    /\bprompt\s+to\s+use\s*:?\s*/gi,
  ];

  let markerEnd = -1;
  for (const marker of markers) {
    marker.lastIndex = 0;
    while (marker.exec(text) !== null) {
      markerEnd = Math.max(markerEnd, marker.lastIndex);
    }
  }

  if (markerEnd < 0 && /\bdo\s+not\s+(?:modify|change|rewrite|alter|enhance|expand|improve)\s+(?:this\s+|the\s+)?prompt\b/i.test(text)) {
    const promptLabel = /\bprompt\s*:\s*/gi;
    while (promptLabel.exec(text) !== null) {
      markerEnd = Math.max(markerEnd, promptLabel.lastIndex);
    }
  }

  if (markerEnd < 0) return null;

  const extracted = stripPromptWrapper(
    text
      .slice(markerEnd)
      .replace(/^\s*[:-]\s*/, ''),
  );
  return extracted.length >= 3 ? extracted : null;
}

export function textMentionsStoryboardReference(text: string): boolean {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  if (/\b(?:video\s+sequence|sequence\s+sheet|shot\s+sheet|thumbnail\s+sequence|panel\s+sequence)\b/i.test(normalized)) {
    return true;
  }

  const rejectsStoryboardPanelOutput =
    /\b(?:no|without)\s+(?:extra\s+|random\s+|visible\s+|generated\s+|output\s+)?(?:story\s*board|storyboard)\s+panels?\b/i.test(normalized)
    || /\b(?:avoid|exclude|never|don't|do\s+not)\b[\s\S]{0,80}\b(?:story\s*board|storyboard)\s+panels?\b/i.test(normalized)
    || /\bnot\s+(?:a\s+|the\s+|as\s+)?(?:story\s*board|storyboard)\s+panels?\b/i.test(normalized)
    || /\b(?:story\s*board|storyboard)\s+panels?\b[\s\S]{0,80}\b(?:not\s+(?:needed|required|wanted)|without|avoid|exclude|never)\b/i.test(normalized);
  const contextualStoryboardReference =
    /\b(?:uploading|uploaded|attached|provided|reference|source|input)\b[\s\S]{0,80}\b(?:story\s*board|storyboard)\b/i.test(normalized)
    || /\b(?:story\s*board|storyboard)\b[\s\S]{0,80}\b(?:uploaded|attached|provided|reference|source|input|image|sheet|grid|layout|page|board|panels?|frames?|sequence|timecodes?)\b/i.test(normalized)
    || /\b(?:use|using|with|from|based\s+on|following|follow|turn|convert|transform|animate)\b[\s\S]{0,100}\b(?:story\s*board|storyboard)\b/i.test(normalized)
    || /\b(?:story\s*board|storyboard)\b[\s\S]{0,100}\b(?:into|to|as)\s+(?:a\s+|the\s+)?(?:videos?|clips?|animations?|movies?|films?)\b/i.test(normalized);

  return contextualStoryboardReference && !rejectsStoryboardPanelOutput;
}

/**
 * Detects explicit "Seedance Fast" phrasing. Seedance 2.0 Fast was retired in
 * 2026-08 and Seedance 2.0 Mini replaced it, so callers route a positive result
 * to seedance2-mini; the detector stays so that phrasing still lands on the
 * cheaper 720p Seedance tier instead of the full model.
 */
export function textExplicitlyRequestsSeedanceFastModel(text: string): boolean {
  const mentionsSeedance = /\b(?:seedance|seeddance)(?:\s*2(?:\.0)?)?\b/i.test(text);
  return /\b(?:seedance|seeddance)(?:\s*2(?:\.0)?)?\s+fast\b/i.test(text)
    || /\bfast\s+(?:seedance|seeddance)(?:\s*2(?:\.0)?)?\b/i.test(text)
    || /\b(?:(?:seedance|seeddance)(?:\s*2(?:\.0)?)?\s+)?fast\s+(?:version|variant)\b/i.test(text)
    || /\b(?:version|variant)\s+(?:should\s+be\s+|is\s+|as\s+)?(?:(?:seedance|seeddance)(?:\s*2(?:\.0)?)?\s+)?fast\b/i.test(text)
    || (mentionsSeedance && /\bdraft\b/i.test(text))
    || (
      mentionsSeedance
      && /\b(?:use|using|choose|select|set|switch\s+to|with|via)\b[\s\S]{0,40}\bfast\s+model\b/i.test(text)
    );
}

export function textExplicitlyRequestsNonSeedanceVideoModel(text: string): boolean {
  return /\b(?:ltx(?:\s*2(?:\.3)?)?|wan(?:\s*2(?:\.2)?)?|another\s+video\s+model|different\s+video\s+model|non[-\s]?seedance)\b/i.test(text)
    && !/\b(?:seedance|seeddance)(?:\s*2(?:\.0)?)?\b/i.test(text);
}

export function textTreatsAudioAsLooseReference(text: string): boolean {
  return /@?audio\d*\b[\s\S]{0,100}\b(?:loose|rough|mood|vibe|background|ambient|style|play\s+under)\b[\s\S]{0,40}\b(?:references?|guide|under|track|shot|clip)\b/i.test(text)
    || /\baudio\b[\s\S]{0,80}\bloose\s+references?\b/i.test(text)
    || /\bloose\s+references?\b[\s\S]{0,80}\baudio\b/i.test(text)
    || /\breference\s+audio\b[\s\S]{0,100}\b(?:loose|mood|background|play\s+under|under)\b/i.test(text)
    || /\baudio\b[\s\S]{0,100}\b(?:mood|background|ambient|style)\s+references?\b/i.test(text)
    || /\baudio\b[\s\S]{0,80}\bplay\s+under\b/i.test(text)
    || /\bplay\s+under\b[\s\S]{0,80}\baudio\b/i.test(text)
    || /\baudio\b[\s\S]{0,80}\b(?:as\s+(?:a\s+)?(?:rough\s+)?(?:reference|guide)|for\s+(?:the\s+)?(?:mood|vibe|tone|feel|inspiration|style)|mood\s+reference|vibe\s+reference)\b/i.test(text)
    || /\b(?:use|take|treat)\b[\s\S]{0,80}\b(?:audio|song|track|music)\b[\s\S]{0,80}\b(?:as\s+(?:a\s+)?(?:rough\s+)?(?:reference|guide)|for\s+(?:the\s+)?(?:mood|vibe|tone|feel|inspiration|style))\b/i.test(text)
    || /\b(?:mood|vibe|tone|feel|style)\b[\s\S]{0,80}\b(?:from|of)\b[\s\S]{0,80}\b(?:audio|song|track|music)\b/i.test(text)
    || /\b(?:inspired\s+by|based\s+on)\b[\s\S]{0,80}\b(?:audio|song|track|music)\b[\s\S]{0,80}\b(?:mood|vibe|tone|feel|style)?\b/i.test(text);
}

export function textRequestsPrimaryAudioSyncVideo(text: string): boolean {
  if (textTreatsAudioAsLooseReference(text)) {
    return false;
  }

  if (
    /\b(?:do\s+not|don't|dont|no|not|without)\b[\s\S]{0,50}\b(?:sync|synced|synchroni[sz]e|synchronized|match|lip[-\s]*sync)\b[\s\S]{0,50}\b(?:audio|sound|song|track|beat|rhythm|music|voice|dialogue|speech|words)\b/i.test(text)
    || /\b(?:audio|sound|song|track|beat|rhythm|music|voice|dialogue|speech|words)\b[\s\S]{0,50}\b(?:do\s+not|don't|dont|no|not|without)\b[\s\S]{0,50}\b(?:sync|synced|synchroni[sz]e|synchronized|match|lip[-\s]*sync)\b/i.test(text)
  ) {
    return false;
  }

  return /\bsound[-_\s]*to[-_\s]*video\b/i.test(text)
    || /\baudio[-_\s]*(?:sync|synced|synchronized|synchroni[sz]ed)\b/i.test(text)
    || /\b(?:sync|synced|synchroni[sz]e|synchroni[sz]ed|match)\b[\s\S]{0,80}\b(?:audio|sound|song|track|beat|rhythm|music|voice|dialogue|speech|words)\b/i.test(text)
    || /\b(?:saying|speaking|lip[-\s]*sync(?:ing)?|mouth(?:ing)?)\b[\s\S]{0,100}\b(?:audio|sound|words|dialogue|speech|voice)\b/i.test(text)
    || /\b(?:audio|sound|song|track|beat|rhythm|music|voice|dialogue|speech|words)\b[\s\S]{0,100}\b(?:drive|drives|driving|primary|sync|synced|synchronized|synchroni[sz]ed|lip[-\s]*sync)\b/i.test(text)
    || /\b(?:audio\s+(?:voice\s+)?recording|voice\s+(?:recording|clip|track|file)|wav\s+file|uploaded\s+(?:audio|voice|wav)|audio\s+file)\b[\s\S]{0,160}\b(?:image|photo|picture|portrait|face|person|man|woman|character)\b[\s\S]{0,160}\b(?:make|create|generate|render|animate|turn|convert|transform)\b[\s\S]{0,120}\b(?:sing|sinc|since|sync|speak|speaking|say|saying|talk|talking|lip[-\s]*sync|dance|dancing)\b/i.test(text)
    || /\b(?:image|photo|picture|portrait|face|person|man|woman|character)\b[\s\S]{0,160}\b(?:audio\s+(?:voice\s+)?recording|voice\s+(?:recording|clip|track|file)|wav\s+file|uploaded\s+(?:audio|voice|wav)|audio\s+file)\b[\s\S]{0,160}\b(?:make|create|generate|render|animate|turn|convert|transform)\b[\s\S]{0,120}\b(?:sing|sinc|since|sync|speak|speaking|say|saying|talk|talking|lip[-\s]*sync|dance|dancing)\b/i.test(text);
}

export function seedanceRequestUsesStoryboardReferenceForModelDefault(
  input: SeedanceStoryboardReferenceModelDefaultInput,
): boolean {
  if (input.storyboardDetected === true) return true;

  const promptText = typeof input.promptText === 'string'
    ? input.promptText.trim()
    : '';
  if (promptText === SEEDANCE_STORYBOARD_REFERENCE_PROMPT) return true;
  if (!input.hasImageReference) return false;

  const combinedText = `${input.userIntentText}\n${promptText}`;
  if (!textMentionsStoryboardReference(combinedText)) return false;
  return /\b(?:seedance|videos?|clips?|animations?|movies?|films?|generate|create|make|render|produce|turn|animate|convert|transform)\b/i.test(combinedText);
}

export function textProvidesVideoScriptOrDetailedPrompt(text: string): boolean {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();
  if (!normalized) return false;

  if (textProvidesLiteralVideoPrompt(normalized)) return true;
  if (/\[\s*\d{1,2}(?:[:.]\d{2})?\s*(?:-|–|—|to)\s*\d{1,2}(?:[:.]\d{2})?\s*\]/i.test(normalized)) return true;
  if (/^\s*(?:style|shot|scene|segment|camera|motion|audio|vo|v\.o\.|voiceover|sfx|fx|music|dialogue)\s*:/im.test(normalized)) return true;
  if (/^\s*(?:scene|shot|segment)\s*\d{1,2}\b/im.test(normalized)) return true;
  if ((normalized.match(/^\s*(?:vo|v\.o\.|sfx|fx|music|camera)\s*:/gim) || []).length >= 2) return true;
  if ((normalized.match(/\b(?:VO|SFX|camera|style|dialogue|shot|segment)\s*:/g) || []).length >= 3) return true;

  const quotedPhrases = normalized.match(/"[^"]{8,}"/g) || [];
  if (quotedPhrases.length >= 2) return true;

  const commandStripped = normalized
    .replace(/\b(?:generate|create|make|render|turn|use|using|with|this|the|uploaded|attached|provided|image|photo|picture|reference|seedance|video|seconds?|secs?|s)\b/gi, ' ')
    .replace(/\b\d{1,2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = commandStripped ? commandStripped.split(/\s+/).length : 0;
  return wordCount >= 55;
}

export function seedanceStoryboardFallbackAllowedForText(text: string): boolean {
  return !textProvidesVideoScriptOrDetailedPrompt(text);
}

function textProvidesStructuredVideoScriptOrPrompt(text: string): boolean {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();
  if (!normalized) return false;
  if (textProvidesLiteralVideoPrompt(normalized)) return true;
  if (/\[\s*\d{1,2}(?:[:.]\d{2})?\s*(?:-|–|—|to)\s*\d{1,2}(?:[:.]\d{2})?\s*\]/i.test(normalized)) return true;
  if (/^\s*(?:scene|shot|segment)\s*\d{1,2}\b/im.test(normalized)) return true;
  if (/^\s*(?:dialogue|vo|v\.o\.|voiceover)\s*:/im.test(normalized)) return true;
  if ((normalized.match(/^\s*(?:shot|scene|segment|camera|motion|audio|vo|v\.o\.|voiceover|sfx|fx|music|dialogue)\s*:/gim) || []).length >= 2) {
    return true;
  }
  if ((normalized.match(/\b(?:VO|SFX|camera|motion|audio|dialogue|shot|segment)\s*:/g) || []).length >= 3) {
    return true;
  }
  return (normalized.match(/"[^"]{8,}"/g) || []).length >= 2;
}

export function seedanceStoryboardReferenceFallbackAllowedForVisualDetection(text: string): boolean {
  return !textProvidesStructuredVideoScriptOrPrompt(text);
}

function normalizeDurationSeconds(value: unknown): number | null {
  const raw = typeof value === 'string'
    ? Number(value.trim().match(/^(\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?$/i)?.[1])
    : typeof value === 'number'
      ? value
      : NaN;
  if (!Number.isFinite(raw) || raw <= 0 || raw > 600) return null;
  return Math.ceil(raw);
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y > 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function formatAspectRatio(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const ratio = width / height;
  if (ratio < 0.25 || ratio > 4) return null;
  const divisor = greatestCommonDivisor(width, height);
  return `${Math.trunc(width) / divisor}:${Math.trunc(height) / divisor}`;
}

function normalizeAspectRatio(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[x/]/gi, ':').toLowerCase();
  if (!normalized || normalized === 'null' || normalized === 'unknown' || normalized === 'ambiguous') {
    return null;
  }
  if (/^(?:portrait|vertical)$/.test(normalized)) return '9:16';
  if (/^(?:landscape|horizontal|widescreen)$/.test(normalized)) return '16:9';
  if (/^square$/.test(normalized)) return '1:1';
  const match = normalized.match(/(\d{1,5})\s*:\s*(\d{1,5})/);
  if (!match) return null;
  return formatAspectRatio(Number(match[1]), Number(match[2]));
}

function textExplicitlyRequestsMultipleVideoRenders(text: string): boolean {
  return /\b(?:\d{1,2}|multiple|several|many)\s+(?:separate\s+|different\s+|distinct\s+)?(?:videos?|clips?|versions?|variations?)\b/i.test(text);
}

function textExplicitlyRequestsGeneratedImageStage(text: string): boolean {
  return /\b(?:generate|create|make|render|produce|design|build)\b\s+(?:an?\s+|the\s+)?(?:\d{1,2}\s+)?(?:new|different|distinct|separate|alternate|transformed|scene\s+)*(?:images?|photos?|pictures?|portraits?|keyframes?|frames?|versions?|variations?|variants?)\b/i.test(text);
}

function textRequestsAdjacentImageTransitions(text: string): boolean {
  const lower = text.toLowerCase();
  const sequenceNouns = String.raw`(?:images?|photos?|pictures?|keyframes?|frames?|versions?|variations?|scenes?)`;
  const transitionVerbs = String.raw`(?:transition|transitions|transitioning|link|links|linking|connect|connecting|morph|morphs|morphing)`;
  const transitionVerbTargetsSequence =
    new RegExp(String.raw`\b${transitionVerbs}\b\s+(?:the\s+|all\s+|each\s+|every\s+|these\s+|those\s+)?${sequenceNouns}\b`, 'i').test(lower)
    || new RegExp(String.raw`\b${transitionVerbs}\b[\s\S]{0,40}\b(?:between|from|to|into|across)\b[\s\S]{0,40}\b(?:the\s+)?${sequenceNouns}\b`, 'i').test(lower)
    || new RegExp(String.raw`\b(?:each|every|all|these|those|generated|uploaded|source|end|first|last|previous|next)\s+(?:story\s*board\s+|storyboard\s+|generated\s+|uploaded\s+)?${sequenceNouns}\b[\s\S]{0,80}\b${transitionVerbs}\b`, 'i').test(lower);
  const mentionsTransition = transitionVerbTargetsSequence
    || /\bbetween\s+(?:the\s+)?(?:images?|photos?|pictures?|keyframes?|frames?|versions?|variations?|scenes?)\b/.test(lower)
    || /(?:->)/.test(text);
  if (!mentionsTransition) return false;
  const mentionsGeneratedSequence = /\b(?:versions?|variations?|images?|photos?|pictures?|keyframes?|frames?|scenes?)\b/.test(lower)
    || /(?:->)/.test(text);
  const mentionsVideoOutput = /\b(?:video|videos|clips?|segments?|stitch|stitched|stitching|montage)\b/.test(lower);
  return mentionsGeneratedSequence && mentionsVideoOutput;
}

export function textRequestsProfessionalCharacterSheetImage(text: string): boolean {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  const generationVerb = String.raw`(?:generate|create|make|render|produce|design|build|develop|draw)`;
  const characterSubject = String.raw`(?:character|mascot|brand\s+mascot|creature|avatar|persona|toon|cartoon\s+character)`;
  const sheetArtifact = String.raw`(?:character\s+sheet|mascot\s+sheet|model\s+sheet|reference\s+(?:sheet|board)|design\s+sheet|turnaround(?:\s+(?:sheet|views?|board))?|expression\s+(?:sheet|row|board)|pose\s+(?:sheet|board))`;

  const directCharacterSheet = new RegExp(
    String.raw`\b${characterSubject}\b[\s\S]{0,80}\b(?:sheet|reference\s+(?:sheet|board)|model\s+sheet|turnaround(?:\s+(?:sheet|views?|board))?|expression\s+(?:sheet|row|board)|pose\s+(?:sheet|board))\b`,
    'i',
  ).test(normalized)
    || new RegExp(String.raw`\b${sheetArtifact}\b[\s\S]{0,80}\b${characterSubject}\b`, 'i').test(normalized)
    || /\breusable\s+character\s+sheet\b/i.test(normalized);

  if (!directCharacterSheet) return false;

  return new RegExp(String.raw`\b${generationVerb}\b[\s\S]{0,180}\b${sheetArtifact}\b`, 'i').test(normalized)
    || new RegExp(String.raw`\b${sheetArtifact}\b[\s\S]{0,120}\b(?:image|illustration|artwork|render|board|layout)\b`, 'i').test(normalized)
    || new RegExp(String.raw`\b(?:need|want|would\s+like|looking\s+for|please|can\s+you|could\s+you)\b[\s\S]{0,120}\b${sheetArtifact}\b`, 'i').test(normalized);
}

function textRequestsDirectVideoOutput(text: string): boolean {
  const videoGenerationVerbs = String.raw`(?:generate|create|make|render|produce|turn|animate|convert|transform)`;
  const videoOutputNouns = String.raw`(?:videos?|clips?|animations?|movies?|films?)`;
  return new RegExp(String.raw`\b${videoGenerationVerbs}\b[\s\S]{0,140}\b${videoOutputNouns}\b`, 'i').test(text)
    || new RegExp(String.raw`\b${videoOutputNouns}\b[\s\S]{0,140}\b${videoGenerationVerbs}\b`, 'i').test(text);
}

function textHasExplicitStoryboardPlanningWorkflow(text: string): boolean {
  const planningNoun = String.raw`(?:script|screenplay|story\s*board|storyboard|shot\s*list|beat\s*sheet|treatment|story\s+beats?|video\s+plan|creative\s+brief)`;
  const planningVerb = String.raw`(?:write|draft|develop|outline|plan|map\s*out|break\s*down)`;

  return new RegExp(String.raw`\b${planningVerb}\b[\s\S]{0,140}\b${planningNoun}\b`, 'i').test(text)
    || new RegExp(String.raw`\b${planningNoun}\b[\s\S]{0,120}\b(?:to\s+develop|for\s+review|for\s+approval|before|first|then|next|subsequent|subsequently|later)\b`, 'i').test(text)
    || /\bnew\s+script\s+to\s+develop\b/i.test(text)
    || /\b(?:construct|build|develop|map\s*out|plan)\b[\s\S]{0,100}\b(?:using|with)\s+(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:beats?|scenes?|panels?)\b/i.test(text)
    || /\b(?:video\s+story\s*board|video\s+storyboard|story\s*board\s+sequence|storyboard\s+sequence)\b[\s\S]{0,140}\b(?:model[-\s]?ready|prompt[-\s]?ready|production[-\s]?ready|enough\s+details?|generate\s+the\s+entire\s+video|story\s+spine|for\s+the\s+model|script|plan|breakdown)\b/i.test(text);
}

export function textRequestsSingleCompositeImageOutput(text: string): boolean {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  const generationVerbs = String.raw`(?:generate|create|make|render|produce|design|build|develop|draw)`;
  const imageOutputNouns = String.raw`(?:images?|photos?|pictures?|portraits?|posters?|artwork|illustrations?)`;
  const compositeNouns = String.raw`(?:story\s*board|storyboard|collage|contact\s+sheet|mood\s*board|moodboard|grid|board)`;
  const adCreativeNouns = String.raw`(?:ads?|advertisements?|banners?|flyers?|posters?|social\s+posts?|campaign\s+creative|marketing\s+(?:creative|graphic)|promo\s+graphic|product\s+graphic)`;
  const characterSheetImageStage = textRequestsProfessionalCharacterSheetImage(normalized);
  const directSeedanceVersionFromStoryboard =
    /\b(?:generate|create|make|render|produce|turn|animate|convert|transform)\b[\s\S]{0,120}\b(?:seedance|seeddance)(?:\s*2(?:\.0)?)?(?:\s+\w+){0,3}\s+(?:version|variant)\b[\s\S]{0,120}\b(?:story\s*board|storyboard)\b/i.test(normalized)
    || /\b(?:generate|create|make|render|produce|turn|animate|convert|transform)\b[\s\S]{0,120}\b(?:version|variant)(?:\s+\w+){0,3}\s+(?:seedance|seeddance)(?:\s*2(?:\.0)?)?\b[\s\S]{0,120}\b(?:story\s*board|storyboard)\b/i.test(normalized);
  if (directSeedanceVersionFromStoryboard) return false;

  const uploadedStoryboardPanelSource =
    /\b(?:upload(?:ing|ed)?|attach(?:ing|ed)?|provid(?:ing|ed)?)\b[\s\S]{0,140}\b(?:each|all|the)?\s*(?:of\s+)?(?:the\s+)?\d{1,2}\s+(?:story\s*board\s+|storyboard\s+)?(?:panels?|frames?|keyframes?)\b/i.test(normalized)
    || /\b(?:these|uploaded|attached|provided)\s+(?:\d{1,2}\s+)?(?:story\s*board\s+|storyboard\s+)?(?:panels?|frames?|keyframes?)\b/i.test(normalized);
  const directClipPerPanelRequest =
    /\b(?:generate|create|make|render|animate|produce)\b[\s\S]{0,120}\b(?:each|all|the)?\s*(?:clips?|videos?|segments?|animations?)\b[\s\S]{0,120}\b(?:per|from|using|with|based\s+on)\b[\s\S]{0,80}\b(?:panels?|frames?|keyframes?|story\s*board|storyboard)\b/i.test(normalized);
  if (uploadedStoryboardPanelSource && directClipPerPanelRequest) return false;

  const directVideoFromStoryboard = new RegExp(
    String.raw`\b(?:generate|create|make|render|produce|turn|animate|convert|transform)\b[\s\S]{0,100}\b(?:videos?|clips?|animations?|movies?|films?)\b[\s\S]{0,140}\b(?:using|with|from|based\s+on|as|following)\b[\s\S]{0,100}\b(?:story\s*board|storyboard)(?:\s+(?:image|photo|picture|reference))?\b`,
    'i',
  ).test(normalized)
    || /\b(?:turn|convert|transform|animate)\b[\s\S]{0,120}\b(?:story\s*board|storyboard)\b[\s\S]{0,80}\b(?:into|to|as)\s+(?:a\s+|the\s+)?(?:videos?|clips?|animations?|movies?|films?)\b/i.test(normalized);
  const noReferenceConnectorBeforeStoryboard = String.raw`(?:(?!\b(?:using|with|from|based\s+on|as|following)\b)[\s\S])`;
  const explicitStoryboardImageOrSheetRequest =
    new RegExp(
      String.raw`\b(?:generate|create|make|render|produce|design|build|develop|draw)\b${noReferenceConnectorBeforeStoryboard}{0,180}\b(?:video\s+)?(?:story\s*board|storyboard)\s+(?:image|sheet|grid|layout|page|board)\b`,
      'i',
    ).test(normalized)
    || /\b(?:story\s*board|storyboard)\s+(?:image|sheet|grid|layout|page|board)\b[\s\S]{0,120}\b(?:for|of)\s+(?:a\s+|the\s+)?(?:videos?|clips?|animations?|movies?|films?|social\s+media\s+video)\b/i.test(normalized);
  if (
    directVideoFromStoryboard
    && !explicitStoryboardImageOrSheetRequest
    && !/\b(?:story\s*board|storyboard)\b[\s\S]{0,60}\bfirst\b/i.test(normalized)
  ) {
    return false;
  }

  const directVideoOutput = textRequestsDirectVideoOutput(normalized);
  const rejectsStoryboardPanelOutput =
    /\b(?:no|without)\s+(?:extra\s+|random\s+|visible\s+|generated\s+|output\s+)?(?:story\s*board|storyboard)\s+panels?\b/i.test(normalized)
    || /\b(?:avoid|exclude|never|don't|do\s+not)\b[\s\S]{0,80}\b(?:story\s*board|storyboard)\s+panels?\b/i.test(normalized)
    || /\bnot\s+(?:a\s+|the\s+|as\s+)?(?:story\s*board|storyboard)\s+panels?\b/i.test(normalized)
    || /\b(?:story\s*board|storyboard)\s+panels?\b[\s\S]{0,80}\b(?:not\s+(?:needed|required|wanted)|without|avoid|exclude|never)\b/i.test(normalized);
  if (directVideoOutput && rejectsStoryboardPanelOutput && !explicitStoryboardImageOrSheetRequest) {
    return false;
  }

  const explicitGeneratedImageOutput = new RegExp(
    String.raw`\b${generationVerbs}\b[\s\S]{0,180}\b(?:${imageOutputNouns}|${compositeNouns}\s+image|image\s+(?:story\s*board|storyboard|grid|collage|board))\b`,
    'i',
  ).test(normalized);
  const standaloneCompositeImageMention = new RegExp(
    String.raw`\b(?:story\s*board|storyboard|grid|collage|contact\s+sheet|mood\s*board|moodboard)\s+${imageOutputNouns}\b`,
    'i',
  ).test(normalized);

  const storyboardImageStage = new RegExp(
    String.raw`\b${generationVerbs}\b[\s\S]{0,180}\b(?:video\s+)?(?:story\s*board|storyboard)(?:\s+(?:sequence|sheet|layout|panel|panels|board))?\b`,
    'i',
  ).test(normalized)
    || /\b(?:turn|convert|transform)\b[\s\S]{0,80}\binto\b[\s\S]{0,120}\b(?:video\s+)?(?:story\s*board|storyboard)(?:\s+(?:sequence|sheet|layout|panel|panels|board))?\b/i.test(normalized)
    || /\b(?:story\s*board|storyboard)\b[\s\S]{0,80}\bfirst\b/i.test(normalized)
    || /\bfirst\b[\s\S]{0,80}\b(?:story\s*board|storyboard)\b/i.test(normalized);

  const referenceGuidedAdCreative = new RegExp(
    String.raw`\b${generationVerbs}\b[\s\S]{0,140}\b${adCreativeNouns}\b`,
    'i',
  ).test(normalized)
    && /\b(?:referenc(?:e|es|ed|ing)|use|using|include|incorporate|based\s+on|guided\s+by|with)\b[\s\S]{0,120}\b(?:uploaded|attached|provided|reference|source|input|assets?|images?|photos?|pictures?)\b/i.test(normalized)
    && !/\b(?:videos?|clips?|animations?|movies?|films?|commercials?)\b/i.test(normalized);

  if (
    directVideoOutput
    && !explicitStoryboardImageOrSheetRequest
    && !textHasExplicitStoryboardPlanningWorkflow(normalized)
    && !referenceGuidedAdCreative
    && !characterSheetImageStage
  ) {
    return false;
  }

  const storyboardImageMentionIsCaptionSource =
    standaloneCompositeImageMention
    && /\b(?:voice\s*over|voiceover|captions?|text|copy|dialogue|lines?)\b[\s\S]{0,180}\b(?:read|shown|displayed|under|below|from|in|on)\b[\s\S]{0,120}\b(?:story\s*board|storyboard)\s+images?\b/i.test(normalized);
  if (
    directVideoOutput
    && storyboardImageMentionIsCaptionSource
    && !explicitStoryboardImageOrSheetRequest
    && !referenceGuidedAdCreative
    && !characterSheetImageStage
  ) {
    return false;
  }

  if (
    directVideoOutput
    && !explicitGeneratedImageOutput
    && standaloneCompositeImageMention
    && !storyboardImageStage
    && !referenceGuidedAdCreative
    && !characterSheetImageStage
    && !explicitStoryboardImageOrSheetRequest
  ) {
    return false;
  }

  const explicitImageOutput = explicitGeneratedImageOutput || standaloneCompositeImageMention;

  if (!explicitImageOutput && !storyboardImageStage && !referenceGuidedAdCreative && !characterSheetImageStage) return false;
  if (
    !referenceGuidedAdCreative
    && !characterSheetImageStage
    && !/\b(?:story\s*board|storyboard|panels?|grid|rows?|columns?|collage|contact\s+sheet|mood\s*board|moodboard|layout|board)\b/i.test(normalized)
  ) {
    return false;
  }

  const directVideoStoryboardReference = new RegExp(
    String.raw`\b${generationVerbs}\b[\s\S]{0,100}\b(?:videos?|clips?|animations?|movies?|films?)\b[\s\S]{0,140}\b(?:using|with|from|based\s+on|as)\b[\s\S]{0,100}\b(?:story\s*board|storyboard)(?:\s+(?:image|photo|picture|reference))?\b`,
    'i',
  ).test(normalized);
  if (directVideoStoryboardReference && !explicitStoryboardImageOrSheetRequest) {
    return false;
  }

  const explicitSeparateOutputs = new RegExp(
    String.raw`\b${generationVerbs}\b[\s\S]{0,180}\b(?:separate|individual|distinct|different|multiple)\s+(?:images|photos|pictures|keyframes|frames|versions|variations|variants)\b`,
    'i',
  ).test(normalized)
    || /\b(?:let\s+me\s+see|show\s+me|give\s+me|i\s+want\s+to\s+see|want\s+to\s+see|need|make|generate|create|render|produce)\b[\s\S]{0,100}\b(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen)\s+(?:separate\s+|individual\s+|distinct\s+|different\s+|alternate\s+|new\s+)?(?:images|photos|pictures|keyframes|frames|versions|variations|variants|options|takes)\b/i.test(normalized)
    || /\b(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen)\s+(?:separate\s+|individual\s+|distinct\s+|different\s+|alternate\s+|new\s+)?(?:images|photos|pictures|keyframes|frames|versions|variations|variants|options|takes)\b[\s\S]{0,100}\b(?:then|after|before|animate|animation|video|stitch|transition)\b/i.test(normalized);

  return !explicitSeparateOutputs;
}

export function textRequestsDirectMediaAfterPreproduction(text: string): boolean {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  return /\b(?:do\s+not|don't|dont|without|no\s+need\s+to)\b[\s\S]{0,80}\b(?:wait|ask|confirm|review|feedback|approval|approve)\b/i.test(normalized)
    || /\b(?:skip|bypass)\b[\s\S]{0,80}\b(?:review|approval|confirmation|feedback)\b/i.test(normalized)
    || /\b(?:generate|render|make|create|produce|complete|build|run)\b[\s\S]{0,140}\b(?:everything|all\s+stages|all\s+the\s+way|end\s*-?\s*to\s*-?\s*end|full\s+workflow|complete\s+workflow|the\s+(?:entire|whole)\s+(?:workflow|project|pipeline|thing))\b/i.test(normalized)
    || /\b(?:go\s+ahead|proceed|run\s+it|do\s+it\s+now|generate\s+directly|render\s+directly|start\s+rendering|send\s+it)\b/i.test(normalized)
    || /\b(?:after|then|next)\b[\s\S]{0,120}\b(?:immediately|directly|right\s+away|without\s+waiting|without\s+asking)\b[\s\S]{0,120}\b(?:generate|render|make|create|animate|produce)\b/i.test(normalized)
    || /\b(?:generate|render|make|create|animate|produce)\b[\s\S]{0,120}\b(?:immediately|directly|right\s+away|without\s+waiting|without\s+asking)\b/i.test(normalized);
}

export function textRequestsPreproductionScriptStage(text: string): boolean {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;

  const planningArtifactNoun = String.raw`(?:script|screenplay|story\s*board|storyboard|shot\s*list|beat\s*sheet|treatment)`;
  const suppliedScript = new RegExp(
    String.raw`\b(?:here\s+is|here's|below\s+is|following\s+is)\b[\s\S]{0,80}\b${planningArtifactNoun}\b`,
    'i',
  ).test(normalized)
    || new RegExp(
      String.raw`\b(?:provided|supplied|included|existing|approved|final|attached|uploaded)\s+${planningArtifactNoun}\b`,
      'i',
    ).test(normalized)
    || new RegExp(
      String.raw`\b${planningArtifactNoun}\b\s*(?:is|was|has\s+been|already)?\s*(?:provided|supplied|included|attached|uploaded|pasted|below|approved|final)\b`,
      'i',
    ).test(normalized)
    || /\b(?:use|send|turn|convert|animate|generate|render|make|create)\b[\s\S]{0,120}\b(?:this|that|existing|approved|final|provided|supplied|included)\b[\s\S]{0,80}\b(?:script|screenplay|story\s*board|storyboard|shot\s*list|beat\s*sheet|treatment|storyboard\s+image)\b/i.test(normalized);
  if (suppliedScript) return false;

  const explicitStoryboardImageOutput =
    /\b(?:story\s*board|storyboard)\s+(?:image|sheet|grid|layout|poster|board)\b/i.test(normalized)
    || /\b(?:image|sheet|grid|layout|poster|board)\s+(?:story\s*board|storyboard)\b/i.test(normalized);
  const mentionsWrittenPlanning = /\b(?:script|screenplay|shot\s*list|beat\s*sheet|treatment|story\s+beats?|video\s+plan|creative\s+brief)\b/i.test(normalized);
  if (explicitStoryboardImageOutput && !mentionsWrittenPlanning) return false;

  const planningNoun = String.raw`(?:script|screenplay|story\s*board|storyboard|shot\s*list|beat\s*sheet|treatment|story\s+beats?|video\s+plan|creative\s+brief)`;
  const planningVerb = String.raw`(?:write|draft|develop|create|make|generate|build|design|outline|plan|map\s*out|break\s*down)`;
  const asksForPlanning = new RegExp(String.raw`\b${planningVerb}\b[\s\S]{0,140}\b${planningNoun}\b`, 'i').test(normalized)
    || new RegExp(String.raw`\b${planningNoun}\b[\s\S]{0,120}\b(?:to\s+develop|for\s+review|for\s+approval|before|first|then|next|subsequent|subsequently|later)\b`, 'i').test(normalized)
    || /\bnew\s+script\s+to\s+develop\b/i.test(normalized);
  const creativeStoryTerm = String.raw`(?:storyline|monologue|dialogue|script|skit|comedy|jokes?|punchline|payoff|twist|beats?)`;
  const asksForCreativeStoryDevelopment =
    new RegExp(String.raw`\b(?:story\s*board|storyboard)\b[\s\S]{0,220}\b${creativeStoryTerm}\b`, 'i').test(normalized)
    || new RegExp(String.raw`\b${creativeStoryTerm}\b[\s\S]{0,220}\b(?:story\s*board|storyboard)\b`, 'i').test(normalized);
  if (!asksForPlanning && !asksForCreativeStoryDevelopment) return false;
  if (
    textRequestsDirectVideoOutput(normalized)
    && !textHasExplicitStoryboardPlanningWorkflow(normalized)
    && !asksForCreativeStoryDevelopment
  ) {
    return false;
  }

  const downstreamMediaContext =
    /\b(?:video|clip|animation|movie|film|seedance|ltx|image|keyframe|storyboard\s+image|storyboard\s+sheet|model|generation|generate|render|animate)\b/i.test(normalized)
    || /\b(?:used\s+by|enough\s+details?|production\s+ready|prompt-ready|model-ready)\b/i.test(normalized);
  return downstreamMediaContext;
}

export function planSeedanceStoryboardFallback(
  input: SeedanceStoryboardFallbackInput,
): SeedanceStoryboardFallbackPlan | null {
  const userIntentText = input.userIntentText;
  const providesLiteralPrompt = input.providesLiteralPrompt
    ?? textProvidesLiteralVideoPrompt(userIntentText);
  if (providesLiteralPrompt) return null;
  const storyboardReferenceMentioned = textMentionsStoryboardReference(userIntentText);
  const storyboardVisuallyDetected = input.storyboardDetected === true;
  const allowsStoryboardFallback = storyboardReferenceMentioned || storyboardVisuallyDetected
    ? seedanceStoryboardReferenceFallbackAllowedForVisualDetection(userIntentText)
    : seedanceStoryboardFallbackAllowedForText(userIntentText);
  if (!allowsStoryboardFallback) return null;
  if (input.uploadedImageCount !== 1) return null;
  if ((input.uploadedVideoCount ?? 0) > 0 || (input.uploadedAudioCount ?? 0) > 0) return null;
  if (textExplicitlyRequestsMultipleVideoRenders(userIntentText)) return null;
  if (textExplicitlyRequestsGeneratedImageStage(userIntentText)) return null;
  if (textRequestsSingleCompositeImageOutput(userIntentText)) return null;
  if (textRequestsAdjacentImageTransitions(userIntentText)) return null;

  const reason = storyboardReferenceMentioned
    ? 'text_mentions_storyboard'
    : storyboardVisuallyDetected
      ? 'vision_detected_storyboard'
      : null;
  if (!reason) return null;

  const requestedDuration = input.requestedDurationSeconds
    ?? inferRequestedTotalVideoDurationSeconds(userIntentText);
  const storyboardDuration = normalizeDurationSeconds(input.storyboardDurationSeconds);
  const storyboardAspectRatio = normalizeAspectRatio(input.storyboardAspectRatio);
  const defaultDuration = input.defaultDurationSeconds ?? 5;
  const maxDuration = input.maxDurationSeconds ?? 15;
  const minDuration = input.minDurationSeconds ?? 4;
  const userProvidedDuration = requestedDuration !== null && requestedDuration !== undefined;
  const intendedDuration = userProvidedDuration
    ? requestedDuration as number
    : storyboardDuration ?? defaultDuration;
  if (userProvidedDuration && intendedDuration > maxDuration) return null;

  return {
    prompt: buildSeedanceStoryboardReferencePrompt(userIntentText, reason),
    duration: Math.max(minDuration, Math.min(maxDuration, intendedDuration)),
    referenceImageIndices: input.referenceImageIndices ?? [-1],
    skipPromptProcessing: true,
    expandPrompt: false,
    reason,
    ...(storyboardAspectRatio ? { aspectRatio: storyboardAspectRatio } : {}),
  };
}

function buildSeedanceStoryboardReferencePrompt(
  userIntentText: string,
  reason: SeedanceStoryboardFallbackPlan['reason'] | null,
): string {
  if (reason !== 'vision_detected_storyboard') return SEEDANCE_STORYBOARD_REFERENCE_PROMPT;
  const additionalDirection = userIntentText
    .replace(/\s+/g, ' ')
    .trim();
  if (!additionalDirection) return SEEDANCE_STORYBOARD_REFERENCE_PROMPT;
  return `${SEEDANCE_STORYBOARD_REFERENCE_PROMPT} Additional user direction to honor while following the storyboard: ${additionalDirection}`;
}

function valuePresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function dimensionsForAspectRatio(
  width: number,
  height: number,
  aspectRatio: string,
): { width: number; height: number } | null {
  const normalized = normalizeAspectRatio(aspectRatio);
  if (!normalized) return null;
  const [ratioWText, ratioHText] = normalized.split(':');
  const ratioW = Number(ratioWText);
  const ratioH = Number(ratioHText);
  if (!Number.isFinite(ratioW) || !Number.isFinite(ratioH) || ratioW <= 0 || ratioH <= 0) {
    return null;
  }
  const shortSide = Math.min(width, height);
  if (!Number.isFinite(shortSide) || shortSide <= 0) return null;
  if (ratioW >= ratioH) {
    return {
      width: Math.round(shortSide * ratioW / ratioH),
      height: Math.round(shortSide),
    };
  }
  return {
    width: Math.round(shortSide),
    height: Math.round(shortSide * ratioH / ratioW),
  };
}

export function isSeedanceModelSelection(modelId: string | null | undefined): boolean {
  if (!modelId) return false;
  return (
    isSeedanceModel(modelId) ||
    isSeedanceModel(resolveVideoModelAlias(modelId, 't2v')) ||
    isSeedanceModel(resolveVideoModelAlias(modelId, 'ia2v')) ||
    isSeedanceModel(resolveVideoModelAlias(modelId, 'v2v'))
  );
}

export function isHappyHorseModelSelection(modelId: string | null | undefined): boolean {
  if (!modelId) return false;
  return (
    isHappyHorseModel(modelId) ||
    isHappyHorseModel(resolveVideoModelAlias(modelId, 't2v')) ||
    isHappyHorseModel(resolveVideoModelAlias(modelId, 'i2v')) ||
    isHappyHorseModel(resolveVideoModelAlias(modelId, 'v2v'))
  );
}

export function isWan3ModelSelection(modelId: string | null | undefined): boolean {
  if (!modelId) return false;
  return isWan3Model(modelId) || isWan3Model(resolveVideoModelAlias(modelId));
}

export function planCliVideoBrain(input: SkillCliVideoBrainInput): SkillCliVideoBrainPlan {
  const plan: SkillCliVideoBrainPlan = { warnings: [] };
  if (!input.video || !input.prompt?.trim()) return plan;

  const cliSet = input.cliSet ?? {};
  const text = input.prompt;
  const normalizedWorkflow = normalizeVideoWorkflow(input.workflow);

  const literalPrompt = extractLiteralVideoPrompt(text);
  if (literalPrompt) {
    plan.literalPrompt = true;
    plan.prompt = literalPrompt;
  }

  const inferredDuration = inferRequestedTotalVideoDurationSeconds(text);
  if (!cliSet.duration && !cliSet.frames && inferredDuration !== null) {
    plan.duration = inferredDuration;
  }

  if (!cliSet.width && !cliSet.height) {
    const aspectRatio = inferExplicitAspectRatioFromText(text);
    const exactDimensions = inferExplicitPixelDimensionsFromText(text);
    if (exactDimensions) {
      plan.width = exactDimensions.width;
      plan.height = exactDimensions.height;
      plan.dimensionSource = 'exact';
    } else if (!cliSet.targetResolution) {
      const shortSide = inferRequestedVideoResolutionShortSideFromText(text);
      if (shortSide !== null) {
        plan.targetResolution = shortSide;
      } else {
        if (aspectRatio) {
          const dimensions = dimensionsForAspectRatio(
            input.width ?? 1920,
            input.height ?? 1088,
            aspectRatio.text,
          );
          if (dimensions) {
            plan.width = dimensions.width;
            plan.height = dimensions.height;
            plan.dimensionSource = 'aspect';
          }
        }
      }
    }
    if (aspectRatio && !exactDimensions) {
      plan.aspectRatio = aspectRatio.text;
    }
  }

  const uploadedImageCount =
    (valuePresent(input.refImage) ? 1 : 0) +
    (valuePresent(input.refImageEnd) ? 1 : 0);
  const storyboard = plan.literalPrompt
    ? null
    : planSeedanceStoryboardFallback({
      userIntentText: text,
      uploadedImageCount,
      uploadedVideoCount: valuePresent(input.refVideo) ? 1 : 0,
      uploadedAudioCount: valuePresent(input.refAudio) ? 1 : 0,
      requestedDurationSeconds: cliSet.duration ? input.duration : plan.duration ?? inferredDuration,
      defaultDurationSeconds: input.duration ?? 5,
      storyboardAspectRatio: inferExplicitAspectRatioFromText(text)?.text,
    });

  if (storyboard) {
    const explicitNonSeedanceModel = cliSet.model && input.model && !isSeedanceModelSelection(input.model);
    const workflowAllowsStoryboard = !normalizedWorkflow || normalizedWorkflow === 't2v';
    if (!explicitNonSeedanceModel && workflowAllowsStoryboard) {
      plan.storyboard = storyboard;
      plan.prompt = storyboard.prompt;
      if (!cliSet.model) plan.model = SEEDANCE_WORKFLOW_MODELS.t2v;
      if (!cliSet.workflow) plan.workflow = 't2v';
      if (!cliSet.duration && !cliSet.frames) plan.duration = storyboard.duration;
      if (storyboard.aspectRatio && !cliSet.width && !cliSet.height && plan.width === undefined && plan.height === undefined) {
        const dimensions = dimensionsForAspectRatio(
          input.width ?? 1920,
          input.height ?? 1088,
          storyboard.aspectRatio,
        );
        if (dimensions) {
          plan.width = dimensions.width;
          plan.height = dimensions.height;
          plan.dimensionSource = 'aspect';
        }
      }
    }
  }

  return plan;
}

export type StoryboardLayoutKind =
  | 'landscape_grid'
  | 'portrait_grid'
  | 'portrait_letterbox_cells'
  | 'landscape_portrait_cells';

export interface StoryboardLayoutSpec {
  boardAspectRatio: string;
  cellAspectRatio: string;
  targetVideoAspectRatio: string;
  layoutKind: StoryboardLayoutKind;
  layoutDescription: string;
  boardDimensions?: string;
}

export const STORYBOARD_PLANNING_CONTRACT_SCHEMA_VERSION = 'storyboard-planning-contract/v1' as const;

export type StoryboardPlanningSource =
  | 'llm_schema'
  | 'assistant_metadata'
  | 'user_schema'
  | 'fallback_text';

export interface StoryboardLayoutPlanningContract {
  storyboardCanvasAspectRatio?: string;
  storyboardCellAspectRatio?: string;
  targetVideoAspectRatio?: string;
  boardDimensions?: string;
  storyboardCanvasSpecifiedByUser?: boolean;
  source?: StoryboardPlanningSource;
}

export interface StoryboardScenePlanningContract {
  id?: string;
  index?: number;
  visibleText?: string[];
  metadataLabels?: string[];
  referenceUsage?: string[];
}

export interface StoryboardTextPlanningContract {
  visibleText?: string[];
  metadataLabels?: string[];
}

export interface StoryboardPlanningContract {
  schemaVersion?: typeof STORYBOARD_PLANNING_CONTRACT_SCHEMA_VERSION | string;
  source?: StoryboardPlanningSource;
  layout?: StoryboardLayoutPlanningContract;
  scenes?: StoryboardScenePlanningContract[];
  endCard?: StoryboardTextPlanningContract;
  metadataLabels?: string[];
}

export const STORYBOARD_PLANNING_CONTRACT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: 'string',
      const: STORYBOARD_PLANNING_CONTRACT_SCHEMA_VERSION,
    },
    source: {
      type: 'string',
      enum: ['llm_schema', 'assistant_metadata', 'user_schema', 'fallback_text'],
    },
    layout: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: {
          type: 'string',
          enum: ['llm_schema', 'assistant_metadata', 'user_schema', 'fallback_text'],
        },
        storyboardCanvasAspectRatio: { type: 'string' },
        storyboardCellAspectRatio: { type: 'string' },
        targetVideoAspectRatio: { type: 'string' },
        boardDimensions: { type: 'string' },
        storyboardCanvasSpecifiedByUser: { type: 'boolean' },
      },
      required: [
        'source',
        'storyboardCanvasAspectRatio',
        'storyboardCellAspectRatio',
        'targetVideoAspectRatio',
        'boardDimensions',
        'storyboardCanvasSpecifiedByUser',
      ],
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          index: { type: 'integer', minimum: 1, maximum: 24 },
          visibleText: {
            type: 'array',
            items: { type: 'string' },
          },
          metadataLabels: {
            type: 'array',
            items: { type: 'string' },
          },
          referenceUsage: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['id', 'index', 'visibleText', 'metadataLabels', 'referenceUsage'],
      },
    },
    endCard: {
      type: 'object',
      additionalProperties: false,
      properties: {
        visibleText: {
          type: 'array',
          items: { type: 'string' },
        },
        metadataLabels: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['visibleText', 'metadataLabels'],
    },
    metadataLabels: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['schemaVersion', 'source', 'layout', 'scenes', 'endCard', 'metadataLabels'],
} as const;

export function buildStoryboardPlanningResponseFormat(
  name = 'preproduction_storyboard_planning',
) {
  return {
    type: 'json_schema',
    json_schema: {
      name,
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          notes: { type: 'string' },
          storyboardPlanningContract: STORYBOARD_PLANNING_CONTRACT_JSON_SCHEMA,
        },
        required: ['notes', 'storyboardPlanningContract'],
      },
    },
  } as const;
}

export interface StoryboardPromptCompileOptions {
  prompt: string;
  userIntentText: string;
  frameCount: number;
  approvedScriptContext?: string | null;
  promptAuthorship?: 'user' | 'assistant';
  planningContract?: StoryboardPlanningContract | null;
}

export interface StoryboardHostedWorkflowDependency {
  sourceStepId: string;
  targetArgument: string;
  transform:
    | 'artifact_url'
    | 'artifact_data_uri'
    | 'image_url'
    | 'video_url'
    | 'audio_url'
    | 'image_index'
    | 'video_index'
    | 'audio_index'
    | 'subtitle_cues'
    | 'subtitle_srt'
    | 'overlay_items'
    | 'asset_ref';
  sourceArtifactIndex?: number;
  mediaType?: 'image' | 'video' | 'audio';
  required?: boolean;
}

export interface StoryboardHostedWorkflowStep {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  dependsOn?: StoryboardHostedWorkflowDependency[];
}

export interface StoryboardHostedWorkflowInput {
  title: string;
  steps: StoryboardHostedWorkflowStep[];
}

export interface SeedanceStoryboardPromptFromProjectOptions {
  storyboardImageTag?: string;
  durationSec?: number | null;
  aspectRatio?: string | null;
}

export interface StoryboardVideoHostedWorkflowBuildOptions {
  storyline: string;
  userIntentText: string;
  title?: string;
  frameCount?: number;
  imageModel?: string;
  imageQuality?: 'low' | 'medium' | 'high';
  imageOutputFormat?: 'png' | 'jpg' | 'jpeg' | 'webp';
  imageWidth?: number;
  imageHeight?: number;
  videoModel?: 'seedance2' | 'seedance2-mini' | 'seedance2-5' | string;
  videoDurationSec?: number;
  videoTargetResolution?: number;
  generateAudio?: boolean;
}

export interface StoryboardVideoHostedWorkflowPlan {
  title: string;
  frameCount: number;
  storyline: string;
  storyboardProject: StoryboardProject;
  storyboardImagePrompt: string;
  seedanceVideoPrompt: string;
  image: {
    width: number;
    height: number;
    model: string;
    quality: string;
    outputFormat: string;
  };
  video: {
    width: number;
    height: number;
    duration: number;
    model: string;
    generateAudio: boolean;
  };
  input: StoryboardHostedWorkflowInput;
  warnings: string[];
}

export const STORYBOARD_DEFAULT_MIN_FRAMES = 6;
export const STORYBOARD_DEFAULT_MAX_FRAMES = 16;

const STORYBOARD_COUNT_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  twentyone: 21,
  twentytwo: 22,
  twentythree: 23,
  twentyfour: 24,
};

export type StoryboardReferenceKind =
  | 'character'
  | 'logo'
  | 'product'
  | 'style'
  | 'background'
  | 'other';

export type StoryboardUsageScope =
  | 'global'
  | 'specific_scenes'
  | 'end_card_only';

export type StoryboardPreservePriority =
  | 'critical'
  | 'high'
  | 'medium';

export interface ReferenceAsset {
  id: string;
  index?: number;
  kind: StoryboardReferenceKind;
  description: string;
  usageScope: StoryboardUsageScope;
  preservePriority: StoryboardPreservePriority;
}

export interface VoiceLine {
  text: string;
  sceneId: string;
  startSec: number | null;
  endSec: number | null;
  delivery: string;
  priority: 'required' | 'optional';
}

export interface SceneSpec {
  id: string;
  title: string;
  startSec: number | null;
  endSec: number | null;
  durationSec: number | null;
  purpose: string;
  productFeature: string;
  visual: string;
  action: string;
  camera: string;
  lighting: string;
  transitionIn: string;
  transitionOut: string;
  dialogue: string;
  audioSfx: string[];
  music: string;
  referenceUsage: string[];
  textInImage: string[];
  metadataLabels?: string[];
  mustAvoid: string[];
}

export interface StoryboardProject {
  title: string;
  sourceProvenance: 'user' | 'approved_assistant' | 'assistant_draft';
  /**
   * Number of beat/scene sections the parser recognized in the
   * source script BEFORE any end-card extraction or scene
   * normalization. Available when the script could be split into
   * discrete beats (markdown table rows, "Beat N" headings, inline
   * beat markers). Undefined when the source was a free-form
   * description with no parseable structure. Downstream consumers
   * use this to distinguish "the script was 12 beats and the parser
   * legitimately routed beat 12 into endCard" (parsedSectionCount=12,
   * scenes=11) from "the script genuinely listed only 11 beats"
   * (parsedSectionCount=11, scenes=11).
   */
  parsedSectionCount?: number;
  durationSec: number | null;
  outputAspectRatio: string;
  frameAspectRatio: string;
  targetVideoAspectRatio: string;
  boardDimensions?: string;
  boardLayout: StoryboardLayoutKind;
  layoutSource?: StoryboardPlanningSource;
  planningContract?: StoryboardPlanningContract;
  metadataLabels?: string[];
  intendedUse: string;
  references: ReferenceAsset[];
  creativeBrief: {
    concept: string;
    storySpine: string;
    toneProgression: string[];
    productFeatureMap: string[];
    mustInclude: string[];
    mustAvoid: string[];
    brandRules: string[];
    visualQualityBar: string;
  };
  voiceover: {
    fullScript: string;
    lines: VoiceLine[];
  };
  scenes: SceneSpec[];
  endCard: {
    requiredText: string[];
    logoUsage: string;
    backgroundStyle: string;
    composition: string;
  };
}

export interface StoryboardTimingRules {
  normalWordsPerSecondMin: number;
  normalWordsPerSecondMax: number;
  fastWordsPerSecondMax: number;
  minEndCardHoldSec: number;
  minPunchlineSec: number;
  toleranceSec: number;
}

export interface StoryboardTimingIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  sceneId?: string;
  repair?: string;
}

export interface StoryboardTimingValidationResult {
  ok: boolean;
  issues: StoryboardTimingIssue[];
  totalSceneDurationSec: number | null;
  timedSceneCount: number;
}

export interface StoryboardPromptLintResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface StoryboardCompiledPromptAuditIssue {
  code: string;
  message: string;
  field?: string;
  metadata?: Record<string, unknown>;
}

export interface StoryboardCompiledPromptAuditResult {
  ok: boolean;
  fatalIssues: StoryboardCompiledPromptAuditIssue[];
  warnings: StoryboardCompiledPromptAuditIssue[];
}

export interface StoryboardCompiledPromptAuditOptions {
  prompt: string;
  sourceText?: string | null;
  expectedFrameCount?: number | null;
  expectedDurationSec?: number | null;
}

interface StoryboardReferencePromptRole {
  index: number;
  role: string;
  subjectHint?: string;
  usage: string;
  preserve: string;
}

const DEFAULT_STORYBOARD_TIMING_RULES: StoryboardTimingRules = {
  normalWordsPerSecondMin: 2.0,
  normalWordsPerSecondMax: 3.0,
  fastWordsPerSecondMax: 3.75,
  minEndCardHoldSec: 2.0,
  minPunchlineSec: 0.5,
  toleranceSec: 0.25,
};

function storyboardGcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function formatStoryboardRatio(width: number, height: number): string {
  const divisor = storyboardGcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function ratioFromStoryboardAspectWords(value: string): string {
  if (/^(?:portrait|vertical|9\s*:\s*16)$/i.test(value.trim())) return '9:16';
  if (/^(?:landscape|horizontal|widescreen|16\s*:\s*9)$/i.test(value.trim())) return '16:9';

  const match = value.match(/(\d{1,4})\s*:\s*(\d{1,4})/);
  if (!match) return value;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return '';
  }
  return `${width}:${height}`;
}

function inferStoryboardBoardAspectDirective(text: string): string | null {
  const aspectToken = String.raw`(?:portrait|vertical|landscape|horizontal|widescreen|\d{1,4}\s*:\s*\d{1,4})`;
  const patterns = [
    /\bStoryboard layout target\s*:\s*board\s+([^\n;,]+)/i,
    /\bStoryboard layout\s*:[^\n]*\bboard\s+([^\n;,]+)/i,
    /\bDEFAULT STORYBOARD PAGE LAYOUT\s*:\s*Use a\s+([^\n.]+?)\s+storyboard\s+canvas\/page\b/i,
    /\bOverall storyboard canvas(?:\s+aspect ratio)?\s*:\s*(?:\d{3,5}\s*x\s*\d{3,5}\s+pixels\s*\()?([^\n.)]+)/i,
    new RegExp(String.raw`\b(${aspectToken})(?:\s*\([^)]{0,80}\))?[^\n]{0,120}\b(?:video\s+)?(?:story\s*board|storyboard)\s+(?:image|sheet|layout|page|board|canvas)\b`, 'i'),
    new RegExp(String.raw`\b(?:story\s*board|storyboard)?\s*(?:board|canvas|page|sheet)\b[^\n]{0,80}\b(?:must|should|use|be|is|as|at)\b[^\n]{0,80}\b(${aspectToken})\b`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const ratio = ratioFromStoryboardAspectWords(match[1]);
    if (ratio) return ratio;
  }

  return null;
}

function inferStoryboardAspectNearUnit(
  text: string,
  unitPattern: string,
  rejectBetweenPattern: RegExp,
): string | null {
  const aspectPattern = /\b(portrait|vertical|landscape|horizontal|widescreen|\d{1,4}\s*:\s*\d{1,4})\b/gi;
  const unit = new RegExp(String.raw`\b(?:${unitPattern})\b`, 'i');
  const candidates: Array<{ ratio: string; distance: number; specificity: number }> = [];

  for (const match of text.matchAll(aspectPattern)) {
    const aspect = match[1];
    const numericAspect = aspect.match(/^(\d{1,4})\s*:\s*(\d{1,4})$/);
    if (numericAspect && ratioMatchLooksLikeMediaTimecodeRange(text, {
      ...match,
      0: match[0],
      1: numericAspect[1],
      2: numericAspect[2],
    } as RegExpMatchArray)) {
      continue;
    }
    const ratio = ratioFromStoryboardAspectWords(aspect);
    if (!ratio) continue;
    const specificity = /\d/.test(aspect) ? 0 : 1;
    const start = match.index ?? 0;
    const end = start + match[0].length;

    const after = text.slice(end, Math.min(text.length, end + 80));
    const afterUnit = after.match(unit);
    if (afterUnit?.index !== undefined) {
      const between = after.slice(0, afterUnit.index);
      if (!rejectBetweenPattern.test(between)) {
        candidates.push({ ratio, distance: between.length, specificity });
      }
    }

    const before = text.slice(Math.max(0, start - 80), start);
    const beforeUnitMatches = Array.from(before.matchAll(new RegExp(String.raw`\b(?:${unitPattern})\b`, 'gi')));
    const beforeUnit = beforeUnitMatches[beforeUnitMatches.length - 1];
    if (beforeUnit?.index !== undefined) {
      const between = before.slice(beforeUnit.index + beforeUnit[0].length);
      if (!rejectBetweenPattern.test(between)) {
        candidates.push({ ratio, distance: between.length, specificity });
      }
    }
  }

  candidates.sort((a, b) => a.specificity - b.specificity || a.distance - b.distance);
  return candidates[0]?.ratio ?? null;
}

function inferStoryboardBoardAspectRatio(text: string): string {
  const boardDirective = inferStoryboardBoardAspectDirective(text);
  if (boardDirective) return boardDirective;

  const explicitPixels = inferExplicitPixelDimensionsFromText(text);
  if (explicitPixels) {
    return formatStoryboardRatio(explicitPixels.width, explicitPixels.height);
  }

  const boardAspect = inferStoryboardAspectNearUnit(
    text,
    String.raw`board|canvas|image|poster|sheet|layout|story\s*board|storyboard|output`,
    /\b(?:cell|cells|frame|frames|panel|panels|still|stills|thumbnail|thumbnails|shot|shots|video)\b/i,
  );
  if (boardAspect) return boardAspect;

  const explicitRatio = inferExplicitAspectRatioFromText(text);
  if (explicitRatio) return `${explicitRatio.width}:${explicitRatio.height}`;

  if (textMentionsPortraitSocialFormat(text)) return '9:16';

  return '16:9';
}

function inferExplicitStoryboardTargetVideoAspectRatio(text: string): string | null {
  const storyboardLayoutTarget = text.match(
    /\bStoryboard layout(?: target)?\s*:[^\n]*\bvideo\s+(\d{1,4})\s*:\s*(\d{1,4})\b/i,
  );
  if (storyboardLayoutTarget) {
    const width = Number(storyboardLayoutTarget[1]);
    const height = Number(storyboardLayoutTarget[2]);
    if (width > 0 && height > 0) return `${width}:${height}`;
  }

  const videoOutputAspect = inferStoryboardAspectNearUnit(
    text,
    String.raw`target\s+video|final\s+video|output\s+video|video\s+output|actual\s+video|seedance\s+video`,
    /\b(?:story\s*board|storyboard|board|canvas|page|sheet|poster)\b/i,
  );
  if (videoOutputAspect) return videoOutputAspect;

  const explicitTargetPattern = /\b(?:target|final|output|actual|seedance|video|clip|film|commercial|promo)\b([\s\S]{0,80}?)\b(\d{1,4})\s*:\s*(\d{1,4})\b/gi;
  for (const explicitTarget of text.matchAll(explicitTargetPattern)) {
    const between = explicitTarget[1] ?? '';
    if (/\b(?:story\s*board|storyboard|board|canvas|page|sheet|poster)\b/i.test(between)) continue;
    const fullMatch = explicitTarget[0] ?? '';
    const ratioInMatch = fullMatch.match(/(\d{1,4})\s*:\s*(\d{1,4})\s*$/);
    if (ratioInMatch?.index !== undefined && ratioMatchLooksLikeMediaTimecodeRange(text, {
      ...ratioInMatch,
      index: (explicitTarget.index ?? 0) + ratioInMatch.index,
    } as RegExpMatchArray)) {
      continue;
    }
    const width = Number(explicitTarget[2]);
    const height = Number(explicitTarget[3]);
    if (width > 0 && height > 0) return `${width}:${height}`;
  }

  return null;
}

type StoryboardTargetVideoAspectSource = 'explicit_ratio' | 'orientation_cue' | 'board_fallback';

function inferStoryboardTargetVideoAspect(
  text: string,
  boardAspectRatio: string,
  explicitTargetVideoAspectRatio: string | null = inferExplicitStoryboardTargetVideoAspectRatio(text),
): { aspectRatio: string; source: StoryboardTargetVideoAspectSource } {
  if (explicitTargetVideoAspectRatio) {
    return { aspectRatio: explicitTargetVideoAspectRatio, source: 'explicit_ratio' };
  }

  if (/\b(?:portrait|vertical|9\s*:\s*16)\b/i.test(text) || textMentionsPortraitSocialFormat(text)) {
    return { aspectRatio: '9:16', source: 'orientation_cue' };
  }
  if (/\b(?:landscape|horizontal|widescreen|16\s*:\s*9|youtube)\b/i.test(text)) {
    return { aspectRatio: '16:9', source: 'orientation_cue' };
  }

  return { aspectRatio: boardAspectRatio, source: 'board_fallback' };
}

function inferStoryboardTargetVideoAspectRatio(text: string, boardAspectRatio: string): string {
  return inferStoryboardTargetVideoAspect(text, boardAspectRatio).aspectRatio;
}

function inferStoryboardCellAspectRatio(text: string, targetVideoAspectRatio: string): string {
  const explicitCell = inferStoryboardAspectNearUnit(
    text,
    String.raw`cell|cells|frame|frames|panel|panels|still|stills|thumbnail|thumbnails|shot|shots`,
    /\b(?:board|canvas|image|poster|sheet|layout|story\s*board|storyboard|output|format)\b/i,
  );
  if (explicitCell) {
    return explicitCell;
  }

  if (/\b(?:portrait|vertical|9\s*:\s*16)\b[\s\S]{0,80}\b(?:cell|cells|frame|frames|panel|panels|still|stills|thumbnail|thumbnails|shot|shots)\b/i.test(text)) {
    return '9:16';
  }
  if (/\b(?:cell|cells|frame|frames|panel|panels|still|stills|thumbnail|thumbnails|shot|shots)\b[\s\S]{0,80}\b(?:portrait|vertical|9\s*:\s*16)\b/i.test(text)) {
    return '9:16';
  }
  if (/\b(?:landscape|horizontal|widescreen|letterbox|16\s*:\s*9)\b[\s\S]{0,80}\b(?:cell|cells|frame|frames|panel|panels|still|stills|thumbnail|thumbnails|shot|shots)\b/i.test(text)) {
    return '16:9';
  }
  if (/\b(?:cell|cells|frame|frames|panel|panels|still|stills|thumbnail|thumbnails|shot|shots)\b[\s\S]{0,80}\b(?:landscape|horizontal|widescreen|letterbox|16\s*:\s*9)\b/i.test(text)) {
    return '16:9';
  }

  return targetVideoAspectRatio;
}

function describeVideoFrameShape(cellAspectRatio: string): string {
  const cellOrientation = parseAspectRatioOrientation(cellAspectRatio);
  if (cellOrientation === 'portrait') return `tall ${cellAspectRatio} portrait video-frame rectangle`;
  if (cellOrientation === 'landscape') return `wide ${cellAspectRatio} landscape video-frame rectangle`;
  if (cellOrientation === 'square') return `square ${cellAspectRatio} video-frame area`;
  return `${cellAspectRatio} video-frame rectangle`;
}

function describePortraitLetterboxCellArrangement(frameCount: number, cellAspectRatio: string): string {
  const frameShape = describeVideoFrameShape(cellAspectRatio);

  if (frameCount <= 4) {
    return `${frameCount} numbered scene slots, each containing one ${frameShape}, stacked in a portrait sheet with compact labels outside the rectangles`;
  }

  const columns = frameCount <= 8 ? 2 : frameCount <= 15 ? 3 : 4;
  const rows = Math.ceil(frameCount / columns);
  const unusedSlotNote = columns * rows > frameCount
    ? ['use unused grid slots as margin/notes space only']
    : [];
  return [
    `${frameCount} numbered scene slots arranged as a ${columns}-column x ${rows}-row grid inside a portrait sheet`,
    `each slot contains one ${frameShape} with compact labels outside the rectangle`,
    ...unusedSlotNote,
  ].join('; ');
}

function describeLandscapePortraitCellArrangement(frameCount: number, cellAspectRatio: string): string {
  const frameShape = describeVideoFrameShape(cellAspectRatio);

  if (frameCount <= 4) {
    return `${frameCount} numbered scene slots, each containing one ${frameShape}, arranged cleanly inside a landscape board with compact labels outside the rectangles`;
  }

  const rows = frameCount <= 8 ? 2 : frameCount <= 15 ? 3 : 4;
  const columns = Math.ceil(frameCount / rows);
  const unusedSlotNote = columns * rows > frameCount
    ? ['use unused grid slots as margin/notes space only']
    : [];
  return [
    `${frameCount} numbered scene slots arranged as a ${rows}-row x ${columns}-column grid inside a landscape board`,
    `each slot contains one ${frameShape} with compact labels outside the rectangle`,
    ...unusedSlotNote,
  ].join('; ');
}

function parseAspectRatioPair(aspectRatio: string): { width: number; height: number } | null {
  const normalized = normalizeAspectRatio(aspectRatio);
  if (!normalized) return null;
  const [widthText, heightText] = normalized.split(':');
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function reduceRatioString(width: number, height: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const divisor = gcdInt(w, h);
  return `${w / divisor}:${h / divisor}`;
}

// Long-axis-first balanced slot grid for a given count. The first number is the
// slot count along the "long" axis of each cell — i.e. the axis that gets more
// cells when cells are not square — so callers can orient it: cols for portrait
// cells, rows for landscape cells.
function pickBalancedSlotGrid(frameCount: number): { major: number; minor: number } {
  const clamped = Math.max(1, Math.min(24, Math.round(frameCount)));
  const table: ReadonlyArray<readonly [number, number]> = [
    [1, 1], [2, 1], [3, 1], [2, 2],
    [3, 2], [3, 2], [4, 2], [4, 2],
    [3, 3], [4, 3], [4, 3], [4, 3],
    [5, 3], [5, 3], [5, 3], [4, 4],
    [5, 4], [5, 4], [5, 4], [5, 4],
    [6, 4], [6, 4], [6, 4], [6, 4],
  ];
  const [major, minor] = table[clamped - 1];
  return { major, minor };
}

const STORYBOARD_BOARD_TARGET_PIXEL_BUDGET = 4_000_000;
const STORYBOARD_BOARD_MIN_PIXEL_BUDGET = 720_000;
const STORYBOARD_BOARD_MAX_PIXEL_BUDGET = 8_000_000;
const STORYBOARD_BOARD_MAX_EDGE = 3840;
const STORYBOARD_BOARD_MIN_EDGE = 768;
const STORYBOARD_BOARD_DIMENSION_MULTIPLE = 16;

function snapStoryboardDimension(value: number): number {
  const snapped = Math.round(value / STORYBOARD_BOARD_DIMENSION_MULTIPLE) * STORYBOARD_BOARD_DIMENSION_MULTIPLE;
  return Math.max(STORYBOARD_BOARD_MIN_EDGE, Math.min(STORYBOARD_BOARD_MAX_EDGE, snapped));
}

function pickStoryboardBoardPixelDimensions(
  boardRatioWidth: number,
  boardRatioHeight: number,
): { width: number; height: number } {
  if (
    !Number.isFinite(boardRatioWidth)
    || !Number.isFinite(boardRatioHeight)
    || boardRatioWidth <= 0
    || boardRatioHeight <= 0
  ) {
    return { width: 2560, height: 1440 };
  }
  const ratio = boardRatioWidth / boardRatioHeight;
  let width = Math.sqrt(STORYBOARD_BOARD_TARGET_PIXEL_BUDGET * ratio);
  let height = width / ratio;

  if (width > STORYBOARD_BOARD_MAX_EDGE) {
    width = STORYBOARD_BOARD_MAX_EDGE;
    height = width / ratio;
  }
  if (height > STORYBOARD_BOARD_MAX_EDGE) {
    height = STORYBOARD_BOARD_MAX_EDGE;
    width = height * ratio;
  }

  const snappedWidth = snapStoryboardDimension(width);
  const snappedHeight = snapStoryboardDimension(height);
  const totalPixels = snappedWidth * snappedHeight;
  if (totalPixels < STORYBOARD_BOARD_MIN_PIXEL_BUDGET) {
    const scale = Math.sqrt(STORYBOARD_BOARD_MIN_PIXEL_BUDGET / totalPixels);
    return {
      width: snapStoryboardDimension(snappedWidth * scale),
      height: snapStoryboardDimension(snappedHeight * scale),
    };
  }
  if (totalPixels > STORYBOARD_BOARD_MAX_PIXEL_BUDGET) {
    const scale = Math.sqrt(STORYBOARD_BOARD_MAX_PIXEL_BUDGET / totalPixels);
    return {
      width: snapStoryboardDimension(snappedWidth * scale),
      height: snapStoryboardDimension(snappedHeight * scale),
    };
  }
  return { width: snappedWidth, height: snappedHeight };
}

export interface BalancedStoryboardGrid {
  cols: number;
  rows: number;
  boardAspectRatio: string;
  /** Snapped pixel width of the storyboard sheet. */
  width: number;
  /** Snapped pixel height of the storyboard sheet. */
  height: number;
  /** Convenience `${width}x${height}` string for prompt/argument insertion. */
  boardDimensions: string;
}

// Pick a (cols, rows) grid whose geometry hosts cells of the given cellAspectRatio
// natively, then derive a board aspect ratio and snapped pixel dimensions. This
// avoids the "9:16 cells inside a 16:9 board" trap where prompt prose tells the
// model "9:16 portrait cells" but the canvas physically forces cells to ~4:3
// landscape.
export function chooseBalancedStoryboardGrid(
  frameCount: number,
  cellAspectRatio: string,
): BalancedStoryboardGrid {
  const pair = parseAspectRatioPair(cellAspectRatio) ?? { width: 16, height: 9 };
  const orientation = parseAspectRatioOrientation(cellAspectRatio);
  const slotGrid = pickBalancedSlotGrid(frameCount);
  const cols = orientation === 'landscape' ? slotGrid.minor : slotGrid.major;
  const rows = orientation === 'landscape' ? slotGrid.major : slotGrid.minor;
  const boardRatioWidth = cols * pair.width;
  const boardRatioHeight = rows * pair.height;
  const boardAspectRatio = reduceRatioString(boardRatioWidth, boardRatioHeight);
  const { width, height } = pickStoryboardBoardPixelDimensions(boardRatioWidth, boardRatioHeight);
  return {
    cols,
    rows,
    boardAspectRatio,
    width,
    height,
    boardDimensions: `${width}x${height}`,
  };
}

function describeSingleOrientationStoryboardArrangement(
  boardAspectRatio: string,
  cellAspectRatio: string,
  frameCount: number,
): Pick<StoryboardLayoutSpec, 'layoutKind' | 'layoutDescription'> {
  const boardOrientation = parseAspectRatioOrientation(boardAspectRatio);
  const cellOrientation = parseAspectRatioOrientation(cellAspectRatio);
  const frameShape = describeVideoFrameShape(cellAspectRatio);
  const slotGrid = pickBalancedSlotGrid(frameCount);
  const cols = cellOrientation === 'landscape' ? slotGrid.minor : slotGrid.major;
  const rows = cellOrientation === 'landscape' ? slotGrid.major : slotGrid.minor;
  const unusedSlotNote = cols * rows > frameCount
    ? ['use unused grid slots as margin/notes space only']
    : [];

  if (boardOrientation === 'portrait') {
    return {
      layoutKind: 'portrait_grid',
      layoutDescription: [
        `${frameCount} numbered scene slots arranged as a ${cols}-column x ${rows}-row grid inside a portrait storyboard sheet`,
        `each slot contains one ${frameShape} with compact labels outside the rectangle`,
        ...unusedSlotNote,
      ].join('; '),
    };
  }

  const boardLabel = boardOrientation === 'square' ? 'square board' : 'landscape board';
  return {
    layoutKind: 'landscape_grid',
    layoutDescription: [
      `${frameCount} numbered scene slots arranged as a ${rows}-row x ${cols}-column grid inside a ${boardLabel}`,
      `each slot contains one ${frameShape} with compact labels outside the rectangle`,
      ...unusedSlotNote,
    ].join('; '),
  };
}

function describeStoryboardLayout(
  boardAspectRatio: string,
  cellAspectRatio: string,
  frameCount: number,
): Pick<StoryboardLayoutSpec, 'layoutKind' | 'layoutDescription'> {
  const boardOrientation = parseAspectRatioOrientation(boardAspectRatio);
  const cellOrientation = parseAspectRatioOrientation(cellAspectRatio);

  if (boardOrientation === 'portrait' && cellOrientation === 'landscape') {
    return {
      layoutKind: 'portrait_letterbox_cells',
      layoutDescription: describePortraitLetterboxCellArrangement(frameCount, cellAspectRatio),
    };
  }

  if (boardOrientation === 'landscape' && cellOrientation === 'portrait') {
    return {
      layoutKind: 'landscape_portrait_cells',
      layoutDescription: describeLandscapePortraitCellArrangement(frameCount, cellAspectRatio),
    };
  }

  return describeSingleOrientationStoryboardArrangement(boardAspectRatio, cellAspectRatio, frameCount);
}

function normalizeStoryboardBoardDimensions(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/\b(\d{3,5})\s*[x:]\s*(\d{3,5})\b/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return `${Math.trunc(width)}x${Math.trunc(height)}`;
}

function storyboardPlanningSourceFromContract(
  contract: StoryboardPlanningContract | null | undefined,
): StoryboardPlanningSource {
  return contract?.layout?.source ?? contract?.source ?? 'fallback_text';
}

function applyStoryboardPlanningLayoutContract(
  fallback: StoryboardLayoutSpec,
  contract: StoryboardPlanningContract | null | undefined,
  frameCount: number,
  userDefinedCanvas: boolean,
  userDefinedTargetVideoAspect: boolean,
): StoryboardLayoutSpec {
  const layoutContract = contract?.layout;
  if (!layoutContract) return fallback;
  const layoutSource = storyboardPlanningSourceFromContract(contract);
  const contractUserDefinedCanvas = typeof layoutContract.storyboardCanvasSpecifiedByUser === 'boolean'
    ? layoutContract.storyboardCanvasSpecifiedByUser
    : userDefinedCanvas;
  const contractOwnsCanvas =
    contractUserDefinedCanvas
    || layoutSource === 'assistant_metadata'
    || layoutSource === 'user_schema';

  const boardAspectRatio = contractOwnsCanvas
    ? normalizeAspectRatio(layoutContract.storyboardCanvasAspectRatio) ?? fallback.boardAspectRatio
    : fallback.boardAspectRatio;
  const contractOwnsVideoGeometry =
    !userDefinedTargetVideoAspect
    || layoutSource === 'user_schema';
  const cellAspectRatio = contractOwnsVideoGeometry
    ? normalizeAspectRatio(layoutContract.storyboardCellAspectRatio) ?? fallback.cellAspectRatio
    : fallback.cellAspectRatio;
  const targetVideoAspectRatio = contractOwnsVideoGeometry
    ? normalizeAspectRatio(layoutContract.targetVideoAspectRatio) ?? cellAspectRatio ?? fallback.targetVideoAspectRatio
    : fallback.targetVideoAspectRatio;
  const layout = describeStoryboardLayout(boardAspectRatio, cellAspectRatio, frameCount);
  const contractBoardDimensions = contractOwnsCanvas
    ? normalizeStoryboardBoardDimensions(layoutContract.boardDimensions)
    : null;
  const boardDimensions = contractOwnsCanvas
    ? (storyboardBoardDimensionsMatchAspect(contractBoardDimensions, boardAspectRatio)
      ? contractBoardDimensions
      : null)
      ?? (userDefinedCanvas ? fallback.boardDimensions : undefined)
    : fallback.boardDimensions;

  return {
    boardAspectRatio,
    cellAspectRatio,
    targetVideoAspectRatio,
    ...layout,
    ...(boardDimensions ? { boardDimensions } : {}),
  };
}

/**
 * True when `boardDimensions` ("WxH") is within ~10% of the orientation
 * implied by `boardAspectRatio`. Rejects LLM-emitted planning contracts
 * that put landscape dimensions on a portrait-stated board (or vice
 * versa), in which case callers should fall back to the computed
 * canvas. The 10% slack tolerates rounding to multiples of 16.
 */
function storyboardBoardDimensionsMatchAspect(
  boardDimensions: string | null,
  boardAspectRatio: string | null,
): boolean {
  if (!boardDimensions) return false;
  const match = boardDimensions.match(/^(\d+)x(\d+)$/i);
  if (!match) return false;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  const normalized = normalizeAspectRatio(boardAspectRatio);
  const targetPair = normalized ? parseAspectRatioPair(normalized) : null;
  if (!targetPair) return true;
  const targetRatio = targetPair.width / targetPair.height;
  const actualRatio = width / height;
  if (!Number.isFinite(targetRatio) || targetRatio <= 0) return true;
  const ratioError = Math.abs(actualRatio - targetRatio) / targetRatio;
  return ratioError <= 0.1;
}

export function inferStoryboardLayoutSpec(
  userIntentText: string,
  frameCount: number,
  planningContract?: StoryboardPlanningContract | null,
  /**
   * Text that carries *genuine* user/host-stated geometry authority. Only an
   * explicit ratio or orientation cue found here may override a typed planning
   * contract's video geometry. Defaults to `userIntentText` so direct callers
   * are unchanged; `buildStoryboardProject` passes a narrower value that
   * excludes approved-script / assistant-draft prose, so a stale `16:9` line in
   * a drafted script body never masquerades as user authority over an
   * `llm_schema`/`assistant_metadata` planning contract.
   */
  geometryAuthorityText: string = userIntentText,
): StoryboardLayoutSpec {
  const planningLayout = planningContract?.layout;
  const userDefinedCanvas = typeof planningLayout?.storyboardCanvasSpecifiedByUser === 'boolean'
    ? planningLayout.storyboardCanvasSpecifiedByUser
    : userDefinedStoryboardCanvas(userIntentText);
  const explicitPixels = userDefinedCanvas ? inferExplicitStoryboardCanvasPixelDimensions(userIntentText) : null;
  const explicitTargetVideoAspectRatio = inferExplicitStoryboardTargetVideoAspectRatio(userIntentText);
  const provisionalBoardAspectRatio = userDefinedCanvas
    ? inferStoryboardBoardAspectRatio(userIntentText)
    : '16:9';
  const inferredTargetVideoAspect = inferStoryboardTargetVideoAspect(
    userIntentText,
    provisionalBoardAspectRatio,
    explicitTargetVideoAspectRatio,
  );
  const inferredTargetVideoAspectRatio = inferredTargetVideoAspect.aspectRatio;
  // The authority flag (whether a stated video aspect may override a typed
  // planning contract) is derived from the genuine user/host geometry text
  // only — not from approved-script prose blended into the inference text.
  const authorityTargetVideoAspect = geometryAuthorityText === userIntentText
    ? inferredTargetVideoAspect
    : inferStoryboardTargetVideoAspect(geometryAuthorityText, provisionalBoardAspectRatio);
  const userDefinedTargetVideoAspect = authorityTargetVideoAspect.source !== 'board_fallback';
  const cellAspectRatio = inferStoryboardCellAspectRatio(userIntentText, inferredTargetVideoAspectRatio);
  const targetVideoAspectRatio = explicitTargetVideoAspectRatio ?? cellAspectRatio;

  const balancedGrid = userDefinedCanvas
    ? null
    : chooseBalancedStoryboardGrid(frameCount, cellAspectRatio);
  const boardAspectRatio = balancedGrid?.boardAspectRatio ?? provisionalBoardAspectRatio;
  const layout = describeStoryboardLayout(boardAspectRatio, cellAspectRatio, frameCount);

  const fallback = {
    boardAspectRatio,
    cellAspectRatio,
    targetVideoAspectRatio,
    ...layout,
    ...(explicitPixels
      ? { boardDimensions: `${explicitPixels.width}x${explicitPixels.height}` }
      : userDefinedCanvas
        ? {}
        : { boardDimensions: balancedGrid?.boardDimensions ?? GPT_IMAGE_STORYBOARD_DEFAULTS.storyboardLandscape.aspectRatio }),
  };
  return applyStoryboardPlanningLayoutContract(
    fallback,
    planningContract,
    frameCount,
    userDefinedCanvas,
    userDefinedTargetVideoAspect,
  );
}

function clampStoryboardDefaultFrameCount(value: number): number {
  return Math.max(STORYBOARD_DEFAULT_MIN_FRAMES, Math.min(STORYBOARD_DEFAULT_MAX_FRAMES, Math.round(value)));
}

function defaultStoryboardFrameCountForDuration(durationSeconds: number): number {
  return clampStoryboardDefaultFrameCount(Math.ceil(durationSeconds / 2));
}

function normalizeStoryboardCountToken(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[\s-]/g, '');
  const parsed = /^\d+$/.test(normalized)
    ? Number(normalized)
    : STORYBOARD_COUNT_WORDS[normalized];
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 24 ? parsed : null;
}

export function inferExplicitStoryboardFrameCountFromText(text: string): number | null {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    // Aspect-ratio dimensions describe each frame, not the number of frames.
    // Remove the whole ratio so its trailing number cannot become a count.
    .replace(/\b\d{1,5}\s*:\s*\d{1,5}\b/g, ' ')
    .trim();
  if (!normalized) return null;

  const countToken = String.raw`(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[-\s]?(?:one|two|three|four))?)`;
  // Whitelist of adjectives/modifiers commonly placed between an explicit
  // count and a storyboard unit (e.g. "12 clear beats", "5 quick panels").
  // The unit nouns below already anchor the match, so keeping a focused
  // adjective list avoids overreach while accepting natural phrasing.
  const countModifiers = String.raw`(?:(?:timed|timecoded|time-coded|sequential|distinct|separate|individual|video|storyboard|story-board|key|scene|shot|clean|clear|polished|portrait|landscape|widescreen|quick|short|tight|fast|crisp|simple|core|main|punchy|fun|cool|brief|concise|focused|solid|strong|bold|sharp|smooth|seamless|cinematic|dynamic|engaging|compelling|powerful|tasty|tight-knit)\s+){0,5}`;
  const storyboardUnits = String.raw`(?:panels?|frames?|storyboard\s+frames?|shots?|keyframes?|beats?|cells?|stills?|thumbnails?)`;
  const candidates: number[] = [];
  const patterns = [
    new RegExp(String.raw`\b(${countToken})\s*[- ]?\s*${countModifiers}${storyboardUnits}\b`, 'gi'),
    new RegExp(String.raw`\b${storyboardUnits}\s*(?:count|total)?\s*[:=]\s*(${countToken})\b`, 'gi'),
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const count = normalizeStoryboardCountToken(match[1]);
      if (count !== null) candidates.push(count);
    }
  }

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function inferMarkdownStoryboardTableFrameCount(text: string): number | null {
  let activeHeader: string[] | null = null;
  let activeCount = 0;
  let activeLooksLikeStoryboard = false;
  const counts: number[] = [];
  const timecodedRowCount = text
    .split(/\r?\n/)
    .filter(line => {
      if (!line.trim().startsWith('|')) return false;
      return /\b(?:\d{1,2}:\d{2}(?:\.\d+)?|\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?\s*(?:-|to|\u2013|\u2014)\s*(?:\d{1,2}:\d{2}(?:\.\d+)?|\d{1,3}(?:\.\d+)?)\b/i.test(line);
    })
    .length;

  const flushActiveTable = () => {
    if (activeLooksLikeStoryboard && activeCount >= 1 && activeCount <= 24) {
      counts.push(activeCount);
    }
    activeHeader = null;
    activeCount = 0;
    activeLooksLikeStoryboard = false;
  };

  for (const line of text.split(/\r?\n/)) {
    const cells = storyboardMarkdownCountTableCells(line);
    if (cells.length < 3) {
      if (!storyboardMarkdownTableSeparatorLine(line)) flushActiveTable();
      continue;
    }

    if (looksLikeStoryboardCountTableHeader(cells)) {
      flushActiveTable();
      activeHeader = cells;
      activeLooksLikeStoryboard = true;
      continue;
    }

    if (!activeLooksLikeStoryboard && cells.some(cell => extractStoryboardTimingMarker(cell) !== null)) {
      activeHeader = activeHeader ?? [];
      activeLooksLikeStoryboard = true;
    }

    if (activeLooksLikeStoryboard && storyboardTableRowLooksLikeCountedBeat(cells, activeHeader)) {
      activeCount += 1;
    }
  }
  flushActiveTable();

  const count = counts[0] ?? (timecodedRowCount >= 1 && timecodedRowCount <= 24 ? timecodedRowCount : null);
  return count && count >= 1 && count <= 24 ? count : null;
}

export function inferStoryboardFrameCountFromScriptText(text: string | null | undefined): number | null {
  if (!text) return null;
  const canonicalText = canonicalStoryboardScriptContext(text) || text;
  const tableCount = inferMarkdownStoryboardTableFrameCount(canonicalText);
  if (tableCount) return tableCount;

  const sections = splitStoryboardSections(canonicalText);
  if (sections.length >= 1 && sections.length <= 24) return sections.length;

  return inferExplicitStoryboardFrameCountFromText(canonicalText);
}

function storyboardComplexityScore(text: string): number {
  let score = 0;
  const normalized = text.toLowerCase();
  const signals = [
    /\b(?:dialogue|voice\s*over|voiceover|vo|spoken|says?|speaker|character\s+lines?)\b/i,
    /\b(?:audio|sfx|foley|sound\s*effects?|music|score|ambience)\b/i,
    /\b(?:brand|logo|product|launch|commercial|ad|campaign|cta|end\s*card|title\s*card)\b/i,
    /\b(?:cast|characters?|mascot|protagonist|hero|villain|host|customer|crowd|people)\b/i,
    /\b(?:transform|transformation|journey|arc|storyline|narrative|beginning|middle|ending|reveal|twist)\b/i,
    /\b(?:uploaded|attached|provided|reference|image\s+\d|asset\s+\d)\b/i,
    /\b(?:transition|montage|sequence|timecoded|shot\s*list|beat\s*sheet)\b/i,
  ];

  for (const signal of signals) {
    if (signal.test(normalized)) score += 1;
  }

  const sentenceCount = (text.match(/[.!?]\s+|\n{2,}/g) || []).length + 1;
  if (sentenceCount >= 5) score += 1;
  if (sentenceCount >= 9) score += 1;

  return score;
}

function storyboardWordCount(text: string): number {
  const words = text.match(/\b[\w']+\b/g);
  return words ? words.length : 0;
}

export function inferDefaultStoryboardFrameCountFromText(text: string): number {
  const canonicalText = canonicalStoryboardScriptContext(text) || text;
  const scriptCount = inferStoryboardFrameCountFromScriptText(canonicalText);
  if (scriptCount) return clampStoryboardDefaultFrameCount(scriptCount);

  const duration = inferRequestedTotalVideoDurationSeconds(canonicalText);
  const durationFrameFloor = duration !== null
    ? defaultStoryboardFrameCountForDuration(duration)
    : null;
  const words = storyboardWordCount(canonicalText);
  const complexity = storyboardComplexityScore(canonicalText);

  let count = durationFrameFloor !== null
    ? durationFrameFloor
    : words <= 28
      ? 4
      : words <= 70
        ? 5
        : words <= 130
          ? 7
          : 9;

  if (complexity >= 6) {
    count += 2;
  } else if (complexity >= 3) {
    count += 1;
  }
  if (duration === null && words > 180) count += 1;
  if (durationFrameFloor !== null) count = Math.max(count, durationFrameFloor);

  return clampStoryboardDefaultFrameCount(count);
}

function inferReferencedStoryboardImageCount(text: string): number {
  let maxIndex = 0;
  for (const match of text.matchAll(/\b(?:uploaded|attached|provided|reference|source|input)?\s*(?:image|photo|picture|asset)\s*(?:#|number\s*)?(\d{1,2})\b/gi)) {
    if (match.index !== undefined && isStoryboardModelNameReference(text, match.index, match.index + match[0].length)) {
      continue;
    }
    maxIndex = Math.max(maxIndex, Number(match[1]));
  }
  return maxIndex;
}

function isStoryboardModelNameReference(text: string, start: number, end: number): boolean {
  const matched = text.slice(start, end).toLowerCase();
  if (!/\bimage\s*(?:#|number\s*)?2\b/.test(matched)) return false;

  const before = text.slice(Math.max(0, start - 24), start).toLowerCase();
  const after = text.slice(end, Math.min(text.length, end + 36)).toLowerCase();
  const compactContext = `${before}${matched}${after}`;
  return /\bgpt\s+image\s*2\b/.test(compactContext)
    || /\b(?:gpt[-\s]*)?image\s*2\s+(?:image\s+)?models?\b/.test(compactContext)
    || /\bimage\s*2\s+image[-\s]?to[-\s]?image\b/.test(compactContext);
}

function contextAroundStoryboardReference(text: string, index: number): string {
  const referenceWithSubjectInParens = new RegExp(
    String.raw`(?:^|[\n,;:*_\-\s])(?:uploaded|attached|provided|reference|source|input)?\s*(?:image|photo|picture|asset)\s*(?:#|number\s*)?${index}\s*\(\s*([^\)\n]{2,120}?)\s*\)\s*[:*_ -]*\s*([^\n]{0,160})`,
    'gi',
  );
  for (const match of text.matchAll(referenceWithSubjectInParens)) {
    if (match.index === undefined) continue;
    if (isStoryboardModelNameReference(text, match.index, match.index + match[0].length)) continue;
    const subject = compactStoryboardLine(stripStoryboardMarkup(match[1]));
    const tail = compactStoryboardLine(stripStoryboardMarkup(match[2] || ''));
    if (subject) return `${subject} (asset ${index})${tail ? ` ${tail}` : ''}`;
  }

  const parentheticalReferencePattern = new RegExp(
    String.raw`(?:^|[\n,;:])\s*([^,\n;()]{2,120}?)\s*\(\s*(?:uploaded|attached|provided|reference|source|input)?\s*(?:image|photo|picture|asset)\s*(?:#|number\s*)?${index}\s*\)`,
    'gi',
  );
  for (const match of text.matchAll(parentheticalReferencePattern)) {
    if (match.index === undefined) continue;
    if (isStoryboardModelNameReference(text, match.index, match.index + match[0].length)) continue;
    const subject = compactStoryboardLine(stripStoryboardMarkup(match[1]))
      .replace(/^(?:reference\s+assets?|uploaded\s+(?:images?|assets?)|attached\s+(?:images?|assets?)|provided\s+(?:images?|assets?)|assets?)\s*:\s*/i, '')
      .trim();
    if (subject) return `${subject} (asset ${index})`;
  }

  const patterns = [
    new RegExp(String.raw`\b(?:uploaded|attached|provided|reference|source|input)?\s*(?:image|photo|picture|asset)\s*(?:#|number\s*)?${index}\b`, 'i'),
    new RegExp(String.raw`\b${index}\b`, 'i'),
  ];

  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(new RegExp(pattern.source, 'gi')));
    for (const match of matches) {
      if (match.index === undefined) continue;
      if (isStoryboardModelNameReference(text, match.index, match.index + match[0].length)) continue;
      const lineStart = text.lastIndexOf('\n', match.index) + 1;
      const nextLineBreak = text.indexOf('\n', match.index);
      const lineEnd = nextLineBreak >= 0 ? nextLineBreak : text.length;
      const start = Math.max(0, lineStart);
      let end = Math.min(lineEnd, match.index + match[0].length + 140);
      const afterMatch = text.slice(match.index + match[0].length, end);
      const nextReference = afterMatch.search(
        /\b(?:uploaded|attached|provided|reference|source|input)?\s*(?:image|photo|picture|asset)\s*(?:#|number\s*)?\d{1,2}\b/i,
      );
      if (nextReference >= 0) {
        end = match.index + match[0].length + nextReference;
      }
      const afterCurrentReference = text.slice(match.index + match[0].length, end);
      const nextSentence = afterCurrentReference.search(/[.!?]\s+\S/);
      if (nextSentence >= 0) {
        end = Math.min(end, match.index + match[0].length + nextSentence + 1);
      }
      return text.slice(start, end);
    }
  }

  return text;
}

function cleanExplicitStoryboardReferenceSubject(value: string, index: number): string {
  const subjectMarkers = Array.from(value.matchAll(/\bSubject:\s*/gi));
  const lastSubjectMarker = subjectMarkers[subjectMarkers.length - 1];
  if (!lastSubjectMarker || lastSubjectMarker.index === undefined) return '';
  const subjectStart = lastSubjectMarker.index + lastSubjectMarker[0].length;
  const tail = value.slice(subjectStart);
  const nextField = tail.search(/\s+(?:Usage|Preserve):/i);
  const rawSubject = nextField >= 0 ? tail.slice(0, nextField) : tail;

  const cleaned = compactStoryboardLine(stripStoryboardMarkup(rawSubject))
    .replace(new RegExp(String.raw`\s*\(\s*asset\s*${index}\s*\)\s*`, 'i'), ' ')
    .replace(/^(?:character\/source subject|logo\/brand|product\/object|style\/environment|reference asset|character|logo|brand|product|style|environment|other)\s+references?\b\.?\s*/i, '')
    .replace(/[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (/^(?:logo|brand|character|mascot|asset|reference|image|photo|picture)$/i.test(cleaned)) return '';
  return cleaned.slice(0, 180).replace(/\s+\S*$/, match => cleaned.length > 180 ? '' : match).trim();
}

function cleanStoryboardReferenceSubjectHint(context: string, index: number): string {
  const source = compactStoryboardLine(stripStoryboardMarkup(context));
  const explicitSubject = cleanExplicitStoryboardReferenceSubject(source, index);
  if (explicitSubject) return explicitSubject;

  const inlineReference = new RegExp(
    String.raw`\b(?:uploaded|attached|provided|reference|source|input)?\s*(?:image|photo|picture|asset)\s*(?:#|number\s*)?${index}\b\s*(?:is|=|:|-)?\s*([^.;,\n]{2,120})`,
    'i',
  ).exec(source);
  if (inlineReference?.[1]) {
    const inlineSubject = compactStoryboardLine(stripStoryboardMarkup(inlineReference[1]))
      .replace(/\b(?:use|usage|preserve|reference|asset)\b[\s\S]*$/i, '')
      .replace(/[.\s]+$/g, '')
      .trim();
    if (inlineSubject && !/^(?:logo|brand|character|mascot|asset|reference|image|photo|picture)$/i.test(inlineSubject)) {
      return inlineSubject.slice(0, 180).replace(/\s+\S*$/, match => inlineSubject.length > 180 ? '' : match).trim();
    }
  }

  const cleaned = source
    .replace(new RegExp(String.raw`^(?:image|photo|picture|asset)\s*(?:#|number\s*)?${index}\s*(?:\([^)]*\))?\s*:?\s*`, 'i'), '')
    .replace(new RegExp(String.raw`^(?:uploaded|attached|provided|reference|source|input)\s+(?:image|photo|picture|asset)\s*(?:#|number\s*)?${index}\s*:?\s*`, 'i'), '')
    .replace(/\b(?:use|using|for|as|with|from|featuring|feature)\b\s*$/i, '')
    .replace(/[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (/^(?:logo|brand|character|mascot|asset|reference|image|photo|picture)$/i.test(cleaned)) return '';
  return cleaned.slice(0, 180).replace(/\s+\S*$/, match => cleaned.length > 180 ? '' : match).trim();
}

function inferStoryboardReferenceRole(index: number, text: string): StoryboardReferencePromptRole {
  const context = contextAroundStoryboardReference(text, index);
  const lower = context.toLowerCase();
  const subjectHint = cleanStoryboardReferenceSubjectHint(context, index);
  if (/\b(?:logo|wordmark|brand|mark|icon)\b/.test(lower)) {
    return {
      index,
      role: 'logo/brand reference',
      subjectHint,
      usage: /\b(?:end|final|card|cta|tagline|logo\s+reveal|brand\s+reveal)\b/.test(lower)
        ? 'end card only unless the approved script says otherwise'
        : 'brand moments and any explicitly assigned scenes',
      preserve: 'preserve the visible logo shape, typography, spacing, color relationships, and spelling as closely as possible',
    };
  }

  if (/\b(?:character|mascot|person|people|face|actor|host|protagonist|subject|hero|doll|toy|figure|avatar|girl|boy|woman|man)\b/.test(lower)) {
    return {
      index,
      role: 'character/source subject reference',
      subjectHint,
      usage: 'all scenes where that subject appears',
      preserve: 'preserve the visible identity, proportions, colors, outfit cues, expression, and recognizable silhouette',
    };
  }

  if (/\b(?:product|package|device|object|item)\b/.test(lower)) {
    return {
      index,
      role: 'product/object reference',
      subjectHint,
      usage: 'all scenes where that product or object appears',
      preserve: 'preserve the visible shape, materials, markings, proportions, and recognizable details',
    };
  }

  if (/\b(?:style|mood|look|palette|lighting|texture|background|environment|setting)\b/.test(lower)) {
    return {
      index,
      role: 'style/environment reference',
      subjectHint,
      usage: 'style, lighting, palette, or environment guidance where the approved brief calls for it',
      preserve: 'preserve the requested visual direction without copying unrelated content into every scene',
    };
  }

  return {
    index,
    role: 'reference asset',
    subjectHint,
    usage: 'use only where assigned by the approved brief',
    preserve: 'preserve visible details that the brief identifies as important',
  };
}

function storyboardReferenceKindFromRole(role: StoryboardReferencePromptRole): StoryboardReferenceKind {
  const lower = role.role.toLowerCase();
  if (lower.includes('character') || lower.includes('subject')) return 'character';
  if (lower.includes('logo') || lower.includes('brand')) return 'logo';
  if (lower.includes('product') || lower.includes('object')) return 'product';
  if (lower.includes('style')) return 'style';
  if (lower.includes('environment') || lower.includes('background')) return 'background';
  return 'other';
}

function storyboardUsageScopeFromRole(role: StoryboardReferencePromptRole): StoryboardUsageScope {
  const usage = role.usage.toLowerCase();
  if (/\b(?:end|final|card|cta)\b/.test(usage)) return 'end_card_only';
  if (/\b(?:assigned|specific|explicit)\b/.test(usage)) return 'specific_scenes';
  return 'global';
}

function storyboardPreservePriorityFromRole(role: StoryboardReferencePromptRole): StoryboardPreservePriority {
  const kind = storyboardReferenceKindFromRole(role);
  if (kind === 'logo' || kind === 'character' || kind === 'product') return 'critical';
  if (kind === 'style' || kind === 'background') return 'high';
  return 'medium';
}

function inferStoryboardReferenceRoles(text: string): StoryboardReferencePromptRole[] {
  const count = inferReferencedStoryboardImageCount(text);
  return Array.from({ length: count }, (_, index) => inferStoryboardReferenceRole(index + 1, text));
}

function buildStoryboardReferenceAssets(userIntentText: string, prompt: string): ReferenceAsset[] {
  return inferStoryboardReferenceRoles(`${userIntentText}\n${prompt}`).map(role => ({
    id: `image_${role.index}`,
    index: role.index,
    kind: storyboardReferenceKindFromRole(role),
    description: `${role.role}. ${role.subjectHint ? `Subject: ${role.subjectHint}. ` : ''}Usage: ${role.usage}. Preserve: ${role.preserve}.`,
    usageScope: storyboardUsageScopeFromRole(role),
    preservePriority: storyboardPreservePriorityFromRole(role),
  }));
}

function storyboardReferenceIndexFromText(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = normalized.match(/^(?:@?\s*)?(?:image|photo|picture|asset|uploaded\s+asset|uploaded\s+image)[\s_#-]*(\d{1,2})$/i)
    ?? normalized.match(/^image_(\d{1,2})$/i);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index > 0 ? index : null;
}

function looksLikeUnknownIndexedStoryboardReference(value: string): boolean {
  return /^(?:@?\s*)?(?:image|photo|picture|asset|uploaded\s+asset|uploaded\s+image)[\s_#-]*\d{1,2}$/i.test(value.trim())
    || /^image_\d{1,2}$/i.test(value.trim());
}

function normalizeStoryboardSceneReferenceUsage(
  referenceUsage: string[],
  references: ReferenceAsset[],
): string[] {
  if (referenceUsage.length === 0 || references.length === 0) return [];
  const knownById = new Map(references.map(ref => [ref.id.toLowerCase(), ref.id]));
  const knownByIndex = new Map(
    references
      .filter(ref => typeof ref.index === 'number')
      .map(ref => [ref.index as number, ref.id]),
  );

  const normalized: string[] = [];
  for (const raw of referenceUsage) {
    const value = raw.trim();
    if (!value) continue;
    const knownId = knownById.get(value.toLowerCase());
    if (knownId) {
      normalized.push(knownId);
      continue;
    }
    const index = storyboardReferenceIndexFromText(value);
    if (index !== null) {
      const id = knownByIndex.get(index);
      if (id) normalized.push(id);
      continue;
    }
    if (looksLikeUnknownIndexedStoryboardReference(value)) continue;
    normalized.push(value);
  }
  return uniqueStoryboardStrings(normalized);
}

function compileStoryboardReferenceSection(project: StoryboardProject): string[] {
  const refs = project.references;
  if (refs.length <= 0) {
    return [
      'REFERENCE IMAGES:',
      'Uploaded or supplied references: none listed for this storyboard image prompt.',
    ];
  }
  return [
    'REFERENCE IMAGES:',
    ...refs.map((ref, index) => {
      const modelRef = formatModelRef('gpt-image-2', ref.index ?? index + 1, 'image');
      return `${modelRef}: ${ref.description} Usage scope: ${ref.usageScope}. Preserve priority: ${ref.preservePriority}.`;
    }),
  ];
}

function extractStoryboardAvoidConstraints(text: string): string[] {
  const constraints: string[] = [];
  for (const match of text.matchAll(/\b(?:avoid|do not include|don't include|without|less)\b(?:(?!\b(?:avoid|do not include|don't include|without|less)\b)[^.!?\n]){0,220}/gi)) {
    const value = normalizeStoryboardAvoidConstraint(match[0]);
    if (
      value
      && !storyboardAvoidConstraintIsWorkflowControl(value)
      && !constraints.includes(value)
    ) {
      constraints.push(value);
    }
  }
  return constraints;
}

/**
 * Approval, confirmation, and review timing govern the agent workflow. They
 * are not visual/audio negatives for an image or video model. Keep this test
 * semantic and narrow so real creative constraints such as "without visible
 * subtitles" continue to reach the renderer.
 */
function storyboardAvoidConstraintIsWorkflowControl(value: string): boolean {
  const interaction = /\b(?:approval|confirmation|review|feedback|permission|user\s+input|user\s+response)\b/i;
  if (!interaction.test(value)) return false;

  const processAction = /\b(?:ask(?:ing)?|await(?:ing)?|wait(?:ing)?|pause|pausing|stop(?:ping)?|hold(?:ing)?|seek(?:ing)?|request(?:ing)?|require|requiring|check(?:ing)?|confirm(?:ing)?|approve|approving)\b/i;
  const workflowBoundary = /\b(?:workflow|stage|step|phase|round|generation|render|between|before|after|proceed|continu(?:e|ing))\b/i;
  return processAction.test(value) || workflowBoundary.test(value);
}

function normalizeStoryboardAvoidConstraint(value: string): string {
  const cleaned = compactStoryboardLine(stripStoryboardMarkup(value))
    .replace(/^[*\-_\s]+|[*\-_\s]+$/g, '')
    .replace(/\s+\.$/, '.')
    .trim();
  if (!cleaned) return '';
  const withoutLabel = cleaned
    .replace(/^(?:must\s+)?avoid\s*:?\s*/i, '')
    .replace(/^(?:do\s+not|don't)\s+include\s*:?\s*/i, '')
    .trim();
  if (/^(?:none|no|nothing|n\/a|not\s+specified|no\s+avoid(?:ance)?\s+list)\.?$/i.test(withoutLabel)) {
    return '';
  }
  return cleaned;
}

function extractStoryboardRequiredText(text: string): string[] {
  const required = new Set<string>();
  const inlineProductionLabelPattern = /\b(?:SFX|FX|Audio(?:\s*\/\s*SFX)?|Sound(?:s)?|Music|Foley|Dialogue(?:\s*\/\s*VO)?|VO|V\.O\.|Voiceover|Voice-over|Narration|Speech|Camera(?:\s*\/\s*Motion)?|Motion|Lighting(?:\s*\/\s*Style)?|Style|Transition|Action(?:\s*\/\s*Motion)?|Performance|Beat)\s*:\s*[^a-z0-9]{0,4}$/i;
  const visibleTextContextPattern = /\b(?:visible|on[-\s]?screen|in[-\s]?frame|text|copy|cta|tagline|headline|title\s+card|caption|subtitle|super|wordmark|spell(?:ed)?|read(?:s)?|slogan)\b/i;
  const sceneHeadingPattern = /^\s*(?:[-*+]\s*)?(?:#{1,6}\s*)?(?:[*_]{1,3})?\s*(?:Scene|Shot|Beat|Panel|Frame)[\s_#-]*\d{1,2}\b/i;
  const visibleTextRestrictionPattern = /\b(?:only\s+(?:text|copy|words?)|no\s+(?:captions?|subtitles?|overlays?|watermarks?|added\s+logos?|extra\s+logos?|logos?|text|copy)|without\s+(?:captions?|subtitles?|overlays?|watermarks?|added\s+logos?|extra\s+logos?|logos?|text|copy)|do\s+not\s+(?:add|include|render|show|write)\s+(?:captions?|subtitles?|overlays?|watermarks?|logos?|text|copy|words?))\b/i;
  const storyboardTextCandidateLooksLikeConversationInstruction = (candidate: string): boolean => {
    const raw = compactStoryboardLine(stripStoryboardMarkup(candidate))
      .replace(/^["“”'`]+|["“”'`]+$/g, '')
      .trim();
    if (!raw) return false;
    if (/^\[(?:uploaded|attached|provided)\s+(?:images?|files?|videos?|audio)\s*:/i.test(raw)) return true;
    if (/^(?:yes|no|approved?|looks?\s+good|ok(?:ay)?|sure)[.!?]?$/i.test(raw)) return true;

    const value = raw.toLowerCase();
    const workflowTerm = /\b(?:script|prompt|story\s*board|storyboard|take|version|again|redo|retry|regenerate|re-generate|revise|revision|approve|approval|proceed|generate|render|run|do\s+it|best\s+judg(?:e)?ment)\b/i;
    if (/^use\s+your\s+best\s+judg(?:e)?ment\b/i.test(raw)) return true;
    if (/^(?:try\s+another|another\s+take|regenerate|re-generate|redo|retry|revise)\b/i.test(raw)) return true;
    if (/^(?:go\s+ahead|can\s+you|please)\b/i.test(raw) && workflowTerm.test(value)) return true;
    if (/^let'?s\b|^lets\b/i.test(raw)) {
      return /\b(?:script|prompt|story\s*board|storyboard|take|version|again|redo|retry|regenerate|re-generate|revise|revision)\b/i.test(value)
        || /\b(?:generate|render|create|do|run)\s+it\b/i.test(value)
        || /\buse\s+your\s+best\s+judg(?:e)?ment\b/i.test(value);
    }
    return false;
  };
  const shouldIgnoreRequiredText = (
    value: string,
    matchIndex: number,
    precedingText?: string,
  ): boolean => {
    const lineStart = text.lastIndexOf('\n', matchIndex) + 1;
    const nextLineBreak = text.indexOf('\n', matchIndex);
    const lineEnd = nextLineBreak >= 0 ? nextLineBreak : text.length;
    const line = text.slice(lineStart, lineEnd);
    const looksLikeAssetHandle = /\.\.\.|(?:^|[./_-])(?:png|jpe?g|webp|gif|svg)$|[a-f0-9]{8}-[a-f0-9-]{8,}/i.test(value);
    const fieldLabel = line.match(/^\s*(?:[-*+]\s*)?(?:[*_]{1,3})?\s*([^:\n]{1,60})\s*:/)?.[1] ?? '';
    const isProductionDirectionField =
      /\b(?:action|motion|camera|transition|audio|sfx|fx|foley|sound|music|dialogue|vo|voiceover|voice-over|narration|speech|lighting|style|performance|beat)\b/i.test(fieldLabel)
      && !visibleTextContextPattern.test(fieldLabel);
    const hasExplicitVisibleTextContext = visibleTextContextPattern.test(line);
    const precedingCue = compactStoryboardLine([
      precedingText ?? '',
      line.slice(0, Math.max(0, matchIndex - lineStart)),
    ].join(' ')).slice(-180);
    const spokenTextCue =
      /\b(?:dialogue|vo|v\.o\.|voiceover|voice-over|voice\s*over|narration|speech|spoken(?:\s+line)?|audio\s*\/\s*dialogue)\b/i.test(precedingCue)
      || /\b(?:narrator|speaker|actor|character|person|subject|host|mascot|performer|he|she|they)\b[^"“`]{0,80}\b(?:says?|speaks?|whispers?|shouts?|asks?|replies?)\b/i.test(precedingCue);
    const isRestrictionOnlyTextInstruction =
      visibleTextContextPattern.test(fieldLabel || line)
      && visibleTextRestrictionPattern.test(value)
      && !/["“”`]/.test(value);
    const looksLikeActionOrSfxCallout =
      /^[a-z][a-z-]{1,24}[!?.]?$/i.test(value.trim())
      && /\b(?:action|motion|transition|audio|sfx|fx|foley|sound|music|camera|performance|beat|pop(?:s|ped|ping)?|snap(?:s|ped|ping)?|whoosh(?:es)?|thud(?:s|ded|ding)?|ding(?:s|ed|ing)?|boom(?:s|ed|ing)?|impact(?:s|ed|ing)?|hit(?:s|ting)?|slam(?:s|med|ming)?|wipe(?:s|d|ing)?|glitch(?:es|ed|ing)?|morph(?:s|ed|ing)?|bounce(?:s|d|ing)?|zoom(?:s|ed|ing)?)\b/i.test(line);
    const precedingTail = (precedingText ?? '').slice(-80);
    const hasInlineProductionLabel =
      !!precedingTail
      && inlineProductionLabelPattern.test(precedingTail)
      && !visibleTextContextPattern.test(precedingTail);
    const isNestedSceneHeadingField =
      sceneHeadingPattern.test(line)
      && !!precedingText
      && line.slice(0, matchIndex - lineStart).trim().length > 0;

    if (
      /\b(?:working\s+title|project\s+title)\b/i.test(line)
      && !/\b(?:title\s+card|on[-\s]?screen|visible|text|copy|cta|headline|tagline)\b/i.test(line)
    ) {
      return true;
    }

    if (storyboardTextCandidateLooksLikeGenericProductionLabel(value)) {
      return true;
    }

    if (storyboardTextCandidateLooksLikeConversationInstruction(value)) {
      return true;
    }

    if (isNestedSceneHeadingField) {
      return true;
    }

    if (isRestrictionOnlyTextInstruction) {
      return true;
    }

    if (hasInlineProductionLabel) {
      return true;
    }

    if ((isProductionDirectionField || looksLikeActionOrSfxCallout) && !hasExplicitVisibleTextContext) {
      return true;
    }

    if (spokenTextCue && !/\b(?:visible|on[-\s]?screen|in[-\s]?frame|text|copy|cta|tagline|headline|title\s+card|caption|subtitle|super|wordmark|slogan|sign|poster|banner|label|placard|sticker|screen)\b/i.test(precedingCue)) {
      return true;
    }

    if (
      looksLikeAssetHandle
      && /\b(?:asset|reference|image|photo|upload|file|filename|logo|brand)\b/i.test(line)
    ) {
      return true;
    }

    return false;
  };
  const addRequiredText = (
    rawValue: string | undefined,
    matchIndex = 0,
    options: { splitUnquotedList?: boolean; precedingText?: string } = {},
  ) => {
    const value = compactStoryboardLine(stripStoryboardMarkup(rawValue || ''))
      .replace(/\\"/g, '"')
      .replace(/^\|+|\|+$/g, '')
      .replace(/^[*_]+|[*_]+$/g, '')
      .replace(/^["“”'`]+|["“”'`]+$/g, '')
      .trim();
    if (value && shouldIgnoreRequiredText(value, matchIndex, options.precedingText)) return;
    if (/^visible\s+text\b/i.test(value) && (extractStoryboardTiming(value) || /^visible\s+text\.?$/i.test(value))) return;
    if (options.splitUnquotedList && value.includes(';')) {
      const parts = value
        .split(/\s*;\s*/)
        .map(part => part.trim())
        .filter(Boolean);
      if (parts.length > 1 && parts.every(part => part.length <= 160)) {
        for (const part of parts) addRequiredText(part, matchIndex, { precedingText: options.precedingText });
        return;
      }
    }
    if (value) required.add(value);
  };
  const splitEndCardCopyCandidates = (rawValue: string): string[] => {
    const value = stripStoryboardMarkup(rawValue)
      .replace(/^(?:visible\s+text|on[-\s]?screen\s+text|onscreen\s+text|text|copy|cta|tagline|slogan)\s*:\s*/i, '')
      .trim();
    if (!value) return [];

    const quoted = extractQuotedDialogueSegments(value)
      .map(line => compactStoryboardLine(line))
      .filter(Boolean);
    if (quoted.length > 0) return quoted;

    return value
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
      .map(line => compactStoryboardLine(line)
        .replace(/^["“”'`]+|["“”'`]+$/g, '')
        .trim())
      .filter(Boolean);
  };
  const endCardCopyCandidateLooksRenderable = (candidate: string, context: string): boolean => {
    const value = compactStoryboardLine(candidate)
      .replace(/^["“”'`]+|["“”'`]+$/g, '')
      .trim();
    if (!value || value.length > 120) return false;
    if (/^(?:none|n\/a|not\s+specified|no\s+(?:visible\s+)?text)\.?$/i.test(value)) return false;
    if (storyboardTextCandidateLooksLikeGenericProductionLabel(value)) return false;
    if (storyboardTextCandidateLooksLikeConversationInstruction(value)) return false;

    const contextNamesText =
      /\b(?:slogans?|taglines?|cta|copy|text|words?|wordmark|brand|logo|end\s+card|final\s+card|end\s+scene|final\s+scene|closing\s+card)\b/i
        .test(context);
    if (!contextNamesText) return false;

    const copySignal =
      /\b[a-z0-9-]+\.(?:ai|app|com|io|net|org)\b/i.test(value)
      || /^(?:powered|made|built|created|generated|rendered|presented)\s+by\b/i.test(value)
      || (
        value.split(/\s+/).length <= 8
        && /^[A-Z0-9][^:|]*[.!?]?$/.test(value)
      );
    if (!copySignal) return false;

    const productionDirection =
      /\b(?:fade|cut|camera|shot|zoom|pan|dolly|transition|sfx|audio|music|visual|scene|beat|appears?|pulses?|background|black\s+screen)\b/i
        .test(value);
    const copyOverridesProduction =
      /\b[a-z0-9-]+\.(?:ai|app|com|io|net|org)\b/i.test(value)
      || /^(?:powered|made|built|created|generated|rendered|presented)\s+by\b/i.test(value);
    return !productionDirection || copyOverridesProduction;
  };
  const endCardFollowingLineLooksLikeContinuationInstruction = (line: string): boolean => {
    return storyboardTextCandidateLooksLikeConversationInstruction(line);
  };
  const endCardLabelPattern = /^\s*(?:[-*+]\s*)?(?:(?:end|final|closing)\s+(?:scene|card|frame|shot|cta|logo(?:\s+lockup)?)|(?:scene|shot|beat|panel|frame)\s*\d{1,2}\s+(?:visible\s+text|on[-\s]?screen\s+text|onscreen\s+text|text|copy|cta)(?:\s+must\s+be\s+exactly)?)\s*:\s*([^\n]*)$/gim;
  for (const match of text.matchAll(endCardLabelPattern)) {
    const matchIndex = match.index ?? 0;
    const lineEnd = text.indexOf('\n', matchIndex);
    const afterLineIndex = lineEnd >= 0 ? lineEnd + 1 : text.length;
    const followingLines: string[] = [];
    for (const line of text.slice(afterLineIndex).split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) break;
      if (/^(?:#{1,6}\s+|\|\s*|(?:Scene|Shot|Beat|Panel|Frame)\s*\d{1,2}\b)/i.test(trimmed)) break;
      if (endCardFollowingLineLooksLikeContinuationInstruction(trimmed)) break;
      if (followingLines.length >= 5) break;
      followingLines.push(trimmed);
    }
    const blockLines = [
      match[1] || '',
      ...followingLines,
    ].filter(Boolean);
    if (blockLines.length === 0) continue;
    const context = [
      text.slice(Math.max(0, matchIndex - 320), matchIndex),
      match[0],
      ...blockLines,
    ].join('\n');
    for (const line of blockLines) {
      for (const candidate of splitEndCardCopyCandidates(line)) {
        if (!endCardCopyCandidateLooksRenderable(candidate, context)) continue;
        addRequiredText(candidate, matchIndex, { precedingText: context });
      }
    }
  }
  const exactTextPattern = /\b(?:render|show|include|text|copy|cta|tagline|headline|title|brand|logo|wordmark|words?|say(?:s)?|spell(?:ed)?)\b[^"“`\n]{0,120}(?:"([^"]{1,160})"|“([^”]{1,160})”|`([^`]{1,160})`)/gi;
  for (const match of text.matchAll(exactTextPattern)) {
    const fullMatch = match[0];
    const quoteOpenInMatch = fullMatch.search(/["“`]/);
    const quoteAbsIndex = (match.index ?? 0) + Math.max(0, quoteOpenInMatch);
    const lineStart = text.lastIndexOf('\n', quoteAbsIndex) + 1;
    addRequiredText(match[1] ?? match[2] ?? match[3], match.index ?? 0, {
      precedingText: text.slice(lineStart, quoteAbsIndex),
    });
  }

  const labeledTextPattern = /\b(?:on[-\s]?screen\s+text|visible\s+text|text\s+only|text|end\s+card\s+text|final\s+text|tagline|cta|headline|title\s+card|copy)\s*:\s*([^\n]{1,260})/gi;
  for (const match of text.matchAll(labeledTextPattern)) {
    // In markdown storyboard tables, the next pipe ends the visible-text
    // cell. Do not scan quoted Dialogue/VO or Audio/SFX from later cells as
    // though it were a continuation of `Text:` in the visual cell.
    const value = (match[1] || '').split('|')[0];
    const matchStartInText = match.index ?? 0;
    const lineStart = text.lastIndexOf('\n', matchStartInText) + 1;
    const valueStartInMatch = match[0].indexOf(value);
    const valueStartInText = valueStartInMatch >= 0 ? matchStartInText + valueStartInMatch : matchStartInText;
    let addedQuotedText = false;
    for (const quote of value.matchAll(/"([^"]{1,160})"|“([^”]{1,160})”|`([^`]{1,160})`/g)) {
      const innerStartInValue = quote.index ?? 0;
      const quoteAbsIndex = valueStartInText + innerStartInValue;
      addRequiredText(quote[1] ?? quote[2] ?? quote[3], quoteAbsIndex, {
        precedingText: text.slice(lineStart, quoteAbsIndex),
      });
      addedQuotedText = true;
    }
    if (!addedQuotedText) {
      const unquoted = value
        .split('|')[0]
        .replace(/\s+\b(?:Dialogue\/VO|VO\/Dialogue|V\.O\.|VO|Voiceover|Voice-over|Speech|Narration|Audio\/SFX|Audio|SFX|FX|Foley|Sound|Sounds|Music|Camera\/Motion|Camera|Lighting\/Style|Lighting|Style|Look|Action\/Motion|Action|Motion)\s*:[\s\S]*$/i, '')
        .replace(/\b(?:none|no\s+(?:visible\s+)?text|n\/a|not\s+specified)\b\.?$/i, '')
        .trim();
      addRequiredText(unquoted, matchStartInText, {
        splitUnquotedList: true,
        precedingText: text.slice(lineStart, matchStartInText),
      });
    }
  }

  const renderThesePattern = /\b(?:exact words|exact text|required text|final cta|end card text)\b[\s\S]{0,320}/gi;
  for (const block of text.matchAll(renderThesePattern)) {
    for (const quote of extractQuotedDialogueSegments(block[0])) {
      addRequiredText(quote, block.index ?? 0);
    }
  }

  return [...required];
}

function inferStoryboardTitle(text: string): string {
  const cleanTitle = (rawValue: string): string => {
    let cleaned = compactStoryboardLine(
      stripStoryboardMarkup(rawValue)
        .replace(/^["“”'`*_\s]+|["“”'`*_\s.]+$/g, ''),
    );
    const nextMetadataField = cleaned.search(
      /\s+\b(?:Format|Duration|Aspect\s+Ratio|Target\s+duration|Target\s+video\s+aspect\s+ratio|Storyboard\s+layout|Reference\s+assets?|Music|Audio|End\s+scene)\s*:/i,
    );
    if (nextMetadataField > 0) {
      cleaned = cleaned.slice(0, nextMetadataField).trim();
    }
    return cleaned || 'Video Storyboard';
  };
  const titleMatch = text.match(/\b(?:project\s+title|storyboard\s+project|title|working title)\s*:\s*([^\n]{1,120})/i);
  if (titleMatch?.[1]?.trim()) return cleanTitle(titleMatch[1]);
  const quotedTitle = text.match(/\b(?:titled|called)\s+"([^"]{1,120})"/i);
  if (quotedTitle?.[1]?.trim()) return cleanTitle(quotedTitle[1]);
  return 'Video Storyboard';
}

function compactStoryboardLine(value: string | null | undefined, fallback = ''): string {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function truncateStoryboardText(value: string | null | undefined, maxLength: number, fallback = ''): string {
  const compact = compactStoryboardLine(value, fallback);
  if (compact.length <= maxLength) return compact;
  const truncated = compact.slice(0, maxLength).replace(/\s+\S*$/, '').replace(/[,;:.\s]+$/g, '').trim();
  return truncated || compact.slice(0, maxLength).trim();
}

function cleanStoryboardNarrativeSourceText(value: string | null | undefined): string {
  return stripGeneratedStoryboardLayoutHints(String(value || ''))
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !isTerseStoryboardRetryInstruction(line))
    .join('\n')
    .replace(/^Keep individual scene-cell\/frame aspect ratio[^\n]*$/gmi, '')
    .replace(/\bKeep individual scene-cell\/frame aspect ratio\s+\d{1,4}\s*:\s*\d{1,4};?\s*target final video aspect ratio\s+\d{1,4}\s*:\s*\d{1,4}\.?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripStoryboardExpansionInstruction(value: string): string {
  return value
    .replace(/\s*If the source text contains fewer (?:panel|frame) descriptions, expand those beats into exactly \d{1,2} timecoded frames; do not create (?:a\s+)?(?:\d{1,2}|four|six)[^.]*?or split the storyboard into separate images\./gi, '')
    .replace(/\s*If the source text contains fewer (?:panel|frame) descriptions, expand those beats into exactly \d{1,2} timecoded frames; keep all frames in one composite storyboard image and do not split the storyboard into separate images\./gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeStoryboardBriefKey(value: string): string {
  return stripStoryboardExpansionInstruction(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}:]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textHasStoryboardBriefSubstance(value: string): boolean {
  const text = stripStoryboardExpansionInstruction(value);
  if (text.length < 40) return false;
  return /\b(?:story\s*board|storyboard|video|seedance|commercial|promo|teaser|ad|scene|shot|beat|panel|frame|duration|logo|reference|audio|sfx|foley)\b/i.test(text)
    || extractStoryboardTiming(text) !== null;
}

function isTerseStoryboardRetryInstruction(value: string): boolean {
  const text = stripStoryboardExpansionInstruction(value)
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length > 90) return false;
  return /^(?:try again|retry|redo|rerun|run it again|do it again|go ahead|do it|continue|looks good|approved|approve|yes|yeah|yep|ok|okay|sure|please do|make it)$/.test(text)
    || /\b(?:try again|retry|redo|do it again)\b/i.test(text);
}

function latestSubstantiveStoryboardUserBrief(userIntentText: string, promptCore: string): string {
  const promptKey = normalizeStoryboardBriefKey(promptCore);
  const chunks = cleanStoryboardNarrativeSourceText(userIntentText)
    .split(/\n{1,}/)
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .filter(chunk => normalizeStoryboardBriefKey(chunk) !== promptKey)
    .filter(textHasStoryboardBriefSubstance);
  return chunks[chunks.length - 1] || '';
}

function selectStoryboardSourceBrief(prompt: string, userIntentText: string): string {
  const promptCore = cleanStoryboardNarrativeSourceText(stripStoryboardExpansionInstruction(prompt));
  const cleanUserIntentText = cleanStoryboardNarrativeSourceText(userIntentText);
  const priorBrief = latestSubstantiveStoryboardUserBrief(cleanUserIntentText, promptCore);
  if (priorBrief && (!textHasStoryboardBriefSubstance(promptCore) || isTerseStoryboardRetryInstruction(promptCore))) {
    return priorBrief;
  }
  return promptCore || priorBrief || cleanUserIntentText.trim();
}

function selectStoryboardSourceBriefForCompile(
  options: {
    prompt: string;
    promptAuthorship?: StoryboardPromptCompileOptions['promptAuthorship'];
    frameCount?: number;
  },
  userIntentText: string,
): string {
  const selectedBrief = selectStoryboardSourceBrief(options.prompt, userIntentText);
  if (options.promptAuthorship !== 'assistant') return selectedBrief;

  const cleanUserIntentText = cleanStoryboardNarrativeSourceText(userIntentText);
  const selectedSectionCount = splitStoryboardSections(selectedBrief).length;
  const userSectionCount = splitStoryboardSections(cleanUserIntentText).length;
  const userBriefHasRequestedSceneCount = options.frameCount
    ? userSectionCount === options.frameCount
    : userSectionCount > 0;
  if (
    userBriefHasRequestedSceneCount
    && userSectionCount > selectedSectionCount
  ) {
    return cleanUserIntentText;
  }

  return selectedBrief;
}

function storyboardBriefContains(haystack: string, needle: string): boolean {
  const haystackKey = normalizeStoryboardBriefKey(haystack);
  const needleKey = normalizeStoryboardBriefKey(needle);
  return !!needleKey && haystackKey.includes(needleKey);
}

function buildStoryboardSourceBriefForPrompt(
  prompt: string,
  userIntentText: string,
  approvedScriptContext?: string | null,
  promptAuthorship?: StoryboardPromptCompileOptions['promptAuthorship'],
): string {
  const selectedBrief = selectStoryboardSourceBriefForCompile(
    { prompt, promptAuthorship, frameCount: undefined },
    userIntentText,
  );
  const originalBrief = latestSubstantiveStoryboardUserBrief(userIntentText, selectedBrief);
  const canonicalApprovedScriptContext = canonicalStoryboardScriptContext(approvedScriptContext);
  const includeSelectedBrief = selectedBrief && !(promptAuthorship === 'assistant' && canonicalApprovedScriptContext);
  const includeOriginalBrief = originalBrief && !(promptAuthorship === 'assistant' && canonicalApprovedScriptContext);
  const parts: string[] = [];

  if (includeOriginalBrief && !storyboardBriefContains(selectedBrief, originalBrief)) {
    parts.push(`ORIGINAL USER INTENT:\n${originalBrief}`);
  }

  if (includeSelectedBrief) {
    parts.push(parts.length > 0 ? `STORYBOARD BRIEF:\n${selectedBrief}` : selectedBrief);
  }

  if (canonicalApprovedScriptContext) {
    parts.push(`APPROVED STORYBOARD SCRIPT CONTEXT TO PRESERVE:\n${canonicalApprovedScriptContext}`);
  }

  return stripGenericStoryboardVisibleTextMetadata(parts.filter(Boolean).join('\n\n'));
}

function buildStoryboardUserConstraintSource(
  userIntentText: string,
  primarySourceBrief: string,
  options: StoryboardPromptCompileOptions,
): string {
  const canonicalApprovedScriptContext = canonicalStoryboardScriptContext(options.approvedScriptContext);
  return [
    userIntentText,
    canonicalApprovedScriptContext,
    options.promptAuthorship === 'assistant' ? '' : primarySourceBrief,
  ].filter(Boolean).join('\n\n');
}

function stripStoryboardMarkup(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function storyboardFieldLabelPattern(label: string): string {
  return label
    .trim()
    .split('/')
    .map(part => part.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(String.raw`\s*/\s*`);
}

function extractStoryboardField(section: string, labels: string[]): string {
  const normalizedSection = stripStoryboardMarkup(section)
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*#{1,6}\s*/, '').trim())
    .filter(Boolean)
    .join('\n');
  const labelPattern = labels.map(storyboardFieldLabelPattern).join('|');
  const match = normalizedSection.match(new RegExp(String.raw`^\s*(?:${labelPattern})(?:\s*\([^)\n]{0,80}\))?\s*:\s*(.+)$`, 'im'));
  return compactStoryboardLine(match?.[1]);
}

function removeStoryboardTimingText(value: string): string {
  return value
    // MM:SS - MM:SS
    .replace(/\b\d{1,2}:\d{2}(?:\.\d+)?\s*(?:-|to|\u2013|\u2014)\s*\d{1,2}:\d{2}(?:\.\d+)?\b/gi, ' ')
    // Xs - Ys (units on both sides; tolerates whitespace around dash)
    .replace(/\b\d{1,3}(?:\.\d+)?\s*(?:s|sec|secs|seconds?)\s*(?:-|to|\u2013|\u2014)\s*\d{1,3}(?:\.\d+)?\s*(?:s|sec|secs|seconds?)\b/gi, ' ')
    // X-Ys (shared trailing unit; require no whitespace around dash so we
    // do not catch "Slogan 1 - 13s" where the "1" is part of a title)
    .replace(/\b\d{1,3}(?:\.\d+)?(?:-|\u2013|\u2014)\d{1,3}(?:\.\d+)?\s*(?:s|sec|secs|seconds?)\b/gi, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s*[|]\s*/g, ' ')
    .replace(/^[-:.\s|]+|[-:.\s|]+$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function storyboardTextCandidateLooksLikeGenericProductionLabel(value: string): boolean {
  const withoutTiming = removeStoryboardTimingText(value)
    .replace(/^\(|\)$/g, '')
    .replace(/^[-:.\s|]+|[-:.\s|]+$/g, '')
    .trim();
  return /^(?:visible\s+text|on[-\s]?screen\s+text|onscreen\s+text|text\s+overlay|title\s+card|caption|subtitle|super|copy|cta|tagline|headline)$/i.test(withoutTiming);
}

function stripGenericStoryboardVisibleTextMetadata(value: string): string {
  if (!value) return '';
  return value
    .replace(
      /\s*(?:<br\s*\/?>\s*)?\b(?:visible\s+text|on[-\s]?screen\s+text|onscreen\s+text|text)\s*:\s*([^|\n\r<]+)/gi,
      (match, candidate: string) => storyboardTextCandidateLooksLikeGenericProductionLabel(candidate)
        ? ''
        : match,
    )
    .replace(/[ \t]+(?=\n)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeStoryboardVisibleText(value: string): string {
  const compact = compactStoryboardLine(stripGenericStoryboardVisibleTextMetadata(value));
  if (!compact || storyboardTextCandidateLooksLikeGenericProductionLabel(compact)) return '';
  return compact;
}

function normalizeStoryboardDialogue(value: string): string {
  const compact = compactStoryboardLine(stripGenericStoryboardVisibleTextMetadata(value));
  if (!compact) return '';
  if (/^[-\u2013\u2014]\.?$/.test(compact)) return '';
  if (/^(?:[\[(]\s*)?(?:none|no\s+(?:spoken\s+)?(?:dialogue|vo|voiceover|voice-over|speech)|n\/a|not\s+specified|text\s+only|silence(?:\s*\/\s*beat)?|silent beat)(?:\s*[\])])?\.?$/i.test(compact)) {
    return '';
  }
  const visibleTextField = compact.match(/^(?:visible\s+text|on[-\s]?screen\s+text|onscreen\s+text|text|cta|tagline|headline|title\s+card|copy)\s*:\s*(.+)$/i)?.[1];
  if (visibleTextField !== undefined) return '';
  const audioField = compact.match(/^(?:audio\s*\/\s*sfx|audio\s*\/\s*foley|foley\s*\/\s*sfx|audio|sfx|fx|foley|sound|sounds|music)\s*:\s*(.+)$/i)?.[1];
  if (audioField !== undefined) return '';
  if (/^text\s+only\s*:/i.test(compact)) return '';

  const quoted = extractQuotedDialogueSegments(compact)
    .map(line => compactStoryboardLine(line))
    .filter(Boolean);
  if (quoted.length > 0) return quoted.join(' ');

  const nestedVo = compact.match(/\b(?:VO|V\.O\.|Voiceover|Voice-over|Dialogue|Speech|Narration)\b(?:\s*\([^)]*\))?\s*:\s*(.+)$/i)?.[1];
  if (nestedVo && !/^(?:[\[(]\s*)?(?:none|no\s+(?:spoken\s+)?(?:dialogue|vo|voiceover|voice-over|speech)|n\/a|not\s+specified|text\s+only)(?:\s*[\])])?\.?$/i.test(nestedVo.trim())) {
    return compactStoryboardLine(nestedVo);
  }

  return compact;
}

function parseStoryboardTimeValue(value: string): number | null {
  const trimmed = value.trim();
  const timecode = trimmed.match(/^(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/);
  if (timecode) {
    const minutes = Number(timecode[1]);
    const seconds = Number(timecode[2]);
    const fraction = timecode[3] ? Number(`0.${timecode[3]}`) : 0;
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;
    return Math.round((minutes * 60 + seconds + fraction) * 100) / 100;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractStoryboardTiming(text: string): { startSec: number; endSec: number; durationSec: number } | null {
  // Prefer the strictest, most unambiguous pattern first so a number that is
  // really part of a title ("Slogan 1 - 13s-14s") does not get captured as a
  // timing range ("1 - 13s"). Patterns in order of strictness:
  //   1. MM:SS - MM:SS
  //   2. Xs - Ys  (units on both sides, any spacing)
  //   3. X-Ys     (shared trailing unit, no whitespace around the dash \u2014
  //                rejects "Slogan 1 - 13s" because of the spaces)
  //   4. Permissive fallback for any remaining cases.
  const patterns = [
    /(\d{1,2}:\d{1,2}(?:\.\d+)?)\s*(?:-|to|\u2013|\u2014)\s*(\d{1,2}:\d{1,2}(?:\.\d+)?)/i,
    /(\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)\s*(?:-|to|\u2013|\u2014)\s*(\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)/i,
    /(\d{1,3}(?:\.\d+)?)(?:-|\u2013|\u2014)(\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)/i,
    /(\d{1,2}:\d{1,2}(?:\.\d+)?|\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?\s*(?:-|to|\u2013|\u2014)\s*(\d{1,2}:\d{1,2}(?:\.\d+)?|\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const startSec = parseStoryboardTimeValue(match[1]);
    const endSec = parseStoryboardTimeValue(match[2]);
    if (startSec === null || endSec === null) continue;
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) continue;
    return {
      startSec,
      endSec,
      durationSec: Math.round((endSec - startSec) * 100) / 100,
    };
  }
  return null;
}

function extractStoryboardTimingMarker(text: string): { startSec: number; endSec: number; durationSec: number } | null {
  const match = text.match(/(\d{1,2}:\d{1,2}(?:\.\d+)?|\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?\s*(?:-|to|\u2013|\u2014)\s*(\d{1,2}:\d{1,2}(?:\.\d+)?|\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?/i);
  if (!match) return null;
  const startSec = parseStoryboardTimeValue(match[1]);
  const endSec = parseStoryboardTimeValue(match[2]);
  if (startSec === null || endSec === null) return null;
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec < startSec) return null;
  return {
    startSec,
    endSec,
    durationSec: Math.round((endSec - startSec) * 100) / 100,
  };
}

function storyboardMarkdownTableCells(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];

  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => stripStoryboardMarkup(cell))
    .map(cell => compactStoryboardLine(cell))
    .filter(cell => cell.length > 0);

  if (cells.length < 2) return [];
  if (cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))) return [];
  return cells;
}

function storyboardMarkdownTableSeparatorLine(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function storyboardMarkdownCountTableCells(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  if (storyboardMarkdownTableSeparatorLine(trimmed)) return [];

  return trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean);
}

function splitStoryboardTitleDescription(value: string): { title: string; description: string } {
  const cleaned = stripStoryboardMarkup(value);
  const fallbackTitleFromDescription = (description: string): string => {
    const withoutLeadingLabel = description.replace(/^(?:Visual|Visual Frame|Frame|Shot|Image|Action|Action\/Motion)\s*:\s*/i, '');
    const titleSafe = withoutLeadingLabel
      .replace(/"[^"]{1,240}"|“[^”]{1,240}”|`[^`]{1,240}`/g, '')
      .replace(/\s+\b(?:Dialogue\/VO|VO\/Dialogue|V\.O\.|VO|Voiceover|Voice-over|Speech|Narration|Audio\/SFX|Audio|SFX|FX|Foley|Sound|Sounds|Music|Visible text|On-screen text|Onscreen text|Text|CTA|Camera\/Motion|Camera|Lighting\/Style|Lighting|Style|Look|Action\/Motion|Action|Motion)\s*:[\s\S]*$/i, '')
      .replace(/\s*:\s*$/, '');
    const firstClause = titleSafe.split(/(?<=[.!?])\s+|;\s+|\n/)[0] || titleSafe || withoutLeadingLabel;
    return compactStoryboardLine(firstClause.slice(0, 80), 'Storyboard Beat');
  };
  const match = cleaned.match(/^([^:\n]{1,100})\s*:\s*([\s\S]+)$/);
  if (!match) {
    return {
      title: fallbackTitleFromDescription(cleaned),
      description: compactStoryboardLine(cleaned),
    };
  }

  const rawPrefix = match[1];
  const prefixContainsSentenceEnd = /[.!?]\s/.test(rawPrefix);
  if (prefixContainsSentenceEnd) {
    return {
      title: fallbackTitleFromDescription(cleaned),
      description: compactStoryboardLine(cleaned),
    };
  }

  const title = compactStoryboardLine(rawPrefix, 'Storyboard Beat');
  const description = compactStoryboardLine(match[2], cleaned);
  if (/^(?:visual|visual frame|frame|shot|image|action|action\/motion|camera|audio|sfx|dialogue|vo)$/i.test(title)) {
    return {
      title: fallbackTitleFromDescription(description),
      description,
    };
  }

  return {
    title,
    description,
  };
}

function storyboardTableCellWithFieldBreaks(value: string): string {
  return stripStoryboardMarkup(value)
    .replace(/\s+\b(Dialogue\/VO|VO\/Dialogue|V\.O\.|VO|Voiceover|Voice-over|Speech|Narration|Audio\/SFX|Audio|SFX|FX|Foley|Sound|Sounds|Music|Visible text|On-screen text|Onscreen text|Text|CTA|Camera\/Motion|Camera|Lighting\/Style|Lighting|Style|Look|Action\/Motion|Action|Motion)\s*:/gi, '\n$1:')
    .trim();
}

function storyboardTableHeaderMatches(header: string | undefined, pattern: RegExp): boolean {
  return !!header && pattern.test(header);
}

function storyboardTableHeaderIndex(headers: string[] | null, pattern: RegExp): number {
  if (!headers) return -1;
  return headers.findIndex(header => storyboardTableHeaderMatches(header, pattern));
}

function uniqueStoryboardTableIndices(indices: number[]): number[] {
  const seen = new Set<number>();
  return indices.filter(index => {
    if (index < 0 || seen.has(index)) return false;
    seen.add(index);
    return true;
  });
}

function looksLikeStoryboardTableHeader(cells: string[]): boolean {
  if (cells.some(cell => extractStoryboardTiming(cell))) return false;
  const joined = cells.join(' ');
  return /\b(?:time|timecode|timing|duration)\b/i.test(joined)
    && /\b(?:visual|action|frame|shot|camera|audio|dialogue|vo|voiceover|sfx)\b/i.test(joined);
}

function looksLikeStoryboardCountTableHeader(cells: string[]): boolean {
  if (cells.some(cell => extractStoryboardTiming(cell))) return false;
  if (/^(?:beat|scene|shot|panel|frame)?\s*(?:#\s*)?0?\d{1,2}\b/i.test(cells[0] || '')) {
    return false;
  }
  const joined = cells.join(' ');
  return /\b(?:beat|scene|shot|panel|frame|time|timecode|timing|duration)\b/i.test(joined)
    && /\b(?:purpose|story|feature|visual|action|frame|shot|image|camera|motion|audio|dialogue|vo|voiceover|sfx|sound|music|transition|copy|cta|text)\b/i.test(joined);
}

function storyboardTableRowLooksLikeCountedBeat(cells: string[], headers: string[] | null): boolean {
  if (cells.some(cell => extractStoryboardTimingMarker(cell) !== null)) return true;

  const headerIndex = headers?.findIndex(header =>
    /\b(?:beat|scene|shot|panel|frame)\b/i.test(header)
    && !/\b(?:visual|action|camera|audio|dialogue|vo|sfx|transition)\b/i.test(header),
  ) ?? 0;
  const candidate = compactStoryboardLine(cells[Math.max(0, headerIndex)] || cells[0] || '');
  return /^(?:beat|scene|shot|panel|frame)?\s*(?:#\s*)?0?\d{1,2}\b/i.test(candidate);
}

function storyboardTableCellLooksLikeCameraCue(cell: string): boolean {
  const compact = compactStoryboardLine(cell);
  return /\b(?:camera|motion|shot|frame|framing|close[-\s]?up|medium|wide|macro|static|locked|hold|push(?:es)?\s+in|pull(?:s)?\s+back|pan|tilt|dolly|truck|tracking|handheld|orbit|zoom|focus|rack\s+focus|focus\s+pull|slow[-\s]?mo|timelapse)\b/i.test(compact);
}

function storyboardTableCellLooksLikeTransitionCue(cell: string): boolean {
  const compact = compactStoryboardLine(cell);
  return /\b(?:transition|cut|hard\s+cut|smash\s+cut|match\s+cut|jump\s+cut|fade|cross[-\s]?fade|dissolve|wipe|morph|glitch|burst|snap|blend|strobe|whip[-\s]?pan)\b/i.test(compact);
}

function normalizeStoryboardTableCellsToHeaders(cells: string[], headers: string[] | null): string[] {
  if (!headers) return cells;

  if (cells.length === headers.length - 1) {
    const purposeHeaderIndex = storyboardTableHeaderIndex(
      headers,
      /\b(?:purpose|story\s*beat|story\s*purpose|beat\s*name|beat\s*title|narrative|name|title)\b/i,
    );
    const visualHeaderIndex = storyboardTableHeaderIndex(headers, /\b(?:visual|frame|shot|image|action)\b/i);
    const transitionHeaderIndex = storyboardTableHeaderIndex(headers, /\b(?:transition|edit|cut|fade|dissolve|wipe)\b/i);
    const purposeCell = compactStoryboardLine(cells[purposeHeaderIndex] || '');
    const shiftedCameraCell = cells[visualHeaderIndex] || '';
    const shiftedTransitionCell = transitionHeaderIndex >= 0
      ? cells[transitionHeaderIndex - 1] || ''
      : '';
    const shiftedColumnsLookLikeFoldedPurposeVisual = transitionHeaderIndex >= 0
      ? storyboardTableCellLooksLikeTransitionCue(shiftedTransitionCell)
      : storyboardTableCellLooksLikeCameraCue(shiftedCameraCell);

    if (
      purposeHeaderIndex >= 0
      && visualHeaderIndex === purposeHeaderIndex + 1
      && visualHeaderIndex < cells.length
      && purposeCell.length >= 20
      && shiftedColumnsLookLikeFoldedPurposeVisual
    ) {
      return [
        ...cells.slice(0, visualHeaderIndex),
        cells[purposeHeaderIndex],
        ...cells.slice(visualHeaderIndex),
      ];
    }
  }

  if (cells.length <= headers.length) return cells;

  const overflow = cells.length - headers.length;
  const combinedAudioDialogueIndex = headers.findIndex(header =>
    /\baudio\b/i.test(header)
    && /\b(?:dialogue|vo|v\.o\.|voiceover|speech|narration)\b/i.test(header),
  );
  if (combinedAudioDialogueIndex < 0) return cells;

  const mergeEnd = combinedAudioDialogueIndex + overflow;
  if (mergeEnd >= cells.length) return cells;
  const overflowCells = cells.slice(combinedAudioDialogueIndex, mergeEnd + 1);
  if (!overflowCells.some(cell => storyboardTableCellLooksLikeUnlabeledSpeech(cell))) return cells;

  return [
    ...cells.slice(0, combinedAudioDialogueIndex),
    overflowCells.join('\n'),
    ...cells.slice(mergeEnd + 1),
  ];
}

function storyboardTableCellWithoutDialogue(cell: string, dialogue: string): string {
  const normalizedDialogue = compactStoryboardLine(dialogue).toLowerCase();
  return cell
    .split(/\r?\n/)
    .map(line => {
      const compact = compactStoryboardLine(dialogue ? line.replace(/"[^"]{1,800}"/g, ' ') : line);
      if (normalizedDialogue && compact.toLowerCase() === normalizedDialogue) {
        return '';
      }
      if (/^\s*(?:Dialogue\/VO|VO\/Dialogue|V\.O\.|VO|Voiceover|Voice-over|Speech|Narration)\s*:/i.test(compact)) {
        return '';
      }
      if (/^\s*(?:Visible text|On-screen text|Onscreen text|Text|CTA)\s*:/i.test(compact)) {
        return '';
      }
      return compact;
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\b(?:none|no\s+(?:spoken\s+)?(?:dialogue|vo|voiceover|voice-over|speech)|n\/a|not\s+specified|text\s+only)\b\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function storyboardTableCellHasExplicitVoiceField(cell: string): boolean {
  return cell
    .split(/\r?\n/)
    .some(line =>
      /^\s*(?:Dialogue\/VO|VO\/Dialogue|Dialogue|VO|V\.O\.|Voiceover|Voice-over|Speech|Narration)\s*:/i.test(
        compactStoryboardLine(line),
      ),
    );
}

function storyboardTableCellIsAudioOnly(cell: string): boolean {
  const lines = cell
    .split(/\r?\n/)
    .map(line => compactStoryboardLine(line))
    .filter(Boolean);
  if (lines.length === 0) return false;
  if (storyboardTableCellHasExplicitVoiceField(cell)) return false;

  return lines.every(line =>
    /^\s*(?:Audio\/SFX|Audio|SFX|FX|Foley|Sound|Sounds|Music)\s*:/i.test(line),
  );
}

function storyboardTableCellLooksLikeUnlabeledSpeech(cell: string): boolean {
  const compact = compactStoryboardLine(cell);
  if (!compact) return false;
  if (storyboardTableCellHasExplicitVoiceField(cell)) return true;
  if (extractQuotedDialogueSegments(compact).length > 0) return true;
  return /\b(?:VO|V\.O\.|voiceover|voice-over|dialogue|speech|narration|spoken|says?|speaks?|whispers?|shouts?|yells?|asks?|replies?|responds?|sings?)\b/i.test(compact);
}

function storyboardTableCellLooksLikeAudioCue(cell: string): boolean {
  const compact = compactStoryboardLine(cell);
  return /\b(?:music|score|track|song|audio|sfx|fx|foley|sound|ambience|ambient|room\s+tone|hum|hiss|rumble|whoosh|swell|drop|beat|bass|drum|percussion|chime|sparkle|hit|sting|fade(?:s)?\s+(?:in|out)|music\s+starts?|music\s+peaks?|music\s+sustains?)\b/i.test(compact);
}

function splitStoryboardTableSections(text: string): Array<{ number: number; heading: string; body: string }> {
  const sections: Array<{ number: number; heading: string; body: string }> = [];
  let headers: string[] | null = null;

  for (const line of text.split(/\r?\n/)) {
    const rawCells = storyboardMarkdownTableCells(line);
    if (rawCells.length < 3) continue;

    if (looksLikeStoryboardTableHeader(rawCells)) {
      headers = rawCells;
      continue;
    }

    const cells = normalizeStoryboardTableCellsToHeaders(rawCells, headers);
    const timingCellIndex = cells.findIndex(cell => extractStoryboardTimingMarker(cell) !== null);
    if (timingCellIndex < 0) continue;
    const timing = extractStoryboardTimingMarker(cells[timingCellIndex]);
    if (!timing) continue;

    const visualHeaderIndex = storyboardTableHeaderIndex(headers, /\b(?:visual|frame|shot|image|action)\b/i);
    const cameraHeaderIndex = storyboardTableHeaderIndex(headers, /\b(?:camera|motion|fx|effect|lighting|style|look)\b/i);
    const dialogueHeaderIndex = storyboardTableHeaderIndex(headers, /\b(?:dialogue|vo|v\.o\.|voiceover|speech|narration)\b/i);
    const soundHeaderIndex = storyboardTableHeaderIndex(headers, /\b(?:audio|sfx|sound|foley|music)\b/i);
    const transitionHeaderIndex = storyboardTableHeaderIndex(headers, /\b(?:transition|edit|cut|fade|dissolve|wipe)\b/i);
    const visibleTextHeaderIndex = storyboardTableHeaderIndex(headers, /\b(?:visible\s+text|on[-\s]?screen\s+text|onscreen\s+text|text|copy|cta|tagline|headline|title\s+card|subtitle|caption)\b/i);
    const beatHeaderIndex = headers
      ? headers.findIndex(header =>
          /\b(?:beat|scene|shot|panel|frame)\b/i.test(header)
          && !/\b(?:visual|action|camera|audio|dialogue|vo|sfx|transition)\b/i.test(header),
        )
      : -1;
    const purposeHeaderIndex = headers
      ? headers.findIndex(header =>
          /\b(?:purpose|story\s*beat|story\s*purpose|beat\s*name|beat\s*title|narrative|name|title)\b/i.test(header)
          && !/\b(?:visual|action|camera|audio|dialogue|vo|sfx|time|transition|scene)\b/i.test(header),
        )
      : -1;
    const visualIndex = visualHeaderIndex >= 0
      ? visualHeaderIndex
      : timingCellIndex === 0
        ? 1
        : Math.min(timingCellIndex + 1, cells.length - 1);
    if (visualIndex === timingCellIndex) continue;

    const visualHeader = headers?.[visualIndex] || '';
    const visualCell = cells[visualIndex] || '';
    const visualCellWithFieldBreaks = storyboardTableCellWithFieldBreaks(visualCell);
    const visual = splitStoryboardTitleDescription(visualCell);
    const explicitAction = extractStoryboardField(visualCellWithFieldBreaks, ['Action/Motion', 'Action', 'Motion', 'Performance']);
    const action = explicitAction || (storyboardTableHeaderMatches(visualHeader, /\b(?:action|motion|performance)\b/i)
      && !storyboardTableHeaderMatches(visualHeader, /\b(?:visual|frame|shot|image)\b/i)
      ? visual.description || visual.title
      : '');
    const cameraLighting = cameraHeaderIndex >= 0
      ? storyboardTableCellWithFieldBreaks(cells[cameraHeaderIndex] || '')
      : '';
    const dialogueCell = dialogueHeaderIndex >= 0
      ? storyboardTableCellWithFieldBreaks(cells[dialogueHeaderIndex] || '')
      : '';
    const soundCell = soundHeaderIndex >= 0
      ? storyboardTableCellWithFieldBreaks(cells[soundHeaderIndex] || '')
      : '';
    const transitionCell = transitionHeaderIndex >= 0
      ? storyboardTableCellWithFieldBreaks(cells[transitionHeaderIndex] || '')
      : '';
    const visibleTextCell = visibleTextHeaderIndex >= 0
      ? storyboardTableCellWithFieldBreaks(cells[visibleTextHeaderIndex] || '')
      : '';
    const audioCell = uniqueStoryboardTableIndices([dialogueHeaderIndex, soundHeaderIndex, visibleTextHeaderIndex])
      .map(index => storyboardTableCellWithFieldBreaks(cells[index] || ''))
      .filter(Boolean)
      .join('\n');
    const dialogueHeader = headers?.[dialogueHeaderIndex] || headers?.[soundHeaderIndex] || '';
    const combinedAudioDialogueHeader =
      dialogueHeaderIndex >= 0
      && soundHeaderIndex === dialogueHeaderIndex
      && /\baudio\b/i.test(dialogueHeader)
      && /\b(?:dialogue|vo|v\.o\.|voiceover|speech|narration)\b/i.test(dialogueHeader);
    const combinedHeaderDefaultsToVoice =
      combinedAudioDialogueHeader
      && /\b(?:vo|v\.o\.|voiceover|speech|narration)\b/i.test(dialogueHeader)
      && !storyboardTableCellLooksLikeAudioCue(dialogueCell || audioCell);
    const camera = extractStoryboardField(cameraLighting, ['Camera', 'Camera/Motion', 'Framing', 'Shot type']);
    const lighting = extractStoryboardField(cameraLighting, ['Lighting', 'Style', 'Lighting/Style', 'Look']);
    const explicitDialogue = extractStoryboardField(audioCell, [
      'Dialogue/VO',
      'VO/Dialogue',
      'Dialogue',
      'VO',
      'V.O.',
      'Voiceover',
      'Voice-over',
      'Speech',
      'Narration',
    ]);
    const dialogue = explicitDialogue
      ? normalizeStoryboardDialogue(explicitDialogue)
      : storyboardTableCellIsAudioOnly(dialogueCell || audioCell)
        ? ''
        : storyboardTableHeaderMatches(dialogueHeader, /\b(?:dialogue|vo|v\.o\.|voiceover|speech|narration)\b/i)
          ? combinedAudioDialogueHeader && !combinedHeaderDefaultsToVoice && !storyboardTableCellLooksLikeUnlabeledSpeech(dialogueCell || audioCell)
            ? ''
            : normalizeStoryboardDialogue(extractQuotedDialogueSegments(dialogueCell || audioCell)[0] || dialogueCell || audioCell)
          : '';
    const visibleTextHeader = headers?.[visibleTextHeaderIndex] || '';
    const visibleTextHeaderIsMixedWithAudioOrVoice =
      visibleTextHeaderIndex >= 0
      && /\b(?:audio|sfx|sound|foley|music|dialogue|vo|v\.o\.|voiceover|speech|narration)\b/i.test(visibleTextHeader);
    const explicitlyLabeledVisibleText = extractStoryboardField(
      audioCell,
      ['Visible text', 'On-screen text', 'Onscreen text', 'Text overlay', 'Text', 'CTA'],
    );
    // A mixed column such as "Audio / VO / Text Overlay" does not make every
    // unlabeled cell value visible copy. Treating its ambient sound or quoted
    // VO as textInImage produces boards that literally render the soundtrack.
    // Mixed columns require an explicit visible-text label inside the cell;
    // dedicated visible-text columns may continue to use plain cell values.
    const visibleText = normalizeStoryboardVisibleText(
      explicitlyLabeledVisibleText
        || (
          visibleTextHeaderIndex >= 0 && !visibleTextHeaderIsMixedWithAudioOrVoice
            ? compactStoryboardLine(visibleTextCell)
            : ''
        ),
    );
    const audio = extractStoryboardField(audioCell, ['Audio/SFX', 'Audio', 'SFX', 'FX', 'Foley', 'Sound', 'Sounds'])
      || storyboardTableCellWithoutDialogue(soundCell || audioCell, dialogue);
    const transition = extractStoryboardField(transitionCell, ['Transition', 'Transition out', 'Transition-out', 'Edit'])
      || (transitionHeaderIndex >= 0 ? compactStoryboardLine(transitionCell) : '');
    const number = sections.length + 1;
    const beatLabel = beatHeaderIndex >= 0 && beatHeaderIndex !== timingCellIndex
      ? compactStoryboardLine(cells[beatHeaderIndex])
      : '';
    const purposeLabel = purposeHeaderIndex >= 0
      && purposeHeaderIndex !== timingCellIndex
      && purposeHeaderIndex !== visualIndex
      && purposeHeaderIndex !== beatHeaderIndex
      && purposeHeaderIndex !== dialogueHeaderIndex
      && purposeHeaderIndex !== soundHeaderIndex
      && purposeHeaderIndex !== cameraHeaderIndex
      && purposeHeaderIndex !== visibleTextHeaderIndex
      && purposeHeaderIndex !== transitionHeaderIndex
      ? compactStoryboardLine(cells[purposeHeaderIndex])
      : '';
    const beatTitleSource = purposeLabel && !/^\d{1,2}$/.test(purposeLabel)
      ? purposeLabel
      : beatLabel && !/^\d{1,2}$/.test(beatLabel)
        ? beatLabel
        : '';
    // When the table has a dedicated Purpose/Beat-name column, that label is
    // already a complete title (often "Name: Subtitle"). Appending the visual
    // cell's auto-extracted title produces ugly "X: Y: Z..." strings and
    // truncates Z mid-sentence (visual.title comes from a fixed-length slice
    // of the visual body). The visual content is already preserved in the
    // body's `Visual:` field, so keep the title concise.
    const sceneTitle = beatTitleSource || visual.title;

    sections.push({
      number,
      heading: `Scene ${number} - ${sceneTitle} - ${formatStoryboardSeconds(timing.startSec)}-${formatStoryboardSeconds(timing.endSec)}`,
      body: [
        `Visual: ${visual.description || visual.title}`,
        action ? `Action: ${action}` : '',
        camera ? `Camera: ${camera}` : cameraLighting ? `Camera: ${compactStoryboardLine(cameraLighting)}` : '',
        lighting ? `Lighting: ${lighting}` : '',
        dialogue ? `Dialogue/VO: ${dialogue}` : '',
        visibleText ? `Visible text: ${visibleText}` : '',
        audio ? `Audio/SFX: ${audio}` : '',
        transition ? `Transition: ${transition}` : '',
      ].filter(Boolean).join('\n'),
    });
  }

  return sections;
}

function splitStoryboardSceneSections(text: string): Array<{ number: number; heading: string; body: string }> {
  // Match a storyboard beat heading. The prefix is intentionally
  // permissive so we recognize the common markdown decorations
  // authors use without listing each combination by hand:
  //   `### BEAT 1`             — heading
  //   `- BEAT 1`               — bullet
  //   `**Beat 1**`             — emphasis
  //   `### > BEAT 1`           — heading + blockquote (Markdown callout)
  //   `> BEAT 1`               — blockquote only
  //   `> ### **BEAT 1**`       — any combination of the above
  // The decoration class accepts repeated combinations of bullet,
  // heading, blockquote, and emphasis markers separated by spaces.
  const matches = Array.from(text.matchAll(
    /^\s*(?:[-*+>#_]{1,6}\s*)*(?:[*_]{1,3})?\s*(?:Scene|Shot|Beat|Panel|Frame)\s*_?\s*(\d{1,2})\b\s*(?:[-:.)|]\s*)?([^\n]*)/gim,
  ));
  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const nextStart = index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length;
    return {
      number: Number(match[1]),
      heading: compactStoryboardLine(match[0]),
      body: text.slice(start, nextStart).trim(),
    };
  }).filter(section => Number.isInteger(section.number) && section.number > 0);
}

function splitStoryboardNumberedListSceneSections(text: string): Array<{ number: number; heading: string; body: string }> {
  const headerPattern = /^[ \t]*(?:#{1,6}[ \t]*)?(?:[*_]{1,3})?(?:SCENES?|SHOTS?|BEATS?|PANELS?|FRAMES?|SHOT\s+LIST|SCENE\s+LIST)[ \t]*:[ \t]*(?:[*_]{1,3})?[ \t]*$/gim;
  const headerMatches = Array.from(text.matchAll(headerPattern));
  if (headerMatches.length === 0) return [];

  for (const headerMatch of headerMatches) {
    const blockStart = (headerMatch.index ?? 0) + headerMatch[0].length;
    const block = text.slice(blockStart);
    if (!block) continue;

    const allMatches = Array.from(block.matchAll(
      /^[ \t]*(\d{1,2})[ \t]*[.)][ \t]*([^\n]{0,220})/gim,
    )).filter(match => {
      const value = Number(match[1]);
      return Number.isInteger(value) && value > 0;
    });
    const firstSceneIndex = allMatches.findIndex(match => Number(match[1]) === 1);
    const matches: RegExpMatchArray[] = [];
    for (let index = firstSceneIndex; index >= 0 && index < allMatches.length; index += 1) {
      const expected = matches.length + 1;
      if (Number(allMatches[index][1]) !== expected) break;
      matches.push(allMatches[index]);
    }
    if (matches.length < 2) continue;

    const sections = matches.map((match, index) => {
      const number = Number(match[1]);
      const lineStart = match.index ?? 0;
      const lineEnd = block.indexOf('\n', lineStart);
      const firstLineEnd = lineEnd >= 0 ? lineEnd : block.length;
      const firstLineRemainder = compactStoryboardLine(match[2]);
      const globalTailStart = firstLineEnd;
      const globalTailSection = block.slice(globalTailStart).search(
        /^\s{0,2}(?:CONSISTENCY|NEGATIVE(?:\s*\/\s*AVOID)?|AVOID|CRITICAL\s+REQUIREMENTS|REQUIREMENTS|NOTES|OUTPUT|REFERENCE\s+IMAGES|CANVAS\s*\/\s*LAYOUT)\s*:/im,
      );
      const finalSceneEnd = globalTailSection >= 0
        ? globalTailStart + globalTailSection
        : block.length;
      const nextStart = index + 1 < matches.length ? matches[index + 1].index ?? block.length : finalSceneEnd;
      const trailingBody = block.slice(firstLineEnd, nextStart).trim();
      const titleDescription = firstLineRemainder.match(/^(.{1,80}?)(?:\s+[–—-]\s+|\s*:\s+)([\s\S]{12,})$/);
      const title = compactStoryboardLine(titleDescription?.[1] || firstLineRemainder, `Scene ${String(number).padStart(2, '0')}`);
      const firstBodyLine = compactStoryboardLine(titleDescription?.[2] || firstLineRemainder);
      const body = [firstBodyLine, trailingBody].filter(Boolean).join('\n').trim();
      return {
        number,
        heading: `Scene ${number} - ${title}`,
        body,
      };
    }).filter(section => section.body.length >= 24);

    if (sections.length >= 2) return sections;
  }

  return [];
}

function splitStoryboardInlineSceneSections(text: string): Array<{ number: number; heading: string; body: string }> {
  const markerPattern = /(^|[\s.;])((?:Scene|Shot|Beat|Panel|Frame)\s*_?\s*(\d{1,2})(?:\s*,\s*(?:Scene|Shot|Beat|Panel|Frame)\s*_?\s*\d{1,2})?\s*(?:\([^)]{0,120}\))?\s*(?:[:\-–—]\s*)?)/gi;
  const matches = Array.from(text.matchAll(markerPattern))
    .map(match => {
      const leading = match[1] || '';
      const marker = compactStoryboardLine(match[2]);
      const number = Number(match[3]);
      const start = (match.index ?? 0) + leading.length;
      return { number, marker, start };
    })
    .filter(match => Number.isInteger(match.number) && match.number > 0);

  if (matches.length < 2) return [];

  const sections = matches.map((match, index) => {
    const nextStart = index + 1 < matches.length ? matches[index + 1].start : text.length;
    const body = text.slice(match.start, nextStart).trim();
    return {
      number: match.number,
      heading: match.marker || `Scene ${String(match.number).padStart(2, '0')}`,
      body,
    };
  }).filter(section => section.body.length >= 40);

  if (sections.length < 2) return [];

  const timedSections = sections.filter(section =>
    extractStoryboardTiming(`${section.heading}\n${section.body.slice(0, 240)}`) !== null,
  );
  if (timedSections.length < 2) return [];

  return sections;
}

function splitStoryboardSections(text: string): Array<{ number: number; heading: string; body: string }> {
  const sectionHeadings = splitStoryboardSceneSections(text);
  const tableSections = splitStoryboardTableSections(text);
  const numberedListSections = splitStoryboardNumberedListSceneSections(text);
  const inlineSections = sectionHeadings.length === 0 && tableSections.length === 0 && numberedListSections.length === 0
    ? splitStoryboardInlineSceneSections(text)
    : [];
  const explicitFrameCount = inferExplicitStoryboardFrameCountFromText(text);
  if (tableSections.length > 0 && explicitFrameCount !== null && tableSections.length === explicitFrameCount) {
    return tableSections;
  }
  if (numberedListSections.length > 0 && explicitFrameCount !== null && numberedListSections.length === explicitFrameCount) {
    return numberedListSections;
  }
  if (tableSections.length > 0 && tableSections.length >= sectionHeadings.length) {
    return tableSections;
  }
  if (numberedListSections.length > 0 && numberedListSections.length >= sectionHeadings.length) {
    return numberedListSections;
  }
  if (inlineSections.length > 0) return inlineSections;
  return sectionHeadings.length > 0 ? sectionHeadings : tableSections;
}

function extractPlainNarrationScriptText(text: string, allowUnlabeledProse = false): string {
  const source = text.trim();
  if (!source) return '';
  const markers = Array.from(source.matchAll(/^\s*(?:#{1,6}\s*)?(?:voice[-\s]?over\s+|narration\s+)?script\s*:\s*$/gim));
  const marker = markers[markers.length - 1];
  if (marker?.index !== undefined) {
    const body = source.slice(marker.index + marker[0].length).trim();
    return body
      .split(/\r?\n/)
      .map(line => stripStoryboardMarkup(line).trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }

  // Unlabeled prose is accepted only from the typed approved-script channel.
  // User/request text still needs a Script: marker so production instructions
  // cannot be reinterpreted as narrative because they resemble a story.
  if (!allowUnlabeledProse) return '';
  return source
    .split(/\r?\n/)
    .map(line => stripStoryboardMarkup(line).trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function countNarrativeCharacters(text: string): number {
  return Array.from(text)
    .filter(character => /[\p{L}\p{N}]/u.test(character))
    .length;
}

function splitPlainNarrationPhrases(text: string): string[] {
  const normalized = text
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  const sentenceMatches: string[] = [];
  let sentenceStart = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    if (!/[.!?。！？]/u.test(normalized[index])) continue;
    const terminator = normalized[index];
    let boundaryEnd = index + 1;
    while (boundaryEnd < normalized.length && /["'”’»」』)\]]/u.test(normalized[boundaryEnd])) {
      boundaryEnd += 1;
    }
    let nextStart = boundaryEnd;
    while (nextStart < normalized.length && /\s/.test(normalized[nextStart])) nextStart += 1;
    const next = normalized[nextStart] ?? '';
    const hasClosingQuote = boundaryEnd > index + 1;
    // Keep a lower-case dialogue attribution (for example, `” she said.`)
    // with the quote. This is a Unicode structural test, not a catalog of
    // English speech verbs or character names.
    if (hasClosingQuote && /\p{Ll}/u.test(next)) continue;
    // A decimal point is not a sentence boundary. Other terminators are valid
    // without following whitespace so CJK prose is segmented correctly.
    if (terminator === '.'
      && boundaryEnd === nextStart
      && /\d/.test(normalized[index - 1] ?? '')
      && /\d/.test(next)) continue;
    const sentence = normalized.slice(sentenceStart, boundaryEnd).trim();
    if (sentence) sentenceMatches.push(sentence);
    sentenceStart = nextStart;
    index = Math.max(index, boundaryEnd - 1);
  }
  const tail = normalized.slice(sentenceStart).trim();
  if (tail) sentenceMatches.push(tail);
  if (sentenceMatches.length === 0) sentenceMatches.push(normalized);
  return sentenceMatches
    .flatMap(sentence => sentence
      .split(/\s*(?:;|:\s+|,\s+(?=(?:and|but|so|whether|from|across|under|while|as)\b))\s*/i)
      .map(part => compactStoryboardLine(part)))
    .filter(part => countNarrativeCharacters(part) > 0);
}

function splitPhraseAtWordMidpoint(value: string): [string, string] | null {
  const words = value.match(/\S+/g) ?? [];
  if (words.length < 8) return null;
  const midpoint = Math.floor(words.length / 2);
  const left = words.slice(0, midpoint).join(' ').trim();
  const right = words.slice(midpoint).join(' ').trim();
  return left && right ? [left, right] : null;
}

function normalizeNarrationSegmentCount(phrases: string[], frameCount: number): string[] {
  if (frameCount <= 0) return [];
  let segments = phrases.slice();
  while (segments.length < frameCount) {
    let longestIndex = -1;
    let longestCount = 0;
    for (let index = 0; index < segments.length; index += 1) {
      const words = countWords(segments[index]);
      if (words > longestCount) {
        longestCount = words;
        longestIndex = index;
      }
    }
    if (longestIndex < 0) break;
    const split = splitPhraseAtWordMidpoint(segments[longestIndex]);
    if (!split) break;
    segments.splice(longestIndex, 1, split[0], split[1]);
  }

  if (segments.length <= frameCount) return segments;

  const merged: string[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const start = Math.floor(index * segments.length / frameCount);
    const end = Math.floor((index + 1) * segments.length / frameCount);
    const chunk = segments.slice(start, Math.max(start + 1, end)).join(' ');
    if (chunk.trim()) merged.push(chunk.trim());
  }
  return merged;
}

function titleFromNarrationSegment(segment: string, index: number): string {
  const words = compactStoryboardLine(segment)
    .replace(/["'()]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ');
  return words || `Narration Beat ${index + 1}`;
}

function synthesizeStoryboardSectionsFromPlainNarration(
  sourceText: string,
  frameCount: number,
  references: ReferenceAsset[],
  allowUnlabeledProse = false,
): Array<{ number: number; heading: string; body: string }> {
  const explicitlyLabeledNarration = /^\s*(?:#{1,6}\s*)?(?:voice[-\s]?over\s+|narration\s+)?script\s*:\s*$/im.test(sourceText);
  const script = extractPlainNarrationScriptText(sourceText, allowUnlabeledProse);
  if (!script || (countWords(script) < 8 && countNarrativeCharacters(script) < 24)) return [];
  const phrases = splitPlainNarrationPhrases(script);
  const segments = normalizeNarrationSegmentCount(phrases, frameCount).slice(0, frameCount);
  if (segments.length === 0) return [];

  const referenceLine = references.length > 0
    ? `Reference usage: ${references.map(ref => `Image ${ref.index ?? references.indexOf(ref) + 1}`).join(', ')}.`
    : '';
  const cameraPresets = [
    'Wide establishing composition that introduces the setting, subject, or idea named in the narration.',
    'Medium composition focused on the active subject, action, or relationship in this beat.',
    'Detail insert on concrete objects, gestures, text, environment, or visual evidence named in the narration.',
    'Tracking or reveal-style composition that moves the story into the next idea.',
  ];

  return segments.map((segment, index) => {
    // In user-designated story prose, preserve quoted text as authored speech
    // without an English verb/name catalog. The quote itself is the structural
    // signal; unquoted prose remains visual/action material.
    const quotedSpeech = extractQuotedDialogueSegments(segment)
      .map(item => compactStoryboardLine(item))
      .filter(Boolean);
    const dialogue = explicitlyLabeledNarration
      ? segment
      : quotedSpeech.join(' ') || '[no dialogue]';
    return {
      number: index + 1,
      heading: `Scene ${index + 1} - ${titleFromNarrationSegment(segment, index)}`,
      body: [
        `Purpose: Translate story beat ${index + 1} into a concrete ordered storyboard moment.`,
        `Visual/Action: Create a concrete visual moment using only this story beat and the supplied references: ${segment}`,
        `Camera/Motion: ${cameraPresets[index % cameraPresets.length]}`,
        'Lighting/Style: Match the visual style, genre, and tone implied by the user request and supplied references; keep the frame cinematic but readable as a storyboard panel.',
        'Transition: Maintain continuity from the previous beat through subject, setting, gesture, camera direction, color, or motion when those cues are present.',
        `Dialogue/VO: ${dialogue}`,
        'Audio/SFX: Use only audio cues implied by the story or user request; otherwise keep ambience or music generic and unobtrusive.',
        referenceLine,
      ].filter(Boolean).join('\n'),
    };
  });
}

function storyboardSectionsHavePreservableExplicitTiming(
  sections: Array<{ number: number; heading: string; body: string }>,
): boolean {
  return sections.length > 1
    && sections.every(section => extractStoryboardTiming(`${section.heading}\n${section.body}`) !== null);
}

function canonicalStoryboardScriptContext(text: string | null | undefined): string {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';

  const cutoffPattern = /^\s*(?:[-*+]\s*)?(?:#{1,6}\s*)?(?:[*_]{1,3})?\s*(?:[^\w\n]{0,12}\s*)?(?:storyboard\s+image\s+brief|subsequent\s+video\s+brief|video\s+generation\s+stage|next\s+steps?)\b[^\n]*$/gim;
  for (const match of trimmed.matchAll(cutoffPattern)) {
    const before = trimmed.slice(0, match.index ?? 0).trim();
    if (before && splitStoryboardSections(before).length > 0) {
      return before;
    }
  }

  return trimmed;
}

function escapeStoryboardRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueStoryboardStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map(item => compactStoryboardLine(item)).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function normalizeStoryboardContractTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStoryboardStrings(value.filter((item): item is string => typeof item === 'string'));
}

function storyboardScenePlanningContractForIndex(
  contract: StoryboardPlanningContract | null | undefined,
  sceneNumber: number,
): StoryboardScenePlanningContract | null {
  const scenes = Array.isArray(contract?.scenes) ? contract.scenes : [];
  const id = `scene_${String(sceneNumber).padStart(2, '0')}`.toLowerCase();
  return scenes.find(scene => typeof scene.id === 'string' && scene.id.toLowerCase() === id)
    ?? scenes.find(scene => scene.index === sceneNumber)
    ?? null;
}

function removeStoryboardMetadataLabelsFromVisibleText(
  visibleText: string[],
  metadataLabels: string[],
): string[] {
  if (metadataLabels.length === 0) return visibleText;
  const metadataKeys = new Set(metadataLabels.map(item => compactStoryboardLine(item).toLowerCase()));
  return visibleText.filter(item => !metadataKeys.has(compactStoryboardLine(item).toLowerCase()));
}

function metadataLabelsFromPlanningContract(
  contract: StoryboardPlanningContract | null | undefined,
): string[] {
  return uniqueStoryboardStrings([
    ...normalizeStoryboardContractTextArray(contract?.metadataLabels),
    ...normalizeStoryboardContractTextArray(contract?.endCard?.metadataLabels),
    ...(Array.isArray(contract?.scenes)
      ? contract.scenes.flatMap(scene => normalizeStoryboardContractTextArray(scene.metadataLabels))
      : []),
  ]);
}

function storyboardReferenceSubjectTokens(ref: ReferenceAsset): string[] {
  const subject = ref.description.match(/\bSubject:\s*([\s\S]*?)\s+Usage:/i)?.[1] || '';
  if (!subject) return [];
  const stopWords = new Set([
    'asset',
    'image',
    'photo',
    'picture',
    'reference',
    'source',
    'input',
    'make',
    'video',
    'storyboard',
    'seedance',
    'featuring',
    'product',
    'brand',
    'model',
    'duration',
    'format',
    'launch',
    'promo',
    'commercial',
    'with',
    'from',
    'that',
    'this',
    'used',
    'using',
    'where',
    'scene',
    'scenes',
    'final',
    'card',
    'only',
    'unless',
  ]);
  return uniqueStoryboardStrings(
    subject
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length >= 4 && !stopWords.has(token)),
  );
}

function storyboardReferenceSubjectMatchesSection(ref: ReferenceAsset, lowerSection: string): boolean {
  return storyboardReferenceSubjectTokens(ref).some(token =>
    new RegExp(String.raw`\b${escapeStoryboardRegExp(token)}\b`, 'i').test(lowerSection),
  );
}

function sceneReferencesFromSection(section: string, references: ReferenceAsset[]): string[] {
  const used = references
    .filter(ref => ref.index && new RegExp(String.raw`\b(?:image|photo|picture|asset)\s*(?:#|number\s*)?${ref.index}\b`, 'i').test(section))
    .map(ref => ref.id);
  if (used.length > 0) return used;

  const lower = section.toLowerCase();
  const roleMatches = references
    .filter(ref => {
      if (ref.kind === 'logo') return /\b(?:logo|wordmark|brand|brand\s+mark|end\s+card|cta|tagline)\b/i.test(lower);
      if (ref.kind === 'style' || ref.kind === 'background') return /\b(?:style|look|lighting|palette|background|environment|setting)\b/i.test(lower);
      return false;
    })
    .map(ref => ref.id);
  if (roleMatches.length > 0) return uniqueStoryboardStrings(roleMatches);

  const subjectMatches = references
    .filter(ref => ref.kind !== 'logo')
    .filter(ref => storyboardReferenceSubjectMatchesSection(ref, lower))
    .map(ref => ref.id);
  if (subjectMatches.length > 0) return uniqueStoryboardStrings(subjectMatches);

  return references
    .filter(ref => ref.usageScope === 'global')
    .filter(ref => {
      if (ref.kind === 'character') {
        return /\b(?:character|mascot|person|people|face|actor|host|protagonist|subject|hero|doll|toy|figure|avatar|girl|boy|woman|man|she|he|they|her|him)\b/i.test(lower);
      }
      if (ref.kind === 'product') {
        return /\b(?:product|package|device|object|item|prototype|model|tool|app|platform|integration|feature)\b/i.test(lower);
      }
      return false;
    })
    .map(ref => ref.id);
}

function sceneTextRequirementsFromSection(section: string): string[] {
  const required = extractStoryboardRequiredText(section);
  const visualCueContext = [
    section.split(/\r?\n/, 1)[0] || '',
    extractStoryboardField(section, ['Visual/Action', 'Visual Frame', 'Visual', 'Frame', 'Image', 'Shot']),
    extractStoryboardField(section, ['Action/Motion', 'Action', 'Motion', 'Performance']),
    extractStoryboardField(section, ['Product/Feature', 'Product feature', 'Feature mapping', 'Product meaning', 'Feature', 'Capability']),
  ].filter(Boolean).join('\n');
  const hasVisibleTextCue = /\b(?:visible\s+text|on[-\s]?screen\s+text|onscreen\s+text|text\s+overlay|title\s+card|end\s+card|cta|tagline|headline|slogan|copy|wordmark|text\s+(?:appears|changes|updates|fades|reads|below)|reads\s*:)\b/i.test(visualCueContext);

  if (!hasVisibleTextCue) {
    return required;
  }

  const quotedVisualText = extractQuotedDialogueSegments(visualCueContext)
    .map(text => compactStoryboardLine(text))
    .filter(Boolean)
    .filter(text => !/^[-\u2013\u2014]\.?$/.test(text))
    .filter(text => !/^(?:none|no\s+(?:visible\s+)?text|n\/a|not\s+specified)$/i.test(text));

  return uniqueStoryboardStrings([...required, ...quotedVisualText]);
}

function isNoAudioPlaceholder(value: string): boolean {
  return /^(?:no\s+(?:audio|sound|sfx|audio\/sfx)(?:\s+specified)?|none|n\/a|not\s+specified)\.?$/i.test(value.trim());
}

function sanitizeStoryboardExternalAudioReferences(value: string): string {
  let sanitized = value;
  sanitized = sanitized
    .replace(/\b(?:trending|viral|popular)\s+(?:TikTok\s+)?(?:audio|sound|song|track)\b/gi, 'video-model-generated social-video music bed')
    .replace(/\b(?:a\s+)?(?:trending|viral|popular)\s+(?:upbeat\s+)?(?:audio|sound|song|track)\b/gi, 'a video-model-generated upbeat social-video music bed')
    .replace(/\b(?:existing|external|licensed|commercial)\s+(?:audio|sound|song|track|music)\b/gi, 'generated audio');

  sanitized = sanitized.replace(
    /\b(?:all\s+)?(?:cuts?|edits?|transitions?)\s+(?:must\s+|should\s+)?(?:align|sync|cut)\s+(?:perfectly\s+|exactly\s+)?(?:with|to)\s+([^.!?\n]*(?:beat|beats|drop|drops|snare|hi[-/\s]?hat|kick|percussion)[^.!?\n]*)[.!?]?/gi,
    'Cuts should follow a generated music bed, with percussion hits, beat drops, whooshes, and foley cues described for the video model.',
  );

  if (/\b(?:snare|hi-hat|beat drops?|cuts?)\b/i.test(sanitized) && /\bvideo-model-generated\b/i.test(sanitized)) {
    sanitized = sanitized.replace(/\bperfectly\b/gi, 'clearly');
  }
  return sanitized;
}

// Split `value` on commas/semicolons, but only at top level — commas inside
// parentheses/brackets/braces/quotes stay inside their phrase. Without this
// "Low, annoying office drone (AC hum, distant typing)." would split into
// 3 tokens; we want it to stay as one (or two, if the leading "Low,
// annoying" is its own clause).
function splitStoryboardSfxAtTopLevel(value: string): string[] {
  const result: string[] = [];
  let buffer = '';
  let parens = 0;
  let brackets = 0;
  let braces = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (inSingleQuote) {
      buffer += ch;
      if (ch === "'") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      buffer += ch;
      if (ch === '"') inDoubleQuote = false;
      continue;
    }
    if (ch === "'") { inSingleQuote = true; buffer += ch; continue; }
    if (ch === '"') { inDoubleQuote = true; buffer += ch; continue; }
    if (ch === '(') parens += 1;
    else if (ch === ')' && parens > 0) parens -= 1;
    else if (ch === '[') brackets += 1;
    else if (ch === ']' && brackets > 0) brackets -= 1;
    else if (ch === '{') braces += 1;
    else if (ch === '}' && braces > 0) braces -= 1;
    if ((ch === ',' || ch === ';') && parens === 0 && brackets === 0 && braces === 0) {
      if (buffer.trim()) result.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  if (buffer.trim()) result.push(buffer.trim());
  return result;
}

function normalizeStoryboardAudioSfx(value: string): string[] {
  const compact = sanitizeStoryboardExternalAudioReferences(compactStoryboardLine(value));
  if (!compact || isNoAudioPlaceholder(compact)) return [];
  return splitStoryboardSfxAtTopLevel(compact).filter(Boolean);
}

function buildSceneFromSection(
  section: { number: number; heading: string; body: string },
  references: ReferenceAsset[],
  fallbackTiming: { startSec: number; endSec: number; durationSec: number } | null,
  planningContract?: StoryboardScenePlanningContract | null,
): SceneSpec {
  const combined = `${section.heading}\n${section.body}`;
  // A scene ordinal is structure, not a time value. Exclude the leading
  // `Scene 1 -`/`Shot 2:` marker before applying the permissive legacy timing
  // parser so numeric titles (years, model names, versions) cannot create a
  // false timeline offset. Explicit timing later in the heading or body stays
  // available to the parser.
  const timingSource = `${section.heading.replace(
    /^\s*(?:[-*+>#_]{1,6}\s*)*(?:[*_]{1,3})?\s*(?:Scene|Shot|Beat|Panel|Frame)\s*_?\s*\d{1,2}\b\s*(?:[-:.)|]\s*)?/i,
    '',
  )}\n${section.body}`;
  const timing = extractStoryboardTiming(timingSource) ?? fallbackTiming;
  const normalizedHeading = stripStoryboardMarkup(section.heading)
    .replace(/^\s*#{1,6}\s*/, '');
  const title = compactStoryboardLine(
    removeStoryboardTimingText(
      normalizedHeading
        .replace(/^\s*(?:Scene|Shot|Beat|Panel|Frame)\s*\d{1,2}\b\s*(?:[-:.)|]\s*)?/i, ''),
    ),
    `Scene ${String(section.number).padStart(2, '0')}`,
  );
  const dialogueField = extractStoryboardField(combined, [
    'Dialogue/VO',
    'VO/Dialogue',
    'Dialogue',
    'VO',
    'V.O.',
    'Voiceover',
    'Voice-over',
    'Speech',
    'Narration',
  ]);
  const hasExplicitNoDialogueField = /\b(?:Dialogue\/VO|VO\/Dialogue|Dialogue|VO|V\.O\.|Voiceover|Voice-over|Speech|Narration)\s*:\s*(?:none|no\s+(?:spoken\s+)?(?:dialogue|vo|voiceover|voice-over|speech)|n\/a|not\s+specified|text\s+only)\b/i.test(combined);
  const dialogue = dialogueField
    ? normalizeStoryboardDialogue(dialogueField)
    : hasExplicitNoDialogueField
      ? ''
    : /\b(?:VO|V\.O\.|voiceover|voice-over|dialogue|speech|narration|says?|speaks?|whispers?|shouts?)\b/i.test(combined)
      ? extractQuotedDialogueSegments(combined)[0] || ''
      : '';
  const audio = extractStoryboardField(combined, ['Audio/SFX', 'Audio/Foley', 'Foley/SFX', 'Audio', 'SFX', 'FX', 'Foley', 'Sound', 'Sounds']);
  const audioSfx = normalizeStoryboardAudioSfx(audio);
  const metadataLabels = normalizeStoryboardContractTextArray(planningContract?.metadataLabels);
  const hasTypedVisibleText = Array.isArray(planningContract?.visibleText);
  const visibleText = hasTypedVisibleText
    ? normalizeStoryboardContractTextArray(planningContract?.visibleText)
    : sceneTextRequirementsFromSection(combined);
  const referenceUsage = Array.isArray(planningContract?.referenceUsage)
    ? uniqueStoryboardStrings(planningContract.referenceUsage)
    : sceneReferencesFromSection(combined, references);

  return {
    id: `scene_${String(section.number).padStart(2, '0')}`,
    title,
    startSec: timing?.startSec ?? null,
    endSec: timing?.endSec ?? null,
    durationSec: timing?.durationSec ?? null,
    purpose: extractStoryboardField(combined, ['Purpose', 'Story purpose', 'Narrative purpose', 'Beat purpose', 'Scene purpose', 'Why this beat exists']),
    productFeature: extractStoryboardField(combined, ['Product/Feature', 'Product feature', 'Feature mapping', 'Product meaning', 'Product idea', 'Feature', 'Capability']),
    visual: extractStoryboardField(combined, ['Visual/Action', 'Visual Frame', 'Visual', 'Frame', 'Image', 'Shot']) || compactStoryboardLine(section.body.slice(0, 240)),
    action: extractStoryboardField(combined, ['Action/Motion', 'Action', 'Motion', 'Performance', 'Beat']),
    camera: extractStoryboardField(combined, ['Camera/Motion', 'Camera', 'Framing', 'Shot type']),
    lighting: extractStoryboardField(combined, ['Lighting/Style', 'Lighting', 'Style', 'Look']),
    transitionIn: extractStoryboardField(combined, ['Transition in', 'Transition-in', 'In']),
    transitionOut: extractStoryboardField(combined, ['Transition', 'Transition out', 'Transition-out', 'Edit']),
    dialogue,
    audioSfx,
    music: sanitizeStoryboardExternalAudioReferences(extractStoryboardField(combined, ['Music', 'Score', 'Underscore'])),
    referenceUsage,
    textInImage: removeStoryboardMetadataLabelsFromVisibleText(visibleText, metadataLabels),
    metadataLabels,
    mustAvoid: extractStoryboardAvoidConstraints(combined),
  };
}

function applyStoryboardScenePlanningContract(
  scene: SceneSpec,
  planningContract: StoryboardScenePlanningContract | null,
): SceneSpec {
  if (!planningContract) return scene;
  const metadataLabels = normalizeStoryboardContractTextArray(planningContract.metadataLabels);
  const hasTypedVisibleText = Array.isArray(planningContract.visibleText);
  const visibleText = hasTypedVisibleText
    ? normalizeStoryboardContractTextArray(planningContract.visibleText)
    : scene.textInImage;
  const referenceUsage = Array.isArray(planningContract.referenceUsage)
    ? uniqueStoryboardStrings(planningContract.referenceUsage)
    : scene.referenceUsage;
  return {
    ...scene,
    referenceUsage,
    textInImage: removeStoryboardMetadataLabelsFromVisibleText(visibleText, metadataLabels),
    metadataLabels,
  };
}

function normalizeAssistantStoryboardSceneTiming(
  scenes: SceneSpec[],
  targetDurationSec: number | null,
  promptAuthorship: StoryboardPromptCompileOptions['promptAuthorship'],
): SceneSpec[] {
  if (promptAuthorship !== 'assistant' || targetDurationSec === null || scenes.length === 0) {
    return scenes;
  }

  const timedScenes = scenes.filter(scene =>
    scene.startSec !== null
    && scene.endSec !== null
    && scene.durationSec !== null
    && scene.endSec > scene.startSec
    && scene.durationSec > 0,
  );
  if (timedScenes.length !== scenes.length) return scenes;

  const totalSceneDurationSec = Math.round(
    scenes.reduce((sum, scene) => sum + (scene.durationSec ?? 0), 0) * 100,
  ) / 100;
  if (totalSceneDurationSec <= 0) return scenes;

  const diff = Math.abs(totalSceneDurationSec - targetDurationSec);
  if (diff <= DEFAULT_STORYBOARD_TIMING_RULES.toleranceSec) return scenes;

  const scale = targetDurationSec / totalSceneDurationSec;
  const timelineStartSec = scenes[0].startSec ?? 0;
  const timelineEndSec = Math.round((timelineStartSec + targetDurationSec) * 100) / 100;
  let cursor = timelineStartSec;

  return scenes.map((scene, index) => {
    const isLast = index === scenes.length - 1;
    const startLimit = isLast ? timelineEndSec - 0.01 : cursor;
    const startSec = Math.round(Math.min(cursor, startLimit) * 100) / 100;
    const endSec = isLast
      ? timelineEndSec
      : Math.round((startSec + Math.max(0.01, (scene.durationSec ?? 0) * scale)) * 100) / 100;
    const durationSec = Math.round((endSec - startSec) * 100) / 100;
    cursor = endSec;

    return {
      ...scene,
      startSec,
      endSec,
      durationSec,
    };
  });
}

interface StoryboardDialogueWordSpan {
  token: string;
  start: number;
  end: number;
}

interface StoryboardMatchedDialogueScene {
  sceneIndex: number;
  startIndex: number;
}

interface StoryboardDialogueAlignmentResult {
  scenes: SceneSpec[];
  shouldRetime: boolean;
}

function normalizeStoryboardDialogueToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/^'+|'+$/g, '');
}

function storyboardDialogueWordSpans(text: string): StoryboardDialogueWordSpan[] {
  const spans: StoryboardDialogueWordSpan[] = [];
  const pattern = /[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)?/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    spans.push({
      token: normalizeStoryboardDialogueToken(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return spans;
}

function storyboardDialogueCoverage(sourceDialogue: string, currentDialogue: string): number {
  const sourceTokens = storyboardDialogueWordSpans(sourceDialogue).map(span => span.token);
  const currentTokens = storyboardDialogueWordSpans(currentDialogue).map(span => span.token);
  if (sourceTokens.length === 0) return 1;
  if (currentTokens.length === 0) return 0;

  let cursor = 0;
  let matched = 0;
  for (const token of sourceTokens) {
    const foundIndex = currentTokens.indexOf(token, cursor);
    if (foundIndex < 0) continue;
    matched += 1;
    cursor = foundIndex + 1;
  }

  return matched / sourceTokens.length;
}

function sourceQuotedStoryboardDialogueSegments(userIntentText: string): string[] {
  const text = normalizeScreenplayDialogueQuotes(userIntentText.replace(/[“”]/g, '"')) || '';
  const segments: string[] = [];
  const pattern = /"([^"]{1,800})"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const index = match.index;
    const before = text.slice(Math.max(0, index - 180), index);
    const after = text.slice(pattern.lastIndex, Math.min(text.length, pattern.lastIndex + 120));
    const context = `${before} ${after}`;
    const lineStart = text.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
    const nextLineBreak = text.indexOf('\n', pattern.lastIndex);
    const lineEnd = nextLineBreak >= 0 ? nextLineBreak : text.length;
    const lineContext = text.slice(lineStart, lineEnd);
    const speechContext = /\b(?:dialogue|vo|v\.o\.|voiceover|voice-over|speech|spoken|monologue|narration|line|lines|say|says|said|speak|speaks|speaking|script)\b/i.test(context);
    const lineSpeechContext = /\b(?:dialogue|vo|v\.o\.|voiceover|voice-over|speech|spoken|monologue|narration|say|says|said|speak|speaks|speaking)\b/i.test(lineContext);
    const lineVisibleTextOnly = /\b(?:visible|on[-\s]?screen|onscreen|text|copy|cta|tagline|headline|title\s+card|logo|wordmark|spell(?:ed)?|read(?:s)?|end\s+card|slogan)\b/i.test(lineContext)
      && !lineSpeechContext;
    const lineNonVoiceMetadata = /\b(?:working\s+title|title|format|duration|aspect(?:\s+ratio)?|reference\s+assets?)\s*:/i.test(lineContext)
      && !lineSpeechContext;
    const value = compactStoryboardLine(match[1]);
    if (value && speechContext && !lineVisibleTextOnly && !lineNonVoiceMetadata) segments.push(value);
  }

  return segments;
}

function findStoryboardDialogueStartIndex(
  sourceSpans: StoryboardDialogueWordSpan[],
  dialogue: string,
  cursor: number,
): number | null {
  const dialogueTokens = storyboardDialogueWordSpans(dialogue).map(span => span.token);
  if (dialogueTokens.length === 0) return null;

  const maxNeedleLength = Math.min(3, dialogueTokens.length);
  for (let needleLength = maxNeedleLength; needleLength >= 1; needleLength -= 1) {
    const needle = dialogueTokens.slice(0, needleLength);
    for (let index = cursor; index <= sourceSpans.length - needleLength; index += 1) {
      const matches = needle.every((token, offset) => sourceSpans[index + offset]?.token === token);
      if (matches) return index;
    }
  }

  return null;
}

function sourceDialogueSliceForWordRange(
  sourceDialogue: string,
  sourceSpans: StoryboardDialogueWordSpan[],
  startIndex: number,
  endExclusive: number,
): string {
  const start = sourceSpans[startIndex]?.start ?? 0;
  const lastSpan = sourceSpans[Math.max(startIndex, endExclusive - 1)];
  if (!lastSpan) return '';
  const nextStart = sourceSpans[endExclusive]?.start ?? sourceDialogue.length;
  const trailing = sourceDialogue.slice(lastSpan.end, nextStart).match(/^[\s.,!?;:…'"’”)}\]-]*/)?.[0] ?? '';
  return sourceDialogue.slice(start, lastSpan.end + trailing.length).trim();
}

function matchSourceDialogueSceneStarts(
  scenes: SceneSpec[],
  sourceSpans: StoryboardDialogueWordSpan[],
): StoryboardMatchedDialogueScene[] | null {
  const dialogueScenes = scenes
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => scene.dialogue.trim().length > 0);
  if (sourceSpans.length === 0 || dialogueScenes.length === 0) return null;

  const matches: StoryboardMatchedDialogueScene[] = [];
  let cursor = 0;
  for (const { scene, index } of dialogueScenes) {
    const start = findStoryboardDialogueStartIndex(sourceSpans, scene.dialogue, cursor);
    if (start === null) return null;
    matches.push({ sceneIndex: index, startIndex: start });
    cursor = start + 1;
  }

  return matches;
}

function redistributeSourceDialogueAcrossMatchedScenes(
  scenes: SceneSpec[],
  sourceDialogue: string,
  matches: StoryboardMatchedDialogueScene[],
): SceneSpec[] | null {
  const sourceSpans = storyboardDialogueWordSpans(sourceDialogue);
  if (sourceSpans.length === 0 || matches.length === 0) return null;

  const repaired = scenes.slice();
  for (let index = 0; index < matches.length; index += 1) {
    const sceneIndex = matches[index].sceneIndex;
    const start = matches[index].startIndex;
    const end = matches[index + 1]?.startIndex ?? sourceSpans.length;
    if (end <= start) return null;
    const dialogue = sourceDialogueSliceForWordRange(sourceDialogue, sourceSpans, start, end);
    if (!dialogue) return null;
    repaired[sceneIndex] = {
      ...repaired[sceneIndex],
      dialogue,
    };
  }

  return repaired;
}

function alignAssistantStoryboardDialogueWithUserSource(
  scenes: SceneSpec[],
  userIntentText: string,
  promptAuthorship: StoryboardPromptCompileOptions['promptAuthorship'],
): StoryboardDialogueAlignmentResult {
  if (promptAuthorship !== 'assistant') return { scenes, shouldRetime: false };

  const sourceDialogue = sourceQuotedStoryboardDialogueSegments(userIntentText).join(' ');
  if (!sourceDialogue) return { scenes, shouldRetime: false };

  const sourceSpans = storyboardDialogueWordSpans(sourceDialogue);
  const matches = matchSourceDialogueSceneStarts(scenes, sourceSpans);
  if (!matches) return { scenes, shouldRetime: false };

  const currentDialogue = scenes.map(scene => scene.dialogue).filter(Boolean).join(' ');
  if (storyboardDialogueCoverage(sourceDialogue, currentDialogue) >= 1) {
    return { scenes, shouldRetime: true };
  }

  const repaired = redistributeSourceDialogueAcrossMatchedScenes(scenes, sourceDialogue, matches);
  if (!repaired) return { scenes, shouldRetime: false };

  return { scenes: repaired, shouldRetime: true };
}

function minimumStoryboardSceneDurationForDialogue(
  scene: SceneSpec,
  rules: StoryboardTimingRules,
  wordsPerSecondMax = rules.normalWordsPerSecondMax,
): number {
  const dialogueWords = countWords(scene.dialogue);
  let minDuration = dialogueWords > 0
    ? dialogueWords / wordsPerSecondMax
    : 0.5;
  const sceneContext = `${scene.title}\n${scene.visual}\n${scene.textInImage.join(' ')}`;
  const hasReadableText = scene.textInImage.length > 0;
  const isEndCard = /\b(?:end card|outro|cta|final|logo|brand resolve)\b/i.test(sceneContext);
  if (isEndCard) {
    minDuration = Math.max(minDuration, rules.minEndCardHoldSec);
  } else if (hasReadableText) {
    minDuration = Math.max(minDuration, 1.2);
  }
  return Math.round(minDuration * 100) / 100;
}

function retimeStoryboardScenesForDialogue(
  scenes: SceneSpec[],
  targetDurationSec: number | null,
  rules: StoryboardTimingRules = DEFAULT_STORYBOARD_TIMING_RULES,
): SceneSpec[] {
  if (targetDurationSec === null || scenes.length === 0) return scenes;
  const hasCompletePositiveTiming = scenes.every(scene =>
    scene.startSec !== null
    && scene.endSec !== null
    && scene.durationSec !== null
    && scene.durationSec > 0,
  );
  const sourceDurations = scenes.map(scene => (
    scene.durationSec !== null && scene.durationSec > 0
      ? scene.durationSec
      : targetDurationSec / scenes.length
  ));

  const minimumDurations = scenes.map(scene => minimumStoryboardSceneDurationForDialogue(scene, rules));
  const needsRetiming = !hasCompletePositiveTiming
    || scenes.some((scene, index) => (scene.durationSec ?? 0) + rules.toleranceSec < minimumDurations[index]);
  if (!needsRetiming) return scenes;

  let requiredDurations = minimumDurations;
  let minimumTotal = Math.round(requiredDurations.reduce((sum, duration) => sum + duration, 0) * 100) / 100;
  if (minimumTotal > targetDurationSec + rules.toleranceSec && rules.fastWordsPerSecondMax > rules.normalWordsPerSecondMax) {
    const fastDurations = scenes.map(scene => minimumStoryboardSceneDurationForDialogue(
      scene,
      rules,
      rules.fastWordsPerSecondMax,
    ));
    const fastTotal = Math.round(fastDurations.reduce((sum, duration) => sum + duration, 0) * 100) / 100;
    if (fastTotal <= targetDurationSec + rules.toleranceSec) {
      requiredDurations = fastDurations;
      minimumTotal = fastTotal;
    }
  }
  if (minimumTotal > targetDurationSec + rules.toleranceSec) return scenes;

  const extraDuration = Math.max(0, targetDurationSec - minimumTotal);
  const weightTotal = sourceDurations.reduce((sum, duration) => sum + Math.max(0.01, duration), 0);
  const unroundedDurations = requiredDurations.map((minimum, index) => (
    minimum + (extraDuration * Math.max(0.01, sourceDurations[index]) / weightTotal)
  ));
  const timelineStartSec = scenes[0].startSec ?? 0;
  const timelineEndSec = Math.round((timelineStartSec + targetDurationSec) * 100) / 100;
  let cursor = timelineStartSec;

  return scenes.map((scene, index) => {
    const isLast = index === scenes.length - 1;
    const startSec = Math.round(cursor * 100) / 100;
    const endSec = isLast
      ? timelineEndSec
      : Math.round((startSec + unroundedDurations[index]) * 100) / 100;
    const durationSec = Math.round((endSec - startSec) * 100) / 100;
    cursor = endSec;

    return {
      ...scene,
      startSec,
      endSec,
      durationSec,
    };
  });
}

function quotedStoryboardVoiceLinesFromText(text: string): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = compactStoryboardLine(stripStoryboardMarkup(rawLine));
    if (!line || !/"[^"]{1,800}"/.test(line)) continue;

    const fieldLabel = line.match(/^\s*(?:[-*+]\s*)?(?:[*_]{1,3})?\s*([^:\n]{1,60})\s*:/)?.[1] ?? '';
    const isExplicitVoiceField = /\b(?:dialogue|vo|v\.o\.|voiceover|voice-over|speech|narration|spoken)\b/i.test(fieldLabel);
    const isNonVoiceProductionField =
      /\b(?:audio|sfx|fx|foley|sound|music|action|motion|transition|camera|lighting|style|visual|visible|text|copy|cta|tagline|headline|title\s+card|caption|subtitle|super)\b/i.test(fieldLabel)
      && !isExplicitVoiceField;
    const hasSpeechVerb = /\b(?:says?|speaks?|speaking|asks?|replies?|responds?|whispers?|shouts?|yells?|sings?|narrates?|voiceover|voice-over)\b/i.test(line);
    if (isNonVoiceProductionField && !hasSpeechVerb) continue;
    if (!isExplicitVoiceField && !hasSpeechVerb) continue;

    lines.push(...extractQuotedDialogueSegments(line).map(item => compactStoryboardLine(item)).filter(Boolean));
  }
  return lines;
}

function assignVoiceLinesToScenes(scenes: SceneSpec[], sourceText: string): VoiceLine[] {
  const sceneLines = scenes.flatMap(scene => {
    const dialogue = scene.dialogue.trim();
    if (!dialogue) return [];
    const quoted = extractQuotedDialogueSegments(dialogue);
    const lines = quoted.length > 0 ? quoted : [dialogue];
    return lines.map((text): VoiceLine => ({
      text,
      sceneId: scene.id,
      startSec: scene.startSec,
      endSec: scene.endSec,
      delivery: '',
      priority: 'required',
    }));
  });
  if (sceneLines.length > 0) return sceneLines;

  const quoted = quotedStoryboardVoiceLinesFromText(sourceText);
  return quoted.map((text, index): VoiceLine => {
    const scene = scenes[Math.min(index, Math.max(0, scenes.length - 1))];
    return {
      text,
      sceneId: scene?.id ?? 'scene_01',
      startSec: scene?.startSec ?? null,
      endSec: scene?.endSec ?? null,
      delivery: '',
      priority: 'required',
    };
  });
}

function inferStoryboardToneProgression(text: string): string[] {
  const progression = text.match(/\b(?:tone progression|progression|arc)\s*:\s*([^\n]{1,240})/i)?.[1];
  if (!progression) return [];
  return progression.split(/\s*(?:->|,|;|\|)\s*/).map(item => item.trim()).filter(Boolean);
}

function cleanStoryboardStorySpine(value: string): string {
  const cleaned = sanitizeStoryboardExternalAudioReferences(compactStoryboardLine(stripStoryboardMarkup(value)))
    .replace(/^[:*_\-\s]+|[:*_\-\s]+$/g, '')
    .trim();
  if (!cleaned || /^[*_\-:.\s]+$/.test(cleaned)) return '';
  return cleaned;
}

function inferStoryboardStorySpineFromHeading(text: string): string {
  const lines = stripStoryboardMarkup(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = line.match(/^(?:story\s+spine|narrative\s+spine|throughline|story\s+arc|creative\s+intent)\s*:\s*(.+)$/i)?.[1];
    const cleanedInline = cleanStoryboardStorySpine(inline || '');
    if (cleanedInline) return cleanedInline;

    if (!/^(?:story\s+spine|narrative\s+spine|throughline|story\s+arc|creative\s+intent)\s*:?\s*$/i.test(line)) {
      continue;
    }

    const collected: string[] = [];
    for (let cursor = index + 1; cursor < lines.length && collected.length < 4; cursor += 1) {
      const candidate = lines[cursor];
      if (
        /^\|/.test(candidate)
        || storyboardMarkdownTableSeparatorLine(candidate)
        || /^(?:storyboard|video|production|reference|timecoded|beat\s+\d|scene\s+\d|format|duration|aspect|does this|please confirm)\b/i.test(candidate)
      ) {
        break;
      }
      const cleaned = cleanStoryboardStorySpine(candidate);
      if (cleaned) collected.push(cleaned);
    }

    const combined = cleanStoryboardStorySpine(collected.join(' '));
    if (combined) return combined;
  }

  return '';
}

function inferStoryboardStorySpine(text: string, fallbackBrief: string): string {
  const explicit = cleanStoryboardStorySpine(text.match(
    /\b(?:story\s+spine|narrative\s+spine|throughline|story\s+arc|creative\s+intent)\s*:\s*([^\n]{1,360})/i,
  )?.[1] || '');
  // A compiled storyboard can become the assistant-authored source of a later
  // compile. Do not mistake our own fallback sentence for fresh authorial
  // intent on that second pass: it may contain superseded layout metadata from
  // the earlier prompt. Prefer the current structured-scene fallback instead.
  const generatedFallbackPrefix = 'One continuous progression from the source brief:';
  if (explicit && !explicit.startsWith(generatedFallbackPrefix)) return explicit;

  const fromHeading = inferStoryboardStorySpineFromHeading(text);
  if (fromHeading && !fromHeading.startsWith(generatedFallbackPrefix)) return fromHeading;

  const compactFallback = sanitizeStoryboardExternalAudioReferences(
    truncateStoryboardText(cleanStoryboardNarrativeSourceText(fallbackBrief || text), 260),
  );
  if (compactFallback) {
    return `One continuous progression from the source brief: ${compactFallback}`;
  }

  return 'A coherent sequence where every scene follows from the previous beat and supports the requested final video outcome.';
}

function inferStoryboardStorySpineFromScenes(scenes: SceneSpec[]): string {
  const beats = scenes
    .map(scene => meaningfulStoryboardPromptField(
      scene.purpose
      || scene.visual
      || scene.action
      || scene.title,
    ))
    .filter(Boolean);
  if (beats.length === 0) return '';
  return truncateStoryboardText(uniqueStoryboardStrings(beats).join(' -> '), 260);
}

function inferStoryboardProductFeatureMap(text: string, scenes: SceneSpec[]): string[] {
  const explicitLines = text
    .split(/\r?\n/)
    .map(line => compactStoryboardLine(stripStoryboardMarkup(line)))
    .filter(line => /\b(?:product\/feature|product feature|feature mapping|product meaning|capability)\b\s*:/i.test(line))
    .map(line => line.replace(/^[^:]{1,80}:\s*/, '').trim())
    .filter(Boolean);
  const sceneFeatures = scenes
    .map(scene => scene.productFeature)
    .filter(Boolean);
  return [...new Set([...explicitLines, ...sceneFeatures])];
}

function inferEndCard(projectText: string, references: ReferenceAsset[], requiredText: string[]): StoryboardProject['endCard'] {
  const logo = references.find(ref => ref.kind === 'logo');
  const endBlock = projectText.match(/\b(?:end card|cta|final card|brand resolve|logo reveal)\b[\s\S]{0,420}/i)?.[0] ?? '';
  return {
    requiredText,
    logoUsage: logo
      ? `${logo.id} should be used according to its ${logo.usageScope} usage scope.`
      : 'Use any approved logo or brand reference only where the source brief assigns it.',
    backgroundStyle: extractStoryboardField(endBlock, ['Background', 'Background style', 'Visual', 'Style']),
    composition: extractStoryboardField(endBlock, ['Composition', 'Layout', 'Camera']) || compactStoryboardLine(endBlock.slice(0, 180)),
  };
}

function storyboardSceneLooksLikeEndCard(scene: SceneSpec): boolean {
  return /\b(?:end\s*card|final\s*(?:card|frame|scene)|closing|outro|stinger|cta|call\s*to\s*action|logo\s*(?:lockup|reveal|hold)|brand\s*(?:resolve|lockup))\b/i.test([
    scene.title,
    scene.purpose,
    scene.productFeature,
    scene.visual,
    scene.action,
  ].join(' '));
}

function finalStoryboardSceneVisibleText(scenes: SceneSpec[]): string[] {
  const finalScene = scenes[scenes.length - 1];
  if (finalScene?.textInImage.length) return uniqueStoryboardStrings(finalScene.textInImage);

  for (let index = scenes.length - 1; index >= 0; index -= 1) {
    const scene = scenes[index];
    if (scene.textInImage.length > 0 && storyboardSceneLooksLikeEndCard(scene)) {
      return uniqueStoryboardStrings(scene.textInImage);
    }
  }

  return [];
}

function applyStoryboardEndCardTextToScenes(scenes: SceneSpec[], endCardText: string[]): SceneSpec[] {
  if (scenes.length === 0 || endCardText.length === 0) return scenes;
  const finalSceneIndex = scenes.length - 1;
  const explicitEndCardIndex = (() => {
    for (let index = scenes.length - 1; index >= 0; index -= 1) {
      if (storyboardSceneLooksLikeEndCard(scenes[index])) return index;
    }
    return finalSceneIndex;
  })();

  return scenes.map((scene, index) => index === explicitEndCardIndex
    ? {
        ...scene,
        textInImage: uniqueStoryboardStrings([
          ...scene.textInImage,
          ...endCardText,
        ]),
      }
    : scene);
}

function storyboardRequiredTextKey(value: string): string {
  return compactStoryboardLine(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function storyboardTextEqualsSceneDialogue(value: string, scenes: SceneSpec[]): boolean {
  const key = storyboardRequiredTextKey(value);
  if (!key) return false;
  return scenes.some(scene => storyboardRequiredTextKey(scene.dialogue) === key);
}

function storyboardRequiredTextForProject(
  options: StoryboardPromptCompileOptions,
  userConstraintSource: string,
  scenes: SceneSpec[],
): { mustIncludeText: string[]; endCardText: string[] } {
  const contractEndCardText = normalizeStoryboardContractTextArray(options.planningContract?.endCard?.visibleText);
  const userRequiredText = extractStoryboardRequiredText(options.userIntentText);
  const extractedRequiredText = extractStoryboardRequiredText(userConstraintSource);
  const assistantDraftRequiredText = options.promptAuthorship === 'assistant'
    ? extractedRequiredText.filter(text =>
      userRequiredText.includes(text) || !storyboardTextEqualsSceneDialogue(text, scenes),
    )
    : extractedRequiredText;
  const sceneVisibleText = uniqueStoryboardStrings(scenes.flatMap(scene => scene.textInImage));

  if (options.promptAuthorship === 'assistant' && sceneVisibleText.length > 0) {
    const scopedEndCardText = finalStoryboardSceneVisibleText(scenes);
    const endCardText = scopedEndCardText.length > 0
      ? uniqueStoryboardStrings([...scopedEndCardText, ...contractEndCardText, ...assistantDraftRequiredText])
      : uniqueStoryboardStrings([...contractEndCardText, ...assistantDraftRequiredText]);
    return {
      mustIncludeText: uniqueStoryboardStrings([
        ...sceneVisibleText,
        ...contractEndCardText,
        ...assistantDraftRequiredText,
      ]),
      endCardText,
    };
  }

  const requiredText = uniqueStoryboardStrings([
    ...assistantDraftRequiredText,
    ...contractEndCardText,
  ]);
  return {
    mustIncludeText: requiredText,
    endCardText: requiredText,
  };
}

export function buildStoryboardProject(options: StoryboardPromptCompileOptions): StoryboardProject {
  const prompt = options.prompt.trim();
  const rawUserIntentText = options.userIntentText.trim();
  const userIntentText = canonicalStoryboardScriptContext(rawUserIntentText) || rawUserIntentText;
  const narrativeUserIntentText = cleanStoryboardNarrativeSourceText(userIntentText);
  const approvedScriptContext = cleanStoryboardNarrativeSourceText(canonicalStoryboardScriptContext(options.approvedScriptContext));
  const referencePromptContext = cleanStoryboardNarrativeSourceText(canonicalStoryboardScriptContext(prompt) || prompt);
  const primarySourceBrief = selectStoryboardSourceBriefForCompile(options, userIntentText);
  const sourceText = stripGenericStoryboardVisibleTextMetadata(sanitizeStoryboardExternalAudioReferences([
    cleanStoryboardNarrativeSourceText(primarySourceBrief),
    approvedScriptContext
      ? `APPROVED STORYBOARD SCRIPT CONTEXT TO PRESERVE:\n${approvedScriptContext}`
      : '',
  ].filter(Boolean).join('\n\n')));
  const allText = `${narrativeUserIntentText}\n${sourceText}`;
  const layoutTextParts = [userIntentText].filter(Boolean);
  if (
    primarySourceBrief
    && !storyboardBriefContains(userIntentText, primarySourceBrief)
    && !storyboardBriefContains(primarySourceBrief, userIntentText)
  ) {
    layoutTextParts.push(primarySourceBrief);
  }
  // Geometry authority text = the parts that genuinely carry user/host intent
  // (the user turn, plus a user-authored source brief). It deliberately
  // excludes `approvedScriptContext` always, and excludes the source brief when
  // the prompt is assistant-authored, so a stale `**Aspect Ratio:** 16:9` line
  // in a drafted/approved script body cannot override a typed planning
  // contract's video geometry. See `inferStoryboardLayoutSpec`.
  const geometryAuthorityParts = [userIntentText].filter(Boolean);
  if (
    options.promptAuthorship !== 'assistant'
    && primarySourceBrief
    && !storyboardBriefContains(userIntentText, primarySourceBrief)
    && !storyboardBriefContains(primarySourceBrief, userIntentText)
  ) {
    geometryAuthorityParts.push(primarySourceBrief);
  }
  const geometryAuthorityText = geometryAuthorityParts.join('\n\n') || userIntentText;
  if (
    approvedScriptContext
    && !storyboardBriefContains(layoutTextParts.join('\n'), approvedScriptContext)
  ) {
    layoutTextParts.push(approvedScriptContext);
  }
  const layoutText = layoutTextParts.join('\n\n') || sourceText;
  const layout = inferStoryboardLayoutSpec(
    layoutText,
    options.frameCount,
    options.planningContract,
    geometryAuthorityText,
  );
  const requestedDurationSec = inferRequestedTotalVideoDurationSeconds(userIntentText);
  const durationSec = requestedDurationSec ?? inferRequestedTotalVideoDurationSeconds(sourceText);
  const references = buildStoryboardReferenceAssets(
    userIntentText,
    [
      referencePromptContext,
      approvedScriptContext,
    ].filter(Boolean).join('\n\n'),
  );
  const approvedSections = approvedScriptContext
    ? splitStoryboardSections(approvedScriptContext)
    : [];
  const sourceSections = splitStoryboardSections(sourceText);
  const approvedSectionsHaveExplicitTiming = storyboardSectionsHavePreservableExplicitTiming(approvedSections);
  const sourceSectionsHaveExplicitTiming = storyboardSectionsHavePreservableExplicitTiming(sourceSections);
  const exactRequestedFrameCount = inferExplicitStoryboardFrameCountFromText(userIntentText);
  const assistantMustHonorExactFrameCount =
    options.promptAuthorship === 'assistant'
    && exactRequestedFrameCount === options.frameCount;
  const assistantApprovedDraftUndercounted =
    options.promptAuthorship === 'assistant'
    && approvedSections.length > 0
    && approvedSections.length < options.frameCount
    && !approvedSectionsHaveExplicitTiming;
  const assistantDraftUndercounted =
    options.promptAuthorship === 'assistant'
    && !approvedScriptContext
    && sourceSections.length > 0
    && sourceSections.length < options.frameCount
    && !sourceSectionsHaveExplicitTiming;
  const sections = approvedSections.length > 0 && !assistantApprovedDraftUndercounted
    ? approvedSections
    : assistantDraftUndercounted || assistantApprovedDraftUndercounted
      ? []
      : sourceSections;
  const selectedSectionsHaveExplicitTiming =
    sections.length > 0 && storyboardSectionsHavePreservableExplicitTiming(sections);
  const preserveAssistantExplicitTiming =
    options.promptAuthorship === 'assistant' && selectedSectionsHaveExplicitTiming;
  // Plain narration is a valid source for scene synthesis, but an assistant
  // draft with explicit scene/beat structure is not plain narration. If that
  // structured draft undercounts the requested board, keep the project
  // incomplete so validation can request a repaired draft instead of slicing
  // the existing rows and surrounding production metadata into invented beats.
  const maySynthesizeNarration =
    sections.length === 0
    && !assistantApprovedDraftUndercounted
    && !assistantDraftUndercounted;
  const synthesizedSections = maySynthesizeNarration
    ? [
        { text: approvedScriptContext, allowUnlabeledProse: true },
        { text: narrativeUserIntentText, allowUnlabeledProse: false },
        { text: sourceText, allowUnlabeledProse: false },
      ]
        .filter((candidate, index, candidates) =>
          candidate.text && candidates.findIndex(other => other.text === candidate.text) === index)
        .map(candidate => synthesizeStoryboardSectionsFromPlainNarration(
          candidate.text,
          options.frameCount,
          references,
          candidate.allowUnlabeledProse,
        ))
        .find(candidate => candidate.length > 0) ?? []
    : [];
  const storyboardSections = sections.length > 0 ? sections : synthesizedSections;
  const parsedScenes = storyboardSections.length > 0
    ? storyboardSections.map((section) => {
      return buildSceneFromSection(
        section,
        references,
        null,
        storyboardScenePlanningContractForIndex(options.planningContract, section.number),
      );
    })
    : [];
  const scenes = parsedScenes.map(scene => ({
    ...scene,
    referenceUsage: normalizeStoryboardSceneReferenceUsage(scene.referenceUsage, references),
  }));
  const timingNormalizedScenes = normalizeAssistantStoryboardSceneTiming(
    scenes,
    durationSec,
    options.promptAuthorship,
  );
  const dialogueAlignment = alignAssistantStoryboardDialogueWithUserSource(
    timingNormalizedScenes,
    userIntentText,
    options.promptAuthorship,
  );
  const canPreserveAssistantExplicitTiming =
    preserveAssistantExplicitTiming && !dialogueAlignment.shouldRetime;
  const dialogueTimedScenes = (!canPreserveAssistantExplicitTiming
    && (options.promptAuthorship === 'assistant' || dialogueAlignment.shouldRetime))
    ? retimeStoryboardScenesForDialogue(dialogueAlignment.scenes, durationSec)
    : dialogueAlignment.scenes;
  const userConstraintSource = buildStoryboardUserConstraintSource(
    narrativeUserIntentText,
    cleanStoryboardNarrativeSourceText(primarySourceBrief),
    options,
  );
  const { mustIncludeText, endCardText } = storyboardRequiredTextForProject(
    options,
    userConstraintSource,
    dialogueTimedScenes,
  );
  const scenesWithEndCardText = applyStoryboardEndCardTextToScenes(dialogueTimedScenes, endCardText);
  const normalizedScenes = canPreserveAssistantExplicitTiming
    ? scenesWithEndCardText
    : retimeStoryboardScenesForDialogue(scenesWithEndCardText, durationSec);
  const voiceLines = assignVoiceLinesToScenes(normalizedScenes, sourceText);
  // When an assistant draft undercounts the requested board, derive the
  // narrative spine from the authored scene records that were actually
  // present even though the compiled project remains intentionally incomplete.
  const authoredStorySpineSections = approvedSections.length > 0
    ? approvedSections
    : sourceSections;
  const authoredStorySpineScenes = authoredStorySpineSections.map(section => buildSceneFromSection(
    section,
    references,
    null,
    storyboardScenePlanningContractForIndex(options.planningContract, section.number),
  ));
  const structuredSceneStorySpine = inferStoryboardStorySpineFromScenes(
    authoredStorySpineScenes.length > 0 ? authoredStorySpineScenes : normalizedScenes,
  );
  const assistantStorySpineSource = approvedScriptContext || sourceText;
  const storySpineFallback = (options.promptAuthorship === 'assistant'
    ? structuredSceneStorySpine
      || cleanStoryboardNarrativeSourceText(primarySourceBrief)
      || approvedScriptContext
    : approvedScriptContext || cleanStoryboardNarrativeSourceText(primarySourceBrief))
    || prompt
    || narrativeUserIntentText;
  const storySpine = inferStoryboardStorySpine(
    options.promptAuthorship === 'assistant' && assistantStorySpineSource
      ? assistantStorySpineSource
      : allText,
    storySpineFallback,
  );
  const productFeatureMap = inferStoryboardProductFeatureMap(allText, normalizedScenes);

  // Track how many beat/scene sections the AUTHOR wrote in the
  // source script — this is the "intended beat count" downstream
  // lossy / undercount checks need so they can distinguish a
  // legitimately complete script from an undercounted one.
  //
  // We can't simply trust `sections.length` because the scene
  // splitter rejects rows whose timing column isn't a strict numeric
  // range (e.g. `0:30-End`). Those rows still represent a beat the
  // author wrote, and downstream end-card extraction routes them
  // into the typed endCard structure. To count the author's actual
  // beats we scan the script for explicit beat markers — either
  // markdown table rows whose first labeled column is a beat number
  // (`| **N** |`) or scene-section headings (`Scene|Beat|Shot|Panel|
  // Frame N`) — and take the largest count we see. We fall back to
  // the chosen `sections` array when no beat markers are present.
  const beatMarkerScripts = [approvedScriptContext, sourceText];
  let directBeatMarkerCount = 0;
  for (const text of beatMarkerScripts) {
    if (!text) continue;
    const numbersSeen = new Set<number>();
    for (const match of text.matchAll(
      /^\s*\|\s*(?:[*_]{1,3})?\s*(\d{1,2})\s*(?:[*_]{1,3})?\s*\|/gim,
    )) {
      const value = Number(match[1]);
      if (Number.isInteger(value) && value >= 1 && value <= 64) numbersSeen.add(value);
    }
    for (const match of text.matchAll(
      /^\s*(?:[-*+>#_]{1,6}\s*)*(?:[*_]{1,3})?\s*(?:Scene|Shot|Beat|Panel|Frame)\s*_?\s*(\d{1,2})\b/gim,
    )) {
      const value = Number(match[1]);
      if (Number.isInteger(value) && value >= 1 && value <= 64) numbersSeen.add(value);
    }
    if (numbersSeen.size > directBeatMarkerCount) {
      directBeatMarkerCount = numbersSeen.size;
    }
  }
  const recognizedSectionCount = directBeatMarkerCount > 0
    ? directBeatMarkerCount
    : storyboardSections.length > 0
      ? storyboardSections.length
      : Math.max(approvedSections.length, sourceSections.length);

  return {
    title: inferStoryboardTitle(allText),
    sourceProvenance: approvedScriptContext
      ? 'approved_assistant'
      : options.promptAuthorship === 'assistant'
        ? 'assistant_draft'
        : 'user',
    ...(recognizedSectionCount > 0 ? { parsedSectionCount: recognizedSectionCount } : {}),
    durationSec,
    outputAspectRatio: layout.boardAspectRatio,
    frameAspectRatio: layout.cellAspectRatio,
    targetVideoAspectRatio: layout.targetVideoAspectRatio,
    ...(layout.boardDimensions ? { boardDimensions: layout.boardDimensions } : {}),
    boardLayout: layout.layoutKind,
    layoutSource: storyboardPlanningSourceFromContract(options.planningContract),
    ...(options.planningContract ? { planningContract: options.planningContract } : {}),
    metadataLabels: metadataLabelsFromPlanningContract(options.planningContract),
    intendedUse: /commercial|ad|promo|launch/i.test(allText) ? 'commercial storyboard' : 'video storyboard',
    references,
    creativeBrief: {
      concept: compactStoryboardLine(primarySourceBrief || prompt || userIntentText),
      storySpine,
      toneProgression: inferStoryboardToneProgression(allText),
      productFeatureMap,
      mustInclude: mustIncludeText,
      mustAvoid: extractStoryboardAvoidConstraints(userConstraintSource),
      brandRules: mustIncludeText.length > 0 ? mustIncludeText.map(text => `Preserve exact visible text: "${text}"`) : [],
      visualQualityBar: /production[-\s]?ready|premium|commercial|cinematic|high[-\s]?end/i.test(allText)
        ? 'production-ready commercial storyboard sheet'
        : 'clean readable storyboard sheet',
    },
    voiceover: {
      fullScript: voiceLines.map(line => line.text).join('\n'),
      lines: voiceLines,
    },
    scenes: normalizedScenes,
    endCard: inferEndCard(allText, references, endCardText),
  };
}

export function validateStoryboardProjectTiming(
  project: StoryboardProject,
  rules: StoryboardTimingRules = DEFAULT_STORYBOARD_TIMING_RULES,
): StoryboardTimingValidationResult {
  const issues: StoryboardTimingIssue[] = [];
  const timedScenes = project.scenes
    .filter(scene => scene.startSec !== null && scene.endSec !== null && scene.durationSec !== null)
    .slice()
    .sort((a, b) => (a.startSec ?? 0) - (b.startSec ?? 0));

  if (project.durationSec === null) {
    issues.push({
      severity: 'warning',
      code: 'missing_target_duration',
      message: 'No target video duration was detected; timing checks are limited to scene-local ranges.',
      repair: 'Add an explicit total duration such as 15 seconds when this storyboard is meant to drive a video.',
    });
  }

  if (timedScenes.length < project.scenes.length) {
    issues.push({
      severity: 'warning',
      code: 'missing_scene_timing',
      message: `${project.scenes.length - timedScenes.length} scene(s) do not have explicit start/end/duration timing.`,
      repair: 'Add start and end seconds for every storyboard scene before video generation.',
    });
  }

  for (const scene of timedScenes) {
    const start = scene.startSec ?? 0;
    const end = scene.endSec ?? 0;
    const duration = scene.durationSec ?? 0;
    if (end <= start || duration <= 0) {
      issues.push({
        severity: 'error',
        code: 'invalid_scene_range',
        sceneId: scene.id,
        message: `${scene.id} has an invalid timing range.`,
        repair: 'Set startSec < endSec and durationSec to the range length.',
      });
      continue;
    }

    const dialogueWords = countWords(scene.dialogue);
    if (dialogueWords > 0) {
      const wordsPerSecond = dialogueWords / duration;
      if (wordsPerSecond > rules.fastWordsPerSecondMax) {
        issues.push({
          severity: 'warning',
          code: 'dialogue_too_dense',
          sceneId: scene.id,
          message: `${scene.id} has about ${dialogueWords} spoken words in ${duration}s (${wordsPerSecond.toFixed(1)} words/sec).`,
          repair: 'Increase this scene duration, reallocate time from non-dialogue beats, or split the dialogue across adjacent scenes before changing any supplied words.',
        });
      } else if (wordsPerSecond > rules.normalWordsPerSecondMax) {
        issues.push({
          severity: 'warning',
          code: 'dialogue_fast',
          sceneId: scene.id,
          message: `${scene.id} dialogue is fast at ${wordsPerSecond.toFixed(1)} words/sec.`,
          repair: 'Prefer more time or a split across adjacent scenes for cleaner delivery; only shorten dialogue that was not supplied by the user.',
        });
      }
    }

    const isPunchline = dialogueWords > 0
      && dialogueWords <= 3
      && /\b(?:punchline|reveal|joke|twist|tag)\b/i.test(`${scene.title}\n${scene.dialogue}`);
    if (isPunchline && duration < rules.minPunchlineSec) {
      issues.push({
        severity: 'warning',
        code: 'punchline_hold_too_short',
        sceneId: scene.id,
        message: `${scene.id} punchline/reveal hold is only ${duration}s.`,
        repair: `Hold punchline/reveal scenes for at least ${rules.minPunchlineSec}s.`,
      });
    }

    const isEndCard = /\b(?:end card|cta|final|logo|brand resolve)\b/i.test(`${scene.title}\n${scene.visual}`);
    if (isEndCard && duration < rules.minEndCardHoldSec) {
      issues.push({
        severity: 'warning',
        code: 'end_card_hold_too_short',
        sceneId: scene.id,
        message: `${scene.id} end-card hold is only ${duration}s.`,
        repair: `Hold required final visible text for at least ${rules.minEndCardHoldSec}s when the user requested brand text or logo readability.`,
      });
    }
  }

  for (let index = 1; index < timedScenes.length; index += 1) {
    const previous = timedScenes[index - 1];
    const current = timedScenes[index];
    const previousEnd = previous.endSec ?? 0;
    const currentStart = current.startSec ?? 0;
    const delta = Math.round((currentStart - previousEnd) * 100) / 100;
    if (delta < -rules.toleranceSec) {
      issues.push({
        severity: 'error',
        code: 'overlapping_scene_ranges',
        sceneId: current.id,
        message: `${current.id} overlaps the previous scene by ${Math.abs(delta).toFixed(2)}s.`,
        repair: 'Adjust scene start/end ranges so they do not overlap.',
      });
    } else if (delta > rules.toleranceSec) {
      issues.push({
        severity: 'warning',
        code: 'scene_timing_gap',
        sceneId: current.id,
        message: `${current.id} starts ${delta.toFixed(2)}s after the previous scene ends.`,
        repair: 'Remove unintentional gaps or mark them as intentional holds.',
      });
    }
  }

  const totalSceneDurationSec = timedScenes.length > 0
    ? Math.round(timedScenes.reduce((sum, scene) => sum + (scene.durationSec ?? 0), 0) * 100) / 100
    : null;
  if (project.durationSec !== null && totalSceneDurationSec !== null) {
    const diff = Math.abs(totalSceneDurationSec - project.durationSec);
    if (diff > rules.toleranceSec) {
      issues.push({
        severity: 'error',
        code: 'scene_total_duration_mismatch',
        message: `Timed scenes add up to ${totalSceneDurationSec}s but the target duration is ${project.durationSec}s.`,
        repair: 'Repair scene durations so their total matches the requested video duration.',
      });
    }
  }

  return {
    ok: issues.every(issue => issue.severity !== 'error'),
    issues,
    totalSceneDurationSec,
    timedSceneCount: timedScenes.length,
  };
}

function compileStoryboardCriticalRequirements(): string[] {
  return [
    'Render a production storyboard sheet, not a mood board: every numbered scene slot is a distinct ordered beat.',
    'Preserve user-provided jokes, slogans, dialogue, brand copy, timings, scene order, and reference assignments.',
    'Preserve the story spine across the full board so each scene visibly causes, motivates, reveals, or sets up the next scene.',
    'Use concrete transition logic between adjacent beats: object motion, light/color handoff, match cut, camera move, wipe, reaction, or another visible edit idea.',
    'Keep every scene number, timing label, title, note, and production field outside the cinematic video-frame artwork.',
    'Use compact readable storyboard labels in the non-frame note areas; keep long production prose out of the cells.',
    'Write [no dialogue] in the Dialogue/VO field for scenes without spoken dialogue or voiceover.',
    'Keep character, product, logo, and style references consistent with their assigned scenes.',
  ];
}

function compileStoryboardAvoidConstraints(constraints: string[]): string[] {
  const avoidLines = [
    'Avoid malformed text, misspelled brand words, inconsistent reference identities, missing scene cells, wrong timings, and mismatched board/cell aspect ratios.',
    'Avoid scene numbers, timing badges, timecodes, production tables, Dialogue/VO labels, Audio/SFX labels, or other production notes overlaid inside the video frame artwork.',
    'Avoid in-frame comic-book SFX/action text such as Whoosh!, Impact!, Boom!, Thud!, Slash!, Crack!, or Pop!; keep those words in the production notes only.',
  ];

  for (const constraint of constraints) {
    const normalized = constraint.replace(/[.]+$/g, '').trim();
    avoidLines.push(/^(?:avoid|without|less|do\s+not|don't)\b/i.test(normalized)
      ? `${normalized}.`
      : `Avoid ${normalized}.`);
  }

  return avoidLines;
}

function compileStoryboardAvoidSection(userIntentText: string): string[] {
  return compileStoryboardAvoidConstraints(extractStoryboardAvoidConstraints(userIntentText));
}

function formatStoryboardSeconds(value: number | null): string {
  return value === null ? 'unspecified' : `${Number(value.toFixed(2))}s`;
}

function compileStoryboardStoryContinuitySection(project: StoryboardProject): string[] {
  return [
    'STORY / CONTINUITY:',
    `Story spine: ${project.creativeBrief.storySpine}`,
    'Every panel must feel like the next beat in one continuous sequence, not an unrelated feature card, contact sheet, or mood board.',
    'Use visible cause-and-effect between beats through action, object motion, eyeline, lighting/color handoff, match cut, wipe, camera movement, or another concrete transition idea.',
    'Keep product/feature/brand meaning in the associated notes. Do not force long product explanations or the whole script into tiny in-frame text.',
  ];
}

function promptReferenceUsageForScene(
  referenceUsage: string[],
  references: ReferenceAsset[],
  modelId: string,
): string {
  if (referenceUsage.length === 0) return '';
  const referenceById = new Map(references.map((ref, index) => [ref.id, { ref, index }]));
  return uniqueStoryboardStrings(referenceUsage.flatMap(value => {
    const found = referenceById.get(value);
    if (found) return [formatModelRef(modelId, found.ref.index ?? found.index + 1, 'image')];
    if (looksLikeUnknownIndexedStoryboardReference(value)) return [];
    return [value];
  })).join(', ');
}

function storyboardMetadataLabelAliases(labels: string[]): string[] {
  return uniqueStoryboardStrings(labels.flatMap(label => [
    label,
    removeStoryboardTimingText(label),
  ]));
}

function removeStoryboardMetadataLabelsFromPromptText(value: string, metadataLabels: string[]): string {
  if (metadataLabels.length === 0) return compactStoryboardLine(value);
  let cleaned = value
    .replace(/\b(?:visible\s+text|metadata\s+labels?)\s*:\s*/gi, '')
    .replace(/\btext\s+overlay\s*:\s*/gi, '');
  const aliases = storyboardMetadataLabelAliases(metadataLabels)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const label of aliases) {
    const escaped = escapeStoryboardRegExp(label);
    const leadingBoundary = /^[\p{L}\p{N}_]/u.test(label) ? '(?<![\\p{L}\\p{N}_])' : '';
    const trailingBoundary = /[\p{L}\p{N}_]$/u.test(label) ? '(?![\\p{L}\\p{N}_])' : '';
    cleaned = cleaned.replace(new RegExp(`${leadingBoundary}${escaped}${trailingBoundary}`, 'giu'), '');
  }
  return compactStoryboardLine(cleaned)
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/^[:;,\s]+|[:;,\s]+$/g, '')
    .trim();
}

function meaningfulStoryboardPromptField(value: string): string {
  const cleaned = compactStoryboardLine(value)
    .replace(/^[:;,\s]+|[:;,\s]+$/g, '')
    .trim();
  if (!cleaned) return '';
  if (/^(?:none|n\/a|not\s+specified|null|undefined)$/i.test(cleaned)) return '';
  if (/^(?:purpose|scene\s+purpose|story\s+purpose|product\/?feature|product\s+feature|feature\s+mapping|feature|capability)$/i.test(cleaned)) {
    return '';
  }
  return cleaned;
}

function compileStoryboardScenesSection(project: StoryboardProject): string[] {
  if (project.scenes.length === 0) return [];

  const lines = ['SCENES:'];
  for (const scene of project.scenes) {
    const purpose = meaningfulStoryboardPromptField(scene.purpose);
    const productFeature = meaningfulStoryboardPromptField(scene.productFeature);
    const visual = meaningfulStoryboardPromptField(scene.visual);
    const action = meaningfulStoryboardPromptField(scene.action);
    const camera = meaningfulStoryboardPromptField(scene.camera);
    const lighting = meaningfulStoryboardPromptField(scene.lighting);
    const timing = scene.startSec !== null && scene.endSec !== null
      ? `${formatStoryboardSeconds(scene.startSec)}-${formatStoryboardSeconds(scene.endSec)}`
      : project.durationSec !== null
        ? `timing flexible within ${project.durationSec} seconds total`
        : 'timing flexible';
    lines.push(`${scene.id.toUpperCase()} - ${scene.title} - ${timing}`);
    if (purpose) lines.push(`Scene purpose: ${purpose}`);
    if (productFeature) lines.push(`Product/feature: ${productFeature}`);
    if (visual || action) lines.push(`Visual/Action: ${[visual, action].filter(Boolean).join(' ')}`);
    if (camera) lines.push(`Camera/Motion: ${camera}`);
    if (lighting) lines.push(`Lighting/Style: ${lighting}`);
    if (scene.transitionIn || scene.transitionOut) {
      lines.push(`Transition: ${[scene.transitionIn, scene.transitionOut].filter(Boolean).join(' / ')}`);
    }
    lines.push(`Dialogue/VO: ${scene.dialogue || '[no dialogue]'}`);
    if (scene.audioSfx.length > 0) lines.push(`Audio/SFX: ${scene.audioSfx.join(', ')}`);
    if (scene.music) lines.push(`Music: ${scene.music}`);
    const referenceUsage = promptReferenceUsageForScene(scene.referenceUsage, project.references, 'gpt-image-2');
    if (referenceUsage) lines.push(`Reference usage: ${referenceUsage}`);
    if ((scene.metadataLabels ?? []).length > 0) {
      lines.push(`Metadata labels (outside frame only): ${(scene.metadataLabels ?? []).join('; ')}`);
    }
    if (scene.textInImage.length > 0) lines.push(`Visible text: ${scene.textInImage.map(text => `"${text}"`).join(', ')}`);
    if (scene.mustAvoid.length > 0) lines.push(`Avoid: ${scene.mustAvoid.join('; ')}`);
    lines.push('');
  }
  return lines;
}

function storyboardRequiredVisibleText(project: StoryboardProject): string[] {
  const sceneVisibleText = uniqueStoryboardStrings(project.scenes.flatMap(scene => [
    ...scene.textInImage,
    ...extractStoryboardRequiredText([
      scene.visual,
      scene.action,
      scene.productFeature,
    ].filter(Boolean).join('\n')),
  ]));
  const globalVisibleText = project.creativeBrief.mustInclude.filter(text => !sceneVisibleText.includes(text));
  const finalVisibleText = finalStoryboardSceneVisibleText(project.scenes);
  const endCardText = finalVisibleText.length > 0
    ? project.endCard.requiredText.filter(text => finalVisibleText.includes(text) || !sceneVisibleText.includes(text))
    : project.endCard.requiredText;
  const requiredSceneVisibleText = project.sourceProvenance === 'assistant_draft' ? [] : sceneVisibleText;
  return uniqueStoryboardStrings([
    ...requiredSceneVisibleText,
    ...globalVisibleText,
    ...endCardText,
  ]);
}

function formatStoryboardRequiredVisibleTextLine(text: string): string {
  return `Required exact visible text: "${text.replace(/"/g, '\\"')}"`;
}

function storyboardLayoutSpecFromProject(
  project: StoryboardProject,
  frameCount: number,
): StoryboardLayoutSpec {
  const layout = describeStoryboardLayout(
    project.outputAspectRatio,
    project.frameAspectRatio,
    frameCount,
  );
  return {
    boardAspectRatio: project.outputAspectRatio,
    cellAspectRatio: project.frameAspectRatio,
    targetVideoAspectRatio: project.targetVideoAspectRatio,
    ...layout,
    ...(project.boardDimensions ? { boardDimensions: project.boardDimensions } : {}),
  };
}

function compileStoryboardFrameGeometrySection(layout: StoryboardLayoutSpec): string[] {
  const cellOrientation = parseAspectRatioOrientation(layout.cellAspectRatio);
  if (cellOrientation === 'portrait') {
    return [
      'PORTRAIT FRAME GEOMETRY:',
      `Every cinematic artwork area inside a panel must remain a ${layout.cellAspectRatio} portrait video-frame rectangle matching the final video frame.`,
      `Inside every numbered scene slot, draw one identical upright ${layout.cellAspectRatio} video-frame rectangle whose height is visibly greater than its width.`,
      `Square cells violate the requested ${layout.targetVideoAspectRatio} final video format.`,
      'Unused grid slots must remain blank margin/notes space only; do not fill them with extra scenes, duplicate frames, or decorative artwork.',
    ];
  }
  return [];
}

export function compileVideoStoryboardImagePrompt(
  options: StoryboardPromptCompileOptions,
): string {
  const rawUserIntentText = options.userIntentText.trim();
  const userIntentText = canonicalStoryboardScriptContext(rawUserIntentText) || rawUserIntentText;
  const project = buildStoryboardProject(options);
  const compiledFrameCount = Math.max(1, options.frameCount || project.scenes.length);
  const layout = storyboardLayoutSpecFromProject(project, compiledFrameCount);
  const selectedBrief = selectStoryboardSourceBriefForCompile(options, userIntentText);
  const avoidSource = buildStoryboardUserConstraintSource(
    cleanStoryboardNarrativeSourceText(userIntentText),
    cleanStoryboardNarrativeSourceText(selectedBrief),
    options,
  );
  const boardSizeLine = layout.boardDimensions
    ? `Overall storyboard canvas: ${layout.boardDimensions} pixels (${layout.boardAspectRatio}).`
    : `Overall storyboard canvas aspect ratio: ${layout.boardAspectRatio}.`;

  return [
    'CREATE:',
    `Create exactly ${compiledFrameCount} sequential video storyboard frames as one production storyboard sheet.`,
    '',
    'PROJECT:',
    `Title: ${project.title}.`,
    `Format: ${layout.targetVideoAspectRatio} video storyboard.`,
    project.durationSec !== null ? `Target duration: ${project.durationSec} seconds.` : 'Target duration: unspecified in source brief.',
    '',
    'LAYOUT CONTRACT:',
    `Create exactly ${compiledFrameCount} numbered storyboard panels; do not render fewer or more panels.`,
    `Arrange panels in reading order, left-to-right then top-to-bottom: ${Array.from({ length: compiledFrameCount }, (_, index) => {
      const scene = project.scenes[index];
      return `[${index + 1}] ${scene?.id.toUpperCase() ?? `SCENE_${String(index + 1).padStart(2, '0')}`}`;
    }).join(', ')}.`,
    boardSizeLine,
    `Individual scene-cell/frame aspect ratio: ${layout.cellAspectRatio}.`,
    `Target final video aspect ratio: ${layout.targetVideoAspectRatio}.`,
    `Layout preset: ${layout.layoutKind} - ${layout.layoutDescription}.`,
    `Each panel must contain one distinct ${layout.cellAspectRatio} cinematic video-frame rectangle with compact notes outside the frame.`,
    'Keep scene numbers, timecodes, titles, dialogue/VO, audio notes, and production notes outside the video-frame rectangles.',
    'Do not merge panels, create inset thumbnails, make panels square, or overlay storyboard metadata inside the artwork frames.',
    ...compileStoryboardFrameGeometrySection(layout),
    '',
    ...compileStoryboardReferenceSection(project),
    '',
    'STYLE:',
    `${project.creativeBrief.visualQualityBar} with cinematic shot language, coherent art direction, readable labels, and consistent reference usage.`,
    'Reference-driven personality: before drawing, infer concrete visual and behavioral cues from uploaded/reference images, including character attitude, materials, props, palette, brand tone, typography style, and implied world. Let those cues make this storyboard specific to the supplied subject instead of a generic reusable template.',
    'Vary composition within the required grid: keep the exact scene count, layout, and cell geometry, and make each panel intentionally staged with distinct shot scale, pose/action, camera angle, lighting beat, transition idea, and character-specific detail.',
    '',
    ...compileStoryboardStoryContinuitySection(project),
    '',
    'CRITICAL REQUIREMENTS:',
    ...compileStoryboardCriticalRequirements().map((item, index) => `${index + 1}. ${item}`),
    ...project.references
      .filter(ref => ref.preservePriority === 'critical')
      .map((ref, index) => `${compileStoryboardCriticalRequirements().length + index + 1}. Critical reference lock: ${ref.id} (${ref.kind}) must remain bound to its assigned usage scope: ${ref.usageScope}.`),
    '',
    ...compileStoryboardScenesSection(project),
    'TEXT RULES:',
    'Place scene number, timing, scene title, beat title, and compact production labels outside each video frame in a clearly associated header, footer strip, side rail, or table. Do not overlay scene numbers, timecodes, production notes, Dialogue/VO labels, Audio/SFX text, or SFX/action callout words such as Whoosh!, Impact!, Boom!, Thud!, Slash!, Crack!, or Pop! on top of the video-frame artwork. Also do not overlay scene/beat titles on top of the video-frame artwork. Project titles are metadata, not in-frame text. Only listed diegetic or brand text belongs inside a frame. Quote and spell any required visible text exactly.',
    'Visible text listed on a scene belongs only in that scene; repeat visible text only on scenes that list it.',
    ...storyboardRequiredVisibleText(project).map(formatStoryboardRequiredVisibleTextLine),
    project.endCard.logoUsage ? `Logo usage: ${project.endCard.logoUsage}` : '',
    '',
    'NEGATIVE / AVOID:',
    ...compileStoryboardAvoidSection(avoidSource).map(item => `- ${item}`),
  ].join('\n');
}

export function ensureCompiledVideoStoryboardPromptPreservesSourceBrief(
  compiledPrompt: string,
  userIntentText: string,
  approvedScriptContext?: string | null,
): string {
  // Source briefs are supplied to compile/audit callers, not appended to the
  // final prompt handed to image models.
  const prompt = compiledPrompt.trim();
  void userIntentText;
  void approvedScriptContext;
  return prompt;
}

export function lintStoryboardImagePrompt(
  prompt: string,
  layout: StoryboardLayoutSpec,
  project?: StoryboardProject,
): StoryboardPromptLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const hasConsolidatedLayoutContract = /LAYOUT CONTRACT:/i.test(prompt);

  if (!/CREATE:/i.test(prompt)) errors.push('missing CREATE section');
  if (!hasConsolidatedLayoutContract && !/COUNT \/ GRID CONTRACT:/i.test(prompt)) errors.push('missing COUNT / GRID CONTRACT section');
  if (!/REFERENCE IMAGES:/i.test(prompt)) errors.push('missing REFERENCE IMAGES section');
  if (!hasConsolidatedLayoutContract && !/CANVAS \/ LAYOUT:/i.test(prompt)) errors.push('missing CANVAS / LAYOUT section');
  if (!hasConsolidatedLayoutContract && !/FRAME GEOMETRY:/i.test(prompt)) errors.push('missing FRAME GEOMETRY section');
  const cellOrientation = parseAspectRatioOrientation(layout.cellAspectRatio);
  if (!hasConsolidatedLayoutContract && cellOrientation === 'portrait' && !/PORTRAIT FRAME GEOMETRY:/i.test(prompt)) {
    errors.push('missing PORTRAIT FRAME GEOMETRY section');
  }
  if (!hasConsolidatedLayoutContract && cellOrientation === 'landscape' && !/LANDSCAPE FRAME GEOMETRY:/i.test(prompt)) {
    errors.push('missing LANDSCAPE FRAME GEOMETRY section');
  }
  if (!hasConsolidatedLayoutContract && cellOrientation === 'square' && !/SQUARE FRAME GEOMETRY:/i.test(prompt)) {
    errors.push('missing SQUARE FRAME GEOMETRY section');
  }
  if (!/(?:TEXT RENDERING|TEXT RULES):/i.test(prompt)) errors.push('missing TEXT RENDERING section');
  if (!prompt.includes(`Overall storyboard canvas aspect ratio: ${layout.boardAspectRatio}`)
    && !prompt.includes(`(${layout.boardAspectRatio})`)) {
    errors.push(`missing board aspect ratio ${layout.boardAspectRatio}`);
  }
  if (!prompt.includes(`Individual scene-cell/frame aspect ratio: ${layout.cellAspectRatio}`)) {
    errors.push(`missing cell aspect ratio ${layout.cellAspectRatio}`);
  }
  if (!prompt.includes(`Target final video aspect ratio: ${layout.targetVideoAspectRatio}`)) {
    errors.push(`missing target video aspect ratio ${layout.targetVideoAspectRatio}`);
  }
  if (!/\bDialogue\/VO\b/i.test(prompt)) warnings.push('missing explicit Dialogue/VO field');
  if (!/\bAudio\/SFX\b/i.test(prompt)) warnings.push('missing explicit Audio/SFX field');
  if (/\bparagraphs?\s+inside\s+each\s+(?:cell|frame|panel)\b/i.test(prompt)) {
    warnings.push('prompt may encourage dense paragraphs inside storyboard cells');
  }
  if (project) {
    const sceneCount = project.scenes.length;
    if (sceneCount > 0 && !new RegExp(String.raw`Create exactly\s+${sceneCount}\s+sequential video storyboard frames`, 'i').test(prompt)) {
      errors.push(`missing exact scene count ${sceneCount}`);
    }

    for (const ref of project.references.filter(item => item.preservePriority === 'critical')) {
      const refPattern = ref.index
        ? new RegExp(String.raw`\bImage\s+${ref.index}\b`, 'i')
        : new RegExp(String.raw`\b${ref.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\b`, 'i');
      if (!refPattern.test(prompt)) {
        errors.push(`missing critical reference ${ref.id}`);
      }
    }

    for (const requiredText of [
      ...project.creativeBrief.mustInclude,
      ...project.endCard.requiredText,
    ]) {
      if (requiredText && !prompt.includes(requiredText)) {
        errors.push(`missing required text "${requiredText}"`);
      }
    }

    const timing = validateStoryboardProjectTiming(project);
    for (const issue of timing.issues) {
      const target = issue.severity === 'error' ? errors : warnings;
      target.push(`timing ${issue.code}: ${issue.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

interface CompiledStoryboardPromptScene {
  index: number;
  heading: string;
  body: string;
  startSec: number | null;
  endSec: number | null;
  dialogue: string;
}

interface StoryboardDialogueRequirement {
  dialogue: string;
  sectionIndex: number | null;
}

interface StoryboardDialogueRequirementSet {
  requirements: StoryboardDialogueRequirement[];
  sourceSectionCount: number;
}

function inferCompiledStoryboardPromptFrameCount(prompt: string): number | null {
  const match = prompt.match(/\bCreate\s+exactly\s+(\d{1,3})\s+sequential video storyboard frames\b/i);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? count : null;
}

function inferCompiledStoryboardPromptDurationSec(prompt: string): number | null {
  const match = prompt.match(/\bTarget duration:\s*(\d{1,3}(?:\.\d+)?)\s*seconds?\b/i);
  if (!match) return null;
  const duration = Number(match[1]);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function inferCompiledStoryboardPromptAspectRatio(prompt: string, labelPattern: RegExp): string | null {
  const match = prompt.match(labelPattern);
  return normalizeAspectRatio(match?.[1]);
}

function extractCompiledStoryboardScenesBlock(prompt: string): string {
  const match = prompt.match(/\nSCENES:\s*\n([\s\S]*?)(?:\nTEXT RENDERING:|\nTEXT RULES:|\nSOURCE BRIEF TO FOLLOW:|\nNEGATIVE \/ AVOID:|$)/i);
  return match?.[1] ?? '';
}

function parseCompiledStoryboardHeadingTiming(heading: string): { startSec: number | null; endSec: number | null } {
  const timing = heading.match(/(?:^|\s+-\s+)(\d{1,2}:\d{1,2}(?:\.\d+)?|\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?\s*-\s*(\d{1,2}:\d{1,2}(?:\.\d+)?|\d{1,3}(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?\s*$/i);
  if (!timing) return { startSec: null, endSec: null };
  return {
    startSec: parseStoryboardTimeValue(timing[1]),
    endSec: parseStoryboardTimeValue(timing[2]),
  };
}

function extractCompiledStoryboardScenes(prompt: string): CompiledStoryboardPromptScene[] {
  const block = extractCompiledStoryboardScenesBlock(prompt);
  if (!block.trim()) return [];
  const headings = Array.from(block.matchAll(/^SCENE_(\d{1,3})\s+-\s+([^\n]+)$/gim));
  return headings.map((match, i) => {
    const headingStart = match.index ?? 0;
    const headingEnd = headingStart + match[0].length;
    const nextStart = headings[i + 1]?.index ?? block.length;
    const heading = match[0].trim();
    const body = block.slice(headingEnd, nextStart).trim();
    const dialogueMatch = body.match(/^\s*Dialogue\/VO:\s*(.+)$/im);
    const timing = parseCompiledStoryboardHeadingTiming(heading);
    return {
      index: Number(match[1]),
      heading,
      body,
      startSec: timing.startSec,
      endSec: timing.endSec,
      dialogue: normalizeStoryboardDialogue(dialogueMatch?.[1] ?? ''),
    };
  });
}

function sourceStoryboardDialogueRequirements(sourceText: string | null | undefined): StoryboardDialogueRequirementSet {
  const raw = (sourceText || '').trim();
  if (!raw) return { requirements: [], sourceSectionCount: 0 };
  const source = canonicalStoryboardScriptContext(raw) || raw;
  const requirements: StoryboardDialogueRequirement[] = [];
  const sections = splitStoryboardSections(source);
  sections.forEach((section, sectionIndex) => {
    const dialogue = normalizeStoryboardDialogue(extractStoryboardField(section.body, [
      'Dialogue/VO',
      'VO/Dialogue',
      'Dialogue',
      'VO',
      'V.O.',
      'Voiceover',
      'Voice-over',
      'Speech',
      'Narration',
    ]));
    if (dialogue) requirements.push({ dialogue, sectionIndex });
  });
  if (requirements.length === 0) {
    requirements.push(...sourceQuotedStoryboardDialogueSegments(source).map(dialogue => ({
      dialogue,
      sectionIndex: null,
    })));
  }

  const unique: StoryboardDialogueRequirement[] = [];
  const seen = new Set<string>();
  for (const requirement of requirements) {
    const compact = compactStoryboardLine(requirement.dialogue);
    if (!compact) continue;
    const tokenCount = storyboardDialogueWordSpans(compact).length;
    if (tokenCount === 0 || compact.length < 2) continue;
    const key = storyboardDialogueWordSpans(compact).map(span => span.token).join(' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...requirement, dialogue: compact });
  }
  return { requirements: unique, sourceSectionCount: sections.length };
}

export function auditCompiledStoryboardImagePrompt(
  options: StoryboardCompiledPromptAuditOptions,
): StoryboardCompiledPromptAuditResult {
  const prompt = options.prompt.trim();
  const fatalIssues: StoryboardCompiledPromptAuditIssue[] = [];
  const warnings: StoryboardCompiledPromptAuditIssue[] = [];
  if (!prompt) {
    fatalIssues.push({
      code: 'storyboard_prompt_empty',
      message: 'Storyboard image prompt is empty.',
      field: 'prompt',
    });
    return { ok: false, fatalIssues, warnings };
  }

  const expectedFrameCount = options.expectedFrameCount
    ?? inferCompiledStoryboardPromptFrameCount(prompt);
  const expectedDurationSec = options.expectedDurationSec
    ?? inferCompiledStoryboardPromptDurationSec(prompt);
  const scenes = extractCompiledStoryboardScenes(prompt);
  const cellAspectRatio = inferCompiledStoryboardPromptAspectRatio(
    prompt,
    /\bIndividual\s+scene-cell\/frame\s+aspect\s+ratio\s*:\s*([0-9]{1,5}\s*(?::|\/|x)\s*[0-9]{1,5})/i,
  );
  const targetVideoAspectRatio = inferCompiledStoryboardPromptAspectRatio(
    prompt,
    /\bTarget\s+final\s+video\s+aspect\s+ratio\s*:\s*([0-9]{1,5}\s*(?::|\/|x)\s*[0-9]{1,5})/i,
  );

  if (/^\s*TIMING VALIDATION:\s*$/im.test(prompt) || /\bERROR\s+timing_/i.test(prompt)) {
    fatalIssues.push({
      code: 'storyboard_prompt_contains_validation_error_text',
      message: 'Compiled storyboard prompt contains timing validation or repair text that should be handled before generation.',
      field: 'prompt',
    });
  }

  if (cellAspectRatio && targetVideoAspectRatio && cellAspectRatio !== targetVideoAspectRatio) {
    fatalIssues.push({
      code: 'storyboard_prompt_aspect_ratio_mismatch',
      message: `Compiled storyboard prompt uses ${cellAspectRatio} scene cells for a ${targetVideoAspectRatio} final video.`,
      field: 'prompt',
      metadata: { cellAspectRatio, targetVideoAspectRatio },
    });
  }

  if (/\bFollow the approved source brief for this sequential storyboard beat\b/i.test(prompt)) {
    fatalIssues.push({
      code: 'storyboard_prompt_contains_fallback_scene',
      message: 'Compiled storyboard prompt still contains fallback scene filler instead of concrete storyboard beats.',
      field: 'prompt',
    });
  }

  if (/\b(?:Preserve this user avoid-list constraint|User avoid constraint):\s*(?:avoid\s*:?\s*)?none\b/i.test(prompt)) {
    fatalIssues.push({
      code: 'storyboard_prompt_contains_empty_avoid_constraint',
      message: 'Compiled storyboard prompt contains an empty avoid-list constraint.',
      field: 'prompt',
    });
  }

  if (expectedFrameCount !== null && scenes.length !== expectedFrameCount) {
    fatalIssues.push({
      code: 'storyboard_prompt_scene_count_mismatch',
      message: `Compiled storyboard prompt asks for ${expectedFrameCount} frame(s) but defines ${scenes.length} scene(s).`,
      field: 'prompt',
      metadata: { expectedFrameCount, actualSceneCount: scenes.length },
    });
  }

  if (scenes.length === 0) {
    fatalIssues.push({
      code: 'storyboard_prompt_missing_scenes',
      message: 'Compiled storyboard prompt has no SCENES entries.',
      field: 'prompt',
    });
  }

  const missingVisualScene = scenes.find(scene => !/^\s*Visual\/Action:\s*\S/im.test(scene.body));
  if (missingVisualScene) {
    fatalIssues.push({
      code: 'storyboard_prompt_missing_scene_visual',
      message: `Scene ${missingVisualScene.index} is missing concrete Visual/Action direction.`,
      field: 'prompt',
      metadata: { sceneIndex: missingVisualScene.index },
    });
  }

  const timedScenes = scenes.filter(scene => scene.startSec !== null && scene.endSec !== null);
  if (timedScenes.length > 0) {
    const backwards = timedScenes.find(scene => (scene.endSec as number) <= (scene.startSec as number));
    if (backwards) {
      fatalIssues.push({
        code: 'storyboard_prompt_invalid_scene_timing',
        message: `Scene ${backwards.index} has a non-forward time range.`,
        field: 'prompt',
        metadata: {
          sceneIndex: backwards.index,
          startSec: backwards.startSec,
          endSec: backwards.endSec,
        },
      });
    }
    for (let i = 1; i < timedScenes.length; i += 1) {
      const previous = timedScenes[i - 1];
      const current = timedScenes[i];
      if ((current.startSec as number) < (previous.endSec as number) - 0.05) {
        fatalIssues.push({
          code: 'storyboard_prompt_timing_overlap',
          message: `Scene ${current.index} starts before scene ${previous.index} ends.`,
          field: 'prompt',
          metadata: {
            previousSceneIndex: previous.index,
            previousEndSec: previous.endSec,
            sceneIndex: current.index,
            startSec: current.startSec,
          },
        });
        break;
      }
    }
  }

  if (expectedDurationSec !== null && timedScenes.length > 0) {
    const maxEndSec = Math.max(...timedScenes.map(scene => scene.endSec as number));
    const firstStartSec = Math.min(...timedScenes.map(scene => scene.startSec as number));
    const allowedLateStartSec = Math.min(2, expectedDurationSec * 0.2);
    if (maxEndSec > expectedDurationSec + 0.75) {
      fatalIssues.push({
        code: 'storyboard_prompt_timing_exceeds_duration',
        message: `Compiled storyboard prompt scene timings end at ${formatStoryboardSeconds(maxEndSec)}, beyond the ${formatStoryboardSeconds(expectedDurationSec)} target duration.`,
        field: 'prompt',
        metadata: { expectedDurationSec, maxEndSec },
      });
    }
    if (firstStartSec > allowedLateStartSec) {
      fatalIssues.push({
        code: 'storyboard_prompt_timing_starts_late',
        message: `Compiled storyboard prompt starts at ${formatStoryboardSeconds(firstStartSec)} instead of near 0s.`,
        field: 'prompt',
        metadata: { expectedDurationSec, firstStartSec },
      });
    }
  }

  const dialogueRequirementSet = sourceStoryboardDialogueRequirements(options.sourceText);
  const requiredDialogue = dialogueRequirementSet.requirements;
  if (requiredDialogue.length > 0) {
    const compiledDialogue = scenes.map(scene => scene.dialogue).filter(Boolean).join(' ');
    const canCheckSceneAlignment =
      dialogueRequirementSet.sourceSectionCount > 0
      && dialogueRequirementSet.sourceSectionCount === scenes.length;
    for (const requirement of requiredDialogue) {
      const dialogue = requirement.dialogue;
      const tokenCount = storyboardDialogueWordSpans(dialogue).length;
      const minCoverage = tokenCount >= 8 ? 0.7 : 0.9;
      const sceneDialogue = canCheckSceneAlignment && requirement.sectionIndex !== null
        ? scenes[requirement.sectionIndex]?.dialogue ?? ''
        : '';
      const sceneCoverage = sceneDialogue
        ? storyboardDialogueCoverage(dialogue, sceneDialogue)
        : 0;
      const coverage = storyboardDialogueCoverage(dialogue, compiledDialogue);
      if (canCheckSceneAlignment && requirement.sectionIndex !== null && sceneCoverage < minCoverage) {
        fatalIssues.push({
          code: coverage >= minCoverage
            ? 'storyboard_prompt_misassigned_source_dialogue'
            : 'storyboard_prompt_missing_source_dialogue',
          message: coverage >= minCoverage
            ? 'Compiled storyboard prompt preserves source Dialogue/VO but assigns it to the wrong scene.'
            : 'Compiled storyboard prompt does not preserve required Dialogue/VO from the approved source script.',
          field: 'prompt',
          metadata: {
            requiredDialogue: dialogue,
            sceneIndex: requirement.sectionIndex + 1,
            sceneCoverage,
            coverage,
          },
        });
        continue;
      }
      if (coverage < minCoverage) {
        fatalIssues.push({
          code: 'storyboard_prompt_missing_source_dialogue',
          message: 'Compiled storyboard prompt does not preserve required Dialogue/VO from the approved source script.',
          field: 'prompt',
          metadata: {
            requiredDialogue: dialogue,
            coverage,
          },
        });
      }
    }
  }

  return {
    ok: fatalIssues.length === 0,
    fatalIssues,
    warnings,
  };
}

function parseStoryboardDimensionText(value: string | undefined): ExplicitPixelDimensions | null {
  if (!value) return null;
  const match = value.match(/\b(\d{2,5})\s*x\s*(\d{2,5})\b/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

interface StoryboardCanvasDefault {
  width: number;
  height: number;
  aspectRatio: string;
  boardAspectRatio?: string;
}

function exactPixelAspectDescription(width: number, height: number): string {
  const ratio = formatAspectRatio(width, height) ?? '16:9';
  const orientation = width > height ? 'landscape' : height > width ? 'portrait' : 'square';
  return `${ratio} ${orientation} video`;
}

function storyboardCanvasContextMentionsPage(context: string): boolean {
  return /\b(?:board|canvas|page|sheet|poster|story\s*board\s+(?:image|sheet|canvas|board|page)|storyboard\s+(?:image|sheet|canvas|board|page)|(?:image|sheet|canvas|board|page)\s+(?:story\s*board|storyboard))\b/i.test(context);
}

export function stripGeneratedStoryboardLayoutHints(text: string): string {
  return text
    .replace(new RegExp(`${DEFAULT_STORYBOARD_CANVAS_HINT_MARKER}[^\\n]*`, 'gi'), '')
    .replace(/^Storyboard layout target:[^\n]*$/gmi, '')
    .replace(/^Storyboard layout:[^\n]*$/gmi, '');
}

export function inferExplicitStoryboardCanvasPixelDimensions(text: string): ExplicitPixelDimensions | null {
  const source = stripGeneratedStoryboardLayoutHints(text);
  const matcher = /\b(\d{3,5})\s*x\s*(\d{3,5})\b/gi;
  for (const match of source.matchAll(matcher)) {
    const index = match.index ?? 0;
    const context = source.slice(Math.max(0, index - 80), Math.min(source.length, index + match[0].length + 80));
    if (!storyboardCanvasContextMentionsPage(context)) continue;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }
  return null;
}

export function userDefinedStoryboardCanvas(text: string): boolean {
  const source = stripGeneratedStoryboardLayoutHints(text);
  if (inferStoryboardBoardAspectDirective(source)) return true;
  if (inferExplicitStoryboardCanvasPixelDimensions(source)) return true;
  const pageUnit = String.raw`(?:board|canvas|page|sheet|poster|story\s*board\s+(?:sheet|canvas|board|page|poster|output)|storyboard\s+(?:sheet|canvas|board|page|poster|output)|(?:sheet|canvas|board|page|poster|output)\s+(?:story\s*board|storyboard))`;
  const aspectToken = String.raw`(?:\d{1,4}\s*:\s*\d{1,4}|\d{3,5}\s*x\s*\d{3,5}|portrait|vertical|landscape|horizontal|widescreen)`;
  return new RegExp(String.raw`\b${pageUnit}\b[\s\S]{0,80}\b${aspectToken}\b`, 'i').test(source)
    || new RegExp(String.raw`\b${aspectToken}\b[\s\S]{0,80}\b${pageUnit}\b`, 'i').test(source);
}

export function maskNonCanvasExactPixelDimensionsForStoryboard(text: string): string {
  return text.replace(/\b(\d{3,5})\s*x\s*(\d{3,5})\b/gi, (match, rawWidth, rawHeight, offset, fullText) => {
    const source = String(fullText);
    const context = source.slice(
      Math.max(0, offset - 80),
      Math.min(source.length, offset + match.length + 80),
    );
    if (storyboardCanvasContextMentionsPage(context)) return match;
    const width = Number(rawWidth);
    const height = Number(rawHeight);
    return exactPixelAspectDescription(width, height);
  });
}

function parseAspectRatioOrientation(aspectRatio: string): 'portrait' | 'landscape' | 'square' | null {
  const normalized = normalizeAspectRatio(aspectRatio);
  if (!normalized) return null;
  const [widthText, heightText] = normalized.split(':');
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'square';
}

function defaultStoryboardCanvasForVideoAspectRatio(
  targetVideoAspectRatio: string,
  frameCount: number,
): StoryboardCanvasDefault | null {
  const orientation = parseAspectRatioOrientation(targetVideoAspectRatio);
  if (orientation !== 'portrait' && orientation !== 'landscape' && orientation !== 'square') {
    return null;
  }
  const grid = chooseBalancedStoryboardGrid(frameCount, targetVideoAspectRatio);
  return {
    width: grid.width,
    height: grid.height,
    aspectRatio: grid.boardDimensions,
    boardAspectRatio: grid.boardAspectRatio,
  };
}

function storyboardCanvasHintText(
  canvas: StoryboardCanvasDefault,
  targetVideoAspectRatio: string,
): string {
  const orientation = canvas.width > canvas.height
    ? 'landscape'
    : canvas.height > canvas.width
      ? 'portrait'
      : 'square';
  const boardRatio = canvas.boardAspectRatio ?? reduceRatioString(canvas.width, canvas.height);
  const boardAspect = `${boardRatio} ${orientation}`;
  return [
    `${DEFAULT_STORYBOARD_CANVAS_HINT_MARKER} Use a ${boardAspect} storyboard canvas/page (${canvas.aspectRatio}) for the composite storyboard sheet.`,
    `Keep individual scene-cell/frame aspect ratio ${targetVideoAspectRatio}; target final video aspect ratio ${targetVideoAspectRatio}.`,
  ].join(' ');
}

function insertDefaultStoryboardCanvasHint(text: string, hint: string): string {
  const generatedBriefMatch = text.match(
    /^\s*(?:[-*+]\s*)?(?:#{1,6}\s*)?(?:[*_]{1,3})?\s*(?:storyboard\s+image\s+brief|subsequent\s+video\s+brief|video\s+generation\s+stage|next\s+steps?)\b[^\n]*$/im,
  );
  if (!generatedBriefMatch || generatedBriefMatch.index === undefined) {
    return `${hint}\n${text}`;
  }

  const before = text.slice(0, generatedBriefMatch.index).trimEnd();
  const after = text.slice(generatedBriefMatch.index).trimStart();
  return `${before}\n${hint}\n\n${after}`;
}

export function applyDefaultStoryboardCanvasHint(text: string, frameCount: number): string {
  if (text.includes(DEFAULT_STORYBOARD_CANVAS_HINT_MARKER)) return text;
  if (userDefinedStoryboardCanvas(text)) return text;
  const maskedText = maskNonCanvasExactPixelDimensionsForStoryboard(text);
  const layout = inferStoryboardLayoutSpec(maskedText, frameCount);
  const explicitRatio = inferExplicitAspectRatioFromText(maskedText);
  const explicitTargetAspectRatio = explicitRatio ? `${explicitRatio.width}:${explicitRatio.height}` : null;
  const targetVideoAspectRatio = explicitTargetAspectRatio ?? layout.targetVideoAspectRatio;
  const canvas = defaultStoryboardCanvasForVideoAspectRatio(targetVideoAspectRatio, frameCount);
  if (!canvas) return maskedText;
  return insertDefaultStoryboardCanvasHint(
    maskedText,
    storyboardCanvasHintText(canvas, targetVideoAspectRatio),
  );
}

export function buildStoryboardCanvasArgs(
  boardAspectRatio: string,
  isGptImage2: boolean,
  boardDimensions?: string,
): { width?: number; height?: number; aspectRatio: string } {
  const normalizedBoardAspectRatio = normalizeAspectRatio(boardAspectRatio) ?? boardAspectRatio;
  const orientation = parseAspectRatioOrientation(normalizedBoardAspectRatio);
  if (orientation !== 'landscape' && orientation !== 'portrait' && orientation !== 'square') {
    return { aspectRatio: normalizedBoardAspectRatio };
  }

  const explicitDimensions = boardDimensions
    ? parseStoryboardDimensionText(boardDimensions)
    : null;

  if (isGptImage2) {
    const dims = explicitDimensions ?? (() => {
      const pair = parseAspectRatioPair(normalizedBoardAspectRatio);
      if (!pair) return GPT_IMAGE_STORYBOARD_DEFAULTS.storyboardLandscape;
      const sized = pickStoryboardBoardPixelDimensions(pair.width, pair.height);
      return { width: sized.width, height: sized.height };
    })();
    return {
      width: dims.width,
      height: dims.height,
      aspectRatio: `${dims.width}x${dims.height}`,
    };
  }

  // Non-GPT-Image-2 renderers run on a more limited pixel budget; keep the
  // short edge near 1080 and let the long edge follow the board ratio.
  const dims = explicitDimensions
    ?? dimensionsForShortSideAspectRatio(normalizedBoardAspectRatio, 1080);
  return { width: dims.width, height: dims.height, aspectRatio: `${dims.width}x${dims.height}` };
}

function storyboardIntentWithDefaultCanvasHint(userIntentText: string, frameCount: number): string {
  return applyDefaultStoryboardCanvasHint(userIntentText, frameCount);
}

export function defaultStoryboardImageDimensions(layout: StoryboardLayoutSpec): ExplicitPixelDimensions {
  const explicit = parseStoryboardDimensionText(layout.boardDimensions);
  if (explicit) return explicit;

  const normalized = normalizeAspectRatio(layout.boardAspectRatio);
  if (normalized === '9:16') return { width: 1440, height: 2560 };
  if (normalized === '1:1') return { width: 2048, height: 2048 };
  if (normalized === '4:3') return { width: 2048, height: 1536 };
  if (normalized === '3:4') return { width: 1536, height: 2048 };
  return { width: 2560, height: 1440 };
}

function dimensionsForShortSideAspectRatio(
  aspectRatio: string,
  shortSide: number,
): ExplicitPixelDimensions {
  const normalized = normalizeAspectRatio(aspectRatio) ?? '16:9';
  const [widthText, heightText] = normalized.split(':');
  const ratioWidth = Number(widthText);
  const ratioHeight = Number(heightText);
  if (
    !Number.isFinite(ratioWidth)
    || !Number.isFinite(ratioHeight)
    || ratioWidth <= 0
    || ratioHeight <= 0
  ) {
    return { width: 1280, height: 720 };
  }
  const multiple = 16;
  const side = Math.max(multiple, Math.round(shortSide / multiple) * multiple);
  const roundLongSide = (value: number) => Math.max(multiple, Math.round(value / multiple) * multiple);
  if (ratioWidth >= ratioHeight) {
    return {
      width: roundLongSide(side * ratioWidth / ratioHeight),
      height: side,
    };
  }
  return {
    width: side,
    height: roundLongSide(side * ratioHeight / ratioWidth),
  };
}

function clampSeedanceStoryboardDuration(value: number | null | undefined): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : 5;
  return Math.max(4, Math.min(15, Math.round(raw)));
}

function sceneLineForSeedanceStoryboardProject(scene: SceneSpec, index: number): string {
  const timing = scene.startSec !== null && scene.endSec !== null
    ? `${formatStoryboardSeconds(scene.startSec)}-${formatStoryboardSeconds(scene.endSec)}`
    : 'untimed';
  const voice = scene.dialogue || '[no dialogue]';
  const metadataLabels = scene.metadataLabels ?? [];
  const lines = [
    `SCENE ${String(index + 1).padStart(2, '0')} - ${removeStoryboardMetadataLabelsFromPromptText(scene.title, metadataLabels) || scene.title}`,
    `TIME: ${timing}`,
  ];
  if (scene.purpose) lines.push(`PURPOSE: ${scene.purpose}`);
  const visual = removeStoryboardMetadataLabelsFromPromptText(scene.visual, metadataLabels);
  if (visual) lines.push(`VISUAL: ${visual}`);
  const action = removeStoryboardMetadataLabelsFromPromptText(scene.action, metadataLabels);
  if (action) lines.push(`ACTION: ${action}`);
  if (scene.camera) lines.push(`CAMERA: ${scene.camera}`);
  if (scene.lighting) lines.push(`LIGHTING/STYLE: ${scene.lighting}`);
  const transition = [scene.transitionIn, scene.transitionOut].filter(Boolean).join('; ');
  if (transition) lines.push(`TRANSITION: ${transition}`);
  lines.push(`VOICE/DIALOGUE: ${voice}`);
  if (scene.audioSfx.length > 0) lines.push(`AUDIO/SFX: ${scene.audioSfx.join(', ')}`);
  if (scene.music) lines.push(`MUSIC: ${scene.music}`);
  if (scene.referenceUsage.length > 0) lines.push(`REFERENCE USAGE: ${scene.referenceUsage.join('; ')}`);
  if (metadataLabels.length > 0) lines.push(`METADATA LABELS (do not render): ${metadataLabels.join('; ')}`);
  if (scene.textInImage.length > 0) lines.push(`VISIBLE TEXT: ${scene.textInImage.join('; ')}`);
  return lines.join('\n');
}

export function compileSeedanceStoryboardPromptFromProject(
  project: StoryboardProject,
  options: SeedanceStoryboardPromptFromProjectOptions = {},
): string {
  const storyboardImageTag = options.storyboardImageTag ?? PUBLIC_SEEDANCE_PRIMARY_IMAGE_REF;
  const durationSec = clampSeedanceStoryboardDuration(options.durationSec ?? project.durationSec);
  const aspectRatio = normalizeAspectRatio(options.aspectRatio ?? project.targetVideoAspectRatio)
    ?? project.targetVideoAspectRatio
    ?? '16:9';
  const avoidList = [
    ...project.creativeBrief.mustAvoid,
    'Do not render the storyboard board, grid, captions, panel dividers, thumbnails, or collage layout as the video.',
    'Do not add readable text beyond the exact visible text specified by the storyboard scenes.',
    'Do not drift reference assets, product design, logo, recurring character identity, shot order, or scene timing.',
  ];
  const metadataLabels = uniqueStoryboardStrings([
    ...(project.metadataLabels ?? []),
    ...project.scenes.flatMap(scene => scene.metadataLabels ?? []),
  ]);
  const storySpine = removeStoryboardMetadataLabelsFromPromptText(
    project.creativeBrief.storySpine,
    metadataLabels,
  ) || project.creativeBrief.storySpine;
  const visibleText = storyboardRequiredVisibleText(project);
  const visibleTextInstruction = visibleText.length > 0
    ? 'Render only the storyboard-specified visible text, exactly where its scene requires it. All scene numbers, timecodes, labels, and production notes remain metadata only and must not appear in the video.'
    : 'All scene numbers, timecodes, labels, and production notes remain metadata only and must not appear in the video.';
  const toneProgression = project.creativeBrief.toneProgression.join(' -> ');
  const musicArc = project.scenes.map(scene => scene.music).filter(Boolean).join(' -> ');
  const visualStyle = project.creativeBrief.visualQualityBar.replace(/\bstoryboard\s+sheet\b/gi, 'cinematic video');

  return [
    'PROJECT:',
    `Title: ${project.title}`,
    `Duration: ${durationSec} seconds total.`,
    `Aspect ratio: ${aspectRatio}.`,
    `Story spine: ${storySpine}`,
    '',
    'INPUT ASSETS:',
    `${storyboardImageTag}: approved storyboard reference image. Treat it as an ordered shot guide and timing reference only, not as a collage, split-screen, grid, or picture-in-picture layout to reproduce.`,
    '',
    'GLOBAL VIDEO INSTRUCTIONS:',
    `Render one continuous cinematic video in ${aspectRatio}. Follow the storyboard scene order, timing ranges, transitions, and audio plan.`,
    'Use the storyboard as the controlling source for shot order and intent while converting each panel into full-screen motion.',
    visibleTextInstruction,
    metadataLabels.length > 0 ? `Do not render these metadata labels as video text: ${metadataLabels.join('; ')}.` : '',
    `Visual style: ${visualStyle}`,
    toneProgression ? `Tone progression: ${toneProgression}` : '',
    musicArc ? `Music arc: ${musicArc}` : '',
    '',
    'TIMECODED SCENES:',
    ...project.scenes.map(sceneLineForSeedanceStoryboardProject),
    '',
    'NEGATIVE / AVOID:',
    ...Array.from(new Set(avoidList.map(item => compactStoryboardLine(item)).filter(Boolean))).map(item => `- ${item}`),
  ].join('\n');
}

export function lintSeedanceStoryboardPromptFromProject(
  prompt: string,
  project: StoryboardProject,
): StoryboardPromptLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!/\bPROJECT:/i.test(prompt)) errors.push('missing PROJECT section');
  if (!/\bINPUT ASSETS:/i.test(prompt)) errors.push('missing INPUT ASSETS section');
  if (!/\bGLOBAL VIDEO INSTRUCTIONS:/i.test(prompt)) errors.push('missing GLOBAL VIDEO INSTRUCTIONS section');
  if (!new RegExp(PUBLIC_SEEDANCE_PRIMARY_IMAGE_REF, 'i').test(prompt)) {
    errors.push(`missing ${PUBLIC_SEEDANCE_PRIMARY_IMAGE_REF} storyboard reference`);
  }
  if (!/\bshot guide\b/i.test(prompt)) errors.push('missing shot-guide instruction');
  if (!/\bnot\s+as\s+a\s+(?:collage|split-screen|grid)/i.test(prompt)) {
    errors.push('missing anti-collage/grid instruction');
  }
  if (project.scenes.length === 0) errors.push('missing storyboard scenes');
  project.scenes.forEach((scene, index) => {
    const sceneNumber = String(index + 1).padStart(2, '0');
    if (!new RegExp(`SCENE\\s+${sceneNumber}\\b`, 'i').test(prompt)) {
      errors.push(`missing scene ${index + 1}`);
    }
    if (!scene.visual.trim()) {
      errors.push(`scene ${index + 1} is missing visual direction`);
    }
    if (!new RegExp(`SCENE\\s+${sceneNumber}\\b[\\s\\S]*?^VISUAL:\\s*\\S`, 'im').test(prompt)) {
      errors.push(`prompt scene ${index + 1} is missing VISUAL text`);
    }
    if (scene.startSec !== null && scene.endSec !== null) {
      const timeText = `${formatStoryboardSeconds(scene.startSec)}-${formatStoryboardSeconds(scene.endSec)}`;
      if (!prompt.includes(timeText)) warnings.push(`missing exact time range for scene ${index + 1}`);
    }
  });
  for (const text of project.endCard.requiredText) {
    if (text && !prompt.includes(text)) errors.push(`missing required text "${text}"`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function buildStoryboardVideoHostedToolSequenceInput(
  options: StoryboardVideoHostedWorkflowBuildOptions,
): StoryboardVideoHostedWorkflowPlan {
  const storyline = options.storyline.trim();
  const userIntentText = options.userIntentText.trim();
  if (!storyline) {
    throw new Error('Storyboard video workflow requires a generated storyline or approved storyboard script.');
  }
  if (!userIntentText) {
    throw new Error('Storyboard video workflow requires the original user intent text.');
  }

  const initialFrameCount = Math.max(
    1,
    Math.min(
      24,
      options.frameCount
        ?? inferExplicitStoryboardFrameCountFromText(`${userIntentText}\n${storyline}`)
        ?? inferDefaultStoryboardFrameCountFromText(`${userIntentText}\n${storyline}`),
    ),
  );
  const workflowUserIntentText = storyboardIntentWithDefaultCanvasHint(userIntentText, initialFrameCount);
  const frameCount = Math.max(
    1,
    Math.min(
      24,
      options.frameCount
        ?? inferExplicitStoryboardFrameCountFromText(`${workflowUserIntentText}\n${storyline}`)
        ?? inferDefaultStoryboardFrameCountFromText(`${workflowUserIntentText}\n${storyline}`),
    ),
  );
  const compileOptions: StoryboardPromptCompileOptions = {
    prompt: storyline,
    userIntentText: workflowUserIntentText,
    approvedScriptContext: storyline,
    frameCount,
    promptAuthorship: 'assistant',
  };
  const project = buildStoryboardProject(compileOptions);
  const layout = storyboardLayoutSpecFromProject(project, project.scenes.length || frameCount);
  const defaultImageDimensions = defaultStoryboardImageDimensions(layout);
  const imageWidth = options.imageWidth ?? defaultImageDimensions.width;
  const imageHeight = options.imageHeight ?? defaultImageDimensions.height;
  const videoDuration = clampSeedanceStoryboardDuration(options.videoDurationSec ?? project.durationSec);
  const videoDimensions = dimensionsForShortSideAspectRatio(
    project.targetVideoAspectRatio,
    options.videoTargetResolution ?? 720,
  );
  const storyboardImagePrompt = compileVideoStoryboardImagePrompt(compileOptions);
  const seedanceVideoPrompt = compileSeedanceStoryboardPromptFromProject(project, {
    storyboardImageTag: PUBLIC_SEEDANCE_PRIMARY_IMAGE_REF,
    durationSec: videoDuration,
    aspectRatio: project.targetVideoAspectRatio,
  });
  const storyboardLint = lintStoryboardImagePrompt(storyboardImagePrompt, layout, project);
  const seedanceLint = lintSeedanceStoryboardPromptFromProject(seedanceVideoPrompt, project);
  if (storyboardLint.errors.length > 0 || seedanceLint.errors.length > 0) {
    throw new Error([
      'Storyboard video workflow compile failed validation.',
      ...storyboardLint.errors.map(error => `storyboard image: ${error}`),
      ...seedanceLint.errors.map(error => `seedance prompt: ${error}`),
    ].join(' '));
  }
  const title = options.title || `${project.title} storyboard video`;
  const imageModel = options.imageModel ?? 'gpt-image-2';
  const imageQuality = options.imageQuality ?? 'high';
  const imageOutputFormat = options.imageOutputFormat ?? 'png';
  const videoModel = options.videoModel ?? 'seedance2';
  const generateAudio = options.generateAudio ?? true;
  const input: StoryboardHostedWorkflowInput = {
    title,
    steps: [
      {
        id: 'storyboard_image',
        toolName: 'generate_image',
        arguments: {
          prompt: storyboardImagePrompt,
          model: imageModel,
          width: imageWidth,
          height: imageHeight,
          numberOfVariations: 1,
          gptImageQuality: imageQuality,
          outputFormat: imageOutputFormat,
        },
      },
      {
        id: 'seedance_video',
        toolName: 'generate_video',
        arguments: {
          prompt: seedanceVideoPrompt,
          videoModel,
          width: videoDimensions.width,
          height: videoDimensions.height,
          duration: videoDuration,
          fps: 24,
          numberOfVariations: 1,
          generateAudio,
          expandPrompt: false,
        },
        dependsOn: [
          {
            sourceStepId: 'storyboard_image',
            sourceArtifactIndex: 0,
            targetArgument: 'referenceImageIndices',
            mediaType: 'image',
            transform: 'image_index',
            required: true,
          },
        ],
      },
    ],
  };

  return {
    title,
    frameCount,
    storyline,
    storyboardProject: project,
    storyboardImagePrompt,
    seedanceVideoPrompt,
    image: {
      width: imageWidth,
      height: imageHeight,
      model: imageModel,
      quality: imageQuality,
      outputFormat: imageOutputFormat,
    },
    video: {
      width: videoDimensions.width,
      height: videoDimensions.height,
      duration: videoDuration,
      model: videoModel,
      generateAudio,
    },
    input,
    warnings: [
      ...storyboardLint.warnings.map(warning => `storyboard image: ${warning}`),
      ...storyboardLint.errors.map(error => `storyboard image error: ${error}`),
      ...seedanceLint.warnings.map(warning => `seedance prompt: ${warning}`),
      ...seedanceLint.errors.map(error => `seedance prompt error: ${error}`),
    ],
  };
}

export function inferDefaultVideoSteps(modelId: string | null | undefined): number | undefined {
  const id = (modelId || '').toLowerCase();
  if (isSeedanceModel(id)) return undefined;
  if (isLtx2Model(id) && id.includes('distilled')) return 8;
  if (id.includes('lightx2v')) return 4;
  if (id.includes('lightning') || id.includes('turbo') || id.includes('lcm')) return 4;
  if (isLtx2Model(id)) return 20;
  return 20;
}

export function resolveVideoSteps(
  modelId: string | null | undefined,
  modelDefaults: SkillModelDefaults | null | undefined,
  explicitSteps: number | null | undefined,
): number | undefined {
  if (typeof explicitSteps === 'number' && Number.isFinite(explicitSteps)) return explicitSteps;
  const defaultSteps = modelDefaults?.steps;
  if (typeof defaultSteps === 'number' && Number.isFinite(defaultSteps)) return defaultSteps;
  return inferDefaultVideoSteps(modelId);
}

const GRID_PATTERNS: RegExp[] = [
  /\b(?:different|various|varying|multiple|several|many|diverse|assorted|all|range of|variety of|array of|series of|set of|collection of)\s+(?:facial\s+)?(?:expressions?|poses?|angles?|versions?|variations?|looks?|smiles?|moods?|emotions?|faces?|views?|shots?|styles?|options?|takes?|scenes?|settings?|environments?|worlds?)\b/gi,
  /\b\d+\s+(?:completely\s+|totally\s+|very\s+)?(?:different|unique|distinct|varying|varied|separate|individual)?\s*(?:facial\s+)?(?:expressions?|poses?|angles?|versions?|variations?|looks?|smiles?|moods?|emotions?|faces?|views?|shots?|styles?|options?|takes?|images?|photos?|pictures?|portraits?|copies|duplicates|scenes?|settings?|environments?|worlds?)\b/gi,
  /\b(?:grid|collage|montage|composite|triptych|diptych|side[- ]by[- ]side|side[- ]to[- ]side|split[- ]?screen|photo[- ]?sheet|contact[- ]?sheet|mood[- ]?board|lineup|line[- ]?up|tile[ds]?|tiling|rows?\s+(?:of|and)\s+columns?|columns?\s+(?:of|and)\s+rows?)\b/gi,
  /\beach\s+(?:with|showing|featuring|displaying|having|in)\s+(?:a\s+)?(?:different|unique|distinct|its own)\b/gi,
  /\beach\s+(?:one|version|variation|image|copy)\b/gi,
  /\b(?:show|display|create|generate|make|render|produce)\s+(?:multiple|different|various|several|all)\b/gi,
  /\b(?:switch(?:ing)?|mix(?:ing)?)\s+up\b/gi,
  /\b\d+\s+of\s+(?:them|these|those)\b/gi,
  /\b(?:multiple|several|many)\s+(?:copies|duplicates|instances|repeats)\b/gi,
  /\b\d+\s+(?:versions?|variations?|renditions?|interpretations?|depictions?|iterations?)\b/gi,
  /\b(?:repeated|repeating|repeat)\s+\d*\s*(?:times?)?\b/gi,
  /\b(?:put|place|fit|arrange)\s+(?:them|these|those|it)\s+(?:all\s+)?(?:together|into one|in one)\b/gi,
  /\ball\s+(?:together|in\s+one\s+(?:image|frame|picture|photo))\b/gi
];

const SINGULARIZE_PATTERNS: Array<[RegExp, string]> = [
  [
    /\b(create|generate|make|render|produce)\s+\d+\s+(?:completely\s+|totally\s+|very\s+)?(?:different|unique|distinct|varying|varied|separate|individual)?\s*(scenes?|settings?|environments?|worlds?)\s+(featuring|with|of)\b/gi,
    '$1 a single scene $3'
  ],
  [
    /\b(create|generate|make|render|produce)\s+\d+\s+(?:completely\s+|totally\s+|very\s+)?(?:different|unique|distinct|varying|varied|separate|individual)?\s*(images?|photos?|pictures?|portraits?)\s+(featuring|with|of)\b/gi,
    '$1 a single image $3'
  ],
  [
    /\b(?:in|across)\s+(?:different|various|varying|multiple|several|many|diverse|assorted)\s+(?:scenes?|settings?|environments?|worlds?)\s*:/gi,
    'in this setting:'
  ],
  [
    /\bfor\s+all\s+(?:scenes?|settings?|environments?|worlds?|images?|photos?|pictures?|portraits?)\b/gi,
    'for the image'
  ]
];

function countPatternReplacement(match: string, ...args: unknown[]): string {
  const offset = typeof args[args.length - 2] === 'number' ? (args[args.length - 2] as number) : 0;
  const source = typeof args[args.length - 1] === 'string' ? (args[args.length - 1] as string) : '';
  const before = source.slice(Math.max(0, offset - 8), offset);
  const after = source.slice(offset + match.length, offset + match.length + 8);
  const touchesAspectOrDimension =
    /(?:\d\s*[:/x×]\s*|\bby\s*)$/i.test(before) ||
    /^\s*(?::|\/|x|×|\bby\b)\s*\d/i.test(after);
  return touchesAspectOrDimension ? match : '';
}

export function sanitizeBatchPrompt(prompt: string): string {
  const groups: string[] = [];
  const placeholderPrefix = '\x00DP';
  const placeholder = (i: number) => placeholderPrefix + i + '\x00';

  let shielded = prompt.replace(/\{[^{}]+\}/g, (match) => {
    if (match.includes('|')) {
      groups.push(match);
      return placeholder(groups.length - 1);
    }
    return match;
  });

  for (const [pattern, replacement] of SINGULARIZE_PATTERNS) {
    pattern.lastIndex = 0;
    shielded = shielded.replace(pattern, replacement);
  }
  for (const pattern of GRID_PATTERNS) {
    pattern.lastIndex = 0;
    shielded = shielded.replace(pattern, countPatternReplacement);
  }

  shielded = shielded.replace(/\s{2,}/g, ' ').replace(/\s+([.,;!?])/g, '$1').trim();
  shielded = shielded.replace(/^[,.\s]+/, '').replace(/[,.\s]+$/, '').trim();

  let result = shielded;
  for (let i = 0; i < groups.length; i++) {
    result = result.replace(placeholder(i), groups[i]);
  }

  return result;
}
