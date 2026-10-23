/**
 * BytePlus's reason for a failed Seedance generation reaches the artist only
 * when its error object's code is InvalidParameter or InvalidParameter.* (the
 * artist's input). Other codes describe Sogni's own BytePlus account. Fixtures
 * match Sogni Web's (sogni-web 549f3b8c, errorMessages.test.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SEEDANCE_VENDOR_GENERATION_FAILED_MESSAGE,
  seedanceTerminalGenerationFailurePayloadFromError,
} from '../src/tools/index.js';

const failure = (message: string) => seedanceTerminalGenerationFailurePayloadFromError(new Error(message));

test('an aspect-ratio InvalidParameter shows BytePlus\'s reason without the request id', () => {
  const payload = failure(
    'Vendor job failed: Failed to submit Seedance task: 400 {"error":{"code":"InvalidParameter","message":"Error while downloading image, error: expected the aspect ratio to be between 0.39 and 2.50, but received image with 0.35 ratio. Request id: 021761234567890abcdef","param":"content[1]","type":"BadRequest"}}',
  );
  assert.equal(
    payload?.message,
    'Seedance rejected the request: Error while downloading image, error: expected the aspect ratio to be between 0.39 and 2.50, but received image with 0.35 ratio.',
  );
  assert.equal(payload && 'vendorErrorCode' in payload ? payload.vendorErrorCode : undefined, 'InvalidParameter');
});

test('a failed task\'s InvalidParameter.TaskTypeMismatch shows its message', () => {
  const task = {
    id: 'cgt-20261022',
    status: 'failed',
    error: {
      code: 'InvalidParameter.TaskTypeMismatch',
      message: 'You requested the video editing task type, but Seedance classified your task as video extension based on your prompt and input.',
    },
    output_format: 'mp4',
  };
  const payload = failure(`Vendor job failed: Vendor task cgt-20261022 ended with status=failed: ${JSON.stringify(task)}`);
  assert.equal(payload?.message, `Seedance rejected the request: ${task.error.message}`);
  assert.doesNotMatch(payload!.message, /cgt-|TaskTypeMismatch|status=/);
});

test('codes about Sogni\'s own BytePlus account, and messages with no code, stay generic', () => {
  for (const text of [
    'Vendor job failed: Failed to submit Seedance task: 403 {"error":{"code":"AccessDenied","message":"The request failed because you do not have access to the requested resource.","type":"Forbidden"}}',
    'Vendor job failed: Failed to submit Seedance task: 403 {"error":{"code":"AccountOverdueError","message":"The request failed because your account has an overdue balance.","type":"Forbidden"}}',
    'Vendor job failed: 400 {"message":"expected the aspect ratio to be between 0.39 and 2.50"}',
    'Vendor job failed: 500 {"error":{"code":"InternalServiceError"}}',
    'Vendor job failed: 400 {"error":{"code":"InvalidParameter","message":"  Request id: 0217"}}',
  ]) {
    const payload = failure(text);
    assert.equal(payload?.message, SEEDANCE_VENDOR_GENERATION_FAILED_MESSAGE, text);
    assert.doesNotMatch(payload!.message, /access|overdue|aspect ratio|InternalServiceError/i, text);
  }
});

test('a long reason is cut at a word', () => {
  const long = `expected ${'very '.repeat(80)}long input`;
  const payload = failure(`Vendor job failed: 400 {"error":{"code":"InvalidParameter","message":"${long}"}}`);
  const reason = payload!.message.replace('Seedance rejected the request: ', '');
  assert.ok(reason.length <= 301, `${reason.length}`);
  assert.ok(reason.endsWith('very…'), reason.slice(-20));
});
