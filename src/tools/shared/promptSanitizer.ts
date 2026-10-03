/**
 * Compatibility helper for batch generation.
 *
 * Output counts and variation selection belong to structured tool arguments.
 * Scene text can contain counts, layouts, quoted copy, or dynamic prompt groups;
 * rewriting those words here can change the requested image. Preserve it verbatim.
 */
export function sanitizeBatchPrompt(prompt: string): string {
  return prompt;
}
