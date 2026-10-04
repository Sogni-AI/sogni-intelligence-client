/**
 * Replay record schema for agent runs.
 *
 * Phase 4 of the agentic-harness-plan (Memory / replay / evals). One
 * `RunRecord` is written per agent run — that is, per top-level user
 * turn after the tool-calling loop drains. Records are intended to be
 * persisted by sogni-api on MongoDB (Path B), and to be optionally
 * mirrored from sogni-chat via an ingest endpoint (Path A). The
 * portable type lives here so both paths agree on field shapes and so
 * downstream language SDKs can validate / generate from it.
 *
 * Determinism contract: a run is "replayable" when re-running with the
 * same `user_request`, `runtime_config`, and per-round `tool_calls`
 * against deterministic tool stubs reproduces the same `tool_results`
 * and `final_response`. This is asserted by the eval harness, not by
 * the schema itself.
 *
 * Privacy: every replay record passes through `redactRunRecord` before
 * being persisted or surfaced. Credential filtering is best-effort,
 * not anonymization; prompts, responses, and tool data are retained.
 */

/**
 * Canonical cost breakdown used by RunRecord. Mirrors the per-job
 * BackboneCostEstimate but aggregated across the whole run. Stays
 * stringy/numeric so JSON round-trips cleanly.
 */
export interface RunRecordCostBreakdown {
  totalUsd?: number;
  totalSpark?: number;
  totalRenderSeconds?: number;
  byTool?: Record<string, { usd?: number; spark?: number; renderSeconds?: number }>;
}

/**
 * A tool call recorded for replay. Arguments are post-normalization
 * (after dispatchToolCall's autoRepair), so re-running them against
 * the same handler produces identical effects.
 */
export interface RunRecordToolCall {
  name: string;
  arguments: Record<string, unknown>;
  /** ID assigned by the LLM; preserved for diff against fresh replays. */
  id?: string;
  /** Per-tool cost class (from TOOL_COST_METADATA). Populated by the
   *  writer when the tool is known; absent for ad-hoc / unregistered
   *  tools. */
  cost_class?: string;
  /** Per-tool risk level (from TOOL_COST_METADATA). Same population
   *  rules as cost_class. */
  risk_level?: 'safe' | 'paid' | 'destructive';
}

/**
 * The result envelope for a tool call. Stores the canonical
 * `ToolResult` discriminated union as a plain record so the replay
 * pipeline does not need to ship the type itself across processes.
 */
export interface RunRecordToolResult {
  ok: boolean;
  /** Structured `ToolErrorCode` when ok is false; absent when ok is true. */
  error_type?: string;
  /** Free-form fields the handler returned, processed by `redactPayload`. */
  payload: Record<string, unknown>;
}

/**
 * One round of the tool-calling loop. Aligns with the agent loop's
 * "LLM streams → tool dispatch → results → next round" cadence.
 */
export interface RunRecordRound {
  /** 1-based round index within the run. */
  round: number;
  /** What the assistant said in this round (visible to the user). */
  assistant_message: string;
  /** Tool calls the assistant emitted in this round, in order. */
  tool_calls: RunRecordToolCall[];
  /** Results in the same order as `tool_calls`. Length-equal. */
  tool_results: RunRecordToolResult[];
}

/**
 * Audit results from preflight (`audit_generation_request`) and
 * postflight (`audit_generated_asset`) skill calls. Same shape as
 * the runtime AuditResult so replay viewers can render them.
 */
export interface RunRecordAuditResult {
  stage: 'preflight' | 'postflight';
  fatal_issues: ReadonlyArray<{ id: string; message: string }>;
  minor_issues: ReadonlyArray<{ id: string; message: string }>;
  recommended_action: 'accept' | 'refine' | 'regenerate' | 'ask_user';
  /** Tool name the audit ran against. */
  toolName: string;
}

/**
 * One LLM call the agent loop made during the run. Carries the
 * identifiers that join a failed turn to the network's job logs; no
 * prompt or completion text.
 */
export interface RunRecordLlmCall {
  /** Network LLM job id. */
  job_id?: string;
  /** Model the call was dispatched against. */
  model?: string;
  /** Worker that served the call. */
  worker_name?: string;
  finish_reason?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  duration_ms?: number;
}

/**
 * How the turn ended, written by the producer that ran the loop. Tool
 * failures already live in `rounds[].tool_results`; this records what
 * they cannot show: an LLM call that died, a planner or transport error
 * before any tool ran, or a cancellation.
 */
export interface RunRecordOutcome {
  status: 'completed' | 'failed' | 'cancelled';
  /** Machine-readable failure code, e.g. `llm_worker_interrupted`. */
  error_code?: string;
  /** Failure message as the loop saw it, truncated by the producer. */
  error_message?: string;
  /** LLM calls in execution order (the producer bounds the list). */
  llm_calls?: ReadonlyArray<RunRecordLlmCall>;
}

/**
 * Canonical RunRecord shape. JSON-serializable. Bumped via
 * `RUN_RECORD_SCHEMA_VERSION` whenever the shape changes.
 */
export interface RunRecord {
  /** Schema version. Bump on any breaking shape change. */
  schemaVersion: number;
  /** Stable identifier for the run. Generated at run start. */
  run_id: string;
  /** Wall-clock timestamps (epoch ms) for the run boundaries. */
  startedAt: number;
  endedAt: number;
  /** Verbatim user request that triggered the run. Redacted. */
  user_request: string;
  /** Model id the run was dispatched against (e.g. qwen3.6-35b-...) */
  model_id: string;
  /** Per-run runtime config snapshot: thinking mode, sampler params,
   *  feature flags. Processed by credential filtering before persistence. */
  runtime_config: Record<string, unknown>;
  /** Tool definitions visible to the LLM this run (post-gating). The
   *  full OpenAI function-call shape lives here so replay can rebuild
   *  the exact LLM input. */
  tool_schemas: ReadonlyArray<Record<string, unknown>>;
  /** Rounds in execution order. */
  rounds: ReadonlyArray<RunRecordRound>;
  /** The user-visible assistant response that ended the turn. */
  final_response: string;
  /** Audit findings emitted during the run. */
  audit_results: ReadonlyArray<RunRecordAuditResult>;
  /** Worker job ids spawned during the run. */
  job_ids: ReadonlyArray<string>;
  /** Stable asset ids the asset manifest tracked during the run. */
  asset_ids: ReadonlyArray<string>;
  /** Aggregated cost; populated when billing data is available. */
  total_cost?: RunRecordCostBreakdown;
  /** How the turn ended. Absent on records from producers that predate it. */
  outcome?: RunRecordOutcome;
  /** True when `redactRunRecord` ran. Always true for persisted records. */
  redacted: boolean;
}

export const RUN_RECORD_SCHEMA_VERSION = 2;

export function emptyRunRecord(): RunRecord {
  return {
    schemaVersion: RUN_RECORD_SCHEMA_VERSION,
    run_id: '',
    startedAt: 0,
    endedAt: 0,
    user_request: '',
    model_id: '',
    runtime_config: {},
    tool_schemas: [],
    rounds: [],
    final_response: '',
    audit_results: [],
    job_ids: [],
    asset_ids: [],
    redacted: false,
  };
}
