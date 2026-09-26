/**
 * Per-model prompt size limits for generation requests.
 *
 * The Sogni Supernet refuses an over-limit request at admission with error
 * 4102 ("This prompt is too long for the model."), using the tier fields
 * `maxPromptLength`, `promptLengthCjkWeight`, `maxPromptTokens` and
 * `promptTokenizer` served at `/api/v1/models/tiers/<modelId>`. This module
 * mirrors those limits so prompt expanders can build within them: state the
 * limit (with headroom) in an LLM instruction, check the output before it is
 * dispatched, and regenerate or refuse when it is over. Nothing here ever
 * shortens a prompt.
 *
 * A style prompt counts toward every limit: the Supernet appends it to the
 * prompt as ", <style>" before counting. Every model, capped or not, also has a
 * 200,000-character backstop (UNIVERSAL_MAX_PROMPT_CHARACTERS).
 *
 * Character limits are checked exactly. Token limits are checked against a
 * proven lower bound on the token count (every whitespace-separated word, or
 * pre-tokenizer piece, is at least one token), so a prompt is refused here only
 * when it is certainly over; anything closer to the limit is decided by the
 * Supernet's exact tokenizer count.
 */

export type PromptLimitTokenizer = 'umt5' | 't5xxl' | 'clip' | 'minimax-music3';

export interface CharacterPromptLimit {
  unit: 'characters';
  max: number;
  /** Weight of each Chinese (Han script) character (HappyHorse counts each as 2). */
  cjkWeight?: number;
}

export interface TokenPromptLimit {
  unit: 'tokens';
  max: number;
  tokenizer: PromptLimitTokenizer;
  /** Tokens the model adds to every prompt (start/end tokens, template tokens). */
  addedTokens: number;
}

export type PromptFieldLimit = CharacterPromptLimit | TokenPromptLimit;

export type PromptLimitFamily =
  | 'wan2.2'
  | 'flux1'
  | 'chroma'
  | 'minimax-h3'
  | 'wan3'
  | 'gpt-image'
  | 'happyhorse'
  | 'seedance'
  | 'ace-step'
  | 'minimax-music3'
  | 'sam3';

export interface PromptLengthAdvisory {
  /** Vendor guidance for English prompts, in words. */
  englishWords: number;
  /** Vendor guidance for Chinese prompts, in characters. */
  chineseCharacters: number;
}

export interface GenerationPromptLimits {
  family: PromptLimitFamily;
  modelName: string;
  /** The positive prompt, with any style prompt appended as ", <style>" (the Supernet counts it). */
  prompt?: PromptFieldLimit;
  negativePrompt?: PromptFieldLimit;
  lyrics?: PromptFieldLimit;
  /** Prompt (caption) and lyrics counted together. */
  promptWithLyrics?: PromptFieldLimit;
  /** Unenforced vendor guidance: longer prompts are accepted but may lose detail. */
  advisory?: PromptLengthAdvisory;
  /** One sentence for an LLM system prompt: the limit, with headroom. */
  instruction: string;
}

export type PromptLimitField = 'prompt' | 'negativePrompt' | 'lyrics' | 'promptWithLyrics';

export interface GenerationPromptText {
  prompt?: string | null;
  /** Appended to the prompt as ", <style>" by the Supernet before encoding. */
  stylePrompt?: string | null;
  negativePrompt?: string | null;
  lyrics?: string | null;
}

export interface PromptLimitViolation {
  field: PromptLimitField;
  unit: 'characters' | 'tokens';
  max: number;
  /** Exact (weighted) character count, or a proven lower bound on the token count. */
  measured: number;
  exact: boolean;
  /** Plain character length of the checked text. */
  characters: number;
  /** Full-sentence explanation for a person. */
  message: string;
}

/** Error code the Supernet uses for the same refusal. */
export const PROMPT_TOO_LONG_ERROR_CODE = 4102;

/**
 * The Supernet's backstop on every model, capped or not (Krea 2, Qwen Image,
 * Z-Image, SD/SDXL included): a prompt (with its style prompt), negative prompt
 * or lyric sheet over this many characters is refused with 4102.
 */
export const UNIVERSAL_MAX_PROMPT_CHARACTERS = 200_000;

export class PromptTooLongError extends Error {
  readonly code = PROMPT_TOO_LONG_ERROR_CODE;
  constructor(
    public readonly modelId: string,
    public readonly violations: readonly PromptLimitViolation[],
  ) {
    super(`This prompt is too long for the model. ${violations.map(v => v.message).join(' ')}`);
    this.name = 'PromptTooLongError';
  }
}

const fmt = (value: number): string => Math.round(value).toLocaleString('en-US');

// Characters of typical English per token, for plain-language hints only.
const ENGLISH_CHARS_PER_TOKEN = 4;

const WAN22_INSTRUCTION =
  'LENGTH LIMIT: Wan 2.2 reads at most 4,096 text tokens (about 3,000 English words or 4,000 Chinese characters), for the prompt and for the negative prompt; keep each under 2,000 English words or 3,000 Chinese characters. Never cut a prompt to fit; rewrite it shorter.';
const T5_INSTRUCTION = (name: string) =>
  `LENGTH LIMIT: ${name} reads at most 4,096 text tokens (about 3,000 English words); keep the prompt under 2,000 words. Never cut a prompt to fit; rewrite it shorter.`;

const LIMITS: Record<PromptLimitFamily, Omit<GenerationPromptLimits, 'family'>> = {
  'wan2.2': {
    modelName: 'Wan 2.2',
    prompt: { unit: 'tokens', max: 4096, tokenizer: 'umt5', addedTokens: 1 },
    negativePrompt: { unit: 'tokens', max: 4096, tokenizer: 'umt5', addedTokens: 1 },
    instruction: WAN22_INSTRUCTION,
  },
  flux1: {
    modelName: 'FLUX.1',
    prompt: { unit: 'tokens', max: 4096, tokenizer: 't5xxl', addedTokens: 1 },
    negativePrompt: { unit: 'tokens', max: 4096, tokenizer: 't5xxl', addedTokens: 1 },
    instruction: T5_INSTRUCTION('FLUX.1'),
  },
  chroma: {
    modelName: 'Chroma',
    prompt: { unit: 'tokens', max: 4096, tokenizer: 't5xxl', addedTokens: 1 },
    negativePrompt: { unit: 'tokens', max: 4096, tokenizer: 't5xxl', addedTokens: 1 },
    instruction: T5_INSTRUCTION('Chroma'),
  },
  'minimax-h3': {
    modelName: 'MiniMax H3',
    prompt: { unit: 'characters', max: 7000 },
    instruction:
      'LENGTH LIMIT: MiniMax H3 accepts at most 7,000 characters; keep the whole prompt under 6,000 characters. Never cut a prompt to fit; rewrite it shorter.',
  },
  wan3: {
    modelName: 'Wan 3',
    prompt: { unit: 'characters', max: 20000 },
    instruction:
      'LENGTH LIMIT: Wan 3 accepts at most 20,000 characters; keep the prompt under 17,000 characters. Never cut a prompt to fit; rewrite it shorter.',
  },
  'gpt-image': {
    modelName: 'GPT Image',
    prompt: { unit: 'characters', max: 32000 },
    instruction:
      'LENGTH LIMIT: GPT Image accepts at most 32,000 characters; keep the prompt under 27,000 characters. Never cut a prompt to fit; rewrite it shorter.',
  },
  happyhorse: {
    modelName: 'HappyHorse',
    prompt: { unit: 'characters', max: 5000, cjkWeight: 2 },
    instruction:
      'LENGTH LIMIT: HappyHorse accepts at most 5,000 characters, and each Chinese (Han) character counts as 2; keep the prompt under 4,200 characters (2,100 Chinese characters). Never cut a prompt to fit; rewrite it shorter.',
  },
  seedance: {
    modelName: 'Seedance',
    advisory: { englishWords: 1000, chineseCharacters: 500 },
    instruction:
      'LENGTH: Seedance keeps the most detail with English prompts under 1,000 words or Chinese prompts under 500 characters; longer prompts are accepted but may lose detail.',
  },
  'ace-step': {
    modelName: 'ACE-Step',
    prompt: { unit: 'characters', max: 4096 },
    lyrics: { unit: 'characters', max: 4096 },
    instruction:
      'LENGTH LIMIT: ACE-Step accepts at most 4,096 characters of caption/tags and at most 4,096 characters of lyrics, section tags and line breaks included; keep the lyrics under 3,500 characters. Never cut lyrics to fit; write fewer or shorter sections.',
  },
  'minimax-music3': {
    modelName: 'MiniMax Music 3',
    // The worker wraps caption and lyrics in a template of 7 special tokens
    // plus a "[start]" line before counting.
    promptWithLyrics: { unit: 'tokens', max: 5000, tokenizer: 'minimax-music3', addedTokens: 8 },
    instruction:
      'LENGTH LIMIT: MiniMax Music 3 reads at most 5,000 tokens of caption and lyrics together; keep them under 2,500 English words (or 3,000 Chinese characters) combined. Never cut lyrics to fit; write fewer or shorter sections.',
  },
  sam3: {
    modelName: 'SAM 3',
    prompt: { unit: 'tokens', max: 32, tokenizer: 'clip', addedTokens: 2 },
    instruction:
      'LENGTH LIMIT: SAM 3 reads at most 32 tokens, its start and end tokens included; name the object in a short noun phrase of at most 20 words.',
  },
};

function normalizeModelId(modelId: string): string {
  return modelId
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, '-')
    .replace(/-+/g, '-');
}

const FAMILY_PATTERNS: ReadonlyArray<readonly [PromptLimitFamily, RegExp]> = [
  ['wan3', /^wan3(?:-0)?(?:-|$)/],
  ['wan2.2', /^(?:wan22|wan-2-2|wan-v2-2)(?:-|$)|^wan-s2v$/],
  ['minimax-h3', /^minimax-h3(?:-|$)/],
  ['minimax-music3', /^(?:minimax-music-?3|music3)(?:-|$)/],
  ['happyhorse', /^happyhorse(?:-|$)/],
  ['seedance', /^(?:dreamina-)?seedance/],
  ['gpt-image', /^gpt-image-2(?:-|$)/],
  // FLUX.1 schnell, Kontext [dev] and Krea [dev] (T5-XXL); FLUX.2 has no cap.
  ['flux1', /^flux-?1(?:-|$)|^flux-schnell(?:-|$)/],
  ['chroma', /^chroma/],
  ['ace-step', /^ace-step(?:-|$)/],
  ['sam3', /^sam3(?:-|$)/],
];

/** The prompt limit family of a model id or selector, or null for a model without a limit. */
export function resolvePromptLimitFamily(modelId: string | null | undefined): PromptLimitFamily | null {
  if (typeof modelId !== 'string' || !modelId.trim()) return null;
  const normalized = normalizeModelId(modelId);
  for (const [family, pattern] of FAMILY_PATTERNS) {
    if (pattern.test(normalized)) return family;
  }
  return null;
}

/**
 * The prompt limits of a model id or selector (for example
 * `wan_v2.2-14b-fp8_i2v_lightx2v`, `minimax-h3-t2v-turbo`, `happyhorse-1.1-t2v`),
 * or null for a model with no model-specific limit (Krea 2, Z-Image, Qwen
 * Image, LTX, SD/SDXL, ...). checkGenerationPromptLimits still applies the
 * universal 200,000-character backstop to those.
 */
export function resolveGenerationPromptLimits(
  modelId: string | null | undefined,
): GenerationPromptLimits | null {
  const family = resolvePromptLimitFamily(modelId);
  return family ? { family, ...LIMITS[family] } : null;
}

/** The LLM instruction sentence for a model's prompt limit, or null when it has none. */
export function promptLimitInstruction(modelId: string | null | undefined): string | null {
  return resolveGenerationPromptLimits(modelId)?.instruction ?? null;
}

// The Supernet counts Unicode characters (code points) and weights Han-script
// characters for HappyHorse.
const HAN_CHARACTER = /\p{Script=Han}/gu;

/** Prompt length the way a character limit counts it: code points, Han weighted. */
function characterLength(text: string, cjkWeight = 1): number {
  const characters = Array.from(text).length;
  if (cjkWeight === 1) return characters;
  return characters + (text.match(HAN_CHARACTER)?.length ?? 0) * (cjkWeight - 1);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// A word the tokenizer cannot drop: it holds a letter, number, punctuation or symbol.
const VISIBLE = /[\p{L}\p{N}\p{P}\p{S}]/u;

function countVisibleWords(text: string): number {
  return text.split(/\s+/).filter(word => VISIBLE.test(word)).length;
}

// CLIP BPE pre-tokenizer (lowercased, whitespace collapsed): every match is at least one token.
const CLIP_PIECES = /'s|'t|'re|'ve|'m|'ll|'d|\p{L}+|\p{N}|[^\s\p{L}\p{N}]+/gu;
// Letter runs and single digits: each lands in its own piece of a byte-level
// BPE pre-tokenizer (Qwen-style, as MiniMax Music 3 uses), and the worker's
// lyric normalization never joins two of them.
const LETTER_RUNS_AND_DIGITS = /\p{L}+|\p{N}/gu;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * A proven lower bound on the number of tokens `text` encodes to, added tokens
 * included. For MiniMax Music 3 pass the lyrics: the caption is cleaned of
 * Markdown before counting, so it is not counted here.
 */
export function promptTokenLowerBound(limit: TokenPromptLimit, text: string): number {
  if (!text) return 0;
  let pieces: number;
  switch (limit.tokenizer) {
    case 'clip':
      pieces = countMatches(text.toLowerCase().replace(/\s+/g, ' ').trim(), CLIP_PIECES);
      break;
    case 'minimax-music3':
      pieces = countMatches(text, LETTER_RUNS_AND_DIGITS);
      break;
    default:
      // SentencePiece (UMT5, T5) never joins text across whitespace.
      pieces = countVisibleWords(text);
  }
  return pieces + limit.addedTokens;
}

export interface PromptFieldMeasurement {
  measured: number;
  exact: boolean;
  characters: number;
}

/**
 * Measures `text` against one field limit: the exact (weighted) character
 * count, or a lower bound on the token count.
 */
export function measurePromptField(limit: PromptFieldLimit, text: string): PromptFieldMeasurement {
  const characters = characterLength(text);
  if (limit.unit === 'characters') {
    return { measured: characterLength(text, limit.cjkWeight ?? 1), exact: true, characters };
  }
  return { measured: promptTokenLowerBound(limit, text), exact: false, characters };
}

const FIELD_LABELS: Record<PromptLimitField, string> = {
  prompt: 'prompt',
  negativePrompt: 'negative prompt',
  lyrics: 'lyrics',
  promptWithLyrics: 'prompt and lyrics together',
};

function violationMessage(
  field: PromptLimitField,
  limit: PromptFieldLimit,
  measurement: PromptFieldMeasurement,
  modelName: string,
): string {
  const label = FIELD_LABELS[field];
  const verb = field === 'lyrics' || field === 'promptWithLyrics' ? 'are' : 'is';
  const subject = `Your ${label}`;
  if (field === 'promptWithLyrics') {
    return `Your lyrics alone are at least ${fmt(measurement.measured)} tokens (${fmt(measurement.characters)} characters) with the model's template; ${modelName} reads at most ${fmt(limit.max)} tokens of caption and lyrics together. Shorten them and submit again.`;
  }
  if (limit.unit === 'characters') {
    const weight = limit.cjkWeight ?? 1;
    const counted = weight === 1
      ? `${fmt(measurement.measured)} characters`
      : `${fmt(measurement.measured)} characters long, counting each Chinese character ${weight === 2 ? 'twice' : `${weight} times`}`;
    return `${subject} ${verb} ${counted}; ${modelName} accepts at most ${fmt(limit.max)}. Shorten it and submit again.`;
  }
  return `${subject} ${verb} at least ${fmt(measurement.measured)} tokens (${fmt(measurement.characters)} characters); ${modelName} reads at most ${fmt(limit.max)} tokens, roughly ${fmt(limit.max * ENGLISH_CHARS_PER_TOKEN)} characters of English. Shorten it and submit again.`;
}

function encodedPositivePrompt(prompt: string, stylePrompt: string | null | undefined): string {
  const style = typeof stylePrompt === 'string' ? stylePrompt.trim() : '';
  return style ? `${prompt}, ${style}` : prompt;
}

/**
 * Every limit the given texts are certainly over for `modelId`. Empty when the
 * model has no limit or every text fits (or is too close to call here, in which
 * case the Supernet's exact count decides).
 */
export function checkGenerationPromptLimits(
  modelId: string | null | undefined,
  text: GenerationPromptText,
): PromptLimitViolation[] {
  const limits = resolveGenerationPromptLimits(modelId);
  const prompt = encodedPositivePrompt(typeof text.prompt === 'string' ? text.prompt : '', text.stylePrompt);
  const lyrics = typeof text.lyrics === 'string' ? text.lyrics : '';
  const negativePrompt = typeof text.negativePrompt === 'string' ? text.negativePrompt : '';
  const fields: Array<[PromptLimitField, PromptFieldLimit | undefined, string]> = [
    ['prompt', limits?.prompt, prompt],
    ['negativePrompt', limits?.negativePrompt, negativePrompt],
    ['lyrics', limits?.lyrics, lyrics],
    // Only the lyrics give a proven lower bound for Music 3 (see promptTokenLowerBound).
    ['promptWithLyrics', limits?.promptWithLyrics, lyrics],
  ];
  const modelName = limits?.modelName ?? 'Every Sogni model';
  const violations: PromptLimitViolation[] = [];
  const add = (field: PromptLimitField, limit: PromptFieldLimit, measurement: PromptFieldMeasurement) => {
    violations.push({
      field,
      unit: limit.unit,
      max: limit.max,
      measured: measurement.measured,
      exact: measurement.exact,
      characters: measurement.characters,
      message: violationMessage(field, limit, measurement, modelName),
    });
  };
  for (const [field, limit, value] of fields) {
    if (!limit || !value) continue;
    const measurement = measurePromptField(limit, value);
    if (measurement.measured > limit.max) add(field, limit, measurement);
  }
  // The universal backstop, for fields no model limit already refused.
  const backstop: CharacterPromptLimit = { unit: 'characters', max: UNIVERSAL_MAX_PROMPT_CHARACTERS };
  const backstopFields: Array<[PromptLimitField, string]> = [
    ['prompt', prompt],
    ['negativePrompt', negativePrompt],
    ['lyrics', lyrics],
  ];
  for (const [field, value] of backstopFields) {
    if (!value) continue;
    if (violations.some(v => v.field === field || (field === 'lyrics' && v.field === 'promptWithLyrics'))) continue;
    const measurement = measurePromptField(backstop, value);
    if (measurement.measured > backstop.max) add(field, backstop, measurement);
  }
  return violations;
}

/** Throws PromptTooLongError when a text is certainly over `modelId`'s limit. Never shortens anything. */
export function assertGenerationPromptWithinLimits(
  modelId: string | null | undefined,
  text: GenerationPromptText,
): void {
  const violations = checkGenerationPromptLimits(modelId, text);
  if (violations.length > 0) throw new PromptTooLongError(String(modelId), violations);
}

/**
 * A repair instruction for an LLM whose draft broke a limit: what was measured,
 * the limit, and a target with headroom. The draft must be rewritten, never cut.
 */
export function promptLimitRepairInstruction(
  modelId: string | null | undefined,
  violations: readonly PromptLimitViolation[],
): string {
  const modelName = resolveGenerationPromptLimits(modelId)?.modelName ?? 'The model';
  const details = violations.map(v => {
    const label = FIELD_LABELS[v.field];
    const target = Math.floor((v.max * 0.8) / 10) * 10;
    return v.unit === 'characters'
      ? `the ${label} came to ${fmt(v.measured)} characters; ${modelName} accepts at most ${fmt(v.max)}, so aim under ${fmt(target)}`
      : `the ${label} came to at least ${fmt(v.measured)} tokens; ${modelName} reads at most ${fmt(v.max)} tokens, so aim under ${fmt(target)}`;
  });
  return `LENGTH REPAIR REQUIRED: ${details.join('; ')}. Rewrite the whole result shorter while keeping its required structure, every exact quoted span, and the user's intent. Do not cut it off mid-sentence or drop required sections; condense wording instead.`;
}

/**
 * Seedance's unenforced length guidance: a warning when `prompt` is longer than
 * the vendor recommends, or null.
 */
export function promptLengthAdvisory(
  modelId: string | null | undefined,
  prompt: string | null | undefined,
): string | null {
  const limits = resolveGenerationPromptLimits(modelId);
  if (!limits?.advisory || typeof prompt !== 'string' || !prompt) return null;
  const chinese = prompt.match(HAN_CHARACTER)?.length ?? 0;
  const words = countWords(prompt.replace(HAN_CHARACTER, ' '));
  if (chinese > limits.advisory.chineseCharacters) {
    return `This ${limits.modelName} prompt has ${fmt(chinese)} Chinese characters; ${limits.modelName} keeps the most detail under ${fmt(limits.advisory.chineseCharacters)}.`;
  }
  if (words > limits.advisory.englishWords) {
    return `This ${limits.modelName} prompt has ${fmt(words)} words; ${limits.modelName} keeps the most detail under ${fmt(limits.advisory.englishWords)}.`;
  }
  return null;
}

/** Tool-schema guidance for video `prompt` fields (the LLM writes these directly). */
export const VIDEO_PROMPT_LENGTH_LIMITS_GUIDANCE =
  'PROMPT LENGTH LIMITS (an over-limit request is refused, never cut): MiniMax H3 at most 7,000 characters; HappyHorse at most 5,000 (each Chinese character counts as 2); Wan 3 at most 20,000; Wan 2.2 at most 4,096 tokens (about 3,000 English words) for the prompt and for negativePrompt. Seedance keeps the most detail under 1,000 English words or 500 Chinese characters. Stay well under these; condense wording instead of dropping required content.';

/** Tool-schema guidance for music `prompt` and `lyrics` fields. */
export const MUSIC_TEXT_LENGTH_LIMITS_GUIDANCE =
  'LENGTH LIMITS (an over-limit request is refused, never cut): ACE-Step accepts at most 4,096 characters of prompt and at most 4,096 characters of lyrics, tags and line breaks included; MiniMax Music 3 (music3) reads at most 5,000 tokens of prompt and lyrics together (about 3,500 English words). Keep ACE-Step lyrics under 3,500 characters.';

/** Tool-schema guidance for SAM 3 selection text. */
export const SAM3_TEXT_LENGTH_GUIDANCE =
  'SAM 3 reads at most 32 tokens, its start and end tokens included: use a short noun phrase of at most 20 words.';

// Generation tools whose prompt arguments reach a model verbatim (or as the
// brief a server-side expander grows). Authoring tools such as enhance_prompt
// take a source brief and are checked on their output instead.
const PROMPT_LIMITED_TOOLS = new Set([
  'generate_video',
  'animate_photo',
  'sound_to_video',
  'video_to_video',
  'extend_video',
  'replace_video_segment',
  'generate_image',
  'edit_image',
  'generate_music',
  'segment_image',
]);

/**
 * Which model a hosted tool call targets, for its prompt limits: undefined for
 * a tool that takes no generation prompt, null when the call names no model
 * (only the universal backstop applies).
 */
function toolCallPromptLimitModel(toolName: string, args: Record<string, unknown>): string | null | undefined {
  if (!PROMPT_LIMITED_TOOLS.has(toolName)) return undefined;
  const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
  switch (toolName) {
    case 'segment_image':
      return 'sam3';
    case 'generate_music': {
      const model = text(args.model);
      if (!model) return null;
      return model === 'turbo' || model === 'sft' ? 'ace-step' : model;
    }
    default:
      return text(args.videoModel) ?? text(args.model);
  }
}

export interface ToolArgumentPromptLimitViolation extends PromptLimitViolation {
  /** The tool argument that is over, e.g. "prompt", "lyrics" or "prompts[2]". */
  argument: string;
  /** The model the call names, or null when it names none (universal backstop only). */
  modelId: string | null;
}

/**
 * Every prompt-bearing argument of a generation tool call that is certainly
 * over its target model's limit (prompt, negativePrompt, lyrics, per-clip
 * prompts[], SAM 3 text). Hosts return these to the LLM as argument errors so
 * it rewrites the prompt shorter; nothing is cut.
 */
export function checkToolArgumentPromptLimits(
  toolName: string,
  args: Record<string, unknown>,
): ToolArgumentPromptLimitViolation[] {
  const modelId = toolCallPromptLimitModel(toolName, args);
  if (modelId === undefined) return [];
  const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
  const violations: ToolArgumentPromptLimitViolation[] = [];
  const add = (argument: string, found: PromptLimitViolation[]) => {
    for (const violation of found) {
      const name = violation.field === 'prompt' ? argument
        : violation.field === 'promptWithLyrics' ? 'lyrics'
          : violation.field;
      violations.push({ ...violation, argument: name, modelId });
    }
  };
  const promptArgument = toolName === 'segment_image' ? 'text' : 'prompt';
  add(promptArgument, checkGenerationPromptLimits(modelId, {
    prompt: str(args[promptArgument]),
    negativePrompt: str(args.negativePrompt),
    lyrics: str(args.lyrics),
  }));
  if (Array.isArray(args.prompts)) {
    args.prompts.forEach((entry, index) => {
      if (typeof entry === 'string') add(`prompts[${index}]`, checkGenerationPromptLimits(modelId, { prompt: entry }));
    });
  }
  return violations;
}
