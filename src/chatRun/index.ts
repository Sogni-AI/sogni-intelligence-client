/**
 * Durable hosted chat run contracts.
 *
 * A `ChatRun` owns the assistant conversation, LLM/tool loop state, and
 * the boundary between turns. It is the durable counterpart to a single
 * call into `chat.completions.create` (or `chat.hosted.create`): if the
 * caller disconnects, the API restarts, or a long-running tool sequence
 * spans many seconds, the run record survives and resumes.
 *
 * Distinct from `BackboneDurableWorkflowRunContract` — a workflow is an
 * explicit pre-planned step sequence (no LLM steering during execution);
 * a chat run owns the LLM dialog plus any tool subruns it dispatches.
 *
 * Each phase of the run loop is persisted so the executor can resume from
 * the last checkpoint after a worker crash. The state machine:
 *
 *   queued
 *     ↓
 *   running ⇄ waiting_for_user
 *     ↓
 *   completed / partial_failure / failed / cancelled
 *
 * Persistence checkpoints (one per phase):
 *   - normalized request stored on creation
 *   - assistant message stored on each LLM round
 *   - tool calls + results stored after each tool batch
 *   - media context + asset manifest snapshot updated alongside tool results
 *   - final response stored on completion (or waiting_for_user response)
 *
 * SSE replay is driven by `events[].sequence` so consumers can resume
 * mid-stream with `Last-Event-ID`.
 */

import type { BackboneVersionManifest } from '../contracts/backboneDurableWorkflow.js';
import type { CampaignStoryboard } from '../contracts/storyboard.js';

export const CHAT_RUN_SCHEMA_VERSION = '2026-05-14.1' as const;

export type ChatRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_user'
  | 'completed'
  | 'partial_failure'
  | 'failed'
  | 'cancelled';

/**
 * Reason a run is in `waiting_for_user`. Mirrors the chat-side stop
 * signals so resuming consumers can render the right UI.
 */
export type ChatRunWaitingReason =
  | 'ask_clarifying_question'
  | 'select_media_required'
  | 'cost_approval_required'
  | 'safety_review_required'
  | 'other';

/**
 * Identity scope for a durable chat run. Mirrors the workflow run shape so
 * the same persistence layer and lease/heartbeat helpers can serve both.
 */
export interface ChatRunOwnerScope {
  ownerWalletAddress: string;
  /** API-key fingerprint (HMAC). Raw key material must not appear here. */
  apiKeyFingerprint?: string;
  tokenType?: string;
  appSource?: string;
}

/**
 * Runtime configuration the client sends so the cloud executor matches the
 * host-app defaults (quality tier, content filter, etc.) when the LLM omits
 * those fields from a tool call. Mirrors the equivalent client-side
 * `ToolExecutionContext` fields.
 */
export interface ChatRunRuntimeConfig {
  /** Host-app quality tier. Drives image/edit/video default model picks. */
  qualityTier?: 'fast' | 'hq' | 'pro';
  /** Mirrors the host-app NSFW filter toggle. */
  safeContentFilter?: boolean;
  /**
   * Names of registered personas the user has saved. Surfaced so the
   * cloud executor can apply the persona-resolution gate that matches
   * the client (block `resolve_personas` when the user uploaded an
   * image and didn't name a persona or use self pronouns).
   */
  personaNames?: string[];
  /**
   * When true, the cloud executor pauses before each paid media tool
   * dispatch and emits a `run_awaiting_cost_confirmation` SSE event.
   * The caller must POST a decision to
   * `/v1/chat/runs/:id/confirm-cost` to resume. When omitted/false the
   * executor proceeds without prompting.
   */
  requireJobConfirmation?: boolean;
  /**
   * Threshold below which the cloud should NOT pause for confirmation
   * even when `requireJobConfirmation` is true. Matches the client's
   * `jobConfirmationThresholdUsd` preset.
   */
  jobConfirmationThresholdUsd?: number;
  /**
   * Approved-storyboard typed state rebuilt from the conversation by the
   * client (Managed Agent compatibility channel, KB decision D33). The
   * storyboard metadata marker is stripped from API-bound messages, so
   * without this typed state the hosted runtime cannot rebuild the approved
   * storyboard and continuations trip the typed
   * `missing_approved_storyboard_state` recovery. First-party clients
   * derive all three storyboard fields with creative-agent's
   * `buildManagedAgentCompatibilityRuntimeConfig` rather than by hand.
   * These fields previously rode the request loosely (untyped, silently
   * dropped on shape mismatch); typing them here is the C0 contract
   * promotion from the 2026-07-01 managed-agent state review.
   */
  campaignStoryboard?: CampaignStoryboard;
  /** Visible approved storyboard script text paired with the storyboard. */
  approvedStoryboardScript?: string;
  /**
   * Index of the already-rendered storyboard board image within the run's
   * generated-image results, when one exists. Session-scoped; the server
   * never derives or seeds this index across runs.
   */
  generatedStoryboardImageIndex?: number;
  /**
   * Host-app media model preferences (per-capability model pin map). The
   * executor treats unknown keys as inert; the shape is host-owned.
   */
  mediaModelPreferences?: Record<string, unknown>;
}

export interface ChatRunRequestSnapshot {
  /** Stable id for the originating chat session, if any. */
  sessionId?: string;
  /** Stable id for the originating chat message, if any. */
  clientMessageId?: string;
  /** Model id requested by the caller. */
  model?: string;
  /** Normalized messages (after sanitization, before LLM call). */
  messages: unknown[];
  /** Tool catalog visible to the LLM for this turn. */
  tools?: unknown[];
  /** Tool choice (`auto`, `none`, or specific tool). */
  toolChoice?: unknown;
  /** Sampling parameters captured on creation. */
  sampling?: Record<string, unknown>;
  /** Inbound media references attached to the request. */
  mediaReferences?: unknown[];
  /** Optional cost ceiling for this run. */
  maxEstimatedCapacityUnits?: number;
  /** Optional caller-supplied flag confirming higher-cost work. */
  confirmCost?: boolean;
  /** Caller-supplied idempotency key (deduplicated server-side). */
  idempotencyKey?: string;
  /**
   * Host-app runtime config (e.g. qualityTier) the cloud executor should
   * apply when LLM tool calls omit equivalent fields. Optional for back
   * compat — older callers pre-runtimeConfig still produce runs.
   */
  runtimeConfig?: ChatRunRuntimeConfig;
}

export interface ChatRunToolCall {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  sequence: number;
}

export interface ChatRunToolResultRef {
  toolCallId: string;
  /** Canonical envelope status. Tools must emit `ToolResult` envelopes. */
  status: 'ok' | 'err' | 'cancelled' | 'waiting_for_user';
  /** Opaque content envelope or summary; consumers fetch artifacts separately. */
  summary?: string;
  /** Optional billing preview accumulated by this result. */
  billingPreview?: unknown;
  /** Optional canonical error code (`PARAMETER_INVALID`, etc.). */
  errorCode?: string;
  sequence: number;
}

export interface ChatRunMediaContextSnapshot {
  images: string[];
  videos: string[];
  audio: string[];
  uploadedImages?: string[];
  uploadedVideos?: string[];
  uploadedAudio?: string[];
}

export interface ChatRunFinalResponse {
  /** Final assistant content. May be empty when only tool calls were emitted. */
  content?: string;
  /** Any pending follow-up tool calls left for the next turn. */
  pendingToolCalls?: ChatRunToolCall[];
  /** Reason this run is finished or waiting. */
  finishReason?:
    | 'stop'
    | 'tool_calls'
    | 'length'
    | 'safety'
    | 'cancelled'
    | 'partial_failure'
    | 'waiting_for_user';
}

export interface ChatRunWaitingState {
  reason: ChatRunWaitingReason;
  /** Assistant question or instruction surfaced to the caller. */
  message?: string;
  /** Optional structured prompts (e.g. selection options). */
  details?: Record<string, unknown>;
}

/**
 * Payload for `run_awaiting_cost_confirmation` events. Emitted by the
 * cloud executor before dispatching a paid media tool when the run was
 * submitted with `runtimeConfig.requireJobConfirmation`. The run is
 * paused (`status: waiting_for_user`, `waitingReason:
 * cost_approval_required`) until the caller responds via the
 * `POST /v1/chat/runs/:id/confirm-cost` endpoint.
 */
export interface ChatRunCostConfirmationDetails {
  /** Tool call id the cost applies to. */
  toolCallId: string;
  /** Tool that will run if approved (`generate_image`, etc.). */
  toolName: string;
  /** Concrete model the executor resolved (e.g. "z-turbo"). */
  modelKey?: string;
  /** Human-readable model name (e.g. "Z-Image Turbo"). */
  modelDisplayName?: string;
  /** Cost in the run's `tokenType` (spark / sogni capacity units). */
  estimatedCost: number;
  /** Token type the cost is denominated in (matches the run's billing scope). */
  tokenType?: 'sogni' | 'spark';
  /** Optional USD estimate to surface to the user. */
  estimatedUsdCost?: number;
  /** Optional one-line summary the executor wants the UI to render. */
  summary?: string;
  /** Tool args snapshot so the client modal can show prompt / dimensions / model. */
  toolArgs?: Record<string, unknown>;
}

/**
 * Decision the caller sends back to resume a cost-approval pause. The
 * cloud reads this from the matching confirm-cost endpoint and either
 * dispatches the tool (confirm) or short-circuits with a cancelled
 * tool result (cancel).
 */
export interface ChatRunCostConfirmationDecision {
  toolCallId: string;
  decision: 'confirm' | 'cancel';
  /** Optional override args the user adjusted in the popup (e.g. different quality tier). */
  overrides?: Record<string, unknown>;
  /** Optional human-readable reason carried back in audit logs. */
  reason?: string;
}

export interface ChatRunEvent {
  sequence: number;
  type:
    | 'run_created'
    | 'run_resumed'
    | 'llm_round_started'
    | 'assistant_message_delta'
    | 'assistant_message_completed'
    | 'tool_call_dispatched'
    | 'tool_call_progress'
    | 'tool_call_resolved'
    | 'media_context_updated'
    | 'media_turn_intent_classified'
    | 'asset_manifest_updated'
    | 'billing_preview_updated'
    | 'run_waiting_for_user'
    | 'run_awaiting_cost_confirmation'
    | 'run_cost_confirmation_resolved'
    | 'run_completed'
    | 'run_failed'
    | 'run_partial_failure'
    | 'run_cancelled';
  at: string;
  payload?: Record<string, unknown>;
}

export interface ChatRunArtifactRef {
  /** Canonical artifact id (creative workflow artifact or chat-local id). */
  id: string;
  /** Source workflow run id when artifact originated from a workflow subrun. */
  workflowId?: string;
  /** Step id when artifact originated from a workflow step. */
  stepId?: string;
  /** Final asset URL/data-uri when available. */
  url?: string;
  /** Media type for routing UIs. */
  mediaType?: 'image' | 'video' | 'audio' | 'model';
  /** Optional partial-failure metadata so paid artifacts remain visible. */
  partial?: boolean;
  /**
   * Model key the executor dispatched (e.g. "z-turbo", "gpt-image-2").
   * Populated for media tools that resolve a concrete model.
   */
  modelKey?: string;
  /** Human-readable display name (e.g. "Z-Image Turbo"). */
  modelDisplayName?: string;
  /** Name of the tool that produced this artifact (e.g. "generate_image"). */
  toolName?: string;
}

export interface ChatRunMediaItem {
  url: string;
  mediaType: NonNullable<ChatRunArtifactRef['mediaType']>;
  /** Model key the executor dispatched (e.g. "z-turbo"). */
  modelKey?: string;
  /** Display name for the model (e.g. "Z-Image Turbo"). */
  modelDisplayName?: string;
  /** Tool that produced this media (e.g. "generate_image"). */
  toolName?: string;
}

export function isChatRunMediaType(value: unknown): value is ChatRunMediaItem['mediaType'] {
  return value === 'image' || value === 'video' || value === 'audio';
}

export interface DurableMediaViolation {
  path: string;
  reason: 'inline_data_url' | 'inline_data_uri_field' | 'non_external_url';
}

export interface DurableMediaReferenceInput {
  messages?: unknown;
  mediaReferences?: unknown;
  mediaContext?: unknown;
  artifacts?: unknown;
  mediaUrls?: unknown;
}

const EXTERNAL_DURABLE_MEDIA_URL_PATTERN = /^https?:\/\//i;
const INLINE_DURABLE_MEDIA_URL_PATTERN = /^data:/i;
const MEDIA_CONTEXT_URL_FIELDS = [
  'images',
  'videos',
  'audio',
  'uploadedImages',
  'uploadedVideos',
  'uploadedAudio',
] as const;

export function isDurableExternalMediaUrl(value: unknown): value is string {
  return typeof value === 'string' && EXTERNAL_DURABLE_MEDIA_URL_PATTERN.test(value.trim());
}

export function isInlineDurableMediaUrl(value: unknown): boolean {
  return typeof value === 'string' && INLINE_DURABLE_MEDIA_URL_PATTERN.test(value.trim());
}

function durableMediaUrlViolation(path: string, value: unknown): DurableMediaViolation | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (INLINE_DURABLE_MEDIA_URL_PATTERN.test(trimmed)) {
    return { path, reason: 'inline_data_url' };
  }
  if (!EXTERNAL_DURABLE_MEDIA_URL_PATTERN.test(trimmed)) {
    return { path, reason: 'non_external_url' };
  }
  return null;
}

function collectMessageMediaViolations(messages: unknown, violations: DurableMediaViolation[]): void {
  if (!Array.isArray(messages)) return;
  messages.forEach((message, messageIndex) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) return;
    content.forEach((part, partIndex) => {
      if (!part || typeof part !== 'object' || Array.isArray(part)) return;
      if ((part as { type?: unknown }).type !== 'image_url') return;
      const imageUrl = (part as { image_url?: unknown }).image_url;
      if (!imageUrl || typeof imageUrl !== 'object' || Array.isArray(imageUrl)) return;
      const violation = durableMediaUrlViolation(
        `messages[${messageIndex}].content[${partIndex}].image_url.url`,
        (imageUrl as { url?: unknown }).url,
      );
      if (violation) violations.push(violation);
    });
  });
}

function collectMediaReferenceViolations(
  mediaReferences: unknown,
  violations: DurableMediaViolation[],
): void {
  if (!Array.isArray(mediaReferences)) return;
  mediaReferences.forEach((reference, index) => {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return;
    const record = reference as { url?: unknown; dataUri?: unknown; data_uri?: unknown };
    const urlViolation = durableMediaUrlViolation(`mediaReferences[${index}].url`, record.url);
    if (urlViolation) violations.push(urlViolation);
    if (typeof record.dataUri === 'string' && record.dataUri.trim()) {
      violations.push({
        path: `mediaReferences[${index}].dataUri`,
        reason: 'inline_data_uri_field',
      });
    }
    if (typeof record.data_uri === 'string' && record.data_uri.trim()) {
      violations.push({
        path: `mediaReferences[${index}].data_uri`,
        reason: 'inline_data_uri_field',
      });
    }
  });
}

function collectMediaContextViolations(mediaContext: unknown, violations: DurableMediaViolation[]): void {
  if (!mediaContext || typeof mediaContext !== 'object' || Array.isArray(mediaContext)) return;
  const record = mediaContext as Partial<Record<(typeof MEDIA_CONTEXT_URL_FIELDS)[number], unknown>>;
  for (const field of MEDIA_CONTEXT_URL_FIELDS) {
    const values = record[field];
    if (!Array.isArray(values)) continue;
    values.forEach((value, index) => {
      const violation = durableMediaUrlViolation(`mediaContext.${field}[${index}]`, value);
      if (violation) violations.push(violation);
    });
  }
}

function collectArtifactLikeViolations(
  values: unknown,
  label: 'artifacts' | 'mediaUrls',
  violations: DurableMediaViolation[],
): void {
  if (!Array.isArray(values)) return;
  values.forEach((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const violation = durableMediaUrlViolation(
      `${label}[${index}].url`,
      (value as { url?: unknown }).url,
    );
    if (violation) violations.push(violation);
  });
}

export function collectDurableMediaViolations(
  input: DurableMediaReferenceInput,
): DurableMediaViolation[] {
  const violations: DurableMediaViolation[] = [];
  collectMessageMediaViolations(input.messages, violations);
  collectMediaReferenceViolations(input.mediaReferences, violations);
  collectMediaContextViolations(input.mediaContext, violations);
  collectArtifactLikeViolations(input.artifacts, 'artifacts', violations);
  collectArtifactLikeViolations(input.mediaUrls, 'mediaUrls', violations);
  return violations;
}

export function assertDurableMediaIsExternal(
  input: DurableMediaReferenceInput,
  label = 'Durable media',
): void {
  const violations = collectDurableMediaViolations(input);
  if (violations.length === 0) return;
  const paths = violations.map((violation) => violation.path).join(', ');
  throw new Error(
    `${label} does not support inline base64/data URI media. Upload media first and pass HTTP(S) URLs instead. Offending field(s): ${paths}`,
  );
}

function uniqueChatRunMedia(items: ChatRunMediaItem[]): ChatRunMediaItem[] {
  const seen = new Set<string>();
  const result: ChatRunMediaItem[] = [];
  for (const item of items) {
    const key = `${item.mediaType}:${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function buildChatRunMediaItem(
  url: string,
  mediaType: ChatRunMediaItem['mediaType'],
  source: { modelKey?: unknown; modelDisplayName?: unknown; toolName?: unknown },
): ChatRunMediaItem {
  const modelKey = optionalString(source.modelKey);
  const modelDisplayName = optionalString(source.modelDisplayName);
  const toolName = optionalString(source.toolName);
  return {
    url,
    mediaType,
    ...(modelKey ? { modelKey } : {}),
    ...(modelDisplayName ? { modelDisplayName } : {}),
    ...(toolName ? { toolName } : {}),
  };
}

/**
 * Extract renderable media from durable chat-run event payloads. The
 * supported producer shapes are the canonical chat-run fields:
 * `mediaUrls: [{ url, mediaType, modelKey?, modelDisplayName?, toolName? }]`
 * emitted by tool progress/resolution events and
 * `artifacts: ChatRunArtifactRef[]` emitted by resolution events. Unknown
 * fields are ignored.
 */
export function extractChatRunMediaFromEventPayload(
  payload: Record<string, unknown> | undefined,
): ChatRunMediaItem[] {
  const items: ChatRunMediaItem[] = [];
  const payloadToolName = optionalString(payload?.toolName);
  const payloadModelKey = optionalString(payload?.modelKey);
  const payloadModelDisplayName = optionalString(payload?.modelDisplayName);
  const mediaUrls = Array.isArray(payload?.mediaUrls) ? payload.mediaUrls : [];
  for (const media of mediaUrls) {
    if (!media || typeof media !== 'object') continue;
    const entry = media as {
      url?: unknown;
      mediaType?: unknown;
      modelKey?: unknown;
      modelDisplayName?: unknown;
      toolName?: unknown;
    };
    if (isDurableExternalMediaUrl(entry.url) && isChatRunMediaType(entry.mediaType)) {
      items.push(buildChatRunMediaItem(entry.url.trim(), entry.mediaType, {
        modelKey: entry.modelKey ?? payloadModelKey,
        modelDisplayName: entry.modelDisplayName ?? payloadModelDisplayName,
        toolName: entry.toolName ?? payloadToolName,
      }));
    }
  }
  const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact !== 'object') continue;
    const entry = artifact as {
      url?: unknown;
      mediaType?: unknown;
      modelKey?: unknown;
      modelDisplayName?: unknown;
      toolName?: unknown;
    };
    if (isDurableExternalMediaUrl(entry.url) && isChatRunMediaType(entry.mediaType)) {
      items.push(buildChatRunMediaItem(entry.url.trim(), entry.mediaType, {
        modelKey: entry.modelKey ?? payloadModelKey,
        modelDisplayName: entry.modelDisplayName ?? payloadModelDisplayName,
        toolName: entry.toolName ?? payloadToolName,
      }));
    }
  }
  return uniqueChatRunMedia(items);
}

/**
 * Typed view of a `tool_call_progress.payload` after defensive
 * narrowing. Consumers (sogni-chat, sogni-creative-agent-skill, future
 * dashboard tooling) call this instead of reinventing the `typeof x ===
 * 'number' && Number.isFinite(x)` checks per call site.
 *
 * Fields are all optional because the same event type is reused for
 * both project-level overall progress ticks (`progress` + `status`) and
 * per-job ticks (`jobIndex` + per-job fields fanned out from the SDK's
 * `sogni.projects.on('job', …)` event bus). Discriminate by checking
 * `jobIndex !== undefined`.
 */
export interface ToolCallProgressUpdate {
  /** Tool call this update belongs to. */
  toolCallId?: string;
  /** Project-level overall progress (0-1). Present on overall ticks. */
  progress?: number;
  /** Project status string (`queued`, `processing`, etc.). */
  status?: string;
  /**
   * Aggregate per-tool ETA seconds (matched to whichever job last
   * surfaced an ETA when not all jobs have one). Drives the floating
   * countdown / chip ETA.
   */
  etaSeconds?: number;
  /** Sub-step label shown alongside the chip (e.g. "Analyzing image…"). */
  stepLabel?: string;
  /** Per-job label (e.g. "Clip 3 of 9"). */
  jobLabel?: string;
  /** Per-job index when this is a job-level tick. */
  jobIndex?: number;
  /** Per-job progress fraction (0-1). */
  jobProgress?: number;
  /**
   * Per-job ETA seconds. Sogni-socket emits a `jobETA` once per second
   * for external-API jobs (GPT, Seedance) and during the worker-boot
   * window — primary driver of the per-slot countdown.
   */
  jobEtaSeconds?: number;
  /** Per-job partial result URL when the job has resolved. */
  resultUrl?: string;
  /** True when `resultUrl` points at a video artifact. */
  isVideoResult?: boolean;
  /** Per-job error message when the SDK surfaced a `JobError`. */
  jobError?: string;
  /**
   * Final `mediaUrls` array attached to the terminal-progress tick by
   * the round adapter. Use `extractChatRunMediaFromEventPayload` to
   * extract typed `ChatRunMediaItem[]`; this raw form is preserved here
   * for callers that want the unparsed payload field.
   */
  mediaUrls?: unknown[];
}

/**
 * Narrow a `tool_call_progress` SSE event payload into the typed
 * `ToolCallProgressUpdate` shape. Drops fields that fail their type
 * check; never throws. Safe to call on event payloads from any
 * sogni-api build — fields that aren't present (because the server
 * isn't enriched yet) come back as `undefined`.
 */
export function extractToolCallProgressUpdate(
  payload: Record<string, unknown> | undefined,
): ToolCallProgressUpdate {
  if (!payload) return {};
  const result: ToolCallProgressUpdate = {};
  const toolCallId = optionalString(payload.toolCallId);
  if (toolCallId !== undefined) result.toolCallId = toolCallId;
  if (typeof payload.progress === 'number' && Number.isFinite(payload.progress)) {
    result.progress = payload.progress;
  }
  const status = optionalString(payload.status);
  if (status !== undefined) result.status = status;
  if (typeof payload.etaSeconds === 'number' && Number.isFinite(payload.etaSeconds)) {
    result.etaSeconds = payload.etaSeconds;
  }
  const stepLabel = optionalString(payload.stepLabel);
  if (stepLabel !== undefined) result.stepLabel = stepLabel;
  const jobLabel = optionalString(payload.jobLabel);
  if (jobLabel !== undefined) result.jobLabel = jobLabel;
  if (typeof payload.jobIndex === 'number' && Number.isFinite(payload.jobIndex)) {
    result.jobIndex = payload.jobIndex;
  }
  if (typeof payload.jobProgress === 'number' && Number.isFinite(payload.jobProgress)) {
    result.jobProgress = payload.jobProgress;
  }
  if (typeof payload.jobEtaSeconds === 'number' && Number.isFinite(payload.jobEtaSeconds)) {
    result.jobEtaSeconds = payload.jobEtaSeconds;
  }
  const resultUrl = optionalString(payload.resultUrl);
  if (resultUrl !== undefined) result.resultUrl = resultUrl;
  if (typeof payload.isVideoResult === 'boolean') {
    result.isVideoResult = payload.isVideoResult;
  }
  const jobError = optionalString(payload.jobError);
  if (jobError !== undefined) result.jobError = jobError;
  if (Array.isArray(payload.mediaUrls)) {
    result.mediaUrls = payload.mediaUrls;
  }
  return result;
}

/**
 * Extract renderable media from a durable chat-run snapshot. Kept
 * structural so SDK records and persistence records can both use it.
 */
export function extractChatRunMediaFromRecord(record: { artifacts?: unknown }): ChatRunMediaItem[] {
  const artifacts = Array.isArray(record.artifacts) ? record.artifacts : [];
  return uniqueChatRunMedia(
    artifacts.flatMap((artifact) => {
      if (!artifact || typeof artifact !== 'object') return [];
      const entry = artifact as {
        url?: unknown;
        mediaType?: unknown;
        modelKey?: unknown;
        modelDisplayName?: unknown;
        toolName?: unknown;
      };
      return isDurableExternalMediaUrl(entry.url) && isChatRunMediaType(entry.mediaType)
        ? [
            buildChatRunMediaItem(entry.url.trim(), entry.mediaType, {
              modelKey: entry.modelKey,
              modelDisplayName: entry.modelDisplayName,
              toolName: entry.toolName,
            }),
          ]
        : [];
    }),
  );
}

/**
 * Normalize creative workflow artifact references and fallback media URL
 * rows into the durable chat-run artifact shape. This is intentionally
 * producer-specific: it only accepts the canonical creative workflow
 * artifact `kind` field and the canonical hosted tool `mediaUrls`
 * `{ url, mediaType }` rows.
 */
export function buildChatRunArtifactRefs(input: {
  toolCallId: string;
  artifacts?: Array<{ id?: unknown; kind?: unknown; url?: unknown }>;
  mediaUrls?: Array<{ url?: unknown; mediaType?: unknown }>;
  workflowId?: string;
  stepId?: string;
  partial?: boolean;
}): ChatRunArtifactRef[] {
  if (input.artifacts?.length) {
    return input.artifacts
      .map((artifact): ChatRunArtifactRef | null => {
        const mediaType = isChatRunMediaType(artifact.kind) ? artifact.kind : undefined;
        if (typeof artifact.id !== 'string') return null;
        const url = isDurableExternalMediaUrl(artifact.url) ? artifact.url.trim() : undefined;
        if (!mediaType && !url) return null;
        return {
          id: artifact.id,
          ...(input.workflowId ? { workflowId: input.workflowId } : {}),
          ...(input.stepId ? { stepId: input.stepId } : {}),
          ...(url ? { url } : {}),
          ...(mediaType ? { mediaType } : {}),
          ...(input.partial ? { partial: true } : {}),
        };
      })
      .filter((artifact): artifact is ChatRunArtifactRef => artifact !== null);
  }

  return (input.mediaUrls ?? [])
    .map((media, index): ChatRunArtifactRef | null => {
      if (!isDurableExternalMediaUrl(media.url) || !isChatRunMediaType(media.mediaType)) return null;
      return {
        id: `art_${input.toolCallId}_${index + 1}`,
        url: media.url.trim(),
        mediaType: media.mediaType,
        ...(input.workflowId ? { workflowId: input.workflowId } : {}),
        ...(input.stepId ? { stepId: input.stepId } : {}),
        ...(input.partial ? { partial: true } : {}),
      };
    })
    .filter((artifact): artifact is ChatRunArtifactRef => artifact !== null);
}

export interface ChatRunLeaseState {
  leaseId: string;
  ownerId: string;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
}

export interface ChatRunRecoveryState {
  resumeCount: number;
  lastResumeAt?: string;
  lastRecoveredAt?: string;
  reason?: string;
}

export interface ChatRunQualityState {
  postflightAudits?: unknown[];
}

export interface ChatRunRecordContract {
  /** Stable id for this run; clients use this to read/cancel/stream. */
  runId: string;
  status: ChatRunStatus;
  schemaVersion: typeof CHAT_RUN_SCHEMA_VERSION;
  backbone: BackboneVersionManifest;
  scope: ChatRunOwnerScope;
  request: ChatRunRequestSnapshot;

  /** All assistant + tool messages accumulated across rounds. */
  messages: unknown[];

  /** Tool calls dispatched this turn (in dispatch order). */
  toolCalls: ChatRunToolCall[];

  /** Tool results matching tool calls (in resolve order). */
  toolResults: ChatRunToolResultRef[];

  /** Latest media context snapshot (mutates across tool rounds). */
  mediaContext: ChatRunMediaContextSnapshot;

  /** Latest asset manifest snapshot. Opaque structure preserved by executor. */
  assetManifest?: unknown;

  /** Workflow runs spawned during this chat run (for partial-artifact reads). */
  childWorkflowIds: string[];

  /** Latest billing preview. Final on `completed`/`partial_failure`. */
  billingPreview?: unknown;

  /** Cumulative billing previews for multi-tool turns. */
  billingPreviews: unknown[];

  /** Resolved artifacts surfaced to the caller. */
  artifacts: ChatRunArtifactRef[];

  /** Final assistant response when status is terminal. */
  finalResponse?: ChatRunFinalResponse;

  /** Detail block when status is `waiting_for_user`. */
  waiting?: ChatRunWaitingState;

  /** Append-only event log (SSE replay source). */
  events: ChatRunEvent[];

  /** Active executor lease (durable resume / cancellation). */
  lease?: ChatRunLeaseState;

  /** Recovery metadata for crash/resume worker. */
  recovery?: ChatRunRecoveryState;

  /** Postflight quality audits applied at terminal status. */
  quality?: ChatRunQualityState;

  /** Last error message when status is `failed`. */
  failureReason?: string;

  /** Cancellation context when status is `cancelled`. */
  cancellationReason?: string;

  timestamps: {
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
  };
}

export interface ChatRunInput {
  request: ChatRunRequestSnapshot;
  scope: ChatRunOwnerScope;
  title?: string;
}

/**
 * Build a fresh chat run record from an inbound request. Use on
 * `POST /v1/chat/runs` and on durable submit from `sogni-chat`.
 */
export function buildChatRunRecord(
  input: ChatRunInput,
  options: {
    runId: string;
    now?: string;
    backbone: BackboneVersionManifest;
  },
): ChatRunRecordContract {
  const now = options.now ?? new Date().toISOString();
  return {
    runId: options.runId,
    status: 'queued',
    schemaVersion: CHAT_RUN_SCHEMA_VERSION,
    backbone: options.backbone,
    scope: { ...input.scope },
    request: { ...input.request },
    messages: [],
    toolCalls: [],
    toolResults: [],
    mediaContext: {
      images: [],
      videos: [],
      audio: [],
      uploadedImages: [],
      uploadedVideos: [],
      uploadedAudio: [],
    },
    childWorkflowIds: [],
    billingPreviews: [],
    artifacts: [],
    events: [
      {
        sequence: 0,
        type: 'run_created',
        at: now,
      },
    ],
    timestamps: {
      createdAt: now,
      updatedAt: now,
    },
  };
}

/**
 * Mark a run as resumed by the recovery worker (or manual resume call).
 * Mutates in place. Bumps the recovery counter, sets the resume timestamp,
 * and appends a `run_resumed` event so SSE replay can show the boundary.
 *
 * `lastResumeAt` records when this resume *started*. `lastRecoveredAt` is
 * deliberately left unchanged here and should be written by the executor
 * when the resumed run successfully reaches a terminal status (or the
 * next `waiting_for_user` boundary), so it answers "when did recovery
 * last fully succeed for this run?".
 *
 * This helper is the canonical in-memory mutation contract. The sogni-api
 * production path doesn't call it directly — Mongo can't take a mutated JS
 * object across the lease boundary safely. Production uses an equivalent
 * atomic `findOneAndUpdate` (`acquireLease` with `recoveryReason`) that
 * `$inc`s `recovery.resumeCount` and `$set`s `recovery.lastResumeAt` /
 * `recovery.reason`, then appends the `run_resumed` event via
 * `ChatRunModel.appendEvent`. Both paths converge on identical semantics;
 * tests against this helper define the contract that production must match.
 */
export function recordChatRunResume(
  record: ChatRunRecordContract,
  options: { reason: string; now?: string } = { reason: 'recovery' },
): ChatRunRecordContract {
  const now = options.now ?? new Date().toISOString();
  const nextSequence = nextEventSequence(record);
  record.recovery = {
    resumeCount: (record.recovery?.resumeCount ?? 0) + 1,
    lastResumeAt: now,
    lastRecoveredAt: record.recovery?.lastRecoveredAt,
    reason: options.reason,
  };
  record.events.push({
    sequence: nextSequence,
    type: 'run_resumed',
    at: now,
    payload: { reason: options.reason },
  });
  record.timestamps.updatedAt = now;
  return record;
}

/**
 * Append a chat run event in a SSE-replayable order. Callers must reuse
 * this helper so event sequences stay monotonic.
 */
export function appendChatRunEvent(
  record: ChatRunRecordContract,
  event: Omit<ChatRunEvent, 'sequence'>,
): ChatRunEvent {
  const next: ChatRunEvent = {
    ...event,
    sequence: nextEventSequence(record),
  };
  record.events.push(next);
  record.timestamps.updatedAt = next.at;
  return next;
}

export function nextEventSequence(record: ChatRunRecordContract): number {
  if (record.events.length === 0) return 0;
  const last = record.events[record.events.length - 1];
  return last.sequence + 1;
}

/**
 * Return events after a given sequence id, for SSE `Last-Event-ID` replay.
 */
export function chatRunEventsAfter(
  record: ChatRunRecordContract,
  lastSequence: number | undefined,
): ChatRunEvent[] {
  if (lastSequence === undefined || lastSequence < 0) return record.events.slice();
  return record.events.filter((event) => event.sequence > lastSequence);
}

const TERMINAL_STATUSES: ReadonlySet<ChatRunStatus> = new Set([
  'completed',
  'partial_failure',
  'failed',
  'cancelled',
]);

export function isChatRunTerminal(status: ChatRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isChatRunWaiting(status: ChatRunStatus): boolean {
  return status === 'waiting_for_user';
}

export function isChatRunResumable(status: ChatRunStatus): boolean {
  return status === 'queued' || status === 'running';
}


// ── Cost-approval helpers (shared with the chat-side popup) ──────────────
export {
  isCostApprovalGatedTool,
  COST_APPROVAL_OVERRIDE_ALLOWLIST,
  sanitizeCostApprovalOverride,
  applyCostApprovalOverridesToToolArguments,
} from './costApproval.js';

