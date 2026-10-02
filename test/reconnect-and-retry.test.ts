/**
 * Connect retries and project resubmission must respect Sogni's request budget.
 *
 * api.sogni.ai rate-limits per IP, and a blocked IP is blocked for everyone
 * behind it, so a failed connect must back off and stop on refusals instead of
 * retrying every 5 s forever. And a project Sogni has accepted must never be
 * submitted again: it may still be rendering, so a resubmit renders and bills
 * it twice.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, SogniClient } from '@sogni-ai/sogni-client';
import { SogniClientWrapper, SogniProjectError, SogniTimeoutError, SogniValidationError } from '../src';
import { isRetryableProjectSubmitError, reconnectDecision } from '../src/utils/helpers.js';

const BACKOFF = { baseMs: 5000, maxMs: 300_000, maxAttempts: 10, random: () => 0.5 };
const networkError = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) });

test('a failed connect backs off exponentially to a ceiling, then gives up', () => {
  const delays = [1, 2, 3, 4, 5, 6, 7, 8].map((attempt) => reconnectDecision(networkError(), attempt, BACKOFF).delayMs);
  assert.deepEqual(delays, [5000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000]);
  const jittered = reconnectDecision(networkError(), 1, { ...BACKOFF, random: () => 0 }).delayMs!;
  assert.equal(jittered, 4000);
  const stop = reconnectDecision(networkError(), 11, BACKOFF);
  assert.equal(stop.retry, false);
  assert.match(stop.reason!, /gave up after 10/);
});

test('refused credentials, socket refusals and other 4xx stop at once; a 429 waits for Retry-After', () => {
  assert.equal(reconnectDecision(new ApiError(401, { message: 'Unauthorized' } as any), 1, BACKOFF).retry, false);
  assert.equal(reconnectDecision(new ApiError(403, { message: 'Forbidden' } as any), 1, BACKOFF).retry, false);
  assert.equal(reconnectDecision({ code: 4021, message: 'Authentication error' }, 1, BACKOFF).retry, false);
  assert.equal(reconnectDecision(new ApiError(400, { message: 'Bad Request' } as any), 1, BACKOFF).retry, false);
  const limited = reconnectDecision(new ApiError(429, { message: 'Too Many Requests' } as any, '120'), 1, BACKOFF);
  assert.equal(limited.retry, true);
  assert.equal(limited.delayMs, 120_000);
  assert.equal(reconnectDecision(new ApiError(503, { message: 'Unavailable' } as any), 1, BACKOFF).retry, true);
});

/** Stub the SDK so connect() fails `failure` each time; counts clients created and disposed. */
function stubSdk(failure: () => unknown) {
  const original = (SogniClient as any).createInstance;
  const counts = { created: 0, disposed: 0 };
  (SogniClient as any).createInstance = async () => {
    counts.created += 1;
    return {
      projects: { on: () => undefined, off: () => undefined, waitForModels: async () => { throw failure(); } },
      chat: { on: () => undefined, off: () => undefined },
      dispose: () => { counts.disposed += 1; },
    };
  };
  return { counts, restore: () => { (SogniClient as any).createInstance = original; } };
}

function wrapperWith(config: Record<string, unknown>) {
  const client = new SogniClientWrapper({ apiKey: 'test-api-key', autoConnect: false, ...config } as any);
  const errors: any[] = [];
  client.on('error', (error) => errors.push(error));
  return { client, errors };
}

test('connect retries stop after maxReconnectAttempts and dispose every failed client', async () => {
  const sdk = stubSdk(networkError);
  const { client, errors } = wrapperWith({ reconnectInterval: 5, maxReconnectInterval: 20, maxReconnectAttempts: 2 });
  try {
    await assert.rejects(client.connect());
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(sdk.counts.created, 3, 'the first connect plus 2 retries, then it stops');
    assert.equal(sdk.counts.disposed, 3, 'no failed client is left holding the app id');
    assert.match(errors.at(-1)?.message ?? '', /Stopped reconnecting to Sogni: gave up after 2/);
    assert.equal(client.getConnectionState().status, 'failed');
  } finally {
    await client.dispose();
    sdk.restore();
  }
});

test('refused credentials are not retried', async () => {
  const sdk = stubSdk(() => new ApiError(401, { message: 'Unauthorized' } as any));
  const { client, errors } = wrapperWith({ reconnectInterval: 5 });
  try {
    await assert.rejects(client.connect());
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(sdk.counts.created, 1);
    assert.match(errors.at(-1)?.message ?? '', /refused the credentials/);
  } finally {
    await client.dispose();
    sdk.restore();
  }
});

test('only transient failures from before Sogni accepted a project may be resubmitted', () => {
  const accepted = Object.assign(new SogniProjectError('Project failed', undefined, networkError()), { projectId: 'p1' });
  assert.equal(isRetryableProjectSubmitError(accepted), false, 'a project that exists is never resubmitted');
  assert.equal(isRetryableProjectSubmitError(new SogniTimeoutError('Operation timed out', 1000)), false);
  assert.equal(isRetryableProjectSubmitError(new SogniValidationError('bad config')), false);
  assert.equal(isRetryableProjectSubmitError(new SogniProjectError('refused', undefined, { code: 4024, message: 'Insufficient funds' } as any)), false);
  assert.equal(isRetryableProjectSubmitError(new SogniProjectError('x', undefined, new ApiError(400, { message: 'Bad' } as any))), false);
  assert.equal(isRetryableProjectSubmitError(new SogniProjectError('x', undefined, new ApiError(429, { message: 'Slow down' } as any, '3600'))), false,
    'a 429 asking for an hour fails instead of waiting inside a create call');
  assert.equal(isRetryableProjectSubmitError(new SogniProjectError('x', undefined, new ApiError(429, { message: 'Slow down' } as any, '5'))), true);
  assert.equal(isRetryableProjectSubmitError(new SogniProjectError('x', undefined, new ApiError(502, { message: 'Bad gateway' } as any))), true);
  assert.equal(isRetryableProjectSubmitError(new SogniProjectError('x', undefined, networkError())), true);
});

test('createProjectWithRetry never resubmits a project that timed out while rendering', async () => {
  const { client } = wrapperWith({});
  let submitted = 0;
  const project = Object.assign(new (await import('node:events')).EventEmitter(), {
    id: 'project-1',
    jobs: [],
    waitForCompletion: () => new Promise(() => undefined),
  });
  const sdkClient = {
    projects: { create: async () => { submitted += 1; return project; }, on: () => undefined, off: () => undefined },
    chat: { on: () => undefined, off: () => undefined },
  };
  (client as any).client = sdkClient;
  (client as any).connectionState.isConnected = true;
  (client as any).prepareProjectConfig = async (config: unknown) => config;
  try {
    await assert.rejects(
      client.createProjectWithRetry({ type: 'image', modelId: 'test-model', positivePrompt: 'an apple', timeout: 20 } as any, { retryDelay: 1 }),
      (error: any) => error.projectId === 'project-1'
    );
    assert.equal(submitted, 1, 'submitted once; the timeout is not a reason to submit again');
  } finally {
    (client as any).client = null;
    await client.dispose();
  }
});
