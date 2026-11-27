/**
 * WorkflowAuthorization — umbrella consent the user grants once at workflow
 * start so the workflow runner doesn't have to pause for cost approval on
 * every stage.
 *
 * **Authorize once at workflow start; per-job settlement continues through
 * the existing sogni-socket "project + N identical jobs" path. The workflow
 * layer is an authorization umbrella, not a new transaction ledger.**
 * (Codex Reconciliation override §1.A.) Stage-level settlements here are
 * bookkeeping mirrors of the real sogni-socket project + jobs settlement;
 * we do not re-implement transaction state.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7 + §13.1.
 */

/**
 * Capacity unit denomination. Named separately from `SpendGateTokenType`
 * so workflow code can import without pulling the SpendGate types.
 */
export type WorkflowSpendTokenType = 'spark' | 'sogni';

/**
 * Cost preview shown to the user before they confirm a workflow run.
 * Generated from the template inputs and the planner's stage breakdown;
 * `validityUntil` lets the runner reject a confirmation that arrives
 * after upstream pricing changed.
 */
export interface WorkflowCostPreview {
  templateId: string;
  inputs: Record<string, unknown>;
  totalEstimatedCapacityUnits: number;
  perStageBreakdown: Array<{
    stageId: string;
    units: number;
    /** Assumptions used to compute this stage's estimate (model picks, batch sizes, etc.). */
    assumptions: string[];
  }>;
  tokenType: WorkflowSpendTokenType;
  /** Optional caller-supplied cap (mirrors `SpendGateRequest.maxAcceptableUnits`). */
  maxAcceptableUnits?: number;
  /** Expected wall-clock duration the UI surfaces alongside cost. */
  expectedDurationSeconds: number;
  /** ISO timestamp; runner rejects confirmations received after this. */
  validityUntil: string;
}

/**
 * User decision on a workflow cost preview. The accepted preview is
 * captured verbatim so audit logs can show exactly what the user agreed to.
 */
export interface WorkflowRunConfirmation {
  workflowRunId: string;
  decision: 'confirm' | 'cancel';
  acceptedCostPreview: WorkflowCostPreview;
}

/**
 * Per-stage settlement state. **Bookkeeping only** — the real
 * transaction state lives on the sogni-socket project + jobs that the
 * stage dispatches. `projectId` / `jobIds` are the back-references into
 * that authoritative ledger.
 */
export type StageSettlementStatus = 'pending' | 'in_flight' | 'settled' | 'failed' | 'cancelled';

export interface StageSettlement {
  stageId: string;
  /** Sogni project id this stage dispatched (when known). */
  projectId?: string;
  /** Sogni job ids this stage dispatched. */
  jobIds: string[];
  estimatedUnits: number;
  /** Final settled units from the project + jobs payload, if available. */
  settledUnits?: number;
  status: StageSettlementStatus;
}

/**
 * Live workflow authorization. `cumulativeSettledUnits` and
 * `cumulativeReservedUnits` are derived from `stageSettlements`; the
 * runner updates them as the per-stage sogni-socket projects settle.
 */
export interface WorkflowAuthorization {
  workflowRunId: string;
  authorizedCapacityUnits: number;
  tokenType: WorkflowSpendTokenType;
  authorizedAt: string;
  /** ISO timestamp after which the authorization must be re-confirmed. */
  expiresAt: string;
  cumulativeSettledUnits: number;
  cumulativeReservedUnits: number;
  stageSettlements: StageSettlement[];
}

const WORKFLOW_TOKEN_TYPES: ReadonlySet<WorkflowSpendTokenType> = new Set<WorkflowSpendTokenType>([
  'spark',
  'sogni',
]);

const STAGE_SETTLEMENT_STATUSES: ReadonlySet<StageSettlementStatus> = new Set<StageSettlementStatus>([
  'pending',
  'in_flight',
  'settled',
  'failed',
  'cancelled',
]);

const MAX_BOUNDED_WORKFLOW_UNITS = Number.MAX_SAFE_INTEGER;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeBoundedUnits(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_BOUNDED_WORKFLOW_UNITS
  );
}

function hasBoundedStageBreakdownSum(entries: readonly unknown[]): boolean {
  let sum = 0;
  for (const entry of entries) {
    if (isRecord(entry) && typeof entry.units === 'number' && Number.isFinite(entry.units) && entry.units >= 0) {
      sum += entry.units;
      if (!Number.isFinite(sum) || sum > MAX_BOUNDED_WORKFLOW_UNITS) {
        return false;
      }
    }
  }
  return true;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isWorkflowSpendTokenType(value: unknown): value is WorkflowSpendTokenType {
  return typeof value === 'string' && WORKFLOW_TOKEN_TYPES.has(value as WorkflowSpendTokenType);
}

export function isStageSettlementStatus(value: unknown): value is StageSettlementStatus {
  return typeof value === 'string' && STAGE_SETTLEMENT_STATUSES.has(value as StageSettlementStatus);
}

function isStageBreakdownEntry(value: unknown): value is WorkflowCostPreview['perStageBreakdown'][number] {
  if (!isRecord(value)) return false;
  if (typeof value.stageId !== 'string') return false;
  if (!isNonNegativeBoundedUnits(value.units)) return false;
  if (!isStringArray(value.assumptions)) return false;
  return true;
}

export function isWorkflowCostPreview(value: unknown): value is WorkflowCostPreview {
  if (!isRecord(value)) return false;
  if (typeof value.templateId !== 'string') return false;
  if (!isRecord(value.inputs)) return false;
  if (!isNonNegativeBoundedUnits(value.totalEstimatedCapacityUnits)) {
    return false;
  }
  if (
    !Array.isArray(value.perStageBreakdown) ||
    !value.perStageBreakdown.every(isStageBreakdownEntry) ||
    !hasBoundedStageBreakdownSum(value.perStageBreakdown)
  ) {
    return false;
  }
  if (!isWorkflowSpendTokenType(value.tokenType)) return false;
  if (value.maxAcceptableUnits !== undefined && !isNonNegativeBoundedUnits(value.maxAcceptableUnits)) {
    return false;
  }
  if (!isNonNegativeBoundedUnits(value.expectedDurationSeconds)) {
    return false;
  }
  if (typeof value.validityUntil !== 'string') return false;
  return true;
}

export function isWorkflowRunConfirmation(value: unknown): value is WorkflowRunConfirmation {
  if (!isRecord(value)) return false;
  if (typeof value.workflowRunId !== 'string') return false;
  if (value.decision !== 'confirm' && value.decision !== 'cancel') return false;
  if (!isWorkflowCostPreview(value.acceptedCostPreview)) return false;
  return true;
}

export function isStageSettlement(value: unknown): value is StageSettlement {
  if (!isRecord(value)) return false;
  if (typeof value.stageId !== 'string') return false;
  if (value.projectId !== undefined && typeof value.projectId !== 'string') return false;
  if (!isStringArray(value.jobIds)) return false;
  if (!isNonNegativeBoundedUnits(value.estimatedUnits)) return false;
  if (value.settledUnits !== undefined && !isNonNegativeBoundedUnits(value.settledUnits)) {
    return false;
  }
  if (!isStageSettlementStatus(value.status)) return false;
  return true;
}

export function isWorkflowAuthorization(value: unknown): value is WorkflowAuthorization {
  if (!isRecord(value)) return false;
  if (typeof value.workflowRunId !== 'string') return false;
  if (!isNonNegativeBoundedUnits(value.authorizedCapacityUnits)) {
    return false;
  }
  if (!isWorkflowSpendTokenType(value.tokenType)) return false;
  if (typeof value.authorizedAt !== 'string') return false;
  if (typeof value.expiresAt !== 'string') return false;
  if (!isNonNegativeBoundedUnits(value.cumulativeSettledUnits)) {
    return false;
  }
  if (!isNonNegativeBoundedUnits(value.cumulativeReservedUnits)) {
    return false;
  }
  if (
    !Number.isFinite(value.cumulativeSettledUnits + value.cumulativeReservedUnits) ||
    value.cumulativeSettledUnits + value.cumulativeReservedUnits > MAX_BOUNDED_WORKFLOW_UNITS
  ) {
    return false;
  }
  if (!Array.isArray(value.stageSettlements) || !value.stageSettlements.every(isStageSettlement)) {
    return false;
  }
  return true;
}

/** One structured validation error (see intentInput for shape rationale). */
export interface WorkflowAuthorizationValidationError {
  path: string;
  message: string;
}

export interface WorkflowAuthorizationValidationResult {
  valid: boolean;
  errors: WorkflowAuthorizationValidationError[];
}

function pushError(
  errors: WorkflowAuthorizationValidationError[],
  path: string,
  message: string,
): void {
  errors.push({ path, message });
}

function validateStageBreakdownEntryInternal(
  value: unknown,
  basePath: string,
  errors: WorkflowAuthorizationValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  if (typeof (value as { stageId?: unknown }).stageId !== 'string') {
    pushError(errors, `${basePath}/stageId`, 'must be a string');
  }
  const units = (value as { units?: unknown }).units;
  if (!isNonNegativeBoundedUnits(units)) {
    pushError(errors, `${basePath}/units`, 'must be a non-negative bounded number');
  }
  const assumptions = (value as { assumptions?: unknown }).assumptions;
  if (!Array.isArray(assumptions)) {
    pushError(errors, `${basePath}/assumptions`, 'must be an array');
  } else {
    assumptions.forEach((a, idx) => {
      if (typeof a !== 'string') {
        pushError(errors, `${basePath}/assumptions/${idx}`, 'must be a string');
      }
    });
  }
}

/**
 * Walk a {@link WorkflowCostPreview} and report each missing or
 * wrong-typed field as `{ path, message }`. `templateId` and `inputs`
 * are required — a missing field surfaces a specific error rather
 * than a generic "shape mismatch".
 */
export function validateWorkflowCostPreview(
  value: unknown,
): WorkflowAuthorizationValidationResult {
  const errors: WorkflowAuthorizationValidationError[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: [{ path: '/', message: 'must be an object' }] };
  }
  if (typeof (value as { templateId?: unknown }).templateId !== 'string') {
    pushError(errors, '/templateId', 'must be a string');
  }
  const inputs = (value as { inputs?: unknown }).inputs;
  if (!isRecord(inputs)) {
    pushError(errors, '/inputs', 'must be an object');
  }
  const total = (value as { totalEstimatedCapacityUnits?: unknown }).totalEstimatedCapacityUnits;
  if (!isNonNegativeBoundedUnits(total)) {
    pushError(errors, '/totalEstimatedCapacityUnits', 'must be a non-negative bounded number');
  }
  const perStage = (value as { perStageBreakdown?: unknown }).perStageBreakdown;
  if (!Array.isArray(perStage)) {
    pushError(errors, '/perStageBreakdown', 'must be an array');
  } else {
    perStage.forEach((entry, idx) =>
      validateStageBreakdownEntryInternal(entry, `/perStageBreakdown/${idx}`, errors),
    );
    if (!hasBoundedStageBreakdownSum(perStage)) {
      pushError(errors, '/perStageBreakdown', 'sum of stage breakdown units exceeds safe finite range');
    }
  }
  if (!isWorkflowSpendTokenType((value as { tokenType?: unknown }).tokenType)) {
    pushError(errors, '/tokenType', 'must be a valid WorkflowSpendTokenType');
  }
  const maxAcc = (value as { maxAcceptableUnits?: unknown }).maxAcceptableUnits;
  if (maxAcc !== undefined && !isNonNegativeBoundedUnits(maxAcc)) {
    pushError(errors, '/maxAcceptableUnits', 'must be a non-negative bounded number when present');
  }
  const dur = (value as { expectedDurationSeconds?: unknown }).expectedDurationSeconds;
  if (!isNonNegativeBoundedUnits(dur)) {
    pushError(errors, '/expectedDurationSeconds', 'must be a non-negative bounded number');
  }
  if (typeof (value as { validityUntil?: unknown }).validityUntil !== 'string') {
    pushError(errors, '/validityUntil', 'must be a string');
  }
  return { valid: errors.length === 0, errors };
}

function validateStageSettlementInternal(
  value: unknown,
  basePath: string,
  errors: WorkflowAuthorizationValidationError[],
): void {
  if (!isRecord(value)) {
    pushError(errors, basePath, 'must be an object');
    return;
  }
  if (typeof (value as { stageId?: unknown }).stageId !== 'string') {
    pushError(errors, `${basePath}/stageId`, 'must be a string');
  }
  const projectId = (value as { projectId?: unknown }).projectId;
  if (projectId !== undefined && typeof projectId !== 'string') {
    pushError(errors, `${basePath}/projectId`, 'must be a string when present');
  }
  const jobIds = (value as { jobIds?: unknown }).jobIds;
  if (!Array.isArray(jobIds)) {
    pushError(errors, `${basePath}/jobIds`, 'must be an array');
  } else {
    jobIds.forEach((id, idx) => {
      if (typeof id !== 'string') {
        pushError(errors, `${basePath}/jobIds/${idx}`, 'must be a string');
      }
    });
  }
  const est = (value as { estimatedUnits?: unknown }).estimatedUnits;
  if (!isNonNegativeBoundedUnits(est)) {
    pushError(errors, `${basePath}/estimatedUnits`, 'must be a non-negative bounded number');
  }
  const settled = (value as { settledUnits?: unknown }).settledUnits;
  if (settled !== undefined && !isNonNegativeBoundedUnits(settled)) {
    pushError(errors, `${basePath}/settledUnits`, 'must be a non-negative bounded number when present');
  }
  if (!isStageSettlementStatus((value as { status?: unknown }).status)) {
    pushError(errors, `${basePath}/status`, 'must be a valid StageSettlementStatus');
  }
}

/**
 * Walk a {@link WorkflowAuthorization} and report each missing or
 * wrong-typed field as `{ path, message }`. `workflowRunId` is the
 * required umbrella key — a missing one surfaces a specific error.
 */
export function validateWorkflowAuthorization(
  value: unknown,
): WorkflowAuthorizationValidationResult {
  const errors: WorkflowAuthorizationValidationError[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: [{ path: '/', message: 'must be an object' }] };
  }
  if (typeof (value as { workflowRunId?: unknown }).workflowRunId !== 'string') {
    pushError(errors, '/workflowRunId', 'must be a string');
  }
  const authCap = (value as { authorizedCapacityUnits?: unknown }).authorizedCapacityUnits;
  if (!isNonNegativeBoundedUnits(authCap)) {
    pushError(errors, '/authorizedCapacityUnits', 'must be a non-negative bounded number');
  }
  if (!isWorkflowSpendTokenType((value as { tokenType?: unknown }).tokenType)) {
    pushError(errors, '/tokenType', 'must be a valid WorkflowSpendTokenType');
  }
  if (typeof (value as { authorizedAt?: unknown }).authorizedAt !== 'string') {
    pushError(errors, '/authorizedAt', 'must be a string');
  }
  if (typeof (value as { expiresAt?: unknown }).expiresAt !== 'string') {
    pushError(errors, '/expiresAt', 'must be a string');
  }
  const cumSettled = (value as { cumulativeSettledUnits?: unknown }).cumulativeSettledUnits;
  if (!isNonNegativeBoundedUnits(cumSettled)) {
    pushError(errors, '/cumulativeSettledUnits', 'must be a non-negative bounded number');
  }
  const cumRes = (value as { cumulativeReservedUnits?: unknown }).cumulativeReservedUnits;
  if (!isNonNegativeBoundedUnits(cumRes)) {
    pushError(errors, '/cumulativeReservedUnits', 'must be a non-negative bounded number');
  }
  if (
    isNonNegativeBoundedUnits(cumSettled) &&
    isNonNegativeBoundedUnits(cumRes) &&
    (!Number.isFinite(cumSettled + cumRes) || cumSettled + cumRes > MAX_BOUNDED_WORKFLOW_UNITS)
  ) {
    pushError(errors, '/cumulativeReservedUnits', 'combined settled and reserved units exceed safe finite range');
  }
  const stages = (value as { stageSettlements?: unknown }).stageSettlements;
  if (!Array.isArray(stages)) {
    pushError(errors, '/stageSettlements', 'must be an array');
  } else {
    stages.forEach((s, idx) =>
      validateStageSettlementInternal(s, `/stageSettlements/${idx}`, errors),
    );
  }
  return { valid: errors.length === 0, errors };
}
