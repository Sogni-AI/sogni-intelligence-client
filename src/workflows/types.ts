/**
 * Core type definitions for the Workflows feature (Phase 2 — savable,
 * parameterized templates).
 *
 * A `WorkflowTemplate` is a reusable, shareable creative recipe that chains
 * multiple tool calls with predefined parameters, typed input requirements,
 * and review gates. A `Run` is one persistent execution of a template with
 * its concrete inputs, stage history, artifacts, and runtime state.
 *
 * The shape is intentionally a superset of OpenMontage's pipeline_manifest
 * (stages, produces, requiredArtifactsIn, checkpointRequired, reviewFocus,
 * successCriteria, subStages, category, stability) so YAML export is
 * round-trip compatible where fields overlap. Promoted from the prototype
 * at sogni-chat:feature/workflows:src/workflows/types.ts and renamed
 * `WorkflowDefinition` → `WorkflowTemplate` per spec §12.
 *
 * **Tool name typing**: stage tool references are typed as `string` here
 * rather than a closed union. Static validators in
 * `src/agent/workflowTemplate.ts` check membership against
 * `BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES` (for `FixedStage.tool`) and the
 * broader hosted-app surface (for `InteractiveStage.allowedTools`). Keeping
 * the type loose lets the same template shape carry chat-only tool names
 * during the compile/save round-trip without forcing the workflow types to
 * depend on every product-side tool registry.
 */

// ---------------------------------------------------------------------------
// Workflow template (the reusable definition)
// ---------------------------------------------------------------------------

export type WorkflowCategory =
  | 'portrait'
  | 'video-social'
  | 'makeover'
  | 'cinematic'
  | 'music'
  | 'analysis'
  | 'custom'
  | 'other';

export type WorkflowStability = 'production' | 'beta' | 'experimental';

/**
 * Persistence visibility. Phase 2 ships `private` and `public` only; the
 * spec (§16.3) defers `team` to a later milestone but keeps the slot in
 * the type so producers don't break when teams arrive.
 */
export type WorkflowVisibility = 'private' | 'public';

export interface WorkflowAuthor {
  userId: string;
  displayName: string;
}

export type WorkflowInputType =
  | 'image'
  | 'audio'
  | 'video'
  | 'text'
  | 'number'
  | 'select'
  | 'boolean';

export interface WorkflowInput {
  name: string;
  type: WorkflowInputType;
  required: boolean;
  description: string;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  multiple?: { min: number; max: number };
  /**
   * Internal inputs are seeded automatically at Run creation and are not
   * rendered in the launcher UI or exposed as synthetic-tool params.
   */
  internal?: boolean;
  /**
   * OpenAI-compatible JSON schema fragment for this input. Used when the
   * workflow is exposed as a synthetic tool so the LLM can read/fill inputs
   * natively. Optional — derived from other fields if omitted.
   */
  jsonSchema?: Record<string, unknown>;
}

export interface WorkflowPreviewArtifact {
  stageId: string;
  label: string;
  mediaType: 'image' | 'video';
  url: string;
  posterUrl?: string;
}

/**
 * Visual-builder layout metadata for a template (spec §12). The runtime
 * never reads this — it exists so the graph view and form view in the
 * builder UI share one persisted document. Optional and forward-compatible
 * (additional fields may be added without breaking existing templates).
 */
export interface WorkflowGraphLayout {
  nodes: Array<{ stageId: string; x: number; y: number; collapsed?: boolean }>;
  edges?: Array<{ from: string; to: string; label?: string }>;
  viewport?: { x: number; y: number; zoom: number };
}

export interface WorkflowTemplate {
  id: string;
  version: string;
  name: string;
  description: string;
  /** The original LLM prompt or brief, when the template was generated. */
  brief?: string;

  category: WorkflowCategory;
  stability: WorkflowStability;
  author: 'system' | WorkflowAuthor;
  /** Defaults to `'private'` at create time; defer `'team'` per spec §16.3. */
  visibility: WorkflowVisibility;

  inputs: WorkflowInput[];
  stages: WorkflowStage[];

  reviewFocus?: string[];
  estimatedCredits?: { min: number; max: number };
  estimatedCapacityUnits?: { min: number; max: number };
  exposeToLLM: boolean;
  /** Lower number = higher priority for the synthetic-tool cap. Default 100. */
  llmPriority?: number;

  graph?: WorkflowGraphLayout;
  thumbnailUrl?: string;
  previewArtifacts?: WorkflowPreviewArtifact[];
  tags?: string[];
  metadata?: Record<string, unknown>;

  /** Set when imported from an OpenMontage pipeline_manifest. */
  openMontageImport?: {
    sourceSchema: string;
    importedAt: number;
    unmappedStages?: string[];
    unmappedTools?: string[];
  };

  createdAt: number | string;
  updatedAt: number | string;
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export type WorkflowStage = FixedStage | InteractiveStage | BatchStage;

/** Common fields on every stage, discriminated by `type`. */
export interface StageBase {
  id: string;
  label?: string;
  produces?: string[];
  requiredArtifactsIn?: string[];
  optionalArtifactsIn?: string[];
  reviewFocus?: string[];
  successCriteria?: string[];
  checkpointRequired?: boolean;
  humanApprovalDefault?: boolean;
  condition?: StageCondition;
  onError?: 'stop' | 'continue' | 'skip' | 'retry_once';
  /** Lightweight nested stages (OpenMontage sub_stages). */
  subStages?: WorkflowStage[];
}

export interface FixedStage extends StageBase {
  type: 'fixed';
  /**
   * Must be one of `BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES` at compile
   * time. Typed loosely as `string` so chat-only and future tool names
   * round-trip cleanly through persistence; the compiler / validator
   * surfaces membership violations as `ValidationIssue`s.
   */
  tool: string;
  /** Literal values or template strings (e.g. "$inputs.photo"). */
  args: Record<string, unknown>;
}

export interface InteractiveStage extends StageBase {
  type: 'interactive';
  /** Scoped system prompt injected for this stage's single chat turn. */
  systemPrompt: string;
  /**
   * Subset of tools the LLM can invoke during this stage. The executor
   * enforces this by filtering the tool list passed to the chat completion.
   * Empty array signals a UI-only stage that resolves via ResumeInput
   * rather than an LLM tool call.
   */
  allowedTools: string[];
  userMessage?: string;
  /** Informational only; OpenMontage skill path preserved on import. */
  skillRef?: string;
}

export interface BatchStage extends StageBase {
  type: 'batch';
  /** Binding that resolves to an array of items. */
  overBinding: string;
  /** Name by which each item is referenced as `$item.<itemName>`. */
  itemName: string;
  itemStage: FixedStage | InteractiveStage;
  concurrency?: number;
  partialExecutionEnabled: boolean;
  /** Template string for labeling items in UI (e.g. "Segment {index}"). */
  itemLabelTemplate?: string;
  /**
   * Max dispatch attempts per slot before the slot is treated as failed
   * (bounded automatic retry of transient failures). Must be ≥ 1. Defaults
   * to 2 when `onError` is `'retry_once'`, otherwise 1 (no auto-retry).
   * Orthogonal to `onError`, which governs propagation *after* the attempt
   * budget is exhausted (`stop` rethrows; `continue`/`skip` proceed to the
   * next slot for partial-success fan-out).
   */
  maxAttemptsPerItem?: number;
}

export interface StageCondition {
  type: 'always' | 'if_success_of' | 'if_error_in' | 'if_artifact_exists' | 'expr';
  stageId?: string;
  artifactName?: string;
  /** Tiny expression for `type: 'expr'`. Dot-path + ==/!=/&&/|| only. */
  expression?: string;
}

// ---------------------------------------------------------------------------
// Artifacts (stage outputs with version history)
// ---------------------------------------------------------------------------

export type ArtifactKind = 'image' | 'video' | 'audio' | 'model' | 'text' | 'structured';

export interface Artifact {
  name: string;
  kind: ArtifactKind;
  /** Always an array so single-output and many-output artifacts are uniform. */
  items: ArtifactItem[];
}

export interface ArtifactItem {
  id: string;
  label?: string;
  versions: ArtifactVersion[];
  /** Which version feeds downstream stages. */
  selectedVersionId: string;
  /** User-approved; excluded from "redo all". */
  locked?: boolean;
  /** Stage-specific metadata, e.g. `{azimuth, elevation, distance}`. */
  metadata?: Record<string, unknown>;

  // ─── Transient — stripped before persistence ────────────────────────
  status?: 'pending' | 'running' | 'ready' | 'failed';
  progress?: number;
  workerName?: string;
  error?: string;
}

export interface ArtifactVersion {
  id: string;
  createdAt: number;
  url?: string;
  content?: string;
  generatedBy: {
    stageId: string;
    tool: string;
    args: Record<string, unknown>;
  };
  cost?: { spark?: number; sogni?: number };
  thumbnailUrl?: string;
}

// ---------------------------------------------------------------------------
// Run (persistent execution instance)
// ---------------------------------------------------------------------------

export type RunState =
  | 'draft'
  | 'running'
  | 'awaiting_input'
  | 'awaiting_checkpoint'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface Run {
  id: string;
  workflowId: string;
  /**
   * Frozen copy of the template at Run creation time — protects the Run
   * from later edits to the workflow template.
   */
  workflowSnapshot: WorkflowTemplate;
  state: RunState;
  inputs: Record<string, unknown>;
  currentStageIndex: number;
  stages: StageExecution[];
  artifacts: Record<string, Artifact>;
  /** Link back to the chat Session that owns this Run, if any. */
  chatSessionId?: string;
  createdAt: number;
  updatedAt: number;
  totalCostCredits?: number;
  /**
   * Stages marked stale by a user action (edit input, redo an upstream
   * item, jump back). The executor re-runs these on the next resume.
   */
  staleStageIds: string[];
}

export type StageExecutionState =
  | 'pending'
  | 'running'
  | 'awaiting_checkpoint'
  | 'completed'
  | 'failed'
  | 'stale'
  | 'skipped';

export interface StageItemState {
  state: 'pending' | 'running' | 'ready' | 'failed';
  artifactItemId: string;
  error?: string;
}

export interface StageExecution {
  stageId: string;
  state: StageExecutionState;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  /** Per-item state for BatchStage, keyed by artifact item id. */
  itemStates?: Record<string, StageItemState>;
}

// ---------------------------------------------------------------------------
// Executor events & resume inputs
// ---------------------------------------------------------------------------

/**
 * Per-tool progress reporting; the chat product's `ToolExecutionProgress`
 * lives in `@/tools/types` and is not promoted here. The executor surfaces
 * progress as a plain JSON-serializable bag so consumers can attach any
 * tool-specific telemetry without bloating this shared module.
 */
export type ToolExecutionProgress = Record<string, unknown>;

export type ExecutorEvent =
  | { type: 'run_started'; run: Run }
  | { type: 'stage_started'; stageIndex: number; stage: WorkflowStage }
  | { type: 'stage_item_started'; stageIndex: number; itemId: string; index: number }
  | {
      type: 'stage_item_progress';
      stageIndex: number;
      itemId: string;
      progress: number;
      workerName?: string;
      toolProgress?: ToolExecutionProgress;
    }
  | {
      type: 'stage_item_completed';
      stageIndex: number;
      itemId: string;
      version: ArtifactVersion;
    }
  | { type: 'stage_item_failed'; stageIndex: number; itemId: string; error: string }
  | { type: 'stage_completed'; stageIndex: number }
  | { type: 'stage_awaiting_checkpoint'; stageIndex: number; reviewFocus?: string[] }
  | { type: 'stage_awaiting_interactive'; stageIndex: number; stage: InteractiveStage }
  | { type: 'run_completed'; run: Run }
  | { type: 'run_failed'; error: Error; run: Run }
  | { type: 'run_paused'; run: Run };

export type ResumeInput =
  | { type: 'approve_checkpoint' }
  | {
      type: 'redo_item';
      artifactName: string;
      itemId: string;
      overrideArgs?: Record<string, unknown>;
    }
  | {
      type: 'redo_stage';
      stageId: string;
      overrideArgs?: Record<string, unknown>;
    }
  | { type: 'lock_item'; artifactName: string; itemId: string; locked: boolean }
  | { type: 'select_version'; artifactName: string; itemId: string; versionId: string }
  | { type: 'jump_to_stage'; stageId: string }
  | {
      type: 'interactive_complete';
      stageId: string;
      /** Tool call JSON string, or structured content for UI-only stages. */
      result: string;
      producedArtifacts?: Record<string, Artifact>;
    }
  | { type: 'cancel' };

// ---------------------------------------------------------------------------
// Per-slot retry-callback primitive
// ---------------------------------------------------------------------------

/**
 * Lifecycle phase of a single batch/fixed-stage slot ("clip", "segment",
 * "pose", "view" — whatever the fan-out iterates over).
 *
 * `retrying` is emitted just before a bounded automatic re-dispatch.
 */
export type SlotEventPhase = 'started' | 'progress' | 'completed' | 'failed' | 'retrying';

/**
 * Out-of-band per-slot callback payload — the missing primitive that lets a
 * fan-out stage surface ~1s progress, per-slot retry, and parallel-slot
 * status back to the caller's progress reducer.
 *
 * Why a callback and not a generator event: a tool reports progress (via
 * `callbacks.onToolProgress`) *while the executor is awaiting
 * `dispatch.execute()`*. The async generator is suspended at that `await`,
 * not at a `yield`, so it physically cannot turn in-flight progress into a
 * yielded `ExecutorEvent` in real time — and with bounded concurrency, N
 * slots are in flight at once, which a single linear yield stream can't
 * represent cleanly. A side-channel callback registered up-front on
 * `ExecutorOptions.onSlotEvent` solves both.
 *
 * `toolProgress` is the tool's own progress payload, forwarded verbatim
 * (opaque to this shared module). Consumers (e.g. sogni-chat) map it onto
 * their concrete progress shape — they own that contract, not the executor.
 */
export interface SlotEvent<Progress = Record<string, unknown>> {
  phase: SlotEventPhase;
  /** Stage that owns the slot. */
  stageId: string;
  /** Flat index of the owning stage (matches `ExecutorEvent.stageIndex`). */
  stageIndex: number;
  /** Artifact item id for the slot, e.g. `"render/3"`. */
  itemId: string;
  /** Zero-based slot index within the fan-out (maps to a chat `jobIndex`). */
  index: number;
  /** 1-based attempt number for the current slot (incremented on retry). */
  attempt: number;
  /** Tool progress payload, forwarded verbatim. Present on `progress`. */
  toolProgress?: Progress;
  /** Produced version. Present on `completed`. */
  version?: ArtifactVersion;
  /** Failure message. Present on `failed` and `retrying`. */
  error?: string;
}

/** Caller-registered sink for {@link SlotEvent}s. */
export type SlotEventReporter<Progress = Record<string, unknown>> = (
  event: SlotEvent<Progress>,
) => void;

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  /** Path into the workflow for surfacing in the builder UI. */
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// Binding resolution context
// ---------------------------------------------------------------------------

/**
 * Context passed to `resolveBinding()`. The binding resolver reads from
 * this object to turn template strings like "$artifacts.foo.items[0].url"
 * into concrete values.
 */
export interface BindingContext {
  inputs: Record<string, unknown>;
  artifacts: Record<string, Artifact>;
  /** Present when resolving args inside a BatchStage's itemStage. */
  item?: Record<string, unknown> & { index: number };
  /** Active chat runtime state (uploaded files, etc.). */
  runtime?: {
    uploadedFiles?: Array<Record<string, unknown>>;
  };
  run?: {
    id: string;
    state: RunState;
  };
}
