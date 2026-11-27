/**
 * Workflow executor — per-slot retry-callback primitive tests.
 *
 * Source-level (tsx) tests for the out-of-band per-slot callback, bounded
 * per-slot retry, and bounded-concurrency parallel fan-out added to the
 * batch-stage runner. These run against `src/workflows/executor.ts`
 * directly so the TDD loop stays fast (no dist build).
 */
import { executeRun, createRun } from '../src/workflows/executor.js';
import type { RunStore, ToolDispatcher } from '../src/workflows/executor-ports.js';
import type { SlotEvent } from '../src/workflows/executor.js';
import type { Run, WorkflowTemplate } from '../src/workflows/types.js';

let testsPassed = 0;
let testsFailed = 0;

function ok(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    testsFailed++;
  }
}

function eq<T>(label: string, actual: T, expected: T): void {
  ok(label, JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function memoryStore(): RunStore {
  const map = new Map<string, Run>();
  return {
    get: async (id) => map.get(id) ?? null,
    save: async (run) => { map.set(run.id, run); },
  };
}

function batchTemplate(
  overrides: Partial<{
    concurrency: number;
    maxAttemptsPerItem: number;
    onError: 'stop' | 'continue' | 'skip' | 'retry_once';
  }> = {},
): WorkflowTemplate {
  return {
    id: 'wf_batch',
    version: '1.0.0',
    name: 'Batch',
    description: '',
    category: 'video-social',
    stability: 'experimental',
    author: 'system',
    visibility: 'private',
    inputs: [{ name: 'clips', type: 'text', required: true, description: 'c', internal: true }],
    stages: [
      {
        type: 'batch',
        id: 'render',
        overBinding: '$inputs.clips',
        itemName: 'clip',
        produces: ['videos'],
        partialExecutionEnabled: true,
        ...(overrides.concurrency !== undefined ? { concurrency: overrides.concurrency } : {}),
        ...(overrides.maxAttemptsPerItem !== undefined
          ? { maxAttemptsPerItem: overrides.maxAttemptsPerItem }
          : {}),
        ...(overrides.onError !== undefined ? { onError: overrides.onError } : {}),
        itemStage: {
          type: 'fixed',
          id: 'render_item',
          tool: 'generate_video',
          args: { prompt: '$item.prompt' },
        },
      },
    ],
    exposeToLLM: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

/**
 * Dispatcher that fails the first N attempts for each distinct prompt
 * (returning an `ok:false` error envelope, the way a real media tool does),
 * then succeeds. Attempts are tracked per prompt so multi-slot fan-out tests
 * are deterministic.
 */
function flakyDispatch(failuresByPrompt: Record<string, number>): ToolDispatcher {
  const attempts: Record<string, number> = {};
  return {
    has: () => true,
    execute: async (toolName, args) => {
      const prompt = String((args as { prompt?: unknown }).prompt ?? '');
      attempts[prompt] = (attempts[prompt] ?? 0) + 1;
      const budget = failuresByPrompt[prompt] ?? 0;
      if (attempts[prompt] <= budget) {
        return JSON.stringify({ ok: false, error: `transient ${prompt} #${attempts[prompt]}` });
      }
      return JSON.stringify({ ok: true, videoResultUrls: [`https://fake/${toolName}-${prompt}.mp4`] });
    },
  };
}

async function drain(gen: AsyncGenerator<unknown, unknown, undefined>): Promise<void> {
  // Pump to completion; this primitive never pauses (no checkpoints here).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of gen) { /* consume */ }
}

async function pump(gen: AsyncGenerator<unknown, Run, undefined>): Promise<Run> {
  // Pump to completion and return the generator's final Run value.
  let next = await gen.next();
  while (!next.done) next = await gen.next();
  return next.value;
}

// ---------------------------------------------------------------------------
// Task 1 — onSlotEvent bridges in-flight tool progress with slot identity
// ---------------------------------------------------------------------------

async function testSlotProgressBridge(): Promise<void> {
  const store = memoryStore();
  // Dispatcher reports progress mid-execution, the way a real media tool does.
  const dispatch: ToolDispatcher = {
    has: () => true,
    execute: async (toolName, args, _ctx, callbacks) => {
      const cb = callbacks as { onToolProgress?: (p: unknown) => void };
      cb.onToolProgress?.({ type: 'progress', toolName, progress: 0.5 });
      return JSON.stringify({ ok: true, videoResultUrls: [`https://fake/${toolName}.mp4`] });
    },
  };
  const run = await createRun({
    workflow: batchTemplate(),
    inputs: { clips: [{ prompt: 'a' }, { prompt: 'b' }] },
    store,
  });

  const slotEvents: SlotEvent[] = [];
  await drain(executeRun(run.id, {
    store,
    dispatch,
    context: {},
    callbacks: { onToolProgress: () => { /* consumer sink */ } },
    onSlotEvent: (e) => slotEvents.push(e),
  }));

  const progress0 = slotEvents.find((e) => e.phase === 'progress' && e.index === 0);
  ok('slot 0 emits a progress event', !!progress0);
  eq('progress event carries slot itemId', progress0?.itemId, 'render/0');
  eq('progress event carries stageId', progress0?.stageId, 'render');
  eq('progress event attempt is 1', progress0?.attempt, 1);
  eq('progress event forwards the tool progress payload',
    (progress0?.toolProgress as { progress?: number } | undefined)?.progress, 0.5);

  const progress1 = slotEvents.find((e) => e.phase === 'progress' && e.index === 1);
  eq('slot 1 also emits progress with its own itemId', progress1?.itemId, 'render/1');

  // Lifecycle phases per slot.
  ok('slot 0 emits started', slotEvents.some((e) => e.phase === 'started' && e.index === 0));
  ok('slot 0 emits completed', slotEvents.some((e) => e.phase === 'completed' && e.index === 0));
  ok('slot 1 emits completed', slotEvents.some((e) => e.phase === 'completed' && e.index === 1));
}

// ---------------------------------------------------------------------------
// Task 2 — bounded per-slot retry
// ---------------------------------------------------------------------------

async function testSlotRetriesTransientFailure(): Promise<void> {
  const store = memoryStore();
  const run = await createRun({
    workflow: batchTemplate({ maxAttemptsPerItem: 2 }),
    inputs: { clips: [{ prompt: 'a' }] },
    store,
  });

  const slotEvents: SlotEvent[] = [];
  const finalRun = await pump(executeRun(run.id, {
    store,
    dispatch: flakyDispatch({ a: 1 }), // fail attempt 1, succeed attempt 2
    context: {},
    callbacks: {},
    onSlotEvent: (e) => slotEvents.push(e),
  }));

  const retrying = slotEvents.find((e) => e.phase === 'retrying' && e.index === 0);
  ok('slot emits a retrying event after a transient failure', !!retrying);
  eq('retrying event reports attempt 2', retrying?.attempt, 2);
  ok('retrying event carries the failure reason', !!retrying?.error);
  ok('slot ultimately completes', slotEvents.some((e) => e.phase === 'completed' && e.index === 0));
  ok('no failed event once the retry succeeds', !slotEvents.some((e) => e.phase === 'failed'));
  eq('run completes', finalRun.state, 'completed');
  // Only the successful version is recorded.
  eq('item has exactly one (successful) version',
    finalRun.artifacts.videos?.items[0]?.versions.length, 1);
}

async function testSlotRetryExhaustionHonorsOnErrorContinue(): Promise<void> {
  const store = memoryStore();
  const run = await createRun({
    workflow: batchTemplate({ maxAttemptsPerItem: 2, onError: 'continue' }),
    inputs: { clips: [{ prompt: 'a' }, { prompt: 'b' }] },
    store,
  });

  const slotEvents: SlotEvent[] = [];
  const finalRun = await pump(executeRun(run.id, {
    store,
    dispatch: flakyDispatch({ a: 99, b: 99 }), // both always fail
    context: {},
    callbacks: {},
    onSlotEvent: (e) => slotEvents.push(e),
  }));

  eq('slot a retried up to the budget then failed',
    slotEvents.filter((e) => e.index === 0 && e.phase === 'retrying').length, 1);
  ok('slot a emits failed after exhausting retries',
    slotEvents.some((e) => e.index === 0 && e.phase === 'failed'));
  ok('slot b is still attempted (onError: continue)',
    slotEvents.some((e) => e.index === 1 && e.phase === 'started'));
  ok('slot b also fails', slotEvents.some((e) => e.index === 1 && e.phase === 'failed'));
  eq('run still completes despite per-slot failures', finalRun.state, 'completed');
}

async function testRetryOnceBackCompat(): Promise<void> {
  const store = memoryStore();
  const run = await createRun({
    workflow: batchTemplate({ onError: 'retry_once' }), // no explicit maxAttemptsPerItem
    inputs: { clips: [{ prompt: 'a' }] },
    store,
  });

  const slotEvents: SlotEvent[] = [];
  const finalRun = await pump(executeRun(run.id, {
    store,
    dispatch: flakyDispatch({ a: 1 }),
    context: {},
    callbacks: {},
    onSlotEvent: (e) => slotEvents.push(e),
  }));

  ok("onError: 'retry_once' grants exactly one retry",
    slotEvents.some((e) => e.phase === 'retrying' && e.attempt === 2));
  ok('slot completes on the retry', slotEvents.some((e) => e.phase === 'completed'));
  eq('run completes', finalRun.state, 'completed');
}

// ---------------------------------------------------------------------------
// Task 3 — bounded-concurrency parallel fan-out
// ---------------------------------------------------------------------------

/**
 * Dispatcher that records the peak number of simultaneously in-flight calls.
 * Each call holds briefly so genuine overlap is observable.
 */
function concurrencyTrackingDispatch(): { dispatch: ToolDispatcher; peak: () => number } {
  let inFlight = 0;
  let peak = 0;
  const dispatch: ToolDispatcher = {
    has: () => true,
    execute: async (toolName, args) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      const prompt = String((args as { prompt?: unknown }).prompt ?? '');
      return JSON.stringify({ ok: true, videoResultUrls: [`https://fake/${toolName}-${prompt}.mp4`] });
    },
  };
  return { dispatch, peak: () => peak };
}

function clips(n: number): Array<{ prompt: string }> {
  return Array.from({ length: n }, (_, i) => ({ prompt: `c${i}` }));
}

function allItemsHaveVersion(run: Run): boolean {
  const items = run.artifacts.videos?.items ?? [];
  return items.length > 0 && items.every((it) => it.versions.length === 1);
}

async function testConcurrencyCapHonored(): Promise<void> {
  const store = memoryStore();
  const { dispatch, peak } = concurrencyTrackingDispatch();
  const run = await createRun({
    workflow: batchTemplate({ concurrency: 2 }),
    inputs: { clips: clips(4) },
    store,
  });
  const finalRun = await pump(executeRun(run.id, { store, dispatch, context: {}, callbacks: {} }));
  eq('peak in-flight equals the concurrency cap (2)', peak(), 2);
  ok('all 4 slots complete', allItemsHaveVersion(finalRun));
  eq('run completes', finalRun.state, 'completed');
}

async function testDefaultsToSequential(): Promise<void> {
  const store = memoryStore();
  const { dispatch, peak } = concurrencyTrackingDispatch();
  const run = await createRun({
    workflow: batchTemplate(), // no concurrency set
    inputs: { clips: clips(3) },
    store,
  });
  const finalRun = await pump(executeRun(run.id, { store, dispatch, context: {}, callbacks: {} }));
  eq('peak in-flight is 1 when concurrency is unset (sequential)', peak(), 1);
  ok('all 3 slots complete', allItemsHaveVersion(finalRun));
}

async function testConcurrencyClampedTo16(): Promise<void> {
  const store = memoryStore();
  const { dispatch, peak } = concurrencyTrackingDispatch();
  const run = await createRun({
    workflow: batchTemplate({ concurrency: 100 }),
    inputs: { clips: clips(20) },
    store,
  });
  const finalRun = await pump(executeRun(run.id, { store, dispatch, context: {}, callbacks: {} }));
  ok('peak in-flight never exceeds the max-16 cap', peak() <= 16, `peak=${peak()}`);
  ok('all 20 slots complete', allItemsHaveVersion(finalRun));
}

// A batch whose itemStage args reference an unresolvable binding must fail the
// affected slots gracefully (slot_failed + onError handling), NOT reject out of
// the worker pool and orphan sibling promises (unhandled rejection).
async function testBindingErrorFailsSlotGracefully(): Promise<void> {
  const template = batchTemplate({ onError: 'continue' });
  // Point the itemStage at a path that cannot resolve (items have no `missing`).
  (template.stages[0] as { itemStage: { args: Record<string, unknown> } }).itemStage.args = {
    prompt: '$item.missing.deeper',
  };
  const store = memoryStore();
  const run = await createRun({
    workflow: template,
    inputs: { clips: [{ prompt: 'a' }, { prompt: 'b' }] },
    store,
  });
  const slotEvents: SlotEvent[] = [];
  const finalRun = await pump(executeRun(run.id, {
    store,
    dispatch: { has: () => true, execute: async () => JSON.stringify({ ok: true, videoResultUrls: ['u'] }) },
    context: {},
    callbacks: {},
    onSlotEvent: (e) => slotEvents.push(e),
  }));
  ok('both slots fail gracefully on a binding error', slotEvents.filter((e) => e.phase === 'failed').length === 2);
  eq('run still completes (onError: continue), no pool crash', finalRun.state, 'completed');
}

// ---------------------------------------------------------------------------
// Task 4 — toolOk output_assets/metadata URL fallbacks & transcribe_audio content
// ---------------------------------------------------------------------------

async function testToolOkEnvelopeUrlAndTranscriptContentBindings(): Promise<void> {
  const srtText = '1\n00:00:00,000 --> 00:00:02,000\nWelcome to Sogni.\n';
  const workflow: WorkflowTemplate = {
    id: 'wf_video_stt_subtitles',
    version: '1.0.0',
    name: 'Video -> STT -> Subtitles',
    description: '',
    category: 'video-social',
    stability: 'experimental',
    author: 'system',
    visibility: 'private',
    inputs: [],
    stages: [
      {
        type: 'fixed',
        id: 'clip',
        tool: 'generate_video',
        produces: ['clip_out'],
        args: { prompt: 'Presenter speaking to camera' },
      },
      {
        type: 'fixed',
        id: 'narration',
        tool: 'generate_speech',
        produces: ['speech_out'],
        args: { prompt: 'Welcome to Sogni.', model: 'drama3' },
      },
      {
        type: 'fixed',
        id: 'stt',
        tool: 'transcribe_audio',
        produces: ['stt_out'],
        args: {
          audio_source_url: '$artifacts.clip_out.items[0].selectedVersion.url',
          responseFormat: 'srt',
        },
      },
      {
        type: 'fixed',
        id: 'subtitled',
        tool: 'add_subtitles',
        produces: ['subtitled_out'],
        args: {
          videoUrl: '$artifacts.clip_out.items[0].selectedVersion.url',
          srt: '$artifacts.stt_out.items[0].selectedVersion.content',
        },
      },
    ],
    exposeToLLM: false,
    createdAt: 0,
    updatedAt: 0,
  };

  const capturedCalls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  const dispatch: ToolDispatcher = {
    has: () => true,
    execute: async (toolName, args) => {
      capturedCalls.push({ tool: toolName, args: args as Record<string, unknown> });
      if (toolName === 'generate_video') {
        return JSON.stringify({
          ok: true,
          output_assets: [{ kind: 'video', url: 'https://cdn.sogni.ai/videos/clip-1.mp4' }],
        });
      }
      if (toolName === 'generate_speech') {
        return JSON.stringify({
          ok: true,
          metadata: { audioUrls: ['https://cdn.sogni.ai/audio/speech-1.wav'] },
        });
      }
      if (toolName === 'transcribe_audio') {
        return JSON.stringify({
          ok: true,
          transcript: 'Welcome to Sogni.',
          formatted: srtText,
          metadata: { srt: srtText },
        });
      }
      if (toolName === 'add_subtitles') {
        return JSON.stringify({
          ok: true,
          metadata: { videoUrls: ['https://cdn.sogni.ai/videos/clip-1-subtitled.mp4'] },
        });
      }
      throw new Error(`Unexpected tool ${toolName}`);
    },
  };

  const store = memoryStore();
  const run = await createRun({ workflow, inputs: {}, store });
  const finalRun = await pump(executeRun(run.id, { store, dispatch, context: {}, callbacks: {} }));

  eq('pipeline completes cleanly', finalRun.state, 'completed');
  eq(
    'generate_video output_assets[0].url populates selectedVersion.url',
    finalRun.artifacts.clip_out?.items[0]?.versions[0]?.url,
    'https://cdn.sogni.ai/videos/clip-1.mp4',
  );
  eq(
    'generate_speech metadata.audioUrls[0] populates selectedVersion.url',
    finalRun.artifacts.speech_out?.items[0]?.versions[0]?.url,
    'https://cdn.sogni.ai/audio/speech-1.wav',
  );
  eq(
    'transcribe_audio receives upstream video URL from selectedVersion.url',
    capturedCalls.find((c) => c.tool === 'transcribe_audio')?.args.audio_source_url,
    'https://cdn.sogni.ai/videos/clip-1.mp4',
  );
  eq(
    'transcribe_audio stores clean SRT text in selectedVersion.content rather than JSON envelope',
    finalRun.artifacts.stt_out?.items[0]?.versions[0]?.content,
    srtText,
  );
  eq(
    'add_subtitles receives clean SRT string via $artifacts.stt_out.items[0].selectedVersion.content',
    capturedCalls.find((c) => c.tool === 'add_subtitles')?.args.srt,
    srtText,
  );
  eq(
    'add_subtitles metadata.videoUrls[0] populates selectedVersion.url',
    finalRun.artifacts.subtitled_out?.items[0]?.versions[0]?.url,
    'https://cdn.sogni.ai/videos/clip-1-subtitled.mp4',
  );
}

export async function runWorkflowExecutorTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n🧪 workflow executor — per-slot retry-callback primitive\n');
  await testSlotProgressBridge();
  await testSlotRetriesTransientFailure();
  await testSlotRetryExhaustionHonorsOnErrorContinue();
  await testRetryOnceBackCompat();
  await testConcurrencyCapHonored();
  await testDefaultsToSequential();
  await testConcurrencyClampedTo16();
  await testBindingErrorFailsSlotGracefully();
  await testToolOkEnvelopeUrlAndTranscriptContentBindings();
  return { passed: testsPassed, failed: testsFailed };
}

// Standalone runner (fast TDD loop): `node --import tsx test/workflow-executor-tests.ts`
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runWorkflowExecutorTests().then(({ passed, failed }) => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ passed: ${passed}   ❌ failed: ${failed}`);
    console.log('='.repeat(50));
    process.exit(failed > 0 ? 1 : 0);
  });
}
