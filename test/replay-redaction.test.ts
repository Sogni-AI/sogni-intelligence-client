import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyRunRecord, redactPayload, redactRunRecord, redactStringValue } from '../src/replay/index.js';

const EXAMPLE_KEY = '00000000-0000-4000-8000-000000000001';

test('labelled credentials are filtered without changing ordinary identifiers', () => {
  for (const text of [
    `My Sogni API key is ${EXAMPLE_KEY}`,
    `api-key: ${EXAMPLE_KEY}`,
    `SOGNI_API_KEY=${EXAMPLE_KEY}`,
    JSON.stringify({ apiKey: EXAMPLE_KEY }),
    `https://example.invalid/?api_key=${EXAMPLE_KEY}&page=2`,
    `bearer ${EXAMPLE_KEY}`,
    `apiKey=\`${EXAMPLE_KEY}\``,
  ]) {
    const result = redactStringValue(text);
    assert.ok(!result.includes(EXAMPLE_KEY), text);
    assert.ok(result.includes('[REDACTED]'));
    assert.equal(redactStringValue(result), result);
  }
  assert.equal(redactStringValue(`Project ${EXAMPLE_KEY}`), `Project ${EXAMPLE_KEY}`);
  assert.equal(redactStringValue('password="two word example"'), 'password="[REDACTED]"');
  assert.deepEqual(JSON.parse(redactStringValue(JSON.stringify({ apiKey: EXAMPLE_KEY }))), { apiKey: '[REDACTED]' });
  assert.deepEqual(JSON.parse(redactStringValue(JSON.stringify({ apiKey: 'example"with\\escapes' }))), { apiKey: '[REDACTED]' });
  assert.equal(redactStringValue(`https://example.invalid/?api_key=${EXAMPLE_KEY}&page=2`), 'https://example.invalid/?api_key=[REDACTED]&page=2');
});

test('records filter every nested field, including extensions and audit messages', () => {
  const record = {
    ...emptyRunRecord(),
    run_id: EXAMPLE_KEY,
    job_ids: [EXAMPLE_KEY],
    sourceUpdateTime: 1234,
    user_request: `My Sogni API key is ${EXAMPLE_KEY}`,
    final_response: `apiKey=${EXAMPLE_KEY}`,
    extra: { nested: [{ apiKey: EXAMPLE_KEY }] },
    audit_results: [{ message: `api-key: ${EXAMPLE_KEY}` }],
    rounds: [{
      round: 1,
      assistant_message: `apiKey=${EXAMPLE_KEY}`,
      extra: { password: 'example-password' },
      tool_calls: [{ name: 'example', arguments: { credentials: { apiKey: EXAMPLE_KEY } }, extra: { apiKey: EXAMPLE_KEY } }],
      tool_results: [{ ok: true, payload: { nested: { apiKey: EXAMPLE_KEY } } }],
    }],
    redacted: true,
  };
  const before = JSON.stringify(record);
  const result = redactRunRecord(record as unknown as ReturnType<typeof emptyRunRecord>) as unknown as typeof record;
  assert.equal(JSON.stringify(record), before);
  assert.equal(result.run_id, EXAMPLE_KEY);
  assert.deepEqual(result.job_ids, [EXAMPLE_KEY]);
  assert.equal(result.sourceUpdateTime, 1234);
  assert.equal(result.extra.nested[0].apiKey, '[REDACTED]');
  assert.equal(result.rounds[0].extra.password, '[REDACTED]');
  assert.equal(result.rounds[0].tool_calls[0].extra.apiKey, '[REDACTED]');
  assert.equal(result.rounds[0].tool_results[0].payload.nested.apiKey, '[REDACTED]');
  assert.ok(!JSON.stringify({ ...result, run_id: '', job_ids: [] }).includes(EXAMPLE_KEY));
  assert.deepEqual(redactRunRecord(result as unknown as ReturnType<typeof emptyRunRecord>), result);
});

test('a turn outcome keeps its diagnostics and loses credentials in its message', () => {
  const record = {
    ...emptyRunRecord(),
    outcome: {
      status: 'failed' as const,
      error_code: 'llm_worker_interrupted',
      error_message: `Streaming job timed out; apiKey=${EXAMPLE_KEY}`,
      llm_calls: [{
        job_id: '5CF7173A-EDFC-439D-B3E4-179D65A62E8D',
        model: 'deepseek-v4-flash-vision-exp-dspark-1m',
        worker_name: 'sparks #873',
        finish_reason: 'stop',
        prompt_tokens: 17763,
        completion_tokens: 108,
        duration_ms: 19605,
      }],
    },
  };
  const result = redactRunRecord(record);
  assert.equal(result.outcome?.error_message, 'Streaming job timed out; apiKey=[REDACTED]');
  assert.deepEqual(result.outcome?.llm_calls, record.outcome.llm_calls);
  assert.equal(result.outcome?.error_code, 'llm_worker_interrupted');
});

test('provider keys with separators are filtered in full on repeated calls', () => {
  for (const prefix of ['sk-', 'sk-proj-', 'sk-ant-']) {
    const key = `${prefix}${'a'.repeat(24)}_${'b'.repeat(24)}-${'c'.repeat(24)}`;
    for (let i = 0; i < 3; i += 1) assert.equal(redactStringValue(key), '[REDACTED]');
  }
});

test('signed URL query values and structured signature fields are filtered', () => {
  const value = `https://example.invalid/file.png?X-Amz-Credential=${EXAMPLE_KEY}&X-Amz-Signature=${EXAMPLE_KEY}`;
  assert.ok(!redactStringValue(value).includes(EXAMPLE_KEY));
  assert.ok(redactStringValue(value).startsWith('https://example.invalid/file.png?'));
  const result = redactPayload({ fields: { 'X-Amz-Signature': EXAMPLE_KEY, 'X-Amz-Credential': EXAMPLE_KEY, key: 'ordinary/object.png' } });
  assert.deepEqual(result, { fields: { 'X-Amz-Signature': '[REDACTED]', 'X-Amz-Credential': '[REDACTED]', key: 'ordinary/object.png' } });
});

test('JSON property names do not change the result prototype', () => {
  const input = JSON.parse('{"__proto__":{"apiKey":"example"},"constructor":{"secret":"example"}}');
  const result = redactPayload(input) as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.hasOwn(result, '__proto__'), true);
  assert.equal((result.__proto__ as Record<string, unknown>).apiKey, '[REDACTED]');
  assert.equal((result.constructor as unknown as Record<string, unknown>).secret, '[REDACTED]');
});

test('deep and circular payloads stay bounded', () => {
  const input: Record<string, unknown> = { apiKey: EXAMPLE_KEY };
  input.self = input;
  input.second = input;
  const result = redactPayload(input);
  assert.ok(JSON.stringify(result).length < 3000);
  assert.ok(!JSON.stringify(result).includes(EXAMPLE_KEY));
});

test('repeated references are preserved but deep branches are bounded', () => {
  const shared = { text: 'ordinary' };
  assert.deepEqual(redactPayload([shared, shared]), [shared, shared]);
  let deep: unknown = 'end';
  for (let i = 0; i < 100; i += 1) deep = { child: deep };
  assert.ok(!JSON.stringify(redactPayload(deep)).includes('end'));
});

test('complete and incomplete private keys and JWT candidates have bounded work', () => {
  assert.equal(redactStringValue('before -----BEGIN RSA PRIVATE KEY-----\nexample\n-----END RSA PRIVATE KEY----- after'), 'before [REDACTED] after');
  assert.equal(redactStringValue('-----BEGIN PRIVATE KEY-----'.repeat(30_000)), '[REDACTED]');
  const malformed = 'eyJaaaaaaaaaaaa-'.repeat(50_000);
  assert.equal(redactStringValue(malformed), malformed);
  assert.equal(redactStringValue(`eyJ${'a'.repeat(20)}.${'b'.repeat(20)}.${'c'.repeat(20)}`), '[REDACTED]');
});

test('ordinary replay content and numeric metadata remain intact', () => {
  const record = { ...emptyRunRecord(), run_id: EXAMPLE_KEY, user_request: 'Draw a pink sloth.', runtime_config: { tokens: 300, temperature: 0.7 }, total_cost: { totalUsd: 0.02 } };
  assert.deepEqual(redactRunRecord(record), { ...record, redacted: true });
});
