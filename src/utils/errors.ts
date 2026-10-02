/**
 * Custom error classes for Sogni Client Wrapper
 */

import type { ErrorData } from '../types/index.js';

/**
 * Base error class for all Sogni-related errors
 */
export class SogniError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: any;
  public readonly originalError?: Error;
  /**
   * Set when the error happened after Sogni accepted the project: it exists and
   * may still be running, so submitting it again would render and bill it twice.
   */
  public projectId?: string;

  constructor(message: string, code: string, statusCode?: number, details?: any, originalError?: Error) {
    super(message);
    this.name = 'SogniError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.originalError = originalError;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to ErrorData format
   */
  toErrorData(): ErrorData {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      originalError: this.originalError,
    };
  }

  /**
   * Create SogniError from unknown error
   */
  static fromError(error: unknown, code: string = 'UNKNOWN_ERROR'): SogniError {
    if (error instanceof SogniError) {
      return error;
    }

    if (error instanceof Error) {
      return new SogniError(error.message, code, undefined, undefined, error);
    }

    return new SogniError(String(error), code);
  }
}

/**
 * Connection-related errors
 */
export class SogniConnectionError extends SogniError {
  constructor(message: string, details?: any, originalError?: Error) {
    super(message, 'CONNECTION_ERROR', undefined, details, originalError);
    this.name = 'SogniConnectionError';
  }
}

/**
 * Authentication-related errors
 */
export class SogniAuthenticationError extends SogniError {
  constructor(message: string, details?: any, originalError?: Error) {
    super(message, 'AUTHENTICATION_ERROR', 401, details, originalError);
    this.name = 'SogniAuthenticationError';
  }
}

/**
 * Project creation and execution errors
 */
export class SogniProjectError extends SogniError {
  constructor(message: string, details?: any, originalError?: Error) {
    super(message, 'PROJECT_ERROR', undefined, details, originalError);
    this.name = 'SogniProjectError';
  }
}

/**
 * Timeout errors
 */
export class SogniTimeoutError extends SogniError {
  constructor(message: string, timeoutMs: number, details?: any) {
    super(message, 'TIMEOUT_ERROR', 408, { ...details, timeoutMs }, undefined);
    this.name = 'SogniTimeoutError';
  }
}

/**
 * Insufficient balance errors
 */
export class SogniBalanceError extends SogniError {
  constructor(message: string, details?: any) {
    super(message, 'INSUFFICIENT_BALANCE', 402, details, undefined);
    this.name = 'SogniBalanceError';
  }
}

/**
 * Validation errors
 */
export class SogniValidationError extends SogniError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details, undefined);
    this.name = 'SogniValidationError';
  }
}

/**
 * Configuration errors
 */
export class SogniConfigurationError extends SogniError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', undefined, details, undefined);
    this.name = 'SogniConfigurationError';
  }
}

/**
 * Model not found errors
 */
export class SogniModelNotFoundError extends SogniError {
  constructor(modelId: string) {
    super(`Model not found: ${modelId}`, 'MODEL_NOT_FOUND', 404, { modelId }, undefined);
    this.name = 'SogniModelNotFoundError';
  }
}

/**
 * Network errors
 */
export class SogniNetworkError extends SogniError {
  constructor(message: string, details?: any, originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, details, originalError);
    this.name = 'SogniNetworkError';
  }
}

