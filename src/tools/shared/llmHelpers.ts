/**
 * LLM sub-call helpers shared across tool handlers.
 *
 * Pure logic — used by browser chat, hosted chat in sogni-api, and the skill
 * runtime so all three speak the same stream/timeout/strip contract.
 */

/** Timeout for non-thinking LLM sub-calls (image description, short completions). */
export const LLM_SUBCALL_TIMEOUT_MS = 20_000;

/**
 * Timeout for thinking-mode LLM sub-calls (creative prompt refinement).
 * Thinking mode needs more time: the model generates a `<think>` block first,
 * and longer videos produce longer prompts so generation time scales up.
 */
export const LLM_THINKING_TIMEOUT_MS = 75_000;

/**
 * Error thrown by `consumeStreamWithAbort` when the abort signal fires while
 * waiting for the next chunk. Caller catch blocks should treat this as a
 * graceful early exit (use the original/fallback value), not an error.
 */
export class StreamAbortError extends Error {
  constructor(label = 'stream') {
    super(`${label} aborted`);
    this.name = 'StreamAbortError';
  }
}

/**
 * Consume an async iterable, calling `onChunk` for each item, but terminating
 * promptly when `signal` aborts — even mid-await on the next chunk.
 *
 * Background: a plain `for await ... of` loop only checks the abort signal
 * BETWEEN chunks. If the iterator hangs waiting for the next chunk (e.g. an
 * LLM in its <think> phase generating no output), the abort never fires until
 * a chunk finally arrives. This helper races `iter.next()` against the abort
 * signal so abort takes effect immediately, and throws `StreamAbortError` so
 * the caller's catch block can fall through to the original/fallback value
 * instead of logging a stale post-abort "complete" message.
 *
 * The iterator's `return()` method is invoked on exit (best effort) so the
 * underlying source can clean up.
 */
export async function consumeStreamWithAbort<T>(
  stream: AsyncIterable<T>,
  signal: AbortSignal | undefined,
  onChunk: (chunk: T) => void,
  label = 'stream',
): Promise<void> {
  const iter = stream[Symbol.asyncIterator]();

  if (!signal) {
    try {
      while (true) {
        const { value, done } = await iter.next();
        if (done) break;
        onChunk(value);
      }
    } finally {
      try { await iter.return?.(); } catch { /* ignore */ }
    }
    return;
  }

  if (signal.aborted) {
    try { await iter.return?.(); } catch { /* ignore */ }
    throw new StreamAbortError(label);
  }

  let abortListener: (() => void) | undefined;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    abortListener = () => reject(new StreamAbortError(label));
    signal.addEventListener('abort', abortListener, { once: true });
  });

  try {
    while (true) {
      const result = await Promise.race([iter.next(), abortPromise]);
      if (result.done) break;
      onChunk(result.value as T);
    }
  } finally {
    if (abortListener) signal.removeEventListener('abort', abortListener);
    try { await iter.return?.(); } catch { /* ignore */ }
  }
}

/**
 * Race a factory-created promise against a timeout, with full abort plumbing.
 *
 * The factory receives a derived AbortSignal that fires when EITHER the
 * timeout elapses OR the parent signal aborts. The factory should pass this
 * signal to any underlying streaming LLM calls so server-side generation can
 * stop and tokens stop accruing on timeout/cancel.
 *
 * Returns undefined on timeout. Re-throws if the factory rejects before
 * timeout.
 */
export function withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
  parentSignal?: AbortSignal,
): Promise<T | undefined> {
  if (parentSignal?.aborted) {
    return Promise.resolve(undefined);
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let timedOut = false;

  const onParentAbort = () => controller.abort();
  if (parentSignal) parentSignal.addEventListener('abort', onParentAbort);

  const cleanup = () => {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
  };

  const factoryPromise = Promise.resolve().then(() => factory(controller.signal));

  const raced = Promise.race([
    factoryPromise.catch((err) => {
      if (timedOut) {
        console.warn(`[LLM HELPERS] ${label} rejected after timeout:`, err);
        return undefined;
      }
      throw err;
    }),
    new Promise<undefined>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        console.warn(`[LLM HELPERS] ${label} timed out after ${ms}ms — aborting stream`);
        controller.abort();
        resolve(undefined);
      }, ms);
    }),
  ]);

  raced.finally(cleanup);
  return raced;
}

function stripXmlTag(
  text: string,
  inside: boolean,
  openTag: string,
  closeTag: string,
): { cleaned: string; inside: boolean } {
  let result = '';
  let inTag = inside;
  let i = 0;

  while (i < text.length) {
    if (!inTag) {
      const openIdx = text.indexOf(openTag, i);
      if (openIdx === -1) {
        result += text.slice(i);
        break;
      }
      result += text.slice(i, openIdx);
      inTag = true;
      i = openIdx + openTag.length;
    } else {
      const closeIdx = text.indexOf(closeTag, i);
      if (closeIdx === -1) {
        break;
      }
      inTag = false;
      i = closeIdx + closeTag.length;
    }
  }

  return { cleaned: result, inside: inTag };
}

/**
 * Strip leaked `<tool_call>...</tool_call>` blocks (and `<think>...</think>`
 * blocks as a defensive belt-and-suspenders) from streamed content.
 *
 * Tool-call XML leaks when the LLM emits a tool call as raw text instead of
 * a structured JSON block — that leakage MUST never reach the user, and
 * `--reasoning-format deepseek` on the worker does NOT prevent it. The
 * tool-call stripping in this helper is still load-bearing in production.
 *
 * The think-block stripping is the legacy half: live workers separate
 * `<think>` content into `message.reasoning_content` automatically via the
 * Qwen3 chat template (`--jinja` + `--reasoning-format deepseek` pinned in
 * `sogni-llm-nvidia/launchParams.extraArgs`). It stays here as a no-op safety
 * net in case the runtime flag drifts; do not remove without first verifying
 * every served Qwen variant emits clean message.content.
 *
 * Returns the cleaned text and state flags for tracking across streamed
 * chunks. The legacy name is preserved to avoid churning ~10 call sites.
 */
export function stripThinkBlocks(
  text: string,
  insideThink: boolean,
  insideToolCall = false,
): { cleaned: string; insideThink: boolean; insideToolCall: boolean } {
  const thinkResult = stripXmlTag(text, insideThink, '<think>', '</think>');
  const toolCallResult = stripXmlTag(thinkResult.cleaned, insideToolCall, '<tool_call>', '</tool_call>');

  return {
    cleaned: toolCallResult.cleaned,
    insideThink: thinkResult.inside,
    insideToolCall: toolCallResult.inside,
  };
}

// Linear-time batch strips. Each scan removes a closed block and the
// whitespace after it, as the old `<think>[\s\S]*?</think>\s*` pattern
// (global, case-sensitive) and its `<tool_call>` twin did. Those scanned to
// the end of the text once per unclosed opening, so a reply holding many
// openings without a closing tag took quadratic time. Here an unclosed
// opening makes the second alternative consume the rest of the text in one
// pass, and removeClosedBlock returns that text unchanged. The old patterns
// left it alone too: no closing tag after one opening means none after any
// later opening. Group 1 is set only for a closed block.
const THINK_BLOCK_SCAN = /<think>(?:[\s\S]*?(<\/think>)\s*|[\s\S]*)/g;
const TOOL_CALL_BLOCK_SCAN = /<tool_call>(?:[\s\S]*?(<\/tool_call>)\s*|[\s\S]*)/g;

function removeClosedBlock(block: string, closing: string | undefined): string {
  return closing === undefined ? block : '';
}

/**
 * Batch variant of `stripThinkBlocks` for non-streaming contexts where the
 * full assistant message text is already in hand (e.g. `/v1/chat/completions`
 * response shaping in `sogni-api`, or one-shot synthesis paths that pass
 * `message.content` as a whole string). Returns the cleaned text — or
 * `null` / `undefined` unchanged so callers can pipe through nullable
 * `choices[0].message.content` shapes without extra guards.
 *
 * Use the streaming `stripThinkBlocks` when consuming SSE chunks; tags can
 * span chunks so streaming consumers need the (insideThink, insideToolCall)
 * state machine. Batch callers don't need state.
 *
 * Runs in linear time; see THINK_BLOCK_SCAN. An unclosed block is left in
 * place, as before.
 */
export function stripThinkBlocksFromText<T extends string | null | undefined>(content: T): T {
  if (content == null) return content;
  const cleaned = (content as string)
    .replace(THINK_BLOCK_SCAN, removeClosedBlock)
    .replace(TOOL_CALL_BLOCK_SCAN, removeClosedBlock)
    .trimStart();
  return cleaned as T;
}
