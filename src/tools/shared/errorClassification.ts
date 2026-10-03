/**
 * Error classification utilities for the tool-calling harness.
 *
 * Maps raw errors from tool execution into typed `LegacyToolErrorCategory`
 * values for structured error handling, observability, and retry decisions.
 *
 * Pure logic — no DOM/runtime deps. Used by hosted chat (sogni-api), the skill
 * runtime, and the browser chat product so all three classify failures the
 * same way.
 */
import type { LegacyToolErrorCategory } from '../result.js';
import { textRequiresVendorModelPremiumSpark } from '../../media/index.js';
import { errorMessageOf } from '../../utils/errors.js';

export interface ClassifiedError {
  category: LegacyToolErrorCategory;
  message: string;
  retryable: boolean;
}

/** Classify a raw error into a typed category. */
export function classifyError(error: unknown): ClassifiedError {
  if (!error) {
    return { category: 'permanent_failure', message: 'Unknown error', retryable: false };
  }

  const message = errorMessageOf(error);
  const lowerMsg = message.toLowerCase();

  if (textRequiresVendorModelPremiumSpark(lowerMsg)) {
    return { category: 'precondition_failed', message, retryable: false };
  }

  if (
    lowerMsg.includes('insufficient') ||
    lowerMsg.includes('insufficient_credits') ||
    (typeof error === 'object' && error !== null && (error as Record<string, unknown>).code === 4024)
  ) {
    return { category: 'insufficient_credits', message, retryable: true };
  }

  if (lowerMsg.includes('cancelled') || lowerMsg.includes('canceled') || lowerMsg.includes('abort')) {
    return { category: 'cancelled', message, retryable: false };
  }

  if (
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('no events received') ||
    lowerMsg.includes('no activity') ||
    lowerMsg.includes('inactivity')
  ) {
    return { category: 'timeout', message, retryable: true };
  }

  if (
    lowerMsg.includes('network') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('websocket') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('socket hang up') ||
    lowerMsg.includes('server restarting') ||
    lowerMsg.includes('serverrestarting') ||
    lowerMsg.includes('worker disconnected') ||
    lowerMsg.includes('workerdisconnected') ||
    lowerMsg.includes('502') ||
    lowerMsg.includes('503') ||
    lowerMsg.includes('504')
  ) {
    return { category: 'transient_failure', message, retryable: true };
  }

  if (lowerMsg.includes('parse') || lowerMsg.includes('malformed') || lowerMsg.includes('missing required')) {
    return { category: 'schema_validation', message, retryable: false };
  }

  if (
    lowerMsg.includes('content policy') ||
    lowerMsg.includes('sensitive content') ||
    lowerMsg.includes('sensitivecontent') ||
    lowerMsg.includes('nsfw') ||
    lowerMsg.includes('refused') ||
    lowerMsg.includes('not appropriate')
  ) {
    return { category: 'content_refused', message, retryable: false };
  }

  return { category: 'permanent_failure', message, retryable: false };
}

export interface ParsedToolResultError {
  hasError: boolean;
  error?: string;
  category?: LegacyToolErrorCategory;
  retryable?: boolean;
}

/** Check if a result JSON string contains an error. */
export function parseResultForError(rawResult: string): ParsedToolResultError {
  try {
    const parsed = JSON.parse(rawResult);
    if (parsed.error) {
      const classified = classifyError(parsed.error === 'insufficient_credits'
        ? new Error('insufficient_credits')
        : new Error(parsed.message || parsed.error));
      return {
        hasError: true,
        error: parsed.message || parsed.error,
        category: classified.category,
        retryable: classified.retryable,
      };
    }
    return { hasError: false };
  } catch {
    return { hasError: false };
  }
}
