/**
 * Speech synthesis contract shared across every Sogni speech surface
 * (Qwen3-TTS 1.7B modes and Fish Drama 3).
 *
 * Speech and music share the `audio` media type and nothing else. A music model
 * composes for a requested duration with a diffusion sampler; a speech model
 * reads a script for however long the words take and has no duration, no step
 * count, no tempo and no sampler. Anything from `musicSettings` is therefore
 * deliberately absent here rather than reused with a different meaning.
 *
 * Each mode maps to its own checkpoint with distinct accepted and required inputs.
 */

/** Which speech checkpoint to use, chosen by what the caller can supply. */
export type SpeechMode = 'voice' | 'clone' | 'design' | 'drama3';

export enum SpeechModel {
  /** Nine studio voices, optionally restyled by a written direction. */
  voice = 'qwen3_tts_1.7b_custom_voice_bf16',
  /** A voice cloned from three to thirty seconds of reference speech. */
  clone = 'qwen3_tts_1.7b_voice_clone_bf16',
  /** A voice invented from a written description, with no recording. */
  design = 'qwen3_tts_1.7b_voice_design_bf16',
  /** Fish Drama 3 expressive acting speech with inline [direction] tags and optional cloning. */
  drama3 = 'fish_drama_3_nvfp4',
}

export const SPEECH_MODEL_IDS: readonly string[] = [
  SpeechModel.voice,
  SpeechModel.clone,
  SpeechModel.design,
  SpeechModel.drama3,
];

/**
 * The nine CustomVoice timbres, in the order the checkpoint declares them.
 *
 * Every one of them speaks all supported languages; the nationality below
 * describes the accent it carries, not the language it is limited to.
 */
export const SPEECH_VOICES = [
  { id: 'serena', label: 'Serena', gender: 'female', accent: 'English' },
  { id: 'vivian', label: 'Vivian', gender: 'female', accent: 'Chinese' },
  { id: 'uncle_fu', label: 'Uncle Fu', gender: 'male', accent: 'Chinese' },
  { id: 'ryan', label: 'Ryan', gender: 'male', accent: 'English' },
  { id: 'aiden', label: 'Aiden', gender: 'male', accent: 'English' },
  { id: 'ono_anna', label: 'Ono Anna', gender: 'female', accent: 'Japanese' },
  { id: 'sohee', label: 'Sohee', gender: 'female', accent: 'Korean' },
  { id: 'eric', label: 'Eric', gender: 'male', accent: 'English' },
  { id: 'dylan', label: 'Dylan', gender: 'male', accent: 'English' },
] as const;

export type SpeechVoice = (typeof SPEECH_VOICES)[number]['id'];

export const DEFAULT_SPEECH_VOICE: SpeechVoice = 'serena';

/**
 * The eleven spoken languages supported across speech synthesis, plus `auto`.
 *
 * `auto` is the default on purpose: it infers the language from the script and
 * is the only setting that reads a code-switched line correctly. Pin a language
 * only when auto mis-reads a name or a loanword.
 */
export const SPEECH_LANGUAGES = [
  'auto',
  'english',
  'chinese',
  'japanese',
  'korean',
  'german',
  'french',
  'russian',
  'portuguese',
  'spanish',
  'italian',
  'arabic',
] as const;

export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number];

export const DEFAULT_SPEECH_LANGUAGE: SpeechLanguage = 'auto';

export const SPEECH_LANGUAGE_LABELS: Record<SpeechLanguage, string> = {
  auto: 'Auto-detect',
  english: 'English',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  german: 'German',
  french: 'French',
  russian: 'Russian',
  portuguese: 'Portuguese',
  spanish: 'Spanish',
  italian: 'Italian',
  arabic: 'Arabic',
};

export const SPEECH_LANGUAGE_OPTIONS = SPEECH_LANGUAGES.map((code) => ({
  value: code,
  label: SPEECH_LANGUAGE_LABELS[code],
}));

/** Qwen3-TTS delivery variation (`voice`, `clone`, `design`). Lower is steadier, higher more expressive. */
export const SPEECH_CREATIVITY = { min: 0.1, max: 2, default: 0.9 };

/** The script itself. sogni-socket refuses a longer one rather than truncating it. */
export const SPEECH_MAX_SCRIPT_CHARS = 4096;

/** A written direction for the delivery, or for the voice to invent. */
export const SPEECH_MAX_INSTRUCT_CHARS = 512;

/** The transcript of the reference recording on Qwen3-TTS Voice Clone. */
export const SPEECH_MAX_REFERENCE_TEXT_CHARS = 1024;

/** The transcript of the reference recording on Fish Drama 3. */
export const DRAMA3_MAX_REFERENCE_TEXT_CHARS = 2000;

/**
 * Reference recording bounds for Qwen3-TTS Voice Clone. Three seconds is the published
 * minimum for a usable clone; past thirty the worker trims, because the tail of
 * a long clip is prompt cost rather than identity.
 */
export const SPEECH_REFERENCE_SECONDS = { min: 3, max: 30 };

/** Reference recording bounds for optional Fish Drama 3 zero-shot voice cloning. */
export const DRAMA3_REFERENCE_SECONDS = { min: 1, max: 30 };

export const SPEECH_OUTPUT_SAMPLE_RATE = 24000;

export const DRAMA3_OUTPUT_SAMPLE_RATE = 44100;

export const DRAMA3_DIRECTION_TAG_EXAMPLES = [
  '[sighs]',
  '[laughs]',
  '[warmly]',
  '[gasps]',
  '<whisper>...</whisper>',
] as const;

/** Minimum billed script length in characters across all speech synthesis models. */
export const SPEECH_MINIMUM_BILLED_CHARS = 170;

export interface SpeechModelCapabilities {
  /** Whether the mode picks from SPEECH_VOICES. */
  voices: boolean;
  /** Whether the mode accepts a written direction, and whether it needs one. */
  instruct: 'unsupported' | 'optional' | 'required';
  /** Whether the mode takes a reference recording, and whether it needs one. */
  referenceAudio: 'unsupported' | 'optional' | 'required';
  /** Whether the mode uses the reference recording's transcript. */
  referenceText: boolean;
  /** Whether the mode exposes adjustable delivery creativity. */
  creativity?: boolean;
  /** Whether inline [direction] / <whisper> tags in the script are acted out. */
  inlineDirections?: boolean;
  /** Maximum characters for referenceText when referenceText is supported. */
  maxReferenceTextChars?: number;
  /** Accepted reference recording duration bounds in seconds. */
  referenceSeconds?: { min: number; max: number };
  /** Billing basis used by Sogni Socket. */
  pricingBasis: 'characters';
  /** Minimum character floor billed per take. */
  minimumBilledCharacters: number;
}

export const SPEECH_MODELS: Record<SpeechMode, SpeechModelCapabilities> = {
  voice: {
    voices: true,
    instruct: 'optional',
    referenceAudio: 'unsupported',
    referenceText: false,
    creativity: true,
    inlineDirections: false,
    pricingBasis: 'characters',
    minimumBilledCharacters: SPEECH_MINIMUM_BILLED_CHARS,
  },
  clone: {
    voices: false,
    instruct: 'unsupported',
    referenceAudio: 'required',
    referenceText: true,
    creativity: true,
    inlineDirections: false,
    maxReferenceTextChars: SPEECH_MAX_REFERENCE_TEXT_CHARS,
    referenceSeconds: SPEECH_REFERENCE_SECONDS,
    pricingBasis: 'characters',
    minimumBilledCharacters: SPEECH_MINIMUM_BILLED_CHARS,
  },
  design: {
    voices: false,
    instruct: 'required',
    referenceAudio: 'unsupported',
    referenceText: false,
    creativity: true,
    inlineDirections: false,
    pricingBasis: 'characters',
    minimumBilledCharacters: SPEECH_MINIMUM_BILLED_CHARS,
  },
  drama3: {
    voices: false,
    instruct: 'unsupported',
    referenceAudio: 'optional',
    referenceText: true,
    creativity: false,
    inlineDirections: true,
    maxReferenceTextChars: DRAMA3_MAX_REFERENCE_TEXT_CHARS,
    referenceSeconds: DRAMA3_REFERENCE_SECONDS,
    pricingBasis: 'characters',
    minimumBilledCharacters: SPEECH_MINIMUM_BILLED_CHARS,
  },
};

export const SPEECH_MODE_OPTIONS: Array<{ value: SpeechMode; label: string; description: string }> = [
  {
    value: 'voice',
    label: 'Studio voice',
    description: 'Pick one of nine voices and, optionally, describe how it should read the line.',
  },
  {
    value: 'clone',
    label: 'Clone a voice',
    description: 'Upload three to thirty seconds of someone speaking and have them read your script.',
  },
  {
    value: 'design',
    label: 'Design a voice',
    description: 'Describe a speaker who does not exist and let the model invent them.',
  },
  {
    value: 'drama3',
    label: 'Fish Drama 3',
    description: 'Expressive acting voice with inline [direction] tags and optional voice cloning.',
  },
];

export const DEFAULT_SPEECH_MODE: SpeechMode = 'voice';

export const SPEECH_LABELS = {
  processing: 'Speaking...',
  idle: 'Speak',
};

export function getSpeechModel(mode: SpeechMode): string {
  return SpeechModel[mode];
}

export function getSpeechMode(modelId: string): SpeechMode | undefined {
  return (Object.keys(SPEECH_MODELS) as SpeechMode[]).find(
    (mode) => SpeechModel[mode] === modelId,
  );
}

export function isSpeechModel(modelId: string): boolean {
  return SPEECH_MODEL_IDS.includes(modelId);
}

export interface SpeechRequest {
  mode: SpeechMode;
  /** The words to speak. Punctuation is prosody, so keep the sentence marks in. */
  script: string;
  language?: SpeechLanguage;
  voice?: SpeechVoice;
  instruct?: string;
  referenceText?: string;
  hasReferenceAudio?: boolean;
  creativity?: number;
}

/**
 * Explain why a speech request cannot be rendered, or return null.
 *
 * sogni-socket enforces every one of these server-side; this exists so a caller
 * can say what is wrong before spending a round trip, in the same words.
 */
export function validateSpeechRequest(request: SpeechRequest): string | null {
  const capabilities = SPEECH_MODELS[request.mode];
  if (!capabilities) return `Unknown speech mode: ${request.mode}`;

  const script = request.script?.trim() ?? '';
  if (!script) return 'Speech generation needs the words to speak';
  if (script.length > SPEECH_MAX_SCRIPT_CHARS) {
    return `Speech scripts are limited to ${SPEECH_MAX_SCRIPT_CHARS} characters; this one is ${script.length}`;
  }

  const instruct = request.instruct?.trim() ?? '';
  if (instruct && capabilities.instruct === 'unsupported') {
    return 'This speech mode takes no style direction';
  }
  if (!instruct && capabilities.instruct === 'required') {
    return 'Designing a voice needs a description of the speaker';
  }
  if (instruct.length > SPEECH_MAX_INSTRUCT_CHARS) {
    return `The voice direction is limited to ${SPEECH_MAX_INSTRUCT_CHARS} characters; this one is ${instruct.length}`;
  }

  if (request.voice && !capabilities.voices) {
    return 'This speech mode does not use preset voices';
  }
  if (request.voice && !SPEECH_VOICES.some((voice) => voice.id === request.voice)) {
    return `Unknown voice: ${request.voice}`;
  }

  if (capabilities.referenceAudio === 'required' && !request.hasReferenceAudio) {
    return 'Cloning a voice needs a reference recording of it';
  }
  if (capabilities.referenceAudio === 'unsupported' && request.hasReferenceAudio) {
    return 'This speech mode takes no reference recording';
  }

  const referenceText = request.referenceText?.trim() ?? '';
  if (referenceText && !capabilities.referenceText) {
    return 'This speech mode has nothing to transcribe';
  }
  if (referenceText && !request.hasReferenceAudio) {
    return 'A reference transcript requires a reference recording';
  }
  const maxReferenceTextChars =
    capabilities.maxReferenceTextChars ?? SPEECH_MAX_REFERENCE_TEXT_CHARS;
  if (referenceText.length > maxReferenceTextChars) {
    return `The reference transcript is limited to ${maxReferenceTextChars} characters; this one is ${referenceText.length}`;
  }

  if (request.creativity !== undefined && capabilities.creativity !== false) {
    if (
      !Number.isFinite(request.creativity) ||
      request.creativity < SPEECH_CREATIVITY.min ||
      request.creativity > SPEECH_CREATIVITY.max
    ) {
      return `Speech creativity must be between ${SPEECH_CREATIVITY.min} and ${SPEECH_CREATIVITY.max}`;
    }
  }

  if (request.language && !SPEECH_LANGUAGES.includes(request.language)) {
    return `Unsupported language: ${request.language}`;
  }
  if (request.language === 'arabic' && request.mode !== 'drama3') {
    return 'Arabic speech synthesis requires Fish Drama 3 (model="drama3").';
  }

  return null;
}
