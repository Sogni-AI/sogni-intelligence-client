/**
 * Tool definition for generate_speech — Qwen3-TTS and Fish Drama 3 text-to-speech.
 *
 * The failure mode this description exists to prevent: an agent used to image
 * prompts writing "a calm woman reading the news" into `prompt` and having those
 * seven words read aloud. The script is literal; delivery goes in voiceDescription
 * (for Qwen3-TTS voice/design) or inline acting tags (for Fish Drama 3).
 */

import type { ToolDefinition } from '../types.js';
import { LITERAL_PROMPT_OVERRIDE } from '../../../contracts/promptOverrideMarker.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'generate_speech',
    description:
      'Turn written words into spoken audio. Use when the user wants something read aloud, a narration, a voiceover, a line of dialogue, an audiobook passage, expressive acting speech with inline vocal cues, or a voice cloned from a recording they uploaded or from a saved persona\'s voice recording. This tool speaks text; it does not compose music — use generate_music for songs and instrumentals.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: `The exact words to be spoken, verbatim. This is NOT a description of the audio: whatever is written here is read aloud character for character. "a calm woman reading the news" would be spoken as those seven words — put that in voiceDescription instead and write the actual news copy here.

${LITERAL_PROMPT_OVERRIDE}

With model="drama3" (Fish Drama 3), inline acting and vocal direction tags may be placed directly in prompt — e.g. [sighs], [laughs], [warmly], [gasps], or <whisper>keep your voice down</whisper>. Do not put inline [direction] tags into Qwen3-TTS modes ("voice", "clone", "design"), which read bracketed words literally.

Punctuation is prosody: full stops, commas, question marks and ellipses control pauses and intonation, so keep them. Write numbers, dates, currency and abbreviations the way they should be said ("nineteen eighty-four", "twelve dollars fifty", "Doctor Chen") when the plain form would be ambiguous. Line breaks are not pauses; use punctuation.

If the user asks for a script rather than supplying one — "read me a poem about the sea", "record an intro for my podcast" — write the words first and pass them here. compose_script is for longer or structured pieces; a sentence or two you can simply write.

Limit up to 4096 characters for Qwen3-TTS modes ("voice", "clone", "design") and up to 5000 characters for Fish Drama 3 ("drama3"). A longer script is refused rather than cut off mid-sentence, so split it across several calls at a natural break.`,
          maxLength: 5000,
        },
        model: {
          type: 'string',
          enum: ['voice', 'clone', 'design', 'drama3'],
          description:
            'Which speech model to use, chosen by what the user gave you. "voice" (default, Qwen3-TTS): one of nine studio voices, optionally restyled by voiceDescription — the right choice for narration, voiceover and dialogue when no particular person is being imitated. "clone" (Qwen3-TTS): reproduces a specific voice from a recording the user uploaded or a resolved persona\'s voice recording; requires voiceSourceIndex. "design" (Qwen3-TTS): invents a speaker who does not exist from a written description; requires voiceDescription and takes no recording. "drama3" (Fish Drama 3): expressive 44.1 kHz acting speech supporting inline [direction] and <whisper>...</whisper> tags in prompt plus optional zero-shot voice cloning via voiceSourceIndex / voice_source_url and optional voiceTranscript. Pick "drama3" when the user names Fish Drama 3 or asks for acted inline vocal cues ([sighs], [laughs], <whisper>), "clone" whenever the user uploads a voice clip and asks for that person or asks for a saved persona\'s own voice, and "design" when they describe a speaker instead of choosing one.',
        },
        voice: {
          type: 'string',
          enum: [
            'serena',
            'vivian',
            'uncle_fu',
            'ryan',
            'aiden',
            'ono_anna',
            'sohee',
            'eric',
            'dylan',
          ],
          description:
            'Studio voice to speak in. Only used when model="voice". Female: serena (English), vivian (Chinese), ono_anna (Japanese), sohee (Korean). Male: ryan, aiden, eric, dylan (English), uncle_fu (older, Chinese). Every voice speaks all supported languages — the note above describes the accent it carries, not a limit on what it can read. Default: serena.',
        },
        voiceDescription: {
          type: 'string',
          description:
            'How the line should be delivered, or who should deliver it. With model="voice" this restyles the chosen voice without changing who it is: "whispering, close to the microphone", "furious", "reading a bedtime story", "like a sports commentator". With model="design" this is required and describes a speaker to invent: age, gender, accent, timbre, pace, mood, and recording space — "a warm, unhurried narrator in her forties with a faint Scottish lilt, close-miked in a quiet room". Describe one coherent person; contradictory directions produce a voice that shifts mid-sentence. Not accepted with model="clone" or model="drama3" (use inline [direction] tags in prompt on drama3). Limit 512 characters.',
          maxLength: 512,
        },
        voiceSourceIndex: {
          type: 'number',
          description:
            'Which audio holds the voice to clone, using the same numbering every other tool uses for audio: negative indices are uploads (-1 = first/primary upload, -2 = second upload, and so on) and 0-based non-negative indices are audio generated earlier in this conversation. A clip the user just uploaded is -1. A resolved persona\'s full voice recording uses the index resolve_personas reports. Required when model="clone", optional when model="drama3" (1-30s zero-shot voice cloning), and ignored otherwise. The clip should be one person speaking cleanly, with no music, no second speaker and no heavy room echo; anything past thirty seconds is trimmed.',
        },
        voice_source_url: {
          type: 'string',
          description:
            'REST alternative to voiceSourceIndex: retrievable original recording for clone mode or optional drama3 voice cloning.',
        },
        voiceTranscript: {
          type: 'string',
          description:
            'The exact words spoken in the uploaded clip, when model="clone" (up to 1024 characters) or model="drama3" with a reference voice (up to 2000 characters). Supplying it lets the model condition on the recording itself rather than on a speaker fingerprint alone, which is markedly closer to the source — set it whenever the user tells you what the clip says or the transcript is otherwise known. Omitting it still produces a recognisable clone, just a looser one. Leave it out for a persona voice recording: the persona\'s saved transcript is filled in automatically. Limit 2000 characters.',
          maxLength: 2000,
        },
        language: {
          type: 'string',
          enum: [
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
          ],
          description:
            'Language of the script. Default "auto", which infers it from the text and is the only setting that reads a code-switched line correctly. Pin a language only when auto mis-reads a name, a loanword, or a passage that is ambiguous between two of them. Cloning is cross-lingual: an English reference clip can read Japanese in the same voice.',
        },
        creativity: {
          type: 'number',
          minimum: 0.1,
          maximum: 2,
          description:
            'Qwen3-TTS (voice, clone, design) speech delivery variation from 0.1 to 2; default 0.9. Omit on model="drama3".',
        },
        outputFormat: {
          type: 'string',
          enum: ['wav', 'mp3', 'flac'],
          description: 'Audio file format; default wav.',
        },
        seed: {
          type: 'integer',
          minimum: 0,
          maximum: 4294967295,
          description: 'Optional seed for reproducible delivery.',
        },
        numberOfVariations: {
          type: 'number',
          description:
            'Number of takes (1-16). Each take is a separate read of the same script with the same voice, differing only in delivery. Use more than 1 when the user asks for options or alternate reads. Default: 1.',
          minimum: 1,
          maximum: 16,
        },
      },
      required: ['prompt'],
    },
  },
};
