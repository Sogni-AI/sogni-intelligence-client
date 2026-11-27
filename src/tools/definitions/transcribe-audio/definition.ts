/**
 * Tool definition for transcribe_audio — Parakeet TDT v3 and NVIDIA Nemotron 3.5 Transcribe STT.
 */

import type { ToolDefinition } from '../types.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'transcribe_audio',
    description:
      'Transcribe spoken audio from an uploaded or previously generated audio or video clip into text, timed segments, speaker-diarized turns, or SRT/VTT subtitle text. Use when the user asks what is said in a recording/video, wants a verbatim transcript, needs speaker diarization (who spoke when), or asks for SRT/VTT captions without burning them onto video frames. Use "parakeet" (default) for fast 25-language European speech up to 2 hours, or "nemotron" for 40-language multilingual speech up to 1 hour, multi-speaker diarization (diarize=true), or custom vocabulary hints (hotwords).',
    parameters: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          enum: ['parakeet', 'nemotron'],
          default: 'parakeet',
          description:
            'Speech-to-text engine selector. "parakeet" (default): Parakeet TDT 0.6B v3 — fast 25-language European transcription up to 2 hours with sentence and word timestamps. "nemotron": NVIDIA Nemotron 3.5 Transcribe 30B — 40-language multilingual transcription up to 1 hour with speaker diarization (S01, S02, ...) and vocabulary hints (hotwords / prompt). When diarize=true or hotwords/prompt is supplied and model is omitted, executors may auto-select "nemotron".',
        },
        audioSourceIndex: {
          type: 'integer',
          description:
            'Which audio or video clip to transcribe: negative indices address uploads (-1 = first uploaded audio or video clip, -2 = second upload) and 0-based non-negative indices address audio generated earlier in this conversation. Defaults to -1 when omitted and no audio_source_url is provided.',
        },
        audio_source_url: {
          type: 'string',
          description:
            'REST alternative to audioSourceIndex: retrievable HTTPS URL or inline audio data URI to transcribe.',
        },
        timestamps: {
          type: 'string',
          enum: ['none', 'sentence', 'word'],
          default: 'sentence',
          description:
            'Timestamp granularity to include in the transcript: "sentence" (default segment timings), "word" (word-level start/end timings in addition to segments, ideal for tight subtitle pacing), or "none" (plain text only).',
        },
        diarize: {
          type: 'boolean',
          default: false,
          description:
            'Enable multi-speaker diarization labels (S01, S02, ...). Supported by model="nemotron"; when diarize=true and model is omitted, callers/executors may auto-select "nemotron".',
        },
        hotwords: {
          type: 'string',
          maxLength: 1000,
          description:
            'Comma-separated names, brand terms, acronyms, or domain vocabulary hints to bias recognition on model="nemotron" (up to 1000 characters).',
        },
        prompt: {
          type: 'string',
          maxLength: 2000,
          description:
            'Optional transcription context, topic summary, or language hint for model="nemotron" (up to 2000 characters).',
        },
        responseFormat: {
          type: 'string',
          enum: ['json', 'text', 'srt', 'vtt'],
          default: 'json',
          description:
            'Desired transcript output format: "json" (default structured transcript with segments, optional words, duration, and speaker labels), "text" (plain readable transcript), "srt" (SubRip subtitle file text), or "vtt" (WebVTT subtitle file text).',
        },
      },
      required: [],
    },
  },
};
