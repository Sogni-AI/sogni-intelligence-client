/**
 * Canonical tool-result envelope and error taxonomy.
 *
 * Every tool handler in the Sogni harness returns a `ToolResult` — a
 * discriminated union with explicit success/failure shape, structured asset
 * outputs on success, and a typed error code on failure. This is the
 * contract callers parse against, replacing free-form JSON-string returns.
 *
 * Status: contract-only in this slice. Handler migrations follow in Slice B.
 *
 * Aligns with the Sogni Agentic Harness Guidelines §3.4 / §14.1.
 */

// ---------------------------------------------------------------------------
// Error taxonomy
// ---------------------------------------------------------------------------

/**
 * Canonical error codes for failed tool executions.
 *
 * Use the most specific code that fits. `UNKNOWN_ERROR` is the fallback for
 * unclassified failures — prefer adding a new code over reaching for it.
 */
export type ToolErrorCode =
  | 'PARAMETER_INVALID'           // Args failed JSON-schema validation
  | 'USER_INPUT_INCOMPLETE'       // Required user input missing or ambiguous
  | 'ASSET_NOT_FOUND'             // Referenced asset (image/video/audio) unavailable
  | 'WORKFLOW_VALIDATION_FAILED'  // Args valid but violate workflow rules
  | 'MODEL_UNAVAILABLE'           // Target model/worker offline or unsupported
  | 'PROVIDER_TIMEOUT'            // Upstream provider/worker timed out
  | 'GPU_WORKER_FAILED'           // Worker crashed or returned a fatal error
  | 'COST_LIMIT_EXCEEDED'         // Insufficient credits or over budget cap
  | 'SAFETY_REJECTED'             // Content filter or policy rejection
  | 'PERMISSION_REQUIRED'         // Caller lacks required tier/permission
  | 'USER_CANCELLED'              // Cancelled by user before completion
  | 'UNKNOWN_ERROR';              // Unclassified — last resort

/**
 * Legacy `ToolErrorCategory` values used by `sogni-chat`'s pre-envelope
 * classifier. Mapped to canonical codes by `mapLegacyToolErrorCategory()`.
 */
export type LegacyToolErrorCategory =
  | 'schema_validation'
  | 'business_rule'
  | 'precondition_failed'
  | 'transient_failure'
  | 'permanent_failure'
  | 'insufficient_credits'
  | 'timeout'
  | 'cancelled'
  | 'content_refused';

/**
 * Translate a legacy `ToolErrorCategory` into the canonical `ToolErrorCode`.
 * Used during Slice B handler migration so existing classifier output flows
 * into the new envelope without rewriting the classifier.
 */
export function mapLegacyToolErrorCategory(category: LegacyToolErrorCategory): ToolErrorCode {
  switch (category) {
    case 'schema_validation': return 'PARAMETER_INVALID';
    case 'business_rule': return 'WORKFLOW_VALIDATION_FAILED';
    case 'precondition_failed': return 'PERMISSION_REQUIRED';
    case 'transient_failure': return 'PROVIDER_TIMEOUT';
    case 'permanent_failure': return 'UNKNOWN_ERROR';
    case 'insufficient_credits': return 'COST_LIMIT_EXCEEDED';
    case 'timeout': return 'PROVIDER_TIMEOUT';
    case 'cancelled': return 'USER_CANCELLED';
    case 'content_refused': return 'SAFETY_REJECTED';
  }
}

// ---------------------------------------------------------------------------
// Asset and cost shapes
// ---------------------------------------------------------------------------

/** Output asset produced by a successful tool run. */
export interface ToolResultAsset {
  asset_id: string;
  type: 'image' | 'video' | 'audio' | 'model';
  url?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  fps?: number;
  metadata?: Record<string, unknown>;
}

/** Cost breakdown attached to a result for replay/audit. */
export interface ToolResultCost {
  spark?: number;
  usd?: number;
  /** Internal cost-of-goods-sold estimate in USD. */
  internal_cost_usd?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Result envelope (discriminated union)
// ---------------------------------------------------------------------------

/** Successful tool execution. `T` is the tool's `params` echo type. */
export interface ToolResultOk<TParams = Record<string, unknown>> {
  ok: true;
  /** Tool name (matches the OpenAI function name). */
  tool: string;
  job_id?: string;
  model_id?: string;
  workflow_id?: string;
  /** Lifecycle marker — `'completed'` for synchronous tools. */
  status: 'completed' | 'in_progress' | 'queued';
  /** Assets produced. Empty array when the tool returns no media. */
  output_assets: ToolResultAsset[];
  /** Echo of the validated arguments that were executed (post-normalization). */
  params?: TParams;
  estimated_cost?: ToolResultCost;
  /** Non-fatal advisories the caller may surface to the user. */
  warnings?: string[];
  /** Free-form provenance fields (seed, worker_id, etc.). */
  metadata?: Record<string, unknown>;
}

/** Failed tool execution. */
export interface ToolResultErr {
  ok: false;
  tool: string;
  error_type: ToolErrorCode;
  /** Human-readable message — safe to display. */
  message: string;
  /** Whether the harness should consider re-trying the call. */
  retryable: boolean;
  /**
   * Hint to the harness/loop on what to do next. Examples:
   *   - 'ask_user_for_missing_field:duration_seconds'
   *   - 'retry_with_smaller_aspect_ratio'
   *   - 'switch_to_alternate_model:qwen-image'
   */
  suggested_next_action?: string;
  /** Free-form provenance (failed worker_id, partial outputs, etc.). */
  metadata?: Record<string, unknown>;
}

/** Discriminated union — every tool handler returns one of these. */
export type ToolResult<TParams = Record<string, unknown>> =
  | ToolResultOk<TParams>
  | ToolResultErr;

// ---------------------------------------------------------------------------
// Constructor + guard helpers
// ---------------------------------------------------------------------------

/** Construct a successful `ToolResult`. */
export function toolOk<TParams = Record<string, unknown>>(
  fields: Omit<ToolResultOk<TParams>, 'ok' | 'status' | 'output_assets'> &
    Partial<Pick<ToolResultOk<TParams>, 'status' | 'output_assets'>>,
): ToolResultOk<TParams> {
  return {
    ok: true,
    status: 'completed',
    output_assets: [],
    ...fields,
  };
}

/** Construct a failed `ToolResult`. */
export function toolErr(
  fields: Omit<ToolResultErr, 'ok'>,
): ToolResultErr {
  return { ok: false, ...fields };
}

/** Type guard: result is a success envelope. */
export function isToolResultOk<T = Record<string, unknown>>(
  result: ToolResult<T>,
): result is ToolResultOk<T> {
  return result.ok === true;
}

/** Type guard: result is an error envelope. */
export function isToolResultErr(
  result: ToolResult<unknown>,
): result is ToolResultErr {
  return result.ok === false;
}
