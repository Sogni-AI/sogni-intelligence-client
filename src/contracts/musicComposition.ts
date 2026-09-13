import type { SogniChatMessage } from '../runtime/chatTypes.js';
import type { ToolDefinition } from '../tools/definitions/types.js';
import {
  LANGUAGE_LABELS,
  MUSIC_BPM,
  MUSIC_DURATION,
  MUSIC_KEY_SCALES,
  MUSIC_TIME_SIGNATURES,
  type TimeSignature,
} from '../media/musicSettings.js';
import { getRandomLyricsTheme } from './randomThemes.js';
import { withAdultRequesterDirective } from './adultRequesterDirective.js';

export interface LyricsGenerationResult {
  lyrics: string;
  tempo: number | null;
  key: string | null;
  timeSignature: TimeSignature | null;
  duration: number | null;
  /** MiniMax Music 3 only: the structured three-section caption suggested by the composer. */
  caption: string | null;
}

/** Which music model the composition is being written for. */
export type MusicCompositionTarget = 'ace' | 'music3';

export interface MusicCompositionOptions {
  /** Target music model; defaults to the ACE-Step structured format. */
  model?: MusicCompositionTarget;
  /** Requested song length in seconds — Music 3 sizes the lyric sheet to fill it. */
  targetDurationSeconds?: number;
}

export const LYRICS_MAX_TOKENS = 2048;

const LYRICS_SYSTEM_PROMPT = `You are an expert songwriter. Generate song lyrics using the ACE-Step structured format and return them via the compose_lyrics tool.

Section headers — each section tag can optionally include a vocal/performance modifier after a hyphen, e.g. [Section - modifier]. Choose modifiers that fit the song's mood and vary them across sections.
Common structures: Verse, Chorus, Bridge, Intro, Outro, Instrumental, Interlude, Build, Drop, Breakdown — but you can use any descriptive section name like Guitar Solo, Piano Interlude, Fade Out, etc.
Modifiers are free-form — describe vocal delivery or performance feel in your own words. Not every section needs one. Examples for inspiration: raspy, breathy, falsetto, belting, spoken word, humming, anthemic, gentle, building, harmonies, a cappella
Keep modifiers to one or two words per tag.

Rules:
- Write natural, creative lyrics that match the requested style/mood
- Keep line lengths appropriate for singing (6-10 syllables per line for optimal rhythm)
- Use CAPS for intense/shouted lines: "WE ARE THE FIRE!"
- Use parentheses for background vocals: "We rise together (together)"
- The lyrics should be suitable for a song, not a poem

Suggest a duration that fits the lyrics naturally at the chosen tempo.`;

const INSTRUMENTAL_SYSTEM_PROMPT = `You are an expert music composer and arranger. Design an instrumental music structure using the ACE-Step structured format and return it via the compose_instrumental tool.

Output ONLY section tags in brackets — one per line, nothing else between them. The AI music model interprets any text outside brackets as lyrics to sing, so do NOT include descriptions, directions, or any other text between section tags.

Section tags — use tags like [Intro], [Main Theme], [Bridge], [Build], [Drop], [Breakdown], [Climax], [Outro], [Guitar Solo], [Piano Interlude], [Fade Out], etc.
Each tag can optionally include a performance modifier after a hyphen, e.g. [Section - modifier]. Choose modifiers that describe the instrumental feel.
Modifiers are free-form — describe the energy, dynamics, or featured instruments. Examples: building, ambient, driving, melodic, percussive, atmospheric, powerful, delicate, syncopated, distorted

Example output format:
[Intro - ambient pads]
[Main Theme - driving guitar]
[Bridge - stripped back piano]
[Build - percussive, rising]
[Drop - powerful, full band]
[Outro - fade out]

Rules:
- Output ONLY bracketed section tags, one per line — NO text between sections
- Use modifiers within the brackets to convey dynamics, instrumentation, and energy
- Structure the sections to create a natural musical arc
- Match the requested style/mood

Suggest a duration that fits the structure naturally at the chosen tempo.`;

const MUSIC3_LYRICS_SYSTEM_PROMPT = `You are an expert songwriter writing for MiniMax Music 3 and must return your work via the compose_lyrics tool.

MiniMax Music 3 reads two inputs: a structured CAPTION and a tagged LYRIC sheet. Tags are the structural instructions; the lyric text conveys the mood.

Lyric rules (official format):
- Structure the lyrics with plain section tags on their own lines, chosen from: [Intro], [Verse], [Pre-Chorus], [Chorus], [Post-Chorus], [Bridge], [Instrumental], [Solo], [Outro]
- Use ONLY plain tags — no modifiers, no hyphens, no performance notes inside the brackets. Delivery and vocal character belong in the caption's Vocal Details, not in the tags.
- Everything outside brackets is sung verbatim, so no stage directions or commentary in the lyric text.
- Keep line lengths singable (6-10 syllables works well) and write natural, creative lyrics that match the requested style and mood.
- CRITICAL: the composer ends the song when the lyric sheet runs out. Write enough sections to genuinely fill the requested duration — a three-minute song needs roughly two verses, three choruses, and a bridge. Never pad by repeating a chorus more than three times.

Caption rules — also fill the caption field with a three-section structured description; the more specific, the closer the result:
- Global Metadata: genre, BPM, key and scale, emotional progression across the song, listening scenario, production profile.
- Vocal Details: vocal gender, timbre, performance style, harmonies, vocal effects.
- Arrangement: primary and secondary instruments, groove, bass, percussion, textures, spatial effects, and how sections evolve.
Write it as one paragraph: "Global Metadata: ... Vocal Details: ... Arrangement: ..."

Also return bpm, keyscale, timesignature, and the duration your lyric sheet fills — bake the BPM and key into the caption text too, since Music 3 has no separate tempo or key controls.`;

const MUSIC3_INSTRUMENTAL_SYSTEM_PROMPT = `You are an expert composer and arranger writing for MiniMax Music 3 and must return your work via the compose_instrumental tool.

MiniMax Music 3 reads two inputs: a structured CAPTION and a structure sheet. For instrumentals the structure sheet must contain ONLY plain bracketed section tags, one per line, nothing else — any text outside brackets gets sung.

Structure rules (official format):
- Use ONLY these plain tags, one per line: [Intro], [Verse], [Chorus], [Pre-Chorus], [Post-Chorus], [Bridge], [Instrumental], [Solo], [Outro]
- No modifiers, hyphens, or descriptions inside the brackets, and no text between tags.
- CRITICAL: Music 3 resolves instrumental pieces early unless the structure demands length. For a three-minute piece output a full skeleton such as: [Intro] [Verse] [Chorus] [Verse] [Solo] [Chorus] [Bridge] [Chorus] [Outro] — each on its own line.

Caption rules — the caption carries everything the tags cannot; the more specific, the closer the result. Open with the duration ("A full three-minute ..."), then:
- Global Metadata: genre, BPM, key and scale, emotional progression, listening scenario, production profile — and spell out the section-by-section arc so the piece plays through its whole length instead of ending early.
- Vocal Details: "none, purely instrumental."
- Arrangement: primary and secondary instruments, groove, bass, percussion, textures, spatial effects.
Write it as one paragraph: "Global Metadata: ... Vocal Details: ... Arrangement: ..."

Also return bpm, keyscale, timesignature, and the duration the structure fills — bake the BPM and key into the caption text too.`;

export const LYRICS_COMPOSITION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'compose_lyrics',
    description: 'Output the composed song lyrics and musical parameters',
    parameters: {
      type: 'object',
      properties: {
        lyrics: {
          type: 'string',
          description:
            'Song lyrics with enriched section headers (e.g. [Verse 1 - soft vocal]). Use \\n for newlines.',
        },
        bpm: { type: 'number', description: 'Tempo in beats per minute, e.g. 120 for a pop song' },
        keyscale: {
          type: 'string',
          description: 'Musical key and scale, e.g. "D minor", "A major", "F# minor"',
        },
        timesignature: {
          type: 'string',
          enum: ['2/4', '3/4', '4/4', '6/8'],
          description: 'Time signature. Most songs use 4/4; waltzes use 3/4',
        },
        duration: {
          type: 'number',
          description: 'Estimated song duration in seconds that fits the lyrics at the chosen tempo',
        },
        caption: {
          type: 'string',
          description:
            'MiniMax Music 3 only: structured caption as one paragraph — "Global Metadata: ... Vocal Details: ... Arrangement: ...". Omit for ACE-Step.',
        },
      },
      required: ['lyrics', 'bpm', 'keyscale', 'timesignature', 'duration'],
    },
  },
};

export const INSTRUMENTAL_COMPOSITION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'compose_instrumental',
    description: 'Output the composed instrumental music structure and musical parameters',
    parameters: {
      type: 'object',
      properties: {
        structure: {
          type: 'string',
          description:
            'Instrumental structure as ONLY bracketed section tags, one per line, with NO text between them (e.g. [Intro - ambient pads]\\n[Main Theme - driving guitar]\\n[Bridge - stripped back]). Use \\n for newlines.',
        },
        bpm: {
          type: 'number',
          description: 'Tempo in beats per minute, e.g. 120 for an upbeat track',
        },
        keyscale: {
          type: 'string',
          description: 'Musical key and scale, e.g. "D minor", "A major", "F# minor"',
        },
        timesignature: {
          type: 'string',
          enum: ['2/4', '3/4', '4/4', '6/8'],
          description: 'Time signature. Most songs use 4/4; waltzes use 3/4',
        },
        duration: {
          type: 'number',
          description: 'Estimated track duration in seconds that fits the structure at the chosen tempo',
        },
        caption: {
          type: 'string',
          description:
            'MiniMax Music 3 only: structured caption as one paragraph opening with the duration — "Global Metadata: ... Vocal Details: none, purely instrumental. Arrangement: ...". Omit for ACE-Step.',
        },
      },
      required: ['structure', 'bpm', 'keyscale', 'timesignature', 'duration'],
    },
  },
};

export function buildLyricsMessages(
  prompt: string,
  language: string,
  musicPrompt: string,
  randomTheme?: string,
  options?: MusicCompositionOptions,
): SogniChatMessage[] {
  const music3 = options?.model === 'music3';
  const messages: SogniChatMessage[] = [
    { role: 'system', content: withAdultRequesterDirective(music3 ? MUSIC3_LYRICS_SYSTEM_PROMPT : LYRICS_SYSTEM_PROMPT) },
  ];
  let userMessage: string;
  if (prompt.trim()) {
    userMessage = prompt;
  } else {
    const theme = randomTheme || getRandomLyricsTheme();
    userMessage = `Come up with a unique, original song about: ${theme}. Be creative and surprising.`;
  }
  if (musicPrompt) {
    userMessage += `\n\nMusic style context: ${musicPrompt}`;
  }
  if (language && language !== 'unknown') {
    userMessage += `\n\nWrite the lyrics in: ${LANGUAGE_LABELS[language]}`;
  }
  if (music3 && options?.targetDurationSeconds) {
    userMessage += `\n\nTarget song length: about ${Math.round(options.targetDurationSeconds)} seconds — write enough sections to fill it.`;
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

export function buildInstrumentalMessages(
  prompt: string,
  musicPrompt: string,
  randomTheme?: string,
  options?: MusicCompositionOptions,
): SogniChatMessage[] {
  const music3 = options?.model === 'music3';
  const messages: SogniChatMessage[] = [
    { role: 'system', content: withAdultRequesterDirective(music3 ? MUSIC3_INSTRUMENTAL_SYSTEM_PROMPT : INSTRUMENTAL_SYSTEM_PROMPT) },
  ];
  let userMessage: string;
  if (prompt.trim()) {
    userMessage = prompt;
  } else {
    const theme = randomTheme || getRandomLyricsTheme();
    userMessage = `Come up with a unique, original instrumental piece inspired by: ${theme}. Be creative and surprising.`;
  }
  if (musicPrompt) {
    userMessage += `\n\nMusic style context: ${musicPrompt}`;
  }
  if (music3 && options?.targetDurationSeconds) {
    userMessage += `\n\nTarget track length: about ${Math.round(options.targetDurationSeconds)} seconds — output a structure skeleton and caption arc that fill it.`;
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

function parseTimeSignature(value: unknown): TimeSignature | null {
  const str = String(value ?? '');
  const map: Record<string, TimeSignature> = { '2/4': '2', '3/4': '3', '4/4': '4', '6/8': '6' };
  if (map[str]) return map[str];
  const signatures = Object.keys(MUSIC_TIME_SIGNATURES);
  if (signatures.includes(str)) return str as TimeSignature;
  return null;
}

function parseTempo(value: unknown): number | null {
  const num = Number(value);
  if (!isNaN(num) && num >= MUSIC_BPM.min && num <= MUSIC_BPM.max) return Math.round(num);
  return null;
}

function parseDuration(value: unknown): number | null {
  const num = Number(value);
  if (!isNaN(num) && num >= MUSIC_DURATION.min && num <= MUSIC_DURATION.max) return Math.round(num);
  return null;
}

function parseKeyScale(value: unknown): string | null {
  if (!value) return null;
  const str = String(value);
  const found = MUSIC_KEY_SCALES.find((k) => k.toLowerCase() === str.toLowerCase());
  return found || null;
}

export function parseToolCallResult(args: Record<string, unknown>): LyricsGenerationResult {
  const rawText = String(args.lyrics || args.structure || '');
  const lyrics = rawText.includes('\n') ? rawText : rawText.replace(/\\n/g, '\n');
  const caption = String(args.caption || '').trim();
  return {
    lyrics: lyrics.trim(),
    tempo: parseTempo(args.bpm),
    key: parseKeyScale(args.keyscale),
    timeSignature: parseTimeSignature(args.timesignature),
    duration: parseDuration(args.duration),
    caption: caption || null,
  };
}
