import type { SogniChatMessage } from '../runtime/chatTypes.js';
import type { ToolDefinition } from '../tools/definitions/types.js';
import { withAdultRequesterDirective } from './adultRequesterDirective.js';

export const ID_LORA_MAX_TOKENS = 1024;

const ID_LORA_SYSTEM_PROMPT = `You restructure dense cinematic LTX video prompts into the three-section format used by ID-LoRA, an identity-preserving audio-video generation model. This is a structural transform — preserve every piece of information from the input, do not summarize, do not drop detail. Every piece of input information must appear in exactly one section. Return your result via the compose_id_lora_prompt tool.

SECTION RULES:

[VISUAL]: Scene, subject appearance (age, build, hair, clothing, distinguishing features), setting, lighting, camera shot/movement, and physically visible action. Be descriptive — include shot type, colors, clothing, background details. MUST mention that the person is speaking to avoid voice-overs (e.g. "his mouth moves as he speaks", "she talks animatedly", "lips move in time with the words"). Physical acting beats belong here. Dialogue WORDS must NOT appear here — replace any quoted speech with narrative descriptions like "starts speaking", "continues talking", "pauses mid-sentence". Keep present-tense and concrete. No ambient sound descriptions here.

[SPEECH]: Raw transcript ONLY — the literal words spoken, no quotation marks, no attribution ("he says"), no acting descriptions, no stage directions. Use \`...\` for pauses or beats between phrases.
  - If the source contains quoted dialogue, use it verbatim.
  - If the source mentions speaking/talking/whispering but provides no exact words, leave this empty and keep only the visible mouth movement / vocal delivery cues in [VISUAL] or [SOUNDS]. Do not invent words.
  - If the source has no speech cues at all, leave this empty.

[SOUNDS]: Controls both speaking style AND ambient audio. First describe the speaker's vocal qualities (tone, volume, pace, microphone proximity, accent — e.g. "warm male voice, close mic, conversational pace"). Then describe ambient and environmental audio from the source (music, room noise, weather, sound effects). 1-3 sentences combined.

EXAMPLE:

Input:
"You know, I used to think this was a bad idea," he says while pausing to light a cigarette, "But now I'm not so sure." Warm bar lighting, low jazz playing.

Output:
visual: Medium shot in a warm-lit bar. A man looks at the camera, starts speaking, pauses to take out a cigarette and light it, then continues talking while exhaling a little smoke. Natural hand motion, subtle pause during the lighting action, his mouth moves clearly in sync with the words.
speech: You know, I used to think this was a bad idea. ... But now I'm not so sure.
sounds: Calm conversational male voice, close mic, brief pause mid-sentence. Lighter flick and cigarette inhale audible, low jazz plays softly in the background, quiet bar ambience.`;

export const ID_LORA_COMPOSITION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'compose_id_lora_prompt',
    description: 'Output the LTX prompt restructured into ID-LoRA visual/speech/sounds sections.',
    parameters: {
      type: 'object',
      properties: {
        visual: {
          type: 'string',
          description:
            'Scene, subject appearance, lighting, camera, and visible action. No dialogue, no ambient sound.',
        },
        speech: {
          type: 'string',
          description:
            'Literal words spoken by the subject, verbatim, no quotes. Empty string if the source has no speech.',
        },
        sounds: {
          type: 'string',
          description:
            "Speaker vocal qualities (volume, tone, mic proximity) followed by ambient/background audio.",
        },
      },
      required: ['visual', 'speech', 'sounds'],
    },
  },
};

export interface IdLoRaPromptParts {
  visual: string;
  speech: string;
  sounds: string;
}

export function buildIdLoRaConversionMessages(ltxPrompt: string): SogniChatMessage[] {
  return [
    { role: 'system', content: withAdultRequesterDirective(ID_LORA_SYSTEM_PROMPT) },
    {
      role: 'user',
      content: `Convert this LTX prompt to ID-LoRA format:\n\n${ltxPrompt.trim()}`,
    },
  ];
}

export function parseToolCallIdLoRaParts(args: Record<string, unknown>): IdLoRaPromptParts {
  return {
    visual: String(args.visual || '').trim(),
    speech: String(args.speech || '').trim(),
    sounds: String(args.sounds || '').trim(),
  };
}

export function formatIdLoRaPrompt(parts: IdLoRaPromptParts): string {
  const lines = [`[VISUAL]: ${parts.visual}`];
  if (parts.speech) lines.push(`[SPEECH]: ${parts.speech}`);
  lines.push(`[SOUNDS]: ${parts.sounds}`);
  return lines.join('\n');
}
