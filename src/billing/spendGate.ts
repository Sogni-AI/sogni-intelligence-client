/**
 * SpendGate — v2 state machine that pauses a run before any paid tool
 * call (or workflow run) until the user (or an authorization umbrella)
 * confirms. One gate per scope: per-`tool_call` for chat runs, per-
 * `workflow_run` for workflow umbrellas (which then settle per-stage via
 * the existing sogni-socket project + N jobs path — see
 * `workflowAuthorization.ts`).
 *
 * Drift fix (audit 2026-05-20): pre-fix `SpendGate` shipped only `{state,
 * request?, decidedAt?, decidedBy?, failureReason?}` — far thinner than
 * the durable shape every downstream consumer (`sogni-creative-agent-v2`,
 * `sogni-api`, `sogni-chat`) actually persists. These TS types are now the
 * reference shape: they expose `{gateId, scope, estimate, state,
 * createdAt, updatedAt}` plus scope-discriminated fields, while keeping
 * the legacy `state` / `request?` / `failureReason?` keys present so
 * existing producers stay valid. `decidedBy?` was dropped — no consumer
 * uses it. The protocol schema in `schemas/billing/spend-gate.schema.json`
 * is being aligned to these TS types as part of this drift fix, so the two
 * will agree once that parallel change lands.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7.
 */

/** Coarse state of the gate. */
export type SpendGateState =
  | 'not_required'
  | 'preview_required'
  | 'waiting_for_user'
  | 'confirmed'
  | 'cancelled'
  | 'insufficient_credit'
  | 'safety_review_required'
  | 'failed';

/**
 * What the gate is authorizing.
 *
 * - `tool_call` — single tool call (default for chat runs).
 * - `parallel_batch` — grouped concurrent dispatches (e.g. a mass
 *   image-generation fan-out of N variations). Promoted to the canonical
 *   set on 2026-05-21 so consumers stop stubbing it locally. Surfaces a
 *   single gate that covers every tool call in the group; the
 *   `pendingToolCalls[]` array carries the constituent calls.
 * - `workflow_run` — whole workflow umbrella (per-stage settlement still
 *   flows through the existing sogni-socket project + N jobs path).
 */
export type SpendGateScope = 'tool_call' | 'parallel_batch' | 'workflow_run';

/** Capacity unit denomination. */
export type SpendGateTokenType = 'spark' | 'sogni';

/**
 * Decision recorded on the gate when the user (or an authorization
 * umbrella) resolves it.
 *
 * Three historical vocabularies are accepted:
 *
 * - `'confirm'` / `'cancel'` — canonical 2026-05-20 form. New producers
 *   MUST use these values.
 * - `'approved'` / `'rejected'` — pre-2026-05-20 form still emitted by
 *   `sogni-api` and `sogni-creative-agent` durable runs. Accepted as
 *   aliases so existing payloads keep validating during the cutover.
 * - `'cancelled'` — alternate past-tense spelling some legacy producers
 *   emit (collapses to `'cancel'`). Added 2026-05-21 after the audit
 *   flagged that `normalizeSpendDecision` was throwing on this value
 *   even though several persisted payloads use it.
 *
 * Consumers reading the field MUST go through {@link normalizeSpendDecision}
 * so business logic only ever sees the canonical pair.
 */
export type SpendGateDecision = 'confirm' | 'cancel' | 'approved' | 'rejected' | 'cancelled';

/** Canonical post-normalization decision shape. */
export type NormalizedSpendGateDecision = 'confirm' | 'cancel';

/**
 * Map a {@link SpendGateDecision} (either vocabulary) to its canonical
 * form. `'approved'` collapses to `'confirm'`; `'rejected'` collapses to
 * `'cancel'`. Pass-through for the canonical pair. Throws on unknown
 * values so silent misroutes are impossible — callers SHOULD validate
 * with {@link isSpendGateDecision} before normalizing if the input is
 * untrusted.
 */
export function normalizeSpendDecision(
  decision: SpendGateDecision,
): NormalizedSpendGateDecision {
  switch (decision) {
    case 'confirm':
    case 'cancel':
      return decision;
    case 'approved':
      return 'confirm';
    case 'rejected':
    case 'cancelled':
      return 'cancel';
    default: {
      const exhaustive: never = decision;
      throw new Error(`Unknown SpendGateDecision value: ${String(exhaustive)}`);
    }
  }
}

/** One line item in the cost breakdown surfaced to the user. */
export interface SpendGateCostBreakdownEntry {
  model: string;
  units: number;
  tokenType: SpendGateTokenType;
}

/**
 * Minimal reference to a tool call this gate covers. When scope =
 * `'tool_call'` the array typically has a single entry; when scope =
 * `'workflow_run'` it may be empty (the workflow plan is the unit of
 * authorization).
 */
export interface SpendGatePendingToolCallRef {
  toolCallId: string;
  toolName: string;
  estimateUnits?: number;
}

/**
 * Reference to the workflow run this gate authorizes. Only meaningful
 * when the gate scope is `'workflow_run'`.
 */
export interface SpendGatePendingWorkflowPlanRef {
  workflowRunId: string;
  templateId: string;
}

/**
 * Estimate payload carried on the gate itself. Field names mirror the
 * canonical schema: `capacityUnits` (sum of breakdown units), the typed
 * `breakdown[]`, the `tokenType` the breakdown is denominated in, and an
 * optional caller-supplied cap.
 */
export interface SpendGateEstimate {
  capacityUnits: number;
  breakdown: SpendGateCostBreakdownEntry[];
  tokenType: SpendGateTokenType;
  maxAcceptableUnits?: number;
}

/**
 * Request payload for a gate transition. Captured once when the run hits
 * a paid action; the gate state machine consumes it on every transition.
 * Field names are pre-2026-05-20; new code should prefer the
 * `SpendGate.estimate` object instead of these flat fields.
 */
export interface SpendGateRequest {
  scope: SpendGateScope;
  toolCallId?: string;
  workflowRunId?: string;
  /** Total estimated cost in capacity units (sum of breakdown). */
  estimateCapacityUnits: number;
  estimateCostBreakdown: SpendGateCostBreakdownEntry[];
  /** Optional cap from caller (e.g. runtimeConfig threshold). */
  maxAcceptableUnits?: number;
  /** Optional human-readable reason for the gate. */
  reason?: string;
}

/**
 * Live gate. Canonical fields (`gateId`, `scope`, `estimate`, `reason`,
 * `createdAt`, `updatedAt`) describe the durable shape consumers persist;
 * the protocol schema in `schemas/billing/spend-gate.schema.json` is being
 * aligned to these TS types as the reference shape. Legacy fields
 * (`request?`, `failureReason?`) remain present so existing producers keep
 * validating.
 *
 * All new canonical fields are optional in TypeScript on purpose: the
 * pre-2026-05-20 producers only set `state` and (sometimes) `request`,
 * and we don't want to break their type-checks in one cycle. Producers
 * targeting the canonical shape SHOULD populate `gateId`, `scope`,
 * `estimate`, `createdAt`, `updatedAt` (the aligned JSON schema treats
 * these as required at the wire level).
 */
export interface SpendGate {
  state: SpendGateState;
  /**
   * Stable id for the gate. Optional at the TypeScript level (legacy
   * `{state, request}` producers may omit it) but every canonical-shape
   * producer — `sogni-api`, `sogni-creative-agent-v2`, `sogni-chat` —
   * always populates it, and the protocol JSON schema (being aligned to
   * this TS type) marks it required. New code MUST set this.
   */
  gateId?: string;
  /** What the gate is authorizing. Required at the wire level. */
  scope?: SpendGateScope;
  /** Optional back-reference to the run that opened the gate. */
  runId?: string;
  /** Canonical estimate payload (replaces the flat fields on `request`). */
  estimate?: SpendGateEstimate;
  /** Human-readable reason for the gate. */
  reason?: string;
  /** Pending tool calls this gate covers (scope = `'tool_call'`). */
  pendingToolCalls?: SpendGatePendingToolCallRef[];
  /** Pending workflow plan this gate authorizes (scope = `'workflow_run'`). */
  pendingWorkflowPlan?: SpendGatePendingWorkflowPlanRef;
  /** ISO timestamp when the gate was opened. */
  createdAt?: string;
  /** ISO timestamp of the most recent state transition. */
  updatedAt?: string;
  /** ISO timestamp when the gate was decided (confirmed/cancelled/etc.). */
  decidedAt?: string;
  /** Decision recorded when the gate left `waiting_for_user`. */
  decision?: SpendGateDecision;
  /**
   * @deprecated Pre-2026-05-20 flat request payload. New code SHOULD
   * populate `estimate` + `scope` + `pendingToolCalls?` /
   * `pendingWorkflowPlan?` directly. Retained so existing producers stay
   * valid for one release.
   */
  request?: SpendGateRequest;
  /** Optional structured failure code/text when state is `failed`. */
  failureReason?: string;
}

const SPEND_GATE_STATES: ReadonlySet<SpendGateState> = new Set<SpendGateState>([
  'not_required',
  'preview_required',
  'waiting_for_user',
  'confirmed',
  'cancelled',
  'insufficient_credit',
  'safety_review_required',
  'failed',
]);

const SPEND_GATE_SCOPES: ReadonlySet<SpendGateScope> = new Set<SpendGateScope>([
  'tool_call',
  'parallel_batch',
  'workflow_run',
]);

const SPEND_GATE_TOKEN_TYPES: ReadonlySet<SpendGateTokenType> = new Set<SpendGateTokenType>([
  'spark',
  'sogni',
]);

const SPEND_GATE_DECISIONS: ReadonlySet<SpendGateDecision> = new Set<SpendGateDecision>([
  'confirm',
  'cancel',
  'approved',
  'rejected',
  'cancelled',
]);

const MAX_BOUNDED_SPEND_UNITS = Number.MAX_SAFE_INTEGER;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeBoundedUnits(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_BOUNDED_SPEND_UNITS
  );
}

function hasBoundedBreakdownSum(entries: readonly unknown[]): boolean {
  let sum = 0;
  for (const entry of entries) {
    if (isRecord(entry) && typeof entry.units === 'number' && Number.isFinite(entry.units) && entry.units >= 0) {
      sum += entry.units;
      if (!Number.isFinite(sum) || sum > MAX_BOUNDED_SPEND_UNITS) {
        return false;
      }
    }
  }
  return true;
}

export function isSpendGateState(value: unknown): value is SpendGateState {
  return typeof value === 'string' && SPEND_GATE_STATES.has(value as SpendGateState);
}

export function isSpendGateScope(value: unknown): value is SpendGateScope {
  return typeof value === 'string' && SPEND_GATE_SCOPES.has(value as SpendGateScope);
}

export function isSpendGateTokenType(value: unknown): value is SpendGateTokenType {
  return typeof value === 'string' && SPEND_GATE_TOKEN_TYPES.has(value as SpendGateTokenType);
}

export function isSpendGateDecision(value: unknown): value is SpendGateDecision {
  return typeof value === 'string' && SPEND_GATE_DECISIONS.has(value as SpendGateDecision);
}

export function isSpendGateCostBreakdownEntry(value: unknown): value is SpendGateCostBreakdownEntry {
  if (!isRecord(value)) return false;
  if (typeof value.model !== 'string') return false;
  if (!isNonNegativeBoundedUnits(value.units)) return false;
  if (!isSpendGateTokenType(value.tokenType)) return false;
  return true;
}

export function isSpendGatePendingToolCallRef(
  value: unknown,
): value is SpendGatePendingToolCallRef {
  if (!isRecord(value)) return false;
  if (typeof value.toolCallId !== 'string') return false;
  if (typeof value.toolName !== 'string') return false;
  if (value.estimateUnits !== undefined && !isNonNegativeBoundedUnits(value.estimateUnits)) {
    return false;
  }
  return true;
}

export function isSpendGatePendingWorkflowPlanRef(
  value: unknown,
): value is SpendGatePendingWorkflowPlanRef {
  if (!isRecord(value)) return false;
  if (typeof value.workflowRunId !== 'string') return false;
  if (typeof value.templateId !== 'string') return false;
  return true;
}

export function isSpendGateEstimate(value: unknown): value is SpendGateEstimate {
  if (!isRecord(value)) return false;
  if (!isNonNegativeBoundedUnits(value.capacityUnits)) return false;
  if (
    !Array.isArray(value.breakdown) ||
    !value.breakdown.every(isSpendGateCostBreakdownEntry) ||
    !hasBoundedBreakdownSum(value.breakdown)
  ) {
    return false;
  }
  if (!isSpendGateTokenType(value.tokenType)) return false;
  if (value.maxAcceptableUnits !== undefined && !isNonNegativeBoundedUnits(value.maxAcceptableUnits)) {
    return false;
  }
  return true;
}

export function isSpendGateRequest(value: unknown): value is SpendGateRequest {
  if (!isRecord(value)) return false;
  if (!isSpendGateScope(value.scope)) return false;
  if (value.toolCallId !== undefined && typeof value.toolCallId !== 'string') return false;
  if (value.workflowRunId !== undefined && typeof value.workflowRunId !== 'string') return false;
  if (!isNonNegativeBoundedUnits(value.estimateCapacityUnits)) {
    return false;
  }
  if (!Array.isArray(value.estimateCostBreakdown)) return false;
  if (
    !value.estimateCostBreakdown.every(isSpendGateCostBreakdownEntry) ||
    !hasBoundedBreakdownSum(value.estimateCostBreakdown)
  ) {
    return false;
  }
  if (value.maxAcceptableUnits !== undefined && !isNonNegativeBoundedUnits(value.maxAcceptableUnits)) {
    return false;
  }
  if (value.reason !== undefined && typeof value.reason !== 'string') return false;
  return true;
}

export function isSpendGate(value: unknown): value is SpendGate {
  if (!isRecord(value)) return false;
  if (!isSpendGateState(value.state)) return false;
  if (value.gateId !== undefined && typeof value.gateId !== 'string') return false;
  if (value.scope !== undefined && !isSpendGateScope(value.scope)) return false;
  if (value.runId !== undefined && typeof value.runId !== 'string') return false;
  if (value.estimate !== undefined && !isSpendGateEstimate(value.estimate)) return false;
  if (value.reason !== undefined && typeof value.reason !== 'string') return false;
  if (
    value.pendingToolCalls !== undefined &&
    (!Array.isArray(value.pendingToolCalls) ||
      !value.pendingToolCalls.every(isSpendGatePendingToolCallRef))
  ) {
    return false;
  }
  if (
    value.pendingWorkflowPlan !== undefined &&
    !isSpendGatePendingWorkflowPlanRef(value.pendingWorkflowPlan)
  ) {
    return false;
  }
  if (value.createdAt !== undefined && typeof value.createdAt !== 'string') return false;
  if (value.updatedAt !== undefined && typeof value.updatedAt !== 'string') return false;
  if (value.decidedAt !== undefined && typeof value.decidedAt !== 'string') return false;
  if (value.decision !== undefined && !isSpendGateDecision(value.decision)) return false;
  if (value.request !== undefined && !isSpendGateRequest(value.request)) return false;
  if (value.failureReason !== undefined && typeof value.failureReason !== 'string') return false;
  return true;
}

/** One structured validation error (see intentInput for shape rationale). */
export interface SpendGateValidationError {
  path: string;
  message: string;
}

export interface SpendGateValidationResult {
  valid: boolean;
  errors: SpendGateValidationError[];
}

function pushError(
  errors: SpendGateValidationError[],
  path: string,
  message: string,
): void {
  errors.push({ path, message });
}

function validateBreakdownEntryInternal(
  value: unknown,
  basePath: string,
  errors: SpendGateValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  if (typeof (value as { model?: unknown }).model !== 'string') {
    pushError(errors, `${basePath}/model`, 'must be a string');
  }
  const units = (value as { units?: unknown }).units;
  if (!isNonNegativeBoundedUnits(units)) {
    pushError(errors, `${basePath}/units`, 'must be a non-negative bounded number');
  }
  if (!isSpendGateTokenType((value as { tokenType?: unknown }).tokenType)) {
    pushError(errors, `${basePath}/tokenType`, 'must be a valid SpendGateTokenType');
  }
}

function validateEstimateInternal(
  value: unknown,
  basePath: string,
  errors: SpendGateValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  const cap = (value as { capacityUnits?: unknown }).capacityUnits;
  if (!isNonNegativeBoundedUnits(cap)) {
    pushError(errors, `${basePath}/capacityUnits`, 'must be a non-negative bounded number');
  }
  const breakdown = (value as { breakdown?: unknown }).breakdown;
  if (!Array.isArray(breakdown)) {
    pushError(errors, `${basePath}/breakdown`, 'must be an array');
  } else {
    breakdown.forEach((entry, idx) =>
      validateBreakdownEntryInternal(entry, `${basePath}/breakdown/${idx}`, errors),
    );
    if (!hasBoundedBreakdownSum(breakdown)) {
      pushError(errors, `${basePath}/breakdown`, 'sum of breakdown units exceeds safe finite range');
    }
  }
  if (!isSpendGateTokenType((value as { tokenType?: unknown }).tokenType)) {
    pushError(errors, `${basePath}/tokenType`, 'must be a valid SpendGateTokenType');
  }
  const maxAcc = (value as { maxAcceptableUnits?: unknown }).maxAcceptableUnits;
  if (maxAcc !== undefined && !isNonNegativeBoundedUnits(maxAcc)) {
    pushError(errors, `${basePath}/maxAcceptableUnits`, 'must be a non-negative bounded number when present');
  }
}

/**
 * Walk a {@link SpendGateRequest} and report each missing or wrong-typed
 * field as `{ path, message }`. Mirrors the field set of the canonical
 * pre-2026-05-20 request payload.
 */
export function validateSpendGateRequest(value: unknown): SpendGateValidationResult {
  const errors: SpendGateValidationError[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: [{ path: '/', message: 'must be an object' }] };
  }
  if (!isSpendGateScope((value as { scope?: unknown }).scope)) {
    pushError(errors, '/scope', 'must be a valid SpendGateScope');
  }
  const toolCallId = (value as { toolCallId?: unknown }).toolCallId;
  if (toolCallId !== undefined && typeof toolCallId !== 'string') {
    pushError(errors, '/toolCallId', 'must be a string when present');
  }
  const workflowRunId = (value as { workflowRunId?: unknown }).workflowRunId;
  if (workflowRunId !== undefined && typeof workflowRunId !== 'string') {
    pushError(errors, '/workflowRunId', 'must be a string when present');
  }
  const est = (value as { estimateCapacityUnits?: unknown }).estimateCapacityUnits;
  if (!isNonNegativeBoundedUnits(est)) {
    pushError(errors, '/estimateCapacityUnits', 'must be a non-negative bounded number');
  }
  const breakdown = (value as { estimateCostBreakdown?: unknown }).estimateCostBreakdown;
  if (!Array.isArray(breakdown)) {
    pushError(errors, '/estimateCostBreakdown', 'must be an array');
  } else {
    breakdown.forEach((entry, idx) =>
      validateBreakdownEntryInternal(entry, `/estimateCostBreakdown/${idx}`, errors),
    );
    if (!hasBoundedBreakdownSum(breakdown)) {
      pushError(errors, '/estimateCostBreakdown', 'sum of breakdown units exceeds safe finite range');
    }
  }
  const maxAcc = (value as { maxAcceptableUnits?: unknown }).maxAcceptableUnits;
  if (maxAcc !== undefined && !isNonNegativeBoundedUnits(maxAcc)) {
    pushError(errors, '/maxAcceptableUnits', 'must be a non-negative bounded number when present');
  }
  const reason = (value as { reason?: unknown }).reason;
  if (reason !== undefined && typeof reason !== 'string') {
    pushError(errors, '/reason', 'must be a string when present');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Walk a live {@link SpendGate} record and report each missing or
 * wrong-typed field as `{ path, message }`. Canonical fields (`gateId`,
 * `scope`, `estimate`, timestamps) are still optional at the
 * TypeScript level for backwards-compat with the legacy
 * `{ state, request? }` producers; only their types are checked when
 * present.
 */
export function validateSpendGate(value: unknown): SpendGateValidationResult {
  const errors: SpendGateValidationError[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: [{ path: '/', message: 'must be an object' }] };
  }
  if (!isSpendGateState((value as { state?: unknown }).state)) {
    pushError(errors, '/state', 'must be a valid SpendGateState');
  }
  for (const key of ['gateId', 'runId', 'reason', 'createdAt', 'updatedAt', 'decidedAt'] as const) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined && typeof v !== 'string') {
      pushError(errors, `/${key}`, 'must be a string when present');
    }
  }
  const scope = (value as { scope?: unknown }).scope;
  if (scope !== undefined && !isSpendGateScope(scope)) {
    pushError(errors, '/scope', 'must be a valid SpendGateScope when present');
  }
  const estimate = (value as { estimate?: unknown }).estimate;
  if (estimate !== undefined) {
    validateEstimateInternal(estimate, '/estimate', errors);
  }
  const pendingTools = (value as { pendingToolCalls?: unknown }).pendingToolCalls;
  if (pendingTools !== undefined) {
    if (!Array.isArray(pendingTools)) {
      pushError(errors, '/pendingToolCalls', 'must be an array when present');
    } else {
      pendingTools.forEach((ref, idx) => {
        if (!isRecord(ref)) {
          pushError(errors, `/pendingToolCalls/${idx}`, 'must be an object');
          return;
        }
        if (typeof (ref as { toolCallId?: unknown }).toolCallId !== 'string') {
          pushError(errors, `/pendingToolCalls/${idx}/toolCallId`, 'must be a string');
        }
        if (typeof (ref as { toolName?: unknown }).toolName !== 'string') {
          pushError(errors, `/pendingToolCalls/${idx}/toolName`, 'must be a string');
        }
        const estimateUnits = (ref as { estimateUnits?: unknown }).estimateUnits;
        if (estimateUnits !== undefined && !isNonNegativeBoundedUnits(estimateUnits)) {
          pushError(
            errors,
            `/pendingToolCalls/${idx}/estimateUnits`,
            'must be a non-negative bounded number when present',
          );
        }
      });
    }
  }
  const pendingPlan = (value as { pendingWorkflowPlan?: unknown }).pendingWorkflowPlan;
  if (pendingPlan !== undefined) {
    if (!isRecord(pendingPlan)) {
      pushError(errors, '/pendingWorkflowPlan', 'must be an object when present');
    } else {
      if (typeof (pendingPlan as { workflowRunId?: unknown }).workflowRunId !== 'string') {
        pushError(errors, '/pendingWorkflowPlan/workflowRunId', 'must be a string');
      }
      if (typeof (pendingPlan as { templateId?: unknown }).templateId !== 'string') {
        pushError(errors, '/pendingWorkflowPlan/templateId', 'must be a string');
      }
    }
  }
  const decision = (value as { decision?: unknown }).decision;
  if (decision !== undefined && !isSpendGateDecision(decision)) {
    pushError(errors, '/decision', 'must be a valid SpendGateDecision when present');
  }
  const request = (value as { request?: unknown }).request;
  if (request !== undefined) {
    const nested = validateSpendGateRequest(request);
    if (!nested.valid) {
      for (const e of nested.errors) {
        pushError(errors, `/request${e.path === '/' ? '' : e.path}`, e.message);
      }
    }
  }
  const failureReason = (value as { failureReason?: unknown }).failureReason;
  if (failureReason !== undefined && typeof failureReason !== 'string') {
    pushError(errors, '/failureReason', 'must be a string when present');
  }
  return { valid: errors.length === 0, errors };
}
