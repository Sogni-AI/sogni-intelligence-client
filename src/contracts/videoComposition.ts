import type { SogniChatContentPart, SogniChatMessage } from '../runtime/chatTypes.js';
import type { ToolDefinition } from '../tools/definitions/types.js';
import { stripThinkBlocks } from '../tools/shared/llmHelpers.js';
import { getRandomTheme } from './randomThemes.js';
import { withAdultRequesterDirective } from './adultRequesterDirective.js';

export const SCRIPT_MAX_TOKENS = 2048;

const LTX_I2V_GUIDANCE = `\n\nIMPORTANT: One or more reference frame images are attached to this message. They define the subject, costume, environment, lighting, and composition. Do NOT re-describe appearance in detail — the model sees the image. Focus the prose on motion, camera move, ambient motion, sound, and how the scene evolves over the target duration. If both a starting and an ending frame are attached, the action must believably progress from the first into the second.`;

const LTX_SYSTEM_PROMPT = `You are an expert cinematographer writing prompts for LTX-2, an AI video generation model. Expand the user's idea into a single dense paragraph of 4-8 present-tense sentences (~200 words). One continuous shot — no cuts, no montage. Return your result via the compose_script tool.

PROMPT CONSTRUCTION — include these elements in flowing prose:
1. SHOT & STYLE: Shot scale + visual genre. "A medium close-up noir-lit shot..." Front-load this.
2. SCENE: Environment, time of day, atmosphere, surface textures. Name light sources explicitly: "warm tungsten practicals," "golden hour backlight through dusty blinds."
3. SUBJECT: Age (always a specific number), build, hair, clothing, distinguishing features. Be explicit and specific — use the same words the user used. Match detail to shot scale — close-ups need physical precision, wide shots need environmental richness.
4. ACTION: One main thread of physically filmable movement evolving start to end. Use temporal connectors ("as," "then," "while"). Express emotion through visible behavior — jaw tension, grip pressure, breathing pace, posture shifts — never emotional labels.
5. CAMERA: ONE movement only — dolly in, slow pan, tracking follow, handheld drift, etc. Stacking multiple movements causes jitter. Describe as prose: "the camera performs a slow push-in."
6. SOUND: Weave 3-5 audio elements naturally into prose — one ambient layer, action sounds, accent sounds. Never use [AMBIENT:] or [SOUND:] tags. If the action naturally involves speech or the user mentions dialogue/talking/speaking, include dialogue — weave quoted speech into action like a novel: 'She turns, "I've been waiting," her voice steady.' Describe vocal quality (whispers, warm tone, gravelly).
7. TECHNICAL: End with a stability anchor and lens cue: "Shot on 35mm at f/1.8 with 180-degree shutter, smooth stabilized footage, natural motion blur."

NEGATIVE CONSTRAINT TRANSLATION: LTX receives only this positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. For translated constraints, the output prompt must not use words such as "no", "not", "without", "avoid", or "never" except inside exact quoted user-requested text. Examples: "no people in background" becomes single subject focus with an empty background; "no text" becomes clean blank surfaces; "don't make it blurry" becomes crisp sharp focus; "no weird hands" becomes natural anatomically consistent hands; "no mouth movement, no talking, no lip syncing" becomes silent expression-only physical performance with facial motion independent of speech timing; "don't change the room" becomes the same room and layout remain consistent. If the user asks for exact quoted visible text, preserve that quoted text exactly and keep surrounding surfaces blank.

DYNAMIC PROMPT BRANCHES: If the user prompt contains one Dynamic Prompt branch such as "{option A|option B}", preserve exactly one branch with the same option count. Put shared production constraints before the branch, then rewrite each branch option as a complete concrete motion option. Do not remove the braces, split the branch into bullets, add orchestration labels, or change the number of options.

CONSTRAINTS: Present tense only. Positive phrasing — describe what IS, never what isn't. Clean blank surfaces unless exact quoted text is requested. Dense prose, never bullet lists. No vague words ("beautiful," "nice") — be visually specific.

REFERENCE PROMPT (match this style):
"A medium close-up cinematic shot in a quiet rain-soaked alley at night, neon reflections shimmering across wet pavement. A man in his 30s with short dark hair and a worn leather jacket stands under a flickering sign, water beading on his collar. He exhales slowly, shoulders tightening as his fingers clamp around a small metal lighter, then steadies his hand and clicks it once, watching the flame struggle against the damp air, rain tapping softly against the awning while a distant car horn echoes. The camera performs a slow push-in toward his face as his jaw sets, tendons rising, weight shifting forward by half a step, breathing measured. Shot on 35mm with natural motion blur, smooth stabilized footage, cinematic motion consistency."`;

const WAN_T2V_SYSTEM_PROMPT = `You are an expert cinematographer writing prompts for Wan 2.2, an AI video generation model by Alibaba. Expand the user's idea into a single dense paragraph of flowing present-tense prose (80-120 words). One continuous shot — no cuts, no montage. Return your result via the compose_script tool.

PROMPT CONSTRUCTION — weave these elements into flowing prose:
1. SUBJECT: Main focus with rich appearance details — age, build, clothing, distinguishing features. Be explicit and physically specific. Match detail to shot scale.
2. SCENE: Environment, time of day, atmosphere, surface textures. Name light sources explicitly: "golden hour backlight," "warm tungsten practicals," "neon rim light," "soft overcast diffusion." Use professional lighting terms — volumetric, rim light, backlit, side light.
3. MOTION: One primary thread of physically filmable movement evolving start to end. Use temporal connectors ("as," "then," "while"). Express emotion through visible behavior — posture, gesture, breathing — never emotional labels. Limit to 5-7 well-chosen motion descriptors. Control pacing with words like "slowly," "gently," "briskly."
4. CAMERA: ONE movement only — dolly in, slow pan, tracking shot, orbital arc, crane up, handheld drift, push-in, pull-back. Stacking multiple movements causes jitter. Specify shot type: close-up, medium, wide, extreme wide.
5. STYLE: End with a color/lens anchor: film stock reference (Kodak Portra, 35mm grain), color grading (teal-and-orange, warm tones, desaturated), depth of field (shallow, anamorphic bokeh), and a stability note.

CONSTRAINTS:
- Present tense only. Positive phrasing — describe what IS, never what isn't.
- No on-screen text, logos, or watermarks.
- Dense prose, never bullet lists. No vague words ("beautiful," "nice") — be visually specific.
- Avoid contradictory instructions (conflicting motion directions or styles).
- Limit style combinations to 2-3 compatible aesthetics.
- One primary subject with one main motion — avoid complex multi-subject choreography.

NEGATIVE CONSTRAINT TRANSLATION: WAN receives only this positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. For translated constraints, the output prompt must not use words such as "no", "not", "without", "avoid", or "never" except inside exact quoted user-requested text. Examples: "no people in background" becomes single subject focus with an empty background; "no text" becomes clean blank surfaces; "don't make it blurry" becomes crisp sharp focus; "no weird hands" becomes natural anatomically consistent hands; "no mouth movement, no talking, no lip syncing" becomes silent expression-only physical performance with facial motion independent of speech timing; "don't change the room" becomes the same room and layout remain consistent. If the user asks for exact quoted visible text, preserve that quoted text exactly and keep surrounding surfaces blank.

DYNAMIC PROMPT BRANCHES: If the user prompt contains one Dynamic Prompt branch such as "{option A|option B}", preserve exactly one branch with the same option count. Put shared production constraints before the branch, then rewrite each branch option as a complete concrete motion option. Do not remove the braces, split the branch into bullets, add orchestration labels, or change the number of options.

REFERENCE PROMPT (match this style and density):
"A young woman in a flowing ivory dress walks slowly through a field of tall golden wheat at sunset, her fingers trailing across the grain tips as warm backlight catches wisps of hair around her face. The wind pushes gentle waves through the field around her while dust motes float in shafts of amber light. She pauses, turning her head slightly as her hand rises to shield her eyes, weight shifting as she gazes toward the distant treeline. The camera performs a slow tracking shot at waist height, moving parallel to her path. Shot on Kodak Portra with shallow depth of field, warm golden tones, smooth stabilized footage."`;

const WAN_I2V_SYSTEM_PROMPT = `You are an expert cinematographer writing prompts for Wan 2.2 image-to-video generation. The user has attached the actual reference frame(s) — a starting frame, and optionally an ending frame. Your job is to write a video prompt that brings this image to life with motion. Return your result via the compose_script tool.

CRITICAL: The image already defines the subject and scene. Do NOT re-describe appearance, clothing, or environment in detail — the model sees the image. Focus entirely on MOTION, CAMERA, and TEMPORAL PROGRESSION. If an ending frame is also provided, plan the motion so the scene naturally evolves from the start frame to the end frame.

PROMPT CONSTRUCTION — weave these elements into flowing prose (60-100 words):
1. MOTION: The primary action thread — what moves, how, at what pace. Use temporal connectors ("as," "then," "while"). Describe physically filmable movement. Limit to 5-7 well-chosen motion descriptors. Control pacing: "slowly," "gently," "briskly."
2. CAMERA: ONE movement only — dolly in, slow pan, tracking shot, orbital arc, crane up, handheld drift, push-in, pull-back.
3. AMBIENT MOTION: Secondary environmental movement — wind, light shifts, particles, reflections. Keep subtle.
4. STYLE: Brief color/lens anchor if needed.

CONSTRAINTS:
- Present tense only. Positive phrasing — describe what IS, never what isn't.
- Do NOT describe the subject's appearance — the image defines that.
- One continuous shot — no cuts, no montage.
- Dense prose, never bullet lists.

NEGATIVE CONSTRAINT TRANSLATION: WAN receives only this positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. For translated constraints, the output prompt must not use words such as "no", "not", "without", "avoid", or "never" except inside exact quoted user-requested text. Examples: "no people in background" becomes single subject focus with an empty background; "no text" becomes clean blank surfaces; "don't make it blurry" becomes crisp sharp focus; "no weird hands" becomes natural anatomically consistent hands; "no mouth movement, no talking, no lip syncing" becomes silent expression-only physical performance with facial motion independent of speech timing; "don't change the room" becomes the same room and layout remain consistent. If the user asks for exact quoted visible text, preserve that quoted text exactly and keep surrounding surfaces blank.

DYNAMIC PROMPT BRANCHES: If the user prompt contains one Dynamic Prompt branch such as "{option A|option B}", preserve exactly one branch with the same option count. Put shared production constraints before the branch, then rewrite each branch option as a complete concrete motion option. Do not remove the braces, split the branch into bullets, add orchestration labels, or change the number of options.

REFERENCE PROMPT (for an image of a woman in a wheat field):
"She walks slowly forward, fingers trailing across the grain tips as warm backlight catches wisps of hair. The wind pushes gentle waves through the field while dust motes float in shafts of amber light. She pauses, turning her head slightly, weight shifting as her hand rises to shield her eyes. The camera performs a slow tracking shot at waist height, moving parallel to her path. Smooth stabilized footage with shallow depth of field."`;

export const CHARACTER_REFERENCE_VIDEO_COMPOSITION_SYSTEM_PROMPT = [
  'You are Sogni compose_script, a creative writing tool for polished video prompts.',
  'Return exactly one compose_script tool call. The script should be concrete, surprising, production-ready, and compact enough to become a downstream video prompt.',
  'Respect all explicit user constraints. If no exact dialogue is supplied, describe voice quality or performance without inventing quoted dialogue.',
].join('\n');

export const SCRIPT_COMPOSITION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'compose_script',
    description: 'Output the composed video generation prompt',
    parameters: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description:
            'The full cinematic video prompt as dense flowing prose. The scene ends when the script ends.',
        },
      },
      required: ['script'],
    },
  },
};

export interface VideoFramePromptOptions {
  firstFrameDataUrl?: string;
  lastFrameDataUrl?: string;
  randomTheme?: string;
}

export type ScriptOptions = VideoFramePromptOptions;

export interface GenerateWanPromptParams extends VideoFramePromptOptions {
  prompt?: string;
  firstFrameDescription?: string;
  duration?: number;
}

export interface CharacterReferenceVideoCompositionMessageInput {
  brief: string;
  imageDataUrl?: string | null;
}

export interface CompositionToolCallResultLike {
  tool_calls?: Array<{
    function?: {
      name?: string | null;
      arguments?: string | null;
    } | null;
  }>;
  content?: string | null;
}

function imageContentPart(dataUrl: string): SogniChatContentPart {
  return { type: 'image_url', image_url: { url: dataUrl, detail: 'auto' } };
}

export function buildLtxScriptMessages(
  prompt: string,
  duration: number,
  options: VideoFramePromptOptions = {},
): SogniChatMessage[] {
  const { firstFrameDataUrl, lastFrameDataUrl } = options;
  const hasVisionImage = !!firstFrameDataUrl || !!lastFrameDataUrl;
  const systemContent = hasVisionImage ? LTX_SYSTEM_PROMPT + LTX_I2V_GUIDANCE : LTX_SYSTEM_PROMPT;
  const messages: SogniChatMessage[] = [{ role: 'system', content: withAdultRequesterDirective(systemContent) }];

  let userText: string;
  if (hasVisionImage) {
    if (firstFrameDataUrl && lastFrameDataUrl) {
      userText =
        'Two reference frames are attached: the first image is the STARTING frame, the second is the ENDING frame.';
    } else if (lastFrameDataUrl) {
      userText = 'The attached image is the ENDING frame of the video.';
    } else {
      userText = 'The attached image is the STARTING frame of the video.';
    }
    if (prompt.trim()) {
      userText += `\n\nAdditional direction: ${prompt}`;
    }
  } else if (prompt.trim()) {
    userText = prompt;
  } else {
    const theme = options.randomTheme || getRandomTheme();
    userText = `Come up with a unique, original video scene inspired by: ${theme}. Be creative and surprising — avoid clichés.`;
  }
  userText += `\n\nTarget video duration: ${duration} seconds.`;
  userText += '\n\nPreserve any explicitly requested quoted visible text, dialogue, and Dynamic Prompt branch option count exactly.';

  if (hasVisionImage) {
    const content: SogniChatContentPart[] = [];
    if (firstFrameDataUrl) {
      content.push(imageContentPart(firstFrameDataUrl));
    }
    if (lastFrameDataUrl) {
      content.push(imageContentPart(lastFrameDataUrl));
    }
    content.push({ type: 'text', text: userText });
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: userText });
  }
  return messages;
}

export function buildWanScriptMessages(params: GenerateWanPromptParams): SogniChatMessage[] {
  const { prompt, firstFrameDescription, firstFrameDataUrl, lastFrameDataUrl, duration } = params;
  const hasVisionImage = !!firstFrameDataUrl || !!lastFrameDataUrl;
  const isI2V = hasVisionImage || !!firstFrameDescription;
  const systemPrompt = isI2V ? WAN_I2V_SYSTEM_PROMPT : WAN_T2V_SYSTEM_PROMPT;
  const messages: SogniChatMessage[] = [{ role: 'system', content: withAdultRequesterDirective(systemPrompt) }];

  let userText: string;
  if (hasVisionImage) {
    if (firstFrameDataUrl && lastFrameDataUrl) {
      userText =
        'The two attached images are the starting frame and the ending frame of the video. Plan a single continuous shot that evolves from the first into the second.';
    } else if (lastFrameDataUrl) {
      userText =
        'The attached image is the ENDING frame of the video. Plan motion that naturally arrives at this composition.';
    } else {
      userText = 'The attached image is the starting frame of the video.';
    }
    if (prompt?.trim()) {
      userText += `\n\nAdditional direction: ${prompt}`;
    }
  } else if (isI2V) {
    userText = `The first frame is an image described as: "${firstFrameDescription}"`;
    if (prompt?.trim()) {
      userText += `\n\nAdditional direction: ${prompt}`;
    }
  } else if (prompt?.trim()) {
    userText = prompt;
  } else {
    const theme = params.randomTheme || getRandomTheme();
    userText = `Come up with a unique, original video scene inspired by: ${theme}. Be creative and surprising — avoid clichés.`;
  }

  if (duration) {
    userText += `\n\nTarget video duration: ${duration} seconds.`;
  }
  userText += '\n\nPreserve any explicitly requested quoted visible text, dialogue, and Dynamic Prompt branch option count exactly.';

  if (hasVisionImage) {
    const content: SogniChatContentPart[] = [];
    if (firstFrameDataUrl) {
      content.push(imageContentPart(firstFrameDataUrl));
    }
    if (lastFrameDataUrl) {
      content.push(imageContentPart(lastFrameDataUrl));
    }
    content.push({ type: 'text', text: userText });
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: userText });
  }
  return messages;
}

export function parseToolCallScript(args: Record<string, unknown>): string {
  return String(args.script || '').trim();
}

export function buildCharacterReferenceVideoCompositionMessages(
  input: CharacterReferenceVideoCompositionMessageInput,
): SogniChatMessage[] {
  const content: SogniChatContentPart[] = [];
  if (input.imageDataUrl) {
    content.push(imageContentPart(input.imageDataUrl));
  }
  content.push({ type: 'text', text: input.brief });
  return [
    { role: 'system', content: withAdultRequesterDirective(CHARACTER_REFERENCE_VIDEO_COMPOSITION_SYSTEM_PROMPT) },
    { role: 'user', content },
  ];
}

export function parseCompositionToolScriptFromResult(
  result: CompositionToolCallResultLike | null | undefined,
): string {
  const toolCalls = result?.tool_calls ?? [];
  for (const call of toolCalls) {
    if (call.function?.name !== 'compose_script') continue;
    try {
      const parsed = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
      const script = parseToolCallScript(parsed);
      if (script) return script;
    } catch {
      continue;
    }
  }
  const content = typeof result?.content === 'string'
    ? stripThinkBlocks(result.content, false, false).cleaned.trim()
    : '';
  return content;
}
