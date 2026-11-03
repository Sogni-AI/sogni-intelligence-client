import { validateAndNormalizeHostedToolArguments, type HostedToolSchema } from '../contracts/hostedToolValidation.js';
import { mcpManifest } from './manifest.generated.js';

export const MCP_TOOLS = mcpManifest.tools;
export const MCP_CONTRACT_VERSION = mcpManifest.version;
export type McpMediaReference = { type: 'image' | 'video' | 'audio'; url: string };
export interface McpRoutedCall {
  toolName: string;
  arguments: Record<string, unknown>;
  mediaReferences: McpMediaReference[];
  requestId?: string;
  tokenType?: string;
  billingMode?: string;
  safeContentFilter?: boolean;
}

const definitions = MCP_TOOLS.map(tool => ({ function: {
  // The native validator's tool-specific rules apply after facade routing.
  name: `mcp_${tool.name}`, parameters: tool.inputSchema as unknown as HostedToolSchema,
} }));

// Enforce MCP's closed fields and non-nullable types before legacy native
// normalization, whose property lookup also sees inherited JavaScript names.
// Opaque native parameters and approval payloads keep their open schemas.
function assertMcpSchemaBoundary(schema: HostedToolSchema, value: unknown, path = 'arguments'): void {
  if (value === null) {
    const types = typeof schema.type === 'string' ? [schema.type] : schema.type;
    if ((types && !types.includes('null')) || (schema.enum && !schema.enum.includes(null))
      || (schema.const !== undefined && schema.const !== null)) throw new Error(`${path} cannot be null`);
    return;
  }
  if (Array.isArray(value)) {
    const items = schema.items;
    if (items) value.forEach((item, index) => {
      const child = Array.isArray(items) ? items[index] : items;
      if (child) assertMcpSchemaBoundary(child, item, `${path}[${index}]`);
    });
  } else if (value !== undefined && typeof value === 'object') {
    if (!schema.properties && schema.additionalProperties === true) return;
    for (const [key, entry] of Object.entries(value)) {
      const property = schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, key) ? schema.properties[key] : undefined;
      if (property) assertMcpSchemaBoundary(property, entry, `${path}.${key}`);
      else if (typeof schema.additionalProperties === 'object') assertMcpSchemaBoundary(schema.additionalProperties, entry, `${path}.${key}`);
      else if (schema.additionalProperties === false) throw new Error(`Unknown argument ${path}.${key}`);
    }
  }
}

export function validateMcpArguments(name: string, input: unknown): Record<string, unknown> {
  const schema = definitions.find(tool => tool.function.name === `mcp_${name}`)?.function.parameters;
  if (schema) assertMcpSchemaBoundary(schema, input);
  const result = validateAndNormalizeHostedToolArguments(definitions, `mcp_${name}`, input as Record<string, unknown>, {
    skipEnumProperties: [],
  });
  if (!result.ok || result.warnings.length) throw new Error([...result.errors, ...result.warnings].join('; '));
  return result.cleaned;
}

export function mcpMediaReferences(input: Record<string, unknown>): McpMediaReference[] {
  const refs: McpMediaReference[] = [];
  for (const [type, field] of [['image', 'reference_images'], ['video', 'reference_videos'], ['audio', 'reference_audios']] as const) {
    for (const raw of (input[field] as string[] | undefined) ?? []) {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('References require HTTPS download URLs without credentials');
      refs.push({ type, url: raw });
    }
  }
  return refs;
}

/** One mapping for quoting and dispatch. Native arguments are subsequently validated by the API. */
export function routeMcpCall(name: string, raw: unknown): McpRoutedCall {
  const input = validateMcpArguments(name, raw);
  const args: Record<string, unknown> = { ...((input.parameters as Record<string, unknown> | undefined) ?? {}) };
  const refs = mcpMediaReferences(input);
  const put = (key: string, value: unknown): void => {
    if (value === undefined) return;
    if (Object.prototype.hasOwnProperty.call(args, key)) throw new Error(`Specify ${key} once, outside parameters`);
    args[key] = value;
  };
  const add = (type: McpMediaReference['type'], url: unknown): number | undefined => {
    if (url === undefined) return undefined;
    const parsed = new URL(url as string);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('References require HTTPS download URLs without credentials');
    const index = refs.filter(ref => ref.type === type).length;
    refs.push({ type, url: url as string });
    return index;
  };
  put('prompt', input.prompt);
  put('numberOfVariations', input.count);
  let toolName: string;
  if (name === 'generate_image') {
    toolName = refs.some(ref => ref.type === 'image') || input.mask ? 'edit_image' : 'generate_image';
    if (refs.some(ref => ref.type !== 'image')) throw new Error('Image generation accepts image references only');
    if (input.mask && !refs.length) throw new Error('An image mask requires a reference image');
    put('model', input.model); put('width', input.width); put('height', input.height); put('seed', input.seed);
    // The native edit adapter expands a negative upload selector into the
    // primary plus sibling uploads. A generated-result selector (0) keeps
    // only one image, silently dropping a multi-reference request's context.
    if (refs.length) put('sourceImageIndex', refs.length > 1 ? -1 : 0);
    put('mask_image_url', input.mask);
  } else if (name === 'generate_video') {
    const first = add('image', input.first_frame);
    const last = add('image', input.last_frame);
    const audio = add('audio', input.audio);
    const source = add('video', input.source_video);
    if (last !== undefined && first === undefined) throw new Error('last_frame requires first_frame');
    const inferred = source !== undefined ? 'v2v' : audio !== undefined ? (first !== undefined ? (last !== undefined ? 'flfa2v' : 'ia2v') : 'a2v')
      : first !== undefined ? (last !== undefined ? 'flf' : 'i2v') : refs.length ? 'r2v' : 't2v';
    const mode = (input.mode as string | undefined) ?? inferred;
    if (mode !== inferred && !(mode === 'r2v' && first === undefined && audio === undefined && source === undefined)) {
      throw new Error(`mode ${mode} does not match the supplied reference fields; use ${inferred}`);
    }
    if (mode !== 'r2v' && ((input.reference_images as unknown[] | undefined)?.length
      || (input.reference_audios as unknown[] | undefined)?.length || (input.reference_videos as unknown[] | undefined)?.length)) {
      throw new Error('Use r2v for loose references, or frame/audio/source fields for other modes');
    }
    toolName = mode === 'v2v' ? 'video_to_video' : ['a2v', 'ia2v', 'flfa2v'].includes(mode) ? 'sound_to_video'
      : ['i2v', 'flf'].includes(mode) ? 'animate_photo' : 'generate_video';
    put('videoModel', input.model); put('duration', input.duration);
    if (toolName === 'generate_video') { put('width', input.width); put('height', input.height); }
    else if (input.width !== undefined || input.height !== undefined) {
      if (input.width === undefined || input.height === undefined || toolName === 'video_to_video') {
        throw new Error('Frame-driven video needs both width and height; video-to-video uses parameters.targetResolution');
      }
      put('aspectRatio', `${String(input.width)}x${String(input.height)}`);
    }
    put('sourceImageIndex', first); put('endImageIndex', last); put('audioSourceIndex', audio); put('videoSourceIndex', source);
    if (toolName === 'animate_photo' && last !== undefined) put('frameRole', 'both');
    if (mode === 'r2v') {
      if (!refs.length) throw new Error('r2v requires reference media');
      for (const [type, field] of [['image', 'referenceImageIndices'], ['video', 'referenceVideoIndices'], ['audio', 'referenceAudioIndices']] as const) {
        const indices = refs.filter(ref => ref.type === type).map((_, index) => index);
        if (indices.length) put(field, indices);
      }
    }
  } else if (name === 'generate_audio') {
    toolName = input.kind === 'speech' ? 'generate_speech' : 'generate_music';
    put('model', input.model); put('duration', input.duration);
    const voice = add('audio', input.voice_sample);
    if (voice !== undefined) {
      if (input.kind !== 'speech') throw new Error('voice_sample requires speech');
      put('voiceSourceIndex', voice);
    }
    if (refs.length && voice === undefined) throw new Error('Use voice_sample for reference speech audio');
    if (refs.some(ref => ref.type !== 'audio') || refs.filter(ref => ref.type === 'audio').length > 1) throw new Error('Speech accepts one voice sample');
  } else if (name === 'transform_media') {
    toolName = input.operation as string;
    const imageOperation = ['upscale_image', 'remove_background', 'restore_photo'].includes(toolName);
    const sourceType = imageOperation ? 'image' : 'video';
    const sources = refs.filter(ref => ref.type === sourceType);
    if (!sources.length) throw new Error(`This operation requires ${sourceType} references`);
    if (toolName !== 'stitch_video' && sources.length > 1) throw new Error('This operation accepts one source');
    if (toolName === 'upscale_image' || toolName === 'remove_background') put('sourceImageIndex', 0);
    if (toolName === 'upscale_video') put('sourceVideoIndex', 0);
    if (toolName === 'extend_video') put('videoIndex', 0);
    if (toolName === 'stitch_video') {
      put('videoIndices', sources.map((_, index) => index));
      if (refs.some(ref => ref.type === 'audio')) put('audioIndex', 0);
    }
    if (refs.some(ref => ref.type !== sourceType && !(toolName === 'stitch_video' && ref.type === 'audio'))
      || refs.filter(ref => ref.type === 'audio').length > 1) throw new Error('Unsupported references for this operation');
  } else {
    throw new Error('This tool does not route to a single generation workflow');
  }
  return { toolName, arguments: args, mediaReferences: refs,
    requestId: input.request_id as string | undefined, tokenType: input.token_type as string | undefined,
    billingMode: input.billing_mode as string | undefined, safeContentFilter: input.safe_content_filter as boolean | undefined };
}
