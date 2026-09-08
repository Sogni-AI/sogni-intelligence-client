/**
 * Qwen3-TTS speech synthesis: the shared contract every Sogni speech surface
 * reads from.
 *
 * Speech and music share the `audio` media type and nothing else. A music model
 * composes for a requested duration with a diffusion sampler; a speech model
 * reads a script for however long the words take and has no duration, no step
 * count, no tempo and no sampler. Anything from `musicSettings` is therefore
 * deliberately absent here rather than reused with a different meaning.
 *
 * The three modes are three different checkpoints, not three presets of one, so
 * each carries its own required and forbidden inputs.
 */

/** Which speech checkpoint to use, chosen by what the caller can supply. */
export type SpeechMode = 'voice' | 'clone' | 'design';

export enum SpeechModel {
  /** Nine studio voices, optionally restyled by a written direction. */
  voice = 'qwen3_tts_1.7b_custom_voice_bf16',
  /** A voice cloned from three to thirty seconds of reference speech. */
  clone = 'qwen3_tts_1.7b_voice_clone_bf16',
  /** A voice invented from a written description, with no recording. */
  design = 'qwen3_tts_1.7b_voice_design_bf16',
}

export const SPEECH_MODEL_IDS: readonly string[] = [
  SpeechModel.voice,
  SpeechModel.clone,
  SpeechModel.design,
];

/**
 * The nine CustomVoice timbres, in the order the checkpoint declares them.
 *
 * Every one of them speaks all ten supported languages; the nationality below
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
 * The ten languages the checkpoints carry, plus `auto`.
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
};

export const SPEECH_LANGUAGE_OPTIONS = SPEECH_LANGUAGES.map((code) => ({
  value: code,
  label: SPEECH_LANGUAGE_LABELS[code],
}));

/** Sampling temperature. Lower is steadier and flatter, higher more expressive. */
export const SPEECH_CREATIVITY = { min: 0.1, max: 2, default: 0.9 };

/** The script itself. sogni-socket refuses a longer one rather than truncating it. */
export const SPEECH_MAX_SCRIPT_CHARS = 4096;

/** A written direction for the delivery, or for the voice to invent. */
export const SPEECH_MAX_INSTRUCT_CHARS = 512;

/** The transcript of the reference recording, for in-context cloning. */
export const SPEECH_MAX_REFERENCE_TEXT_CHARS = 1024;

/**
 * Reference recording bounds for cloning. Three seconds is the published
 * minimum for a usable clone; past thirty the worker trims, because the tail of
 * a long clip is prompt cost rather than identity.
 */
export const SPEECH_REFERENCE_SECONDS = { min: 3, max: 30 };

export const SPEECH_OUTPUT_SAMPLE_RATE = 24000;

export interface SpeechModelCapabilities {
  /** Whether the mode picks from SPEECH_VOICES. */
  voices: boolean;
  /** Whether the mode accepts a written direction, and whether it needs one. */
  instruct: 'unsupported' | 'optional' | 'required';
  /** Whether the mode takes a reference recording, and whether it needs one. */
  referenceAudio: 'unsupported' | 'required';
  /** Whether the mode uses the reference recording's transcript. */
  referenceText: boolean;
}

export const SPEECH_MODELS: Record<SpeechMode, SpeechModelCapabilities> = {
  voice: {
    voices: true,
    instruct: 'optional',
    referenceAudio: 'unsupported',
    referenceText: false,
  },
  clone: {
    voices: false,
    instruct: 'unsupported',
    referenceAudio: 'required',
    referenceText: true,
  },
  design: {
    voices: false,
    instruct: 'required',
    referenceAudio: 'unsupported',
    referenceText: false,
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
  if (referenceText.length > SPEECH_MAX_REFERENCE_TEXT_CHARS) {
    return `The reference transcript is limited to ${SPEECH_MAX_REFERENCE_TEXT_CHARS} characters; this one is ${referenceText.length}`;
  }

  if (request.language && !SPEECH_LANGUAGES.includes(request.language)) {
    return `Unsupported language: ${request.language}`;
  }

  return null;
}
