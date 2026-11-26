/**
 * Speech-to-text transcription contract shared across every Sogni transcription
 * surface (Parakeet TDT 0.6B v3 and NVIDIA Nemotron 3.5 Transcribe 30B).
 */

export type TranscriptionEngine = 'parakeet' | 'nemotron';

export enum TranscriptionModel {
  /** Fast 25-language European speech-to-text up to 2 hours with sentence and word timestamps. */
  parakeet = 'parakeet_tdt_0.6b_v3_bf16',
  /** 40-language NVIDIA Nemotron 3.5 30B transcription up to 1 hour with diarization and hotwords. */
  nemotron = 'nemotron_3.5_transcribe_30b_a4b_nvfp4',
}

export const TRANSCRIPTION_MODEL_IDS: readonly string[] = [
  TranscriptionModel.parakeet,
  TranscriptionModel.nemotron,
];

export const DEFAULT_TRANSCRIPTION_ENGINE: TranscriptionEngine = 'parakeet';

export const TRANSCRIPTION_TIMESTAMP_GRANULARITIES = ['none', 'sentence', 'word'] as const;

export type TranscriptionTimestampGranularity =
  (typeof TRANSCRIPTION_TIMESTAMP_GRANULARITIES)[number];

export const DEFAULT_TRANSCRIPTION_TIMESTAMP_GRANULARITY: TranscriptionTimestampGranularity =
  'sentence';

export const TRANSCRIPTION_OUTPUT_FORMATS = ['json', 'txt', 'srt', 'vtt'] as const;

export type TranscriptionOutputFormat = (typeof TRANSCRIPTION_OUTPUT_FORMATS)[number];

export const TRANSCRIPTION_MAX_HOTWORDS_CHARS = 1000;
export const TRANSCRIPTION_MAX_PROMPT_CHARS = 2000;

export interface TranscriptionModelCapabilities {
  id: TranscriptionModel;
  name: string;
  maxDurationSec: number;
  languageCount: number;
  languageCoverage: 'European' | 'Multilingual';
  timestamps: readonly TranscriptionTimestampGranularity[];
  diarization: boolean;
  hotwords: boolean;
  maxHotwordsChars?: number;
  promptHint: boolean;
  maxPromptChars?: number;
}

export const TRANSCRIPTION_MODELS: Record<TranscriptionEngine, TranscriptionModelCapabilities> = {
  parakeet: {
    id: TranscriptionModel.parakeet,
    name: 'Parakeet TDT 0.6B v3',
    maxDurationSec: 7200,
    languageCount: 25,
    languageCoverage: 'European',
    timestamps: TRANSCRIPTION_TIMESTAMP_GRANULARITIES,
    diarization: false,
    hotwords: false,
    promptHint: false,
  },
  nemotron: {
    id: TranscriptionModel.nemotron,
    name: 'NVIDIA Nemotron 3.5 Transcribe 30B',
    maxDurationSec: 3600,
    languageCount: 40,
    languageCoverage: 'Multilingual',
    timestamps: TRANSCRIPTION_TIMESTAMP_GRANULARITIES,
    diarization: true,
    hotwords: true,
    maxHotwordsChars: TRANSCRIPTION_MAX_HOTWORDS_CHARS,
    promptHint: true,
    maxPromptChars: TRANSCRIPTION_MAX_PROMPT_CHARS,
  },
};

export const TRANSCRIPTION_ENGINE_OPTIONS: Array<{
  value: TranscriptionEngine;
  label: string;
  description: string;
}> = [
  {
    value: 'parakeet',
    label: 'Parakeet TDT 0.6B v3',
    description: 'Fast 25-language European speech-to-text up to 2 hours with timestamps.',
  },
  {
    value: 'nemotron',
    label: 'NVIDIA Nemotron 3.5 Transcribe 30B',
    description:
      '40-language multilingual transcription up to 1 hour with speaker diarization and vocabulary hints.',
  },
];

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface TranscriptArtifact {
  version: number;
  model: string;
  text: string;
  rawText?: string;
  duration: number;
  language?: string;
  diarized: boolean;
  timestampGranularity: TranscriptionTimestampGranularity;
  segments: TranscriptSegment[];
  words?: TranscriptWord[];
  complete?: boolean;
  finishReason?: string;
}

export function getTranscriptionModel(engine: TranscriptionEngine): string {
  return TranscriptionModel[engine];
}

export function getTranscriptionEngine(modelId: string): TranscriptionEngine | undefined {
  return (Object.keys(TRANSCRIPTION_MODELS) as TranscriptionEngine[]).find(
    (engine) => TranscriptionModel[engine] === modelId,
  );
}

export function isTranscriptionModel(modelId: string): boolean {
  return TRANSCRIPTION_MODEL_IDS.includes(modelId);
}

/**
 * Resolve a short selector, canonical model ID, or OpenAI audio-transcription
 * model alias to a canonical `TranscriptionEngine` (`'parakeet'` or `'nemotron'`).
 */
export function resolveTranscriptionEngineSelector(
  input: string | null | undefined,
): TranscriptionEngine | undefined {
  if (typeof input !== 'string') return undefined;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return undefined;

  switch (normalized) {
    case 'parakeet':
    case 'parakeet-tdt':
    case 'parakeet-tdt-v3':
    case 'parakeet_tdt_0.6b_v3_bf16':
    case 'whisper-1':
    case 'gpt-4o-transcribe':
    case 'gpt-4o-mini-transcribe':
      return 'parakeet';
    case 'nemotron':
    case 'nemotron-transcribe':
    case 'nemotron-3.5-transcribe':
    case 'nemotron_3.5_transcribe_30b_a4b_nvfp4':
    case 'gpt-4o-transcribe-diarize':
      return 'nemotron';
    default:
      return undefined;
  }
}

export interface TranscriptionRequest {
  engine?: TranscriptionEngine | string;
  hasAudio: boolean;
  durationSec?: number;
  timestamps?: TranscriptionTimestampGranularity;
  diarize?: boolean;
  hotwords?: string;
  prompt?: string;
}

/**
 * Validate a transcription request against engine capabilities, returning a
 * human-readable error message or `null` when valid.
 */
export function validateTranscriptionRequest(request: TranscriptionRequest): string | null {
  if (!request.hasAudio) {
    return 'Transcription needs an audio or video recording';
  }

  let resolvedEngine: TranscriptionEngine;
  if (request.engine === undefined || request.engine === null || request.engine === '') {
    resolvedEngine =
      request.diarize || request.hotwords?.trim() || request.prompt?.trim()
        ? 'nemotron'
        : DEFAULT_TRANSCRIPTION_ENGINE;
  } else {
    const candidate = resolveTranscriptionEngineSelector(request.engine);
    if (!candidate) {
      return `Unknown transcription model: ${request.engine}`;
    }
    resolvedEngine = candidate;
  }

  const capabilities = TRANSCRIPTION_MODELS[resolvedEngine];

  if (request.durationSec !== undefined) {
    if (!Number.isFinite(request.durationSec) || request.durationSec <= 0) {
      return 'Audio duration must be greater than zero seconds';
    }
    if (request.durationSec > capabilities.maxDurationSec) {
      return `${capabilities.name} supports recordings up to ${capabilities.maxDurationSec} seconds; this one is ${Math.ceil(request.durationSec)} seconds`;
    }
  }

  if (
    request.timestamps !== undefined &&
    !TRANSCRIPTION_TIMESTAMP_GRANULARITIES.includes(request.timestamps)
  ) {
    return `Unsupported timestamp granularity: ${request.timestamps}`;
  }

  if (request.diarize && !capabilities.diarization) {
    return `${capabilities.name} does not support speaker diarization; use nemotron instead`;
  }

  const hotwords = request.hotwords?.trim() ?? '';
  if (hotwords) {
    if (!capabilities.hotwords) {
      return `${capabilities.name} does not support vocabulary hotwords; use nemotron instead`;
    }
    const maxHotwords = capabilities.maxHotwordsChars ?? TRANSCRIPTION_MAX_HOTWORDS_CHARS;
    if (hotwords.length > maxHotwords) {
      return `Vocabulary hotwords are limited to ${maxHotwords} characters; got ${hotwords.length}`;
    }
  }

  const prompt = request.prompt?.trim() ?? '';
  if (prompt) {
    if (!capabilities.promptHint) {
      return `${capabilities.name} does not accept a transcription prompt hint; use nemotron instead`;
    }
    const maxPrompt = capabilities.maxPromptChars ?? TRANSCRIPTION_MAX_PROMPT_CHARS;
    if (prompt.length > maxPrompt) {
      return `Transcription prompt hints are limited to ${maxPrompt} characters; got ${prompt.length}`;
    }
  }

  return null;
}

function asNonNegativeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeSpeakerLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalize an untrusted JSON payload from a worker or API response into a
 * well-formed `TranscriptArtifact`.
 */
export function normalizeTranscriptArtifact(raw: unknown): TranscriptArtifact {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const rawSegments = Array.isArray(obj.segments) ? obj.segments : [];
  const segments: TranscriptSegment[] = rawSegments
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry, idx) => {
      const start = asNonNegativeNumber(entry.start, 0);
      const end = Math.max(start, asNonNegativeNumber(entry.end, start));
      const speaker = normalizeSpeakerLabel(entry.speaker);
      return {
        id: typeof entry.id === 'number' && Number.isFinite(entry.id) ? Math.floor(entry.id) : idx,
        start,
        end,
        text: typeof entry.text === 'string' ? entry.text.trim() : '',
        ...(speaker ? { speaker } : {}),
      };
    })
    .filter((seg) => seg.text.length > 0);

  const rawWords = Array.isArray(obj.words) ? obj.words : undefined;
  const words: TranscriptWord[] | undefined = rawWords
    ? rawWords
        .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
        .map((entry) => {
          const start = asNonNegativeNumber(entry.start, 0);
          const end = Math.max(start, asNonNegativeNumber(entry.end, start));
          const speaker = normalizeSpeakerLabel(entry.speaker);
          const word =
            typeof entry.word === 'string'
              ? entry.word.trim()
              : typeof entry.text === 'string'
                ? entry.text.trim()
                : '';
          return {
            word,
            start,
            end,
            ...(speaker ? { speaker } : {}),
          };
        })
        .filter((w) => w.word.length > 0)
    : undefined;

  const text =
    typeof obj.text === 'string' && obj.text.trim().length > 0
      ? obj.text.trim()
      : segments.map((s) => (s.speaker ? `[${s.speaker}] ${s.text}` : s.text)).join(' ');

  const maxSegmentEnd = segments.reduce((acc, s) => Math.max(acc, s.end), 0);
  const duration = asNonNegativeNumber(obj.duration, maxSegmentEnd);
  const diarized =
    typeof obj.diarized === 'boolean'
      ? obj.diarized
      : segments.some((s) => Boolean(s.speaker));

  const granularityCandidate = obj.timestampGranularity;
  const timestampGranularity: TranscriptionTimestampGranularity =
    typeof granularityCandidate === 'string' &&
    TRANSCRIPTION_TIMESTAMP_GRANULARITIES.includes(
      granularityCandidate as TranscriptionTimestampGranularity,
    )
      ? (granularityCandidate as TranscriptionTimestampGranularity)
      : words && words.length > 0
        ? 'word'
        : segments.length > 0
          ? 'sentence'
          : 'none';

  return {
    version: typeof obj.version === 'number' && Number.isFinite(obj.version) ? obj.version : 1,
    model: typeof obj.model === 'string' && obj.model ? obj.model : TranscriptionModel.parakeet,
    text,
    ...(typeof obj.rawText === 'string' ? { rawText: obj.rawText } : {}),
    duration,
    ...(typeof obj.language === 'string' && obj.language ? { language: obj.language } : {}),
    diarized,
    timestampGranularity,
    segments,
    ...(words ? { words } : {}),
    ...(typeof obj.complete === 'boolean' ? { complete: obj.complete } : {}),
    ...(typeof obj.finishReason === 'string' ? { finishReason: obj.finishReason } : {}),
  };
}

export const parseWorkerTranscriptArtifact = normalizeTranscriptArtifact;

function formatClockTimestamp(seconds: number, separator: ',' | '.'): string {
  const clampedMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(clampedMs / 3_600_000);
  const minutes = Math.floor((clampedMs % 3_600_000) / 60_000);
  const secs = Math.floor((clampedMs % 60_000) / 1000);
  const millis = clampedMs % 1000;
  return (
    `${String(hours).padStart(2, '0')}:` +
    `${String(minutes).padStart(2, '0')}:` +
    `${String(secs).padStart(2, '0')}` +
    `${separator}${String(millis).padStart(3, '0')}`
  );
}

function formatCompactRange(start: number, end: number): string {
  const fmt = (sec: number) => {
    const totalMs = Math.max(0, Math.round(sec * 1000));
    const mins = Math.floor(totalMs / 60_000);
    const remSec = ((totalMs % 60_000) / 1000).toFixed(2);
    return `${String(mins).padStart(2, '0')}:${remSec.padStart(5, '0')}`;
  };
  return `[${fmt(start)} - ${fmt(end)}]`;
}

function effectiveSegments(artifact: TranscriptArtifact): TranscriptSegment[] {
  if (artifact.segments.length > 0) return artifact.segments;
  const trimmed = artifact.text.trim();
  if (!trimmed) return [];
  return [
    {
      id: 0,
      start: 0,
      end: Math.max(0.5, artifact.duration || 2),
      text: trimmed,
    },
  ];
}

export function formatTranscriptAsText(
  artifact: TranscriptArtifact,
  options: { includeSpeakers?: boolean; includeTimestamps?: boolean } = {},
): string {
  const includeSpeakers = options.includeSpeakers ?? artifact.diarized;
  const includeTimestamps = options.includeTimestamps ?? false;
  const segments = effectiveSegments(artifact);

  if (segments.length === 0) return '';
  if (!includeSpeakers && !includeTimestamps && artifact.rawText?.trim()) {
    return artifact.rawText.trim();
  }
  if (!includeSpeakers && !includeTimestamps && !artifact.diarized && artifact.text.trim()) {
    return artifact.text.trim();
  }

  return segments
    .map((seg) => {
      const parts: string[] = [];
      if (includeTimestamps) parts.push(formatCompactRange(seg.start, seg.end));
      if (includeSpeakers && seg.speaker) parts.push(`[${seg.speaker}]`);
      const cleanText =
        !includeSpeakers && seg.speaker && seg.text.startsWith(`[${seg.speaker}]`)
          ? seg.text.slice(seg.speaker.length + 2).trim()
          : seg.text;
      parts.push(cleanText);
      return parts.join(' ');
    })
    .join('\n');
}

export function formatTranscriptAsSrt(artifact: TranscriptArtifact): string {
  const segments = effectiveSegments(artifact);
  if (segments.length === 0) return '';

  return segments
    .map((seg, index) => {
      const start = formatClockTimestamp(seg.start, ',');
      const end = formatClockTimestamp(Math.max(seg.end, seg.start + 0.05), ',');
      const line =
        artifact.diarized && seg.speaker && !seg.text.startsWith(`[${seg.speaker}]`)
          ? `[${seg.speaker}] ${seg.text}`
          : seg.text;
      return `${index + 1}\n${start} --> ${end}\n${line}`;
    })
    .join('\n\n');
}

export function formatTranscriptAsVtt(artifact: TranscriptArtifact): string {
  const segments = effectiveSegments(artifact);
  if (segments.length === 0) return 'WEBVTT\n';

  const cues = segments.map((seg) => {
    const start = formatClockTimestamp(seg.start, '.');
    const end = formatClockTimestamp(Math.max(seg.end, seg.start + 0.05), '.');
    const line =
      artifact.diarized && seg.speaker && !seg.text.startsWith(`[${seg.speaker}]`)
        ? `<v ${seg.speaker}>${seg.text}`
        : seg.text;
    return `${start} --> ${end}\n${line}`;
  });

  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}
