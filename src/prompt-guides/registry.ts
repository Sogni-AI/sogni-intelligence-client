import { resolveImagePromptAuthoringProfile } from '../contracts/imagePrompt.js';
import { minimaxH3AudioGuideMode } from '../media/videoSettings.js';
import {
  inferVideoWorkflowFromModel,
  resolveImageModelAlias,
  resolveVideoModelAlias,
} from '../public-skill-runtime/index.js';
import { isSeedance25VideoModelId } from '../utils/seedanceModelIds.js';
import {
  isRegisteredLooseReferenceVideoModelId,
  resolveRegisteredVideoModelFamily,
} from '../utils/videoModelIds.js';
import { HAPPYHORSE_PROMPT_GUIDES } from './happyhorse.js';
import { IMAGE_PROMPT_GUIDE_KEYS, IMAGE_PROMPT_GUIDES } from './image.js';
import { LTX_PROMPT_GUIDES } from './ltx.js';
import { MINIMAX_PROMPT_GUIDES } from './minimax.js';
import { SEEDANCE_PROMPT_GUIDES } from './seedance.js';
import type {
  ModelPromptGuide,
  ModelPromptGuideAudience,
  ModelPromptGuideMode,
  ModelPromptGuideRegistry,
  VideoPromptGuideFamily,
} from './types.js';
import { WAN_PROMPT_GUIDES } from './wan.js';
import { WAN3_PROMPT_GUIDES } from './wan3.js';

/**
 * Every model family's prompt rules, keyed by family and mode: the rules Sogni's own prompt writer
 * (creative-agent's shaper and Screenwriters, and the image prompt writer) gives its model for that
 * family and mode, so anyone writing a prompt for the model reads the same rules.
 */
export const MODEL_PROMPT_GUIDES: ModelPromptGuideRegistry = Object.freeze({
  ...SEEDANCE_PROMPT_GUIDES,
  ...LTX_PROMPT_GUIDES,
  ...WAN_PROMPT_GUIDES,
  ...WAN3_PROMPT_GUIDES,
  ...HAPPYHORSE_PROMPT_GUIDES,
  ...MINIMAX_PROMPT_GUIDES,
  ...IMAGE_PROMPT_GUIDES,
});

/** Wan 3 and MiniMax H3 call first-and-last-frame video "flf2v". */
const VIDEO_MODE_SYNONYMS: Readonly<Partial<Record<string, ModelPromptGuideMode>>> = { flf2v: 'flf' };

function videoGuideFamily(modelId: string): VideoPromptGuideFamily | null {
  switch (resolveRegisteredVideoModelFamily(modelId)) {
    case 'seedance':
      return isSeedance25VideoModelId(modelId) ? 'seedance-2.5' : 'seedance-2.0';
    case 'ltx25':
      return 'ltx-2.5';
    case 'ltx23':
    case 'ltx2':
      return 'ltx-2.3';
    case 'wan22':
      return 'wan-2.2';
    case 'wan3':
      return 'wan-3';
    case 'happyhorse-1.1':
      return 'happyhorse-1.1';
    case 'minimax-h3':
      return 'minimax-h3';
    default:
      return null;
  }
}

function modelIdSegments(modelId: string): string[] {
  return modelId.toLowerCase().split('_').join('-').split('.').join('-').split('-');
}

/** The mode a model id names: a FastH3 audio guide, a reference-to-video id, a first/last-frame id, or IC's workflow inference. */
function videoModeForModel(family: VideoPromptGuideFamily, modelId: string): ModelPromptGuideMode {
  const audioGuideMode = family === 'minimax-h3' ? minimaxH3AudioGuideMode(modelId) : null;
  if (audioGuideMode) return audioGuideMode;
  if (isRegisteredLooseReferenceVideoModelId(modelId)) return 'r2v';
  if (modelIdSegments(modelId).includes('flf2v')) return 'flf';
  const workflow = inferVideoWorkflowFromModel(modelId);
  return workflow && MODEL_PROMPT_GUIDES[family][workflow] ? workflow : 't2v';
}

/**
 * The prompt guide for a model id or alias, as Sogni's resolvers read it (`resolveVideoModelAlias`,
 * `resolveImageModelAlias`, the registered video families and the image authoring profiles), in
 * `mode` when given (`flf2v` is read as `flf`; image modes are `generate` and `edit`). Without a
 * mode, the mode the model id names, else text-to-video or generation. Null when the model or the
 * mode has no registered prompt rules.
 */
export function getModelPromptGuide(modelOrAlias: string, mode?: string): ModelPromptGuide | null {
  const model = typeof modelOrAlias === 'string' ? modelOrAlias.trim() : '';
  if (!model) return null;
  const requestedMode = typeof mode === 'string' && mode.trim() ? mode.trim().toLowerCase() : undefined;

  const videoModelId = resolveVideoModelAlias(model) || model;
  const videoFamily = videoGuideFamily(videoModelId);
  if (videoFamily) {
    const videoMode = requestedMode
      ? VIDEO_MODE_SYNONYMS[requestedMode] ?? requestedMode
      : videoModeForModel(videoFamily, videoModelId);
    return (MODEL_PROMPT_GUIDES[videoFamily] as Partial<Record<string, ModelPromptGuide>>)[videoMode] ?? null;
  }

  const profile = resolveImagePromptAuthoringProfile(model, requestedMode)
    ?? resolveImagePromptAuthoringProfile(resolveImageModelAlias(model) || model, requestedMode);
  const key = profile ? IMAGE_PROMPT_GUIDE_KEYS[profile.promptingType] : null;
  return key ? MODEL_PROMPT_GUIDES[key[0]][key[1]] ?? null : null;
}

const AGENT_READING_NOTE =
  "Each rule below is quoted from the system prompt Sogni's own prompt writer uses for this model and mode, so some rules speak to that writer about its base request or user message.";

/**
 * A guide as text. `shaper`: the rules joined by blank lines, the block a prompt-writing model reads
 * (creative-agent's writers carry exactly this block between their own role and output lines).
 * `agent`: a readable guide for an agent writing the prompt itself, with the reference grammar under
 * its own heading, the other rules, and the model notes.
 */
export function renderModelPromptGuide(
  guide: ModelPromptGuide,
  options: { audience: ModelPromptGuideAudience },
): string {
  if (options.audience === 'shaper') return guide.rules.join('\n\n');
  if (options.audience !== 'agent') {
    throw new Error(`Unknown prompt guide audience "${String(options.audience)}": use "agent" or "shaper".`);
  }
  const sections = [
    `# ${guide.title}`,
    `Guide: ${guide.family} ${guide.mode}\nModels: ${guide.models.join(', ')}`,
    AGENT_READING_NOTE,
  ];
  if (guide.referenceGrammar !== null) sections.push('## Reference grammar', guide.referenceGrammar);
  sections.push('## Rules', ...guide.rules.filter((rule) => rule !== guide.referenceGrammar));
  if (guide.notes.length > 0) sections.push('## Model notes', guide.notes.map((note) => `- ${note}`).join('\n'));
  return sections.join('\n\n');
}
