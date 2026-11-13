/** Video model families with their own prompt rules. */
export type VideoPromptGuideFamily =
  | 'seedance-2.0'
  | 'seedance-2.5'
  | 'ltx-2.5'
  | 'ltx-2.3'
  | 'wan-2.2'
  | 'wan-3'
  | 'happyhorse-1.1'
  | 'minimax-h3';

/** Image model families with their own prompt rules, named after their prompting guide. */
export type ImagePromptGuideFamily =
  | 'chroma'
  | 'flux1-schnell'
  | 'sdxl'
  | 'sd15'
  | 'pony'
  | 'fast'
  | 'sd3'
  | 'krea2'
  | 'moss-image'
  | 'flux3-klein'
  | 'qwen'
  | 'z-image'
  | 'gpt-image'
  | 'seedream'
  | 'seedream-5.5';

export type ModelPromptGuideFamily = VideoPromptGuideFamily | ImagePromptGuideFamily;

/**
 * A mode within a family. Video: t2v (text, and loose references where the family takes them),
 * i2v (first frame), l2v (last frame), flf (first and last frame), v2v, r2v, a2v and ia2v (audio,
 * with an image), flfa2v, s2v, animate-move, animate-replace, extend (continue a video), and the
 * MiniMax H3 keyframe modes. Image: generate or edit.
 */
export type ModelPromptGuideMode =
  | 't2v'
  | 'i2v'
  | 'l2v'
  | 'flf'
  | 'v2v'
  | 'r2v'
  | 'a2v'
  | 'ia2v'
  | 'flfa2v'
  | 's2v'
  | 'animate-move'
  | 'animate-replace'
  | 'extend'
  | 'i2v-keyframes'
  | 'a2v-keyframes'
  | 'generate'
  | 'edit';

/** `agent`: a readable guide for whoever writes the prompt. `shaper`: the rule block a prompt-writing model reads. */
export type ModelPromptGuideAudience = 'agent' | 'shaper';

export interface ModelPromptGuide {
  readonly family: ModelPromptGuideFamily;
  readonly mode: ModelPromptGuideMode;
  readonly title: string;
  /** Model ids and aliases that resolve to this guide. */
  readonly models: readonly string[];
  /** The rule that says how to name attached references, when the mode takes loose references; it is also one of `rules`. */
  readonly referenceGrammar: string | null;
  /** The rule sections, verbatim and in the order Sogni's prompt writer reads them. */
  readonly rules: readonly string[];
  /** The family's model notes: the model assumptions Sogni's prompt enhancer reports for it. */
  readonly notes: readonly string[];
}

export type ModelPromptGuideRegistry = {
  readonly [Family in ModelPromptGuideFamily]: Readonly<Partial<Record<ModelPromptGuideMode, ModelPromptGuide>>>;
};

export function modelPromptGuide(guide: ModelPromptGuide): ModelPromptGuide {
  if (guide.referenceGrammar !== null && !guide.rules.includes(guide.referenceGrammar)) {
    throw new Error(`The ${guide.family} ${guide.mode} prompt guide's reference grammar must be one of its rules.`);
  }
  return Object.freeze({
    ...guide,
    models: Object.freeze([...guide.models]),
    rules: Object.freeze([...guide.rules]),
    notes: Object.freeze([...guide.notes]),
  });
}
