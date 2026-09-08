/**
 * Workflow executor.
 *
 * An async generator that drives a Run forward stage by stage. Callers
 * advance the generator with `gen.next()` to consume events; during an
 * `awaiting_*` pause the caller provides a `ResumeInput` via `gen.next(input)`
 * to tell the executor what to do next.
 *
 * Architecture highlights:
 *
 * - **Deterministic forward executor** — fixed + batch stages run through
 *   the injected `ToolDispatcher`. No LLM is involved except for stages
 *   that explicitly request it (interactive type, M5).
 *
 * - **Per-item progress** — batch stages emit `stage_item_progress` /
 *   `stage_item_completed` events so UI can render live status like
 *   sogni-360's TransitionReviewPanel.
 *
 * - **Partial re-execution** — when a `redo_item` ResumeInput arrives, the
 *   executor re-runs just that one item (appending a new ArtifactVersion to
 *   the ArtifactItem) and marks downstream stages stale via
 *   `computeStaleStageIds`. On the next forward tick, only stale stages run.
 *
 * - **Crash-safe persistence** — the Run is saved through the injected
 *   `RunStore` after every state transition. On a refresh, the caller can
 *   reload the Run and re-enter the executor at `currentStageIndex`.
 *
 * - **Interactive stages (M5)** — when the executor hits an interactive
 *   stage, it yields `stage_awaiting_interactive` and waits for the caller
 *   (useChat) to drive a scoped chat turn and resume with
 *   `interactive_complete` carrying the tool call result or produced
 *   artifacts. The forward stub is in place in M3 but throws; M5 fleshes it
 *   out.
 *
 * - **Checkpoints (M5)** — `stage.checkpointRequired` causes the executor
 *   to yield `stage_awaiting_checkpoint` and wait for `approve_checkpoint`.
 *   Stub in M3, full impl in M5.
 */

import { resolveBindings } from './bindings.js';
import { computeStaleStageIds, persistedRun, walkStages } from './validation.js';
import type { RunStore, ToolDispatcher } from './executor-ports.js';
import type {
  Artifact,
  ArtifactItem,
  ArtifactVersion,
  BatchStage,
  BindingContext,
  ExecutorEvent,
  FixedStage,
  InteractiveStage,
  ResumeInput,
  Run,
  SlotEvent,
  SlotEventReporter,
  StageExecution,
  WorkflowInput,
  WorkflowTemplate,
} from './types.js';

export type { SlotEvent, SlotEventPhase, SlotEventReporter } from './types.js';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ExecutorOptions<
  Context = unknown,
  Callbacks = unknown,
  Progress = Record<string, unknown>,
> {
  /** Caller-supplied tool execution context (forwarded to the dispatcher verbatim). */
  context: Context;
  /** Caller-supplied callbacks forwarded to the dispatcher verbatim. */
  callbacks: Callbacks;
  /** Persistence backend for the Run record. */
  store: RunStore;
  /** Tool dispatcher (chat: chatToolRegistry; api: hostedDispatch; tests: fake). */
  dispatch: ToolDispatcher<Context, Callbacks>;
  /** Optional cooperative cancellation. Inspected at every loop iteration. */
  signal?: AbortSignal;
  /**
   * Optional out-of-band per-slot callback. Fan-out stages (batch + fixed)
   * invoke it for every slot lifecycle transition — `started`, `progress`
   * (forwarding the tool's own progress payload as it arrives mid-dispatch),
   * `retrying`, `completed`, `failed` — so the caller's progress reducer can
   * render ~1s per-slot progress and per-slot retry affordances that a
   * yielded `ExecutorEvent` can't carry in real time. See {@link SlotEvent}.
   */
  onSlotEvent?: SlotEventReporter<Progress>;
}

/**
 * Create and drive a generator that executes a Run. Callers must pump it:
 *
 * ```ts
 * const gen = executeRun(runId, { context, callbacks, store, dispatch });
 * let next = await gen.next();
 * while (!next.done) {
 *   const event = next.value;
 *   if (event.type === 'stage_awaiting_checkpoint') {
 *     const input = await waitForUserApproval(event);
 *     next = await gen.next(input);
 *   } else {
 *     // render event to UI
 *     next = await gen.next();
 *   }
 * }
 * ```
 */
export async function* executeRun<
  Context = unknown,
  Callbacks = unknown,
  Progress = Record<string, unknown>,
>(
  runId: string,
  options: ExecutorOptions<Context, Callbacks, Progress>,
): AsyncGenerator<ExecutorEvent, Run, ResumeInput | undefined> {
  const loaded = await options.store.get(runId);
  if (!loaded) {
    throw new Error(`[WORKFLOW EXECUTOR] Run not found: ${runId}`);
  }

  // Restore transient state for the session.
  let run: Run = { ...loaded, state: 'running', updatedAt: Date.now() };
  await options.store.save(run);
  yield { type: 'run_started', run };

  // Execution iterates top-level stages only: a batch stage's itemStage is
  // dispatched per-item inside runBatchStage, never as a standalone stage.
  const flat = Array.from(walkStages(run.workflowSnapshot.stages, { includeBatchItemStage: false }));
  // Map stage IDs to their stable index, used for `currentStageIndex` math.
  const indexOf = new Map(flat.map((s, i) => [s.id, i]));

  try {
    while (run.currentStageIndex < flat.length) {
      if (options.signal?.aborted) {
        run = await mutateRun(run, { state: 'canceled' }, options.store);
        yield { type: 'run_paused', run };
        return run;
      }

      const stage = flat[run.currentStageIndex];
      const stageExec = ensureStageExec(run, stage.id);

      // Skip completed + non-stale stages (idempotent resume).
      if (stageExec.state === 'completed' && !run.staleStageIds.includes(stage.id)) {
        run = await mutateRun(run, { currentStageIndex: run.currentStageIndex + 1 }, options.store);
        continue;
      }

      // Stale stages reset to pending before executing.
      if (run.staleStageIds.includes(stage.id)) {
        run = await mutateRun(run, {
          staleStageIds: run.staleStageIds.filter((id) => id !== stage.id),
        }, options.store);
      }

      yield { type: 'stage_started', stageIndex: run.currentStageIndex, stage };

      try {
        if (stage.type === 'fixed') {
          run = yield* runFixedStage(run, stage, options);
        } else if (stage.type === 'batch') {
          run = yield* runBatchStage(run, stage, options);
        } else if (stage.type === 'interactive') {
          run = yield* runInteractiveStage(run, stage, options);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        run = await mutateRun(run, {
          state: 'failed',
          stages: setStageState(run.stages, stage.id, {
            state: 'failed',
            error: error.message,
            completedAt: Date.now(),
          }),
        }, options.store);
        yield { type: 'stage_item_failed', stageIndex: run.currentStageIndex, itemId: stage.id, error: error.message };
        yield { type: 'run_failed', error, run };
        return run;
      }

      yield { type: 'stage_completed', stageIndex: run.currentStageIndex };

      // Checkpoint gate (M5 wires the real UI; for now, auto-approve unless
      // an interactive flow is active).
      if (stage.checkpointRequired) {
        yield {
          type: 'stage_awaiting_checkpoint',
          stageIndex: run.currentStageIndex,
          reviewFocus: stage.reviewFocus,
        };
        const resume = yield* awaitResume();
        const handled = yield* handleResumeInput(run, resume, stage.id, indexOf, options.store);
        run = handled.run;
        if (handled.stop) return run;
        if (handled.retry) continue; // Re-run this same stage after a redo_*.
      }

      run = await mutateRun(run, { currentStageIndex: run.currentStageIndex + 1 }, options.store);
    }

    run = await mutateRun(run, { state: 'completed' }, options.store);
    yield { type: 'run_completed', run };
    return run;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    run = await mutateRun(run, { state: 'failed' }, options.store);
    yield { type: 'run_failed', error, run };
    return run;
  }
}

// ---------------------------------------------------------------------------
// Stage runners
// ---------------------------------------------------------------------------

async function* runFixedStage<Context, Callbacks, Progress>(
  run: Run,
  stage: FixedStage,
  options: ExecutorOptions<Context, Callbacks, Progress>,
): AsyncGenerator<ExecutorEvent, Run, ResumeInput | undefined> {
  let currentRun = await mutateRun(run, {
    stages: setStageState(run.stages, stage.id, {
      state: 'running',
      startedAt: Date.now(),
    }),
  }, options.store);

  const ctx = makeBindingContext(currentRun);
  const resolvedArgs = resolveBindings(stage.args, ctx) as Record<string, unknown>;

  const itemId = `${stage.id}/main`;
  yield { type: 'stage_item_started', stageIndex: currentRun.currentStageIndex, itemId, index: 0 };

  const wrappedCallbacks = wrapCallbacks(options.callbacks, (p) => {
    // Surface tool progress as per-item progress so the UI can render a bar.
    // We can't produce events from inside a callback (we're not the generator),
    // but we mirror the value into the run for later introspection.
    void p;
  });

  const rawResult = await options.dispatch.execute(
    stage.tool,
    resolvedArgs,
    options.context,
    wrappedCallbacks,
  );

  const failureMessage = parseToolErrorMessage(rawResult);
  if (failureMessage) {
    throw new Error(`[${stage.tool}] ${failureMessage}`);
  }

  const version = versionFromToolResult(rawResult, stage.id, stage.tool, resolvedArgs);
  const producedArtifactName = stage.produces?.[0];
  if (producedArtifactName) {
    currentRun = upsertArtifactItem(currentRun, producedArtifactName, artifactKindForTool(stage.tool), {
      id: itemId,
      versions: [version],
      selectedVersionId: version.id,
    });
  }

  currentRun = await mutateRun(currentRun, {
    stages: setStageState(currentRun.stages, stage.id, {
      state: 'completed',
      completedAt: Date.now(),
    }),
  }, options.store);

  yield {
    type: 'stage_item_completed',
    stageIndex: currentRun.currentStageIndex,
    itemId,
    version,
  };

  return currentRun;
}

async function* runBatchStage<Context, Callbacks, Progress>(
  run: Run,
  stage: BatchStage,
  options: ExecutorOptions<Context, Callbacks, Progress>,
): AsyncGenerator<ExecutorEvent, Run, ResumeInput | undefined> {
  let currentRun = await mutateRun(run, {
    stages: setStageState(run.stages, stage.id, {
      state: 'running',
      startedAt: Date.now(),
    }),
  }, options.store);

  // Resolve the overBinding to an array of items.
  const ctx = makeBindingContext(currentRun);
  const items = resolveBindings(stage.overBinding, ctx) as unknown;
  if (!Array.isArray(items)) {
    throw new Error(
      `[WORKFLOW EXECUTOR] Batch stage "${stage.id}" overBinding did not resolve to an array`,
    );
  }

  const producedArtifactName = stage.produces?.[0];
  if (!producedArtifactName) {
    throw new Error(
      `[WORKFLOW EXECUTOR] Batch stage "${stage.id}" must declare `
        + `a produced artifact name via \`produces\``,
    );
  }

  // Pre-create ArtifactItems for every iteration (so locking + version
  // history survive partial re-execution).
  const existing = currentRun.artifacts[producedArtifactName];
  const existingItemById: Record<string, ArtifactItem> = {};
  if (existing) for (const it of existing.items) existingItemById[it.id] = it;

  const itemIds: string[] = items.map((_, idx) => `${stage.id}/${idx}`);

  // Ensure every slot is allocated in the artifact collection, preserving
  // existing items (which may be locked or have version history).
  for (let i = 0; i < items.length; i++) {
    const itemId = itemIds[i];
    if (!existingItemById[itemId]) {
      currentRun = upsertArtifactItem(currentRun, producedArtifactName, artifactKindForTool(stage.itemStage.type === 'fixed' ? stage.itemStage.tool : 'generate_image'), {
        id: itemId,
        label: batchItemLabel(stage, i, items[i]),
        versions: [],
        selectedVersionId: '',
        metadata: typeof items[i] === 'object' && items[i] !== null ? (items[i] as Record<string, unknown>) : undefined,
      });
    }
  }

  // Determine which indices actually need to run:
  //   - Items with empty version history
  //   - Items that are stale (not locked + downstream of a mutation)
  // Locked items with existing versions are always skipped.
  const indicesToRun: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const itemId = itemIds[i];
    const currentItem = currentRun.artifacts[producedArtifactName]?.items.find((it) => it.id === itemId);
    if (!currentItem) continue;
    if (currentItem.locked && currentItem.versions.length > 0) continue;
    if (currentItem.versions.length === 0) indicesToRun.push(i);
  }

  if (indicesToRun.length === 0) {
    currentRun = await mutateRun(currentRun, {
      stages: setStageState(currentRun.stages, stage.id, {
        state: 'completed',
        completedAt: Date.now(),
      }),
    }, options.store);
    return currentRun;
  }

  // A batch's itemStage must be a fixed tool call.
  if (stage.itemStage.type !== 'fixed') {
    throw new Error(
      `[WORKFLOW EXECUTOR] Batch itemStage of type "${stage.itemStage.type}" `
        + `is not supported. Only fixed itemStages can fan out.`,
    );
  }

  const itemStage = stage.itemStage;
  const maxAttempts = maxAttemptsForStage(stage);
  const concurrency = clampConcurrency(stage.concurrency);

  // Snapshot the binding context once so fan-out slots resolve their args
  // independently — a slot must never depend on a sibling slot's output, or a
  // parallel run would be nondeterministic.
  const itemArgsCtx = makeBindingContext(currentRun);

  type SlotOutcome = { idx: number; itemId: string; version?: ArtifactVersion; error?: string };

  // Run one slot end-to-end (dispatch + bounded retry), emitting per-slot
  // lifecycle callbacks. Deliberately does NOT mutate `currentRun`: the
  // generator body applies the produced version when the slot settles, so all
  // run mutation stays single-threaded even with concurrent slots in flight.
  const runSlot = async (idx: number): Promise<SlotOutcome> => {
    const itemId = itemIds[idx];
    const item = items[idx];
    const slotBase = { stageId: stage.id, stageIndex: currentRun.currentStageIndex, itemId, index: idx };
    const itemCtx: BindingContext = {
      ...itemArgsCtx,
      item: { ...(typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : { value: item }), index: idx },
    };

    // Resolve args inside the slot's failure boundary: an unresolvable binding
    // must surface as a per-slot failure (handled by onError below), never as a
    // rejected runSlot promise — under concurrency that would escape the worker
    // pool's Promise.race and orphan sibling promises (unhandled rejection).
    let resolvedArgs: Record<string, unknown>;
    try {
      resolvedArgs = resolveBindings(itemStage.args, itemCtx) as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      options.onSlotEvent?.({ phase: 'failed', ...slotBase, attempt: 1, error: message });
      return { idx, itemId, error: message };
    }

    let lastError = '';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        options.onSlotEvent?.({ phase: 'retrying', ...slotBase, attempt, error: lastError });
      }
      // Bridge the tool's in-flight progress (fired while we await the
      // dispatch) onto the per-slot callback, tagged with this slot's
      // identity + attempt — the generator can't yield during the await.
      const wrappedCallbacks = wrapCallbacks(options.callbacks, (toolProgress) => {
        options.onSlotEvent?.({ phase: 'progress', ...slotBase, attempt, toolProgress: toolProgress as Progress });
      });
      try {
        const rawResult = await options.dispatch.execute(itemStage.tool, resolvedArgs, options.context, wrappedCallbacks);
        const failureMessage = parseToolErrorMessage(rawResult);
        if (failureMessage) {
          throw new Error(`[${itemStage.tool}] ${failureMessage}`);
        }
        const version = versionFromToolResult(rawResult, stage.id, itemStage.tool, resolvedArgs);
        options.onSlotEvent?.({ phase: 'completed', ...slotBase, attempt, version });
        return { idx, itemId, version };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // Fall through to retry while attempts remain.
      }
    }
    options.onSlotEvent?.({ phase: 'failed', ...slotBase, attempt: maxAttempts, error: lastError });
    return { idx, itemId, error: lastError };
  };

  // Bounded-concurrency worker pool. Progress/retry/lifecycle for in-flight
  // slots flows out-of-band via onSlotEvent; the generator yields each slot's
  // terminal ExecutorEvent as it settles. `continue`/`skip` keep the batch
  // running for partial success; any other onError stops the batch on the
  // first terminal failure (remaining in-flight slots drain, then we rethrow).
  const queue = [...indicesToRun];
  const inFlight = new Map<number, Promise<SlotOutcome>>();
  let stopError: string | undefined;

  while (!stopError && (queue.length > 0 || inFlight.size > 0)) {
    while (!stopError && inFlight.size < concurrency && queue.length > 0) {
      if (options.signal?.aborted) { queue.length = 0; break; }
      const idx = queue.shift() as number;
      const itemId = itemIds[idx];
      yield { type: 'stage_item_started', stageIndex: currentRun.currentStageIndex, itemId, index: idx };
      options.onSlotEvent?.({ phase: 'started', stageId: stage.id, stageIndex: currentRun.currentStageIndex, itemId, index: idx, attempt: 1 });
      inFlight.set(idx, runSlot(idx));
    }

    if (inFlight.size === 0) break;

    const settled = await Promise.race(
      Array.from(inFlight.entries(), ([idx, p]) => p.then((outcome) => ({ idx, outcome }))),
    );
    inFlight.delete(settled.idx);
    const { outcome } = settled;

    if (outcome.version) {
      currentRun = appendVersionToItem(currentRun, producedArtifactName, outcome.itemId, outcome.version);
      yield { type: 'stage_item_completed', stageIndex: currentRun.currentStageIndex, itemId: outcome.itemId, version: outcome.version };
    } else {
      yield { type: 'stage_item_failed', stageIndex: currentRun.currentStageIndex, itemId: outcome.itemId, error: outcome.error ?? 'batch slot failed' };
      if (!(stage.onError === 'continue' || stage.onError === 'skip')) {
        stopError = outcome.error ?? 'batch slot failed';
      }
    }
  }

  if (stopError) {
    await Promise.allSettled(Array.from(inFlight.values()));
    throw new Error(stopError);
  }

  currentRun = await mutateRun(currentRun, {
    stages: setStageState(currentRun.stages, stage.id, {
      state: 'completed',
      completedAt: Date.now(),
    }),
  }, options.store);

  return currentRun;
}

/**
 * Interactive stage skeleton — M3 stub. Yields `stage_awaiting_interactive`
 * and blocks until the caller resumes with `interactive_complete`. Full
 * scoped-prompt / tool-filter handoff lands in M5.
 */
async function* runInteractiveStage<Context, Callbacks, Progress>(
  run: Run,
  stage: InteractiveStage,
  options: ExecutorOptions<Context, Callbacks, Progress>,
): AsyncGenerator<ExecutorEvent, Run, ResumeInput | undefined> {
  let currentRun = await mutateRun(run, {
    state: 'awaiting_input',
    stages: setStageState(run.stages, stage.id, {
      state: 'running',
      startedAt: Date.now(),
    }),
  }, options.store);

  yield { type: 'stage_awaiting_interactive', stageIndex: currentRun.currentStageIndex, stage };
  const resume = yield* awaitResume();

  if (!resume || resume.type !== 'interactive_complete') {
    if (resume && resume.type === 'cancel') {
      currentRun = await mutateRun(currentRun, { state: 'canceled' }, options.store);
      return currentRun;
    }
    throw new Error(
      `[WORKFLOW EXECUTOR] Interactive stage "${stage.id}" expected `
        + `interactive_complete but got ${resume?.type ?? 'undefined'}`,
    );
  }

  // Merge any artifacts the caller produced during the handoff.
  if (resume.producedArtifacts) {
    const merged = { ...currentRun.artifacts };
    for (const [name, artifact] of Object.entries(resume.producedArtifacts)) {
      merged[name] = artifact;
    }
    currentRun = await mutateRun(currentRun, { artifacts: merged }, options.store);
  }

  currentRun = await mutateRun(currentRun, {
    state: 'running',
    stages: setStageState(currentRun.stages, stage.id, {
      state: 'completed',
      completedAt: Date.now(),
    }),
  }, options.store);

  return currentRun;
}

// ---------------------------------------------------------------------------
// Resume input plumbing
// ---------------------------------------------------------------------------

/**
 * Helper that yields a placeholder event used purely to receive the
 * `ResumeInput` argument callers pass to `gen.next(input)`. Keeps the typed
 * generator signature from ballooning.
 */
function* awaitResume(): Generator<ExecutorEvent, ResumeInput | undefined, ResumeInput | undefined> {
  // The caller supplies the resume input via `gen.next(input)`. We simply
  // capture whatever value was pushed.
  const input = yield { type: 'run_paused', run: null as unknown as Run };
  return input;
}

interface HandleResult {
  run: Run;
  stop: boolean;
  retry: boolean;
}

// eslint-disable-next-line require-yield
async function* handleResumeInput(
  run: Run,
  resume: ResumeInput | undefined,
  currentStageId: string,
  indexOf: Map<string, number>,
  store: RunStore,
): AsyncGenerator<ExecutorEvent, HandleResult, ResumeInput | undefined> {
  if (!resume || resume.type === 'approve_checkpoint') {
    return { run, stop: false, retry: false };
  }

  if (resume.type === 'cancel') {
    const updated = await mutateRun(run, { state: 'canceled' }, store);
    return { run: updated, stop: true, retry: false };
  }

  if (resume.type === 'lock_item') {
    const updated = await mutateRun(run, {
      artifacts: withLockedItem(run.artifacts, resume.artifactName, resume.itemId, resume.locked),
    }, store);
    return { run: updated, stop: false, retry: false };
  }

  if (resume.type === 'select_version') {
    const updated = await mutateRun(run, {
      artifacts: withSelectedVersion(run.artifacts, resume.artifactName, resume.itemId, resume.versionId),
      staleStageIds: Array.from(new Set([
        ...run.staleStageIds,
        ...computeStaleStageIds(run, [resume.artifactName]),
      ])),
    }, store);
    return { run: updated, stop: false, retry: true };
  }

  if (resume.type === 'jump_to_stage') {
    const target = indexOf.get(resume.stageId);
    if (target === undefined) {
      throw new Error(`[WORKFLOW EXECUTOR] jump_to_stage references unknown stage "${resume.stageId}"`);
    }
    const updated = await mutateRun(run, {
      currentStageIndex: target,
      staleStageIds: Array.from(new Set([...run.staleStageIds, currentStageId])),
    }, store);
    return { run: updated, stop: false, retry: true };
  }

  if (resume.type === 'redo_item') {
    const updated = await mutateRun(run, {
      artifacts: clearItemVersionsForRedo(run.artifacts, resume.artifactName, resume.itemId),
      staleStageIds: Array.from(new Set([
        ...run.staleStageIds,
        currentStageId,
        ...computeStaleStageIds(run, [resume.artifactName]),
      ])),
    }, store);
    return { run: updated, stop: false, retry: true };
  }

  if (resume.type === 'redo_stage') {
    const updated = await mutateRun(run, {
      staleStageIds: Array.from(new Set([...run.staleStageIds, resume.stageId])),
    }, store);
    return { run: updated, stop: false, retry: true };
  }

  return { run, stop: false, retry: false };
}

// ---------------------------------------------------------------------------
// Binding context + artifact helpers
// ---------------------------------------------------------------------------

function makeBindingContext(run: Run): BindingContext {
  return {
    inputs: run.inputs,
    artifacts: run.artifacts,
    run: { id: run.id, state: run.state },
  };
}

/**
 * Returns a human-readable error message if `rawResult` represents a tool
 * failure envelope, or `null` if the call succeeded. Mirrors the chat-side
 * predicate in `chatService.ts:isToolErrorPayload` so workflows and chat
 * agree on what counts as a failure. Anything that isn't valid JSON is
 * treated as a success string (legacy plain-text returns).
 */
function parseToolErrorMessage(rawResult: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResult);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const payload = parsed as Record<string, unknown>;
  const isErr =
    payload.ok === false
    || payload.success === false
    || (typeof payload.error === 'string' && payload.error.length > 0);
  if (!isErr) return null;
  if (typeof payload.message === 'string' && payload.message.length > 0) return payload.message;
  if (typeof payload.error === 'string' && payload.error.length > 0) return payload.error;
  if (typeof payload.error_type === 'string' && payload.error_type.length > 0) return payload.error_type;
  return 'tool returned an error envelope';
}

function versionFromToolResult(
  rawResult: string,
  stageId: string,
  tool: string,
  args: Record<string, unknown>,
): ArtifactVersion {
  let url: string | undefined;
  let content: string | undefined;
  try {
    const parsed = JSON.parse(rawResult) as Record<string, unknown>;
    const resultUrls = parsed.resultUrls as unknown;
    const videoUrls = parsed.videoResultUrls as unknown;
    const audioUrls = parsed.audioResultUrls as unknown;
    if (Array.isArray(videoUrls) && videoUrls.length > 0 && typeof videoUrls[0] === 'string') {
      url = videoUrls[0];
    } else if (Array.isArray(resultUrls) && resultUrls.length > 0 && typeof resultUrls[0] === 'string') {
      url = resultUrls[0];
    } else if (Array.isArray(audioUrls) && audioUrls.length > 0 && typeof audioUrls[0] === 'string') {
      url = audioUrls[0];
    } else {
      content = rawResult;
    }
  } catch {
    content = rawResult;
  }

  return {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    url,
    content,
    generatedBy: { stageId, tool, args },
  };
}

function artifactKindForTool(tool: string): Artifact['kind'] {
  if (tool === 'animate_photo' || tool === 'generate_video' || tool === 'sound_to_video'
    || tool === 'video_to_video' || tool === 'stitch_video' || tool === 'orbit_video'
    || tool === 'dance_montage') return 'video';
  if (tool === 'generate_music' || tool === 'generate_speech') return 'audio';
  if (tool === 'analyze_image' || tool === 'extract_metadata') return 'text';
  return 'image';
}

function upsertArtifactItem(
  run: Run,
  name: string,
  kind: Artifact['kind'],
  item: ArtifactItem,
): Run {
  const existing = run.artifacts[name];
  let nextArtifact: Artifact;
  if (!existing) {
    nextArtifact = { name, kind, items: [item] };
  } else {
    const idx = existing.items.findIndex((it) => it.id === item.id);
    const items = idx === -1
      ? [...existing.items, item]
      : existing.items.map((it, i) => (i === idx ? { ...it, ...item } : it));
    nextArtifact = { ...existing, items };
  }
  return { ...run, artifacts: { ...run.artifacts, [name]: nextArtifact } };
}

function appendVersionToItem(
  run: Run,
  artifactName: string,
  itemId: string,
  version: ArtifactVersion,
): Run {
  const existing = run.artifacts[artifactName];
  if (!existing) return run;
  const items = existing.items.map((it) =>
    it.id === itemId
      ? { ...it, versions: [...it.versions, version], selectedVersionId: version.id }
      : it,
  );
  return {
    ...run,
    artifacts: { ...run.artifacts, [artifactName]: { ...existing, items } },
  };
}

function withLockedItem(
  artifacts: Record<string, Artifact>,
  name: string,
  itemId: string,
  locked: boolean,
): Record<string, Artifact> {
  const existing = artifacts[name];
  if (!existing) return artifacts;
  const items = existing.items.map((it) =>
    it.id === itemId ? { ...it, locked } : it,
  );
  return { ...artifacts, [name]: { ...existing, items } };
}

function withSelectedVersion(
  artifacts: Record<string, Artifact>,
  name: string,
  itemId: string,
  versionId: string,
): Record<string, Artifact> {
  const existing = artifacts[name];
  if (!existing) return artifacts;
  const items = existing.items.map((it) =>
    it.id === itemId ? { ...it, selectedVersionId: versionId } : it,
  );
  return { ...artifacts, [name]: { ...existing, items } };
}

function clearItemVersionsForRedo(
  artifacts: Record<string, Artifact>,
  name: string,
  itemId: string,
): Record<string, Artifact> {
  const existing = artifacts[name];
  if (!existing) return artifacts;
  const items = existing.items.map((it) =>
    it.id === itemId
      ? { ...it, versions: [], selectedVersionId: '' }
      : it,
  );
  return { ...artifacts, [name]: { ...existing, items } };
}

/**
 * Per-slot attempt budget for a batch stage. Explicit `maxAttemptsPerItem`
 * wins; otherwise `onError: 'retry_once'` grants exactly one retry (2 total),
 * and everything else gets a single attempt (no automatic retry).
 */
function maxAttemptsForStage(stage: BatchStage): number {
  if (typeof stage.maxAttemptsPerItem === 'number' && stage.maxAttemptsPerItem >= 1) {
    return Math.floor(stage.maxAttemptsPerItem);
  }
  return stage.onError === 'retry_once' ? 2 : 1;
}

/** Hard ceiling on parallel slots — matches the chat fan-out invariant. */
const MAX_BATCH_CONCURRENCY = 16;

/**
 * Resolve a batch stage's effective concurrency. Undefined/invalid → 1
 * (sequential, the back-compat default); otherwise floored and clamped to
 * {@link MAX_BATCH_CONCURRENCY}.
 */
function clampConcurrency(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), MAX_BATCH_CONCURRENCY);
}

function batchItemLabel(stage: BatchStage, index: number, item: unknown): string | undefined {
  if (stage.itemLabelTemplate) {
    // Tiny {index} + {field} interpolation for v1.
    return stage.itemLabelTemplate
      .replace(/\{index\}/g, String(index))
      .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
        if (item && typeof item === 'object' && key in (item as Record<string, unknown>)) {
          const val = (item as Record<string, unknown>)[key];
          return val === undefined || val === null ? '' : String(val);
        }
        return '';
      });
  }
  return undefined;
}

function setStageState(
  stages: StageExecution[],
  stageId: string,
  patch: Partial<StageExecution>,
): StageExecution[] {
  const idx = stages.findIndex((s) => s.stageId === stageId);
  if (idx === -1) {
    return [...stages, { stageId, state: 'pending', ...patch } as StageExecution];
  }
  return stages.map((s, i) => (i === idx ? { ...s, ...patch } : s));
}

function ensureStageExec(run: Run, stageId: string): StageExecution {
  const existing = run.stages.find((s) => s.stageId === stageId);
  if (existing) return existing;
  return { stageId, state: 'pending' };
}

function wrapCallbacks<Callbacks>(base: Callbacks, onProgress: (p: unknown) => void): Callbacks {
  const baseRecord = (base ?? {}) as unknown as Record<string, unknown>;
  const baseOnToolProgress = baseRecord.onToolProgress as ((progress: unknown) => void) | undefined;
  // Always intercept: the per-slot bridge must fire even when the caller's
  // callbacks don't include an onToolProgress hook of their own. The tool can
  // then always call onToolProgress, and we forward to the base when present.
  return {
    ...baseRecord,
    onToolProgress: (progress: unknown) => {
      onProgress(progress);
      if (typeof baseOnToolProgress === 'function') baseOnToolProgress(progress);
    },
  } as unknown as Callbacks;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function mutateRun(run: Run, patch: Partial<Run>, store: RunStore): Promise<Run> {
  const next: Run = { ...run, ...patch, updatedAt: Date.now() };
  await store.save(persistedRun(next));
  return next;
}

// ---------------------------------------------------------------------------
// Run factory
// ---------------------------------------------------------------------------

/**
 * Create a fresh Run via the injected store for a given workflow + inputs.
 * Caller is responsible for making sure the workflow is registered and its
 * inputs have been validated against the input schema.
 */
export async function createRun(params: {
  workflow: WorkflowTemplate;
  inputs: Record<string, unknown>;
  store: RunStore;
  chatSessionId?: string;
}): Promise<Run> {
  const now = Date.now();
  const seededInputs = withWorkflowInputDefaults(params.workflow.inputs, params.inputs);
  const run: Run = {
    id: `run_${now}_${Math.random().toString(36).slice(2, 10)}`,
    workflowId: params.workflow.id,
    workflowSnapshot: params.workflow,
    state: 'draft',
    inputs: seededInputs,
    currentStageIndex: 0,
    stages: Array.from(walkStages(params.workflow.stages, { includeBatchItemStage: false })).map((s): StageExecution => ({
      stageId: s.id,
      state: 'pending',
    })),
    artifacts: {},
    chatSessionId: params.chatSessionId,
    createdAt: now,
    updatedAt: now,
    staleStageIds: [],
  };
  await params.store.save(persistedRun(run));
  return run;
}

function withWorkflowInputDefaults(
  definitions: WorkflowTemplate['inputs'],
  provided: Record<string, unknown>,
): Record<string, unknown> {
  const seeded = Object.fromEntries(
    definitions.map((input) => [input.name, input.default ?? defaultInputValue(input)]),
  );
  return { ...seeded, ...provided };
}

function defaultInputValue(
  input: WorkflowInput,
): unknown {
  if (input.type === 'number') return 0;
  if (input.type === 'boolean') return false;
  if (input.type === 'select') return input.options?.[0]?.value ?? '';
  return '';
}
