import assert from 'node:assert/strict';
import test from 'node:test';
import { assertContextFitsBudget, ContextBudgetExceededError, trimConversation } from '../src/context/index.js';
import type { ChatMessage } from '../src/runtime/chatTypes.js';

const system: ChatMessage = { role: 'system', content: 'Preserve user instructions.' };

test('protected prompts return intact and are rejected before a caller dispatches', () => {
  const messages: ChatMessage[] = [{ role: 'user', content: 'Detailed requirement. '.repeat(200) }];
  const before = JSON.stringify(messages);
  const compacted = trimConversation(messages, system, 100);
  assert.equal(compacted.action, 'over_budget_untrimmed');
  let dispatches = 0;
  assert.throws(() => {
    assertContextFitsBudget(compacted);
    dispatches += 1;
  }, (error: unknown) => {
    assert.ok(error instanceof ContextBudgetExceededError);
    assert.equal(error.code, 'CONTEXT_BUDGET_EXCEEDED');
    assert.equal(error.estimatedTokens, compacted.afterTokens);
    assert.equal(error.inputBudget, 100);
    return true;
  });
  assert.equal(dispatches, 0);
  assert.equal(JSON.stringify(messages), before);
  assert.equal(compacted.messages, messages);
});

test('trimmed payloads are checked rather than assumed to fit', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: 'Earlier.' },
    { role: 'assistant', content: 'Ready.' },
    { role: 'user', content: 'Latest protected instructions. '.repeat(200) },
    { role: 'assistant', content: 'Ready.' },
  ];
  const compacted = trimConversation(messages, system, 100);
  assert.equal(compacted.action, 'trimmed');
  assert.throws(() => assertContextFitsBudget(compacted), ContextBudgetExceededError);
});

test('valid and exact-fit estimates dispatch, including an empty zero budget', () => {
  for (const [afterTokens, inputBudget] of [[0, 0], [100, 100], [99, 100]]) {
    assert.doesNotThrow(() => assertContextFitsBudget({ afterTokens, inputBudget }));
  }
  assert.doesNotThrow(() => assertContextFitsBudget(trimConversation(
    [{ role: 'user', content: 'Hello.' }], system, 100,
  )));
});

test('invalid estimates cannot silently bypass the pre-dispatch check', () => {
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
    assert.throws(() => assertContextFitsBudget({ afterTokens: invalid, inputBudget: 100 }), RangeError);
    assert.throws(() => assertContextFitsBudget({ afterTokens: 1, inputBudget: invalid }), RangeError);
  }
});
