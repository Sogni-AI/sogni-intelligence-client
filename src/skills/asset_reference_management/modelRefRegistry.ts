/**
 * Per-model formatting of `model_ref` tokens.
 *
 * Each model expects a different literal in its prompt to refer to an
 * input asset. The registry keeps these formats in one place so adapter
 * code, manifest helpers, and prompt validators can agree on the
 * canonical form.
 *
 * Adding a new model: add an entry to `MODEL_REF_FORMATS` with both a
 * `format(index, type)` builder and a `parse(token)` matcher. The two
 * must round-trip — `parse(format(i, t)) === { index: i, type: t? }`.
 * A parser may also accept natural-language aliases that the model can
 * understand, but `format()` remains the canonical emitted form.
 */

import type { AssetType, KnownAssetModelId } from './types.js';
import { isSeedanceVideoModelId } from '../../utils/seedanceModelIds.js';
import { resolveRegisteredVideoModelFamily } from '../../utils/videoModelIds.js';
import { resolveRegisteredImageReferenceModelId } from '../../utils/imageReferenceModelIds.js';

export interface ParsedModelRef {
  /** 1-indexed unless the format is explicitly 0-indexed. */
  index: number;
  /** Asset type, when the format encodes it (Seedance "@Video1" / "@Image1"). */
  type?: AssetType;
}

export interface ModelRefFormat {
  format(index: number, type: AssetType): string;
  parse(token: string): ParsedModelRef | null;
  /** Regex matching reference-like tokens this format owns for validation. */
  scanRegex: RegExp;
}

export interface ModelRefFormatResolution {
  format: ModelRefFormat;
  model_id: KnownAssetModelId | 'unknown';
  fell_back: boolean;
}

const SEEDANCE_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `@Video${index}`;
    if (type === 'audio') return `@Audio${index}`;
    return `@Image${index}`;
  },
  parse(token) {
    const m = /^@(Image|Video|Audio)(\d+)$/.exec(token.trim());
    if (!m) return null;
    const idx = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(idx) || idx < 1) return null;
    const t: AssetType = m[1] === 'Video' ? 'video' : m[1] === 'Audio' ? 'audio' : 'image';
    return { index: idx, type: t };
  },
  scanRegex: /@(?:Image|Video|Audio)\d+/g,
};

/**
 * HappyHorse (r2v reference-to-video) tags reference images in the prompt
 * as bracketed ordinals — `[Image 1]`, `[Image 2]`, … `[Image 9]`. The
 * brackets are part of the canonical literal, distinguishing it from the
 * GPT-Image-2 bare `Image 1` form. HappyHorse references are image-only,
 * but the format keeps video/audio parity for shape consistency.
 */
const HAPPYHORSE_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `[Video ${index}]`;
    if (type === 'audio') return `[Audio ${index}]`;
    return `[Image ${index}]`;
  },
  parse(token) {
    const m = /^\[(Image|Video|Audio)\s+(\d+)\]$/.exec(token.trim());
    if (!m) return null;
    const kind = m[1]!;
    const idx = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(idx) || idx < 1) return null;
    const t: AssetType = kind === 'Video' ? 'video' : kind === 'Audio' ? 'audio' : 'image';
    return { index: idx, type: t };
  },
  scanRegex: /\[(?:Image|Video|Audio)\s+\d+\]/g,
};

/**
 * Wan 3 follows Alibaba's English multimodal reference identifiers: `Image 1`,
 * `Video 1`, and `Audio 1`, numbered independently by media type.
 */
const WAN3_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `Video ${index}`;
    if (type === 'audio') return `Audio ${index}`;
    return `Image ${index}`;
  },
  parse(token) {
    const m = /^(Image|Video|Audio)\s+(\d+)$/.exec(token.trim());
    if (!m) return null;
    const kind = m[1]!;
    const idx = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(idx) || idx < 1) return null;
    const t: AssetType = kind === 'Video' ? 'video' : kind === 'Audio' ? 'audio' : 'image';
    return { index: idx, type: t };
  },
  scanRegex: /\b(?:Image|Video|Audio)\s+\d+\b/g,
};

const GPT_IMAGE_2_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `Video ${index}`;
    if (type === 'audio') return `Audio ${index}`;
    return `Image ${index}`;
  },
  parse(token) {
    const m = /^(Image|Video|Audio)\s+(\d+)$/.exec(token.trim());
    if (!m) return null;
    const kind = m[1]!;
    const idx = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(idx) || idx < 1) return null;
    const t: AssetType = kind === 'Video' ? 'video' : kind === 'Audio' ? 'audio' : 'image';
    return { index: idx, type: t };
  },
  scanRegex: /(?<!@)(?<!\b[Gg][Pp][Tt]\s)(?:\[(?:Image|Video|Audio)\s+\d+\]|\b(?:Image|Video|Audio)\s+\d+\b)/g,
};

/**
 * Context-conditioned models (LTX-2.3, some Wan variants, qwen-image-edit)
 * use 0-indexed positional `context_image_N` / `context_video_N` slots.
 */
const CONTEXT_FORMAT: ModelRefFormat = {
  format(index, type) {
    const slot = Math.max(0, index - 1);
    if (type === 'video') return `context_video_${slot}`;
    if (type === 'audio') return `context_audio_${slot}`;
    return `context_image_${slot}`;
  },
  parse(token) {
    const m = /^context_(image|video|audio)_(\d+)$/.exec(token.trim());
    if (!m) return null;
    const slot = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(slot) || slot < 0) return null;
    return {
      index: slot + 1,
      type: m[1] as AssetType,
    };
  },
  scanRegex: /context_(?:image|video|audio)_\d+/g,
};

/**
 * MiniMax H3 Ref2VA labels references with the literal tags its text encoder
 * splices in front of the prompt — `<Picture 1>`, `<Video 1>`, `<Audio 1>` —
 * 1-based per type, angle brackets included. Writing the same tags in the
 * prompt shares a token sequence with the encoder's own reference labels,
 * which is why prose aliases ("the second photo") underperform. Note the
 * image label is Picture, not Image, and a reference video's own soundtrack
 * consumes the next Audio ordinal before standalone audio clips.
 */
const MINIMAX_H3_FORMAT: ModelRefFormat = {
  format(index, type) {
    if (type === 'video') return `<Video ${index}>`;
    if (type === 'audio') return `<Audio ${index}>`;
    return `<Picture ${index}>`;
  },
  parse(token) {
    const m = /^<(Picture|Video|Audio)\s+(\d+)>$/.exec(token.trim());
    if (!m) return null;
    const kind = m[1]!;
    const idx = Number.parseInt(m[2]!, 10);
    if (!Number.isFinite(idx) || idx < 1) return null;
    const t: AssetType = kind === 'Video' ? 'video' : kind === 'Audio' ? 'audio' : 'image';
    return { index: idx, type: t };
  },
  scanRegex: /<(?:Picture|Video|Audio)\s+\d+>/g,
};

/**
 * FLUX 3 Image Klein refers to references by order in plain English — "the
 * first image", "the second image" — as Black Forest Labs' prompt upsampler
 * and example edit captions do. Klein takes images only on Sogni (1-10).
 */
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const FLUX3_KLEIN_FORMAT: ModelRefFormat = {
  format(index, type) {
    return `the ${ORDINALS[index - 1]!} ${type}`;
  },
  parse(token) {
    const m = /^(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(image|video|audio)$/i.exec(token.trim());
    if (!m) return null;
    return { index: ORDINALS.indexOf(m[1]!.toLowerCase()) + 1, type: m[2]!.toLowerCase() as AssetType };
  },
  scanRegex: /\bthe\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:image|video|audio)\b/gi,
};

const MODEL_REF_FORMATS: Record<KnownAssetModelId, ModelRefFormat> = {
  seedance: SEEDANCE_FORMAT,
  happyhorse: HAPPYHORSE_FORMAT,
  wan3: WAN3_FORMAT,
  'gpt-image-2': GPT_IMAGE_2_FORMAT,
  ltx23: CONTEXT_FORMAT,
  ltx25: CONTEXT_FORMAT,
  wan: CONTEXT_FORMAT,
  'qwen-image-edit': CONTEXT_FORMAT,
  'krea-identity-edit': CONTEXT_FORMAT,
  'flux3-klein': FLUX3_KLEIN_FORMAT,
  flux: GPT_IMAGE_2_FORMAT,
  'minimax-h3': MINIMAX_H3_FORMAT,
};

function cloneGlobalRegex(regex: RegExp): RegExp {
  return new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
}

function normalizeModelRefId(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/[_.\s]+/g, '-').replace(/-+/g, '-');
}

function resolveContextModelRefId(modelId: string): KnownAssetModelId | null {
  const videoFamily = resolveRegisteredVideoModelFamily(modelId);
  if (videoFamily === 'wan22') return 'wan';
  if (videoFamily === 'ltx25') return 'ltx25';
  if (videoFamily === 'ltx23' || videoFamily === 'ltx2') return 'ltx23';
  const imageReferenceModelId = resolveRegisteredImageReferenceModelId(modelId);
  if (imageReferenceModelId === 'qwen-image-edit') return 'qwen-image-edit';
  if (imageReferenceModelId === 'krea-identity-edit') return 'krea-identity-edit';
  return null;
}

/**
 * Resolve the format for a `model_id`. Unknown ids fall back to the
 * GPT-Image-2 `Image N` shape, which is the most readable default.
 */
export function getModelRefFormat(modelId: string): ModelRefFormat {
  return getModelRefFormatResolution(modelId).format;
}

export function getModelRefFormatResolution(modelId: string): ModelRefFormatResolution {
  const trimmed = normalizeModelRefId(modelId);
  if (trimmed in MODEL_REF_FORMATS) {
    return {
      format: MODEL_REF_FORMATS[trimmed as KnownAssetModelId],
      model_id: trimmed as KnownAssetModelId,
      fell_back: false,
    };
  }
  if (isSeedanceVideoModelId(trimmed)) {
    return { format: SEEDANCE_FORMAT, model_id: 'seedance', fell_back: false };
  }
  const videoFamily = resolveRegisteredVideoModelFamily(trimmed);
  if (videoFamily === 'happyhorse-1.1') {
    return { format: HAPPYHORSE_FORMAT, model_id: 'happyhorse', fell_back: false };
  }
  if (videoFamily === 'wan3') {
    return { format: WAN3_FORMAT, model_id: 'wan3', fell_back: false };
  }
  if (videoFamily === 'minimax-h3') {
    return { format: MINIMAX_H3_FORMAT, model_id: 'minimax-h3', fell_back: false };
  }
  const imageReferenceModelId = resolveRegisteredImageReferenceModelId(trimmed);
  if (imageReferenceModelId === 'flux3-klein') {
    return { format: FLUX3_KLEIN_FORMAT, model_id: 'flux3-klein', fell_back: false };
  }
  if (imageReferenceModelId === 'gpt-image-2' || imageReferenceModelId === 'flux') {
    return {
      format: GPT_IMAGE_2_FORMAT,
      model_id: imageReferenceModelId,
      fell_back: false,
    };
  }
  const contextModelRefId = resolveContextModelRefId(trimmed);
  if (contextModelRefId) {
    return {
      format: CONTEXT_FORMAT,
      model_id: contextModelRefId,
      fell_back: false,
    };
  }
  console.warn(`[ASSET REF] Unknown model_id "${modelId}" fell back to GPT Image 2 model_ref format.`);
  return {
    format: GPT_IMAGE_2_FORMAT,
    model_id: 'unknown',
    fell_back: true,
  };
}

export function getModelRefFormatEntries(): ReadonlyArray<{
  model_id: KnownAssetModelId;
  format: ModelRefFormat;
}> {
  return (Object.entries(MODEL_REF_FORMATS) as Array<[KnownAssetModelId, ModelRefFormat]>)
    .map(([model_id, format]) => ({
      model_id,
      format: {
        ...format,
        scanRegex: cloneGlobalRegex(format.scanRegex),
      },
    }));
}

export function formatModelRef(modelId: string, index: number, type: AssetType): string {
  return getModelRefFormat(modelId).format(index, type);
}

export function listKnownAssetModelIds(): KnownAssetModelId[] {
  return Object.keys(MODEL_REF_FORMATS) as KnownAssetModelId[];
}
