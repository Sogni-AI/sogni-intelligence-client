import { minimaxH3AudioGuideMode } from '../media/videoSettings.js';
import {
  MINIMAX_H3_MAX_KEYFRAMES,
  checkMinimaxH3Keyframes,
  minimaxH3JobFramesForDuration,
  minimaxH3KeyframeEdgeHint,
  minimaxH3KeyframeWorkflow,
} from '../media/minimaxH3Keyframes.js';
import {
  getMinimaxH3KeyframeSelectors,
  supportsMinimaxH3Keyframes,
} from '../tools/shared/modelRegistry.js';
import { checkToolArgumentPromptLimits } from './promptLimits.js';

export interface HostedToolSchemaProperty {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  items?: HostedToolSchemaProperty | HostedToolSchemaProperty[];
  required?: string[];
  properties?: Record<string, HostedToolSchemaProperty>;
  additionalProperties?: boolean | HostedToolSchemaProperty;
  anyOf?: HostedToolSchemaProperty[];
  oneOf?: HostedToolSchemaProperty[];
  allOf?: HostedToolSchemaProperty[];
}

export interface HostedToolSchema extends HostedToolSchemaProperty {
  type?: string | string[];
}

export interface HostedToolDefinition {
  function: {
    name: string;
    parameters?: HostedToolSchema;
  };
}

export interface ValidateHostedToolArgumentsOptions {
  skipEnumProperties?: string[];
  coercePrimitives?: boolean;
  stripUnknownProperties?: boolean;
}

export interface HostedToolArgumentValidationResult {
  ok: boolean;
  errors: string[];
}

export interface NormalizeHostedToolArgumentsResult extends HostedToolArgumentValidationResult {
  cleaned: Record<string, unknown>;
  warnings: string[];
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case 'array':
      return Array.isArray(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function typeLabel(type: string | string[] | undefined): string {
  if (Array.isArray(type)) return type.join(' or ');
  return type ?? 'valid value';
}

function typeList(type: string | string[] | undefined): string[] {
  if (!type) return [];
  return Array.isArray(type) ? type : [type];
}

function formatEnum(values: unknown[]): string {
  return values.map(value => JSON.stringify(value)).join(', ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return left === right;
  if (typeof left !== 'object') return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function coerceValueForTypes(
  value: unknown,
  allowedTypes: string[],
): { value: unknown; coerced: boolean } {
  if (typeof value !== 'string') return { value, coerced: false };
  const trimmed = value.trim();
  if (!trimmed) return { value, coerced: false };

  if (allowedTypes.includes('integer') || allowedTypes.includes('number')) {
    const numberValue = Number(trimmed);
    if (
      Number.isFinite(numberValue)
      && (!allowedTypes.includes('integer') || Number.isInteger(numberValue))
    ) {
      return { value: numberValue, coerced: true };
    }
  }

  if (allowedTypes.includes('boolean')) {
    if (/^(?:true|false)$/i.test(trimmed)) {
      return { value: trimmed.toLowerCase() === 'true', coerced: true };
    }
  }

  return { value, coerced: false };
}

/** The video tools whose `keyframes` argument pins MiniMax H3 intermediate keyframes. */
const MINIMAX_H3_KEYFRAME_TOOLS: ReadonlySet<string> = new Set(['animate_photo', 'sound_to_video', 'generate_video']);

/** Seconds the video tools render when `duration` is omitted. */
const DEFAULT_VIDEO_TOOL_DURATION_SECONDS = 5;

function isWellFormedKeyframe(entry: unknown): boolean {
  return isRecord(entry)
    && typeof entry.imageIndex === 'number'
    && Number.isInteger(entry.imageIndex)
    && typeof entry.atSeconds === 'number'
    && Number.isFinite(entry.atSeconds);
}

function formatSelectorList(selectors: readonly string[]): string {
  return selectors.map(selector => `"${selector}"`).join(', ');
}

/**
 * The refusal for `keyframes` on a videoModel that cannot pin them, naming the
 * selectors on this tool that can.
 */
function minimaxH3KeyframeModelError(toolName: string, videoModel: unknown): string {
  const supported = formatSelectorList(getMinimaxH3KeyframeSelectors(toolName));
  if (typeof videoModel !== 'string') {
    return `Argument "keyframes" needs a MiniMax H3 videoModel: on ${toolName} only ${supported} take keyframes. Set videoModel to one of them or remove "keyframes".`;
  }
  if (toolName === 'generate_video' && videoModel.startsWith('minimax-h3-') && minimaxH3KeyframeWorkflow(videoModel) === null) {
    return `videoModel "${videoModel}" is MiniMax H3 text-to-video, which cannot pin keyframes. On generate_video only the reference-to-video selectors ${supported} take "keyframes" (with an image or video reference); for a clip that starts on or passes through images use animate_photo with a MiniMax H3 image-to-video selector, or remove "keyframes".`;
  }
  return `videoModel "${videoModel}" cannot pin keyframes. On ${toolName} only ${supported} take "keyframes"; switch videoModel to one of them or remove "keyframes".`;
}

/**
 * MiniMax H3 intermediate keyframes: only on this tool's keyframe selectors,
 * at most 8, every time strictly inside the clip and on its own frame. The
 * tool schema reports malformed entries and a list over 8, so the timing
 * checks run only on a well-formed list. Frames come from `duration`
 * (default 5 s) on the H3 grid, by the model's own rule
 * (`minimaxH3JobFramesForDuration`: covering on the audio guide, nearest
 * elsewhere). A Sound to Video clip with no duration is sized
 * by its audio window, which only the executor knows: its times are checked
 * against the longest H3 clip here, and the executor checks them again against
 * the real frame count (`checkMinimaxH3Keyframes` with `frames`). An executor
 * that changes the duration after validation must re-check the same way.
 */
function minimaxH3KeyframeArgumentErrors(toolName: string, args: Record<string, unknown>): string[] {
  const keyframes = args.keyframes;
  if (!Array.isArray(keyframes) || keyframes.length === 0) return [];
  const videoModel = args.videoModel;
  if (!supportsMinimaxH3Keyframes(toolName, videoModel)) {
    return [minimaxH3KeyframeModelError(toolName, videoModel)];
  }
  if (keyframes.length > MINIMAX_H3_MAX_KEYFRAMES || !keyframes.every(isWellFormedKeyframe)) return [];

  const duration = typeof args.duration === 'number' && Number.isFinite(args.duration) && args.duration > 0
    ? args.duration
    : undefined;
  const sizedByAudio = toolName === 'sound_to_video' && duration === undefined;
  // The audio guide covers the requested seconds (6 s renders 158 frames); every
  // other H3 route snaps to the nearest count (6 s renders 141).
  const frames = sizedByAudio
    ? undefined
    : minimaxH3JobFramesForDuration(videoModel as string, duration ?? DEFAULT_VIDEO_TOOL_DURATION_SECONDS);
  const framesSource = frames === undefined
    ? undefined
    : duration === undefined
      ? `the default ${DEFAULT_VIDEO_TOOL_DURATION_SECONDS} s duration renders ${frames} frames`
      : `duration ${duration} renders ${frames} frames`;
  return checkMinimaxH3Keyframes(keyframes, {
    frames,
    framesSource,
    edgeHint: minimaxH3KeyframeEdgeHint(videoModel as string),
    suggestDuration: true,
    modelId: videoModel as string,
  }).errors;
}

// The MiniMax H3 source-audio checks below run on the prompt argument of
// every gated generate_video call, including durable workflow steps a caller
// submits directly. They used to be single regexes that take cubic or
// quadratic time on a crafted prompt; each helper returns the same boolean
// in linear time.

/**
 * Whether one bracketed run on a single line, `[` ... `]` with no `]` or
 * newline inside, contains `phrase`. Equivalent to testing
 * `\[[^\]\n]*` + phrase + `[^\]\n]*\]`. Each match of the scan starts at the
 * first `[` of a line segment and consumes that segment whether or not a
 * `]` closes it, so no character is read twice. Testing the inner text from
 * the first `[` covers every `[` the regex could start from, and its edges
 * sit next to `[` and `]`, which a word-boundary check treats as the ends
 * of the text.
 */
function bracketedRunContains(text: string, phrase: RegExp): boolean {
  for (const run of text.matchAll(/\[[^\]\n]*(\]?)/g)) {
    if (run[1] && phrase.test(run[0].slice(1, -1))) return true;
  }
  return false;
}

/**
 * Equivalent to testing `non_diegetic_music:\s*[\s\S]*<Audio\s+1>`. The
 * `\s*[\s\S]*` part accepts any text, so it holds when an `<Audio 1>` tag
 * (any whitespace before the 1) appears anywhere after the first
 * `non_diegetic_music:`.
 */
function namesAudioOneAfterNonDiegeticMusic(prompt: string): boolean {
  const marker = 'non_diegetic_music:';
  const at = prompt.indexOf(marker);
  return at !== -1 && /<Audio\s+1>/.test(prompt.slice(at + marker.length));
}

interface SchemaValidationContext {
  skipEnumProperties: Set<string>;
  coercePrimitives: boolean;
  stripUnknownProperties: boolean;
  errors: string[];
  warnings: string[];
}

function validateNumberBounds(
  path: string,
  value: number,
  schema: HostedToolSchemaProperty,
  errors: string[],
): void {
  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`Argument "${path}" must be at least ${schema.minimum}`);
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push(`Argument "${path}" must be at most ${schema.maximum}`);
  }
  if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
    errors.push(`Argument "${path}" must be greater than ${schema.exclusiveMinimum}`);
  }
  if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
    errors.push(`Argument "${path}" must be less than ${schema.exclusiveMaximum}`);
  }
  if (schema.exclusiveMinimum === true && schema.minimum !== undefined && value <= schema.minimum) {
    errors.push(`Argument "${path}" must be greater than ${schema.minimum}`);
  }
  if (schema.exclusiveMaximum === true && schema.maximum !== undefined && value >= schema.maximum) {
    errors.push(`Argument "${path}" must be less than ${schema.maximum}`);
  }
}

function validateStringConstraints(
  path: string,
  value: string,
  schema: HostedToolSchemaProperty,
  errors: string[],
): void {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(`Argument "${path}" must contain at least ${schema.minLength} character${schema.minLength === 1 ? '' : 's'}`);
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push(`Argument "${path}" must contain at most ${schema.maxLength} character${schema.maxLength === 1 ? '' : 's'}`);
  }
  if (schema.pattern) {
    try {
      // Hosted-tool schema authors near-universally assume anchored matching
      // for ID-like fields, but JSON Schema `pattern` is unanchored. Auto-anchor
      // to prevent prefix/suffix injection (e.g. `pattern: 'safe-prefix-'` should
      // reject `'evil-safe-prefix-suffix'`). Wrapping with `^(?:...)$` is safe
      // even for already-anchored patterns — `^^…$$` still matches the same set.
      if (!new RegExp(`^(?:${schema.pattern})$`).test(value)) {
        errors.push(`Argument "${path}" must match pattern ${JSON.stringify(schema.pattern)}`);
      }
    } catch {
      errors.push(`Schema for "${path}" contains invalid pattern ${JSON.stringify(schema.pattern)}`);
    }
  }
}

function validateCompositeSchema(
  path: string,
  value: unknown,
  schema: HostedToolSchemaProperty,
  context: SchemaValidationContext,
): { matched: boolean; value: unknown } {
  if (schema.allOf) {
    let nextValue = value;
    for (const childSchema of schema.allOf) {
      const result = validateValueAgainstSchema(path, nextValue, childSchema, context);
      nextValue = result.value;
    }
    return { matched: true, value: nextValue };
  }

  const alternatives = schema.oneOf ?? schema.anyOf;
  if (!alternatives) return { matched: true, value };

  const matches: unknown[] = [];
  for (const childSchema of alternatives) {
    const trial: SchemaValidationContext = {
      ...context,
      errors: [],
      warnings: [],
    };
    const result = validateValueAgainstSchema(path, value, childSchema, trial);
    if (trial.errors.length === 0) matches.push(result.value);
  }

  if (schema.oneOf && matches.length !== 1) {
    context.errors.push(`Argument "${path}" must match exactly one allowed schema`);
    return { matched: false, value };
  }
  if (schema.anyOf && matches.length < 1) {
    context.errors.push(`Argument "${path}" must match at least one allowed schema`);
    return { matched: false, value };
  }

  return { matched: true, value: matches[0] ?? value };
}

function validateObjectAgainstSchema(
  path: string,
  value: Record<string, unknown>,
  schema: HostedToolSchemaProperty,
  context: SchemaValidationContext,
): Record<string, unknown> {
  const properties = schema.properties ?? {};
  const cleaned: Record<string, unknown> = {};

  for (const required of schema.required ?? []) {
    const propValue = value[required];
    // Empty string and empty array are treated as missing — schema authors
    // assume `required` means "has a usable value", not "is non-undefined".
    // Empty object is left untouched (some schemas legitimately accept `{}`).
    const isMissing =
      propValue === undefined
      || propValue === null
      || propValue === ''
      || (Array.isArray(propValue) && propValue.length === 0);
    if (isMissing) {
      context.errors.push(`Missing required argument "${path ? `${path}.` : ''}${required}"`);
    }
  }

  for (const [name, entryValue] of Object.entries(value)) {
    if (entryValue === undefined || entryValue === null) {
      if (
        name in properties
        || schema.additionalProperties === true
        || isRecord(schema.additionalProperties)
        || (schema.additionalProperties !== false && !context.stripUnknownProperties)
      ) {
        cleaned[name] = entryValue;
      }
      continue;
    }

    const property = properties[name];
    if (!property) {
      // An explicit JSON-Schema additionalProperties policy owns this object.
      // The host-level stripUnknownProperties fallback applies only when the
      // schema is silent. Otherwise an intentionally open payload such as
      // compose_workflow_template.existing_template is reduced to `{}`.
      if (
        schema.additionalProperties === false
        || (schema.additionalProperties === undefined && context.stripUnknownProperties)
      ) {
        context.warnings.push(`Stripped unknown argument "${path ? `${path}.` : ''}${name}"`);
      } else if (isRecord(schema.additionalProperties)) {
        cleaned[name] = validateValueAgainstSchema(
          path ? `${path}.${name}` : name,
          entryValue,
          schema.additionalProperties,
          context,
        ).value;
      } else {
        cleaned[name] = entryValue;
      }
      continue;
    }

    cleaned[name] = validateValueAgainstSchema(
      path ? `${path}.${name}` : name,
      entryValue,
      property,
      context,
    ).value;
  }

  return cleaned;
}

function validateArrayAgainstSchema(
  path: string,
  value: unknown[],
  schema: HostedToolSchemaProperty,
  context: SchemaValidationContext,
): unknown[] {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    context.errors.push(`Argument "${path}" must contain at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}`);
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    context.errors.push(`Argument "${path}" must contain at most ${schema.maxItems} item${schema.maxItems === 1 ? '' : 's'}`);
  }

  if (!schema.items) return value;

  if (Array.isArray(schema.items)) {
    const tupleSchemas = schema.items;
    return value.map((item, index) => {
      const itemSchema = tupleSchemas[index];
      return itemSchema
        ? validateValueAgainstSchema(`${path}[${index}]`, item, itemSchema, context).value
        : item;
    });
  }

  return value.map((item, index) => validateValueAgainstSchema(`${path}[${index}]`, item, schema.items as HostedToolSchemaProperty, context).value);
}

function validateValueAgainstSchema(
  path: string,
  rawValue: unknown,
  schema: HostedToolSchemaProperty,
  context: SchemaValidationContext,
): { value: unknown } {
  const composite = validateCompositeSchema(path, rawValue, schema, context);
  if (!composite.matched) return { value: rawValue };
  let value = composite.value;

  const allowedTypes = typeList(schema.type);
  if (
    context.coercePrimitives
    && allowedTypes.length > 0
    && !allowedTypes.some(type => matchesType(value, type))
  ) {
    const coerced = coerceValueForTypes(value, allowedTypes);
    if (coerced.coerced) {
      context.warnings.push(`Coerced argument "${path}" to ${typeof coerced.value}`);
      value = coerced.value;
    }
  }

  if (allowedTypes.length > 0 && !allowedTypes.some(type => matchesType(value, type))) {
    context.errors.push(`Argument "${path}" must be ${typeLabel(schema.type)}`);
    return { value };
  }

  if (schema.const !== undefined && !valuesEqual(value, schema.const)) {
    context.errors.push(`Argument "${path}" must be ${JSON.stringify(schema.const)}`);
  }

  if (
    schema.enum
    && !context.skipEnumProperties.has(path)
    && !context.skipEnumProperties.has(path.split('.').at(-1) ?? path)
    && !schema.enum.some(candidate => valuesEqual(candidate, value))
  ) {
    context.errors.push(`Argument "${path}" must be one of ${formatEnum(schema.enum)}`);
  }

  if (typeof value === 'number') {
    validateNumberBounds(path, value, schema, context.errors);
  }
  if (typeof value === 'string') {
    validateStringConstraints(path, value, schema, context.errors);
  }
  if (Array.isArray(value)) {
    value = validateArrayAgainstSchema(path, value, schema, context);
  }
  if (isRecord(value)) {
    value = validateObjectAgainstSchema(path, value, schema, context);
  }

  return { value };
}

export function validateAndNormalizeHostedToolArguments(
  tools: HostedToolDefinition[],
  toolName: string,
  args: Record<string, unknown>,
  options: ValidateHostedToolArgumentsOptions = {},
): NormalizeHostedToolArgumentsResult {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return {
      ok: false,
      errors: ['Tool arguments must be a JSON object'],
      cleaned: {},
      warnings: [],
    };
  }

  const tool = tools.find(candidate => candidate.function.name === toolName);
  if (!tool) {
    return {
      ok: false,
      errors: [`Unknown hosted Sogni tool "${toolName}"`],
      cleaned: args,
      warnings: [],
    };
  }

  const schema = tool.function.parameters;
  if (!schema) {
    return { ok: true, errors: [], cleaned: args, warnings: [] };
  }

  const context: SchemaValidationContext = {
    skipEnumProperties: new Set(options.skipEnumProperties ?? ['model']),
    coercePrimitives: options.coercePrimitives === true,
    stripUnknownProperties: options.stripUnknownProperties === true,
    errors: [],
    warnings: [],
  };

  // Check the original arguments before unknown-property cleanup can erase
  // this retired option and turn the request into a different video job.
  if (
    (toolName === 'generate_video' || toolName === 'animate_photo')
    && Object.prototype.hasOwnProperty.call(args, 'outputScale')
  ) {
    context.errors.push(
      'Argument "outputScale" is no longer supported. For MiniMax H3 two-stage output, use a -2stage videoModel with targetResolution 720, 1080, or 1440.',
    );
  }

  const normalizedSchema: HostedToolSchema = {
    ...schema,
    type: schema.type ?? 'object',
  };
  const cleaned = validateValueAgainstSchema('', args, normalizedSchema, context).value;
  const cleanedRecord = isRecord(cleaned) ? cleaned : args;

  // Positional arrays: loraStrengths[i] belongs to loras[i], so a length
  // mismatch silently shifts every strength onto the wrong LoRA. Keyed off the
  // schema rather than a tool name — generate_image was the only tool that
  // accepted LoRAs when this landed, and edit_image, generate_video and
  // animate_photo each gained them later without gaining the check.
  if (isRecord(normalizedSchema.properties) && 'loras' in normalizedSchema.properties) {
    const loras = cleanedRecord.loras;
    const strengths = cleanedRecord.loraStrengths;
    if (Array.isArray(strengths) && !Array.isArray(loras)) {
      context.errors.push('Argument "loraStrengths" requires "loras"');
    } else if (
      Array.isArray(loras)
      && Array.isArray(strengths)
      && loras.length !== strengths.length
    ) {
      context.errors.push('Arguments "loras" and "loraStrengths" must contain the same number of entries');
    }
  }

  // MiniMax H3 Ref2VA jointly generates audio, so a reference video's
  // soundtrack cannot safely inherit an implicit creative role. Ask for a typed
  // decision before dispatch and enforce the official Context-IR markers for the
  // two source-conditioned policies. `replace` remains an explicit
  // user-authorized escape hatch and therefore needs no source-retention marker.
  //
  // Absence is an ERROR and there is deliberately no default value. Defaulting
  // to `reuse_exact` or `reference_only` would demand Context-IR markers the
  // prompt does not carry, so those fail anyway; `replace` is the only value
  // that validates without markers, and it is the copyright escape hatch — the
  // one outcome this contract exists to stop a caller taking by accident. A
  // warning was considered and rejected: the likely failure is an LLM omitting
  // the argument, and letting that proceed lands exactly the silent recomposition
  // the rule prevents. The error is actionable on both paths — the planner
  // surfaces it in `validationErrors` before submission, and a durable start
  // returns it as a 400 naming the argument.
  if (toolName === 'generate_video') {
    const model = cleanedRecord.videoModel;
    // Which selectors REQUIRE a source-audio policy and which ACCEPT one are two
    // questions, and one variable used to answer both. The requirement was
    // written for the selectors that existed (Standard and Turbo), and a
    // two-stage selector mirrors its one-stage base: minimax-h3-r2v is gated, so
    // minimax-h3-r2v-2stage is; minimax-h3-r2v-balanced is not, so
    // minimax-h3-r2v-balanced-2stage is not either.
    //
    // Accepting one is not optional in the same way. Balanced is an H3 R2V model:
    // the host applies the policy to every model whose workflow is reference to
    // video, the planner prompts give Standard, Balanced and Turbo one Ref2VA
    // contract, and the tool description tells callers every H3 R2V call takes
    // it. Refusing it on Balanced as "only supported by MiniMax H3 R2V models"
    // turned away callers who had followed that description.
    const isH3R2v = model === 'minimax-h3-r2v'
      || model === 'minimax-h3-r2v-turbo'
      || model === 'minimax-h3-r2v-2stage';
    const acceptsSourceAudioPolicy = isH3R2v
      || model === 'minimax-h3-r2v-balanced'
      || model === 'minimax-h3-r2v-balanced-2stage';
    const hasSourceMedia =
      (Array.isArray(cleanedRecord.referenceVideoIndices) && cleanedRecord.referenceVideoIndices.length > 0)
      || (Array.isArray(cleanedRecord.referenceAudioIndices) && cleanedRecord.referenceAudioIndices.length > 0);
    const sourceAudioPolicy = cleanedRecord.sourceAudioPolicy;
    if (isH3R2v && hasSourceMedia && sourceAudioPolicy === undefined) {
      context.errors.push(
        'Argument "sourceAudioPolicy" is required for MiniMax H3 R2V reference video/audio. Use "reuse_exact" for a specific/original/trending song.'
      );
    }
    if (sourceAudioPolicy !== undefined && !acceptsSourceAudioPolicy) {
      context.errors.push('Argument "sourceAudioPolicy" is only supported by MiniMax H3 R2V models');
    }
    // A policy means the same thing on every selector that takes one, so a
    // Balanced call that names it is held to the same prompt contract. Without
    // a policy neither branch below applies, which leaves a Balanced call that
    // omits it exactly as it was.
    if (acceptsSourceAudioPolicy && hasSourceMedia && typeof cleanedRecord.prompt === 'string') {
      const prompt = cleanedRecord.prompt;
      if (sourceAudioPolicy === 'reuse_exact') {
        if (!bracketedRunContains(prompt, /\baudio reuse\b/)) {
          context.errors.push('MiniMax H3 sourceAudioPolicy="reuse_exact" requires the official "audio reuse" summary task');
        }
        if (!/<Audio\s+1>\s*:\s*fully_copy\b/.test(prompt)) {
          context.errors.push('MiniMax H3 sourceAudioPolicy="reuse_exact" requires <Audio 1>: fully_copy in retention_analysis');
        }
        if (!namesAudioOneAfterNonDiegeticMusic(prompt)) {
          context.errors.push('MiniMax H3 sourceAudioPolicy="reuse_exact" requires non_diegetic_music to name <Audio 1> directly');
        }
      } else if (
        sourceAudioPolicy === 'reference_only'
        && !bracketedRunContains(prompt, /\baudio reference\b/)
      ) {
        context.errors.push('MiniMax H3 sourceAudioPolicy="reference_only" requires the official "audio reference" summary task');
      }
    }
  }

  // MiniMax H3 FastH3 audio guide. The frames an audio mode takes are fixed by
  // its graph, so an argument set that names a different shape would be refused
  // by the socket after the request was built. endImageIndex exists only for
  // the first/last-frame audio mode. A missing first frame on image + audio is
  // left to the host, which may resolve the latest or uploaded image.
  if (toolName === 'sound_to_video') {
    const audioGuideMode = minimaxH3AudioGuideMode(
      typeof cleanedRecord.videoModel === 'string' ? cleanedRecord.videoModel : undefined,
    );
    const hasSourceImageIndex = cleanedRecord.sourceImageIndex !== undefined;
    const hasEndImageIndex = cleanedRecord.endImageIndex !== undefined;
    if (hasEndImageIndex && audioGuideMode !== 'flfa2v') {
      context.errors.push(
        'Argument "endImageIndex" is only supported by videoModel "minimax-h3-fasth3-flfa2v-turbo" and "minimax-h3-fasth3-flfa2v-turbo-2stage"',
      );
    }
    if (audioGuideMode === 'flfa2v' && (!hasSourceImageIndex || !hasEndImageIndex)) {
      context.errors.push(
        `videoModel "${String(cleanedRecord.videoModel)}" needs both "sourceImageIndex" (first frame) and "endImageIndex" (last frame)`,
      );
    }
    if (audioGuideMode === 'a2v' && hasSourceImageIndex) {
      context.errors.push(
        `videoModel "${String(cleanedRecord.videoModel)}" is audio only and takes no "sourceImageIndex"; use "minimax-h3-fasth3-ia2v-turbo" for a first-frame image`,
      );
    }
    if (audioGuideMode && cleanedRecord.generateAudio === false) {
      context.errors.push(
        `videoModel "${String(cleanedRecord.videoModel)}" always delivers the uploaded audio; omit "generateAudio" or set it to true`,
      );
    }
    if (audioGuideMode && cleanedRecord.negativePrompt !== undefined) {
      context.errors.push(
        `videoModel "${String(cleanedRecord.videoModel)}" has no negative-prompt input; remove "negativePrompt"`,
      );
    }
  }

  // MiniMax H3 intermediate keyframes. A definition that does not declare the
  // argument would strip or ignore it and render the clip without them, so
  // that is refused rather than dropped.
  if (MINIMAX_H3_KEYFRAME_TOOLS.has(toolName) && args.keyframes !== undefined && args.keyframes !== null) {
    const declaresKeyframes = isRecord(normalizedSchema.properties) && 'keyframes' in normalizedSchema.properties;
    if (!declaresKeyframes) {
      context.errors.push(
        `Argument "keyframes" is not declared by this ${toolName} definition, so its MiniMax H3 keyframes would be lost; update the tool definition before sending keyframes, or remove "keyframes".`,
      );
    } else {
      context.errors.push(...minimaxH3KeyframeArgumentErrors(toolName, cleanedRecord));
    }
  }

  // Per-model prompt size limits (the Supernet refuses these with 4102). The
  // LLM gets the measured length and the limit so it can rewrite the prompt
  // shorter; nothing is cut here.
  for (const violation of checkToolArgumentPromptLimits(toolName, cleanedRecord)) {
    context.errors.push(
      `Argument "${violation.argument}" is too long${violation.modelId ? ` for videoModel/model "${violation.modelId}"` : ''}: ${violation.message.replace(/ Shorten (?:it|them) and submit again\.$/, '')} Rewrite it shorter, keeping the user's intent and every exact quoted span, and call the tool again; never cut it off mid-sentence.`,
    );
  }

  return {
    ok: context.errors.length === 0,
    errors: context.errors,
    cleaned: cleanedRecord,
    warnings: context.warnings,
  };
}

export function validateHostedToolArguments(
  tools: HostedToolDefinition[],
  toolName: string,
  args: Record<string, unknown>,
  options: ValidateHostedToolArgumentsOptions = {},
): HostedToolArgumentValidationResult {
  const result = validateAndNormalizeHostedToolArguments(tools, toolName, args, options);
  return {
    ok: result.ok,
    errors: result.errors,
  };
}

export function assertHostedToolArguments(
  tools: HostedToolDefinition[],
  toolName: string,
  args: Record<string, unknown>,
  options?: ValidateHostedToolArgumentsOptions,
): void {
  const result = validateHostedToolArguments(tools, toolName, args, options);
  if (!result.ok) {
    throw new Error(`Invalid ${toolName} arguments: ${result.errors.join('; ')}`);
  }
}
