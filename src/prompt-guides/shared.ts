/**
 * Rule text shared by several model families.
 *
 * Moved verbatim from @sogni/creative-agent 2.27.8 (src/prompts/creativeIntent.ts and the LTX, Wan
 * 2.2 and HappyHorse prompts). creative-agent now imports these rules and composes its writer
 * prompts from them, byte for byte as before.
 */

/** Shared authoring guidance: model-specific defaults must not rewrite the brief. */
export const CREATIVE_INTENT_FIDELITY_GUIDANCE = `CREATIVE FIDELITY: Preserve the user's specified subjects and ages, relationships, wardrobe, setting, genre, mood, action, shot composition, camera behavior, dialogue, visible text, and exclusions. Enrich only unspecified details that support those choices. Express the requested mood through observable performance, light, texture, and composition without replacing the premise or adding a new story event. Pacing and cinematography suggestions are defaults: an explicit locked camera, held pose, quiet pause, sustained action, or silence takes priority. Keep supplied dialogue and visible text in their original language and wording. Before returning, check the result against the original request and remove additions that contradict it.`;

/** Identical in the LTX 2.x frame prompts, the Wan 2.2 frame prompts and HappyHorse 1.1. */
export const DYNAMIC_PROMPT_BRANCH_GUIDANCE = `DYNAMIC PROMPT BRANCHES: If the base request contains one Dynamic Prompt branch such as "{option A|option B}", preserve exactly one branch with the same option count. Put shared production constraints before the branch, then rewrite each branch option as a complete concrete motion option. Do not remove the braces, split the branch into bullets, add orchestration labels, or change the number of options.`;
