import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resumeDurableCreativeWorkflow,
  startDurableCreativeWorkflow,
} from '../src/runtime/durableWorkflowClient.js';

test('durable start sends the caller preference through HTTP and preserves the response', async () => {
  for (const preference of [true, false, undefined]) {
    const requests: Record<string, unknown>[] = [];
    const options = {
      apiBaseUrl: 'https://api.example.test',
      apiKey: 'test-key',
      safeContentFilter: preference,
      fetchImpl: (async (url, init) => {
        assert.equal(String(url), 'https://api.example.test/v1/creative-agent/workflows');
        assert.equal(init?.method, 'POST');
        requests.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({
          data: { workflow: { workflowId: 'wf-test', status: 'queued', safeContentFilter: false } },
        }), { status: 201 });
      }) as typeof fetch,
    };
    const input = { steps: [], safe_content_filter: !preference, safeContentFilter: !preference };
    const workflow = await startDurableCreativeWorkflow(input, options);
    assert.equal(workflow.safeContentFilter, false);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].input, input);
    assert.equal(requests[0].safe_content_filter, preference);
    assert.equal(Object.hasOwn(requests[0], 'safe_content_filter'), preference !== undefined);
    assert.equal(Object.hasOwn(requests[0], 'safeContentFilter'), false);
  }
});

test('resume does not send a new preference and retains the stored response value', async () => {
  const result = await resumeDurableCreativeWorkflow('wf-test', {
    apiBaseUrl: 'https://api.example.test',
    apiKey: 'test-key',
    safeContentFilter: true,
    fetchImpl: (async (url, init) => {
      assert.equal(String(url), 'https://api.example.test/v1/creative-agent/workflows/wf-test/resume');
      const body = JSON.parse(String(init?.body ?? '{}'));
      assert.equal(Object.hasOwn(body, 'safe_content_filter'), false);
      assert.equal(Object.hasOwn(body, 'safeContentFilter'), false);
      return new Response(JSON.stringify({
        data: { workflow: { workflowId: 'wf-test', status: 'running', safeContentFilter: false }, resumed: true },
      }));
    }) as typeof fetch,
  });
  assert.equal(result.workflow.safeContentFilter, false);
  assert.equal(result.resumed, true);
});
