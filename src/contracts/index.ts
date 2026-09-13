export type { PromptContract } from './promptContract.js';
export { isPromptContract } from './promptContract.js';

export type {
  ToolGatingPolicy,
  ToolGatingPolicyTrigger,
  ToolGatingPolicyEffect,
} from './toolGatingPolicy.js';
export { isToolGatingPolicy } from './toolGatingPolicy.js';

export type { RepairRecipe, RepairRecipeMode } from './repairRecipe.js';
export { isRepairRecipe } from './repairRecipe.js';

export type { Signal, SignalSource, ContextHint, TurnPolicy } from './turnPolicy.js';
export { emptyTurnPolicy, normalizeSignalSource } from './turnPolicy.js';

export { ContractRegistry } from './registry.js';

export type { ClassifyTurnInput } from './evaluators.js';
export { classifyTurn } from './evaluators.js';

export type {
  ToolDefinitionLike,
  CompileToolsForTurnInput,
  CompiledToolset,
} from './evaluators.js';
export { compileToolsForTurn } from './evaluators.js';

export type {
  ToolCall,
  DispatchResult,
  DispatchToolCallInput,
} from './evaluators.js';
export { dispatchToolCall } from './evaluators.js';

export type {
  BuildContractTurnPolicyInput,
  CompiledContractToolSurface,
  CompileContractToolSurfaceInput,
  ContractMessageLike,
  ContractToolChoiceLike,
  ContractToolDefinitionLike,
} from './toolSurface.js';
export {
  CONTROL_TOOL_SET,
  DEFAULT_CONTRACT_CONTEXT_PREFIX,
  appendContractsContextToSystemContent,
  buildContractTurnPolicy,
  compileContractToolSurface,
  formatContractsContextBlock,
  normalizeContractMessages,
  reconcileToolChoiceForCompiledTools,
} from './toolSurface.js';

export type {
  ContractsTelemetryEvent,
  ContractsTelemetrySink,
  TurnClassifiedPayload,
  GatingPolicyAppliedPayload,
  PromptContractEmittedPayload,
  ToolDispatchResolvedPayload,
  RepairRecipeFiredPayload,
} from './telemetry.js';
export { isContractsTelemetryEvent, makeBufferedSink } from './telemetry.js';
// sogni-api hosted chat, future SDKs.
export {
  MEDIA_TOOL_NAMES,
  GATING_POLICIES,
  TOOL_SURFACE_GATING_POLICIES,
  IMAGE_CONTEXT_TOOL_NAMES,
  VIDEO_CONTEXT_TOOL_NAMES,
  REPAIR_RECIPES,
  PROMPT_CONTRACTS,
  CANONICAL_TOOL_CATALOG,
  TOOL_COST_METADATA,
  TOOL_PERMISSIONS,
  getCanonicalToolCatalogEntry,
  populateContractsGatingPolicies,
  populateContractsToolSurfaceGatingPolicies,
  populateContractsRepairRecipes,
  populateContractsPromptContracts,
  populateToolCostMetadata,
  populateToolPermissions,
  populateContractsDefaults,
  getToolCostMetadata,
  getToolPermission,
  getToolPermissionDecision,
  evaluatePermissionGate,
  toolRequiresUserApproval,
  listPaidTools,
  listToolsByRiskLevel,
  listCanonicalToolCatalogEntries,
  listHostedApiImplementedToolNames,
  listHostedApiToolCatalogEntries,
} from './data/index.js';
export type {
  ToolCostClass,
  ToolCostMetadata,
  ToolRiskLevel,
} from './data/toolCostMetadata.js';
export type {
  CanonicalToolCatalogEntry,
  ToolCatalogApiExecutorSupport,
  ToolCatalogCostMetadataStatus,
  ToolCatalogDefinitionSource,
  ToolCatalogFamily,
  ToolCatalogHostedApiSurface,
  ToolCatalogPromptContractStatus,
  ToolCatalogWorkflowEligibility,
} from './data/toolCatalog.js';
export type {
  PermissionGateInput,
  PermissionGateOutcome,
  ToolPermission,
  ToolPermissionDecision,
} from './data/toolPermissions.js';
// definitions import this sentinel from contracts/ instead of PRIVATE
// `prompts/`.
export { LITERAL_PROMPT_OVERRIDE } from './promptOverrideMarker.js';
// tool-name lists consumed by `contracts/data/toolCatalog.ts` and
// re-exported from `backbone/` for back-compat.
export {
  BACKBONE_APP_TOOL_NAMES,
  BACKBONE_COMPOSITION_TOOL_NAMES,
  BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES,
  BACKBONE_GENERATION_TOOL_NAMES,
  BACKBONE_HOSTED_APP_TOOL_NAMES,
} from './backboneToolCatalog.js';
export type { BackboneAppToolName } from './backboneToolCatalog.js';
// only / pure-data slice consumed by `runtime/durableWorkflowClient.ts`
// and re-exported from `backbone/` for back-compat.
export {
  BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES,
  BACKBONE_MODEL_KB_VERSION,
  BACKBONE_ROUTING_POLICY_VERSION,
  BACKBONE_SCHEMA_VERSION,
} from './backboneDurableWorkflow.js';
export type {
  BackboneDurableHostedStepToolName,
  BackboneDurableWorkflowInput,
  BackboneDurableWorkflowPlanStep,
  BackboneDurableWorkflowRunContract,
  BackboneDurableWorkflowStepInput,
  BackboneVersionManifest,
  BackboneWorkflowDependencyTransform,
  BackboneWorkflowStatus,
  BackboneWorkflowStepDependencyBinding,
} from './backboneDurableWorkflow.js';
// `agent/campaignStoryboard.ts` and the `storyboard/` adapter registry
// so neither side has to import the other.
export {
  CAMPAIGN_STORYBOARD_METADATA_PREFIX,
  CAMPAIGN_STORYBOARD_SCHEMA_VERSION,
} from './storyboard.js';
export type {
  CampaignPreservePriority,
  CampaignProductionMode,
  CampaignReferenceAsset,
  CampaignReferenceAssetType,
  CampaignReferenceUsageScope,
  CampaignSceneSpec,
  CampaignStoryboard,
  CampaignStoryboardValidationResult,
  CampaignTransition,
  CampaignVoiceLine,
} from './storyboard.js';

export * from './hostedToolValidation.js';
export {
  SOGNI_ADULT_REQUESTER_DIRECTIVE,
  withAdultRequesterDirective,
} from './adultRequesterDirective.js';
// `prompts/randomThemes.ts` so PUBLIC-bucket consumers (sogni-web's
// llmHelpers, the future `@sogni-ai/sogni-intelligence-client` carve-
// out) can import without crossing into PRIVATE `prompts/`.
export {
  RANDOM_THEMES,
  RANDOM_LYRICS_THEMES,
  getRandomTheme,
  getRandomLyricsTheme,
} from './randomThemes.js';
// extracted from `prompts/audioIdPrompt.ts`. No internal `prompts/`
// dependencies, so the entire surface ships in the PUBLIC bucket.
export {
  ID_LORA_MAX_TOKENS,
  ID_LORA_COMPOSITION_TOOL,
  buildIdLoRaConversionMessages,
  parseToolCallIdLoRaParts,
  formatIdLoRaPrompt,
} from './idLoraPrompt.js';
export type { IdLoRaPromptParts } from './idLoraPrompt.js';
// surface (system prompt + tool definition + message builder + parser)
// extracted from `prompts/imagePrompt.ts`. Depends only on the
// contracts-local `randomThemes` plus the already-public runtime and
// tools/definitions type modules.
export {
  IMAGE_PROMPT_MAX_TOKENS,
  IMAGE_PROMPT_TOOL,
  buildImagePromptMessages,
  buildImagePromptAuthoringMessages,
  resolveImagePromptAuthoringProfile,
  assertImagePromptAuthoringOutput,
  parseToolCallPrompt,
} from './imagePrompt.js';
export type {
  ImagePromptingType,
  BuildImagePromptMessagesInput,
  ImagePromptAuthoringOperation,
  ImagePromptAuthoringOutputFormat,
  ImagePromptAuthoringProfile,
  BuildImagePromptAuthoringMessagesInput,
} from './imagePrompt.js';
// instrumental composition surface (system prompts, tool definitions,
// message builders, result parser) extracted from
// `prompts/musicComposition.ts`. Depends only on the already-public
// `media/musicSettings` and the contracts-local `randomThemes`.
export {
  LYRICS_MAX_TOKENS,
  LYRICS_COMPOSITION_TOOL,
  INSTRUMENTAL_COMPOSITION_TOOL,
  buildLyricsMessages,
  buildInstrumentalMessages,
  parseToolCallResult,
} from './musicComposition.js';
export type {
  LyricsGenerationResult,
  MusicCompositionOptions,
  MusicCompositionTarget,
} from './musicComposition.js';
// video prompt-engineering surface (system prompts, tool definition,
// message builders, parser, supporting types) extracted from
// `prompts/videoComposition.ts`. Depends only on the contracts-local
// `randomThemes`, the already-public `runtime/chatTypes` /
// `tools/definitions/types`, and the pure-logic
// `tools/shared/llmHelpers` module (zero further imports).
export {
  SCRIPT_MAX_TOKENS,
  SCRIPT_COMPOSITION_TOOL,
  CHARACTER_REFERENCE_VIDEO_COMPOSITION_SYSTEM_PROMPT,
  buildLtxScriptMessages,
  buildWanScriptMessages,
  parseToolCallScript,
  buildCharacterReferenceVideoCompositionMessages,
  parseCompositionToolScriptFromResult,
} from './videoComposition.js';
export type {
  VideoFramePromptOptions,
  ScriptOptions,
  GenerateWanPromptParams,
  CharacterReferenceVideoCompositionMessageInput,
  CompositionToolCallResultLike,
} from './videoComposition.js';
// piece of `prompts/composeWorkflow.ts` that ships in the PUBLIC bucket
// — a small pure data shape consumed by `buildComposeWorkflowToolArgs`
// and by sogni-web's llmHelpers.
export type { ComposeWorkflowDestinationModels } from './composeWorkflowTypes.js';
// helpers and dispatcher-message builder for the hosted synchronous
// creative tools, extracted from `prompts/hostedComposition.ts`. Depends
// only on contracts-local helpers (`composeWorkflowTypes`,
// `imagePrompt`, `randomThemes`, `videoComposition`) plus the
// already-public `runtime/chatTypes` and `workflows/types`.
export {
  HOSTED_COMPOSITION_ROUTER_MAX_TOKENS,
  buildEnhancePromptToolArgs,
  buildLyricsCompositionToolArgs,
  buildInstrumentalCompositionToolArgs,
  buildScriptCompositionToolArgs,
  buildComposeWorkflowToolArgs,
  buildComposeWorkflowTemplateToolArgs,
  buildWanScriptCompositionToolArgs,
  buildHostedCompositionToolMessages,
} from './hostedComposition.js';
export type {
  HostedCompositionToolName,
  HostedCompositionToolRequest,
  BuildEnhancePromptToolArgsInput,
  BuildLyricsCompositionToolArgsInput,
  BuildInstrumentalCompositionToolArgsInput,
  BuildScriptCompositionToolArgsInput,
  BuildComposeWorkflowToolArgsInput,
  ComposeWorkflowTemplateInputDeclArg,
  BuildComposeWorkflowTemplateToolArgsInput,
} from './hostedComposition.js';
// wrapper barrel wasn't yet updated to expose. Needed so creative-agent's
// shim files (which now do `export * from '@sogni-ai/sogni-intelligence-client/contracts'`)
// can resolve back-compat re-exports of these symbols.
export {
  SEEDANCE_STORYBOARD_REFERENCE_PROMPT,
} from './storyboard.js';
export {
  LITERAL_VIDEO_PROMPT_OVERRIDE,
  LITERAL_SEEDANCE_PROMPT_OVERRIDE,
  SEEDANCE_EXPAND_PROMPT_DESCRIPTION,
  GENERATE_VIDEO_SKIP_PROMPT_PROCESSING_DESCRIPTION,
  ANIMATE_PHOTO_SKIP_PROMPT_PROCESSING_DESCRIPTION,
  SEEDANCE_TOOL_MULTIMODAL_REFERENCE_GUIDANCE,
  SEEDANCE_TOOL_AUDIO_REFERENCE_GUIDANCE,
  SEEDANCE_TOOL_V2V_REFERENCE_GUIDANCE,
  HAPPYHORSE_TOOL_REFERENCE_GUIDANCE,
  HAPPYHORSE_GENERATE_VIDEO_MODEL_DESCRIPTION,
} from './toolPromptMarkers.js';
export {
  BACKBONE_VERSIONS,
  BackboneWorkflowValidationError,
  MAX_HOSTED_TOOL_SEQUENCE_STEPS,
  normalizeBackboneDurableWorkflowSteps,
  buildBackboneDurableWorkflowRun,
} from './backboneDurableWorkflow.js';
export {
  getCostClassNumericWeight,
  UNKNOWN_COST_CLASS_FALLBACK_WEIGHT,
  COST_CLASS_NUMERIC_WEIGHTS,
} from './data/costEstimation.js';
