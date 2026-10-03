import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateTotalTokens, trimConversation } from '../src/context/index.js';
import type { ChatMessage } from '../src/runtime/chatTypes.js';

const system: ChatMessage = { role: 'system', content: 'Follow user instructions in chronological order.' };
const user = (content: string): ChatMessage => ({ role: 'user', content });
const assistant = (content: string): ChatMessage => ({ role: 'assistant', content });
const filler = () => assistant('Older explanation. '.repeat(160));
const userText = (messages: ChatMessage[]) => messages.filter((message) => message.role === 'user')
  .flatMap((message) => typeof message.content === 'string' ? [message.content]
    : Array.isArray(message.content) ? message.content.filter((part) => part.type === 'text').map((part) => part.text) : []);

test('compaction preserves requirements after the first sentence and later corrections verbatim', () => {
  const requirements = 'Create a poster. Keep ACME-LOCKED-TEXT exact and never add a watermark.';
  const correction = 'Change the background to blue. Replace the title with "新しい見出し"; keep everything else.';
  const messages = [user(requirements), filler(), user(correction), filler(), user('Continue.'), assistant('Ready.')];
  const snapshot = JSON.stringify(messages);
  const result = trimConversation(messages, system, 550);
  assert.ok(result.trimmedCount > 0);
  assert.ok(result.afterTokens <= 550);
  const texts = userText(result.messages);
  assert.ok(texts.includes(requirements));
  assert.ok(texts.includes(correction));
  assert.ok(texts.indexOf(requirements) < texts.indexOf(correction));
  assert.ok(texts.indexOf(correction) < texts.indexOf('Continue.'));
  assert.equal(JSON.stringify(messages), snapshot);
});

test('literal summary-like text, newlines, and arbitrary long-tail constraints are not extracted or shortened', () => {
  const requirement = '[Earlier: print these brackets.]\nAn introductory paragraph. '
    + 'Background context. '.repeat(80) + '\n最终文字: 保留全部。';
  const result = trimConversation([user(requirement), filler(), user('Continue.'), assistant('Ready.')], system, 700);
  assert.ok(result.afterTokens <= 700);
  assert.ok(userText(result.messages).includes(requirement));
});

test('constraints survive repeated compaction without restoring an obsolete correction as a current rule', () => {
  const first = 'Use a red background. Copy "Spring" exactly.';
  const replacement = 'Replace the red background with green and replace "Spring" with "Summer".';
  const firstResult = trimConversation([user(first), filler(), user(replacement), filler(), user('Continue.'), assistant('Ready.')], system, 550);
  const secondResult = trimConversation([...firstResult.messages, filler(), user('Use that revision.'), assistant('Ready.')], system, 550);
  const texts = userText(secondResult.messages);
  assert.ok(texts.includes(first));
  assert.ok(texts.includes(replacement));
  assert.equal(texts.filter((text) => text === first).length, 1);
  assert.equal(texts.filter((text) => text === replacement).length, 1);
  assert.ok(texts.indexOf(first) < texts.indexOf(replacement));
  assert.ok(secondResult.afterTokens <= 550);
});

test('older media compacts without losing any accompanying text parts', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: [
      { type: 'text', text: 'Use this reference.\nPreserve the exact logo.' },
      { type: 'image_url', image_url: { url: 'https://example.com/reference.png' } },
      { type: 'text', text: 'Do not alter "ACME".' },
    ] },
    filler(), user('Continue.'), assistant('Ready.'),
  ];
  const result = trimConversation(messages, system, 550);
  assert.ok(result.afterTokens <= 550);
  assert.deepEqual(result.messages[0].content, [messages[0].content[0], messages[0].content[2]]);
});

test('image-only old turns compact normally and protected images stay untouched', () => {
  const oldImage: ChatMessage = { role: 'user', content: [
    { type: 'image_url', image_url: { url: 'https://example.com/old.png' } },
  ] };
  const protectedImage: ChatMessage = { role: 'user', content: [
    { type: 'image_url', image_url: { url: 'https://example.com/latest.png', detail: 'low' } },
    { type: 'text', text: 'Use this latest image.' },
  ] };
  const result = trimConversation([oldImage, filler(), protectedImage, assistant('Ready.')], system, 550);
  assert.ok(result.afterTokens <= 550);
  assert.ok(!result.messages.includes(oldImage));
  assert.ok(result.messages.includes(protectedImage));
  assert.ok(JSON.stringify(result.messages).includes('User uploaded media'));
});

test('unfit original user text returns overflow instead of silently deleting a constraint', () => {
  const requirements = 'Create a poster. ' + 'Required detail. '.repeat(300) + 'NEVER-LOSE-THIS-TAIL';
  const messages = [user(requirements), filler(), user('Continue.'), assistant('Ready.')];
  const result = trimConversation(messages, system, 100);
  assert.ok(result.afterTokens > result.inputBudget);
  assert.ok(result.availableTokens < 0);
  assert.ok(userText(result.messages).includes(requirements));
  assert.equal(result.afterTokens, estimateTotalTokens(result.messages) + estimateTotalTokens([system]));
});

test('under-budget conversation is unchanged and tool-call groups remain balanced when compacted', () => {
  const small = [user('Hello.'), assistant('Ready.')];
  assert.equal(trimConversation(small, system, 550).messages, small);
  const messages: ChatMessage[] = [user('Preserve the text.'), filler(),
    { role: 'assistant', content: '', tool_calls: [{ id: 'call-1', function: { name: 'generate_image', arguments: '{"prompt":"Logo"}' } }] },
    { role: 'tool', tool_call_id: 'call-1', name: 'generate_image', content: '{"ok":true,"resultCount":1,"startIndex":0}' },
    user('Continue.'), assistant('Ready.'),
  ];
  const result = trimConversation(messages, system, 150);
  const calls = result.messages.flatMap((message) => message.tool_calls?.map((call) => call.id) || []);
  const results = result.messages.filter((message) => message.role === 'tool').map((message) => message.tool_call_id);
  assert.deepEqual(calls, results);
});
