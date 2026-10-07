/**
 * Sogni Client Wrapper
 * Enhanced Node.js wrapper for Sogni AI SDK with n8n compatibility
 */

// Main client
export { SogniClientWrapper } from './client/SogniClientWrapper.js';

// Types
export type {
  SogniClientConfig,
  SogniAttributionConfig,
  InteractionKind,
  WorkloadKind,
  OperationScope,
  AgentSurface,
  ExecutionMode,
  AgentAttributionMetadata,
  ConnectionAttribution,
  WorkloadAttributionDefaults,
  WorkloadAttributionInput,
  OperationLineage,
  AuthType,
  TokenAuthConfig,
  CookieAuthConfig,
  ApiKeyAuthConfig,
  ProjectConfig,
  ImageProjectConfig,
  VideoProjectConfig,
  AudioProjectConfig,
  ProjectResult,
  ProjectProgress,
  VideoCostEstimateParams,
  AudioCostEstimateParams,
  CostEstimate,
  ConnectionStatus,
  ConnectionState,
  ModelInfo,
  BalanceInfo,
  AccountInfo,
  SizePreset,
  GetModelsOptions,
  CreateProjectOptions,
  ErrorData,
  JobCompletedData,
  JobFailedData,
  ChatErrorData,
  QwenImageEditConfig,
  // Re-exported from Sogni SDK
  Project,
  Job,
  AvailableModel,
  SupernetType,
  TokenType,
  BillingMode,
  SubscriptionEntitlementSnapshot,
  SubscriptionStatus,
  SubscriptionPlanId,
  SubscriptionUsage,
  AudioProjectParams,
  ImageOutputFormat,
  VideoOutputFormat,
  AudioOutputFormat,
  AudioFormat,
  VideoFormat,
  VideoWorkflowType,
  ChatMessage,
  ChatCompletionParams,
  ChatCompletionChunk,
  ChatCompletionResult,
  ChatJobStateEvent,
  ContentPart,
  TextContentPart,
  ImageUrlContentPart,
  ChatTokenUsage,
  LLMCostEstimation,
  LLMJobCost,
  LLMModelInfo,
  LLMParamConstraint,
  LLMSamplingDefaults,
  ToolDefinition,
  ToolCall,
  ToolCallDelta,
  ToolCallFunction,
  ToolChoice,
  ToolFunction,
  SogniToolsMode,
  ToolExecutionOptions,
  ToolExecutionProgress,
  ToolExecutionResult,
  ToolHistoryEntry,
  CreativeWorkflowArtifact,
  CreativeWorkflowEvent,
  CreativeWorkflowRecord,
  CreativeWorkflowSseEvent,
  CreativeWorkflowStatus,
  CreativeWorkflowHostedToolName,
  ListCreativeWorkflowOptions,
  StartCreativeWorkflowOptions,
  StartCreativeWorkflowParams,
  StreamCreativeWorkflowEventsOptions,
  InputMedia,
  ProjectEvent,
  JobEvent,
  JobPreparation,
  // ControlNet types
  ControlNetParams,
  ControlNetName,
  ControlNetMode,
  VideoControlNetName,
  VideoControlNetParams,
} from './types/index.js';

export { ClientEvent } from './types/index.js';

// Errors
export {
  SogniError,
  SogniConnectionError,
  SogniAuthenticationError,
  SogniProjectError,
  SogniTimeoutError,
  SogniBalanceError,
  SogniValidationError,
  SogniConfigurationError,
  SogniModelNotFoundError,
  SogniNetworkError,
  SogniModelConsentRequiredError,
  SogniModelNotYetAvailableError,
} from './utils/errors.js';
export {
  MODEL_CONSENT_REQUIRED_ERROR,
  MODEL_CONSENT_REQUIRED_ERROR_CODE,
  MODEL_CONSENT_REQUIRED_MESSAGE,
  SEEDANCE_MINI_UNCENSORED_CONSENT_REQUIRED_MESSAGE,
  modelConsentRequiredPayload,
  modelConsentRequiredPayloadFromError,
} from './media/modelConsentRequired.js';
export type {
  ModelConsentRequiredPayload,
  ModelConsentRequirement,
} from './media/modelConsentRequired.js';
export {
  MODEL_NOT_YET_AVAILABLE_ERROR,
  MODEL_NOT_YET_AVAILABLE_ERROR_CODE,
  MODEL_NOT_YET_AVAILABLE_FALLBACK_MESSAGE,
  modelNotYetAvailablePayload,
  modelNotYetAvailablePayloadFromError,
  textIndicatesModelNotYetAvailable,
} from './media/modelNotYetAvailable.js';
export type { ModelNotYetAvailablePayload } from './media/modelNotYetAvailable.js';

// Utilities
export {
  generateAppId,
  validateClientConfig,
  validateProjectConfig,
  isImageProjectConfig,
  isVideoProjectConfig,
  isAudioProjectConfig,
  isWanVideoModel,
  isLtxVideoModel,
  isSeedanceVideoModel,
  isSeedance25VideoModel,
  isHappyHorseVideoModel,
  isMiniMaxH3VideoModel,
  isLooseReferenceVideoModel,
  getVideoDimensionRules,
  isCookieAuth,
  sleep,
  retry,
  formatBytes,
  formatDuration,
  getMaxContextImages,
  supportsContextImages,
} from './utils/helpers.js';
export type { VideoDimensionRules } from './utils/helpers.js';
export {
  isSeedance25UncensoredVideoModelId,
  isSeedance25VideoModelId,
  isSeedanceMiniUncensoredVideoModelId,
  isSeedanceMiniVideoModelId,
  isSeedanceVideoModelId,
  resolveSeedanceVideoModelId,
  SEEDANCE_VIDEO_MODEL_IDS,
} from './utils/seedanceModelIds.js';
export type { SeedanceVideoModelId } from './utils/seedanceModelIds.js';

// SDK chat tool-calling helpers
export {
  ChatStream,
  CreativeWorkflowsApi,
  SogniClient,
  SogniTools,
  isSogniToolCall,
  parseCreativeWorkflowSseChunk,
  parseToolCallArguments,
} from '@sogni-ai/sogni-client';

// Public-safe tool-arg normalization helpers (also reachable via the
// `./tools` subpath). Re-exported from the root so consumers that already
// import from `@sogni-ai/sogni-intelligence-client` (e.g. sogni-chat) can
// pick these up without adding a second import line.
export {
  type DynamicPromptBranch,
  type SceneDynamicPromptValidation,
  extractDynamicPromptBranches,
  isolateDynamicPromptSlot,
  buildDynamicPromptSlotPrompts,
  validateSceneDynamicPromptBatch,
  validateSingleDynamicPromptBranch,
  promptHasStoryboardBatchLanguage,
  promptHasLinkedVariantBatchLanguage,
  isStoryboardKeyframeBatchPrompt,
} from './tools/shared/dynamicPromptBranches.js';
export { textExplicitlyRequestsMultipleImageOutputs } from './tools/shared/multiImageIntent.js';
export { maybeAlignNumberOfVariationsToDynamicBranchCount } from './tools/shared/numberOfVariationsAlignment.js';

// v2 platform contracts (Phase 0b additive). See
// docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md
export * from './agent/index.js';
export * from './artifacts/index.js';
export * from './events/index.js';
export * from './billing/index.js';

// Canonical untrusted-input sanitizer (audit follow-up 2026-05-21).
// Re-exported from the root so api-v2 and creative-agent-v2 can drop
// their local copies and import the strict union from one place
// without traversing the workflows subpath.
export {
  SanitizerError,
  HARD_STRIP_PATTERNS,
  sanitizeUntrustedString,
  escapeAttribute,
  wrapAsUntrustedUserInput,
  // Field-tag surface (creative-agent planner / classifier / storyboard).
  UNTRUSTED_OPEN,
  UNTRUSTED_CLOSE,
  MAX_BRIEF_LENGTH,
  MAX_STYLE_LENGTH,
  MAX_ASPECT_RATIO_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_LATEST_USER_TEXT_LENGTH,
  MAX_PRIOR_USER_TEXT_LENGTH,
  MAX_PRIOR_ASSISTANT_TEXT_LENGTH,
  MAX_CURRENT_MESSAGE_LENGTH,
  MAX_RECENT_TURN_LENGTH,
  MAX_CONVERSATION_SUMMARY_LENGTH,
} from './workflows/primitives/sanitizer.js';
export type {
  SanitizeUntrustedStringOptions,
  SanitizeField,
  SanitizeResult,
} from './workflows/primitives/sanitizer.js';

// Default export
export { SogniClientWrapper as default } from './client/SogniClientWrapper.js';
