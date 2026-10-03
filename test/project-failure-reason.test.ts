/**
 * A project that fails after Sogni accepted it must surface the socket's own
 * reason. The SDK rejects `waitForCompletion()` with a plain `ErrorData`
 * object (`{code, message}`), not an Error; turning that into a string
 * produced "[object Object]" and dropped the code, so callers could not tell an
 * empty balance from a refusal from a vendor failure.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { SogniClientWrapper, SogniProjectError } from '../src';
import { classifyError } from '../src/tools/shared/errorClassification.js';

async function failProjectWith(rejection: unknown): Promise<{ error: any; failedEvents: any[] }> {
  const client = new SogniClientWrapper({ apiKey: 'test-api-key', autoConnect: false } as any);
  client.on('error', () => undefined);
  const failedEvents: any[] = [];
  client.on('projectFailed', (payload) => failedEvents.push(payload));
  const project = Object.assign(new EventEmitter(), {
    id: 'project-1',
    jobs: [],
    waitForCompletion: () => Promise.reject(rejection),
  });
  (client as any).client = {
    projects: { create: async () => project, on: () => undefined, off: () => undefined },
    chat: { on: () => undefined, off: () => undefined },
  };
  (client as any).connectionState.isConnected = true;
  (client as any).prepareProjectConfig = async (config: unknown) => config;
  try {
    await client.createProject({ type: 'image', modelId: 'test-model', positivePrompt: 'an apple', timeout: 1000 } as any);
    assert.fail('createProject should have rejected');
  } catch (error) {
    return { error, failedEvents };
  } finally {
    (client as any).client = null;
    await client.dispose();
  }
}

test('a socket job failure keeps its message and code instead of "[object Object]"', async () => {
  const { error, failedEvents } = await failProjectWith({ code: 4024, message: 'Debit Error: Insufficient funds' });

  assert.ok(error instanceof SogniProjectError);
  assert.equal(error.message, 'Debit Error: Insufficient funds');
  assert.equal(error.details?.originalCode, 4024);
  assert.equal(error.projectId, 'project-1');
  assert.equal(classifyError(error).category, 'insufficient_credits');
  assert.equal(failedEvents.length, 1);
  assert.equal(failedEvents[0].message, 'Debit Error: Insufficient funds');
});

test('extra fields the socket sends with a failure stay available on the error', async () => {
  const rejection = { code: 4082, message: 'The Sensitive Content Filter must be disabled to use this model', isFromWorker: false };
  const { error } = await failProjectWith(rejection);

  assert.equal(error.message, rejection.message);
  assert.equal(error.details?.originalCode, 4082);
  assert.deepEqual(error.details?.originalDetails, rejection);
});

test('rejections without a usable message still read as a project failure, never "[object Object]"', async () => {
  for (const rejection of [{ code: 0 }, {}, null, undefined]) {
    const { error } = await failProjectWith(rejection);
    assert.equal(error.message, 'Project creation failed', `rejection ${JSON.stringify(rejection)}`);
  }
  const { error } = await failProjectWith('worker disconnected');
  assert.equal(error.message, 'worker disconnected');
  assert.equal(classifyError(error).category, 'transient_failure');
});

test('SogniError.fromError and errorMessageOf read the SDK ErrorData shape', async () => {
  const { SogniError, errorMessageOf } = await import('../src/utils/errors.js');
  const wrapped = SogniError.fromError({ code: 4063, message: 'Premium Spark required' }, 'GET_SIZE_PRESETS_FAILED');
  assert.equal(wrapped.message, 'Premium Spark required');
  assert.equal(wrapped.code, 'GET_SIZE_PRESETS_FAILED');
  assert.deepEqual(wrapped.details, { originalCode: 4063, originalDetails: { code: 4063, message: 'Premium Spark required' } });
  assert.equal(errorMessageOf({ error: 'x' }), 'Unknown error');
  assert.equal(errorMessageOf(new Error('')), 'Unknown error');
  assert.equal(errorMessageOf(42), '42');
});
