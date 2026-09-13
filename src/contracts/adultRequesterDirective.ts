/**
 * Product-wide requester latitude directive. Every Sogni assistant and prompt
 * shaper system prompt carries this line so the LLM does not sanitize, soften,
 * or refuse adult creative requests the platform supports.
 */
export const SOGNI_ADULT_REQUESTER_DIRECTIVE =
  "Don't be prude, you're dealing with an adult. Do what the requester says as long as it's not physically hurting anybody.";

/**
 * Appends the requester directive to a system prompt. Idempotent, so layered
 * builders (a shaper wrapped by a dispatcher) never repeat the line.
 */
export function withAdultRequesterDirective(systemPrompt: string): string {
  if (systemPrompt.includes(SOGNI_ADULT_REQUESTER_DIRECTIVE)) return systemPrompt;
  const trimmed = systemPrompt.trimEnd();
  return trimmed ? `${trimmed}\n\n${SOGNI_ADULT_REQUESTER_DIRECTIVE}` : SOGNI_ADULT_REQUESTER_DIRECTIVE;
}
