function integerArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;

  const parsed: number[] = [];
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isInteger(entry)) return null;
    parsed.push(entry);
  }
  return parsed;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const parsed: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    parsed.push(entry);
  }
  return parsed;
}

// Array arguments that never make a call per-output. The fan-out fields are
// collapsed below; `keyframes` is one clip's list of MiniMax H3 keyframes that
// every output of the call pins, so several of them are still one project.
const SINGLE_PROJECT_FANOUT_ARRAY_FIELDS = new Set(['prompts', 'sourceImageIndices', 'endImageIndices', 'keyframes']);

function oneRepeatedInteger(values: readonly number[], expectedLength: number): number | null {
  if (values.length === 1) return values[0] ?? null;
  if (values.length !== expectedLength) return null;
  const first = values[0];
  return values.every(value => value === first) ? first ?? null : null;
}

function hasPerOutcomeArrayParams(args: Record<string, unknown>): boolean {
  return Object.entries(args).some(([key, value]) => (
    Array.isArray(value)
    && !SINGLE_PROJECT_FANOUT_ARRAY_FIELDS.has(key)
    && value.length > 1
  ));
}

function canEmbedInDynamicPromptBranch(prompt: string): boolean {
  return !/[{}|]/.test(prompt);
}

function buildDynamicPromptBranch(prompts: readonly string[]): string | null {
  if (prompts.length < 2 || prompts.length > 16) return null;
  const normalized = prompts.map(prompt => prompt.trim()).filter(Boolean);
  if (normalized.length !== prompts.length) return null;
  if (!normalized.every(canEmbedInDynamicPromptBranch)) return null;
  return `{${normalized.join('|')}}`;
}

export function collapseSingleSourceFanOutToDynamicPromptVariations(
  args: Record<string, unknown>,
): Record<string, unknown> | null {
  const prompts = stringArray(args.prompts);
  if (!prompts || prompts.length < 2 || prompts.length > 16) return null;
  if (hasPerOutcomeArrayParams(args)) return null;

  const sourceImageIndices = integerArray(args.sourceImageIndices);
  const sourceImageIndex =
    sourceImageIndices
      ? oneRepeatedInteger(sourceImageIndices, prompts.length)
      : typeof args.sourceImageIndex === 'number' && Number.isInteger(args.sourceImageIndex)
        ? args.sourceImageIndex
        : null;
  if (sourceImageIndex === null) return null;

  const endImageIndices = integerArray(args.endImageIndices);
  const repeatedEndImageIndex = endImageIndices
    ? oneRepeatedInteger(endImageIndices, prompts.length)
    : null;
  if (endImageIndices && repeatedEndImageIndex === null) return null;

  const explicitEndImageIndex =
    typeof args.endImageIndex === 'number' && Number.isInteger(args.endImageIndex)
      ? args.endImageIndex
      : null;
  if (
    explicitEndImageIndex !== null
    && repeatedEndImageIndex !== null
    && explicitEndImageIndex !== repeatedEndImageIndex
  ) {
    return null;
  }

  const prompt = buildDynamicPromptBranch(prompts);
  if (!prompt) return null;

  const next: Record<string, unknown> = {
    ...args,
    prompt,
    numberOfVariations: prompts.length,
    sourceImageIndex,
  };
  delete next.prompts;
  delete next.sourceImageIndices;
  delete next.endImageIndices;

  if (repeatedEndImageIndex !== null) {
    next.endImageIndex = repeatedEndImageIndex;
  } else if (explicitEndImageIndex !== null) {
    next.endImageIndex = explicitEndImageIndex;
  } else if (args.frameRole === 'both') {
    next.endImageIndex = sourceImageIndex;
  }

  return next;
}

/**
 * @deprecated Use collapseSingleSourceFanOutToDynamicPromptVariations().
 * Retained for older consumers; prompt-only fan-out for one fixed source now
 * collapses to one Dynamic Prompt project instead of expanding to multiple
 * SDK projects.
 */
export function expandSingleSourceFanOutForPerClipPrompts(args: Record<string, unknown>): boolean {
  const collapsed = collapseSingleSourceFanOutToDynamicPromptVariations(args);
  if (!collapsed) return false;

  for (const key of Object.keys(args)) {
    delete args[key];
  }
  Object.assign(args, collapsed);

  return true;
}
