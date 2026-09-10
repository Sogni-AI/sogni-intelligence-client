export { sanitizeBatchPrompt } from './shared/promptSanitizer.js';
export {
  classifyError,
  parseResultForError,
} from './shared/errorClassification.js';
export type {
  ClassifiedError,
  ParsedToolResultError,
} from './shared/errorClassification.js';
export {
  GENERATE_IMAGE_MODELS,
  MODELS_BY_TOOL,
  getAlternativeModels,
  getModelArgKey,
  getModelOptions,
  isQualityTierTool,
} from './shared/modelRegistry.js';
export type { ModelOption } from './shared/modelRegistry.js';
export * from './shared/policyChecks.js';
export * from './shared/seedancePolicyErrors.js';
export * from './shared/happyhorsePolicyErrors.js';
export {
  SEEDANCE_REFERENCE_LIMITS,
  SEEDANCE_REFERENCE_LIMITS_BY_MODEL,
  getSeedanceReferenceLimits,
  SeedanceReferenceLimitError,
  validateSeedanceReferenceCounts,
} from './shared/seedanceReferences.js';
export type {
  SeedanceReferenceLimits,
  SeedanceReferenceLimitKind,
  SeedanceReferenceCounts,
} from './shared/seedanceReferences.js';
export {
  HAPPYHORSE_REFERENCE_LIMITS,
  HappyHorseReferenceLimitError,
  getHappyHorseReferenceLimits,
  validateHappyHorseReferenceCounts,
} from './shared/happyhorseReferences.js';
export type {
  HappyHorseReferenceLimits,
  HappyHorseReferenceLimitKind,
  HappyHorseReferenceCounts,
} from './shared/happyhorseReferences.js';
export {
  WAN3_LOOSE_REFERENCE_LIMITS,
  WAN3_REFERENCE_DURATION_LIMITS,
  Wan3ReferenceDurationError,
  Wan3ReferenceLimitError,
  validateWan3ReferenceCounts,
  validateWan3ReferenceDurations,
} from './shared/wan3References.js';
export type {
  Wan3ReferenceLimits,
  Wan3ReferenceLimitKind,
  Wan3ReferenceCounts,
} from './shared/wan3References.js';
// HappyHorse 1.1 LLM tool guidance — re-exported from the `./tools` subpath so
// consumers composing the generate_video manifest can pick it up alongside the
// Seedance markers. Authored in contracts/toolPromptMarkers.ts.
export {
  HAPPYHORSE_GENERATE_VIDEO_MODEL_DESCRIPTION,
  HAPPYHORSE_TOOL_REFERENCE_GUIDANCE,
} from '../contracts/toolPromptMarkers.js';
export * from './shared/llmHelpers.js';
export * from './shared/promptRefinementCache.js';
export * from './shared/imageEncoding.js';
export * from './shared/slotFailureSummary.js';
export * from './shared/visionDescriptionCache.js';
export * from './shared/downloadFilename.js';
export {
  addSubtitlesDefinition,
  animatePhotoDefinition,
  applyStyleDefinition,
  changeAngleDefinition,
  danceMontageDefinition,
  editImageDefinition,
  extendVideoDefinition,
  generateImageDefinition,
  generateMusicDefinition,
  generateSpeechDefinition,
  generateVideoDefinition,
  generationToolDefinitions,
  orbitVideoDefinition,
  overlayVideoDefinition,
  refineResultDefinition,
  replaceVideoSegmentDefinition,
  restorePhotoDefinition,
  upscaleImageDefinition,
  upscaleVideoDefinition,
  soundToVideoDefinition,
  stitchVideoDefinition,
  videoToVideoDefinition,
  OVERLAY_POSITIONS,
  STITCH_TRANSITION_TYPES,
  SUBTITLE_VERTICAL_POSITIONS,
  DANCE_PRESETS,
  resolveDancePresetForRequest,
} from './definitions/index.js';
export type { DancePreset, ToolDefinition } from './definitions/index.js';
export {
  isToolResultErr,
  isToolResultOk,
  mapLegacyToolErrorCategory,
  toolErr,
  toolOk,
} from './result.js';
export type {
  LegacyToolErrorCategory,
  ToolErrorCode,
  ToolResult,
  ToolResultAsset,
  ToolResultCost,
  ToolResultErr,
  ToolResultOk,
} from './result.js';
export {
  collapseSingleSourceFanOutToDynamicPromptVariations,
  expandSingleSourceFanOutForPerClipPrompts,
} from './normalizeArgs.js';
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
} from './shared/dynamicPromptBranches.js';
export { textExplicitlyRequestsMultipleImageOutputs } from './shared/multiImageIntent.js';
export { maybeAlignNumberOfVariationsToDynamicBranchCount } from './shared/numberOfVariationsAlignment.js';
