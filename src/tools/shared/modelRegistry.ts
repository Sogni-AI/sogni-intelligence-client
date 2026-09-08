/**
 * Central model registry — maps tool names to their available generation
 * models. Used by chat UI menus, hosted-chat alternative-model surfacing, and
 * skill clients that need to enumerate switchable models for retry.
 *
 * Pure data + lookup helpers. When a handler adds/removes models, update
 * this registry to keep all three consumers in sync.
 */

export interface ModelOption {
  key: string;
  displayName: string;
}

/** Model options for quality-tier image editing tools. */
const QUALITY_TIER_MODELS: ModelOption[] = [
  { key: 'fast', displayName: 'Qwen Image Edit 2511 Lightning' },
  { key: 'hq', displayName: 'Qwen Image Edit 2511' },
  { key: 'pro', displayName: 'Qwen Image Edit 2511 (Pro)' },
];

/** Quality-only models for tools such as the SV3D pipeline. */
const QUALITY_ONLY_MODELS: ModelOption[] = [
  { key: 'fast', displayName: 'Qwen Image Edit 2511 Lightning' },
  { key: 'hq', displayName: 'Qwen Image Edit 2511' },
];

/** Exact active selectors that may be named on generate_image calls. */
export const GENERATE_IMAGE_MODELS = [
  { key: 'gpt-image-2', displayName: 'GPT Image 2' },
  { key: 'z-turbo', displayName: 'Z-Image Turbo' },
  { key: 'z-image', displayName: 'Z-Image' },
  { key: 'krea-2-turbo', displayName: 'Krea 2 Turbo' },
  { key: 'dark-beast-krea2', displayName: 'Dark Beast Krea 2' },
  { key: 'dark-beast-z-turbo', displayName: 'Dark Beast Z-Image Turbo' },
  { key: 'chroma-v46-flash', displayName: 'Chroma v.46 Flash' },
  { key: 'chroma1-hd', displayName: 'Chroma 1 HD' },
  { key: 'chroma-detail', displayName: 'Chroma Detail' },
  { key: 'flux-schnell', displayName: 'FLUX.1 Schnell' },
  { key: 'pony-v7', displayName: 'CyberRealistic Pony v7' },
  { key: 'qwen-2512', displayName: 'Qwen Image 2512' },
  { key: 'qwen-2512-lightning', displayName: 'Qwen Image 2512 Lightning' },
  { key: 'albedo-xl', displayName: 'AlbedoBase XL v3.1-Large' },
  { key: 'animagine-xl', displayName: 'Animagine XL 4.0' },
  { key: 'one-obsession-v22', displayName: 'One Obsession v2.2' },
  { key: 'anima-pencil-xl', displayName: 'Anima Pencil XL v5' },
  { key: 'art-universe-xl', displayName: 'Art Universe XL v6' },
  { key: 'hyphoria-real', displayName: 'Hyphoria Real [Illu] v0.5' },
  { key: 'analog-madness-xl', displayName: 'Analog Madness SDXL v2' },
  { key: 'cyberrealistic-xl', displayName: 'CyberRealistic XL v6' },
  { key: 'real-dream-xl', displayName: 'Real Dream XL-Pony-11' },
  { key: 'faetastic-xl', displayName: 'FaeTastic Details XL v24' },
  { key: 'zavychroma-xl', displayName: 'ZavyChromaXL v8' },
  { key: 'pony-faetality', displayName: 'Pony FaeTality v1.1' },
  { key: 'dreamshaper-xl', displayName: 'DreamShaper XL' },
] as const satisfies readonly ModelOption[];

/**
 * Map of tool names to their available generation models. Tools not listed
 * here (or with only 1 model) won't show "Switch Model" in the menu.
 */
export const MODELS_BY_TOOL: Record<string, ModelOption[]> = {
  generate_image: [...GENERATE_IMAGE_MODELS],
  edit_image: [
    { key: 'gpt-image-2', displayName: 'GPT Image 2' },
    { key: 'qwen-lightning', displayName: 'Qwen Image Edit Lightning' },
    { key: 'qwen', displayName: 'Qwen Image Edit 2511' },
    { key: 'krea-identity-edit', displayName: 'Krea 2 Identity Edit LoRA v1.2' },
    { key: 'dark-beast-krea2-identity-edit', displayName: 'Dark Beast Krea 2 Identity Edit' },
  ],
  restore_photo: QUALITY_TIER_MODELS,
  upscale_image: [
    { key: 'rtx-vsr', displayName: 'NVIDIA RTX Video Super Resolution' },
  ],
  apply_style: QUALITY_TIER_MODELS,
  refine_result: QUALITY_TIER_MODELS,
  change_angle: QUALITY_ONLY_MODELS,
  generate_video: [
    { key: 'ltx25', displayName: 'LTX 2.5 22B' },
    { key: 'ltx23', displayName: 'LTX 2.3 22B' },
    { key: 'wan22', displayName: 'WAN 2.2 14B' },
    { key: 'seedance2', displayName: 'Seedance 2.0' },
    { key: 'seedance2-mini', displayName: 'Seedance 2.0 Mini' },
    { key: 'seedance2-5', displayName: 'Seedance 2.5' },
    { key: 'minimax-h3-t2v', displayName: 'MiniMax H3 (Text to Video)' },
    { key: 'minimax-h3-t2v-turbo', displayName: 'MiniMax H3 LightX2V Turbo (Text to Video)' },
    { key: 'minimax-h3-fasth3-t2v-turbo', displayName: 'MiniMax H3 FastH3 Turbo (Text to Video)' },
    { key: 'minimax-h3-r2v', displayName: 'MiniMax H3 (Reference to Video)' },
    { key: 'minimax-h3-r2v-turbo', displayName: 'MiniMax H3 LightX2V Turbo (Reference to Video)' },
    { key: 'happyhorse-1.1-t2v', displayName: 'HappyHorse 1.1 (Text to Video)' },
    { key: 'happyhorse-1.1-i2v', displayName: 'HappyHorse 1.1 (Image to Video)' },
    { key: 'happyhorse-1.1-r2v', displayName: 'HappyHorse 1.1 (Reference to Video)' },
    { key: 'wan3.0-video', displayName: 'Wan 3' },
    { key: 'wan3.0-spicy-video', displayName: 'Wan 3.0 Enhanced' },
  ],
  animate_photo: [
    { key: 'ltx25', displayName: 'LTX 2.5 22B' },
    { key: 'ltx23', displayName: 'LTX 2.3 22B' },
    { key: 'wan22', displayName: 'WAN 2.2 14B' },
    { key: 'minimax-h3-i2v', displayName: 'MiniMax H3 (Image to Video)' },
    { key: 'minimax-h3-i2v-turbo', displayName: 'MiniMax H3 LightX2V Turbo (Image to Video)' },
    { key: 'minimax-h3-fasth3-i2v-turbo', displayName: 'MiniMax H3 FastH3 Turbo (Image to Video)' },
    { key: 'minimax-h3-flf2v', displayName: 'MiniMax H3 (First + Last Frame)' },
    { key: 'minimax-h3-flf2v-turbo', displayName: 'MiniMax H3 LightX2V Turbo (First + Last Frame)' },
    { key: 'minimax-h3-fasth3-flf2v-turbo', displayName: 'MiniMax H3 FastH3 Turbo (First + Last Frame)' },
    { key: 'wan3.0-video', displayName: 'Wan 3' },
    { key: 'wan3.0-spicy-video', displayName: 'Wan 3.0 Enhanced' },
  ],
  sound_to_video: [
    { key: 'wan-s2v', displayName: 'WAN 2.2 S2V' },
    { key: 'seedance2', displayName: 'Seedance 2.0 Image+Audio' },
    { key: 'seedance2-mini', displayName: 'Seedance 2.0 Mini Image+Audio' },
    { key: 'seedance2-5', displayName: 'Seedance 2.5 Image+Audio' },
    { key: 'ltx25-ia2v', displayName: 'LTX 2.5 Image+Audio' },
    { key: 'ltx25-a2v', displayName: 'LTX 2.5 Audio Only' },
    { key: 'ltx23-ia2v', displayName: 'LTX 2.3 Image+Audio' },
    { key: 'ltx23-a2v', displayName: 'LTX 2.3 Audio Only' },
    { key: 'wan3.0-video', displayName: 'Wan 3 Image/Audio' },
    { key: 'wan3.0-spicy-video', displayName: 'Wan 3.0 Enhanced Image/Audio' },
  ],
  video_to_video: [
    { key: 'ltx25-v2v', displayName: 'LTX 2.5 V2V Control' },
    { key: 'ltx23-v2v', displayName: 'LTX 2.3 V2V Control' },
    { key: 'wan22-animate', displayName: 'WAN 2.2 Animate' },
    { key: 'seedance2', displayName: 'Seedance 2.0' },
    { key: 'seedance2-mini', displayName: 'Seedance 2.0 Mini' },
    { key: 'seedance2-5', displayName: 'Seedance 2.5' },
  ],
  generate_music: [
    { key: 'turbo', displayName: 'ACE-Step 1.5 Turbo' },
    { key: 'sft', displayName: 'ACE-Step 1.5 SFT' },
    { key: 'music3', displayName: 'MiniMax Music 3' },
  ],
  // Three Qwen3-TTS checkpoints, picked by what the caller can supply rather
  // than by quality tier: a preset voice, a recording to clone, or a written
  // description of a speaker to invent.
  generate_speech: [
    { key: 'voice', displayName: 'Qwen3-TTS Studio Voices' },
    { key: 'clone', displayName: 'Qwen3-TTS Voice Clone' },
    { key: 'design', displayName: 'Qwen3-TTS Voice Design' },
  ],
};

/** Tools that select models via a "quality" arg instead of "model"/"videoModel". */
const QUALITY_ARG_TOOLS = [
  'restore_photo',
  'apply_style',
  'refine_result',
  'change_angle',
];

const VIDEO_MODEL_ARG_TOOLS = ['generate_video', 'animate_photo', 'sound_to_video', 'video_to_video'];

/**
 * Get the model arg key name used by a given tool.
 * - Video tools use "videoModel"
 * - Quality-tier tools use "quality"
 * - All others use "model"
 */
export function getModelArgKey(toolName: string): string {
  if (QUALITY_ARG_TOOLS.includes(toolName)) return 'quality';
  return VIDEO_MODEL_ARG_TOOLS.includes(toolName) ? 'videoModel' : 'model';
}

/** Check if a tool uses quality-tier model selection. */
export function isQualityTierTool(toolName: string): boolean {
  return QUALITY_ARG_TOOLS.includes(toolName);
}

/** Get all available models for a tool. Returns empty array if tool has no model options. */
export function getModelOptions(toolName: string): ModelOption[] {
  return MODELS_BY_TOOL[toolName] ?? [];
}

/** Get alternative models (excludes the currently used model). */
export function getAlternativeModels(
  toolName: string,
  currentModelKey?: string,
): ModelOption[] {
  const all = getModelOptions(toolName);
  if (!currentModelKey) return all;
  return all.filter((m) => m.key !== currentModelKey);
}
