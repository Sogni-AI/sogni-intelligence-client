import type { ChatMessage } from '../runtime/chatTypes.js';

export const DEFAULT_CHARS_PER_TOKEN = 4;
export const DEFAULT_IMAGE_TOKENS_HIGH = 1_300;
export const DEFAULT_IMAGE_TOKENS_LOW = 340;
export const DEFAULT_MESSAGE_OVERHEAD = 4;
const DEFAULT_MIN_PROTECTED_GROUPS = 2;
const SUMMARY_TOKEN_BUDGET = 8_192;
const MIN_SUMMARY_TOKEN_BUDGET = 512;

const DEFAULT_VIDEO_TOOLS = new Set([
  'animate_photo',
  'change_angle',
  'generate_video',
  'sound_to_video',
  'video_to_video',
  'upscale_video',
  'stitch_video',
  'orbit_video',
  'dance_montage',
  'analyze_video',
]);

const DEFAULT_AUDIO_TOOLS = new Set([
  'generate_music',
  'generate_speech',
]);

const DEFAULT_UNMASKABLE_TOOLS = new Set([
  'analyze_image',
  'analyze_video',
]);

export type ContextCompactionAction = 'none' | 'masked' | 'trimmed' | 'over_budget_untrimmed';

export interface TrimConversationResult {
  messages: ChatMessage[];
  trimmedCount: number;
  insertedSummary: boolean;
  tokensSaved: number;
  beforeTokens: number;
  afterTokens: number;
  availableTokens: number;
  inputBudget: number;
  action: ContextCompactionAction;
  messageCountBefore: number;
  messageCountAfter: number;
  groupCountBefore?: number;
  groupCountAfter?: number;
  trimmedGroups: number;
  keptGroups: number;
  protectedGroups: number;
  summaryTokens: number;
  summaryTokenBudget: number;
}

export interface TrimConversationOptions {
  minProtectedGroups?: number;
  unmaskableTools?: ReadonlySet<string>;
  videoTools?: ReadonlySet<string>;
  audioTools?: ReadonlySet<string>;
  charsPerToken?: number;
  imageTokensHigh?: number;
  imageTokensLow?: number;
  messageOverhead?: number;
}

interface TokenEstimator {
  estimateMessageTokens(message: ChatMessage): number;
  estimateTotalTokens(messages: ChatMessage[]): number;
}

interface MessageGroup {
  messages: ChatMessage[];
  tokens: number;
  hasImage: boolean;
}

interface SummaryOptions {
  maxPromptChars: number;
  maxGeneratedItems: number;
  /** Maximum chars of user-message text to include in the conversation-thread snippet. 0 disables narrative inclusion. */
  maxUserIntentChars?: number;
  /** Hard cap on the number of user intents pulled out of the trimmed window. */
  maxUserIntents?: number;
}

function buildTokenEstimator(options: TrimConversationOptions = {}): TokenEstimator {
  const charsPerToken = options.charsPerToken ?? DEFAULT_CHARS_PER_TOKEN;
  const imageTokensHigh = options.imageTokensHigh ?? DEFAULT_IMAGE_TOKENS_HIGH;
  const imageTokensLow = options.imageTokensLow ?? DEFAULT_IMAGE_TOKENS_LOW;
  const messageOverhead = options.messageOverhead ?? DEFAULT_MESSAGE_OVERHEAD;

  const estimateTextTokens = (text: string): number => Math.ceil(text.length / charsPerToken);

  const estimateMessageTokens = (message: ChatMessage): number => {
    let tokens = messageOverhead;

    if (typeof message.content === 'string') {
      tokens += estimateTextTokens(message.content);
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'text' && typeof part.text === 'string') {
          tokens += estimateTextTokens(part.text);
        } else if (part.type === 'image_url') {
          const imageUrl = part.image_url as { detail?: 'low' | 'high' | 'auto' } | undefined;
          const detail = imageUrl?.detail ?? 'auto';
          tokens += detail === 'low' ? imageTokensLow : imageTokensHigh;
        }
      }
    }

    if (message.tool_calls) {
      tokens += Math.ceil(JSON.stringify(message.tool_calls).length / charsPerToken);
    }

    return tokens;
  };

  return {
    estimateMessageTokens,
    estimateTotalTokens(messages: ChatMessage[]): number {
      return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
    },
  };
}

export function estimateMessageTokens(
  message: ChatMessage,
  options?: TrimConversationOptions,
): number {
  return buildTokenEstimator(options).estimateMessageTokens(message);
}

export function estimateTotalTokens(
  messages: ChatMessage[],
  options?: TrimConversationOptions,
): number {
  return buildTokenEstimator(options).estimateTotalTokens(messages);
}

/**
 * Sliding-window context budget knobs shared by client and server. Both
 * surfaces use the same overhead/safety values so cloud-mode trimming
 * behaves the same as client-mode trimming when called with the same
 * model's `contextLength` and `outputBudget`.
 *
 * The host app passes the model's resolved `contextLength` (from the
 * SDK / planner catalog), the `outputBudget` (max_tokens it intends to
 * request), and optional `toolSchemaTokens` for the tool surface. The
 * helper returns the per-round `inputBudget` that should be passed to
 * `trimConversation`.
 */
export interface ContextBudgetInput {
  /** Total context window the LLM supports (e.g. 262_144 for Qwen 3.6). */
  contextLength: number;
  /** Output (completion) tokens the caller intends to reserve. */
  outputBudget: number;
  /** Safety margin reserved for prompt formatting overhead. */
  safetyMargin?: number;
  /** Tokens reserved for the JSON tool catalog surface. */
  toolSchemaTokens?: number;
}

export interface ContextBudgetResult {
  contextLength: number;
  outputBudget: number;
  safetyMargin: number;
  toolSchemaTokens: number;
  inputBudget: number;
}

export const DEFAULT_CONTEXT_SAFETY_MARGIN = 2_048;
export const DEFAULT_TOOL_SCHEMA_TOKENS = 16_000;

export function computeContextBudget(input: ContextBudgetInput): ContextBudgetResult {
  const safetyMargin = input.safetyMargin ?? DEFAULT_CONTEXT_SAFETY_MARGIN;
  const toolSchemaTokens = input.toolSchemaTokens ?? DEFAULT_TOOL_SCHEMA_TOKENS;
  const inputBudget = Math.max(
    0,
    input.contextLength - input.outputBudget - safetyMargin - toolSchemaTokens,
  );
  return {
    contextLength: input.contextLength,
    outputBudget: input.outputBudget,
    safetyMargin,
    toolSchemaTokens,
    inputBudget,
  };
}

function contentHasImage(message: ChatMessage): boolean {
  if (!Array.isArray(message.content)) return false;
  return message.content.some((part) => part.type === 'image_url');
}

function groupMessages(messages: ChatMessage[], estimator: TokenEstimator): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const message = messages[i];

    if (message.role === 'assistant' && message.tool_calls?.length) {
      const group: ChatMessage[] = [message];
      let tokens = estimator.estimateMessageTokens(message);
      const groupHasImage = contentHasImage(message);
      i += 1;

      while (i < messages.length && messages[i].role === 'tool') {
        group.push(messages[i]);
        tokens += estimator.estimateMessageTokens(messages[i]);
        i += 1;
      }

      groups.push({ messages: group, tokens, hasImage: groupHasImage });
    } else {
      groups.push({
        messages: [message],
        tokens: estimator.estimateMessageTokens(message),
        hasImage: contentHasImage(message),
      });
      i += 1;
    }
  }

  return groups;
}

function maskOldToolResults(
  groups: MessageGroup[],
  protectedCount: number,
  unmaskableTools: ReadonlySet<string>,
  estimator: TokenEstimator,
): { groups: MessageGroup[]; tokensSaved: number } {
  const maskBoundary = groups.length - protectedCount;
  let tokensSaved = 0;

  const masked = groups.map((group, i) => {
    if (i >= maskBoundary) return group;

    let groupTokensSaved = 0;
    const maskedMessages = group.messages.map((message) => {
      if (message.role !== 'tool') return message;
      if (message.name && unmaskableTools.has(message.name)) return message;

      const originalTokens = estimator.estimateMessageTokens(message);
      try {
        const parsed = JSON.parse(typeof message.content === 'string' ? message.content : '');
        if ('ok' in parsed && Object.keys(parsed).length <= 4) return message;

        const compact: Record<string, unknown> = parsed.error
          ? { ok: false, error: parsed.error }
          : { ok: true, n: parsed.resultCount || 1 };
        if (parsed.startIndex !== undefined) compact.i = parsed.startIndex;
        if (parsed.videoStartIndex !== undefined) compact.vi = parsed.videoStartIndex;

        const maskedMessage: ChatMessage = { ...message, content: JSON.stringify(compact) };
        groupTokensSaved += originalTokens - estimator.estimateMessageTokens(maskedMessage);
        return maskedMessage;
      } catch {
        return message;
      }
    });

    tokensSaved += groupTokensSaved;
    return {
      messages: maskedMessages,
      tokens: group.tokens - groupTokensSaved,
      hasImage: group.hasImage,
    };
  });

  return { groups: masked, tokensSaved };
}

function getSummaryTokenBudget(inputBudget: number): number {
  if (inputBudget <= 0) return 0;
  const proportionalBudget = Math.min(SUMMARY_TOKEN_BUDGET, Math.floor(inputBudget * 0.08));
  return Math.min(inputBudget, Math.max(Math.min(MIN_SUMMARY_TOKEN_BUDGET, inputBudget), proportionalBudget));
}

function truncateSummaryPrompt(prompt: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (prompt.length <= maxChars) return prompt;
  if (maxChars <= 24) return prompt.slice(0, maxChars);
  const available = maxChars - 5;
  const headChars = Math.ceil(available * 0.65);
  const tailChars = Math.max(0, available - headChars);
  return `${prompt.slice(0, headChars)} ... ${tailChars > 0 ? prompt.slice(-tailChars) : ''}`;
}

/**
 * Extract a compact narrative of user intents from the trimmed groups.
 *
 * The existing summary path enumerates *what was generated*; this captures
 * *what was discussed* so the LLM keeps a thread of intent across rolling
 * compactions. Each intent is the first sentence (or ~80 chars) of a user
 * message in the trimmed window. Tool-result echoes and assistant turns
 * are skipped — the narrative is user-facing only.
 */
function extractUserIntentsFromTrimmedGroups(
  trimmedGroups: MessageGroup[],
  options: SummaryOptions,
): string[] {
  const maxIntents = options.maxUserIntents ?? 0;
  const maxChars = options.maxUserIntentChars ?? 0;
  if (maxIntents <= 0 || maxChars <= 0) return [];

  const intents: string[] = [];
  for (const group of trimmedGroups) {
    if (intents.length >= maxIntents) break;
    for (const message of group.messages) {
      if (message.role !== 'user') continue;
      let text = '';
      if (typeof message.content === 'string') {
        text = message.content;
      } else if (Array.isArray(message.content)) {
        text = (message.content as Array<{ type: string; text?: string }>)
          .filter((part) => part.type === 'text')
          .map((part) => part.text || '')
          .join(' ');
      }
      const cleaned = text
        .replace(/\[Earlier:[^\]]*\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleaned) continue;
      const sentenceEnd = cleaned.search(/[.!?](\s|$)/);
      const firstSentence = sentenceEnd > 0 ? cleaned.slice(0, sentenceEnd + 1) : cleaned;
      const truncated = firstSentence.length > maxChars
        ? `${firstSentence.slice(0, Math.max(0, maxChars - 1)).trim()}…`
        : firstSentence;
      if (truncated) intents.push(truncated);
      if (intents.length >= maxIntents) break;
    }
  }
  return intents;
}

function buildEnrichedSummary(
  trimmedGroups: MessageGroup[],
  options: SummaryOptions,
  mediaTools: { videoTools: ReadonlySet<string>; audioTools: ReadonlySet<string> },
): ChatMessage | null {
  const events: string[] = [];
  let hasUpload = false;
  const generatedItems: string[] = [];
  let omittedGeneratedItems = 0;

  for (const group of trimmedGroups) {
    for (const message of group.messages) {
      if (message.role === 'user' && typeof message.content === 'string' && message.content.includes('[Earlier:')) continue;
      if (message.role === 'user' && Array.isArray(message.content)) {
        if (message.content.some((part) => part.type === 'image_url')) {
          hasUpload = true;
        }
      }
    }

    const toolCallsMessage = group.messages.find(
      (message) => message.role === 'assistant' && message.tool_calls?.length,
    );
    const toolResultMap = new Map<string, ChatMessage>();
    for (const message of group.messages) {
      if (message.role === 'tool' && message.tool_call_id) toolResultMap.set(message.tool_call_id, message);
    }

    if (!toolCallsMessage?.tool_calls) continue;

    for (const toolCall of toolCallsMessage.tool_calls) {
      if (generatedItems.length >= options.maxGeneratedItems) {
        omittedGeneratedItems += 1;
        continue;
      }

      const result = toolResultMap.get(toolCall.id);
      const name = toolCall.function.name;
      let count = 1;
      let startIndex: number | undefined;
      let videoStartIndex: number | undefined;

      if (result) {
        try {
          const parsed = JSON.parse(typeof result.content === 'string' ? result.content : '');
          if (parsed.error || parsed.ok === false) continue;
          count = parsed.n ?? parsed.resultCount ?? 1;
          startIndex = parsed.i ?? parsed.startIndex;
          videoStartIndex = parsed.vi ?? parsed.videoStartIndex;
        } catch {
          // Use defaults.
        }
      }

      let promptText = '';
      try {
        const args = JSON.parse(toolCall.function.arguments);
        if (typeof args.prompt === 'string') {
          promptText = truncateSummaryPrompt(args.prompt.trim(), options.maxPromptChars);
        }
      } catch {
        // No prompt.
      }

      const mediaType = mediaTools.videoTools.has(name)
        ? 'video'
        : mediaTools.audioTools.has(name) ? 'audio' : 'image';
      const effectiveStartIndex = mediaTools.videoTools.has(name) ? (videoStartIndex ?? startIndex) : startIndex;
      const indexRange = effectiveStartIndex !== undefined
        ? (count > 1 ? ` #${effectiveStartIndex}-${effectiveStartIndex + count - 1}` : ` #${effectiveStartIndex}`)
        : '';
      const label = `${count} ${mediaType}${count > 1 ? 's' : ''}${indexRange}`;
      generatedItems.push(
        promptText
          ? `${label} (${name}, prompt=${JSON.stringify(promptText)})`
          : `${label} (${name})`,
      );
    }
  }

  if (omittedGeneratedItems > 0) {
    generatedItems.push(`${omittedGeneratedItems} older generated batch${omittedGeneratedItems > 1 ? 'es' : ''} omitted from summary`);
  }

  if (hasUpload) events.push('User uploaded media');
  if (generatedItems.length > 0) events.push(`Generated: ${generatedItems.join(', ')}`);

  const userIntents = extractUserIntentsFromTrimmedGroups(trimmedGroups, options);
  if (userIntents.length > 0) {
    events.push(`Conversation thread: ${userIntents.join(' | ')}`);
  }

  if (events.length === 0) return null;

  return {
    role: 'user',
    content: `[Earlier: ${events.join('. ')}. Details trimmed.]`,
  };
}

function buildBoundedEnrichedSummary(
  trimmedGroups: MessageGroup[],
  maxSummaryTokens: number,
  mediaTools: { videoTools: ReadonlySet<string>; audioTools: ReadonlySet<string> },
  estimator: TokenEstimator,
): { summary: ChatMessage | null; tokens: number } {
  const candidates: SummaryOptions[] = [
    { maxPromptChars: 1_200, maxGeneratedItems: 60, maxUserIntents: 12, maxUserIntentChars: 160 },
    { maxPromptChars: 800, maxGeneratedItems: 50, maxUserIntents: 10, maxUserIntentChars: 120 },
    { maxPromptChars: 400, maxGeneratedItems: 40, maxUserIntents: 8, maxUserIntentChars: 100 },
    { maxPromptChars: 200, maxGeneratedItems: 32, maxUserIntents: 6, maxUserIntentChars: 80 },
    { maxPromptChars: 80, maxGeneratedItems: 24, maxUserIntents: 4, maxUserIntentChars: 60 },
    { maxPromptChars: 0, maxGeneratedItems: 20, maxUserIntents: 0, maxUserIntentChars: 0 },
  ];

  for (const candidate of candidates) {
    const summary = buildEnrichedSummary(trimmedGroups, candidate, mediaTools);
    const tokens = summary ? estimator.estimateMessageTokens(summary) : 0;
    if (!summary || tokens <= maxSummaryTokens) {
      return { summary, tokens };
    }
  }

  const trimmedMessageCount = trimmedGroups.reduce((sum, group) => sum + group.messages.length, 0);
  const fallback: ChatMessage = {
    role: 'user',
    content: `[Earlier: ${trimmedMessageCount} older messages were compacted to stay within context. Details trimmed.]`,
  };
  const fallbackTokens = estimator.estimateMessageTokens(fallback);
  return fallbackTokens <= maxSummaryTokens
    ? { summary: fallback, tokens: fallbackTokens }
    : { summary: null, tokens: 0 };
}

export function trimConversation(
  messages: ChatMessage[],
  systemMessage: ChatMessage,
  inputBudget: number,
  options: TrimConversationOptions = {},
): TrimConversationResult {
  const estimator = buildTokenEstimator(options);
  const minProtectedGroups = options.minProtectedGroups ?? DEFAULT_MIN_PROTECTED_GROUPS;
  const mediaTools = {
    videoTools: options.videoTools ?? DEFAULT_VIDEO_TOOLS,
    audioTools: options.audioTools ?? DEFAULT_AUDIO_TOOLS,
  };
  const unmaskableTools = options.unmaskableTools ?? DEFAULT_UNMASKABLE_TOOLS;
  const systemTokens = estimator.estimateMessageTokens(systemMessage);
  const totalTokens = systemTokens + estimator.estimateTotalTokens(messages);
  const baseResult = {
    tokensSaved: 0,
    beforeTokens: totalTokens,
    afterTokens: totalTokens,
    availableTokens: inputBudget - totalTokens,
    inputBudget,
    action: 'none' as ContextCompactionAction,
    messageCountBefore: messages.length,
    messageCountAfter: messages.length,
    trimmedGroups: 0,
    keptGroups: 0,
    protectedGroups: 0,
    summaryTokens: 0,
    summaryTokenBudget: getSummaryTokenBudget(inputBudget),
  };

  if (totalTokens <= inputBudget) {
    return {
      ...baseResult,
      messages,
      trimmedCount: 0,
      insertedSummary: false,
    };
  }

  const groups = groupMessages(messages, estimator);
  if (groups.length <= minProtectedGroups) {
    return {
      ...baseResult,
      messages,
      trimmedCount: 0,
      insertedSummary: false,
      action: 'over_budget_untrimmed',
      groupCountBefore: groups.length,
      groupCountAfter: groups.length,
      protectedGroups: groups.length,
    };
  }

  const protectedCount = Math.min(minProtectedGroups, groups.length);
  const { groups: maskedGroups, tokensSaved } = maskOldToolResults(
    groups,
    protectedCount,
    unmaskableTools,
    estimator,
  );

  if (tokensSaved > 0) {
    console.log(`[CONTEXT] Observation masking saved ${tokensSaved} tokens`);
  }

  const maskedTotal = systemTokens + maskedGroups.reduce((sum, group) => sum + group.tokens, 0);
  if (maskedTotal <= inputBudget) {
    const maskedMessages = maskedGroups.flatMap((group) => group.messages);
    return {
      ...baseResult,
      messages: maskedMessages,
      trimmedCount: 0,
      insertedSummary: false,
      tokensSaved,
      afterTokens: maskedTotal,
      availableTokens: inputBudget - maskedTotal,
      action: 'masked',
      messageCountAfter: maskedMessages.length,
      groupCountBefore: groups.length,
      groupCountAfter: maskedGroups.length,
      protectedGroups: protectedCount,
    };
  }

  const trimmable = maskedGroups.slice(0, maskedGroups.length - protectedCount);
  const protectedGroups = maskedGroups.slice(maskedGroups.length - protectedCount);

  let protectedTokens = systemTokens;
  for (const group of protectedGroups) protectedTokens += group.tokens;

  let dropCount = 0;
  let trimmableTotal = trimmable.reduce((sum, group) => sum + group.tokens, 0);
  const summaryTokenBudget = getSummaryTokenBudget(inputBudget);
  let summaryTokens = 0;
  while (dropCount < trimmable.length) {
    const summaryResult = buildBoundedEnrichedSummary(
      trimmable.slice(0, dropCount),
      summaryTokenBudget,
      mediaTools,
      estimator,
    );
    summaryTokens = summaryResult.tokens;
    if (protectedTokens + trimmableTotal + summaryTokens <= inputBudget) break;
    trimmableTotal -= trimmable[dropCount].tokens;
    dropCount += 1;
  }

  if (protectedTokens > inputBudget) {
    console.warn(`[CONTEXT] Protected groups (${protectedTokens} tokens) exceed input budget (${inputBudget}) - API call may be truncated`);
  }

  const trimmedGroups = trimmable.slice(0, dropCount);
  const keptTrimmable = trimmable.slice(dropCount);
  const trimmedCount = trimmedGroups.reduce((sum, group) => sum + group.messages.length, 0);
  const summaryResult = buildBoundedEnrichedSummary(
    trimmedGroups,
    summaryTokenBudget,
    mediaTools,
    estimator,
  );
  const summary = summaryResult.summary;
  summaryTokens = summaryResult.tokens;
  const finalTotal = protectedTokens
    + keptTrimmable.reduce((sum, group) => sum + group.tokens, 0)
    + summaryTokens;

  if (finalTotal > inputBudget) {
    console.warn(`[CONTEXT] Trimmed payload (${finalTotal} tokens) exceeds input budget (${inputBudget}) after preserving full prompt manifest`);
  }

  const result: ChatMessage[] = [];
  if (summary) result.push(summary);
  for (const group of keptTrimmable) result.push(...group.messages);
  for (const group of protectedGroups) result.push(...group.messages);

  console.log(`[CONTEXT] Trimmed ${trimmedCount} messages after masking (${trimmedGroups.length} groups dropped, ${keptTrimmable.length} kept)`);

  return {
    ...baseResult,
    messages: result,
    trimmedCount,
    insertedSummary: Boolean(summary),
    tokensSaved,
    afterTokens: finalTotal,
    availableTokens: inputBudget - finalTotal,
    action: 'trimmed',
    messageCountAfter: result.length,
    groupCountBefore: groups.length,
    groupCountAfter: keptTrimmable.length + protectedGroups.length + (summary ? 1 : 0),
    trimmedGroups: trimmedGroups.length,
    keptGroups: keptTrimmable.length,
    protectedGroups: protectedGroups.length,
    summaryTokens,
    summaryTokenBudget,
  };
}
