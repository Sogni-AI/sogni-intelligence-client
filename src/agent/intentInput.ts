/**
 * IntentInput — packet read by the v2 IntentClassifier and Planner at the
 * top of every new user turn. Lives here as a public-safe TypeScript mirror
 * of `schemas/agent/intent-input.schema.json` in sogni-protocol-v2.
 *
 * Drift fix (audit 2026-05-20): pre-fix this file shipped a `userText` /
 * `active` / `artifacts` / `pendingActions[]` / `recentToolResults[]`
 * shape that disagreed with the JSON schema and with all three downstream
 * stub copies in `sogni-creative-agent-v2`, `sogni-chat`, and `sogni-api`.
 * The schema (and the consumer copies) use `currentMessage` (string),
 * `activeState` (with singular `pendingAction?` + `lastToolResult?`),
 * `artifactState` (with `selectedArtifactIds[]` + `artifactIds[]`), plus
 * `conversationSummary` and `availableCapabilitiesSummary`. This file now
 * matches that shape verbatim. The legacy shape is exported as
 * `LegacyIntentInputV0` for one release so any internal consumer of this
 * package can migrate without a churn cycle; new code MUST target
 * `IntentInput` directly.
 *
 * Sizing principle (Qwen3 256k context budget): keep artifacts and recent
 * turns WHOLE by default; trim only on measured budget pressure. The
 * `artifactIds`, `selectedArtifactIds`, and `recentTurns` arrays are
 * intentionally UNBOUNDED — they exist so the planner can reason over the
 * full lineage and conversation without having to re-fetch state.
 * Truncation is a downstream optimization, never a contract assumption.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7.
 */

/** Coarse media/asset kind the planner uses for routing. */
export type ArtifactType = 'image' | 'video' | 'audio' | 'model' | 'text' | 'workflow' | 'collection';

/**
 * Reference to the single pending action awaiting resolution at the time
 * the intent input is captured. Shape is intentionally opaque so producers
 * can carry runtime-specific context without expanding the schema. The
 * JSON schema mirrors this with `additionalProperties: true`.
 */
export interface IntentInputPendingActionRef {
  kind: string;
  toolName?: string;
  toolCallId?: string;
  workflowRunId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Reference to the most recent tool result the planner can consult. The
 * schema requires `toolName`, `toolCallId`, and `status`; this mirror
 * keeps `status` as `string` to match the schema's open enum (consumers
 * extend with their own status vocabulary).
 */
export interface IntentInputLastToolResultRef {
  toolName: string;
  toolCallId: string;
  status: string;
}

/**
 * Active turn state — what the run/session is currently doing. Populated
 * by the host (browser or cloud runner) from explicit runtime state. The
 * schema requires no individual fields, but every consumer populates the
 * struct itself — keep it required at the top level.
 */
export interface IntentInputActiveState {
  activeArtifactId?: string;
  activeArtifactType?: ArtifactType;
  pendingAction?: IntentInputPendingActionRef;
  awaitingConfirmation?: boolean;
  lastToolResult?: IntentInputLastToolResultRef;
  activeWorkflowRunId?: string;
}

/**
 * Artifact-graph snapshot. `selectedArtifactIds` and `artifactIds` are
 * required by the schema; both are UNBOUNDED by design. Optional `last*`
 * pointers reflect the runtime's "what just happened" focus.
 */
export interface IntentInputArtifactState {
  /** Artifacts the user or planner has explicitly focused. UNBOUNDED. */
  selectedArtifactIds: string[];
  /** All artifact ids the planner may reference. UNBOUNDED by design. */
  artifactIds: string[];
  lastGeneratedArtifactId?: string;
  lastEditedArtifactId?: string;
}

/**
 * One prior turn in chronological order. `'tool'` and `'system'` are
 * accepted so chat-v2 / api-v2 producers can include tool-result and
 * system-injection turns in the planner context without losing them to
 * lossy role-collapse at the schema boundary.
 */
export interface IntentInputRecentTurn {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  sequence: number;
}

/**
 * Surfaces a producer can run on. Promoted to the canonical union on
 * 2026-05-21 so chat-v2 and api-v2 can stop stubbing the type locally.
 *
 * - `'browser'` — in-process chat loop, browser runner.
 * - `'hosted_chat'` — synchronous `/v1/chat/completions` durable adapter.
 * - `'durable_chat'` — long-running cloud chat (`/v1/chat/runs`).
 * - `'workflow'` — workflow runner (template-driven).
 * - `'native'` — first-party native client (Sogni Studio app, etc.).
 * - `'skill'` — public skill runtime / third-party hosts.
 */
export type IntentInputSurface =
  | 'browser'
  | 'hosted_chat'
  | 'durable_chat'
  | 'workflow'
  | 'native'
  | 'skill';

/**
 * Structured form of the user's latest message. Optional alternate to
 * the primary `currentMessage: string` field — producers MAY emit either
 * form, but consumers MUST handle BOTH. `text` is required so the
 * planner can always derive the same string-level view.
 */
export interface IntentInputCurrentMessageDetails {
  /** Stable id for the message (e.g. IndexedDB row id). */
  id?: string;
  /** Source role. `'system'` covers synthetic message injection. */
  role?: 'user' | 'system';
  /** Text body. Must equal the top-level `currentMessage` when both are set. */
  text: string;
  /** ISO timestamp the message was created. */
  createdAt?: string;
  /**
   * BCP-47 locale hint surfaced by the host (e.g. `'en'`, `'ja-JP'`).
   * The planner uses this for language-aware tool selection without
   * having to keyword-classify the text.
   */
  localeHint?: string;
}

/**
 * Runtime feature flags the planner reads to decide tool surface and
 * confirmation policy. All fields are optional at the canonical type
 * level for backwards compat; chat-v2 stubs this as REQUIRED but the
 * canonical mirror stays permissive so legacy producers (browser
 * runner pre-2026-05-21) keep validating without changes.
 *
 * Promoted to canonical 2026-05-21 so consumers stop stubbing it
 * locally — see audit followup notes.
 */
export interface IntentInputRuntimeFlags {
  /** What surface the request originated from. */
  surface?: IntentInputSurface;
  /**
   * `true` when the host permits paid tools without an extra prompt
   * (e.g. user already approved with "stay in flow" toggle). Default
   * `false` when omitted.
   */
  allowPaidTools?: boolean;
  /**
   * `true` when the host permits tools that mutate persistent session
   * state (e.g. `update_persona`, `delete_artifact`). Default `false`.
   */
  allowMutatingTools?: boolean;
  /**
   * `true` when the request MUST be served by a durable cloud run
   * (offline reach, long-running pipeline, etc.). Forces the planner
   * into hosted-chat mode even when the browser path is available.
   */
  durableRequired?: boolean;
}

/**
 * Top-level IntentInput packet. Captured once per new user turn before any
 * tool surface is composed. Field names + required set match
 * `schemas/agent/intent-input.schema.json` 2026-05-20.1 verbatim.
 */
export interface IntentInput {
  /**
   * The user's latest text turn (already trimmed of tool-call markers).
   * This is the canonical primary form. When
   * {@link currentMessageDetails} is also set, `currentMessage` MUST
   * equal `currentMessageDetails.text` so any consumer that reads only
   * the string field still sees the right body.
   */
  currentMessage: string;
  /**
   * Optional structured form of {@link currentMessage}. Producers MAY
   * emit either; consumers MUST handle BOTH the bare string and this
   * structured form. Promoted from chat-v2 / api-v2 stubs to canonical
   * 2026-05-21 so the structured carriers (message id, role,
   * created-at, locale hint) flow through the planner without
   * lossy string-only round-trips.
   */
  currentMessageDetails?: IntentInputCurrentMessageDetails;
  activeState: IntentInputActiveState;
  artifactState: IntentInputArtifactState;
  /**
   * Conversation history. UNBOUNDED by design. Downstream code may
   * compact via `conversationSummary` when measured context pressure
   * demands it.
   */
  recentTurns: IntentInputRecentTurn[];
  /**
   * Rolling summary of the trimmed prefix. Empty string until the first
   * measured-budget-pressure trim event.
   */
  conversationSummary: string;
  /**
   * Short human-readable capability strings the planner can quote when
   * answering capability questions without invoking any tool.
   */
  availableCapabilitiesSummary: string[];
  /**
   * Free-form user preferences. Deliberate exception to the
   * `additionalProperties: false` rule — preferences evolve faster than
   * the schema, so the schema sets `additionalProperties: true` here.
   */
  userPreferences?: Record<string, unknown>;
  /**
   * Optional runtime feature flags. Chat-v2 treats this as REQUIRED on
   * its internal stub; canonical keeps it optional so legacy browser
   * producers keep validating during the cutover. Promoted to canonical
   * 2026-05-21.
   */
  runtimeFlags?: IntentInputRuntimeFlags;
}

/**
 * @deprecated Pre-2026-05-20 IntentInput shape. Retained for one release
 * so internal consumers can migrate without a churn cycle. New code MUST
 * target {@link IntentInput} directly. Will be removed in a future
 * minor version of `@sogni-ai/sogni-intelligence-client`.
 */
export interface LegacyIntentInputV0 {
  userText: string;
  recentTurns: IntentInputRecentTurn[];
  active: {
    activeRunId?: string;
    activeWorkflowRunId?: string;
    pendingActions: Array<{
      kind: string;
      toolName?: string;
      toolCallId?: string;
      workflowRunId?: string;
      payload?: Record<string, unknown>;
    }>;
    recentToolResults: Array<{
      toolCallId: string;
      toolName: string;
      status: 'ok' | 'err' | 'cancelled' | 'waiting_for_user';
      sequence?: number;
    }>;
  };
  artifacts: {
    artifactIds: string[];
    selectedArtifactId?: string;
    lastCreatedArtifactId?: string;
    byKind?: Partial<Record<ArtifactType, string[]>>;
  };
  locale?: string;
  correlationId?: string;
}

const ARTIFACT_TYPES: ReadonlySet<ArtifactType> = new Set([
  'image',
  'video',
  'audio',
  'text',
  'workflow',
  'collection',
  'model',
]);

const TURN_ROLES: ReadonlySet<IntentInputRecentTurn['role']> = new Set([
  'user',
  'assistant',
  'tool',
  'system',
]);

const INTENT_INPUT_SURFACES: ReadonlySet<IntentInputSurface> = new Set<IntentInputSurface>([
  'browser',
  'hosted_chat',
  'durable_chat',
  'workflow',
  'native',
  'skill',
]);

const CURRENT_MESSAGE_DETAILS_ROLES: ReadonlySet<'user' | 'system'> = new Set<'user' | 'system'>([
  'user',
  'system',
]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && ARTIFACT_TYPES.has(value as ArtifactType);
}

export function isIntentInputSurface(value: unknown): value is IntentInputSurface {
  return typeof value === 'string' && INTENT_INPUT_SURFACES.has(value as IntentInputSurface);
}

export function isIntentInputCurrentMessageDetails(
  value: unknown,
): value is IntentInputCurrentMessageDetails {
  if (!isRecord(value)) return false;
  if (typeof value.text !== 'string') return false;
  if (value.id !== undefined && typeof value.id !== 'string') return false;
  if (
    value.role !== undefined &&
    !(typeof value.role === 'string' && CURRENT_MESSAGE_DETAILS_ROLES.has(value.role as 'user' | 'system'))
  ) {
    return false;
  }
  if (value.createdAt !== undefined && typeof value.createdAt !== 'string') return false;
  if (value.localeHint !== undefined && typeof value.localeHint !== 'string') return false;
  return true;
}

export function isIntentInputRuntimeFlags(value: unknown): value is IntentInputRuntimeFlags {
  if (!isRecord(value)) return false;
  if (value.surface !== undefined && !isIntentInputSurface(value.surface)) return false;
  if (value.allowPaidTools !== undefined && typeof value.allowPaidTools !== 'boolean') return false;
  if (value.allowMutatingTools !== undefined && typeof value.allowMutatingTools !== 'boolean') return false;
  if (value.durableRequired !== undefined && typeof value.durableRequired !== 'boolean') return false;
  return true;
}

export function isIntentInputPendingActionRef(value: unknown): value is IntentInputPendingActionRef {
  if (!isRecord(value)) return false;
  if (typeof value.kind !== 'string') return false;
  if (value.toolName !== undefined && typeof value.toolName !== 'string') return false;
  if (value.toolCallId !== undefined && typeof value.toolCallId !== 'string') return false;
  if (value.workflowRunId !== undefined && typeof value.workflowRunId !== 'string') return false;
  if (value.payload !== undefined && !isRecord(value.payload)) return false;
  return true;
}

export function isIntentInputLastToolResultRef(
  value: unknown,
): value is IntentInputLastToolResultRef {
  if (!isRecord(value)) return false;
  if (typeof value.toolName !== 'string') return false;
  if (typeof value.toolCallId !== 'string') return false;
  if (typeof value.status !== 'string') return false;
  return true;
}

export function isIntentInputActiveState(value: unknown): value is IntentInputActiveState {
  if (!isRecord(value)) return false;
  if (value.activeArtifactId !== undefined && typeof value.activeArtifactId !== 'string') return false;
  if (value.activeArtifactType !== undefined && !isArtifactType(value.activeArtifactType)) return false;
  if (value.pendingAction !== undefined && !isIntentInputPendingActionRef(value.pendingAction)) {
    return false;
  }
  if (value.awaitingConfirmation !== undefined && typeof value.awaitingConfirmation !== 'boolean') {
    return false;
  }
  if (value.lastToolResult !== undefined && !isIntentInputLastToolResultRef(value.lastToolResult)) {
    return false;
  }
  if (value.activeWorkflowRunId !== undefined && typeof value.activeWorkflowRunId !== 'string') {
    return false;
  }
  return true;
}

export function isIntentInputArtifactState(value: unknown): value is IntentInputArtifactState {
  if (!isRecord(value)) return false;
  if (!isStringArray(value.selectedArtifactIds)) return false;
  if (!isStringArray(value.artifactIds)) return false;
  if (
    value.lastGeneratedArtifactId !== undefined &&
    typeof value.lastGeneratedArtifactId !== 'string'
  ) {
    return false;
  }
  if (value.lastEditedArtifactId !== undefined && typeof value.lastEditedArtifactId !== 'string') {
    return false;
  }
  return true;
}

export function isIntentInputRecentTurn(value: unknown): value is IntentInputRecentTurn {
  if (!isRecord(value)) return false;
  if (typeof value.role !== 'string' || !TURN_ROLES.has(value.role as IntentInputRecentTurn['role'])) return false;
  if (typeof value.content !== 'string') return false;
  if (typeof value.sequence !== 'number' || !Number.isFinite(value.sequence) || value.sequence < 0) {
    return false;
  }
  return true;
}

export function isIntentInput(value: unknown): value is IntentInput {
  if (!isRecord(value)) return false;
  if (typeof value.currentMessage !== 'string') return false;
  if (
    value.currentMessageDetails !== undefined &&
    !isIntentInputCurrentMessageDetails(value.currentMessageDetails)
  ) {
    return false;
  }
  if (!isIntentInputActiveState(value.activeState)) return false;
  if (!isIntentInputArtifactState(value.artifactState)) return false;
  if (!Array.isArray(value.recentTurns) || !value.recentTurns.every(isIntentInputRecentTurn)) {
    return false;
  }
  if (typeof value.conversationSummary !== 'string') return false;
  if (!isStringArray(value.availableCapabilitiesSummary)) return false;
  if (value.userPreferences !== undefined && !isRecord(value.userPreferences)) return false;
  if (value.runtimeFlags !== undefined && !isIntentInputRuntimeFlags(value.runtimeFlags)) {
    return false;
  }
  return true;
}

/**
 * One structured validation error. `path` is JSON-Pointer-ish rooted at
 * the validated value (`'/'` for the root, `/recentTurns/2/role` for a
 * nested field); `message` is a short reason.
 */
export interface IntentInputValidationError {
  path: string;
  message: string;
}

/** Result returned by every agent `validate*` helper. */
export interface IntentInputValidationResult {
  valid: boolean;
  errors: IntentInputValidationError[];
}

function pushError(errors: IntentInputValidationError[], path: string, message: string): void {
  errors.push({ path, message });
}

function validatePendingActionInternal(
  value: unknown,
  basePath: string,
  errors: IntentInputValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  if (typeof (value as { kind?: unknown }).kind !== 'string') {
    pushError(errors, `${basePath}/kind`, 'must be a string');
  }
  for (const key of ['toolName', 'toolCallId', 'workflowRunId'] as const) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined && typeof v !== 'string') {
      pushError(errors, `${basePath}/${key}`, 'must be a string when present');
    }
  }
  const payload = (value as { payload?: unknown }).payload;
  if (payload !== undefined && !isRecord(payload)) {
    pushError(errors, `${basePath}/payload`, 'must be an object when present');
  }
}

function validateLastToolResultInternal(
  value: unknown,
  basePath: string,
  errors: IntentInputValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  if (typeof (value as { toolName?: unknown }).toolName !== 'string') {
    pushError(errors, `${basePath}/toolName`, 'must be a string');
  }
  if (typeof (value as { toolCallId?: unknown }).toolCallId !== 'string') {
    pushError(errors, `${basePath}/toolCallId`, 'must be a string');
  }
  if (typeof (value as { status?: unknown }).status !== 'string') {
    pushError(errors, `${basePath}/status`, 'must be a string');
  }
}

function validateActiveStateInternal(
  value: unknown,
  basePath: string,
  errors: IntentInputValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  const activeArtifactId = (value as { activeArtifactId?: unknown }).activeArtifactId;
  if (activeArtifactId !== undefined && typeof activeArtifactId !== 'string') {
    pushError(errors, `${basePath}/activeArtifactId`, 'must be a string when present');
  }
  const activeArtifactType = (value as { activeArtifactType?: unknown }).activeArtifactType;
  if (activeArtifactType !== undefined && !isArtifactType(activeArtifactType)) {
    pushError(errors, `${basePath}/activeArtifactType`, 'must be a valid ArtifactType');
  }
  const pendingAction = (value as { pendingAction?: unknown }).pendingAction;
  if (pendingAction !== undefined) {
    validatePendingActionInternal(pendingAction, `${basePath}/pendingAction`, errors);
  }
  const awaiting = (value as { awaitingConfirmation?: unknown }).awaitingConfirmation;
  if (awaiting !== undefined && typeof awaiting !== 'boolean') {
    pushError(errors, `${basePath}/awaitingConfirmation`, 'must be a boolean when present');
  }
  const lastToolResult = (value as { lastToolResult?: unknown }).lastToolResult;
  if (lastToolResult !== undefined) {
    validateLastToolResultInternal(lastToolResult, `${basePath}/lastToolResult`, errors);
  }
  const activeWorkflowRunId = (value as { activeWorkflowRunId?: unknown }).activeWorkflowRunId;
  if (activeWorkflowRunId !== undefined && typeof activeWorkflowRunId !== 'string') {
    pushError(errors, `${basePath}/activeWorkflowRunId`, 'must be a string when present');
  }
}

function validateArtifactStateInternal(
  value: unknown,
  basePath: string,
  errors: IntentInputValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  const selected = (value as { selectedArtifactIds?: unknown }).selectedArtifactIds;
  if (!Array.isArray(selected)) {
    pushError(errors, `${basePath}/selectedArtifactIds`, 'must be an array');
  } else {
    selected.forEach((id, idx) => {
      if (typeof id !== 'string') {
        pushError(errors, `${basePath}/selectedArtifactIds/${idx}`, 'must be a string');
      }
    });
  }
  const all = (value as { artifactIds?: unknown }).artifactIds;
  if (!Array.isArray(all)) {
    pushError(errors, `${basePath}/artifactIds`, 'must be an array');
  } else {
    all.forEach((id, idx) => {
      if (typeof id !== 'string') {
        pushError(errors, `${basePath}/artifactIds/${idx}`, 'must be a string');
      }
    });
  }
  const lastGen = (value as { lastGeneratedArtifactId?: unknown }).lastGeneratedArtifactId;
  if (lastGen !== undefined && typeof lastGen !== 'string') {
    pushError(errors, `${basePath}/lastGeneratedArtifactId`, 'must be a string when present');
  }
  const lastEdit = (value as { lastEditedArtifactId?: unknown }).lastEditedArtifactId;
  if (lastEdit !== undefined && typeof lastEdit !== 'string') {
    pushError(errors, `${basePath}/lastEditedArtifactId`, 'must be a string when present');
  }
}

function validateRecentTurnInternal(
  value: unknown,
  basePath: string,
  errors: IntentInputValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  const role = (value as { role?: unknown }).role;
  if (typeof role !== 'string' || !TURN_ROLES.has(role as IntentInputRecentTurn['role'])) {
    pushError(errors, `${basePath}/role`, "must be 'user' | 'assistant' | 'tool' | 'system'");
  }
  if (typeof (value as { content?: unknown }).content !== 'string') {
    pushError(errors, `${basePath}/content`, 'must be a string');
  }
  const seq = (value as { sequence?: unknown }).sequence;
  if (typeof seq !== 'number' || !Number.isFinite(seq) || seq < 0) {
    pushError(errors, `${basePath}/sequence`, 'must be a non-negative finite number');
  }
}

function validateCurrentMessageDetailsInternal(
  value: unknown,
  basePath: string,
  errors: IntentInputValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  if (typeof (value as { text?: unknown }).text !== 'string') {
    pushError(errors, `${basePath}/text`, 'must be a string');
  }
  const id = (value as { id?: unknown }).id;
  if (id !== undefined && typeof id !== 'string') {
    pushError(errors, `${basePath}/id`, 'must be a string when present');
  }
  const role = (value as { role?: unknown }).role;
  if (
    role !== undefined &&
    !(typeof role === 'string' && CURRENT_MESSAGE_DETAILS_ROLES.has(role as 'user' | 'system'))
  ) {
    pushError(errors, `${basePath}/role`, "must be 'user' | 'system' when present");
  }
  const createdAt = (value as { createdAt?: unknown }).createdAt;
  if (createdAt !== undefined && typeof createdAt !== 'string') {
    pushError(errors, `${basePath}/createdAt`, 'must be a string when present');
  }
  const localeHint = (value as { localeHint?: unknown }).localeHint;
  if (localeHint !== undefined && typeof localeHint !== 'string') {
    pushError(errors, `${basePath}/localeHint`, 'must be a string when present');
  }
}

function validateRuntimeFlagsInternal(
  value: unknown,
  basePath: string,
  errors: IntentInputValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  const surface = (value as { surface?: unknown }).surface;
  if (surface !== undefined && !isIntentInputSurface(surface)) {
    pushError(errors, `${basePath}/surface`, 'must be a valid IntentInputSurface when present');
  }
  for (const key of ['allowPaidTools', 'allowMutatingTools', 'durableRequired'] as const) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined && typeof v !== 'boolean') {
      pushError(errors, `${basePath}/${key}`, 'must be a boolean when present');
    }
  }
}

/**
 * Walk an {@link IntentInput} and report each missing or wrong-typed
 * field as `{ path, message }`. Enforces the `currentMessage` ===
 * `currentMessageDetails.text` invariant when both are present (the
 * schema's MUST equal constraint).
 */
export function validateIntentInput(value: unknown): IntentInputValidationResult {
  const errors: IntentInputValidationError[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: [{ path: '/', message: 'must be an object' }] };
  }

  const currentMessage = (value as { currentMessage?: unknown }).currentMessage;
  if (typeof currentMessage !== 'string') {
    pushError(errors, '/currentMessage', 'must be a string');
  }

  const currentMessageDetails = (value as { currentMessageDetails?: unknown }).currentMessageDetails;
  if (currentMessageDetails !== undefined) {
    validateCurrentMessageDetailsInternal(
      currentMessageDetails,
      '/currentMessageDetails',
      errors,
    );
    if (
      typeof currentMessage === 'string' &&
      isRecord(currentMessageDetails) &&
      typeof (currentMessageDetails as { text?: unknown }).text === 'string' &&
      (currentMessageDetails as { text: string }).text !== currentMessage
    ) {
      pushError(
        errors,
        '/currentMessageDetails/text',
        'must equal /currentMessage when both are set',
      );
    }
  }

  const activeState = (value as { activeState?: unknown }).activeState;
  if (activeState === undefined) {
    pushError(errors, '/activeState', 'is required');
  } else {
    validateActiveStateInternal(activeState, '/activeState', errors);
  }

  const artifactState = (value as { artifactState?: unknown }).artifactState;
  if (artifactState === undefined) {
    pushError(errors, '/artifactState', 'is required');
  } else {
    validateArtifactStateInternal(artifactState, '/artifactState', errors);
  }

  const recentTurns = (value as { recentTurns?: unknown }).recentTurns;
  if (!Array.isArray(recentTurns)) {
    pushError(errors, '/recentTurns', 'must be an array');
  } else {
    recentTurns.forEach((turn, idx) =>
      validateRecentTurnInternal(turn, `/recentTurns/${idx}`, errors),
    );
  }

  if (typeof (value as { conversationSummary?: unknown }).conversationSummary !== 'string') {
    pushError(errors, '/conversationSummary', 'must be a string');
  }

  const capabilities = (value as { availableCapabilitiesSummary?: unknown }).availableCapabilitiesSummary;
  if (!Array.isArray(capabilities)) {
    pushError(errors, '/availableCapabilitiesSummary', 'must be an array');
  } else {
    capabilities.forEach((cap, idx) => {
      if (typeof cap !== 'string') {
        pushError(errors, `/availableCapabilitiesSummary/${idx}`, 'must be a string');
      }
    });
  }

  const userPreferences = (value as { userPreferences?: unknown }).userPreferences;
  if (userPreferences !== undefined && !isRecord(userPreferences)) {
    pushError(errors, '/userPreferences', 'must be an object when present');
  }

  const runtimeFlags = (value as { runtimeFlags?: unknown }).runtimeFlags;
  if (runtimeFlags !== undefined) {
    validateRuntimeFlagsInternal(runtimeFlags, '/runtimeFlags', errors);
  }

  return { valid: errors.length === 0, errors };
}
