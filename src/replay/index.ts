/**
 * Public surface for replay primitives. Consumers should import from
 * here rather than reaching into the submodules so the boundary stays
 * stable as the schema evolves.
 */

export type {
  RunRecord,
  RunRecordRound,
  RunRecordToolCall,
  RunRecordToolResult,
  RunRecordCostBreakdown,
  RunRecordAuditResult,
  RunRecordLlmCall,
  RunRecordOutcome,
} from './types.js';

export {
  RUN_RECORD_SCHEMA_VERSION,
  emptyRunRecord,
} from './types.js';

export {
  redactRunRecord,
  redactPayload,
  redactStringValue,
  REDACTION_PLACEHOLDER,
} from './redact.js';
